/*! Profundo.js v0.1.0 · navegação em profundidade para a web · MIT */
(function (G, factory) {
  const P = factory(G);
  if (typeof module === 'object' && module.exports) module.exports = P;
  else G.Profundo = P;
})(typeof window !== 'undefined' ? window : globalThis, function (G) {
  'use strict';

  const VERSION = '0.1.0';
  const doc = G.document;
  const AUTO = !(doc && doc.currentScript && doc.currentScript.hasAttribute('data-manual'));
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const rand = (a, b) => a + Math.random() * (b - a);
  const prefersReduced = () => G.matchMedia && G.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Acha um ponto dentro do traço de uma letra (o buraco por onde a câmera passa).
  // Devolve o deslocamento em em: dx a partir do início da letra, dy a partir da linha de base.
  function inkPoint(ch, weight, family, stretch) {
    const S = 200, c = doc.createElement('canvas'); c.width = 480; c.height = 400;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.font = `${weight} ${S}px ${family}`; if ('fontStretch' in g) g.fontStretch = stretch;
    g.textBaseline = 'alphabetic'; g.fillText(ch, 100, 300);
    const m = g.measureText(ch);
    const row = Math.round(300 - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
    const px = g.getImageData(0, row, c.width, 1).data;
    let best = null, start = -1;
    for (let x = 0; x <= c.width; x++) {
      const ink = x < c.width && px[x * 4 + 3] > 128;
      if (ink && start < 0) start = x;
      if (!ink && start >= 0) { if (!best || x - start > best[1] - best[0]) best = [start, x]; start = -1; }
    }
    const cx = best ? (best[0] + best[1]) / 2 : 100 + m.width / 2;
    return { dx: (cx - 100) / S, dy: (row - 300) / S };
  }

  const DEFAULTS = {
    track: null,            // elemento (ou seletor) cuja rolagem move a câmera
    length: null,           // altura do trilho, ex. "900vh"
    depth: 780,             // profundidade total da viagem, em metros
    intro: .08,             // fração da rolagem usada pelo portão de entrada
    palette: ['#ff5d73', '#ffb648', '#38e1e8', '#9b6bff'],
    fog: { color: '#1c0b36', density: .0105 },
    sky: { top: '#07040f', mid: '#1c0b36', glow: '#ff5d73', gold: '#ffb648' },
    font: '"Anybody", "Arial Narrow", sans-serif',
    smoothing: 3.6,         // inércia da rolagem (maior = mais rápido)
    parallax: 1,            // quanto o mouse move a câmera
    sway: 2.3,              // balanço lateral da câmera ao longo do túnel
    fov: 62, speedFov: 26,  // campo de visão e quanto ele abre com a velocidade
    waves: true,            // clique gera onda
    theme: 'dark',          // 'dark' | 'light': no claro o brilho vira tinta e a névoa clareia
    exposure: 1.15,
    aberration: 1, grain: .05, vignette: true,
    pixelRatio: 1.75, msaa: 4, adaptive: true, cull: true,
    reducedMotion: 'auto',  // 'auto' | true | false
    hud: false,             // true ou um título
    cursor: false,
    canvas: null,
    three: null             // passe o THREE se não estiver no escopo global
  };

  /* ------------------------------------------------------------------ elementos */

  const def = (kind, mount, extra) => Object.assign({ kind, mount }, extra);
  const group = hs => ({
    update: (...a) => hs.forEach(h => h.update && h.update(...a)),
    wave: z => hs.forEach(h => h.wave && h.wave(z)),
    resize: () => hs.forEach(h => h.resize && h.resize()),
    dispose: () => hs.forEach(h => h.dispose && h.dispose())
  });
  const disposeMesh = (ctx, obj) => {
    ctx.scene.remove(obj);
    obj.traverse(m => { if (m.isMesh || m.isPoints) { m.geometry.dispose(); if (m.material.map) m.material.map.dispose(); m.material.dispose(); } });
  };

  function mountPortal(ctx, { at = 40, radius = 7.5, color, thickness = .07, glow = .1, spin = .08, index = 0 }) {
    const { THREE } = ctx;
    const col = new THREE.Color(color || ctx.palette[index % ctx.palette.length]);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 12, 180), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(ctx.light ? 1 : 3.6) })));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(radius, thickness * 8, 12, 120), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: ctx.light ? glow * 1.4 : glow, blending: ctx.light ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false })));
    g.position.z = -at; g.rotation.z = index * .4;
    ctx.scene.add(g);
    let pulse = 0; const dir = index % 2 ? 1 : -1;
    return {
      object: g,
      update(dt) { pulse *= Math.exp(-dt * 2.4); g.rotation.z += spin * dir * dt; g.scale.setScalar(1 + pulse * .18); },
      wave(z) { if (Math.abs(g.position.z - z) < 160) pulse = 1; },
      dispose() { disposeMesh(ctx, g); }
    };
  }
  function portal(p = {}) { return def('portal', ctx => mountPortal(ctx, p)); }
  function portals({ from = 40, to = 660, every = 44, colors, radius = 7.5, ...rest } = {}) {
    return def('portals', ctx => {
      const hs = [];
      for (let at = from, i = 0; at <= to; at += every, i++) {
        if (ctx.anchors.some(a => Math.abs(a.at - at) < 30)) continue;
        hs.push(mountPortal(ctx, { ...rest, at, index: i, radius: radius + (i % 3) * .9, color: colors ? colors[i % colors.length] : undefined }));
      }
      return group(hs);
    });
  }

  function mountText(ctx, { at = 70, text: t = '', lines, x = 0, y = 0, width = 15, gradient = ['#ffffff'], stretch = 'expanded', weight = 900, font, uppercase = true }) {
    const { THREE } = ctx;
    lines = lines || String(t).split('\n');
    if (uppercase) lines = lines.map(l => l.toLocaleUpperCase('pt-BR'));
    const family = font || ctx.o.font, size = 200, lh = size * .98;
    const c = doc.createElement('canvas'), g2 = c.getContext('2d');
    c.width = 2048; c.height = Math.ceil(lines.length * lh + size * .5);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = ctx.aniso;
    const setFont = s => { g2.font = `${weight} ${s}px ${family}`; if ('fontStretch' in g2) g2.fontStretch = stretch; };
    function draw() {
      g2.clearRect(0, 0, c.width, c.height); setFont(size);
      const maxW = Math.max(...lines.map(l => g2.measureText(l).width));
      setFont(size * Math.min(1, 1940 / maxW));
      const gr = g2.createLinearGradient(0, 0, c.width, c.height);
      gradient.forEach((col, i) => gr.addColorStop(gradient.length > 1 ? i / (gradient.length - 1) : 0, col));
      g2.fillStyle = gr; g2.textAlign = 'center'; g2.textBaseline = 'middle';
      lines.forEach((l, i) => g2.fillText(l, c.width / 2, size * .25 + lh * (i + .5)));
      tex.needsUpdate = true;
    }
    draw(); ctx.whenFont(`${weight} 100px ${family}`, draw);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width * c.height / c.width), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.position.set(x, y, -at); ctx.scene.add(m);
    return { object: m, dispose() { disposeMesh(ctx, m); } };
  }
  function text(p = {}) { return def('text', ctx => mountText(ctx, p)); }

  const SHAPES = {
    icosa: T => new T.IcosahedronGeometry(1, 0),
    octa: T => new T.OctahedronGeometry(1.1, 0),
    knot: T => new T.TorusKnotGeometry(.8, .28, 160, 20),
    dodeca: T => new T.DodecahedronGeometry(1, 0),
    torus: T => new T.TorusGeometry(.9, .36, 32, 80),
    sphere: T => new T.SphereGeometry(1, 48, 32)
  };
  function mountGlass(ctx, { at = 250, x = 0, y = 0, size = 2, shape = 'icosa', tint = '#ffffff', float = .35 }) {
    const m = new ctx.THREE.Mesh(ctx.geo(shape), ctx.glassMat(tint));
    m.position.set(x, y, -at); m.scale.setScalar(size); m.rotation.set(rand(0, 6), rand(0, 6), 0);
    const rs = [rand(-.25, .25), rand(-.25, .25), rand(-.15, .15)], ph = rand(0, 6);
    let spin = 0;
    ctx.scene.add(m);
    return {
      object: m,
      update(dt, t) {
        spin *= Math.exp(-dt * 1.6);
        m.rotation.x += (rs[0] + spin * .6) * dt; m.rotation.y += (rs[1] + spin) * dt; m.rotation.z += rs[2] * dt;
        m.position.y = y + Math.sin(t * .6 + ph) * float * ctx.motion;
      },
      wave(z) { if (Math.abs(m.position.z - z) < 120) spin += rand(2.5, 5.5); },
      dispose() { ctx.scene.remove(m); }
    };
  }
  function glass(p = {}) { return def('glass', ctx => mountGlass(ctx, p)); }
  function glassField({ from = 205, to = 425, count, radius = [3.4, 11], size = [.9, 2.4], tints = ['#ffffff', '#ffd9e0', '#d6fbff'], shapes = ['icosa', 'octa', 'knot', 'dodeca', 'torus'] } = {}) {
    return def('glassField', ctx => {
      const n = count || (ctx.mobile ? 16 : 26), hs = [];
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2), r = rand(radius[0], radius[1]);
        hs.push(mountGlass(ctx, { at: from + (to - from) * (i / n), x: Math.cos(a) * r, y: Math.sin(a) * r * .75, size: rand(size[0], size[1]), shape: shapes[i % shapes.length], tint: tints[i % tints.length] }));
      }
      return group(hs);
    });
  }

  function mountWall(ctx, { at, word = 'FUNDO', through, stroke, color = ctx.light ? ['#f6f4ee', '#e6e1d3'] : ['#0d0820', '#1b0b38'], weight = 900, font, fade = [260, 130] }) {
    const { THREE } = ctx, family = font || ctx.o.font;
    const idx = through != null ? through : (word.lastIndexOf('O') >= 0 ? word.lastIndexOf('O') : word.length - 1);
    const W = 2048, H = 1152, U = 160 / W;
    const c = doc.createElement('canvas'), g2 = c.getContext('2d'); c.width = W; c.height = H;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = ctx.aniso;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W * U, H * U), mat);
    m.position.z = -at; ctx.scene.add(m);
    function draw() {
      g2.globalCompositeOperation = 'source-over'; g2.clearRect(0, 0, W, H);
      const bg = g2.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, color[0]); bg.addColorStop(1, color[1] || color[0]);
      g2.fillStyle = bg; g2.fillRect(0, 0, W, H);
      let size = 330;
      const setFont = () => { g2.font = `${weight} ${size}px ${family}`; if ('fontStretch' in g2) g2.fontStretch = 'normal'; };
      setFont();
      let total = g2.measureText(word).width;
      if (total > 1900) { size *= 1900 / total; setFont(); total = g2.measureText(word).width; }
      g2.textAlign = 'left'; g2.textBaseline = 'alphabetic';
      const mo = g2.measureText(word[idx]), ip = inkPoint(word[idx], weight, family, 'normal');
      const x0 = W / 2 - total / 2, y0 = H / 2 + mo.actualBoundingBoxAscent / 2;
      const ox = x0 + g2.measureText(word.slice(0, idx)).width + ip.dx * size;
      const oy = y0 + ip.dy * size;
      g2.lineWidth = ctx.light ? 7 : 14; g2.strokeStyle = stroke || ctx.palette[0]; g2.shadowColor = g2.strokeStyle; g2.shadowBlur = ctx.light ? 0 : 30;
      g2.strokeText(word, x0, y0); g2.shadowBlur = 0;
      g2.globalCompositeOperation = 'destination-out'; g2.fillText(word, x0, y0);
      m.position.x = -(ox - W / 2) * U; m.position.y = (oy - H / 2) * U;
      tex.needsUpdate = true;
    }
    draw(); ctx.whenFont(`${weight} 100px ${family}`, draw);
    return { object: m, update(dt, t, z) { mat.opacity = smooth(fade[0], fade[1], z + at); }, dispose() { disposeMesh(ctx, m); } };
  }
  function wall(p = {}) {
    const at = p.at != null ? p.at : 700;
    return def('wall', ctx => mountWall(ctx, { ...p, at }), { anchor: { at, r: 70 } });
  }

  function sun({ at = 900, y = 6, radius = 40, colors = ['#ffd27a', '#ff3d6e'], halo = '#ff5d73', intensity = 1 } = {}) {
    return def('sun', ctx => {
      const { THREE } = ctx;
      const vs = 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }';
      const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 128), new THREE.ShaderMaterial({
        fog: false, transparent: true,
        uniforms: { a: { value: new THREE.Color(colors[0]).multiplyScalar(1.25 * intensity) }, b: { value: new THREE.Color(colors[1] || colors[0]).multiplyScalar(1.05 * intensity) } },
        vertexShader: vs,
        fragmentShader: 'uniform vec3 a,b; varying vec2 vU; void main(){ float d = length(vU-.5)*2.; float e = smoothstep(1.,.97,d); gl_FragColor = vec4(mix(b, a, smoothstep(0.,1.,vU.y))*e, e); }'
      }));
      const glow = new THREE.Mesh(new THREE.CircleGeometry(radius * 3, 64), new THREE.ShaderMaterial({
        fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { c: { value: new THREE.Color(halo) }, k: { value: .55 * intensity } },
        vertexShader: vs,
        fragmentShader: 'uniform vec3 c; uniform float k; varying vec2 vU; void main(){ float g = pow(max(1.-length(vU-.5)*2.,0.),2.2); gl_FragColor = vec4(c*g*k, g); }'
      }));
      disc.position.set(0, y, -at); glow.position.set(0, y, -at - 5);
      ctx.scene.add(disc, glow);
      return {
        update(dt, t) { glow.scale.setScalar(1 + Math.sin(t * .8) * .04 * ctx.motion); },
        dispose() { disposeMesh(ctx, disc); disposeMesh(ctx, glow); }
      };
    });
  }

  function dust({ count, spread = 46, size = .22 } = {}) {
    return def('dust', ctx => {
      const { THREE } = ctx, N = count || (ctx.mobile ? 2200 : 4200);
      const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), c = new THREE.Color(), far = ctx.D + 120;
      for (let i = 0; i < N; i++) {
        const a = rand(0, Math.PI * 2), r = 3 + Math.pow(Math.random(), .7) * spread;
        pos.set([Math.cos(a) * r, Math.sin(a) * r * .8, 20 - Math.random() * far], i * 3);
        c.set(ctx.palette[i % ctx.palette.length]).multiplyScalar(ctx.light ? rand(.75, 1.05) : rand(.6, 2.2)); col.set([c.r, c.g, c.b], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const sc = doc.createElement('canvas'); sc.width = sc.height = 64;
      const sx = sc.getContext('2d'), gr = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, '#fff'); gr.addColorStop(.25, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      sx.fillStyle = gr; sx.fillRect(0, 0, 64, 64);
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, map: new THREE.CanvasTexture(sc), vertexColors: true, transparent: true, opacity: ctx.light ? .8 : 1, depthWrite: false, blending: ctx.light ? THREE.NormalBlending : THREE.AdditiveBlending }));
      ctx.scene.add(pts);
      return { object: pts, dispose() { disposeMesh(ctx, pts); } };
    });
  }

  function custom({ at = 0, x = 0, y = 0, create, update, wave } = {}) {
    return def('custom', ctx => {
      const obj = create(ctx.THREE, ctx);
      obj.position.set(x, y, -at); ctx.scene.add(obj);
      return {
        object: obj,
        update: update ? (dt, t, z, p) => update(obj, { dt, time: t, depth: -z, progress: p }) : null,
        wave: wave ? z => wave(obj, -z) : null,
        dispose: () => ctx.scene.remove(obj)
      };
    });
  }

  // Portão de entrada: um canvas do tamanho da tela com a palavra recortada.
  // A ampliação é feita dentro do canvas a cada quadro, então o custo é sempre o de uma tela,
  // mesmo quando a palavra está 70 vezes maior (escalar a camada inteira por CSS travava na volta ao topo).
  function gate({ word = 'PROFUNDO', through, ink, hint = 'role para mergulhar', weight = 900, stretch = 'expanded', font } = {}) {
    return def('gate', ctx => {
      ctx.state.intro = ctx.o.intro;
      ink = ink || (ctx.light ? ['#f6f4ee', '#e9e5d9'] : ['#0d0820', '#160a2e']);
      const family = font || ctx.o.font;
      const cv = doc.createElement('canvas'), g = cv.getContext('2d');
      cv.className = 'pf-gate'; cv.setAttribute('aria-hidden', 'true');
      doc.body.appendChild(cv);
      let hintEl = null;
      if (hint) { hintEl = doc.createElement('div'); hintEl.className = 'pf-dive'; hintEl.innerHTML = '<span></span><i></i>'; hintEl.firstChild.textContent = hint; doc.body.appendChild(hintEl); }
      const idx = through != null ? through : (word.indexOf('O') >= 0 ? word.indexOf('O') : Math.floor(word.length / 2));
      let k = ctx.reduce ? 1 : 0, w = 0, h = 0, dpr = 1, fs = 100, total = 0, x0 = 0, y0 = 0, o = [0, 0], last = '';
      const setFont = size => { g.font = `${weight} ${size}px ${family}`; if ('fontStretch' in g) g.fontStretch = stretch; };
      function layout() {
        w = G.innerWidth; h = G.innerHeight; dpr = Math.min(G.devicePixelRatio || 1, 2);
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        setFont(100);
        const L = g.measureText(word).width || 760;
        fs = Math.min(100 * (w * .9) / L, h * .42); setFont(fs);
        total = g.measureText(word).width;
        x0 = w / 2 - total / 2; y0 = h / 2 + fs * .34;
        const ip = inkPoint(word[idx], weight, family, stretch);
        o = [x0 + g.measureText(word.slice(0, idx)).width + ip.dx * fs, y0 + ip.dy * fs];
        last = '';
      }
      function draw(S) {
        /* a fonte pode ter chegado depois da medida: mede de novo se a largura mudou */
        setFont(fs); if (Math.abs(g.measureText(word).width - total) > .5) layout();
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, w, h);
        const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, ink[0]); gr.addColorStop(1, ink[1] || ink[0]);
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'destination-out';
        g.translate(o[0], o[1]); g.scale(S, S); g.translate(-o[0], -o[1]);
        setFont(fs); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#000';
        g.fillText(word, x0, y0);
      }
      layout(); ctx.whenFont(`${weight} 100px ${family}`, layout);
      return {
        resize: layout,
        update(dt, t, z, p) {
          k += (1 - k) * (1 - Math.exp(-dt * 2.2));
          const gp = clamp(p / ctx.state.intro), hidden = gp >= 1;
          const S = (1 + .18 * (1 - k)) * (1 + 70 * Math.pow(gp, 2.7)), op = 1 - smooth(.8, 1, gp);
          const key = hidden ? 'off' : S.toFixed(4) + '|' + op.toFixed(3);
          if (key !== last) {
            last = key;
            cv.style.display = hidden ? 'none' : '';
            if (!hidden) { cv.style.opacity = op; draw(S); }
          }
          if (hintEl) hintEl.style.opacity = 1 - smooth(0, .25, gp);
        },
        dispose() { cv.remove(); hintEl && hintEl.remove(); }
      };
    });
  }

  function chapter(at, name, hint) {
    const d = typeof at === 'object' ? at : { at, name, hint };
    return { kind: 'chapter', data: { at: d.at || 0, name: d.name || '', hint: d.hint || '' } };
  }

  /* ------------------------------------------------------------------ HUD e cursor */

  function mountHud(title) {
    const root = doc.createElement('div');
    root.className = 'pf-hud'; root.setAttribute('aria-hidden', 'true');
    root.innerHTML = '<div class="pf-hud-tl"><b></b><span>v' + VERSION + '</span></div>' +
      '<div class="pf-hud-tr"><span class="pf-chap"></span><span class="pf-hint"></span></div>' +
      '<div class="pf-hud-bl"><span>profundidade</span><span class="pf-depth"><span>0000</span><small>m</small></span><span class="pf-vel">vel 00.0 m/s</span></div>' +
      '<div class="pf-gauge"><div class="pf-gauge-line"></div><div class="pf-gauge-dot"></div></div>';
    root.querySelector('b').textContent = title;
    doc.body.appendChild(root);
    const q = s => root.querySelector(s);
    const chapEl = q('.pf-chap'), hintEl = q('.pf-hint'), depthEl = q('.pf-depth span'), velEl = q('.pf-vel'), gauge = q('.pf-gauge'), dot = q('.pf-gauge-dot');
    const fade = [q('.pf-hud-tl'), q('.pf-hud-tr'), q('.pf-hud-bl'), gauge];
    let acc = 0, D = 1;
    return {
      setChapters(list, depth) {
        D = depth; gauge.querySelectorAll('.pf-tick').forEach(t => t.remove());
        list.forEach(c => { const t = doc.createElement('div'); t.className = 'pf-tick'; t.style.top = clamp(c.at / D) * 100 + '%'; t.textContent = c.name; gauge.appendChild(t); });
      },
      chapter(c, i) {
        chapEl.textContent = c ? String(i + 1).padStart(2, '0') + ' · ' + c.name : ''; hintEl.textContent = c ? c.hint : '';
        chapEl.animate && chapEl.animate([{ transform: 'translateY(110%)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' });
      },
      update(dt, depth, mps, vis) {
        dot.style.top = clamp(depth / D) * 100 + '%';
        fade.forEach(el => el.style.opacity = vis);
        if ((acc += dt) < .07) return; acc = 0;
        depthEl.textContent = String(Math.round(depth)).padStart(4, '0');
        velEl.textContent = 'vel ' + mps.toFixed(1).padStart(4, '0') + ' m/s';
      },
      dispose() { root.remove(); }
    };
  }

  function tilt(targets, { max = 16 } = {}) {
    const els = typeof targets === 'string' ? doc.querySelectorAll(targets) : (targets && targets.length != null ? targets : [targets]);
    const reduce = prefersReduced();
    Array.prototype.forEach.call(els, el => {
      if (!el || el.__pfTilt) return; el.__pfTilt = true;
      let rx = 0, ry = 0, tx = 0, ty = 0, raf = 0;
      const loop = () => {
        rx += (tx - rx) * .12; ry += (ty - ry) * .12;
        el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        raf = Math.abs(tx - rx) + Math.abs(ty - ry) > .01 ? requestAnimationFrame(loop) : 0;
      };
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
        el.style.setProperty('--pf-mx', u * 100 + '%'); el.style.setProperty('--pf-my', v * 100 + '%');
        if (reduce) return;
        tx = (.5 - v) * max; ty = (u - .5) * max;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      el.addEventListener('pointerleave', () => { tx = ty = 0; if (!raf && !reduce) raf = requestAnimationFrame(loop); });
    });
  }

  /* ------------------------------------------------------------------ instância */

  const instances = [];

  function create(options = {}) {
    const o = Object.assign({}, DEFAULTS, options, {
      fog: Object.assign({}, DEFAULTS.fog, options.fog),
      sky: Object.assign({}, DEFAULTS.sky, options.sky)
    });
    const THREE = o.three || G.THREE;
    if (!THREE) throw new Error('Profundo precisa do three.js. Carregue o three antes ou passe { three: THREE }.');
    const reduce = o.reducedMotion === 'auto' ? prefersReduced() : !!o.reducedMotion;
    const mobile = G.matchMedia('(max-width: 760px)').matches;
    const track = typeof o.track === 'string' ? doc.querySelector(o.track) : (o.track || doc.body);
    if (o.length) track.style.height = o.length;

    const events = {}, cleanup = [];
    const emit = (e, ...a) => (events[e] || []).forEach(f => f(...a));
    const listen = (t, e, f, opt) => { t.addEventListener(e, f, opt); cleanup.push(() => t.removeEventListener(e, f, opt)); };

    let canvas = o.canvas, ownCanvas = false;
    if (!canvas) { canvas = doc.createElement('canvas'); canvas.className = 'pf-canvas'; canvas.setAttribute('aria-hidden', 'true'); doc.body.prepend(canvas); ownCanvas = true; }
    let R = null;
    try { R = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); } catch (_) { /* sem WebGL */ }

    const api = {
      version: VERSION, el: track, options: o,
      on(e, f) { (events[e] || (events[e] = [])).push(f); return api; },
      off(e, f) { events[e] = (events[e] || []).filter(x => x !== f); return api; },
      add() { return api; }, wave() { return api; }, goTo() { return api; }, destroy() {},
      progress: 0, depth: 0, speed: 0
    };
    track.profundo = api; instances.push(api);
    if (!R) { doc.documentElement.classList.add('pf-no-gl'); if (ownCanvas) canvas.remove(); return api; }

    const DPR = Math.min(G.devicePixelRatio || 1, mobile ? Math.min(1.5, o.pixelRatio) : o.pixelRatio);
    let dpr = DPR;
    R.setPixelRatio(dpr); R.toneMapping = THREE.NoToneMapping;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(new THREE.Color(o.fog.color), o.fog.density);
    const cam = new THREE.PerspectiveCamera(o.fov, G.innerWidth / G.innerHeight, .1, 1400);
    /* além desta distância a névoa já cobre 99,5%: nada lá precisa ser desenhado */
    const CULL = o.cull && o.fog.density > 0 ? 2.3 / o.fog.density : Infinity;
    const D = o.depth;

    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(o.sky.top) }, mid: { value: new THREE.Color(o.sky.mid) }, glow: { value: new THREE.Color(o.sky.glow) }, gold: { value: new THREE.Color(o.sky.gold) } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `uniform vec3 top, mid, glow, gold; varying vec3 vD;
        void main(){ vec3 c = mix(mid, top, smoothstep(.05,.8,abs(vD.y)));
          float f = pow(max(dot(vD, vec3(0.,0.,-1.)),0.), 14.); c += glow*f*.18 + gold*pow(f,6.)*.25; gl_FragColor = vec4(c,1.); }`
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), skyMat);
    scene.add(sky);
    {
      const pm = new THREE.PMREMGenerator(R), es = new THREE.Scene();
      es.add(new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), skyMat));
      [[0, [-24, 8, -20], 4], [1, [20, 14, -26], 5], [2, [26, -6, 12], 4], [3, [-20, -10, 18], 3]].forEach(([i, p, k]) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(22, 7), new THREE.MeshBasicMaterial({ color: new THREE.Color(o.palette[i % o.palette.length]).multiplyScalar(k), side: THREE.DoubleSide }));
        m.position.set(...p); m.lookAt(0, 0, 0); es.add(m);
      });
      const top = new THREE.Mesh(new THREE.PlaneGeometry(22, 7), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2.2), side: THREE.DoubleSide }));
      top.position.set(0, 30, 0); top.lookAt(0, 0, 0); es.add(top);
      scene.environment = pm.fromScene(es, .03).texture;
      pm.dispose();
    }

    const geoCache = {}, matCache = {};
    const ctx = {
      THREE, renderer: R, scene, camera: cam, o, D, mobile, reduce, palette: o.palette,
      light: o.theme === 'light', motion: reduce ? 0 : 1, aniso: R.capabilities.getMaxAnisotropy(), anchors: [], state: { intro: 0 },
      whenFont(spec, fn) { if (doc.fonts && doc.fonts.load) doc.fonts.load(spec).then(fn, () => {}); },
      geo: name => geoCache[name] || (geoCache[name] = (SHAPES[name] || SHAPES.icosa)(THREE)),
      glassMat: tint => matCache[tint] || (matCache[tint] = new THREE.MeshPhysicalMaterial({
        color: tint, metalness: 0, roughness: .06, transmission: 1, thickness: 2.2, ior: 1.5,
        iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [120, 520], envMapIntensity: 1.4,
        clearcoat: 1, clearcoatRoughness: .05, attenuationColor: new THREE.Color(tint), attenuationDistance: 3.5
      }))
    };

    /* pós-processamento */
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: mobile ? 0 : o.msaa });
    const waves = [0, 1, 2, 3].map(() => new THREE.Vector3(.5, .5, -99));
    const post = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { tD: { value: rt.texture }, uRes: { value: new THREE.Vector2() }, uT: { value: 0 }, uSpeed: { value: 0 }, uAsp: { value: 1 }, uW: { value: waves }, uAb: { value: o.aberration }, uGrain: { value: o.grain }, uVig: { value: o.vignette ? (o.theme === 'light' ? .3 : 1) : 0 },
        uExp: { value: o.exposure }, uTone: { value: o.theme === 'light' ? 0 : 1 },
        uRing: { value: o.theme === 'light' ? new THREE.Vector3(-.09, -.05, -.08) : new THREE.Vector3(.22, .121, .165) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `uniform sampler2D tD; uniform vec2 uRes; uniform float uT, uSpeed, uAsp, uAb, uGrain, uVig, uExp, uTone; uniform vec3 uW[4], uRing; varying vec2 vUv;
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0., 1.); }
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        void main(){
          vec2 uv = vUv; float ring = 0.;
          for(int i=0;i<4;i++){ vec3 w = uW[i]; float t = uT - w.z; if(t < 0. || t > 3.) continue;
            vec2 d = (uv - w.xy) * vec2(uAsp, 1.); float r = length(d); float k = exp(-pow((r - t*1.15)*13., 2.)) * exp(-t*1.3);
            uv -= normalize(d + 1e-5) / vec2(uAsp, 1.) * k * .05; ring += k; }
          vec2 c = uv - .5; float ca = (.0018 + uSpeed*.016 + ring*.016) * uAb;
          vec3 col = vec3(texture2D(tD, uv + c*ca).r, texture2D(tD, uv).g, texture2D(tD, uv - c*ca).b);
          col += ring * uRing;
          col = pow(uTone > .5 ? aces(col*uExp) : clamp(col*uExp, 0., 1.), vec3(1./2.2));
          float v = smoothstep(1.25, .3, length(c * vec2(uAsp*.75, 1.)));
          col *= mix(1., mix(.5, 1., v), uVig);
          col += (hash(vUv*uRes + fract(uT*7.)) - .5) * uGrain;
          gl_FragColor = vec4(col, 1.);
        }`
    });
    const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));

    /* elementos */
    const pending = [], handles = [], chapters = [];
    let queued = false, hud = null, cursorEl = null;
    if (o.hud) hud = mountHud(typeof o.hud === 'string' ? o.hud : 'PROFUNDO');
    function flush() {
      queued = false;
      pending.splice(0).forEach(d => { const h = d.mount(ctx); if (h) handles.push(h); });
      /* compila os shaders agora, com tudo visível, para não travar quando um objeto sai da névoa */
      try { R.compileAsync ? R.compileAsync(scene, cam).catch(() => {}) : R.compile(scene, cam); } catch (_) { /* compila no primeiro uso */ }
      chapters.sort((a, b) => a.at - b.at);
      if (hud) { hud.setChapters(chapters, D); chapIdx = -2; }
    }
    api.add = (...defs) => {
      defs.flat(Infinity).filter(Boolean).forEach(d => {
        if (d.kind === 'chapter') chapters.push(d.data);
        else { if (d.anchor) ctx.anchors.push(d.anchor); pending.push(d); }
      });
      if (!queued) { queued = true; Promise.resolve().then(flush); }
      return api;
    };

    /* rolagem */
    let trackTop = 0, trackLen = 1;
    const measure = () => { const r = track.getBoundingClientRect(); trackTop = r.top + G.scrollY; trackLen = Math.max(1, track.offsetHeight - G.innerHeight); };
    const readP = () => clamp((G.scrollY - trackTop) / trackLen);
    const zOf = p => {
      const i = ctx.state.intro, base = i > 0 ? 26 : 0;
      if (p < i) return -base * (p / i);
      const t = i > 0 ? (p - i) / (1 - i) : p;
      return -base - (D - base) * (t * .85 + smooth(0, 1, t) * .15);
    };
    let scrollAnim = 0;
    api.goTo = (depth, { duration = 2.4 } = {}) => {
      let lo = 0, hi = 1;
      for (let i = 0; i < 32; i++) { const m = (lo + hi) / 2; if (-zOf(m) < depth) lo = m; else hi = m; }
      const target = trackTop + (depth >= D ? 1 : (lo + hi) / 2) * trackLen;
      cancelAnimationFrame(scrollAnim);
      if (reduce || !duration) { G.scrollTo(0, target); return api; }
      const y0 = G.scrollY, t0 = performance.now();
      const step = now => {
        const t = clamp((now - t0) / (duration * 1000)), e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        G.scrollTo(0, y0 + (target - y0) * e);
        if (t < 1) scrollAnim = requestAnimationFrame(step);
      };
      scrollAnim = requestAnimationFrame(step);
      return api;
    };
    ['wheel', 'touchstart', 'keydown'].forEach(e => listen(G, e, () => cancelAnimationFrame(scrollAnim), { passive: true }));

    /* entrada */
    let mx = 0, my = 0, mxS = 0, myS = 0, cx = -100, cy = -100, cxS = -100, cyS = -100;
    listen(G, 'pointermove', e => { mx = e.clientX / G.innerWidth * 2 - 1; my = e.clientY / G.innerHeight * 2 - 1; cx = e.clientX; cy = e.clientY; });
    if (o.cursor && G.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      cursorEl = doc.createElement('div'); cursorEl.className = 'pf-cursor'; cursorEl.setAttribute('aria-hidden', 'true');
      doc.body.appendChild(cursorEl); doc.documentElement.classList.add('pf-has-cursor');
    }
    let T = 0, wi = 0;
    api.wave = (x = G.innerWidth / 2, y = G.innerHeight / 2) => {
      waves[wi++ % 4].set(x / G.innerWidth, 1 - y / G.innerHeight, T);
      const z = cam.position.z;
      handles.forEach(h => h.wave && h.wave(z));
      if (cursorEl && cursorEl.animate) cursorEl.animate([{ scale: 1 }, { scale: 2.6 }, { scale: 1 }], { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)' });
      emit('wave', { x, y, depth: -z });
      return api;
    };
    listen(G, 'click', e => {
      if (!o.waves) return;
      if (e.target.closest && e.target.closest('a,button,input,textarea,select,label,summary,[data-pf-nowave]')) return;
      api.wave(e.clientX, e.clientY);
    });

    function resize() {
      const w = G.innerWidth, h = G.innerHeight;
      R.setPixelRatio(dpr); R.setSize(w, h, false); rt.setSize(Math.round(w * dpr), Math.round(h * dpr));
      cam.aspect = w / h; cam.updateProjectionMatrix();
      post.uniforms.uRes.value.set(w * dpr, h * dpr); post.uniforms.uAsp.value = w / h;
      measure(); handles.forEach(h => h.resize && h.resize());
    }
    resize(); listen(G, 'resize', resize);
    const ro = G.ResizeObserver ? new ResizeObserver(measure) : null;
    ro && ro.observe(track);

    /* laço */
    /* esconde o que está longe demais na névoa; sol, céu e objetos sem névoa ficam */
    const box = new THREE.Box3();
    function cull(z) {
      for (const c of scene.children) {
        let u = c.userData.pfZ;
        if (!u) {
          let keep = c === sky || c.userData.pfKeep;
          c.traverse(m => { if (m.material && [].concat(m.material).some(x => x.fog === false)) keep = true; });
          box.setFromObject(c);
          u = c.userData.pfZ = keep || box.isEmpty() || box.max.z - box.min.z > CULL ? 'keep' : [box.min.z - 6, box.max.z + 6];
        }
        if (u === 'keep') continue;
        const far = u[1] < z - CULL;
        if (far && c.visible) { c.visible = false; c.userData.pfCulled = true; }
        else if (!far && c.userData.pfCulled) { c.visible = true; c.userData.pfCulled = false; }
      }
    }

    /* resolução adaptativa: abaixo de ~40 fps cai até 1 pixel por pixel CSS e volta quando sobra fôlego */
    const DPR_MIN = Math.min(1, DPR);
    let slow = 0, fast = 0;
    function adapt(dt) {
      if (dt > .025) { slow += dt; fast = 0; } else if (dt < .019) { fast += dt; slow = 0; }
      const next = slow > .5 ? Math.max(DPR_MIN, dpr * .8) : fast > 4 ? Math.min(DPR, dpr / .85) : dpr;
      if (slow > .5 || fast > 4) slow = fast = 0;
      if (Math.abs(next - dpr) > .01) { dpr = next; resize(); }
    }

    let pS = readP(), pPrev = pS, speedS = 0, lastZ = 0, last = performance.now(), raf = 0, chapIdx = -2;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.05, (now - last) / 1000) || .016; last = now;
      if (doc.hidden) return;
      T += dt;
      const pT = readP();
      pS += (pT - pS) * (1 - Math.exp(-dt * (reduce ? 20 : o.smoothing)));
      const vel = (pS - pPrev) / dt; pPrev = pS;
      speedS += (clamp(Math.abs(vel) * 5) - speedS) * (1 - Math.exp(-dt * 6));
      mxS += (mx - mxS) * (1 - Math.exp(-dt * 3)); myS += (my - myS) * (1 - Math.exp(-dt * 3));
      if (cursorEl) { cxS += (cx - cxS) * (1 - Math.exp(-dt * 14)); cyS += (cy - cyS) * (1 - Math.exp(-dt * 14)); cursorEl.style.transform = `translate(${cxS}px, ${cyS}px)`; }

      const z = zOf(pS);
      let amp = 1;
      for (const a of ctx.anchors) amp = Math.min(amp, clamp(Math.abs(z + a.at) / a.r));
      amp *= clamp((z + D - 10) / 60 + .3);
      const k = reduce ? 0 : o.parallax;
      const sway = Math.sin(z * .013) * o.sway * amp;
      cam.position.set(sway + mxS * 1.6 * amp * k, Math.cos(z * .009) * .9 * amp - myS * 1.1 * amp * k, z);
      const endLook = smooth(-D + 60, -D, z);
      cam.lookAt(cam.position.x * .35 + mxS * 3 * k * (1 - endLook * .5), cam.position.y * .3 - myS * 2 * k + endLook * 3, z - 24);
      cam.rotation.z += Math.sin(z * .006) * .05 * amp;
      cam.fov = o.fov + speedS * o.speedFov * (reduce ? 0 : 1); cam.updateProjectionMatrix();
      sky.position.copy(cam.position);

      for (const h of handles) h.update && h.update(dt, T, z, pS);

      const depth = -z, mps = Math.abs(z - lastZ) / dt; lastZ = z;
      api.progress = pS; api.depth = depth; api.speed = mps;
      const pastTrack = G.scrollY - (trackTop + trackLen);
      if (pastTrack < G.innerHeight * 1.2) {
        if (CULL < Infinity) cull(z);
        if (o.adaptive) adapt(dt);
        post.uniforms.uT.value = T; post.uniforms.uSpeed.value = speedS * (reduce ? 0 : 1);
        R.setRenderTarget(rt); R.render(scene, cam);
        R.setRenderTarget(null); R.render(postScene, postCam);
      }

      let ci = -1; chapters.forEach((c, i) => { if (depth >= c.at) ci = i; });
      if (ci !== chapIdx) { chapIdx = ci; hud && hud.chapter(chapters[ci], ci); emit('chapter', chapters[ci] || null, ci); }
      hud && hud.update(dt, depth, mps, 1 - clamp(pastTrack / (G.innerHeight * .45)));
      emit('progress', { progress: pS, depth, speed: mps });
    }
    raf = requestAnimationFrame(frame);

    api.three = { THREE, renderer: R, scene, camera: cam };
    api.destroy = () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(scrollAnim);
      cleanup.forEach(f => f()); ro && ro.disconnect();
      handles.forEach(h => h.dispose && h.dispose());
      hud && hud.dispose(); cursorEl && cursorEl.remove(); doc.documentElement.classList.remove('pf-has-cursor');
      rt.dispose(); R.dispose(); if (ownCanvas) canvas.remove();
      delete track.profundo; instances.splice(instances.indexOf(api), 1);
    };
    return api;
  }

  /* ------------------------------------------------------------------ modo declarativo */

  const A = (el, n, d) => el.hasAttribute(n) ? el.getAttribute(n) : d;
  const N = (el, n, d) => el.hasAttribute(n) ? parseFloat(el.getAttribute(n)) : d;
  const L = (el, n, d) => el.hasAttribute(n) ? el.getAttribute(n).split(',').map(s => s.trim()) : d;
  const NL = (el, n, d) => el.hasAttribute(n) ? L(el, n).map(Number) : d;
  function linesOf(el) {
    const t = doc.createElement('textarea');
    return el.innerHTML.split(/<br\s*\/?>/i).map(s => { t.innerHTML = s.replace(/<[^>]*>/g, ''); return t.value.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  }
  const PARSERS = {
    'pf-gate': el => gate({ word: A(el, 'word', el.textContent.trim() || 'PROFUNDO'), through: N(el, 'through'), hint: A(el, 'hint', 'role para mergulhar'), ink: L(el, 'ink') }),
    'pf-portal': el => portal({ at: N(el, 'at', 40), radius: N(el, 'radius', 7.5), color: A(el, 'color') }),
    'pf-portals': el => portals({ from: N(el, 'from', 40), to: N(el, 'to', 660), every: N(el, 'every', 44), colors: L(el, 'colors') }),
    'pf-text': el => text({ at: N(el, 'at', 70), lines: linesOf(el), x: N(el, 'x', 0), y: N(el, 'y', 0), width: N(el, 'width', 15), gradient: L(el, 'gradient', L(el, 'color', ['#ffffff'])), stretch: A(el, 'stretch', 'expanded'), uppercase: A(el, 'case') !== 'none' }),
    'pf-glass': el => glass({ at: N(el, 'at', 250), x: N(el, 'x', 0), y: N(el, 'y', 0), size: N(el, 'size', 2), shape: A(el, 'shape', 'icosa'), tint: A(el, 'tint', '#ffffff') }),
    'pf-glass-field': el => glassField({ from: N(el, 'from', 205), to: N(el, 'to', 425), count: N(el, 'count'), radius: NL(el, 'radius', [3.4, 11]), size: NL(el, 'size', [.9, 2.4]) }),
    'pf-wall': el => wall({ at: N(el, 'at', 700), word: A(el, 'word', el.textContent.trim() || 'FUNDO'), through: N(el, 'through'), stroke: A(el, 'stroke'), color: L(el, 'color') }),
    'pf-sun': el => sun({ at: N(el, 'at', 900), radius: N(el, 'radius', 40), colors: L(el, 'colors', ['#ffd27a', '#ff3d6e']) }),
    'pf-dust': el => dust({ count: N(el, 'count'), spread: N(el, 'spread', 46) }),
    'pf-chapter': el => chapter({ at: N(el, 'at', 0), name: A(el, 'name', el.textContent.trim()), hint: A(el, 'hint', '') })
  };
  const TAGS = Object.keys(PARSERS).join(',');

  function fromElement(el) {
    if (el.profundo) return el.profundo;
    const d = el.dataset, o = { track: el };
    if (d.depth) o.depth = +d.depth;
    if (d.length) o.length = d.length;
    if (d.intro) o.intro = +d.intro;
    if ('hud' in d) o.hud = d.hud || true;
    if ('cursor' in d) o.cursor = d.cursor !== 'false';
    if (d.palette) o.palette = d.palette.split(',').map(s => s.trim());
    if (d.fog) o.fog = { color: d.fog };
    if (d.fogDensity) o.fog = Object.assign(o.fog || {}, { density: +d.fogDensity });
    if (d.waves === 'false') o.waves = false;
    if (d.parallax) o.parallax = +d.parallax;
    if (d.font) o.font = d.font;
    if (d.theme) o.theme = d.theme;
    return create(o).add([...el.querySelectorAll(TAGS)].map(t => PARSERS[t.localName](t)));
  }
  function auto(root = doc) {
    tilt(root.querySelectorAll('[data-pf-tilt]'));
    return [...root.querySelectorAll('[data-profundo]')].map(fromElement);
  }
  if (doc && AUTO) {
    const go = () => {
      if (!doc.querySelector('[data-profundo],[data-pf-tilt]')) return;
      if (!G.THREE && doc.querySelector('[data-profundo]')) { console.warn('Profundo: three.js não foi encontrado. Carregue o three antes do profundo.js.'); return; }
      auto();
    };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else setTimeout(go);
  }

  return { version: VERSION, create, auto, tilt, instances, gate, portal, portals, text, glass, glassField, wall, sun, dust, custom, chapter };
});
