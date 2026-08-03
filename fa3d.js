// Moteur 3D réutilisable pour les produits FLYERALARM (WebGL/Three.js réel,
// pas du SVG). Un seul module, une forme de base par famille de produit :
// cylindre (tasse...), carte plate (carte/sticker/bon...), bloc (bloc-notes...).
// Ne touche jamais à shop-app.min.js — s'active uniquement sur les produits
// qui déclarent une entrée `shape3d` (voir openConfig côté shop-app-source.js).
//
// Dimensions toujours en millimètres réels, issues des fiches techniques
// FLYERALARM — jamais devinées.

import * as THREE from './vendor/three/three.module.min.js';

function buildStudioBackground() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#3a3a42');
  g.addColorStop(1, '#111114');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  return new THREE.CanvasTexture(c);
}

// Construit une texture "zone imprimable" : fond blanc/matière + design du
// client (ou un badge PS de démo si aucun design fourni) placé exactement
// dans la zone réelle (issue de la fiche technique), le reste laissé vierge.
function buildPrintTexture({ canvasW = 2048, canvasH = 1024, zone, designImage, baseColor = '#f6f4ee' }) {
  return new Promise((resolve) => {
    const c = document.createElement('canvas');
    c.width = canvasW; c.height = canvasH;
    const ctx = c.getContext('2d');
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvasW, canvasH);

    const zx = zone.cx * canvasW - (zone.w * canvasW) / 2;
    const zy = zone.cy * canvasH - (zone.h * canvasH) / 2;
    const zw = zone.w * canvasW, zh = zone.h * canvasH;

    function finish() {
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      resolve(tex);
    }

    if (designImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // contain-fit du design dans la zone réelle, centré
        const scale = Math.min(zw / img.width, zh / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, zx + (zw - dw) / 2, zy + (zh - dh) / 2, dw, dh);
        finish();
      };
      img.onerror = () => { drawPlaceholder(); finish(); };
      img.src = designImage;
      return;
    }
    drawPlaceholder();
    finish();

    function drawPlaceholder() {
      ctx.strokeStyle = 'rgba(224,168,58,0.85)';
      ctx.lineWidth = Math.max(2, canvasW * 0.002);
      ctx.setLineDash([canvasW * 0.007, canvasW * 0.005]);
      ctx.strokeRect(zx, zy, zw, zh);
      ctx.setLineDash([]);
      const r = Math.min(zw, zh) * 0.32;
      ctx.save();
      ctx.translate(zx + zw / 2, zy + zh / 2);
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.roundRect(-r, -r, r * 2, r * 2, r * 0.22);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${r * 0.8}px -apple-system, Arial`;
      ctx.fillText('PS', 0, -r * 0.18);
      ctx.font = `500 ${r * 0.22}px -apple-system, Arial`;
      ctx.fillText('APERÇU', 0, r * 0.42);
      ctx.restore();
    }
  });
}

function bytesToBase64() {} // placeholder (non utilisé côté navigateur)

function hexColorToCss(hex) {
  return '#' + (hex >>> 0).toString(16).padStart(6, '0');
}

// ---------- Familles de forme ----------

// kind:'cylinder' — ex. tasse. dims en mm : diameterMM, heightMM.
// printZone : { widthMM, heightMM } centrée, opposée à l'anse par défaut
// (conforme aux fiches FLYERALARM types "tasse").
function buildCylinderGroup({ diameterMM, heightMM, printZone, hasHandle = true }) {
  const group = new THREE.Group();
  const radius = diameterMM / 2;

  const circumference = Math.PI * diameterMM;
  const zone = {
    cx: 0.5, cy: 0.5,
    w: printZone.widthMM / circumference,
    h: printZone.heightMM / heightMM,
  };

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, heightMM, 96, 1, true),
    new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.02, color: 0xffffff })
  );
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);
  group.userData.printMesh = body;
  group.userData.printZoneSpec = zone;
  group.userData.baseColorHex = '#ffffff';

  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(radius - 3, radius - 3, heightMM - 5, 96, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xf1efe8, roughness: 0.4, side: THREE.BackSide })
  );
  inner.position.y = 1;
  group.add(inner);

  const bottom = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 96),
    new THREE.MeshStandardMaterial({ color: 0xefede6, roughness: 0.5 })
  );
  bottom.rotation.x = Math.PI / 2;
  bottom.position.y = -heightMM / 2;
  bottom.receiveShadow = true;
  group.add(bottom);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius - 1.2, 1.5, 16, 96),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = heightMM / 2;
  rim.castShadow = true;
  group.add(rim);

  if (hasHandle) {
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(diameterMM * 0.24, diameterMM * 0.085, 20, 48, Math.PI * 1.3),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28 })
    );
    // anse à l'opposé exact de la zone imprimable (angle 0, zone centrée à 180°)
    handle.position.set(0, 2, radius + diameterMM * 0.07);
    handle.rotation.z = Math.PI / 2;
    handle.rotation.y = Math.PI;
    handle.castShadow = true;
    group.add(handle);
  }

  group.userData.frameHeight = heightMM;
  group.userData.frameRadius = radius * 1.9;
  return group;
}

// kind:'flatcard' — carte, sticker, bon cadeau, etc. dims en mm.
// fold: true pour un chevalet plié en deux (présentoir de table).
function buildFlatCardGroup({ widthMM, heightMM, thicknessMM = 0.5, printZone, fold = false, color = 0xf6f4ee }) {
  const group = new THREE.Group();
  const zone = printZone
    ? { cx: 0.5, cy: 0.5, w: printZone.widthMM / widthMM, h: printZone.heightMM / heightMM }
    : { cx: 0.5, cy: 0.5, w: 0.82, h: 0.82 };

  if (!fold) {
    const geo = new THREE.BoxGeometry(widthMM, heightMM, thicknessMM);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, color });
    const mesh = new THREE.Mesh(geo, [mat, mat, mat, mat, mat.clone(), mat.clone()]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    group.userData.printMesh = mesh;
    group.userData.printMaterialIndex = 5; // face -Z (même convention "avant" que le cylindre)
    group.userData.printZoneSpec = zone;
    group.userData.baseColorHex = hexColorToCss(color);
    group.userData.frameHeight = heightMM;
    group.userData.frameRadius = Math.max(widthMM, heightMM) * 0.95;
    return group;
  }

  // chevalet : deux panneaux pliés, hanse au sol (y=-half/2) pour rester
  // dans la même convention verticale que les autres formes (centrées sur y=0,
  // sinon le socle de sol placé par le harnais de vue flotte sous l'objet).
  const half = heightMM;
  const panelMat = new THREE.MeshStandardMaterial({ roughness: 0.6, color });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(widthMM, half), panelMat);
  front.position.set(0, 0, -thicknessMM / 2);
  front.rotation.x = -0.28;
  front.rotation.y = Math.PI; // normal vers -Z, face à la caméra
  front.castShadow = true;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(widthMM, half), panelMat.clone());
  back.position.set(0, 0, thicknessMM / 2);
  back.rotation.x = 0.28;
  group.add(front, back);
  group.userData.printMesh = front;
  group.userData.printZoneSpec = zone;
  group.userData.baseColorHex = hexColorToCss(color);
  group.userData.frameHeight = half;
  group.userData.frameRadius = Math.max(widthMM, half) * 1.1;
  return group;
}

// kind:'block' — bloc-notes / carnet. dims en mm, thicknessMM = épaisseur du bloc.
function buildBlockGroup({ widthMM, heightMM, thicknessMM = 15, printZone, coverColor = 0x1b1b22 }) {
  const group = new THREE.Group();
  const zone = printZone
    ? { cx: 0.5, cy: 0.5, w: printZone.widthMM / widthMM, h: printZone.heightMM / heightMM }
    : { cx: 0.5, cy: 0.5, w: 0.72, h: 0.6 };

  const cover = new THREE.Mesh(
    new THREE.BoxGeometry(widthMM, heightMM, thicknessMM * 0.15),
    new THREE.MeshStandardMaterial({ color: coverColor, roughness: 0.6 })
  );
  cover.position.z = -thicknessMM / 2; // face -Z = avant (même convention que le cylindre/la carte)
  cover.castShadow = true; cover.receiveShadow = true;
  group.add(cover);
  group.userData.printMesh = cover;
  group.userData.printMaterialIndex = 5;
  group.userData.printZoneSpec = zone;
  group.userData.baseColorHex = hexColorToCss(coverColor);

  const pages = new THREE.Mesh(
    new THREE.BoxGeometry(widthMM * 0.985, heightMM * 0.985, thicknessMM * 0.85),
    new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.9 })
  );
  pages.position.z = thicknessMM * 0.075; // derrière la couverture (vers +Z)
  pages.receiveShadow = true;
  group.add(pages);

  group.userData.frameHeight = heightMM;
  group.userData.frameRadius = Math.max(widthMM, heightMM) * 0.95;
  return group;
}

const BUILDERS = { cylinder: buildCylinderGroup, flatcard: buildFlatCardGroup, block: buildBlockGroup };

// ---------- Harnais de vue (caméra, lumière, orbite) ----------

export function createFA3DViewer(container, spec) {
  const builder = BUILDERS[spec.kind];
  if (!builder) throw new Error('fa3d: forme inconnue "' + spec.kind + '"');

  const w = container.clientWidth || 320, h = container.clientHeight || 320;
  const scene = new THREE.Scene();
  scene.background = buildStudioBackground();

  const camera = new THREE.PerspectiveCamera(38, w / h, 1, 3000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.cursor = 'grab';
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(120, 180, 120);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 10; key.shadow.camera.far = 600;
  key.shadow.camera.left = -160; key.shadow.camera.right = 160;
  key.shadow.camera.top = 160; key.shadow.camera.bottom = -160;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
  fill.position.set(-120, 60, -80);
  scene.add(fill);

  const group = builder(spec.dims);
  scene.add(group);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(group.userData.frameRadius * 1.6, 48),
    new THREE.ShadowMaterial({ opacity: 0.32 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -group.userData.frameHeight / 2 - 1;
  ground.receiveShadow = true;
  scene.add(ground);

  let theta = spec.initialTheta ?? (Math.PI - 0.5);
  let phi = spec.initialPhi ?? 1.22;
  const radiusCam = group.userData.frameRadius * 3.1;
  function updateCam() {
    const midY = 0;
    camera.position.x = radiusCam * Math.sin(phi) * Math.sin(theta);
    camera.position.z = radiusCam * Math.sin(phi) * Math.cos(theta);
    camera.position.y = radiusCam * Math.cos(phi) + midY;
    camera.lookAt(0, midY, 0);
  }
  updateCam();

  let dragging = false, lastX = 0, lastY = 0;
  const el = renderer.domElement;
  const onDown = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; };
  const onMove = (e) => {
    if (!dragging) return;
    theta -= (e.clientX - lastX) * 0.008;
    phi -= (e.clientY - lastY) * 0.008;
    phi = Math.max(0.5, Math.min(1.9, phi));
    lastX = e.clientX; lastY = e.clientY;
    updateCam();
  };
  const onUp = () => { dragging = false; el.style.cursor = 'grab'; };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointerleave', onUp);

  let raf = null;
  function animate() { raf = requestAnimationFrame(animate); renderer.render(scene, camera); }
  animate();

  async function setDesignImage(dataUrlOrNull) {
    const tex = await buildPrintTexture({
      zone: group.userData.printZoneSpec,
      designImage: dataUrlOrNull,
      baseColor: spec.baseColor || group.userData.baseColorHex || '#f6f4ee',
    });
    const mesh = group.userData.printMesh;
    const mat = Array.isArray(mesh.material) ? mesh.material[group.userData.printMaterialIndex ?? 0] : mesh.material;
    // La couleur de base réelle est peinte dans la texture elle-même (baseColor
    // ci-dessus) — le matériau doit rester blanc, sinon Three.js multiplie la
    // texture par la couleur du matériau et l'assombrit (voire la rend invisible
    // si le matériau est sombre).
    mat.color.set(0xffffff);
    mat.map = tex;
    mat.needsUpdate = true;
  }

  function resize() {
    const nw = container.clientWidth, nh = container.clientHeight;
    if (!nw || !nh) return;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  function destroy() {
    cancelAnimationFrame(raf);
    ro.disconnect();
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointerleave', onUp);
    renderer.dispose();
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  setDesignImage(null);
  return { setDesignImage, resize, destroy };
}
