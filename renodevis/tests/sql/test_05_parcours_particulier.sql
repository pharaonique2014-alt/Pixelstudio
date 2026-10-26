-- Parcours particulier via l'API serveur (service_role) : code SMS, tentatives,
-- doublons, limites de débit, journal de consentement, effacement.
begin;
\ir _helpers.sql
\ir _fixtures.sql

set local role service_role;
do $$
declare
  base jsonb := jsonb_build_object(
    'trade', 'chassis', 'project_type', 'renovation', 'budget', '5000_10000', 'delay', 'asap',
    'detail', '{"quantite":"1_3"}'::jsonb, 'postal_code', '6000', 'commune', 'Charleroi',
    'first_name', 'Chloé', 'phone_e164', '+32470123456', 'email', 'chloe@exemple.be',
    'phone_hash', rdtest.h('+32470123456'), 'ip_hash', rdtest.h('ip-1'),
    'consent_version', 'demande-devis-2026-10-v1',
    'session_id', '11111111-1111-1111-1111-111111111111',
    'utm', '{"utm_source":"meta","utm_campaign":"chassis-test"}'::jsonb,
    'code_hash', rdtest.h('123456'));
  j jsonb; v_id uuid; i int;
begin
  -- Version de consentement obsolète refusée
  j := public.rd_api_submit(base || '{"consent_version":"ancienne"}');
  perform rdtest.ok(j->>'error' = 'consent_outdated', 'consentement obsolète refusé');
  -- Métier inactif refusé
  j := public.rd_api_submit(base || '{"trade":"toiture"}');
  perform rdtest.ok(j->>'error' = 'invalid_input', 'métier inactif refusé');
  -- Entrée invalide (code postal) refusée proprement
  j := public.rd_api_submit(base || '{"postal_code":"99999"}');
  perform rdtest.ok(j->>'error' = 'invalid_input', 'code postal invalide refusé');

  j := public.rd_api_submit(base || jsonb_build_object('ip_hash', rdtest.h('ip-2')));
  perform rdtest.ok((j->>'ok')::boolean, 'demande créée : ' || j::text);
  v_id := (j->>'request_id')::uuid;
  perform rdtest.ok((select status from public.requests where id = v_id) = 'pending_sms', 'en attente SMS');
  perform rdtest.ok((select consent_version from public.consent_logs where request_id = v_id) = 'demande-devis-2026-10-v1', 'consentement journalisé (version)');
  perform rdtest.ok((select ip_hash from public.consent_logs where request_id = v_id) = rdtest.h('ip-2'), 'IP hachée journalisée');
  perform rdtest.ok(exists (select 1 from public.tracking_events where request_id = v_id and event = 'request_submitted'), 'événement « demande envoyée »');
  perform rdtest.ok((select count(*) from public.assignments where request_id = v_id) = 0, 'aucune attribution avant SMS');

  -- Renvoi trop rapide
  j := public.rd_api_resend(jsonb_build_object('request_id', v_id, 'code_hash', rdtest.h('654321'), 'ip_hash', rdtest.h('ip-2')));
  perform rdtest.ok(j->>'error' = 'too_soon', 'renvoi < 60 s refusé');

  -- Mauvais code : compteur de tentatives
  j := public.rd_api_verify(jsonb_build_object('request_id', v_id, 'code_hash', rdtest.h('000000'), 'ip_hash', rdtest.h('ip-2')));
  perform rdtest.ok(j->>'error' = 'invalid_code' and (j->>'remaining')::int = 4, 'mauvais code : 4 essais restants');

  -- Bon code
  j := public.rd_api_verify(jsonb_build_object('request_id', v_id, 'code_hash', rdtest.h('123456'), 'ip_hash', rdtest.h('ip-2')));
  perform rdtest.ok((j->>'ok')::boolean and (j->>'assigned')::int = 1, 'SMS validé + 1 entreprise (A) : ' || j::text);
  perform rdtest.ok((select status from public.requests where id = v_id) = 'validated', 'demande validée');
  perform rdtest.ok((select expires_at::date from public.requests where id = v_id) = (now() + interval '30 days')::date, 'expire dans 30 jours');
  perform rdtest.ok(exists (select 1 from public.tracking_events where request_id = v_id and event = 'sms_validated'), 'événement « SMS validé »');
  perform rdtest.ok(j->'summary' ? 'commune' and not (j->'summary' ? 'phone_e164'), 'résumé e-mail admin sans téléphone');

  -- Re-vérification : idempotente
  j := public.rd_api_verify(jsonb_build_object('request_id', v_id, 'code_hash', rdtest.h('123456'), 'ip_hash', rdtest.h('ip-2')));
  perform rdtest.ok((j->>'already')::boolean, 'déjà validée');

  -- Doublon : même téléphone + même métier sur 30 jours
  j := public.rd_api_submit(base || jsonb_build_object('ip_hash', rdtest.h('ip-3')));
  perform rdtest.ok(j->>'error' = 'duplicate', 'doublon détecté');
end $$;

-- Verrouillage après 5 mauvais codes
do $$
declare j jsonb; v_id uuid; i int;
begin
  j := public.rd_api_submit(jsonb_build_object(
    'trade', 'chassis', 'project_type', 'extension', 'budget', 'inconnu', 'delay', '6_mois',
    'detail', '{"quantite":"plus_10"}'::jsonb, 'postal_code', '7000', 'commune', 'Mons',
    'first_name', 'Dan', 'phone_e164', '+32470999999', 'email', 'dan@exemple.be',
    'phone_hash', rdtest.h('+32470999999'), 'ip_hash', rdtest.h('ip-4'),
    'consent_version', 'demande-devis-2026-10-v1', 'code_hash', rdtest.h('111111')));
  v_id := (j->>'request_id')::uuid;
  for i in 1..5 loop
    j := public.rd_api_verify(jsonb_build_object('request_id', v_id, 'code_hash', rdtest.h('999999'), 'ip_hash', rdtest.h('ip-4')));
  end loop;
  j := public.rd_api_verify(jsonb_build_object('request_id', v_id, 'code_hash', rdtest.h('111111'), 'ip_hash', rdtest.h('ip-4')));
  perform rdtest.ok(j->>'error' = 'locked', 'code bloqué après 5 erreurs, même avec le bon code');
  -- Code expiré
  update public.otp_attempts set attempts = 0, expires_at = now() - interval '1 second' where request_id = v_id;
  j := public.rd_api_verify(jsonb_build_object('request_id', v_id, 'code_hash', rdtest.h('111111'), 'ip_hash', rdtest.h('ip-4')));
  perform rdtest.ok(j->>'error' = 'expired', 'code expiré');
  -- Identifiant bidon
  j := public.rd_api_verify(jsonb_build_object('request_id', 'pas-un-uuid', 'code_hash', rdtest.h('111111')));
  perform rdtest.ok(j->>'error' = 'invalid_code', 'identifiant invalide');
end $$;

-- Limite par IP : 5 envois / heure
do $$
declare j jsonb; i int;
begin
  for i in 1..6 loop
    j := public.rd_api_submit(jsonb_build_object(
      'trade', 'chassis', 'project_type', 'renovation', 'budget', 'inconnu', 'delay', 'asap',
      'postal_code', '1000', 'commune', 'Bruxelles', 'first_name', 'Spam',
      'phone_e164', '+3247055500' || i, 'email', 's@e.be',
      'phone_hash', rdtest.h('spam' || i), 'ip_hash', rdtest.h('ip-spam'),
      'consent_version', 'demande-devis-2026-10-v1', 'code_hash', rdtest.h('1')));
  end loop;
  perform rdtest.ok(j->>'error' = 'rate_limited', '6e envoi depuis la même IP bloqué');
end $$;

-- Effacement : code SMS puis suppression effective
do $$
declare j jsonb; ph text := rdtest.h('+32470123456');
begin
  j := public.rd_api_erase_start(jsonb_build_object('phone_hash', rdtest.h('+32000000000'), 'code_hash', rdtest.h('222222'), 'ip_hash', rdtest.h('ip-e')));
  perform rdtest.ok((j->>'ok')::boolean and not (j->>'send')::boolean, 'numéro inconnu : pas d''envoi');

  j := public.rd_api_erase_start(jsonb_build_object('phone_hash', ph, 'code_hash', rdtest.h('222222'), 'ip_hash', rdtest.h('ip-e')));
  perform rdtest.ok((j->>'send')::boolean, 'numéro connu : code envoyé');

  j := public.rd_api_erase_confirm(jsonb_build_object('phone_hash', ph, 'code_hash', rdtest.h('000000'), 'ip_hash', rdtest.h('ip-e')));
  perform rdtest.ok(j->>'error' = 'invalid_code', 'mauvais code d''effacement');
  perform rdtest.ok(exists (select 1 from public.request_contacts where phone_hash = ph), 'rien supprimé sur mauvais code');

  j := public.rd_api_erase_confirm(jsonb_build_object('phone_hash', ph, 'code_hash', rdtest.h('222222'), 'ip_hash', rdtest.h('ip-e')));
  perform rdtest.ok((j->>'erased')::int = 1, 'une demande effacée');
  perform rdtest.ok(not exists (select 1 from public.request_contacts where phone_hash = ph), 'coordonnées supprimées');
  perform rdtest.ok(not exists (select 1 from public.requests where commune = 'Charleroi' and ref like 'RD-%' and ref <> 'RD-TESTA001'), 'demande supprimée');
  perform rdtest.ok(not exists (select 1 from public.otp_attempts where phone_hash = ph), 'codes supprimés');
  perform rdtest.ok(not exists (select 1 from public.rate_events where key_hash = ph), 'compteurs supprimés');
  perform rdtest.ok(not exists (select 1 from public.consent_logs where ip_hash = rdtest.h('ip-2')), 'consentement anonymisé');
end $$;

-- Tracking : seuls page_view / quiz_start / quiz_step acceptés depuis le navigateur
do $$
declare j jsonb;
begin
  j := public.rd_api_track('{"session_id":"22222222-2222-2222-2222-222222222222","event":"quiz_step","step":2,"trade":"chassis","utm":{}}');
  perform rdtest.ok((j->>'ok')::boolean, 'étape suivie');
  j := public.rd_api_track('{"session_id":"22222222-2222-2222-2222-222222222222","event":"sms_validated"}');
  perform rdtest.ok(j->>'error' = 'invalid_input', 'faux « SMS validé » refusé');
end $$;
reset role;
rollback;
