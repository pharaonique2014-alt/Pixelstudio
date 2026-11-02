package be.pxlstudio.jarvis

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.net.Uri
import android.os.Environment
import android.provider.AlarmClock
import android.provider.CalendarContract
import android.provider.MediaStore
import com.google.ai.edge.litertlm.Tool
import com.google.ai.edge.litertlm.ToolParam
import com.google.ai.edge.litertlm.ToolSet
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import org.json.JSONObject

/** Outils locaux : agissent sur le téléphone, sans aucun compte ni serveur. */
class PhoneTools(
    private val ctx: Context,
    private val store: Store,
    private val onImageRequest: (String, String) -> Unit,
    private val imagesAvailable: () -> Boolean,
) : ToolSet {

    private fun start(i: Intent): Boolean = runCatching {
        ctx.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); true
    }.getOrDefault(false)

    private fun ok(msg: String) = mapOf("ok" to true, "resultat" to msg)
    private fun fail(msg: String) = mapOf("ok" to false, "erreur" to msg)

    @Tool(description = "Calcule exactement une expression mathématique (+ - * / % ^, parenthèses, sqrt, sin, cos, log, ln, pi).")
    fun calculer(
        @ToolParam(description = "L'expression, ex: (1250*1.21)-15% s'écrit (1250*1.21)*0.85") expression: String,
    ): Map<String, Any> = runCatching { ok(Calc.format(Calc.eval(expression))) }
        .getOrElse { fail(it.message ?: "Expression invalide") }

    @Tool(description = "Donne la date et l'heure actuelles.")
    fun date_heure(): Map<String, Any> =
        ok(SimpleDateFormat("EEEE d MMMM yyyy, HH:mm:ss", Locale.FRENCH).format(Date()))

    @Tool(description = "Mémorise durablement une information sur l'utilisateur (préférence, contact, habitude, fait important).")
    fun memoriser(
        @ToolParam(description = "L'information à retenir, en une phrase.") information: String,
    ): Map<String, Any> {
        store.addMemory(information)
        return ok("Mémorisé.")
    }

    @Tool(description = "Programme une alarme dans l'application Horloge.")
    fun creer_alarme(
        @ToolParam(description = "Heure (0-23)") heure: Int,
        @ToolParam(description = "Minutes (0-59)") minute: Int,
        @ToolParam(description = "Libellé de l'alarme, peut être vide") libelle: String = "",
    ): Map<String, Any> {
        val i = Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, heure)
            .putExtra(AlarmClock.EXTRA_MINUTES, minute)
            .putExtra(AlarmClock.EXTRA_MESSAGE, libelle.ifBlank { "Jarvis" })
        return if (start(i)) ok("Alarme $heure:${"%02d".format(minute)} ouverte dans l'Horloge.") else fail("Appli Horloge introuvable")
    }

    @Tool(description = "Lance un minuteur.")
    fun minuteur(
        @ToolParam(description = "Durée en secondes") secondes: Int,
        @ToolParam(description = "Libellé, peut être vide") libelle: String = "",
    ): Map<String, Any> {
        val i = Intent(AlarmClock.ACTION_SET_TIMER)
            .putExtra(AlarmClock.EXTRA_LENGTH, secondes)
            .putExtra(AlarmClock.EXTRA_MESSAGE, libelle.ifBlank { "Jarvis" })
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
        return if (start(i)) ok("Minuteur de $secondes s lancé.") else fail("Appli Horloge introuvable")
    }

    @Tool(description = "Prépare un événement dans l'agenda (l'utilisateur valide lui-même).")
    fun creer_evenement(
        @ToolParam(description = "Titre") titre: String,
        @ToolParam(description = "Début au format AAAA-MM-JJ HH:MM") debut: String,
        @ToolParam(description = "Durée en minutes, 60 par défaut") duree_minutes: Int = 60,
        @ToolParam(description = "Lieu, peut être vide") lieu: String = "",
    ): Map<String, Any> {
        val begin = runCatching { SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.FRANCE).parse(debut)!!.time }
            .getOrElse { return fail("Date invalide, format attendu AAAA-MM-JJ HH:MM") }
        val i = Intent(Intent.ACTION_INSERT, CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.Events.TITLE, titre)
            .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, begin)
            .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, begin + duree_minutes * 60_000L)
            .putExtra(CalendarContract.Events.EVENT_LOCATION, lieu)
        return if (start(i)) ok("Événement prêt dans l'agenda, à valider.") else fail("Agenda introuvable")
    }

    @Tool(description = "Prépare un SMS dans l'appli Messages (l'utilisateur appuie lui-même sur Envoyer).")
    fun preparer_sms(
        @ToolParam(description = "Numéro de téléphone") numero: String,
        @ToolParam(description = "Texte du message") texte: String,
    ): Map<String, Any> {
        val i = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + numero.filter { it.isDigit() || it == '+' }))
            .putExtra("sms_body", texte)
        return if (start(i)) ok("SMS prêt, à envoyer par l'utilisateur.") else fail("Appli Messages introuvable")
    }

    @Tool(description = "Ouvre le composeur avec un numéro (l'utilisateur lance l'appel).")
    fun appeler(@ToolParam(description = "Numéro de téléphone") numero: String): Map<String, Any> {
        val i = Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + numero.filter { it.isDigit() || it == '+' }))
        return if (start(i)) ok("Numéro affiché dans le composeur.") else fail("Composeur introuvable")
    }

    @Tool(description = "Ouvre une application installée à partir de son nom (ex: WhatsApp, Spotify, Maps).")
    fun ouvrir_appli(@ToolParam(description = "Nom de l'application") nom: String): Map<String, Any> {
        val pm = ctx.packageManager
        val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val match = pm.queryIntentActivities(launcher, 0)
            .map { it.loadLabel(pm).toString() to it.activityInfo.packageName }
            .sortedBy { it.first.length }
            .firstOrNull { it.first.contains(nom.trim(), ignoreCase = true) }
            ?: return fail("Aucune appli nommée « $nom »")
        val i = pm.getLaunchIntentForPackage(match.second) ?: return fail("Impossible d'ouvrir ${match.first}")
        return if (start(i)) ok("${match.first} ouvert.") else fail("Impossible d'ouvrir ${match.first}")
    }

    @Tool(description = "Ouvre un lien web ou une adresse dans le navigateur ou Maps.")
    fun ouvrir_lien(@ToolParam(description = "URL complète ou adresse postale") lien: String): Map<String, Any> {
        val uri = if (lien.startsWith("http")) Uri.parse(lien) else Uri.parse("geo:0,0?q=" + Uri.encode(lien))
        return if (start(Intent(Intent.ACTION_VIEW, uri))) ok("Ouvert.") else fail("Impossible d'ouvrir")
    }

    @Tool(description = "Allume ou éteint la lampe torche.")
    fun lampe_torche(@ToolParam(description = "true pour allumer, false pour éteindre") allumer: Boolean): Map<String, Any> =
        runCatching {
            val cm = ctx.getSystemService(CameraManager::class.java)
            val id = cm.cameraIdList.first {
                cm.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
            }
            cm.setTorchMode(id, allumer)
            ok(if (allumer) "Lampe allumée." else "Lampe éteinte.")
        }.getOrElse { fail("Lampe indisponible") }

    @Tool(description = "Enregistre un fichier texte dans Téléchargements/Jarvis (ex: page web .html, script, texte .md, .csv).")
    fun enregistrer_fichier(
        @ToolParam(description = "Nom du fichier avec extension, ex: site.html") nom: String,
        @ToolParam(description = "Contenu complet du fichier") contenu: String,
    ): Map<String, Any> = runCatching {
        val safe = nom.replace(Regex("[^A-Za-z0-9._-]"), "_").ifBlank { "jarvis.txt" }
        val mime = when (safe.substringAfterLast('.', "").lowercase()) {
            "html", "htm" -> "text/html"; "csv" -> "text/csv"; "json" -> "application/json"
            "md" -> "text/markdown"; else -> "text/plain"
        }
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, safe)
            put(MediaStore.Downloads.MIME_TYPE, mime)
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Jarvis")
        }
        val uri = ctx.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)!!
        ctx.contentResolver.openOutputStream(uri)!!.use { it.write(contenu.toByteArray()) }
        ok("Enregistré dans Téléchargements/Jarvis/$safe")
    }.getOrElse { fail(it.message ?: "Échec de l'enregistrement") }

    @Tool(description = "Génère une image sur le téléphone à partir d'une description EN ANGLAIS.")
    fun generer_image(
        @ToolParam(description = "Description détaillée en anglais : sujet, style, lumière, cadrage") description: String,
        @ToolParam(description = "Format : carre, portrait ou paysage. carre par défaut") format: String = "carre",
    ): Map<String, Any> {
        if (!imagesAvailable()) return fail("Moteur d'images non installé (Réglages > Images).")
        Persona.imageBlockReason(description)?.let { return fail(it) }
        onImageRequest(description, format)
        return ok("Image lancée : elle apparaîtra dans la conversation dans moins d'une minute environ.")
    }
}

/** Outils web : n'utilisent le réseau que si l'utilisateur l'a autorisé dans les réglages. */
class WebTools : ToolSet {

    private fun get(url: String, max: Int = 400_000): String {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 8000; c.readTimeout = 12000
        c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 15) Jarvis/1.0")
        c.setRequestProperty("Accept-Language", "fr-FR,fr;q=0.9,en;q=0.6")
        return c.inputStream.bufferedReader().use { r ->
            val buf = CharArray(max); val n = r.read(buf); if (n > 0) String(buf, 0, n) else ""
        }
    }

    private fun strip(html: String): String = html
        .replace(Regex("(?is)<(script|style|noscript|svg|head)[^>]*>.*?</\\1>"), " ")
        .replace(Regex("(?i)<br\\s*/?>|</p>|</h[1-6]>|</li>|</div>"), "\n")
        .replace(Regex("<[^>]+>"), " ")
        .replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", "\"").replace("&#39;", "'")
        .replace("&lt;", "<").replace("&gt;", ">")
        .replace(Regex("[ \\t]+"), " ").replace(Regex("\\n\\s*\\n+"), "\n").trim()

    @Tool(description = "Recherche sur le web (nécessite du réseau). Renvoie les premiers résultats avec titre, lien et extrait.")
    fun recherche_web(@ToolParam(description = "La requête de recherche") requete: String): Map<String, Any> = runCatching {
        val html = get("https://html.duckduckgo.com/html/?q=" + URLEncoder.encode(requete, "UTF-8"))
        val re = Regex("(?s)class=\"result__a\" href=\"([^\"]+)\"[^>]*>(.*?)</a>.*?class=\"result__snippet\"[^>]*>(.*?)</a>")
        val results = re.findAll(html).take(6).map { m ->
            var link = m.groupValues[1]
            Regex("uddg=([^&]+)").find(link)?.let { link = java.net.URLDecoder.decode(it.groupValues[1], "UTF-8") }
            mapOf("titre" to strip(m.groupValues[2]), "lien" to link, "extrait" to strip(m.groupValues[3]))
        }.toList()
        if (results.isEmpty()) mapOf("ok" to false, "erreur" to "Aucun résultat") else mapOf("ok" to true, "resultats" to results)
    }.getOrElse { mapOf("ok" to false, "erreur" to "Pas de réseau ou recherche impossible") }

    @Tool(description = "Lit le texte d'une page web (nécessite du réseau).")
    fun lire_page(@ToolParam(description = "URL complète de la page") url: String): Map<String, Any> = runCatching {
        mapOf("ok" to true, "texte" to strip(get(url)).take(6000))
    }.getOrElse { mapOf("ok" to false, "erreur" to "Page inaccessible ou pas de réseau") }

    @Tool(description = "Résumé Wikipédia en français d'un sujet (nécessite du réseau).")
    fun wikipedia(@ToolParam(description = "Le sujet, ex: Tour Eiffel") sujet: String): Map<String, Any> = runCatching {
        val title = URLEncoder.encode(sujet.trim().replace(' ', '_'), "UTF-8")
        val o = JSONObject(get("https://fr.wikipedia.org/api/rest_v1/page/summary/$title"))
        mapOf("ok" to true, "titre" to o.optString("title"), "resume" to o.optString("extract"))
    }.getOrElse { mapOf("ok" to false, "erreur" to "Introuvable ou pas de réseau") }
}
