/* Clareira · ilustrações botânicas desenhadas em canvas.
   Cada peça sai em duas camadas (vaso e planta) para a planta poder balançar sozinha. */
(function (G) {
  'use strict';
  const W = 480, H = 560, BASE = 500;
  const C = {
    clay: '#b4673c', soil: '#4a3123', soilL: '#6b4a34',
    leafD: '#284f33', leaf: '#3f7444', leafL: '#6fa257', fresh: '#8cbf63', yellow: '#d8d07a', trunk: '#76563a'
  };

  function rng(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`;
  }
  function mix(a, b, t) {
    const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const x = p(a), y = p(b);
    return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
  }
  const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

  function layer(scale) {
    const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale;
    const g = c.getContext('2d'); g.scale(scale, scale); g.lineCap = 'round'; g.lineJoin = 'round';
    return { c, g };
  }

  function groundShadow(g, cx, y, w) {
    g.save(); g.translate(cx, y); g.scale(1, .14);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, w);
    gr.addColorStop(0, 'rgba(43,33,24,.30)'); gr.addColorStop(.6, 'rgba(43,33,24,.10)'); gr.addColorStop(1, 'rgba(43,33,24,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, w, 0, Math.PI * 2); g.fill(); g.restore();
  }

  /* vaso de barro torneado: corpo, frisos, borda e boca em elipse */
  function pot(g, { cx = W / 2, base = BASE, h = 150, top = 176, bot = 124, rimK = .2, ridges = 5, color = C.clay, empty = false, saucer = false }) {
    const R = top / 2, ry = top * .085, rimH = h * rimK, yTop = base - h, bodyTop = yTop + rimH;
    groundShadow(g, cx, base + 3, bot * 1.05);
    if (saucer) {
      g.fillStyle = shade(color, .78); g.beginPath(); g.ellipse(cx, base + 2, bot * .72, bot * .12, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = shade(color, .95); g.beginPath(); g.ellipse(cx, base - 4, bot * .7, bot * .1, 0, 0, Math.PI * 2); g.fill();
    }
    const side = (x0, x1) => { const gr = g.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, shade(color, .86)); gr.addColorStop(.22, shade(color, 1.13)); gr.addColorStop(.55, color); gr.addColorStop(1, shade(color, .66)); return gr; };
    const rb = R * .93, bb = bot / 2;
    g.beginPath();
    g.moveTo(cx - rb, bodyTop); g.lineTo(cx + rb, bodyTop);
    g.bezierCurveTo(cx + rb, bodyTop + (base - bodyTop) * .55, cx + bb + 4, base - 16, cx + bb, base - 4);
    g.ellipse(cx, base - 4, bb, bb * .14, 0, 0, Math.PI, false);
    g.bezierCurveTo(cx - bb - 4, base - 16, cx - rb, bodyTop + (base - bodyTop) * .55, cx - rb, bodyTop);
    g.closePath(); g.fillStyle = side(cx - rb, cx + rb); g.fill();
    g.save(); g.clip();
    for (let i = 0; i < ridges; i++) {
      const y = bodyTop + (base - bodyTop) * (i + .7) / (ridges + .4);
      g.strokeStyle = 'rgba(70,28,10,.13)'; g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(cx, y, rb + 4, ry * .7, 0, 0, Math.PI); g.stroke();
      g.strokeStyle = 'rgba(255,226,196,.12)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(cx, y + 2, rb + 4, ry * .7, 0, 0, Math.PI); g.stroke();
    }
    g.fillStyle = 'rgba(60,24,8,.16)'; g.fillRect(cx - R, bodyTop, top, 7);
    g.restore();
    /* borda */
    g.beginPath(); g.moveTo(cx - R, yTop);
    g.ellipse(cx, yTop, R, ry, 0, Math.PI, 0, true);
    g.lineTo(cx + R, bodyTop); g.ellipse(cx, bodyTop, R, ry, 0, 0, Math.PI, false); g.closePath();
    g.fillStyle = side(cx - R, cx + R); g.fill();
    g.fillStyle = shade(color, 1.08); g.beginPath(); g.ellipse(cx, yTop, R, ry, 0, 0, Math.PI * 2); g.fill();
    if (empty) {
      const gr = g.createLinearGradient(0, yTop - ry, 0, yTop + ry);
      gr.addColorStop(0, shade(color, .45)); gr.addColorStop(1, shade(color, .72));
      g.fillStyle = gr; g.beginPath(); g.ellipse(cx, yTop + 1, R * .87, ry * .78, 0, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = C.soil; g.beginPath(); g.ellipse(cx, yTop + 1, R * .87, ry * .78, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.ellipse(cx - R * .18, yTop - ry * .1, R * .5, ry * .3, 0, 0, Math.PI * 2); g.fill();
    }
    return { cx, y: yTop, R };
  }

  /* folhas: perfil de largura ao longo do comprimento */
  const PROFILE = {
    ovate: t => Math.sin(Math.PI * Math.pow(t, .78)),
    lance: t => Math.pow(Math.sin(Math.PI * Math.pow(t, .55)), 1.2),
    blade: t => (1 - Math.pow(t, 3.2)) * (.75 + .25 * Math.sin(Math.PI * Math.min(1, t * 1.6))),
    round: t => Math.sqrt(Math.max(0, Math.sin(Math.PI * t))),
    heart: t => Math.sin(Math.PI * Math.pow(.06 + .94 * t, .9)) * (1 - .1 * t),
    violin: t => Math.max(0, Math.sin(Math.PI * Math.pow(t, 1.25)) * (.72 + .4 * smooth(.25, .85, t)) - .1 * Math.exp(-Math.pow((t - .42) / .1, 2))),
    petal: t => Math.pow(Math.sin(Math.PI * Math.pow(t, .62)), .8)
  };
  function leafPath(g, L, Wd, shape, lobe) {
    const f = PROFILE[shape], N = 44;
    g.beginPath(); g.moveTo(0, 0);
    for (let i = 0; i <= N; i++) { const t = i / N; g.lineTo(-f(t) * Wd / 2, -t * L + lobe * Math.pow(1 - t, 7) * L); }
    for (let i = N; i >= 0; i--) { const t = i / N; g.lineTo(f(t) * Wd / 2, -t * L + lobe * Math.pow(1 - t, 7) * L); }
    g.closePath();
  }
  function leaf(g, x, y, ang, L, Wd, o = {}) {
    const { shape = 'ovate', c1 = C.leaf, c2 = C.leafD, vein = .22, veins = 0, lobe = 0, gloss = 0, rib = true } = o;
    g.save(); g.translate(x, y); g.rotate(ang);
    leafPath(g, L, Wd, shape, lobe);
    const gr = g.createLinearGradient(0, 0, 0, -L); gr.addColorStop(0, c2); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.fill();
    g.save(); g.clip();
    g.fillStyle = 'rgba(16,36,22,.16)'; g.fillRect(0, -L * 1.2, Wd, L * 1.6);
    if (gloss) { g.fillStyle = `rgba(255,255,255,${gloss})`; g.beginPath(); g.ellipse(-Wd * .14, -L * .55, Wd * .1, L * .26, -.15, 0, Math.PI * 2); g.fill(); }
    if (veins) {
      g.strokeStyle = `rgba(222,240,200,${vein * .7})`; g.lineWidth = Math.max(.8, Wd * .012);
      for (let i = 1; i <= veins; i++) {
        const t = i / (veins + 1);
        [-1, 1].forEach(s => { g.beginPath(); g.moveTo(0, -t * L); g.quadraticCurveTo(s * Wd * .2, -t * L - L * .05, s * Wd * .5, -t * L - L * .14); g.stroke(); });
      }
    }
    o.inside && o.inside(g, L, Wd);
    g.restore();
    if (rib) { g.strokeStyle = `rgba(226,242,206,${vein})`; g.lineWidth = Math.max(1, Wd * .022); g.beginPath(); g.moveTo(0, lobe * L * .6); g.quadraticCurveTo(Wd * .03, -L * .5, 0, -L * .94); g.stroke(); }
    g.restore();
  }
  function stem(g, pts, w, color) {
    g.strokeStyle = color; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0], pts[1]);
    if (pts.length === 6) g.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
    else g.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
    g.stroke();
  }
  const qpt = (p0, p1, p2, t) => [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
  const qtan = (p0, p1, p2, t) => Math.atan2(2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]), 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]));

  /* ---------------------------------------------------------------- plantas */
  const PLANTS = {
    monstera(g, r, s) {
      const n = 7, tmp = layer(1);
      const order = [...Array(n).keys()].sort((a, b) => Math.abs(b - 3) - Math.abs(a - 3));
      order.forEach(i => {
        const a = -.95 + 1.9 * i / (n - 1) + (r() - .5) * .14, len = 118 + (3 - Math.abs(i - 3)) * 26 + r() * 16;
        const bx = s.cx + (r() - .5) * 30, ex = bx + Math.sin(a) * len, ey = s.y - Math.cos(a) * len * .95;
        stem(g, [bx, s.y, bx + Math.sin(a) * len * .25, s.y - len * .65, ex, ey], 5, '#4b7a3e');
        const L = 98 + r() * 26, ang = a * 1.1 + (r() - .5) * .3;
        tmp.g.setTransform(1, 0, 0, 1, 0, 0); tmp.g.clearRect(0, 0, W, H);
        leaf(tmp.g, ex, ey + L * .08, ang, L, L * 1.02, { shape: 'heart', lobe: .16, c1: '#3d7442', c2: '#24492e', veins: 5, vein: .18 });
        tmp.g.save(); tmp.g.translate(ex, ey + L * .08); tmp.g.rotate(ang); tmp.g.globalCompositeOperation = 'destination-out';
        for (let k = 0; k < 5; k++) {
          const t = .2 + k * .15, w = PROFILE.heart(t) * L * .51;
          [-1, 1].forEach(sd => {
            tmp.g.lineWidth = 3.5 + r() * 2; tmp.g.beginPath(); tmp.g.moveTo(sd * w * .45, -t * L - 2); tmp.g.lineTo(sd * w * 1.1, -t * L - L * .07); tmp.g.stroke();
            if (k > 0 && k < 4 && r() > .3) { tmp.g.beginPath(); tmp.g.ellipse(sd * w * .22, -t * L + 4, 2.6, 6.5, sd * .5, 0, Math.PI * 2); tmp.g.fill(); }
          });
        }
        tmp.g.restore(); tmp.g.globalCompositeOperation = 'source-over';
        g.drawImage(tmp.c, 0, 0, W, H);
      });
    },
    sansevieria(g, r, s) {
      const n = 8;
      [...Array(n).keys()].sort(() => r() - .5).forEach(i => {
        const x = s.cx + (i - (n - 1) / 2) * 11 + (r() - .5) * 8, a = (i - (n - 1) / 2) * .075 + (r() - .5) * .1;
        const L = 230 + r() * 90 - Math.abs(i - (n - 1) / 2) * 16, Wd = 34 + r() * 12;
        leaf(g, x, s.y + 6, a, L, Wd, { shape: 'blade', c1: C.yellow, c2: '#b9b15a', rib: false });
        leaf(g, x, s.y + 6, a, L * .985, Wd - 8, { shape: 'blade', c1: '#2f5c37', c2: '#1d3d26', rib: false,
          inside: (gg, LL, WW) => { gg.strokeStyle = 'rgba(150,190,120,.42)'; gg.lineWidth = 3.2;
            for (let y = 10; y < LL; y += 13 + r() * 6) { gg.beginPath(); gg.moveTo(-WW, -y); gg.bezierCurveTo(-WW * .3, -y - 6, WW * .2, -y + 6, WW, -y - 2); gg.stroke(); } } });
      });
    },
    pothos(g, r, s) {
      const var_ = (gg, L, Wd) => { gg.strokeStyle = 'rgba(236,226,140,.55)'; gg.lineWidth = 3;
        for (let k = 0; k < 3; k++) { gg.beginPath(); const x = (r() - .5) * Wd * .5; gg.moveTo(x, -L * .1); gg.quadraticCurveTo(x + (r() - .5) * 20, -L * .5, x * .3, -L * .85); gg.stroke(); } };
      const vine = (p0, p1, p2, n, sz) => {
        stem(g, [...p0, ...p1, ...p2], 3, '#5d8a45');
        for (let k = 1; k <= n; k++) {
          const t = k / (n + .3), p = qpt(p0, p1, p2, t), tg = qtan(p0, p1, p2, t), sd = k % 2 ? 1 : -1;
          leaf(g, p[0], p[1], tg + Math.PI / 2 + sd * .9, sz * (1 - t * .35), sz * .8 * (1 - t * .35), { shape: 'heart', lobe: .1, c1: '#5f9a46', c2: '#3b6d36', vein: .25, inside: var_ });
        }
      };
      vine([s.cx - 30, s.y], [s.cx - 140, s.y - 10], [s.cx - 150, s.y + 210], 7, 62);
      vine([s.cx + 30, s.y], [s.cx + 150, s.y - 30], [s.cx + 140, s.y + 160], 6, 58);
      for (let k = 0; k < 7; k++) {
        const a = -.9 + k * .3 + (r() - .5) * .2, len = 70 + r() * 60, ex = s.cx + Math.sin(a) * len, ey = s.y - Math.cos(a) * len;
        stem(g, [s.cx + (r() - .5) * 30, s.y, ex, ey + 20, ex, ey], 3, '#5d8a45');
        leaf(g, ex, ey, a * 1.3, 70 + r() * 18, 58, { shape: 'heart', lobe: .1, c1: '#68a34c', c2: '#3b6d36', vein: .25, inside: var_ });
      }
    },
    zz(g, r, s) {
      const n = 6;
      [...Array(n).keys()].sort((a, b) => Math.abs(b - 2.5) - Math.abs(a - 2.5)).forEach(i => {
        const a = -.75 + 1.5 * i / (n - 1) + (r() - .5) * .12, len = 200 + (2.5 - Math.abs(i - 2.5)) * 30 + r() * 30;
        const p0 = [s.cx + (r() - .5) * 26, s.y], p2 = [p0[0] + Math.sin(a) * len, s.y - Math.cos(a) * len], p1 = [p0[0] + Math.sin(a) * len * .2, s.y - len * .6];
        stem(g, [...p0, ...p1, ...p2], 6, '#46703a');
        for (let k = 0; k < 7; k++) {
          const t = .3 + k * .1, p = qpt(p0, p1, p2, Math.min(1, t)), tg = qtan(p0, p1, p2, Math.min(1, t));
          const sz = 44 - k * 1.5;
          [-1, 1].forEach(sd => leaf(g, p[0], p[1], tg + Math.PI / 2 + sd * (.75 - k * .04), sz, sz * .52, { shape: 'ovate', c1: '#2f6236', c2: '#173a22', gloss: .28, vein: .12 }));
        }
        leaf(g, p2[0], p2[1], qtan(p0, p1, p2, 1) + Math.PI / 2, 38, 20, { shape: 'ovate', c1: '#2f6236', c2: '#173a22', gloss: .28, vein: .12 });
      });
    },
    fern(g, r, s) {
      const n = 17;
      [...Array(n).keys()].sort(() => r() - .5).forEach(() => {
        const a = (r() - .5) * 2.9, len = 170 + r() * 90, droop = Math.abs(a) > .9 ? 60 : 0;
        const p0 = [s.cx + (r() - .5) * 40, s.y + 2], p1 = [p0[0] + Math.sin(a) * len * .6, s.y - Math.cos(a * .8) * len * .9], p2 = [p0[0] + Math.sin(a) * len * 1.05, s.y - Math.cos(a * .8) * len * .55 + droop];
        stem(g, [...p0, ...p1, ...p2], 2.4, '#5d8f45');
        const tone = r();
        for (let k = 0; k < 22; k++) {
          const t = .1 + k * .041, p = qpt(p0, p1, p2, t), tg = qtan(p0, p1, p2, t), sz = 30 * (1 - t) + 7;
          [-1, 1].forEach(sd => leaf(g, p[0], p[1], tg + Math.PI / 2 + sd * 1.1, sz, sz * .38, { shape: 'lance', c1: tone > .5 ? '#86ba5e' : '#6fa452', c2: '#457a3a', rib: false }));
        }
      });
    },
    calathea(g, r, s) {
      const n = 6;
      [...Array(n).keys()].sort((a, b) => Math.abs(b - 2.5) - Math.abs(a - 2.5)).forEach(i => {
        const a = -.95 + 1.9 * i / (n - 1) + (r() - .5) * .15, len = 100 + (2.5 - Math.abs(i - 2.5)) * 26 + r() * 16;
        const bx = s.cx + (r() - .5) * 26, ex = bx + Math.sin(a) * len, ey = s.y - Math.cos(a) * len;
        stem(g, [bx, s.y, bx + Math.sin(a) * len * .3, s.y - len * .7, ex, ey], 4, '#6c8f4c');
        const L = 108 + r() * 20;
        leaf(g, ex, ey + 4, a * 1.2, L, L * .92, { shape: 'round', c1: '#6d9b5c', c2: '#4b7a47', vein: .3,
          inside: (gg, LL, WW) => { gg.strokeStyle = 'rgba(214,232,196,.55)'; gg.lineWidth = 4.5;
            for (let k = 1; k <= 7; k++) { const t = k / 8; [-1, 1].forEach(sd => { gg.beginPath(); gg.moveTo(0, -t * LL); gg.quadraticCurveTo(sd * WW * .25, -t * LL - LL * .05, sd * WW * .55, -t * LL - LL * .12); gg.stroke(); }); } } });
      });
    },
    pilea(g, r, s) {
      stem(g, [s.cx, s.y, s.cx - 8, s.y - 80, s.cx + 4, s.y - 170], 6, '#6e8d4a');
      const leaves = [];
      for (let k = 0; k < 15; k++) {
        const h = 30 + k * 9.5, a = k * 2.399, rr = 70 + r() * 50 - k * 1.6;
        const sx = s.cx + (k / 15) * -4, sy = s.y - h, ex = sx + Math.cos(a) * rr, ey = sy - 30 - Math.abs(Math.sin(a)) * 30 + Math.sin(a) * 14;
        leaves.push({ sx, sy, ex, ey, R: 30 + r() * 10 - k * .6, depth: Math.sin(a) });
      }
      leaves.sort((a, b) => a.depth - b.depth).forEach(l => {
        stem(g, [l.sx, l.sy, (l.sx + l.ex) / 2, l.sy - 20, l.ex, l.ey], 2.2, '#7b9a55');
        const gr = g.createRadialGradient(l.ex - l.R * .3, l.ey - l.R * .2, 2, l.ex, l.ey, l.R);
        gr.addColorStop(0, '#79b257'); gr.addColorStop(1, '#3f7a39');
        g.fillStyle = gr; g.beginPath(); g.ellipse(l.ex, l.ey, l.R, l.R * (.62 + .2 * Math.abs(l.depth)), (l.ex - s.cx) * .002, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(232,244,214,.7)'; g.beginPath(); g.arc(l.ex + 2, l.ey + 2, 2.6, 0, Math.PI * 2); g.fill();
      });
    },
    echeveria(g, r, s) {
      const cx = s.cx, cy = s.y - 6;
      [[15, 128, 0], [13, 100, .2], [10, 72, .5], [7, 42, .1]].forEach(([n, L, off], ring) => {
        const petals = [...Array(n).keys()].map(k => off + k * Math.PI * 2 / n).sort((a, b) => Math.sin(a) - Math.sin(b));
        petals.forEach(a => {
          g.save(); g.translate(cx, cy); g.scale(1, .5 + ring * .08);
          leaf(g, 0, 0, a + Math.PI / 2, L, L * .62, { shape: 'petal', c1: mix('#7fae93', '#d6898f', .6), c2: '#86b29a', rib: false,
            inside: (gg, LL, WW) => { const gr = gg.createLinearGradient(0, 0, 0, -LL); gr.addColorStop(0, 'rgba(206,224,206,.6)'); gr.addColorStop(.8, 'rgba(206,224,206,0)'); gr.addColorStop(1, 'rgba(214,120,130,.45)'); gg.fillStyle = gr; gg.fillRect(-WW, -LL, WW * 2, LL); } });
          g.restore();
        });
      });
    },
    ficus(g, r, s) {
      g.strokeStyle = C.trunk; g.lineWidth = 9; g.beginPath(); g.moveTo(s.cx, s.y + 2); g.bezierCurveTo(s.cx - 12, s.y - 120, s.cx + 14, s.y - 210, s.cx - 4, s.y - 222); g.stroke();
      const pts = [];
      for (let k = 0; k < 11; k++) {
        const t = .26 + k * .068, y = s.y - t * 222, sd = k % 2 ? 1 : -1;
        pts.push({ x: s.cx + Math.sin(t * 6) * 6, y, a: sd * (1.15 - t * .6) + (r() - .5) * .22, L: 92 + r() * 20 - k * 1.5, z: r() });
      }
      pts.push({ x: s.cx - 4, y: s.y - 222, a: (r() - .5) * .3, L: 88, z: 1 });
      pts.sort((a, b) => a.z - b.z).forEach(p => {
        stem(g, [p.x, p.y, p.x + Math.sin(p.a) * 16, p.y - 6, p.x + Math.sin(p.a) * 22, p.y - Math.cos(p.a) * 22], 3, '#5f7a45');
        leaf(g, p.x + Math.sin(p.a) * 18, p.y - Math.cos(p.a) * 18, p.a, p.L, p.L * .72, { shape: 'violin', c1: '#3f7a40', c2: '#264d2c', veins: 6, vein: .32, gloss: .12 });
      });
    }
  };

  /* ---------------------------------------------------------------- objetos */
  const OBJECTS = {
    vaso(g) { pot(g, { h: 230, top: 236, bot: 168, ridges: 7, empty: true, saucer: true }); },
    regador(g) {
      const cx = 220, base = BASE, w = 176, h = 168, top = base - h;
      groundShadow(g, cx + 30, base + 3, 150);
      const cu = (x0, x1) => { const gr = g.createLinearGradient(x0, 0, x1, 0);
        gr.addColorStop(0, '#8a4f24'); gr.addColorStop(.25, '#e4a56b'); gr.addColorStop(.45, '#c47c42'); gr.addColorStop(.8, '#93552a'); gr.addColorStop(1, '#6b3a1a'); return gr; };
      g.lineWidth = 11; g.strokeStyle = cu(cx + 40, cx + 220);
      g.beginPath(); g.moveTo(cx + 60, base - 50); g.quadraticCurveTo(cx + 150, base - 90, cx + 205, top - 70); g.stroke();
      g.fillStyle = '#b06c36'; g.save(); g.translate(cx + 210, top - 76); g.rotate(-.9); g.beginPath(); g.ellipse(0, 0, 9, 18, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e2a56c'; g.beginPath(); g.ellipse(-2, 0, 5, 14, 0, 0, Math.PI * 2); g.fill(); g.restore();
      g.strokeStyle = cu(cx - w / 2 - 30, cx + 40); g.lineWidth = 12;
      g.beginPath(); g.moveTo(cx - w / 2 + 6, top + 30); g.bezierCurveTo(cx - w / 2 - 70, top - 10, cx - 50, top - 110, cx + 30, top - 2); g.stroke();
      g.fillStyle = cu(cx - w / 2, cx + w / 2);
      g.beginPath(); g.moveTo(cx - w / 2, top); g.lineTo(cx - w / 2, base - 8); g.ellipse(cx, base - 8, w / 2, 14, 0, Math.PI, 0, true); g.lineTo(cx + w / 2, top); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(80,40,14,.35)'; g.lineWidth = 2;
      [top + 22, base - 30].forEach(y => { g.beginPath(); g.ellipse(cx, y, w / 2, 14, 0, 0, Math.PI); g.stroke(); });
      g.fillStyle = '#cf8e57'; g.beginPath(); g.ellipse(cx, top, w / 2, 15, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3b2010'; g.beginPath(); g.ellipse(cx - 20, top, w / 2 * .5, 8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,240,220,.25)'; g.fillRect(cx - w / 2 + 22, top + 10, 10, h - 34);
    },
    substrato(g, r) {
      const cx = 250, base = BASE - 10, w = 180, h = 250, top = base - h;
      groundShadow(g, cx - 10, base + 6, 160);
      const kraft = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
      kraft.addColorStop(0, '#b8925f'); kraft.addColorStop(.3, '#d7b585'); kraft.addColorStop(.7, '#c4a06d'); kraft.addColorStop(1, '#9c7646');
      g.fillStyle = kraft;
      g.beginPath(); g.moveTo(cx - w / 2 + 8, top + 40); g.lineTo(cx - w / 2, base); g.lineTo(cx + w / 2, base); g.lineTo(cx + w / 2 - 8, top + 40); g.closePath(); g.fill();
      g.fillStyle = '#c9a674'; g.beginPath(); g.moveTo(cx - w / 2 + 14, top + 44); g.lineTo(cx - 30, top - 4); g.lineTo(cx + 30, top - 6); g.lineTo(cx + w / 2 - 14, top + 44); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(90,60,30,.25)'; g.lineWidth = 2;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(cx - 30 + k * 20, top); g.lineTo(cx - 40 + k * 26, top + 40); g.stroke(); }
      g.strokeStyle = '#8b6b44'; g.lineWidth = 4; g.beginPath(); g.ellipse(cx, top + 36, w / 2 - 14, 7, 0, 0, Math.PI); g.stroke();
      g.beginPath(); g.moveTo(cx + 20, top + 42); g.quadraticCurveTo(cx + 40, top + 70, cx + 30, top + 96); g.moveTo(cx + 20, top + 42); g.quadraticCurveTo(cx + 2, top + 72, cx + 10, top + 100); g.stroke();
      g.strokeStyle = 'rgba(80,50,22,.5)'; g.lineWidth = 1.6; g.strokeRect(cx - 52, top + 120, 104, 70);
      g.fillStyle = 'rgba(80,50,22,.55)'; g.font = '600 13px "Martian Mono", monospace'; g.textAlign = 'center';
      g.fillText('SUBSTRATO', cx, top + 150); g.fillText('5 L', cx, top + 172);
      g.fillStyle = C.soil; g.beginPath(); g.ellipse(cx - 90, base + 2, 90, 22, 0, Math.PI, 0); g.fill();
      for (let k = 0; k < 70; k++) {
        const a = r() * Math.PI, d = Math.sqrt(r()), x = cx - 90 + Math.cos(a) * 84 * d, y = base + 2 - Math.sin(a) * 20 * d;
        if (r() > .55) { g.fillStyle = 'rgba(245,242,232,.9)'; g.beginPath(); g.arc(x, y, 1.6 + r() * 1.6, 0, Math.PI * 2); g.fill(); }
        else { g.fillStyle = r() > .5 ? '#8a5a35' : C.soilL; g.save(); g.translate(x, y); g.rotate(r() * 3); g.fillRect(-4, -1.5, 7 + r() * 5, 3); g.restore(); }
      }
    }
  };

  /* cada produto: vaso e planta separados */
  function draw(spec, scale = 2) {
    const r = rng(spec.seed || 7);
    const potL = layer(scale), plantL = layer(scale);
    let origin = { x: .5, y: .7 };
    if (spec.object) OBJECTS[spec.object](potL.g, r);
    else {
      const s = pot(potL.g, spec.pot || {});
      PLANTS[spec.plant](plantL.g, r, s);
      origin = { x: s.cx / W, y: s.y / H };
    }
    return { pot: potL.c, plant: plantL.c, origin };
  }
  function flat(art) {
    const c = document.createElement('canvas'); c.width = art.pot.width; c.height = art.pot.height;
    const g = c.getContext('2d'); g.drawImage(art.pot, 0, 0); g.drawImage(art.plant, 0, 0);
    return c;
  }

  G.ClareiraArte = { draw, flat, W, H };
})(window);
