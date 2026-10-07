// 3D Lab models: the six characters as low-poly, flat-shaded meshes in the PS1 / Tekken 3 style of Krishna's
// reference sheets (C:\Users\krish\Downloads\Tekken References). Built in code from simple faceted shapes on the
// T3 skeleton. Every part carries a painted detail texture (folds, plates, rivets, stitches, wear; see PAINT) and a
// flat-shaded Phong material with a small highlight, faces are 96 x 48 pixel paintings, and hair and cloth are
// verlet strands. Weapons are built to the sheets (the broad cyber sword, the rusty bat, the staff, the big axe).
// Hands and feet are a little oversized on purpose, so strikes read at speed.
const T3M = (() => {
  const { DEG } = T3;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------- Materials and textures ----------
  // Every solid part is a flat-shaded Phong material (hard facets, a small highlight on metal and leather) with a
  // painted detail texture multiplied over its color, like the 256 px texture pages on the reference sheets:
  // baked top-to-bottom shading, grain, folds, plate seams, rivets, stitches, scratches. The detail maps are
  // grayscale, so a part keeps its design color. Small and pixel sharp (nearest filtering), the PS1 way.
  //   o.tex   detail kind ("plain" by default, false for none): plain cloth armor metal leather skin rubber hair
  //           wood gold
  //   o.map   a color texture instead (pinstripes, camo, quilting); o.tex then only picks the highlight
  //   o.glow  unlit (glowing) material; o.add additive
  const SPEC = { plain: [0x141414, 8], cloth: [0x0a0a0a, 4], armor: [0x6a6a6a, 26], metal: [0xc8c8c8, 46], leather: [0x2a2a2a, 14],
    skin: [0x221c18, 10], rubber: [0x0c0c0c, 4], hair: [0x2a2a30, 20], wood: [0x1a1410, 8], gold: [0xb08a40, 40], fur: [0x000000, 2] };
  const matCache = {};
  function mat(color, o) {
    o = o || {};
    const key = color + JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v));
    if (matCache[key]) return matCache[key];
    let m;
    if (o.glow) m = new THREE.MeshBasicMaterial({ color, transparent: !!o.add || o.opacity < 1, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !o.add, opacity: o.opacity || 1, side: o.double ? THREE.DoubleSide : THREE.FrontSide, map: o.map || null });
    else {
      const kind = o.tex === undefined ? "plain" : o.tex;
      const map = o.map || (kind ? detail(kind) : null), sp = SPEC[kind || "plain"] || SPEC.plain;
      m = new THREE.MeshPhongMaterial({ color, flatShading: true, map, specular: sp[0], shininess: sp[1], emissive: o.emissive || 0,
        side: o.double ? THREE.DoubleSide : THREE.FrontSide, alphaTest: o.alphaTest || 0, transparent: false });
    }
    return (matCache[key] = m);
  }
  function canvasTex(w, h, paint, repeat, smooth) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); paint(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    // Repeating floor and wall textures get mipmaps (no shimmer far away); body textures stay sharp.
    if (smooth) { t.minFilter = THREE.NearestMipmapLinearFilter; t.generateMipmaps = true; } else { t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  // Seeded noise so textures are the same every load.
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function speckle(g, w, h, color, n, seed, size) { const r = rng(seed); g.fillStyle = color; for (let i = 0; i < n; i++) g.fillRect(Math.floor(r() * w), Math.floor(r() * h), size || 1, size || 1); }
  // Per-pixel grain: every pixel a little lighter or darker (amp in 0..255).
  function grain(g, w, h, amp, seed) {
    const r = rng(seed), d = g.getImageData(0, 0, w, h), a = d.data;
    for (let i = 0; i < a.length; i += 4) { const n = (r() - 0.5) * 2 * amp; a[i] = clamp8(a[i] + n); a[i + 1] = clamp8(a[i + 1] + n); a[i + 2] = clamp8(a[i + 2] + n); }
    g.putImageData(d, 0, 0);
  }
  const clamp8 = (v) => Math.max(0, Math.min(255, v));
  // Baked light: darker toward the bottom of the part (the far end of a limb), a thin shadow at the joint.
  function shadeV(g, w, h, top, bottom, joint) {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, `rgba(0,0,0,${top})`); gr.addColorStop(1, `rgba(0,0,0,${bottom})`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (joint) { g.fillStyle = `rgba(0,0,0,${joint})`; g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2); }
  }
  const gray = (v) => `rgb(${v},${v},${v})`;
  // Grayscale detail painters, 32 wide (around the part; u = 0.25 is the front of a limb) by 64 long (top row =
  // the joint end).
  const PAINT = {
    plain(g, w, h, r) { g.fillStyle = gray(240); g.fillRect(0, 0, w, h); grain(g, w, h, 9, 3); shadeV(g, w, h, 0, 0.14, 0.12); },
    cloth(g, w, h, r) {
      g.fillStyle = gray(238); g.fillRect(0, 0, w, h); grain(g, w, h, 10, 5);
      // Folds: a soft dark crease with a lit ridge above it.
      for (let i = 0; i < 4; i++) {
        const y0 = 8 + i * 14 + Math.floor(r() * 6), amp = 2 + r() * 2, ph = r() * 6;
        for (let x = 0; x < w; x++) { const y = Math.round(y0 + amp * Math.sin(x / w * Math.PI * 2 + ph)); g.fillStyle = "rgba(0,0,0,0.16)"; g.fillRect(x, y, 1, 2); g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(x, y - 1, 1, 1); }
      }
      g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(Math.floor(w * 0.75), 0, 1, h); // back seam
      shadeV(g, w, h, 0, 0.16, 0.14);
    },
    armor(g, w, h, r) {
      g.fillStyle = gray(236); g.fillRect(0, 0, w, h); grain(g, w, h, 8, 7);
      // Two overlapping plates: a lit bevel on top, a dark lip at the bottom, a seam at the back, rivets.
      for (const [y0, y1] of [[0, 30], [30, 64]]) {
        g.fillStyle = gray(255); g.fillRect(0, y0 + 1, w, 2);
        g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(0, y0 + 3, w, 3);
        g.fillStyle = gray(120); g.fillRect(0, y1 - 2, w, 2);
        g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(0, y1 - 5, w, 3);
        for (const x of [5, 11, 21, 27]) { g.fillStyle = gray(110); g.fillRect(x, y0 + 5, 2, 2); g.fillStyle = gray(255); g.fillRect(x, y0 + 5, 1, 1); }
      }
      g.fillStyle = gray(130); g.fillRect(Math.floor(w * 0.75), 0, 1, h);
      speckle(g, w, h, "rgba(255,255,255,0.55)", 26, 17, 1); // edge wear
      speckle(g, w, h, "rgba(0,0,0,0.25)", 18, 18, 1);
      shadeV(g, w, h, 0, 0.12, 0);
    },
    metal(g, w, h, r) {
      g.fillStyle = gray(222); g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x++) { const v = 205 + Math.floor(r() * 45); g.fillStyle = gray(v); g.fillRect(x, 0, 1, h); } // brushed
      g.fillStyle = gray(255); g.fillRect(Math.floor(w * 0.18), 0, 3, h); g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(Math.floor(w * 0.18) + 3, 0, 2, h);
      g.fillStyle = gray(150); g.fillRect(Math.floor(w * 0.6), 0, 2, h);
      for (let i = 0; i < 10; i++) { g.fillStyle = "rgba(255,255,255,0.7)"; const x = Math.floor(r() * w), y = Math.floor(r() * h); g.fillRect(x, y, 3, 1); g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(x + 1, y + 1, 2, 1); }
      shadeV(g, w, h, 0, 0.1, 0.15);
    },
    leather(g, w, h, r) {
      g.fillStyle = gray(226); g.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) { g.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`; g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 4 + Math.floor(r() * 6), 3 + Math.floor(r() * 5)); }
      grain(g, w, h, 8, 9);
      for (const y of [3, h - 4]) { g.fillStyle = gray(140); g.fillRect(0, y, w, 1); g.fillStyle = gray(255); for (let x = 0; x < w; x += 3) g.fillRect(x, y, 2, 1); }
      for (let i = 0; i < 5; i++) { g.fillStyle = "rgba(0,0,0,0.18)"; const y = 10 + Math.floor(r() * (h - 20)); g.fillRect(0, y, w, 1); }
      shadeV(g, w, h, 0, 0.16, 0.1);
    },
    skin(g, w, h, r) {
      g.fillStyle = gray(244); g.fillRect(0, 0, w, h); grain(g, w, h, 6, 11);
      // Muscle shading: a lit front, a soft shadow behind.
      g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(Math.floor(w * 0.12), 4, Math.floor(w * 0.26), h - 12);
      g.fillStyle = "rgba(0,0,0,0.08)"; g.fillRect(Math.floor(w * 0.6), 0, Math.floor(w * 0.3), h);
      shadeV(g, w, h, 0, 0.15, 0.08);
    },
    rubber(g, w, h, r) { g.fillStyle = gray(220); g.fillRect(0, 0, w, h); for (let y = 2; y < h; y += 4) { g.fillStyle = gray(150); g.fillRect(0, y, w, 1); } grain(g, w, h, 8, 13); shadeV(g, w, h, 0, 0.1, 0); },
    hair(g, w, h, r) {
      g.fillStyle = gray(225); g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x++) { const v = 170 + Math.floor(r() * 85); g.fillStyle = gray(v); g.fillRect(x, Math.floor(r() * 6), 1, h); }
      g.fillStyle = "rgba(255,255,255,0.45)"; g.fillRect(Math.floor(w * 0.2), 0, 2, h);
      shadeV(g, w, h, 0, 0.2, 0);
    },
    wood(g, w, h, r) {
      g.fillStyle = gray(225); g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 2) { const v = 180 + Math.floor(r() * 70); g.fillStyle = gray(v); g.fillRect(x, 0, 1, h); }
      for (let i = 0; i < 6; i++) { g.fillStyle = gray(120); g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 2, 3); } // knots
      grain(g, w, h, 8, 15); shadeV(g, w, h, 0, 0.1, 0);
    },
    gold(g, w, h, r) {
      g.fillStyle = gray(225); g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 6) { g.fillStyle = gray(255); g.fillRect(0, y, w, 2); g.fillStyle = gray(150); g.fillRect(0, y + 4, w, 1); } // rings
      g.fillStyle = gray(255); g.fillRect(Math.floor(w * 0.2), 0, 2, h);
      grain(g, w, h, 8, 19); shadeV(g, w, h, 0, 0.1, 0);
    },
    fur(g, w, h, r) {
      g.fillStyle = gray(236); g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { const x = Math.floor(r() * w), y = Math.floor(r() * h), v = 170 + Math.floor(r() * 85); g.fillStyle = gray(v); g.fillRect(x, y, 1, 3 + Math.floor(r() * 4)); }
      shadeV(g, w, h, 0, 0.18, 0);
    },
  };
  const detailCache = {};
  function detail(kind) {
    if (detailCache[kind]) return detailCache[kind];
    const r = rng(kind.length * 977 + kind.charCodeAt(0));
    return (detailCache[kind] = canvasTex(32, 64, (g, w, h) => (PAINT[kind] || PAINT.plain)(g, w, h, r)));
  }

  // Color textures (the patterned fabrics on the design sheets), with the same baked folds and shading.
  const TEX = {};
  function textures() {
    if (TEX.ready) return TEX;
    // Blue X's baseball pants: off-white pinstripes, field dirt at the knees, folds.
    TEX.pinstripe = canvasTex(32, 64, (g, w, h) => {
      g.fillStyle = "#dcdee5"; g.fillRect(0, 0, w, h); grain(g, w, h, 8, 21);
      g.fillStyle = "#3a5bd0"; for (let x = 1; x < w; x += 4) g.fillRect(x, 0, 1, h);
      const r = rng(23);
      for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(120,86,56,${0.25 + r() * 0.3})`; g.fillRect(Math.floor(r() * w), 34 + Math.floor(r() * 26), 2 + Math.floor(r() * 4), 1 + Math.floor(r() * 3)); }
      for (let i = 0; i < 3; i++) { const y = 12 + i * 16; g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(0, y, w, 2); g.fillStyle = "rgba(255,255,255,0.4)"; g.fillRect(0, y - 1, w, 1); }
      shadeV(g, w, h, 0, 0.14, 0.12);
    });
    // Voss's armor plates: blue, white and black digital camo with lit plate edges.
    TEX.camo = canvasTex(32, 32, (g, w, h) => {
      g.fillStyle = "#1c1e26"; g.fillRect(0, 0, w, h);
      const r = rng(11);
      for (let i = 0; i < 34; i++) { g.fillStyle = r() < 0.55 ? "#2f5fc4" : r() < 0.6 ? "#d7dce6" : "#8a93a6"; g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 2 + Math.floor(r() * 5), 1 + Math.floor(r() * 4)); }
      g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(0, 0, w, 2); g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(0, h - 2, w, 2);
      speckle(g, w, h, "rgba(255,255,255,0.6)", 20, 31, 1);
    }, [1, 1]);
    // Voss's quilted bodysuit: each diamond lit on top, shadowed below.
    TEX.quilt = canvasTex(32, 32, (g, w, h) => {
      g.fillStyle = "#262830"; g.fillRect(0, 0, w, h);
      for (let y = -8; y < h; y += 8) for (let x = -8; x < w; x += 8) {
        const ox = (y / 8) % 2 ? 4 : 0;
        g.fillStyle = "#30333d"; g.fillRect(x + ox + 2, y + 1, 4, 3);
        g.fillStyle = "#1c1d24"; g.fillRect(x + ox + 1, y + 5, 6, 2);
      }
      g.fillStyle = "#121318"; for (let i = 0; i < w; i++) { g.fillRect(i, (i * 2) % h, 1, 1); g.fillRect(i, (h - 1 - (i * 2) % h), 1, 1); g.fillRect(i, ((i * 2) + 16) % h, 1, 1); g.fillRect(i, (h - 1 - ((i * 2) + 16) % h), 1, 1); }
      grain(g, w, h, 6, 33);
    }, [2, 2]);
    // Suvarna's teal panel: gold vine pattern, red borders, a fringe.
    TEX.panel = canvasTex(16, 64, (g, w, h) => {
      g.fillStyle = "#24a092"; g.fillRect(0, 0, w, h); grain(g, w, h, 10, 41);
      g.fillStyle = "#e9b23c";
      for (let y = 4; y < h - 6; y += 8) { g.fillRect(7, y, 2, 1); g.fillRect(5, y + 1, 6, 1); g.fillRect(6, y + 2, 4, 1); g.fillRect(7, y + 3, 2, 3); g.fillRect(4, y + 4, 2, 1); g.fillRect(10, y + 4, 2, 1); }
      g.fillStyle = "#d4432a"; g.fillRect(0, 0, 2, h); g.fillRect(w - 2, 0, 2, h); g.fillRect(0, 0, w, 2);
      g.fillStyle = "#e9b23c"; for (let x = 0; x < w; x += 2) g.fillRect(x, h - 4, 1, 4);
    });
    TEX.fur = canvasTex(32, 32, (g, w, h) => {
      g.fillStyle = "#e4e2da"; g.fillRect(0, 0, w, h);
      const r = rng(5); for (let i = 0; i < 90; i++) { const v = 170 + Math.floor(r() * 85); g.fillStyle = `rgb(${v},${v - 4},${v - 12})`; g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 2 + Math.floor(r() * 5)); }
      speckle(g, w, h, "#ffffff", 30, 6, 1);
    }, [2, 2]);
    // Frostjaw's cape: deep blue, lighter folds, a ragged hem (cut away by alpha).
    TEX.cape = canvasTex(32, 64, (g, w, h) => {
      g.fillStyle = "#1f4d9a"; g.fillRect(0, 0, w, h); grain(g, w, h, 12, 13);
      for (let x = 2; x < w; x += 7) { g.fillStyle = "rgba(255,255,255,0.14)"; g.fillRect(x, 0, 2, h); g.fillStyle = "rgba(0,0,0,0.2)"; g.fillRect(x + 3, 0, 2, h); }
      g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, 0, w, 3);
      const r = rng(14);
      g.clearRect(0, h - 2, w, 2); for (let x = 0; x < w; x += 2) g.clearRect(x, h - 4 - Math.floor(r() * 9), 2, 14);
    });
    // Nova's baggy cargo pants: dark gray twill, seams, a pocket, creases.
    TEX.denim = canvasTex(32, 64, (g, w, h) => {
      g.fillStyle = "#2b2d34"; g.fillRect(0, 0, w, h); grain(g, w, h, 10, 22);
      for (let y = 0; y < h; y += 2) { g.fillStyle = "rgba(255,255,255,0.03)"; g.fillRect(0, y, w, 1); }
      g.fillStyle = "#1a1b20"; g.fillRect(Math.floor(w * 0.5), 0, 1, h); g.fillStyle = "#3a3d47"; g.fillRect(Math.floor(w * 0.5) + 1, 0, 1, h);
      g.fillStyle = "#22242a"; g.fillRect(2, 20, 10, 12); g.fillStyle = "#3a3d47"; g.fillRect(2, 20, 10, 1); // pocket
      for (let i = 0; i < 5; i++) { const y = 8 + i * 11; g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(0, y, w, 2); g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(0, y - 1, w, 1); }
    });
    // Blue X's bat: brushed aluminum, rust spots, a blue X on the barrel.
    TEX.bat = canvasTex(32, 64, (g, w, h) => {
      g.fillStyle = "#c3c8d0"; g.fillRect(0, 0, w, h);
      const r = rng(51);
      for (let x = 0; x < w; x++) { const v = 180 + Math.floor(r() * 60); g.fillStyle = `rgb(${v},${v + 3},${v + 8})`; g.fillRect(x, 0, 1, h); }
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${110 + Math.floor(r() * 40)},60,30,${0.4 + r() * 0.4})`; g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1 + Math.floor(r() * 2), 1 + Math.floor(r() * 2)); }
      g.fillStyle = "#1f3fbf"; for (let i = 0; i < 9; i++) { g.fillRect(4 + i, 8 + i, 2, 1); g.fillRect(12 - i, 8 + i, 2, 1); }
      g.fillStyle = "#ffffff"; g.fillRect(Math.floor(w * 0.6), 0, 2, h);
    });
    TEX.ready = true;
    return TEX;
  }

  // A face texture that wraps a sphere: the face is centered on u = 0.5 (the head's +x, its front). 96 x 48, so the
  // eyes, brows, nose and mouth read at fight distance.
  // f: { skin, hair, eyes, brow, beard, lips, eyeGlow, faceless, lashes, heavyBrow, stubble }
  function faceTex(f) {
    return canvasTex(96, 48, (g, w, h) => {
      g.fillStyle = f.skin; g.fillRect(0, 0, w, h); grain(g, w, h, 5, 61);
      const cx = w / 2;
      // Soft shading around the face: cheeks and the sides of the head darker, the brow ridge and nose lit.
      g.fillStyle = "rgba(0,0,0,0.14)"; g.fillRect(cx - 18, 20, 4, 18); g.fillRect(cx + 14, 20, 4, 18);
      g.fillStyle = "rgba(0,0,0,0.08)"; g.fillRect(0, 0, cx - 18, h); g.fillRect(cx + 18, 0, w - cx - 18, h);
      g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(cx - 10, 16, 20, 2); g.fillRect(cx - 1, 18, 2, 8);
      // Hair over the back and the top of the head, with strands.
      if (f.hair) {
        g.fillStyle = f.hair; g.fillRect(0, 0, w, 13); g.fillRect(0, 0, 28, h - 10); g.fillRect(w - 28, 0, 28, h - 10);
        if (f.hairFront) g.fillRect(cx - 12, 10, 24, 5);
        const r = rng(63); for (let i = 0; i < 60; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.25)"; const x = Math.floor(r() * w); if (x > cx - 18 && x < cx + 18) continue; g.fillRect(x, Math.floor(r() * 12), 1, 4 + Math.floor(r() * 10)); }
        // Hairline: a ragged edge.
        for (let x = cx - 18; x < cx + 18; x += 2) { g.fillStyle = f.hair; g.fillRect(x, 13, 2, (x * 7) % 3); }
      }
      if (f.faceless) { g.fillStyle = "rgba(0,0,0,0.1)"; g.fillRect(cx - 12, 34, 24, 4); return; }
      // Brows.
      const bc = f.brow || "#1a1412";
      g.fillStyle = bc;
      if (f.heavyBrow) { g.fillRect(cx - 12, 18, 8, 2); g.fillRect(cx + 4, 18, 8, 2); g.fillRect(cx - 5, 19, 2, 1); g.fillRect(cx + 3, 19, 2, 1); }
      else { g.fillRect(cx - 11, 18, 7, 1); g.fillRect(cx + 4, 18, 7, 1); g.fillRect(cx - 11, 19, 2, 1); g.fillRect(cx + 9, 19, 2, 1); }
      // Eyes: a dark socket shadow, the white, the iris with a pupil and a catch light, upper lid line.
      g.fillStyle = "rgba(0,0,0,0.2)"; g.fillRect(cx - 12, 20, 9, 5); g.fillRect(cx + 3, 20, 9, 5);
      g.fillStyle = "#ece6dc"; g.fillRect(cx - 11, 22, 7, 2); g.fillRect(cx + 4, 22, 7, 2);
      g.fillStyle = f.eyes || "#3a2618"; g.fillRect(cx - 9, 21, 3, 3); g.fillRect(cx + 6, 21, 3, 3);
      g.fillStyle = "#0b0807"; g.fillRect(cx - 8, 22, 1, 2); g.fillRect(cx + 7, 22, 1, 2);
      g.fillStyle = "#ffffff"; g.fillRect(cx - 9, 21, 1, 1); g.fillRect(cx + 6, 21, 1, 1);
      g.fillStyle = "#120c0b"; g.fillRect(cx - 11, 21, 7, 1); g.fillRect(cx + 4, 21, 7, 1);
      if (f.lashes) { g.fillRect(cx - 12, 20, 2, 2); g.fillRect(cx + 10, 20, 2, 2); }
      if (f.eyeGlow) { g.fillStyle = f.eyeGlow; g.fillRect(cx - 10, 22, 5, 2); g.fillRect(cx + 5, 22, 5, 2); g.fillStyle = "#ffffff"; g.fillRect(cx - 8, 22, 1, 1); g.fillRect(cx + 7, 22, 1, 1); }
      // Nose: the bridge lit, the underside and nostrils dark.
      g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(cx + 1, 21, 1, 5); g.fillRect(cx - 3, 26, 6, 2);
      g.fillStyle = "rgba(0,0,0,0.4)"; g.fillRect(cx - 2, 27, 1, 1); g.fillRect(cx + 1, 27, 1, 1);
      // Mouth: lip line, lower lip lit, a chin shadow.
      g.fillStyle = f.lips || "rgba(70,30,24,0.85)"; g.fillRect(cx - 4, 30, 8, 1);
      if (f.lips) { g.fillRect(cx - 3, 29, 6, 1); g.fillRect(cx - 3, 31, 6, 1); }
      g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(cx - 3, 32, 6, 1);
      g.fillStyle = "rgba(0,0,0,0.15)"; g.fillRect(cx - 5, 34, 10, 2);
      if (f.stubble) { g.fillStyle = "rgba(20,14,12,0.38)"; g.fillRect(cx - 14, 28, 28, 14); g.fillStyle = f.lips || "rgba(70,30,24,0.85)"; g.fillRect(cx - 4, 30, 8, 1); }
      if (f.beard) {
        g.fillStyle = f.beard; g.fillRect(cx - 15, 28, 30, 20); g.fillRect(cx - 17, 22, 3, 14); g.fillRect(cx + 14, 22, 3, 14); g.fillRect(cx - 6, 27, 12, 2);
        g.fillStyle = f.skin; g.fillRect(cx - 4, 29, 8, 3);
        g.fillStyle = f.lips || "#5a2e24"; g.fillRect(cx - 4, 30, 8, 1);
        const r = rng(67); for (let i = 0; i < 30; i++) { g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(cx - 15 + Math.floor(r() * 30), 30 + Math.floor(r() * 18), 1, 2); }
      }
    });
  }

  // ---------- Geometry helpers ----------
  // A lathe solid along the bone: radii from the top (y = 0) down to y = -len, revolved with `seg` sides.
  function latheGeo(len, radii, seg, up) {
    const pts = [], n = radii.length;
    pts.push(new THREE.Vector2(0.0005, up ? len : -len));
    for (let i = n - 1; i >= 0; i--) { const y = -len * (i / (n - 1)); pts.push(new THREE.Vector2(Math.max(0.001, radii[i]), up ? -y : y)); }
    pts.push(new THREE.Vector2(0.0005, 0));
    if (up) pts.reverse();
    return new THREE.LatheGeometry(pts, seg || 6); // v runs from the bottom (0) to the top (1): canvas top row is up
  }
  function lathe(len, radii, color, o) {
    o = o || {};
    const m = new THREE.Mesh(latheGeo(len, radii, o.seg || 6, o.up), mat(color, o));
    m.scale.set(o.sx || 1, 1, o.sz || 1);
    if (o.rot) m.rotation.y = o.rot;
    return m;
  }
  function box(w, h, d, color, o) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, o)); }
  function ball(r, color, o) { o = o || {}; const m = new THREE.Mesh(new THREE.SphereGeometry(r, o.ws || 7, o.hs || 5), mat(color, o)); if (o.s) m.scale.set(o.s[0], o.s[1], o.s[2]); return m; }
  function cone(r, h, color, o) { o = o || {}; return new THREE.Mesh(new THREE.ConeGeometry(r, h, o.seg || 5), mat(color, o)); }
  // A wedge (a box whose far end narrows), along +x from 0 to len.
  function wedge(len, h0, w0, h1, w1, color, o) {
    const g = new THREE.BoxGeometry(len, 1, 1); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), far = x > 0, h = far ? h1 : h0, w = far ? w1 : w0;
      p.setXYZ(i, x + len / 2, p.getY(i) * h, p.getZ(i) * w);
    }
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat(color, o));
  }
  function on(parent, mesh, pos, rot) {
    if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
    if (rot) mesh.rotation.set(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG);
    parent.add(mesh); return mesh;
  }

  // ---------- Strands: hair, braids, capes, sashes ----------
  // A verlet chain hanging from a point on a bone. kind: "tube" (hair, braids) or "ribbon" (cloth, flat across
  // the body's sideways axis). Collides with a few body spheres so it never sinks into the torso.
  class Strand {
    constructor(bone, offset, o) {
      this.bone = bone; this.offset = V3(offset[0], offset[1], offset[2]);
      this.n = o.n || 6; this.seg = o.seg || 0.08; this.o = o;
      this.p = []; this.q = [];
      for (let i = 0; i < this.n; i++) { this.p.push(V3(0, 0, 0)); this.q.push(V3(0, 0, 0)); }
      this.ready = false;
      this.group = new THREE.Group();
      if (o.kind === "ribbon") {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(this.n * 2 * 3), uv = new Float32Array(this.n * 2 * 2), idx = [];
        for (let i = 0; i < this.n; i++) { uv.set([0, 1 - i / (this.n - 1), 1, 1 - i / (this.n - 1)], i * 4); if (i) idx.push((i - 1) * 2, (i - 1) * 2 + 1, i * 2, (i - 1) * 2 + 1, i * 2 + 1, i * 2); }
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
        this.mesh = new THREE.Mesh(geo, mat(o.color, { double: true, map: o.map || null, alphaTest: o.map ? 0.5 : 0, tex: o.tex || "cloth" }));
        this.mesh.frustumCulled = false;
        this.group.add(this.mesh);
      } else {
        this.parts = [];
        for (let i = 1; i < this.n; i++) {
          const r0 = T3.lerp(o.r0 || 0.03, o.r1 || 0.012, (i - 1) / (this.n - 1)), r1 = T3.lerp(o.r0 || 0.03, o.r1 || 0.012, i / (this.n - 1));
          const g = new THREE.CylinderGeometry(r1, r0, 1, o.sides || 5); g.translate(0, 0.5, 0);
          const m = new THREE.Mesh(g, mat(i % 2 && o.color2 ? o.color2 : o.color, { tex: o.tex || "hair" }));
          m.frustumCulled = false; m.visible = false; // shown on the first draw
          this.parts.push(m); this.group.add(m);
        }
      }
    }
    anchor(out) { return this.bone.localToWorld(out.copy(this.offset)); }
    reset() {
      const a = this.anchor(V3());
      const down = V3(0, -1, 0);
      for (let i = 0; i < this.n; i++) { this.p[i].copy(a).addScaledVector(down, i * this.seg); this.q[i].copy(this.p[i]); }
      this.ready = true;
    }
    step(dt, colliders, wind, rootQ) {
      if (!this.ready) this.reset();
      const o = this.o, g = o.gravity !== undefined ? o.gravity : 9, damp = o.damp || 0.92;
      this.anchor(this.p[0]);
      // Stiffness: each point leans toward the direction the strand left its anchor (bone's local -y by default).
      const dir = V3(0, -1, 0);
      if (o.dir) dir.set(o.dir[0], o.dir[1], o.dir[2]);
      dir.applyQuaternion(this.bone.getWorldQuaternion(new THREE.Quaternion())).normalize();
      for (let i = 1; i < this.n; i++) {
        const p = this.p[i], q = this.q[i];
        const vx = (p.x - q.x) * damp, vy = (p.y - q.y) * damp, vz = (p.z - q.z) * damp;
        q.copy(p);
        p.x += vx + (wind ? wind.x : 0) * dt * dt;
        p.y += vy - g * dt * dt;
        p.z += vz + (wind ? wind.z : 0) * dt * dt;
        if (o.stiff) { const target = this.p[i - 1].clone().addScaledVector(dir, this.seg); p.lerp(target, o.stiff); }
      }
      for (let it = 0; it < 3; it++) {
        for (let i = 1; i < this.n; i++) {
          const a = this.p[i - 1], b = this.p[i], d = b.clone().sub(a), L = d.length() || 1e-6;
          b.copy(a).addScaledVector(d, this.seg / L);
        }
        for (const c of colliders) for (let i = 1; i < this.n; i++) {
          const p = this.p[i], d = p.clone().sub(c.p), L = d.length();
          if (L < c.r) p.copy(c.p).addScaledVector(d, c.r / (L || 1e-6));
        }
        for (let i = 1; i < this.n; i++) if (this.p[i].y < 0.01) this.p[i].y = 0.01;
      }
      this.draw(rootQ);
    }
    draw(rootQ) {
      const o = this.o;
      if (this.mesh) {
        // Ribbon: width across the body's sideways axis (its local z), so a cape lies flat across the back.
        const side = V3(0, 0, 1).applyQuaternion(rootQ);
        const pos = this.mesh.geometry.attributes.position;
        for (let i = 0; i < this.n; i++) {
          const w = T3.lerp(o.w0 || 0.1, o.w1 || 0.1, i / (this.n - 1)) / 2, p = this.p[i];
          pos.setXYZ(i * 2, p.x - side.x * w, p.y - side.y * w, p.z - side.z * w);
          pos.setXYZ(i * 2 + 1, p.x + side.x * w, p.y + side.y * w, p.z + side.z * w);
        }
        pos.needsUpdate = true; this.mesh.geometry.computeVertexNormals(); this.mesh.geometry.computeBoundingSphere();
        return;
      }
      const up = V3(0, 1, 0);
      for (let i = 1; i < this.n; i++) {
        const a = this.p[i - 1], b = this.p[i], m = this.parts[i - 1], d = b.clone().sub(a), L = d.length() || 1e-6;
        m.position.copy(a); m.scale.set(1, L, 1); m.visible = true;
        m.quaternion.setFromUnitVectors(up, d.divideScalar(L));
      }
    }
  }

  // ---------- Flames (Nova): flickering low-poly tongues, additive ----------
  function flameCluster(scale) {
    const g = new THREE.Group(); g.userData.tongues = [];
    const cols = [0x3a5cff, 0x5e7dff, 0x9fb8ff, 0x6f4dff, 0x4a6bff];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry((i < 6 ? 0.05 : 0.03) * scale, (i < 6 ? 0.22 : 0.3) * scale, 4), mat(cols[i % cols.length], { glow: true, add: true, opacity: i < 6 ? 0.75 : 0.55 }));
      const a = i * 2.4;
      m.position.set(Math.cos(a) * 0.03 * scale, 0.06 * scale, Math.sin(a) * 0.03 * scale);
      m.userData.ph = i * 1.37; g.add(m); g.userData.tongues.push(m);
    }
    const core = ball(0.055 * scale, 0xcfe0ff, { glow: true, add: true, opacity: 0.8, ws: 6, hs: 4 }); g.add(core);
    g.userData.core = core;
    return g;
  }
  function stepFlames(g, t, k) {
    for (const m of g.userData.tongues) {
      const ph = t * 11 + m.userData.ph, s = (0.65 + 0.35 * Math.sin(ph)) * (0.5 + 1.1 * k);
      m.scale.set(0.8 + 0.3 * Math.sin(ph * 1.7), s * (1 + 0.4 * Math.sin(ph * 0.7)), 0.8 + 0.3 * Math.cos(ph * 1.3));
      m.position.y = 0.06 + 0.04 * Math.sin(ph * 1.1) + 0.05 * k;
      m.rotation.z = 0.35 * Math.sin(ph * 0.9); m.rotation.x = 0.35 * Math.cos(ph * 0.8);
    }
    if (g.userData.core) g.userData.core.scale.setScalar(0.7 + 0.8 * k + 0.1 * Math.sin(t * 23));
  }
  // Nova's spell orb: a white-hot core in a shell of blue fire, with a ring that turns.
  function orbMesh(r) {
    const g = new THREE.Group();
    g.add(ball(r * 0.55, 0xeaf2ff, { glow: true, add: true, ws: 8, hs: 6 }));
    g.add(ball(r, 0x4a6bff, { glow: true, add: true, opacity: 0.55, ws: 8, hs: 6 }));
    const fl = flameCluster(r * 9); fl.position.y = -r * 0.4; g.add(fl); g.userData.flames = fl;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.6, r * 0.12, 4, 12), mat(0x9fb8ff, { glow: true, add: true, opacity: 0.7 }));
    g.add(ring); g.userData.ring = ring;
    return g;
  }

  // ---------- The body ----------
  // Arms, legs and torso as stacks of lathe layers, like sleeves and gloves over skin. A layer:
  // [t0, t1, r0, r1, color, options] along the bone (t from 0 at the joint to 1 at the next joint). options.tex picks
  // the painted detail (cloth by default for layers).
  const CHUNK = 1.22; // the late 90s arcade build: thicker limbs than life
  function limbLayers(bone, len, layers) {
    for (let [t0, t1, r0, r1, color, o] of layers) {
      r0 *= CHUNK; r1 *= CHUNK;
      o = Object.assign({ tex: "cloth" }, o || {});
      const m = lathe(len * (t1 - t0), [r0, (r0 + r1) / 2 * (o.bulge || 1.06), r1], color, o);
      m.position.y = -len * t0; bone.add(m);
    }
  }
  // Fist and open hand (both built, one shown). size: the hand length. o.tex: glove leather, skin, metal.
  function hands(bone, size, color, o) {
    o = o || {};
    const t = { tex: o.tex || "leather" };
    const fist = new THREE.Group();
    on(fist, box(size * 0.82, size * 0.95, size * 0.72, color, t), [size * 0.06, -size * 0.5, 0]);
    on(fist, box(size * 0.3, size * 0.5, size * 0.3, color, t), [size * 0.4, -size * 0.38, o.side * size * 0.3]);
    // Finger lines across the front of the fist.
    for (let i = 0; i < 3; i++) on(fist, box(size * 0.05, size * 0.02, size * 0.74, 0x000000, { tex: false }), [size * 0.47, -size * (0.55 + i * 0.13), 0]);
    if (o.knuckle) on(fist, box(size * 0.86, size * 0.25, size * 0.76, o.knuckle, { tex: o.knuckleTex || "metal" }), [size * 0.06, -size * 0.85, 0]);
    if (o.cuff) on(fist, lathe(size * 0.4, [size * 0.48, size * 0.5], o.cuff, { seg: 6, tex: o.cuffTex || "leather" }), [0, 0.01, 0]);
    const open = new THREE.Group();
    on(open, box(size * 0.36, size * 0.75, size * 0.8, color, t), [0, -size * 0.4, 0]);
    // Four fingers, a little spread, and the thumb.
    for (let i = 0; i < 4; i++) on(open, box(size * 0.26, size * 0.55, size * 0.17, color, t), [0, -size * 1.02, (i - 1.5) * size * 0.2], [(i - 1.5) * 4, 0, 0]);
    on(open, box(size * 0.28, size * 0.5, size * 0.26, color, t), [size * 0.2, -size * 0.35, o.side * size * 0.42], [0, 0, -30]);
    if (o.cuff) on(open, lathe(size * 0.4, [size * 0.48, size * 0.5], o.cuff, { seg: 6, tex: o.cuffTex || "leather" }), [0, 0.01, 0]);
    bone.add(fist); bone.add(open); open.visible = false;
    return { fist, open };
  }
  // A foot or boot: a wedge from the heel to the toe, sole at the floor, laces or straps on top.
  function foot(bone, B, color, o) {
    o = o || {};
    const L = B.foot * (o.k || 1), h = B.ankle + 0.03, w = o.w || 0.11;
    const m = wedge(L, h, w, h * 0.55, w * 0.92, color, { tex: o.tex || "leather" });
    m.position.set(-0.06, -B.ankle + h / 2 - 0.005, 0); bone.add(m);
    if (o.sole) { const s = wedge(L + 0.01, 0.025, w + 0.01, 0.025, w * 0.95, o.sole, { tex: "rubber" }); s.position.set(-0.065, -B.ankle + 0.008, 0); bone.add(s); }
    if (o.cuff) on(bone, lathe(0.09, [w * 0.62, w * 0.6], o.cuff, { seg: 7, tex: o.cuffTex || "leather" }), [0, 0.07, 0]);
    if (o.laces) for (let i = 0; i < 3; i++) on(bone, box(0.012, 0.012, w * 0.6, o.laces, { tex: false }), [0.03 + i * 0.035, -B.ankle + h - 0.01 - i * 0.008, 0]);
    if (o.toes) for (let i = 0; i < 4; i++) on(bone, box(0.03, 0.02, 0.022, o.toes, { tex: "skin" }), [-0.06 + L - 0.005, -B.ankle + 0.012, (i - 1.5) * 0.024]);
    return m;
  }
  // Torso: pelvis, belly and ribcage, each an elliptical lathe (depth sx, width sz across the shoulders).
  // t.tex: detail kinds { pel, belly, chest, neck, cap } (cloth by default).
  function torso(bones, B, t) {
    const tx = Object.assign({ pel: "cloth", belly: "cloth", chest: "cloth", neck: "skin", cap: "cloth" }, t.tex || {});
    const pel = lathe(0.2, [t.hip * 0.82, t.hip * 1.02, t.hip * 0.96], t.pelvis, { up: true, seg: 8, sx: t.depth * 0.95, sz: 1, tex: tx.pel });
    pel.position.y = -0.12; bones.hips.add(pel);
    const belly = lathe(B.spine + 0.04, [t.hip * 0.94, t.waist, t.waist * 1.04], t.belly, { up: true, seg: 8, sx: t.depth * 0.92, sz: 1, tex: tx.belly });
    belly.position.y = -0.02; bones.spine.add(belly);
    const rib = lathe(B.chest, [t.waist * 1.02, t.chest, t.chest * 1.04, t.shoulder], t.chestColor, { up: true, seg: 8, sx: t.depth, sz: 1, tex: tx.chest });
    bones.chest.add(rib);
    if (t.bust) for (const z of [-1, 1]) on(bones.chest, ball(t.bust, t.bustColor || t.chestColor, { ws: 6, hs: 4, s: [1, 0.85, 1], tex: tx.chest }), [t.chest * t.depth * 0.78, B.chest * 0.5, z * t.bust * 0.95]);
    if (t.pecs) for (const z of [-1, 1]) on(bones.chest, box(0.05, 0.09, 0.13, t.pecColor || t.chestColor, { tex: tx.chest }), [t.chest * t.depth * 0.86, B.chest * 0.6, z * 0.07]);
    // Shoulder caps so the arms join the torso cleanly.
    for (const z of [-1, 1]) on(bones.chest, ball(t.capR || 0.07, t.capColor || t.chestColor, { ws: 6, hs: 4, tex: tx.cap }), [0, B.chest - 0.04, z * B.shW]);
    const neck = lathe(B.neck + 0.03, [t.neckR, t.neckR * 1.08], t.neckColor, { up: true, seg: 6, tex: tx.neck });
    neck.position.y = -0.03; bones.neck.add(neck);
    return { pel, belly, rib };
  }
  // Head: a faceted ball with the face painted on, a jaw block and a nose. Hair and headgear are extras.
  function head(bones, B, h) {
    const R = B.headR, g = new THREE.Group(); g.position.y = R * 0.85; bones.head.add(g);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(R, 10, 8), mat(0xffffff, { map: faceTex(h), tex: "skin" }));
    skull.scale.set(h.fem ? 0.98 : 1.04, 1.1, h.fem ? 0.86 : 0.92); g.add(skull);
    const sk = { tex: "skin" };
    if (!h.faceless) {
      on(g, wedge(0.035, 0.035, 0.022, 0.012, 0.016, h.skin, sk), [R * 0.86, -R * 0.12, 0]);
      const jaw = box(R * (h.fem ? 0.9 : 1.1), R * 0.4, R * (h.fem ? 1.25 : 1.55), h.skin, sk); jaw.position.set(R * 0.26, -R * 0.78, 0); g.add(jaw);
      if (h.beard) { const b = box(R * 1.12, R * 0.5, R * 1.62, h.beard, { tex: "hair" }); b.position.set(R * 0.3, -R * 0.86, 0); g.add(b); }
    } else {
      const jaw = box(R * 0.9, R * 0.4, R * 1.2, h.skin, sk); jaw.position.set(R * 0.3, -R * 0.7, 0); g.add(jaw);
    }
    if (h.ears !== false) for (const z of [-1, 1]) on(g, box(0.02, 0.045, 0.02, h.skin, sk), [-R * 0.05, -R * 0.1, z * R * 0.86]);
    return g;
  }
  // Hair cap and spikes (shared by several heads).
  function hairCap(hg, B, color, sy) { const c = ball(B.headR * 1.07, color, { ws: 8, hs: 5, tex: "hair" }); c.scale.set(1.04, sy || 0.66, 0.98); c.position.set(-0.03, B.headR * 0.62, 0); hg.add(c); return c; }

  // ---------- Weapons (along the hand's +x) ----------
  // userData: tip, base and butt points (the hit segment runs from the hand to the tip).
  const WEAPONS = {
    // Iron Vanguard's cyber sword: a wrapped black grip, orange glow rings, a broad steel blade with a glowing core.
    cyberSword(w) {
      on(w, box(0.045, 0.045, 0.045, 0xd2742a, { tex: "metal" }), [-0.12, 0, 0]);
      on(w, lathe(0.22, [0.022, 0.024, 0.022], 0x1d1c22, { seg: 6, tex: "leather" }), [-0.1, 0, 0], [0, 0, 90]);
      on(w, box(0.012, 0.05, 0.05, 0xff9b3d, { glow: true }), [-0.085, 0, 0]);
      on(w, box(0.04, 0.07, 0.2, 0x2a2b33, { tex: "armor" }), [0.115, 0, 0]);
      on(w, box(0.045, 0.02, 0.21, 0xff9b3d, { glow: true }), [0.115, 0.03, 0]);
      const blade = wedge(0.98, 0.1, 0.02, 0.06, 0.012, 0xc9ced8, { tex: "metal" }); blade.position.x = 0.13; w.add(blade);
      const tipM = wedge(0.13, 0.06, 0.012, 0.004, 0.004, 0xd9dde5, { tex: "metal" }); tipM.position.x = 1.11; w.add(tipM);
      const core = wedge(0.7, 0.016, 0.024, 0.008, 0.022, 0xff9b3d, { glow: true }); core.position.set(0.16, 0.0, 0); w.add(core);
      const edge = wedge(0.98, 0.008, 0.022, 0.006, 0.014, 0xffffff, { glow: true }); edge.position.set(0.13, 0.048, 0); w.add(edge);
      w.userData.tip = V3(1.2, 0, 0); w.userData.base = V3(0.2, 0, 0); w.userData.butt = V3(-0.13, 0, 0); w.userData.trail = 0xffa040;
    },
    // Blue X's aluminum bat: rusty silver barrel with the blue X, taped black grip, a knob.
    bat(w) {
      const T = textures();
      const g = latheGeo(0.86, [0.026, 0.028, 0.033, 0.049, 0.057, 0.055], 8); g.rotateZ(Math.PI / 2);
      const m = new THREE.Mesh(g, mat(0xffffff, { map: T.bat, tex: "metal" })); m.position.x = -0.1; w.add(m);
      on(w, lathe(0.22, [0.03, 0.031, 0.029], 0x22242a, { seg: 7, tex: "rubber" }), [-0.1, 0, 0], [0, 0, 90]);
      on(w, lathe(0.03, [0.042, 0.04], 0x22242a, { seg: 7, tex: "rubber" }), [-0.12, 0, 0], [0, 0, 90]);
      on(w, lathe(0.012, [0.058, 0.058], 0x9aa0aa, { seg: 8, tex: "metal" }), [0.76, 0, 0], [0, 0, 90]);
      w.userData.tip = V3(0.76, 0, 0); w.userData.base = V3(0.3, 0, 0); w.userData.butt = V3(-0.14, 0, 0); w.userData.trail = 0x9fc0ff;
    },
    // Voss's staff: a long wooden pole, steel ferrules, blue cross wraps, the white pompom and ribbons.
    staff(w) {
      on(w, lathe(1.86, [0.023, 0.023, 0.023], 0x6b4a2e, { seg: 6, tex: "wood" }), [-0.73, 0, 0], [0, 0, 90]);
      for (const x of [-0.6, -0.45, 0.85, 0.7]) on(w, box(0.06, 0.05, 0.05, 0x2f5fc4, { tex: "cloth" }), [x, 0, 0], [45, 0, 0]);
      for (const [x, l] of [[-0.74, 0.12], [1.0, 0.14]]) on(w, lathe(l, [0.03, 0.034, 0.03], 0xc5cad3, { seg: 6, tex: "metal" }), [x, 0, 0], [0, 0, 90]);
      for (const x of [-0.78, 1.15]) on(w, ball(0.04, 0xc5cad3, { ws: 6, hs: 4, tex: "metal" }), [x, 0, 0]);
      on(w, ball(0.075, 0xf2f2f2, { ws: 6, hs: 5, tex: "fur" }), [1.2, 0.02, 0]);
      w.userData.tip = V3(1.16, 0, 0); w.userData.base = V3(0.6, 0, 0); w.userData.butt = V3(-0.76, 0, 0); w.userData.trail = 0x8fb4ff;
    },
    // Frostjaw's greataxe: a leather-wrapped haft with gold bands, a big dark steel crescent with a jagged ice edge.
    axe(w) {
      on(w, lathe(1.34, [0.03, 0.031, 0.029], 0x3b2a20, { seg: 6, tex: "wood" }), [-0.26, 0, 0], [0, 0, 90]);
      for (const [x, l] of [[-0.24, 0.16], [0.24, 0.12]]) on(w, lathe(l, [0.036, 0.036], 0x5a3e2a, { seg: 6, tex: "leather" }), [x, 0, 0], [0, 0, 90]);
      for (const x of [-0.18, 0.1, 0.95]) on(w, box(0.05, 0.075, 0.075, 0xb38a3a, { tex: "gold" }), [x, 0, 0]);
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.lineTo(0.06, 0.1); shape.quadraticCurveTo(0.2, 0.32, -0.12, 0.42); shape.lineTo(-0.1, 0.34);
      shape.quadraticCurveTo(0.08, 0.26, -0.06, 0.1); shape.lineTo(-0.1, 0.0); shape.lineTo(0, 0);
      const hg = new THREE.ExtrudeGeometry(shape, { depth: 0.034, bevelEnabled: false, curveSegments: 3 }); hg.translate(0, 0, -0.017);
      const headM = new THREE.Mesh(hg, mat(0x2a3140, { tex: "armor" })); headM.scale.set(1.3, 1.3, 1); headM.position.set(0.98, 0.02, 0); headM.rotation.z = -0.35; w.add(headM);
      const edge = new THREE.Mesh(hg, mat(0x8fdcff, { glow: true })); edge.scale.set(1.38, 1.38, 0.5); edge.position.set(1.0, 0.05, 0); edge.rotation.z = -0.35; w.add(edge);
      // Ice crystals along the edge and a back spike.
      for (const [x, y, a, s] of [[1.12, 0.46, 20, 1], [1.24, 0.3, -10, 0.8], [1.18, 0.16, -40, 0.7]]) on(w, cone(0.025 * s, 0.12 * s, 0xbff0ff, { glow: true, seg: 4 }), [x, y, 0], [0, 0, a - 60]);
      on(w, cone(0.035, 0.18, 0x8fdcff, { glow: true, seg: 4 }), [1.08, -0.08, 0], [0, 0, 180]);
      w.userData.tip = V3(1.2, 0.38, 0); w.userData.base = V3(0.8, 0.1, 0); w.userData.butt = V3(-0.27, 0, 0); w.userData.trail = 0x8fdcff;
    },
  };

  // ---------- The six characters ----------
  // Each: name, gender, body (overrides of T3.BODY), weapon draw, build(bones, B, rig) for meshes, strands.
  const DEFS = {};

  DEFS.cyborg = { color: 0xffa040, name: "IRON VANGUARD", title: "Cyborg swordsman", gender: "M", weapon: "cyberSword", style: "blade", fx: "spark",
    body: { th: 0.46, sh: 0.45, ua: 0.3, fa: 0.29, shW: 0.23, hipW: 0.115, chest: 0.29, spine: 0.14, headR: 0.112, hand: 0.11, foot: 0.28 },
    pal: { purple: 0x6d47b2, purpleD: 0x4a3080, red: 0xc8323a, black: 0x1b1a22, grey: 0xb8bec8, greyD: 0x5c626c, skin: 0xd59a72, glow: 0xff9b3d, belt: 0x6e5a3b, boot: 0x8e8478 },
    build(b, B, P, rig) {
      torso(b, B, { pelvis: P.black, belly: P.black, chestColor: P.purple, waist: 0.14, hip: 0.15, chest: 0.2, shoulder: 0.22, depth: 0.66, neckR: 0.055, neckColor: P.black, pecs: true, pecColor: P.purpleD, capColor: P.purple,
        tex: { pel: "cloth", belly: "rubber", chest: "armor", neck: "rubber", cap: "armor" } });
      // Chest plate trims (the red V), collar, the belt with pouches and a steel buckle.
      on(b.chest, box(0.04, 0.03, 0.3, P.red, { tex: "armor" }), [0.13, 0.27, 0]);
      for (const z of [-1, 1]) on(b.chest, box(0.03, 0.16, 0.025, P.red, { tex: "armor" }), [0.135, 0.17, z * 0.06], [z * 22, 0, 0]);
      on(b.chest, box(0.03, 0.05, 0.05, P.glow, { glow: true }), [0.142, 0.1, 0]);
      on(b.neck, lathe(0.06, [0.085, 0.08], P.red, { up: true, seg: 6, tex: "armor" }), [0, -0.02, 0]);
      on(b.hips, lathe(0.06, [0.15, 0.15], P.belt, { up: true, seg: 8, sx: 0.72, tex: "leather" }), [0, 0.0, 0]);
      for (const z of [-0.09, 0.09]) on(b.hips, box(0.06, 0.07, 0.06, 0x5b4a32, { tex: "leather" }), [0.11, -0.01, z]);
      on(b.hips, box(0.03, 0.05, 0.07, 0x9aa0a8, { tex: "metal" }), [0.115, 0.03, 0]);
      // Right arm: the silver cyber arm with orange glow lines and a glowing elbow joint. Left arm: red sleeve,
      // black glove.
      limbLayers(b.uaR, B.ua, [[0, 1, 0.055, 0.048, P.grey, { seg: 6, tex: "armor" }], [0.25, 0.45, 0.06, 0.058, P.greyD, { tex: "metal" }]]);
      limbLayers(b.faR, B.fa, [[0, 1, 0.05, 0.046, P.grey, { seg: 6, tex: "armor" }], [0.4, 0.6, 0.054, 0.052, P.greyD, { tex: "metal" }]]);
      on(b.uaR, box(0.012, B.ua * 0.8, 0.012, P.glow, { glow: true }), [0.05, -B.ua * 0.5, 0.02]);
      on(b.faR, box(0.012, B.fa * 0.8, 0.012, P.glow, { glow: true }), [0.045, -B.fa * 0.5, 0.02]);
      on(b.faR, box(0.012, B.fa * 0.5, 0.012, P.glow, { glow: true }), [0.0, -B.fa * 0.4, 0.055]);
      on(b.faR, new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 4, 8), mat(P.glow, { glow: true })), [0, 0.0, 0], [0, 90, 0]);
      on(b.uaR, ball(0.09, P.grey, { ws: 6, hs: 4, s: [1.1, 0.8, 1], tex: "armor" }), [0, 0.02, 0.01]);
      limbLayers(b.uaL, B.ua, [[0, 1, 0.056, 0.048, P.black], [0.0, 0.6, 0.06, 0.054, P.red, { tex: "armor" }]]);
      limbLayers(b.faL, B.fa, [[0, 1, 0.05, 0.045, P.red, { tex: "armor" }]]);
      on(b.uaL, ball(0.09, P.purple, { ws: 6, hs: 4, s: [1.1, 0.8, 1], tex: "armor" }), [0, 0.02, -0.01]);
      rig.hand.R = hands(b.hR, B.hand, P.grey, { side: 1, knuckle: P.greyD, tex: "metal" });
      rig.hand.L = hands(b.hL, B.hand, P.black, { side: -1 });
      for (const s of ["L", "R"]) {
        limbLayers(b["th" + s], B.th, [[0, 1, 0.085, 0.062, P.purple, { bulge: 1.1, tex: "armor" }], [0.85, 1, 0.065, 0.06, P.black, { tex: "rubber" }]]);
        limbLayers(b["sn" + s], B.sh, [[0, 1, 0.06, 0.048, P.purple, { tex: "armor" }], [0.02, 0.18, 0.07, 0.066, P.purpleD, { tex: "armor" }], [0.3, 0.92, 0.04, 0.036, P.red, { sx: 0.4, rot: 0.5, tex: "armor" }]]);
        on(b["th" + s], box(0.01, B.th * 0.55, 0.01, P.glow, { glow: true }), [0.07, -B.th * 0.45, 0]);
        on(b["sn" + s], new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 4, 8), mat(P.glow, { glow: true })), [0.03, -0.01, 0], [0, 90, 0]);
        foot(b["ft" + s], B, P.boot, { w: 0.12, sole: 0x55524c, cuff: P.greyD, cuffTex: "metal", tex: "armor" });
      }
      const hg = head(b, B, { skin: "#d59a72", hair: "#1c1a22", heavyBrow: true, stubble: true });
      // Spiky hair: a cap and a crest of spikes.
      hairCap(hg, B, P.black, 0.7);
      for (let i = 0; i < 7; i++) on(hg, cone(0.03, 0.08, 0x1c1a22, { seg: 4, tex: "hair" }), [0.06 - i * 0.025, B.headR * 0.95, (i % 2 ? 1 : -1) * 0.02], [i * 9 - 20, 0, 25 - i * 9]);
      rig.weapon("cyberSword");
    },
  };

  DEFS.bluex = { color: 0x6fa0ff, name: "BLUE X", title: "Baseball brawler", gender: "M", weapon: "bat", style: "bat", fx: "impact",
    body: { th: 0.46, sh: 0.44, ua: 0.3, fa: 0.28, shW: 0.22, hipW: 0.115, chest: 0.28, spine: 0.14, headR: 0.112, hand: 0.11, foot: 0.29 },
    pal: { blue: 0x2350d6, blueD: 0x173b9e, white: 0xe6e8ee, black: 0x17181c, skin: 0xa96a45, sock: 0x1f4fd1 },
    build(b, B, P, rig) {
      const T = textures();
      const tor = torso(b, B, { pelvis: 0xffffff, belly: P.blue, chestColor: P.blue, waist: 0.145, hip: 0.15, chest: 0.2, shoulder: 0.21, depth: 0.66, neckR: 0.055, neckColor: 0xa96a45, pecs: true, pecColor: P.blueD });
      tor.pel.material = mat(0xffffff, { map: T.pinstripe, tex: "cloth" });
      // Hood bunched around the neck with drawstrings, the X on the chest, jersey buttons, belt and wallet chain.
      on(b.chest, lathe(0.09, [0.12, 0.13, 0.1], P.black, { up: true, seg: 7, sx: 0.85, tex: "cloth" }), [-0.01, B.chest - 0.03, 0]);
      for (const z of [-0.025, 0.025]) on(b.chest, box(0.008, 0.07, 0.008, 0xe6e8ee, { tex: false }), [0.12, B.chest - 0.08, z]);
      for (const a of [40, -40]) on(b.chest, box(0.012, 0.09, 0.022, P.black), [0.125, 0.15, 0.05], [0, 0, a]);
      on(b.chest, box(0.012, 0.1, 0.014, P.white), [0.122, 0.12, -0.0]);
      for (let i = 0; i < 3; i++) on(b.chest, box(0.01, 0.012, 0.012, P.white, { tex: false }), [0.128, 0.06 + i * 0.06, -0.02]);
      on(b.hips, lathe(0.045, [0.142, 0.142], P.black, { up: true, seg: 8, sx: 0.74, tex: "leather" }), [0, 0.0, 0]);
      on(b.hips, box(0.02, 0.04, 0.05, 0x9aa0a8, { tex: "metal" }), [0.105, 0.02, 0]);
      for (const s of ["L", "R"]) {
        limbLayers(b["ua" + s], B.ua, [[0, 1, 0.056, 0.05, P.skin, { bulge: 1.15, tex: "skin" }], [0, 0.42, 0.075, 0.07, P.blue], [0.3, 0.38, 0.077, 0.075, P.white]]);
        limbLayers(b["fa" + s], B.fa, [[0, 1, 0.05, 0.044, P.skin, { bulge: 1.1, tex: "skin" }], [0.72, 1, 0.052, 0.05, P.black, { tex: "leather" }]]);
        rig.hand[s] = hands(b["h" + s], B.hand, P.black, { side: s === "L" ? -1 : 1, knuckle: P.blue, knuckleTex: "leather" });
        limbLayers(b["th" + s], B.th, [[0, 1, 0.095, 0.072, 0xffffff, { bulge: 1.1, map: T.pinstripe, tex: "cloth" }]]);
        limbLayers(b["sn" + s], B.sh, [[0, 0.45, 0.075, 0.065, 0xffffff, { map: T.pinstripe, tex: "cloth" }], [0.4, 1, 0.052, 0.042, P.sock]]);
        foot(b["ft" + s], B, P.white, { w: 0.12, sole: 0xf2f2f2, cuff: P.blue, laces: 0x1f3fbf });
        on(b["ft" + s], box(0.08, 0.03, 0.125, P.blue, { tex: "leather" }), [0.06, -B.ankle + 0.06, 0]);
      }
      // Thigh strap on the left leg.
      on(b.thL, lathe(0.04, [0.1, 0.1], P.black, { seg: 7, tex: "leather" }), [0, -B.th * 0.45, 0]);
      const hg = head(b, B, { skin: "#a96a45", hair: "#151210", beard: "#1a1412", heavyBrow: true, lips: "#5a2e24" });
      hairCap(hg, B, 0x151210, 0.62);
      for (let i = 0; i < 5; i++) on(hg, cone(0.025, 0.05, 0x151210, { seg: 4, tex: "hair" }), [0.04 - i * 0.03, B.headR * 0.88, (i % 2 ? 1 : -1) * 0.03], [i * 12 - 20, 0, 30 - i * 10]);
      rig.weapon("bat");
      rig.strand(b.hips, [0.1, -0.02, 0.06], { kind: "tube", n: 6, seg: 0.05, r0: 0.008, r1: 0.008, color: 0x9aa0a8, color2: 0x6c7078, gravity: 10, damp: 0.9 });
    },
  };

  DEFS.voss = { color: 0x9fc0ff, name: "COMMANDER VOSS", title: "Staff commander", gender: "F", weapon: "staff", style: "staff", fx: "wind",
    body: { th: 0.46, sh: 0.45, ua: 0.27, fa: 0.25, shW: 0.185, hipW: 0.11, chest: 0.25, spine: 0.13, headR: 0.104, hand: 0.1, foot: 0.26 },
    pal: { black: 0x1e2028, blackL: 0x2b2e38, blue: 0x2f5fc4, white: 0xd7dce6, skin: 0xc99470, hair: 0xd9dadf, belt: 0x4a3a2e },
    build(b, B, P, rig) {
      const T = textures();
      const tor = torso(b, B, { pelvis: P.black, belly: 0xffffff, chestColor: 0xffffff, waist: 0.11, hip: 0.15, chest: 0.155, shoulder: 0.165, depth: 0.68, neckR: 0.045, neckColor: P.black, bust: 0.058, bustColor: 0xffffff, capColor: 0xffffff,
        tex: { pel: "leather", neck: "rubber" } });
      tor.belly.material = mat(0xffffff, { map: T.quilt, tex: "cloth" });
      tor.rib.material = mat(0xffffff, { map: T.quilt, tex: "cloth" });
      for (const m of b.chest.children) if (m.geometry && m.geometry.type === "SphereGeometry") m.material = mat(0xffffff, { map: T.quilt, tex: "cloth" });
      // Shoulder plates in camo, a high collar, belts and pouches, a chest strap.
      on(b.neck, lathe(0.08, [0.07, 0.065], P.black, { up: true, seg: 6, tex: "armor" }), [0, -0.03, 0]);
      on(b.hips, lathe(0.045, [0.14, 0.14], P.belt, { up: true, seg: 8, sx: 0.74, tex: "leather" }), [0, 0.02, 0]);
      on(b.hips, box(0.02, 0.035, 0.05, 0x9aa0a8, { tex: "metal" }), [0.1, 0.04, 0]);
      for (const z of [-0.08, 0.08]) on(b.hips, box(0.055, 0.06, 0.05, 0x3a2e24, { tex: "leather" }), [0.1, -0.02, z]);
      for (const s of ["L", "R"]) {
        on(b["ua" + s], ball(0.085, 0xffffff, { ws: 6, hs: 4, s: [1.15, 0.85, 1.05], map: T.camo, tex: "armor" }), [0, 0.0, 0]);
        limbLayers(b["ua" + s], B.ua, [[0, 1, 0.047, 0.041, P.black, { tex: "leather" }]]);
        limbLayers(b["fa" + s], B.fa, [[0, 1, 0.043, 0.038, P.black, { tex: "leather" }], [0.15, 0.8, 0.052, 0.048, 0xffffff, { map: T.camo, tex: "armor" }]]);
        rig.hand[s] = hands(b["h" + s], B.hand, P.black, { side: s === "L" ? -1 : 1 });
        limbLayers(b["th" + s], B.th, [[0, 1, 0.088, 0.06, 0xffffff, { bulge: 1.12, map: T.quilt, tex: "cloth" }]]);
        on(b["th" + s], box(0.05, 0.07, 0.04, 0x3a2e24, { tex: "leather" }), [0.0, -B.th * 0.35, (s === "L" ? -1 : 1) * 0.08]);
        limbLayers(b["sn" + s], B.sh, [[0, 1, 0.055, 0.045, P.black, { tex: "leather" }], [0, 0.22, 0.068, 0.062, 0xffffff, { map: T.camo, tex: "armor" }], [0.6, 0.72, 0.06, 0.058, P.blue, { tex: "armor" }]]);
        foot(b["ft" + s], B, P.black, { w: 0.11, sole: 0x0b0c10, cuff: P.black, k: 1.05, laces: 0x3a3d47 });
      }
      const hg = head(b, B, { skin: "#c99470", hair: "#d9dadf", eyes: "#2b3550", lashes: true, lips: "#a5605a", fem: true });
      hairCap(hg, B, P.hair, 0.66);
      for (const z of [-1, 1]) on(hg, box(0.05, 0.12, 0.02, P.hair, { tex: "hair" }), [0.05, -0.01, z * B.headR * 0.86], [0, 0, -15]);
      rig.weapon("staff");
      rig.strand(b.head, [-B.headR * 0.85, B.headR * 1.55, 0], { kind: "tube", n: 7, seg: 0.07, r0: 0.04, r1: 0.012, color: P.hair, color2: 0xb7b9c2, gravity: 9, damp: 0.9, stiff: 0.08, dir: [-0.7, -0.7, 0] });
      rig.strand(b.wpn, [1.0, 0, 0.02], { kind: "ribbon", n: 5, seg: 0.06, w0: 0.03, w1: 0.02, color: P.blue, gravity: 7, damp: 0.9 });
    },
  };

  DEFS.barbarian = { color: 0x9fe6ff, name: "FROSTJAW", title: "Ice barbarian", gender: "M", weapon: "axe", style: "axe", heavy: true, fx: "ice",
    body: { th: 0.46, sh: 0.45, ua: 0.31, fa: 0.3, shW: 0.26, hipW: 0.125, chest: 0.31, spine: 0.15, headR: 0.118, hand: 0.125, foot: 0.3 },
    pal: { steel: 0x2b303a, steelL: 0x464e5c, gold: 0xc29a46, leather: 0x3b2a20, skin: 0xb07a52, fur: 0xe4e2da, cape: 0x1f4d9a, edge: 0x8fdcff, pants: 0x1f2633 },
    build(b, B, P, rig) {
      const T = textures();
      torso(b, B, { pelvis: P.leather, belly: P.steel, chestColor: P.steel, waist: 0.17, hip: 0.18, chest: 0.24, shoulder: 0.26, depth: 0.66, neckR: 0.07, neckColor: P.skin, pecs: true, pecColor: P.steelL, capColor: P.steel, capR: 0.09,
        tex: { pel: "leather", belly: "armor", chest: "armor", cap: "armor" } });
      // Gold-trimmed belt buckle, the leather loin flaps, crossed chest straps.
      on(b.hips, lathe(0.06, [0.165, 0.165], P.leather, { up: true, seg: 8, sx: 0.76, tex: "leather" }), [0, 0.0, 0]);
      on(b.hips, box(0.02, 0.07, 0.07, P.gold, { tex: "gold" }), [0.13, 0.03, 0]);
      on(b.hips, box(0.02, 0.22, 0.1, P.cape, { tex: "cloth" }), [0.12, -0.14, 0]);
      on(b.chest, box(0.02, 0.24, 0.03, P.gold, { tex: "gold" }), [0.15, 0.15, 0.04], [30, 0, 0]);
      on(b.chest, box(0.02, 0.24, 0.03, P.leather, { tex: "leather" }), [0.15, 0.15, -0.04], [-30, 0, 0]);
      on(b.chest, box(0.025, 0.05, 0.05, P.gold, { tex: "gold" }), [0.16, 0.15, 0], [45, 0, 0]);
      // The fur mantle: a ring of jagged white tufts over the shoulders and back.
      const mantle = new THREE.Group(); mantle.position.y = B.chest - 0.02; b.chest.add(mantle);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, rx = 0.17, rz = 0.27;
        if (Math.cos(a) > 0.75) continue;
        const c = cone(0.06, 0.2, 0xffffff, { seg: 4, map: T.fur, tex: "fur" }); c.position.set(Math.cos(a) * rx, -0.04 + (i % 2) * 0.03, Math.sin(a) * rz);
        c.rotation.set(Math.sin(a) * 2.2, 0, -Math.cos(a) * 2.2); mantle.add(c);
        const c2 = cone(0.05, 0.16, 0xffffff, { seg: 4, map: T.fur, tex: "fur" }); c2.position.set(Math.cos(a) * rx * 0.9, 0.04, Math.sin(a) * rz * 0.9); c2.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); mantle.add(c2);
      }
      for (const s of ["L", "R"]) {
        const sd = s === "L" ? -1 : 1;
        on(b["ua" + s], ball(0.11, P.steel, { ws: 6, hs: 4, s: [1.1, 0.8, 1.1], tex: "armor" }), [0, 0.01, 0]);
        on(b["ua" + s], cone(0.03, 0.1, P.gold, { seg: 4, tex: "gold" }), [0, 0.08, sd * 0.05], [sd * -30, 0, 0]);
        limbLayers(b["ua" + s], B.ua, [[0, 1, 0.07, 0.06, P.skin, { bulge: 1.18, seg: 7, tex: "skin" }]]);
        limbLayers(b["fa" + s], B.fa, [[0, 0.4, 0.062, 0.058, P.skin, { bulge: 1.12, tex: "skin" }], [0.35, 1, 0.068, 0.064, P.leather, { tex: "leather" }], [0.4, 0.5, 0.075, 0.072, P.gold, { tex: "gold" }], [0.85, 0.95, 0.072, 0.07, P.gold, { tex: "gold" }]]);
        rig.hand[s] = hands(b["h" + s], B.hand, P.skin, { side: sd, cuff: P.leather, tex: "skin" });
        limbLayers(b["th" + s], B.th, [[0, 1, 0.1, 0.075, P.pants, { bulge: 1.12, seg: 7, tex: "cloth" }]]);
        limbLayers(b["sn" + s], B.sh, [[0, 1, 0.07, 0.058, P.pants], [0.35, 1, 0.08, 0.072, P.steel, { tex: "armor" }], [0.3, 0.42, 0.095, 0.09, 0xffffff, { map: T.fur, tex: "fur" }]]);
        on(b["sn" + s], cone(0.06, 0.12, P.steel, { seg: 4, tex: "armor" }), [0.04, -0.04, 0], [0, 0, -90]);
        on(b["sn" + s], box(0.02, 0.05, 0.05, P.gold, { tex: "gold" }), [0.06, -0.05, 0]);
        foot(b["ft" + s], B, P.steel, { w: 0.13, sole: 0x111317, cuff: P.leather, k: 1.04, tex: "armor" });
      }
      // Helmet: a dark steel dome with a gold crest, cheek guards, a dark visor with glowing eyes, and horns.
      const hg = head(b, B, { skin: "#b07a52", hair: "#121216", ears: false });
      const dome = ball(B.headR * 1.18, P.steel, { ws: 8, hs: 6, tex: "armor" }); dome.scale.set(1.08, 1.1, 1.0); hg.add(dome);
      on(hg, box(0.05, 0.05, 0.16, 0x05070b, { tex: false }), [B.headR * 1.0, -0.005, 0]);
      for (const z of [-0.035, 0.035]) on(hg, box(0.012, 0.012, 0.02, P.edge, { glow: true }), [B.headR * 1.25, 0.0, z]);
      on(hg, wedge(0.06, 0.13, 0.03, 0.05, 0.02, P.gold, { tex: "gold" }), [B.headR * 0.95, 0.05, 0], [0, 0, 80]);
      for (const z of [-1, 1]) {
        on(hg, box(0.08, 0.1, 0.02, P.steelL, { tex: "armor" }), [B.headR * 0.7, -B.headR * 0.55, z * B.headR * 0.95]);
        on(hg, cone(0.035, 0.18, 0xd8d2c4, { seg: 5, tex: "plain" }), [-0.0, B.headR * 0.9, z * B.headR * 0.95], [z * -55, 0, 25]);
      }
      // Helmet plume / ponytail and the ragged cape.
      rig.strand(b.head, [-B.headR * 0.9, B.headR * 1.7, 0], { kind: "tube", n: 6, seg: 0.08, r0: 0.05, r1: 0.015, color: 0x161a22, color2: 0x263044, gravity: 8, damp: 0.9, stiff: 0.12, dir: [-0.8, -0.5, 0], sides: 4 });
      rig.strand(b.chest, [-0.14, B.chest - 0.02, 0], { kind: "ribbon", n: 7, seg: 0.13, w0: 0.5, w1: 0.62, color: 0xffffff, map: T.cape, gravity: 9, damp: 0.9, stiff: 0.05 });
      rig.weapon("axe");
    },
  };

  DEFS.flame = { color: 0x6a7dff, name: "NOVA", title: "Blue flame sorceress", gender: "F", weapon: null, style: "flame", fx: "fire",
    body: { th: 0.46, sh: 0.45, ua: 0.27, fa: 0.25, shW: 0.18, hipW: 0.11, chest: 0.25, spine: 0.13, headR: 0.104, hand: 0.105, foot: 0.27 },
    pal: { top: 0x16171d, jacket: 0x5b6878, jacketD: 0x3e4956, pants: 0x2a2c33, belt: 0x46515e, skin: 0x7a523f, hair: 0x1c1d24, flame: 0x5a8bff, tattoo: 0x8fc4ff },
    build(b, B, P, rig) {
      const T = textures();
      const tor = torso(b, B, { pelvis: 0xffffff, belly: P.skin, chestColor: P.top, waist: 0.105, hip: 0.15, chest: 0.15, shoulder: 0.16, depth: 0.68, neckR: 0.042, neckColor: P.skin, bust: 0.06, bustColor: P.top, capColor: P.jacket,
        tex: { belly: "skin", chest: "cloth", cap: "leather" } });
      tor.pel.material = mat(0xffffff, { map: T.denim, tex: "cloth" });
      // Cropped sleeveless jacket over the top, a choker, the belt with a steel buckle and a hanging chain.
      on(b.chest, lathe(B.chest * 0.75, [0.12, 0.145, 0.14], P.jacket, { up: true, seg: 8, sx: 0.78, tex: "leather" }), [-0.012, B.chest * 0.28, 0]);
      on(b.chest, box(0.03, B.chest * 0.6, 0.12, P.top, { tex: "cloth" }), [0.11, B.chest * 0.55, 0]);
      on(b.neck, lathe(0.02, [0.048, 0.048], 0x0c0c10, { up: true, seg: 6, tex: "leather" }), [0, 0.02, 0]);
      on(b.hips, lathe(0.04, [0.135, 0.135], P.belt, { up: true, seg: 8, sx: 0.74, tex: "leather" }), [0, 0.0, 0]);
      on(b.hips, box(0.02, 0.035, 0.06, 0x9aa0a8, { tex: "metal" }), [0.1, 0.02, 0]);
      rig.strand(b.hips, [0.08, -0.02, 0.08], { kind: "tube", n: 5, seg: 0.05, r0: 0.007, r1: 0.007, color: 0x9aa0a8, color2: 0x6c7078, gravity: 10, damp: 0.9 });
      for (const s of ["L", "R"]) {
        const sd = s === "L" ? -1 : 1;
        limbLayers(b["ua" + s], B.ua, [[0, 1, 0.044, 0.038, P.skin, { tex: "skin" }], [0, 0.35, 0.056, 0.05, P.jacketD, { tex: "leather" }]]);
        on(b["ua" + s], box(0.006, B.ua * 0.5, 0.006, P.tattoo, { glow: true }), [0.03, -B.ua * 0.6, sd * 0.03]);
        on(b["ua" + s], box(0.006, B.ua * 0.3, 0.006, P.tattoo, { glow: true }), [0.0, -B.ua * 0.7, sd * 0.045]);
        limbLayers(b["fa" + s], B.fa, [[0, 1, 0.04, 0.035, P.skin, { tex: "skin" }], [0.75, 1, 0.042, 0.04, P.top, { tex: "leather" }]]);
        on(b["fa" + s], box(0.006, B.fa * 0.5, 0.006, P.tattoo, { glow: true }), [0.03, -B.fa * 0.4, 0]);
        on(b["fa" + s], box(0.006, B.fa * 0.3, 0.006, P.tattoo, { glow: true }), [0.0, -B.fa * 0.5, sd * 0.04]);
        rig.hand[s] = hands(b["h" + s], B.hand, P.top, { side: sd, knuckle: 0x2a2e3a, knuckleTex: "leather" });
        // Baggy cargo pants, gathered at the boot.
        limbLayers(b["th" + s], B.th, [[0, 1, 0.09, 0.08, 0xffffff, { bulge: 1.12, seg: 7, map: T.denim, tex: "cloth" }]]);
        limbLayers(b["sn" + s], B.sh, [[0, 0.75, 0.082, 0.074, 0xffffff, { bulge: 1.1, seg: 7, map: T.denim, tex: "cloth" }], [0.7, 1, 0.06, 0.055, 0x1b1d22, { tex: "leather" }]]);
        on(b["th" + s], box(0.05, 0.08, 0.03, 0x24262c, { tex: "cloth" }), [0.0, -B.th * 0.55, sd * 0.085]);
        foot(b["ft" + s], B, 0x1b1d22, { w: 0.115, sole: 0x0b0c0f, cuff: 0x2a2c33, k: 1.04, laces: 0x6c7078 });
        const fl = flameCluster(1.3); fl.position.y = -B.hand * 0.5; b["h" + s].add(fl); rig.flames.push(fl);
      }
      const hg = head(b, B, { skin: "#7a523f", hair: "#1c1d24", eyes: "#c45cff", eyeGlow: "#c45cff", lashes: true, lips: "#3f2620", fem: true });
      hairCap(hg, B, P.hair, 0.66);
      for (const z of [-1, 1]) on(hg, new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 4, 8), mat(0xc9ccd3, { tex: "metal" })), [-0.0, -B.headR * 0.5, z * B.headR * 0.95], [0, 90, 0]);
      // Dreadlocks and the long braid.
      for (let i = 0; i < 5; i++) {
        const z = (i - 2) * 0.035;
        rig.strand(b.head, [-B.headR * 0.5, B.headR * 1.5, z], { kind: "tube", n: 5, seg: 0.065, r0: 0.016, r1: 0.01, color: P.hair, color2: 0x2a2c36, gravity: 9, damp: 0.88, stiff: 0.1, dir: [-0.5, -0.8, z * 4], sides: 4 });
      }
      rig.strand(b.head, [-B.headR * 0.9, B.headR * 0.9, 0], { kind: "tube", n: 8, seg: 0.07, r0: 0.03, r1: 0.016, color: P.hair, color2: 0x2f313c, gravity: 10, damp: 0.9, stiff: 0.05, sides: 5 });
      // The spell orb: a blue fire sphere that hovers by her raised hand (driven in update()).
      rig.orb = orbMesh(0.09); rig.orb.userData.k = 0;
    },
  };

  DEFS.dancer = { color: 0xffcf5a, name: "SUVARNA", title: "Golden four-arm dancer", gender: "F", weapon: null, style: "dance", fx: "gold",
    body: { th: 0.47, sh: 0.45, ua: 0.27, fa: 0.25, shW: 0.18, hipW: 0.11, chest: 0.25, spine: 0.13, headR: 0.102, hand: 0.105, foot: 0.26, arms4: true },
    pal: { skin: 0xc9824f, yellow: 0xf0bd45, yellowD: 0xd4952a, red: 0xd9472a, teal: 0x2aa59a, gold: 0xe8b23a, hair: 0x16121a },
    build(b, B, P, rig) {
      const T = textures();
      torso(b, B, { pelvis: P.yellow, belly: P.skin, chestColor: P.skin, waist: 0.105, hip: 0.155, chest: 0.15, shoulder: 0.16, depth: 0.68, neckR: 0.042, neckColor: P.skin, bust: 0.062, bustColor: P.yellow, capColor: P.skin,
        tex: { belly: "skin", chest: "skin", cap: "skin" } });
      on(b.chest, box(0.04, 0.03, 0.2, P.yellowD, { tex: "cloth" }), [0.085, B.chest * 0.35, 0]);
      // The red sash knotted at the hip.
      on(b.hips, lathe(0.08, [0.148, 0.145], P.red, { up: true, seg: 8, sx: 0.76, tex: "cloth" }), [0, -0.01, 0]);
      on(b.hips, ball(0.05, P.red, { ws: 5, hs: 4, tex: "cloth" }), [0.1, 0.03, 0.06]);
      for (const s of ["L", "R"]) {
        const sd = s === "L" ? -1 : 1;
        for (const [ua, fa, h] of [["ua", "fa", "h"], ["ub", "fb", "hb"]]) {
          const k = ua === "ub" ? 0.94 : 1;
          limbLayers(b[ua + s], B.ua * k, [[0, 1, 0.042, 0.036, P.skin, { tex: "skin" }], [0.25, 0.37, 0.046, 0.045, P.gold, { tex: "gold" }]]);
          limbLayers(b[fa + s], B.fa * k, [[0, 1, 0.037, 0.032, P.skin, { tex: "skin" }], [0.68, 0.96, 0.043, 0.042, P.gold, { tex: "gold" }]]);
          for (let i = 0; i < 3; i++) on(b[fa + s], lathe(0.012, [0.046, 0.046], 0xb8862a, { seg: 6, tex: "gold" }), [0, -B.fa * k * (0.72 + i * 0.08), 0]);
          const hh = hands(b[h + s], B.hand * 0.95, P.skin, { side: sd, tex: "skin" });
          if (ua === "ua") rig.hand[s] = hh; else rig.hand4[s] = hh;
          // Yellow drape tied at the upper arm.
          rig.strand(b[ua + s], [0.0, -B.ua * k * 0.32, sd * 0.04], { kind: "ribbon", n: 4, seg: 0.06, w0: 0.05, w1: 0.03, color: P.yellow, gravity: 6, damp: 0.88 });
        }
        // Harem pants: very full, gathered at gold anklets. Barefoot.
        limbLayers(b["th" + s], B.th, [[0, 1, 0.11, 0.1, P.yellow, { bulge: 1.15, seg: 7 }]]);
        limbLayers(b["sn" + s], B.sh, [[0, 0.62, 0.1, 0.07, P.yellow, { bulge: 1.12, seg: 7 }], [0.6, 1, 0.038, 0.034, P.skin, { tex: "skin" }], [0.62, 0.86, 0.045, 0.045, 0xb8862a, { tex: "gold" }]]);
        foot(b["ft" + s], B, P.skin, { w: 0.095, k: 0.95, toes: P.skin, tex: "skin" });
      }
      const hg = head(b, B, { skin: "#c9824f", hair: "#16121a", faceless: true, fem: true });
      hairCap(hg, B, P.hair, 0.7);
      on(hg, lathe(0.03, [0.03, 0.03], P.gold, { seg: 6, tex: "gold" }), [-B.headR * 0.55, B.headR * 1.25, 0], [0, 0, 50]);
      for (const z of [-1, 1]) on(hg, new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 4, 8), mat(P.gold, { tex: "gold" })), [-0.0, -B.headR * 0.55, z * B.headR * 0.95], [0, 90, 0]);
      // A high ponytail and long hair down the back.
      rig.strand(b.head, [-B.headR * 0.6, B.headR * 2.0, 0], { kind: "tube", n: 9, seg: 0.075, r0: 0.045, r1: 0.02, color: P.hair, color2: 0x231b26, gravity: 9, damp: 0.9, stiff: 0.06, sides: 5 });
      for (const z of [-0.05, 0.05]) rig.strand(b.head, [-B.headR * 0.9, B.headR * 1.2, z], { kind: "tube", n: 8, seg: 0.07, r0: 0.03, r1: 0.016, color: P.hair, color2: 0x231b26, gravity: 10, damp: 0.9, stiff: 0.06, sides: 4 });
      // Sash ends and the teal panel hanging in front.
      rig.strand(b.hips, [0.12, -0.04, 0], { kind: "ribbon", n: 6, seg: 0.09, w0: 0.11, w1: 0.1, color: 0xffffff, map: T.panel, gravity: 8, damp: 0.9, stiff: 0.08 });
      rig.strand(b.hips, [0.1, 0.0, 0.08], { kind: "ribbon", n: 6, seg: 0.09, w0: 0.06, w1: 0.04, color: P.red, gravity: 8, damp: 0.9 });
      rig.strand(b.hips, [0.06, 0.0, -0.11], { kind: "ribbon", n: 6, seg: 0.09, w0: 0.08, w1: 0.05, color: P.yellow, gravity: 8, damp: 0.9 });
    },
  };

  const ORDER = ["cyborg", "bluex", "voss", "barbarian", "flame", "dancer"];

  // Build a character: skeleton, meshes, strands. Returns a rig the fighter drives.
  function build(id) {
    const def = DEFS[id], B = T3.bodyOf(def.body), bones = T3.makeSkeleton(B);
    const rig = { id, def, B, bones, hand: {}, hand4: {}, strands: [], flames: [], weaponGroup: bones.wpn,
      weapon(name) { WEAPONS[name](bones.wpn); rig.weaponName = name; },
      strand(bone, off, o) { const s = new Strand(bone, off, o); rig.strands.push(s); return s; } };
    def.build(bones, B, def.pal, rig);
    // Blob shadow (the PS1 way).
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 10), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.004; rig.shadow = sh;
    rig.strandGroup = new THREE.Group();
    for (const s of rig.strands) rig.strandGroup.add(s.group);
    if (rig.orb) { rig.strandGroup.add(rig.orb); rig.orbV = V3(); rig.orbP = null; }
    // Real shadows: every solid part casts one (glow and additive parts do not).
    const cast = (o) => o.traverse((m) => { if (m.isMesh && !(m.material && m.material.isMeshBasicMaterial)) { m.castShadow = true; m.receiveShadow = true; } });
    cast(bones.root); cast(rig.strandGroup);
    rig.colliders = [{ bone: bones.chest, off: V3(0, B.chest * 0.45, 0), r: 0.17, p: V3() }, { bone: bones.hips, off: V3(0, -0.02, 0), r: 0.16, p: V3() }, { bone: bones.head, off: V3(0, B.headR * 0.85, 0), r: B.headR * 1.15, p: V3() }];
    for (const s of ["L", "R"]) rig.colliders.push({ bone: bones["th" + s], off: V3(0, -B.th * 0.4, 0), r: 0.1, p: V3() });
    return rig;
  }
  // Per-frame visuals: open or closed hands, flames, strands.
  function update(rig, pose, dt, t, wind) {
    const show = (h, open) => { if (!h) return; h.fist.visible = !open; h.open.visible = open; };
    show(rig.hand.L, pose.oL > 0.5); show(rig.hand.R, pose.oR > 0.5);
    show(rig.hand4.L, true); show(rig.hand4.R, true);
    for (const f of rig.flames) stepFlames(f, t, pose.fx);
    for (const c of rig.colliders) c.bone.localToWorld(c.p.copy(c.off));
    const rq = rig.bones.root.getWorldQuaternion(new THREE.Quaternion());
    if (dt > 0) for (const s of rig.strands) s.step(Math.min(dt, 1 / 60), rig.colliders, wind, rq);
    // The spell orb floats above the lead hand on a soft spring, swelling with the effect intensity.
    if (rig.orb) {
      const want = rig.bones.hL.localToWorld(V3(0.02, -rig.B.hand * 0.4, 0)); want.y += 0.17 + 0.02 * Math.sin(t * 3.1);
      if (!rig.orbP) rig.orbP = want.clone();
      if (dt > 0) {
        const k = 260, d = 22;
        rig.orbV.addScaledVector(want.clone().sub(rig.orbP), k * dt).multiplyScalar(Math.exp(-d * dt));
        rig.orbP.addScaledVector(rig.orbV, dt);
      }
      rig.orb.position.copy(rig.orbP);
      const s = 0.8 + 0.6 * pose.fx + 0.05 * Math.sin(t * 9);
      rig.orb.scale.setScalar(s);
      rig.orb.userData.ring.rotation.set(t * 2.3, t * 1.7, 0);
      stepFlames(rig.orb.userData.flames, t * 1.3, 0.4 + pose.fx);
    }
  }
  function resetStrands(rig) { for (const s of rig.strands) s.ready = false; rig.orbP = null; }

  return { DEFS, ORDER, WEAPONS, build, update, resetStrands, mat, box, ball, cone, lathe, wedge, canvasTex, textures, grain, shadeV, rng, flameCluster, stepFlames, orbMesh };
})();
