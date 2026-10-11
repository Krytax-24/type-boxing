// 3D Lab scene: renderer, the PS1-style low resolution look, the Tekken-style camera, the arena (a moonlit temple
// courtyard), real shadows, weapon trails, hit effects, projectile meshes and the cinematic camera for supers.
const T3S = (() => {
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

  // opts.smooth (roster3d.html): antialiased, full resolution (up to 2x on high density screens), soft shadows
  // and smooth texture filtering on the stage, for the smooth character models. Without it: the PS1 look.
  function create(canvas, opts) {
    opts = opts || {};
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !!opts.smooth, powerPreference: "high-performance", preserveDrawingBuffer: true });
    renderer.setPixelRatio(opts.smooth ? Math.min(2, window.devicePixelRatio || 1) : 1);
    renderer.outputEncoding = THREE.LinearEncoding;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = opts.smooth ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    // Smooth mode renders in sRGB with filmic tone mapping (the physically based characters need both).
    if (opts.smooth) { renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = opts.exposure || 1.2; }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141022);
    scene.fog = new THREE.Fog(0x1a1428, 12, 38);
    const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 120);
    // Light: a cool moon key that follows the camera (from above and to its left, so faces are always lit) and
    // casts the shadows, a blue rim from behind, warm brazier light around the ring, a dim sky fill.
    const key = new THREE.DirectionalLight(0xe4e8ff, 1.05);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera; sc.left = -3.6; sc.right = 3.6; sc.top = 3.6; sc.bottom = -3.6; sc.near = 0.5; sc.far = 24;
    key.shadow.bias = -0.0008; key.shadow.normalBias = 0.025;
    scene.add(key); scene.add(key.target);
    const rim = new THREE.DirectionalLight(0x7a9cff, 0.6); rim.position.set(2, 3, -6); scene.add(rim);
    const hemi = new THREE.HemisphereLight(0x6a72a0, 0x3a2418, 0.62); scene.add(hemi);
    const S = { renderer, scene, camera, canvas, key, rim, hemi, pixel: opts.smooth ? 1 : 2, smooth: !!opts.smooth, high: true, shake: 0, shakeT: 0, zoomK: 0, sparks: [], lookAt: V3(0, 1, 0), t: 0, mood: 0, cine: null };
    if (opts.smooth) { key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 3; }
    // A pool of point lights for effects (hit flashes, fireballs). The count never changes, so materials never
    // recompile in the middle of a fight.
    S.fxLights = [];
    for (let i = 0; i < 2; i++) { const l = new THREE.PointLight(0xffffff, 0, 4.5, 2); scene.add(l); S.fxLights.push({ l, life: 0, max: 1, owner: null }); }
    buildArena(S);
    // Smooth mode: the stage textures are filtered (no hard pixels).
    if (opts.smooth) scene.traverse((m) => { if (m.material && m.material.map) { const t = m.material.map; t.encoding = THREE.sRGBEncoding; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true; } });
    S.resize = () => resize(S);
    resize(S);
    return S;
  }
  function resize(S) {
    const w = window.innerWidth, h = window.innerHeight, k = S.pixel || 1;
    S.renderer.setSize(Math.max(160, Math.round(w / k)), Math.max(90, Math.round(h / k)), false);
    S.canvas.style.width = w + "px"; S.canvas.style.height = h + "px";
    S.camera.aspect = w / h; S.camera.updateProjectionMatrix();
  }

  // ---------- Textures for the stage ----------
  const tex = (w, h, paint, rep, smooth) => T3M.canvasTex(w, h, paint, rep, smooth !== false);
  function stoneFloor() {
    return tex(128, 128, (g, w, h) => {
      const r = rng(7);
      g.fillStyle = "#26231f"; g.fillRect(0, 0, w, h);
      // Irregular flagstones in staggered rows, each its own tone, a lit top edge and a dark lower edge.
      let y = 0;
      while (y < h) {
        const rh = 14 + Math.floor(r() * 12); let x = -Math.floor(r() * 20);
        while (x < w) {
          const rw = 18 + Math.floor(r() * 22), v = 70 + Math.floor(r() * 26), tint = Math.floor(r() * 8);
          g.fillStyle = `rgb(${v + tint},${v + tint - 3},${v - 6})`; g.fillRect(x + 1, y + 1, rw - 2, rh - 2);
          g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(x + 1, y + 1, rw - 2, 1);
          g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(x + 1, y + rh - 2, rw - 2, 1);
          x += rw;
        }
        y += rh;
      }
      T3M.grain(g, w, h, 12, 9);
      // Cracks, grime and moss.
      for (let i = 0; i < 14; i++) { let cx = r() * w, cy = r() * h; g.fillStyle = "rgba(0,0,0,0.45)"; for (let k = 0; k < 10; k++) { g.fillRect(Math.floor(cx), Math.floor(cy), 1, 1); cx += r() * 3 - 1; cy += r() * 3 - 1.5; } }
      for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(20,16,12,${0.15 + r() * 0.2})`; g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 3 + Math.floor(r() * 7), 2 + Math.floor(r() * 5)); }
      for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(60,80,40,${0.2 + r() * 0.2})`; g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 2 + Math.floor(r() * 3), 1 + Math.floor(r() * 2)); }
    }, [7, 7]);
  }
  // The ring mosaic in the middle: concentric bands, a sun of rays, worn tiles. Transparent outside the circle.
  function mosaic() {
    return tex(256, 256, (g, w, h) => {
      const c = w / 2, r = rng(17);
      const ring = (r0, r1, col) => { g.beginPath(); g.arc(c, c, r1, 0, Math.PI * 2); g.arc(c, c, r0, 0, Math.PI * 2, true); g.fillStyle = col; g.fill(); };
      ring(118, 127, "#5a4a36"); ring(112, 118, "#8a6a3a"); ring(104, 112, "#3a3330"); ring(100, 104, "#8a6a3a");
      // Rays.
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2, a2 = a + Math.PI / 24;
        g.beginPath(); g.moveTo(c + Math.cos(a) * 30, c + Math.sin(a) * 30); g.lineTo(c + Math.cos(a2) * 96, c + Math.sin(a2) * 96); g.lineTo(c + Math.cos(a + Math.PI / 12) * 30, c + Math.sin(a + Math.PI / 12) * 30);
        g.fillStyle = i % 2 ? "rgba(140,105,60,0.55)" : "rgba(70,62,58,0.5)"; g.fill();
      }
      ring(26, 32, "#8a6a3a"); ring(0, 26, "rgba(50,44,40,0.8)");
      // Tiles: break everything into small squares with gaps, and wear some away.
      const d = g.getImageData(0, 0, w, h), a = d.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (x % 4 === 0 || y % 4 === 0) a[i + 3] = Math.min(a[i + 3], 60);
        const n = (r() - 0.5) * 30; a[i] += n; a[i + 1] += n; a[i + 2] += n;
      }
      g.putImageData(d, 0, 0);
      for (let i = 0; i < 120; i++) g.clearRect(Math.floor(r() * w / 4) * 4, Math.floor(r() * h / 4) * 4, 4, 4);
    }, null);
  }
  function stoneBlocks(seed, base) {
    return tex(64, 64, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = "#1a1816"; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) for (let x = -((y / 16) % 2) * 16; x < w; x += 32) {
        const v = base + Math.floor(r() * 20); g.fillStyle = `rgb(${v},${v - 2},${v - 6})`; g.fillRect(x + 1, y + 1, 30, 14);
        g.fillStyle = "rgba(255,255,255,0.07)"; g.fillRect(x + 1, y + 1, 30, 1); g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x + 1, y + 14, 30, 1);
      }
      T3M.grain(g, w, h, 10, seed);
      for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(0,0,0,${0.2 + r() * 0.2})`; g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 2 + Math.floor(r() * 5), 1 + Math.floor(r() * 3)); }
    }, null);
  }
  // The outer wall: stone courses with arched niches, a warm glow in some of them.
  function wallTex() {
    return tex(128, 64, (g, w, h) => {
      const r = rng(29);
      g.fillStyle = "#1c1a19"; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8) for (let x = -((y / 8) % 2) * 8; x < w; x += 16) { const v = 40 + Math.floor(r() * 16); g.fillStyle = `rgb(${v},${v - 2},${v - 4})`; g.fillRect(x + 1, y + 1, 14, 6); }
      for (let i = 0; i < 4; i++) {
        const x = 8 + i * 32;
        g.fillStyle = "#0a0909"; g.fillRect(x, 22, 16, 34); g.beginPath(); g.arc(x + 8, 22, 8, Math.PI, 0); g.fill();
        if (i % 2 === 0) { g.fillStyle = "rgba(255,140,60,0.35)"; g.fillRect(x + 4, 40, 8, 16); g.fillStyle = "rgba(255,190,90,0.6)"; g.fillRect(x + 6, 48, 4, 6); }
      }
      g.fillStyle = "#2a2624"; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
      T3M.grain(g, w, h, 8, 31);
    }, [6, 1]);
  }
  function skyTex() {
    return tex(256, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#05060f"); gr.addColorStop(0.45, "#141634"); gr.addColorStop(0.62, "#2c2440"); gr.addColorStop(0.7, "#4a2e38"); gr.addColorStop(1, "#1a1428");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const r = rng(37);
      for (let i = 0; i < 260; i++) { const y = Math.floor(r() * h * 0.6); g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; g.fillRect(Math.floor(r() * w), y, 1, 1); }
      // The moon with a soft halo.
      const mx = 70, my = 30;
      const halo = g.createRadialGradient(mx, my, 2, mx, my, 26); halo.addColorStop(0, "rgba(220,230,255,0.5)"); halo.addColorStop(1, "rgba(220,230,255,0)");
      g.fillStyle = halo; g.fillRect(mx - 26, my - 26, 52, 52);
      g.fillStyle = "#e8ecff"; g.beginPath(); g.arc(mx, my, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(160,170,200,0.6)"; g.fillRect(mx - 3, my - 2, 3, 2); g.fillRect(mx + 2, my + 2, 2, 2);
    }, null, false);
  }
  function mountainTex() {
    return tex(256, 64, (g, w, h) => {
      const r = rng(41);
      for (const [base, col, amp] of [[34, "#1c1830", 18], [44, "#120f20", 12]]) {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
        let y = base; for (let x = 0; x <= w; x += 4) { y = Math.max(8, Math.min(h - 6, y + (r() - 0.5) * amp * 0.6)); g.lineTo(x, y); }
        g.lineTo(w, h); g.fill();
      }
      // Distant temple roofs.
      g.fillStyle = "#0b0914"; for (const x of [40, 150, 210]) { g.fillRect(x, 40, 18, 24); g.beginPath(); g.moveTo(x - 6, 41); g.lineTo(x + 9, 32); g.lineTo(x + 24, 41); g.fill(); }
      g.fillStyle = "rgba(255,170,90,0.7)"; for (const x of [44, 154, 214]) g.fillRect(x + 5, 48, 2, 2);
    }, [3, 1], false);
  }
  function bannerTex() {
    return tex(32, 96, (g, w, h) => {
      g.fillStyle = "#7a1a1e"; g.fillRect(0, 0, w, h); T3M.grain(g, w, h, 12, 43);
      g.fillStyle = "#c8962e"; g.fillRect(2, 0, 2, h - 10); g.fillRect(w - 4, 0, 2, h - 10); g.fillRect(0, 4, w, 2);
      // An emblem: a ring with four strokes.
      g.fillStyle = "#e0b04a"; g.beginPath(); g.arc(w / 2, 34, 9, 0, Math.PI * 2); g.arc(w / 2, 34, 6, 0, Math.PI * 2, true); g.fill();
      g.fillRect(w / 2 - 1, 20, 2, 28); g.fillRect(w / 2 - 14, 33, 28, 2);
      for (let x = 0; x < w; x += 2) g.clearRect(x, h - 10 + (x % 4 ? 3 : 0), 2, 12);
      for (let x = 4; x < w; x += 6) { g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x, 0, 2, h); }
    }, null, false);
  }
  // Soft round sprites for glows, puffs and rings.
  const SPR = {};
  function spriteTex(kind) {
    if (SPR[kind]) return SPR[kind];
    const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d");
    if (kind === "glow") { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,0.6)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); }
    if (kind === "ring") { g.strokeStyle = "#fff"; g.lineWidth = 3; g.beginPath(); g.arc(16, 16, 13, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 0.4; g.lineWidth = 6; g.stroke(); }
    if (kind === "puff") { for (let i = 0; i < 6; i++) { const gr = g.createRadialGradient(10 + (i * 7) % 13, 10 + (i * 5) % 13, 0, 16, 16, 15); gr.addColorStop(0, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); } }
    if (kind === "star") { g.fillStyle = "#fff"; g.fillRect(15, 2, 2, 28); g.fillRect(2, 15, 28, 2); g.fillRect(12, 12, 8, 8); }
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    return (SPR[kind] = t);
  }
  function sprite(kind, color, add, opacity) {
    const m = new THREE.SpriteMaterial({ map: spriteTex(kind), color, transparent: true, opacity: opacity === undefined ? 1 : opacity, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, fog: true });
    return new THREE.Sprite(m);
  }

  // ---------- The arena ----------
  function buildArena(S) {
    const scene = S.scene;
    // The stage uses per-vertex (Gouraud) light, the PS1 way and cheap; the floor is finely divided so the
    // brazier light still pools on it.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(56, 56, 56, 56), new THREE.MeshLambertMaterial({ map: stoneFloor() }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const mos = new THREE.Mesh(new THREE.CircleGeometry(6.8, 48, 0, Math.PI * 2), new THREE.MeshLambertMaterial({ map: mosaic(), color: 0x9a8c7c, opacity: 0.78, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    mos.rotation.x = -Math.PI / 2; mos.position.y = 0.002; mos.receiveShadow = true; scene.add(mos);
    // A low stone curb around the ring.
    const curbM = new THREE.MeshLambertMaterial({ map: stoneBlocks(3, 66) });
    curbM.map.repeat.set(24, 1); curbM.map.wrapS = THREE.RepeatWrapping;
    const curb = new THREE.Mesh(new THREE.CylinderGeometry(7.15, 7.15, 0.12, 40, 1, true), curbM); curb.position.y = 0.06; curb.material.side = THREE.DoubleSide; scene.add(curb);
    const curbTop = new THREE.Mesh(new THREE.RingGeometry(6.85, 7.15, 40), new THREE.MeshLambertMaterial({ color: 0x5a544c })); curbTop.rotation.x = -Math.PI / 2; curbTop.position.y = 0.12; curbTop.receiveShadow = true; scene.add(curbTop);
    // Pillars with bases and capitals; banners hang from every other one.
    const pilM = new THREE.MeshLambertMaterial({ map: stoneBlocks(5, 58) });
    pilM.map.wrapS = pilM.map.wrapT = THREE.RepeatWrapping; pilM.map.repeat.set(2, 3);
    const capM = new THREE.MeshLambertMaterial({ color: 0x4a4540 });
    const banM = new THREE.MeshLambertMaterial({ map: bannerTex(), side: THREE.DoubleSide, alphaTest: 0.5 });
    S.banners = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.31, r = 10.2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -a; scene.add(g);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 1.1), capM); base.position.y = 0.2; g.add(base);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 4.6, 8), pilM); shaft.position.y = 2.7; g.add(shaft);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.35, 1.05), capM); cap.position.y = 5.15; g.add(cap);
      for (const m of [base, shaft, cap]) { m.castShadow = true; m.receiveShadow = true; }
      if (i % 2 === 0) {
        const ban = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.9, 1, 4), banM); ban.position.set(-0.45, 3.6, 0); ban.rotation.y = Math.PI / 2; g.add(ban);
        S.banners.push(ban);
      }
    }
    // Braziers: stone bowls of fire on short columns, each with a warm light (three lights for six fires).
    S.fires = []; S.fireLights = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.05, r = 8.3, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 1.1, 6), pilM); col.position.set(x, 0.55, z); col.castShadow = true; scene.add(col);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.22, 0.3, 8), new THREE.MeshLambertMaterial({ color: 0x3a3028 })); bowl.position.set(x, 1.22, z); scene.add(bowl);
      const fire = new THREE.Group(); fire.position.set(x, 1.36, z); scene.add(fire);
      for (let k = 0; k < 7; k++) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(0.11 + (k % 3) * 0.03, 0.45 + (k % 2) * 0.2, 4), new THREE.MeshBasicMaterial({ color: [0xffa040, 0xff6a20, 0xffd070][k % 3], transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.position.set(Math.cos(k * 2.4) * 0.12, 0.2, Math.sin(k * 2.4) * 0.12); m.userData.ph = k * 1.9; fire.add(m);
      }
      const glow = sprite("glow", 0xff8a3a, true, 0.55); glow.scale.setScalar(1.6); glow.position.y = 0.3; fire.add(glow);
      S.fires.push(fire);
      if (i % 2 === 0) { const l = new THREE.PointLight(0xff9a4a, 1.5, 11, 2); l.position.set(x * 0.94, 1.9, z * 0.94); scene.add(l); S.fireLights.push(l); }
    }
    // The outer wall, far mountains and the sky.
    const wallM = new THREE.MeshLambertMaterial({ map: wallTex(), side: THREE.BackSide });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 6.5, 30, 4, true), wallM); wall.position.y = 3.25; scene.add(wall);
    const mnt = new THREE.Mesh(new THREE.CylinderGeometry(44, 44, 16, 32, 1, true), new THREE.MeshBasicMaterial({ map: mountainTex(), side: THREE.BackSide, transparent: true, fog: false, depthWrite: false }));
    mnt.position.y = 9; scene.add(mnt);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(70, 16, 10), new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -2; mnt.renderOrder = -1; scene.add(sky);
    // Embers drifting up from the braziers.
    const N = 90, pos = new Float32Array(N * 3);
    S.embers = { N, pos, v: [] };
    for (let i = 0; i < N; i++) { resetEmber(S, i, true); }
    const eg = new THREE.BufferGeometry(); eg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    S.embers.pts = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xffa050, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    S.embers.pts.frustumCulled = false; scene.add(S.embers.pts);
  }
  function resetEmber(S, i, any) {
    const E = S.embers, f = Math.floor(Math.random() * 6), a = (f / 6) * Math.PI * 2 + 0.05, r = 8.3;
    E.pos[i * 3] = Math.cos(a) * r + (Math.random() - 0.5) * 0.4; E.pos[i * 3 + 1] = 1.5 + (any ? Math.random() * 4 : 0); E.pos[i * 3 + 2] = Math.sin(a) * r + (Math.random() - 0.5) * 0.4;
    E.v[i] = [(Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.8, (Math.random() - 0.5) * 0.3];
  }

  // ---------- Camera ----------
  // Side-on to the line between the fighters, a little above chest height, pulled back by their distance.
  // `side` keeps the camera on the same side as the fight rotates (sidesteps turn the line). During a super the
  // cinematic camera (S.cine) swings in low and close around the attacker.
  function updateCamera(S, a, b, dt) {
    const mid = V3((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1;
    let px = -dz / d, pz = dx / d;
    if (S.camDir && px * S.camDir.x + pz * S.camDir.z < 0) { px = -px; pz = -pz; }
    if (!S.camDir) S.camDir = V3(px, 0, pz);
    S.camDir.lerp(V3(px, 0, pz), 1 - Math.exp(-dt * 6)).normalize();
    const dist = Math.max(5.4, d * 1.35 + 3.0) * (1 - S.zoomK * 0.08);
    const target = V3(mid.x, 0.95 + Math.min(1, Math.max(0, (a.y + b.y) * 0.25)), mid.z);
    S.lookAt.lerp(target, 1 - Math.exp(-dt * 8));
    let pos = V3(S.lookAt.x + S.camDir.x * dist, 1.55, S.lookAt.z + S.camDir.z * dist);
    if (!S.camPos) S.camPos = pos.clone();
    S.camPos.lerp(pos, 1 - Math.exp(-dt * 6));
    let camP = S.camPos.clone(), look = S.lookAt.clone();
    // Cinematic: a slow orbit on the attacker's side, low and close (angle 0 would be straight ahead of them,
    // pi/2 square to the side, more than pi/2 behind them), so both bodies stay in the shot.
    if (S.cine) {
      const c = S.cine; c.t += dt;
      const inK = Math.min(1, c.t / 0.35), outK = c.t > c.dur - 0.4 ? Math.max(0, (c.dur - c.t) / 0.4) : 1, k = T3.EASE.inout(Math.min(inK, outK));
      const fx = c.fwd.x, fz = c.fwd.z, side = c.side;
      const ang = c.a0 + (c.a1 - c.a0) * Math.min(1, c.t / c.dur);
      // Around the attacker: forward is the fight line, side the camera's side.
      const ox = Math.cos(ang) * fx + Math.sin(ang) * side.x, oz = Math.cos(ang) * fz + Math.sin(ang) * side.z;
      const cp = V3(c.center.x + ox * c.r, c.h0 + (c.h1 - c.h0) * Math.min(1, c.t / c.dur), c.center.z + oz * c.r);
      const cl = V3(c.center.x + fx * 0.38, 1.0, c.center.z + fz * 0.38);
      camP.lerp(cp, k); look.lerp(cl, k);
      if (c.t >= c.dur) S.cine = null;
    }
    S.camera.position.copy(camP);
    if (S.shake > 0.0005) {
      S.shakeT += dt * 60;
      S.camera.position.x += Math.sin(S.shakeT * 2.1) * S.shake; S.camera.position.y += Math.cos(S.shakeT * 2.7) * S.shake;
      S.shake *= Math.exp(-dt * 12);
    }
    S.camera.lookAt(look);
    S.zoomK *= Math.exp(-dt * 7);
    // The key light rides with the camera: up and to its left, so the fighters' faces are lit from any angle.
    const right = V3().subVectors(look, S.camera.position).normalize().cross(V3(0, 1, 0)).normalize();
    const back = V3().subVectors(S.camera.position, look).setY(0).normalize();
    S.key.position.copy(look).addScaledVector(right, -4).addScaledVector(back, 5).add(V3(0, 8, 0));
    S.key.target.position.copy(look).setY(0.8); S.key.target.updateMatrixWorld();
  }
  // Start the cinematic camera around attacker f (a fighter) for dur seconds.
  function cinematic(S, f, dur, o) {
    o = o || {};
    const side = V3().subVectors(S.camera.position, f.pos).setY(0); side.addScaledVector(f.fwd, -side.dot(f.fwd)).normalize();
    S.cine = { t: 0, dur, center: f.pos.clone(), fwd: f.fwd.clone(), side, a0: o.a0 !== undefined ? o.a0 : 2.1, a1: o.a1 !== undefined ? o.a1 : 1.45, r: o.r || 2.9, h0: o.h0 || 0.7, h1: o.h1 || 1.3 };
  }
  // Mood: 0 normal, 1 the super's darkened stage (lights dim, the fighters lit by their own effects).
  function setMood(S, k) {
    S.mood = k;
    S.hemi.intensity = 0.62 * (1 - 0.6 * k); S.rim.intensity = 0.6 + 0.8 * k;
    for (const l of S.fireLights) l.userData.k = 1 - 0.7 * k;
    S.scene.fog.color.setRGB(0.1 * (1 - k), 0.08 * (1 - k), 0.16 * (1 - k * 0.6));
  }

  // ---------- Effects ----------
  // An effect light from the pool: color, intensity, life in seconds, at p.
  function flashLight(S, p, color, intensity, life) {
    let best = S.fxLights[0];
    for (const L of S.fxLights) if (!L.owner && L.life <= 0) { best = L; break; } else if (!L.owner && L.life < best.life) best = L;
    best.l.position.copy(p); best.l.color.setHex(color); best.max = intensity; best.life = life; best.dur = life; best.l.intensity = intensity;
    return best;
  }
  // Claim a light for a projectile (released with release()).
  function holdLight(S, owner, color, intensity) {
    const L = S.fxLights.find((x) => !x.owner) || null;
    if (!L) return null;
    L.owner = owner; L.l.color.setHex(color); L.l.intensity = intensity; L.life = 0; return L;
  }
  function release(L) { if (L) { L.owner = null; L.l.intensity = 0; } }

  // Hit effects. kind: spark (blade), impact (blunt), fire, ice, gold, wind. power 1 to 2.5.
  function sparks(S, p, color, n, power, kind) {
    power = power || 1;
    const add = (m, v, life, o) => { S.scene.add(m); S.sparks.push(Object.assign({ m, v, life, age: 0 }, o || {})); };
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.14), T3M.mat(i % 3 ? color : 0xffffff, { glow: true, add: true, opacity: 0.95 }));
      m.position.copy(p);
      const v = V3(Math.random() - 0.5, Math.random() * 0.8 + 0.1, Math.random() - 0.5).normalize().multiplyScalar(2 + Math.random() * 4 * power);
      m.lookAt(p.clone().add(v));
      add(m, v, 0.22 + Math.random() * 0.2);
    }
    // Core glow, a star flash and an expanding ring.
    const glow = sprite("glow", color, true, 1); glow.position.copy(p); glow.scale.setScalar(0.4 * power); add(glow, V3(), 0.14, { grow: 5 * power, fade: true });
    const star = sprite("star", 0xffffff, true, 1); star.position.copy(p); star.scale.setScalar(0.5 * power); star.material.rotation = Math.random(); add(star, V3(), 0.08, { grow: 6 * power, fade: true });
    const ring = sprite("ring", color, true, 0.9); ring.position.copy(p); ring.scale.setScalar(0.2); add(ring, V3(), 0.2, { grow: 7 * power, fade: true });
    flashLight(S, p, color, 2.2 * power, 0.12);
    const r = () => Math.random() - 0.5;
    if (kind === "fire") for (let i = 0; i < 8; i++) { const s = sprite("glow", i % 2 ? 0x5a7bff : 0xa8c0ff, true, 0.9); s.position.copy(p).add(V3(r() * 0.2, r() * 0.2, r() * 0.2)); s.scale.setScalar(0.18); add(s, V3(r() * 1.5, 1 + Math.random() * 1.5, r() * 1.5), 0.35 + Math.random() * 0.2, { grow: 1.2, fade: true, float: true }); }
    if (kind === "ice") {
      for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), T3M.mat(i % 2 ? 0xe8fbff : 0x8fdcff, { glow: true })); m.position.copy(p); const v = V3(r() * 4, Math.random() * 3, r() * 4); m.rotation.set(r() * 6, r() * 6, r() * 6); add(m, v, 0.5 + Math.random() * 0.3, { spin: true }); }
      const mist = sprite("puff", 0xcff4ff, false, 0.7); mist.position.copy(p); mist.scale.setScalar(0.5); add(mist, V3(0, 0.3, 0), 0.6, { grow: 2.5, fade: true, float: true });
    }
    if (kind === "gold") for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.04), T3M.mat(i % 2 ? 0xffd25a : 0xffa53a, { glow: true, double: true })); m.position.copy(p); add(m, V3(r() * 2.5, 0.6 + Math.random() * 1.5, r() * 2.5), 0.7 + Math.random() * 0.3, { spin: true, light: true }); }
    if (kind === "impact") for (let i = 0; i < 4; i++) { const s = sprite("puff", 0xd8d0c0, false, 0.55); s.position.copy(p); s.scale.setScalar(0.25); add(s, V3(r() * 1.2, r() * 0.8, r() * 1.2), 0.35, { grow: 2, fade: true, float: true }); }
    if (kind === "wind") for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.4), T3M.mat(0xdfe8ff, { glow: true, add: true, opacity: 0.8 })); m.position.copy(p); const v = V3(r() * 5, r() * 2, r() * 5); m.lookAt(p.clone().add(v)); add(m, v, 0.18); }
    // Kinds added for the roster (roster3d.html): blood (crimson slashes), hellfire (red fire), muzzle (gun smoke
    // and a flash), rock (stone chips and dust), steam (the cyborg's vents).
    if (kind === "blood") for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.26), T3M.mat(i % 2 ? 0xff2a3a : 0xff8a8a, { glow: true, add: true })); m.position.copy(p); const v = V3(r() * 6, Math.random() * 3, r() * 6); m.lookAt(p.clone().add(v)); add(m, v, 0.32); }
    if (kind === "hellfire") for (let i = 0; i < 8; i++) { const s = sprite("glow", i % 2 ? 0xff3a1a : 0xffa040, true, 0.9); s.position.copy(p).add(V3(r() * 0.2, r() * 0.2, r() * 0.2)); s.scale.setScalar(0.2); add(s, V3(r() * 1.5, 1 + Math.random() * 1.5, r() * 1.5), 0.35 + Math.random() * 0.2, { grow: 1.2, fade: true, float: true }); }
    if (kind === "muzzle") { for (let i = 0; i < 3; i++) { const s = sprite("puff", 0xb8b0a0, false, 0.5); s.position.copy(p); s.scale.setScalar(0.18); add(s, V3(r() * 0.8, 0.3 + Math.random() * 0.4, r() * 0.8), 0.45, { grow: 2.4, fade: true, float: true }); } }
    if (kind === "rock") { for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.03 + Math.random() * 0.03, 0), T3M.mat(i % 2 ? 0x6a625a : 0x8c8378, { tex: false })); m.position.copy(p); add(m, V3(r() * 4, 1 + Math.random() * 3, r() * 4), 0.6 + Math.random() * 0.3, { spin: true }); } const d = sprite("puff", 0xa89c88, false, 0.6); d.position.copy(p); d.scale.setScalar(0.4); add(d, V3(0, 0.3, 0), 0.6, { grow: 2.2, fade: true, float: true }); }
    if (kind === "steam") for (let i = 0; i < 5; i++) { const s = sprite("puff", 0xe8e8f0, false, 0.45); s.position.copy(p); s.scale.setScalar(0.16); add(s, V3(r() * 1.2, 0.5 + Math.random() * 0.8, r() * 1.2), 0.5, { grow: 2.4, fade: true, float: true }); }
    if (kind === "spark") for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.22), T3M.mat(0xffe0a0, { glow: true, add: true })); m.position.copy(p); const v = V3(r() * 7, Math.random() * 4, r() * 7); m.lookAt(p.clone().add(v)); add(m, v, 0.3); }
  }
  // A burst of effect without a hit (casting, auras, supers): glow, ring and kind particles.
  function burst(S, p, color, power, kind) { sparks(S, p, color, Math.round(4 * power), power, kind); }
  function dust(S, p, n, big) {
    for (let i = 0; i < n; i++) {
      const s = sprite("puff", 0x9a9080, false, 0.55); s.position.set(p.x + (Math.random() - 0.5) * 0.3, 0.06, p.z + (Math.random() - 0.5) * 0.3); s.scale.setScalar(big ? 0.4 : 0.25);
      const v = V3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).multiplyScalar(big ? 2.4 : 1.6);
      S.scene.add(s); S.sparks.push({ m: s, v, life: 0.45 + Math.random() * 0.2, age: 0, grow: 1.6, fade: true, float: true });
    }
  }
  // A shockwave ring along the floor (landings, slams).
  function shockwave(S, p, color, size) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.03, p.z);
    S.scene.add(m); S.sparks.push({ m, v: V3(), life: 0.35, age: 0, ring: size || 3 });
  }
  function stepSparks(S, dt) {
    S.t += dt;
    for (let i = S.sparks.length - 1; i >= 0; i--) {
      const s = S.sparks[i]; s.age += dt;
      if (s.age >= s.life) { S.scene.remove(s.m); if (s.m.geometry && !s.m.isSprite) s.m.geometry.dispose(); if (s.m.isSprite) s.m.material.dispose(); else if (s.ring) s.m.material.dispose(); S.sparks.splice(i, 1); continue; }
      s.m.position.addScaledVector(s.v, dt);
      const k = 1 - s.age / s.life;
      if (s.ring) { const sc = 1 + (s.age / s.life) * s.ring * 3; s.m.scale.set(sc, sc, sc); s.m.material.opacity = 0.8 * k; continue; }
      if (s.grow) { const sc = s.m.scale.x * (1 + s.grow * dt); s.m.scale.set(sc, sc, sc); }
      if (s.fade && s.m.material) s.m.material.opacity = Math.min(s.m.material.opacity, k);
      if (s.float) s.v.multiplyScalar(Math.exp(-dt * 3));
      else if (s.light) { s.v.y -= 2.5 * dt; s.v.multiplyScalar(Math.exp(-dt * 2)); }
      else s.v.y -= 9 * dt;
      if (s.spin) { s.m.rotation.x += dt * 9; s.m.rotation.y += dt * 7; }
      if (!s.grow && !s.fade && !s.spin) s.m.scale.setScalar(Math.max(0.05, k));
    }
    // Stage life: fires flicker, their lights breathe, banners sway, embers rise.
    const t = S.t;
    for (const f of S.fires) for (const m of f.children) if (m.userData.ph !== undefined) { const ph = t * 9 + m.userData.ph; m.scale.set(0.8 + 0.25 * Math.sin(ph * 1.3), 0.75 + 0.35 * Math.sin(ph), 0.8 + 0.25 * Math.cos(ph * 1.1)); m.rotation.z = 0.2 * Math.sin(ph * 0.7); }
    S.fireLights.forEach((l, i) => { l.intensity = (1.35 + 0.25 * Math.sin(t * 13 + i * 2) + 0.15 * Math.sin(t * 29 + i)) * (l.userData.k !== undefined ? l.userData.k : 1); });
    S.banners.forEach((b, i) => { b.rotation.x = 0.06 * Math.sin(t * 1.3 + i); });
    const E = S.embers;
    for (let i = 0; i < E.N; i++) {
      const v = E.v[i]; E.pos[i * 3] += (v[0] + 0.15 * Math.sin(t * 2 + i)) * dt; E.pos[i * 3 + 1] += v[1] * dt; E.pos[i * 3 + 2] += v[2] * dt;
      if (E.pos[i * 3 + 1] > 6.5) resetEmber(S, i, false);
    }
    E.pts.geometry.attributes.position.needsUpdate = true;
    for (const L of S.fxLights) if (!L.owner && L.life > 0) { L.life -= dt; L.l.intensity = Math.max(0, L.max * (L.life / L.dur)); }
  }

  // ---------- Trails ----------
  // A ribbon that follows a moving segment (a blade from hilt to tip, a fist, a foot) and fades out behind it.
  class Trail {
    constructor(S, color, n) {
      this.n = n || 12; this.color = new THREE.Color(color); this.pts = [];
      const geo = new THREE.BufferGeometry(), N = this.n;
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
      geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
      const idx = []; for (let i = 0; i + 1 < N; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      geo.setIndex(idx);
      this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      this.mesh.frustumCulled = false; this.mesh.visible = false; S.scene.add(this.mesh);
    }
    // a, b: world points; k: intensity 0..1 (0 adds a point that fades the trail out).
    push(a, b, k) {
      this.pts.unshift({ a: a.clone(), b: b.clone(), k });
      if (this.pts.length > this.n) this.pts.pop();
      const pos = this.mesh.geometry.attributes.position, col = this.mesh.geometry.attributes.color;
      let any = false;
      for (let i = 0; i < this.n; i++) {
        const p = this.pts[Math.min(i, this.pts.length - 1)];
        const f = i < this.pts.length ? p.k * Math.pow(1 - i / this.n, 1.5) : 0;
        if (f > 0.02) any = true;
        pos.setXYZ(i * 2, p.a.x, p.a.y, p.a.z); pos.setXYZ(i * 2 + 1, p.b.x, p.b.y, p.b.z);
        col.setXYZ(i * 2, this.color.r * f * 0.35, this.color.g * f * 0.35, this.color.b * f * 0.35);
        col.setXYZ(i * 2 + 1, this.color.r * f, this.color.g * f, this.color.b * f);
      }
      pos.needsUpdate = true; col.needsUpdate = true; this.mesh.visible = any;
    }
    clear() { this.pts.length = 0; this.mesh.visible = false; }
    dispose(S) { S.scene.remove(this.mesh); this.mesh.geometry.dispose(); }
  }

  // ---------- Projectile and spell meshes ----------
  // Each returns { group, step(dt, t, age) }. Kinds: fireball, comet, ember (low flame), pillar, ball (a baseball),
  // spikes (ice from the floor), axe (a spinning copy of a weapon, o.weapon), shell (an ice shell around a body).
  function projMesh(S, kind, o) {
    o = o || {};
    const g = new THREE.Group();
    const M = (c, x) => T3M.mat(c, Object.assign({ glow: true, add: true }, x || {}));
    let step = () => {};
    if (kind === "fireball" || kind === "comet") {
      const s = kind === "comet" ? 2.1 : 1;
      const orb = T3M.orbMesh(0.09 * s); g.add(orb);
      const glow = sprite("glow", 0x5a7bff, true, 0.9); glow.scale.setScalar(0.7 * s); g.add(glow);
      step = (dt, t) => { orb.userData.ring.rotation.set(t * 9, t * 7, 0); T3M.stepFlames(orb.userData.flames, t * 2, 1.2); orb.rotation.z = t * 5; glow.scale.setScalar((0.7 + 0.1 * Math.sin(t * 40)) * s); };
    } else if (kind === "ember") {
      const fl = T3M.flameCluster(2.2); g.add(fl);
      const glow = sprite("glow", 0x5a7bff, true, 0.7); glow.scale.setScalar(0.6); glow.position.y = 0.1; g.add(glow);
      step = (dt, t) => T3M.stepFlames(fl, t * 1.6, 1.2);
    } else if (kind === "pillar") {
      const parts = [];
      for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(0.16 + (i % 3) * 0.05, 1.4 + (i % 4) * 0.4, 5), M([0x3a5cff, 0x6f8dff, 0xb8ccff, 0x6f4dff][i % 4], { opacity: 0.7 }));
        m.position.set(Math.cos(i * 2.4) * 0.12, 0.7, Math.sin(i * 2.4) * 0.12); m.userData.ph = i * 1.3; g.add(m); parts.push(m);
      }
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 2.2, 6, 1, true), M(0xeaf2ff, { opacity: 0.8, double: true })); core.position.y = 1.1; g.add(core);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.55, 16), M(0x6f8dff, { opacity: 0.8, double: true })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
      step = (dt, t, age) => {
        const grow = Math.min(1, age / 0.1), fade = o.life ? Math.max(0, Math.min(1, (o.life - age) / 0.15)) : 1;
        for (const m of parts) { const ph = t * 14 + m.userData.ph; m.scale.set(0.8 + 0.3 * Math.sin(ph), grow * fade * (0.8 + 0.3 * Math.sin(ph * 1.3)), 0.8 + 0.3 * Math.cos(ph)); }
        core.scale.set(fade, grow * fade, fade); ring.scale.setScalar(1 + age * 3);
      };
    } else if (kind === "crescent") {
      // A crescent of plasma thrown off the blade (vertical arc, facing its travel).
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 4, 14, Math.PI), M(o.color || 0xffa040, { opacity: 0.9, double: true }));
      arc.rotation.set(0, 0, -Math.PI / 2); g.add(arc);
      const core = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.018, 3, 14, Math.PI), M(0xfff2d0, { double: true })); core.rotation.copy(arc.rotation); g.add(core);
      const glow = sprite("glow", o.color || 0xffa040, true, 0.7); glow.scale.setScalar(0.9); glow.position.x = 0.3; g.add(glow);
      step = (dt, t) => { arc.scale.set(1, 1, 1 + 0.2 * Math.sin(t * 50)); };
    } else if (kind === "ball") {
      const c = document.createElement("canvas"); c.width = 16; c.height = 8; const cg = c.getContext("2d");
      cg.fillStyle = "#f2efe6"; cg.fillRect(0, 0, 16, 8); cg.fillStyle = "#c8323a"; for (let x = 0; x < 16; x += 2) { cg.fillRect(x, 2 + (x % 4 ? 1 : 0), 1, 1); cg.fillRect(x, 5 - (x % 4 ? 1 : 0), 1, 1); }
      const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshPhongMaterial({ map: t, flatShading: true, shininess: 10 })); g.add(ball);
      const glow = sprite("glow", 0x9fc0ff, true, 0.5); glow.scale.setScalar(0.35); g.add(glow);
      step = (dt, tt) => { ball.rotation.z -= dt * 40; ball.rotation.y += dt * 9; };
    } else if (kind === "spikes") {
      const parts = [];
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(0.08 + (i % 3) * 0.03, 0.5 + (i % 3) * 0.3, 4), T3M.mat(i % 2 ? 0xbff0ff : 0x8fdcff, { glow: true, opacity: 0.85 }));
        const a = i * 2.2; m.position.set(Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18); m.rotation.set(Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35); m.userData.h = 0.25 + (i % 3) * 0.15; g.add(m); parts.push(m);
      }
      step = (dt, t, age) => {
        const grow = Math.min(1, age / 0.08), fade = o.life ? Math.max(0, Math.min(1, (o.life - age) / 0.2)) : 1;
        for (const m of parts) { m.scale.set(fade, grow * fade, fade); m.position.y = m.userData.h * grow * fade; }
      };
    } else if (kind === "axe" && o.weapon) {
      const c = o.weapon.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.setScalar(1);
      const spinner = new THREE.Group(); c.position.x = -0.5; spinner.add(c); g.add(spinner);
      const glow = sprite("glow", o.color || 0x8fdcff, true, 0.6); glow.scale.setScalar(1.2); g.add(glow);
      step = (dt) => { spinner.rotation.y -= dt * 22; };
    } else if (kind === "bullet") {
      // A pistol round: a bright tracer streak with a small glow (roster3d.html).
      const streak = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.004, 0.5, 5), M(0xffe6a0)); streak.rotation.z = Math.PI / 2; streak.position.x = -0.2; g.add(streak);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), M(0xffffff)); g.add(head);
      const glow = sprite("glow", 0xffb040, true, 0.8); glow.scale.setScalar(0.3); g.add(glow);
      step = (dt, t) => { glow.scale.setScalar(0.26 + 0.06 * Math.sin(t * 80)); };
    } else if (kind === "quake") {
      // Broken stone rising along the floor in a line (a hammer quake, roster3d.html).
      const parts = [];
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + (i % 3) * 0.04, 0), T3M.mat(i % 2 ? 0x6a625a : 0x857b70, { tex: false }));
        const a = i * 2.2; m.position.set(Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16); m.rotation.set(a, a * 1.3, 0); m.userData.h = 0.1 + (i % 3) * 0.08; g.add(m); parts.push(m);
      }
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.42, 16), M(o.color || 0xffb060, { opacity: 0.55, double: true })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
      step = (dt, t, age) => {
        const grow = Math.min(1, age / 0.06), fade = o.life ? Math.max(0, Math.min(1, (o.life - age) / 0.2)) : 1;
        for (const m of parts) { m.scale.setScalar(grow * fade); m.position.y = m.userData.h * grow * fade; }
        ring.scale.setScalar(1 + age * 2); ring.material.opacity = 0.55 * fade;
      };
    } else if (kind === "hellpillar") {
      // A column of red fire under the opponent (Scarlet Reaver's eruption, roster3d.html).
      const parts = [];
      for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(0.16 + (i % 3) * 0.05, 1.3 + (i % 4) * 0.4, 6), M([0xff2a10, 0xff7a20, 0xffd070, 0xc81020][i % 4], { opacity: 0.75 }));
        m.position.set(Math.cos(i * 2.4) * 0.12, 0.65, Math.sin(i * 2.4) * 0.12); m.userData.ph = i * 1.3; g.add(m); parts.push(m);
      }
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.6, 20), M(0xff4a20, { opacity: 0.8, double: true })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
      step = (dt, t, age) => {
        const grow = Math.min(1, age / 0.1), fade = o.life ? Math.max(0, Math.min(1, (o.life - age) / 0.15)) : 1;
        for (const m of parts) { const ph = t * 14 + m.userData.ph; m.scale.set(0.8 + 0.3 * Math.sin(ph), grow * fade * (0.8 + 0.3 * Math.sin(ph * 1.3)), 0.8 + 0.3 * Math.cos(ph)); }
        ring.scale.setScalar(1 + age * 3);
      };
    } else if (kind === "lash") {
      // A crimson crescent of air cracked off a whip (Crimson Veil, roster3d.html).
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 4, 16, Math.PI), M(0xff2a4a, { opacity: 0.9, double: true }));
      arc.rotation.set(Math.PI / 2, 0, -Math.PI / 2); g.add(arc);
      const core = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.012, 3, 16, Math.PI), M(0xffd0d8, { double: true })); core.rotation.copy(arc.rotation); g.add(core);
      const glow = sprite("glow", 0xff2a4a, true, 0.6); glow.scale.setScalar(0.7); g.add(glow);
      step = (dt, t) => { arc.scale.set(1, 1 + 0.2 * Math.sin(t * 50), 1); };
    } else if (kind === "shell") {
      for (let i = 0; i < 9; i++) {
        const h = 0.5 + (i % 3) * 0.35, m = new THREE.Mesh(new THREE.ConeGeometry(0.16, h, 4), T3M.mat(i % 2 ? 0xcff4ff : 0x8fdcff, { glow: true, opacity: 0.55 }));
        const a = i * 0.7; m.position.set(Math.cos(a) * 0.3, h / 2 + (i % 3) * 0.45, Math.sin(a) * 0.3); m.rotation.set(Math.sin(a) * 0.2, a, Math.cos(a) * 0.2); g.add(m);
      }
      step = () => {};
    }
    g.traverse((m) => { if (m.isMesh) m.frustumCulled = false; });
    S.scene.add(g);
    return { group: g, step };
  }
  function removeMesh(S, pm) { if (pm) S.scene.remove(pm.group); }

  // Quality: high (shadows and brazier lights) or low (for weak graphics chips). Materials rebuild their shaders.
  function setQuality(S, high) {
    S.high = high;
    S.renderer.shadowMap.enabled = high; S.key.castShadow = high;
    for (const l of S.fireLights) l.visible = high;
    S.scene.traverse((m) => { if (m.material) [].concat(m.material).forEach((x) => (x.needsUpdate = true)); });
  }

  return { create, resize, setQuality, updateCamera, cinematic, setMood, sparks, burst, dust, shockwave, stepSparks, flashLight, holdLight, release, Trail, projMesh, removeMesh, sprite };
})();
