'use strict';
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
// ================= 基础工具 =================
const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const key = (x, z) => x + ',' + z;
const SAVE_KEY = 'crazy-water-world-save-v1';
const DAY_LEN = 40;

const RES = { wood: { n: '木材', i: '🪵' }, plastic: { n: '塑料', i: '🧴' }, scrap: { n: '废铁', i: '⚙️' } };

const DEFS = {
  floor:      { name: '木地板',     icon: '🟫', cost: { wood: 2 },                         tier: 1, desc: '扩建木筏' },
  urine:      { name: '尿液过滤器', icon: '🧪', cost: { wood: 3, plastic: 2 },             tier: 1, desc: '祖传三代，淡水 +0.4/秒' },
  filter:     { name: '海水过滤器', icon: '💧', cost: { plastic: 6, wood: 4 },             tier: 1, desc: '淡水 +0.8/秒' },
  grill:      { name: '烤鱼架',     icon: '🐟', cost: { wood: 5, scrap: 1 },               tier: 1, desc: '食物 +0.5/秒' },
  net:        { name: '收集网',     icon: '🕸️', cost: { wood: 4, plastic: 3 },             tier: 1, desc: '自动兜住漂过的物资' },
  planter:    { name: '种植箱',     icon: '🌱', cost: { wood: 6, plastic: 4 },             tier: 2, desc: '食物 +0.9/秒' },
  turret:     { name: '鱼叉炮台',   icon: '🎯', cost: { wood: 6, scrap: 8 },               tier: 2, desc: '自动射鲨鱼' },
  house:      { name: '集装箱房',   icon: '📦', cost: { wood: 12, plastic: 6 },            tier: 2, desc: '+1 幸存者帮你甩钩，阿水们住这' },
  windmill:   { name: '电鳗发电机', icon: '⚡', cost: { scrap: 12, plastic: 8 },           tier: 3, desc: '电鳗发电，绿色无污染 +2 电' },
  laser:      { name: '激光炮台',   icon: '🔴', cost: { scrap: 20, plastic: 10 },          tier: 3, desc: '耗 1 电，打得又快又狠' },
  purifier:   { name: '净水厂',     icon: '🏭', cost: { scrap: 18, plastic: 16 },          tier: 3, desc: '淡水 +2.5/秒' },
  tower:      { name: '海景豪宅',   icon: '🏰', cost: { scrap: 30, plastic: 20, wood: 20 }, tier: 4, desc: '+3 幸存者，住进豪宅' },
  lighthouse: { name: '灯塔',       icon: '🗼', cost: { scrap: 25, wood: 15 },             tier: 4, desc: '漂来的物资变多' },
};
const ORDER = Object.keys(DEFS);

const TIERS = [
  { name: '五级小木筏' },
  { name: '简易庇护所', tiles: 8,  cost: { wood: 25, plastic: 15, scrap: 5 } },
  { name: '高级庇护所', tiles: 16, cost: { wood: 50, plastic: 40, scrap: 30 } },
  { name: '水上城堡', tiles: 28, cost: { wood: 80, plastic: 70, scrap: 60 } },
  { name: '海上豪宅区', tiles: 40, cost: { wood: 120, plastic: 100, scrap: 100 } },
];

// ================= 声音（纯代码合成，无音频文件） =================
let AC = null, noiseBuf = null;
// 声音档位：0 全开，1 关环境音（海浪雨声），2 静音
let soundMode = +(localStorage.getItem('cww-sound') || 0), muted = soundMode === 2;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const len = AC.sampleRate * 0.5;
    noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // 总线：所有声音先过低通（削掉刺耳高频）和压缩器（同时响很多声也不会炸），再到喇叭
    master = AC.createGain(); master.gain.value = 0.9;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200; lp.Q.value = 0.3;
    const comp = AC.createDynamicsCompressor();
    comp.threshold.value = -22; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.25;
    master.connect(lp).connect(comp).connect(AC.destination);
    // 回声：给「叮叮叮」这类奖励音和剧情配乐加一点余韵
    echoIn = AC.createGain();
    const dl = AC.createDelay(1), fb = AC.createGain(), wet = AC.createGain(), dlp = AC.createBiquadFilter();
    dl.delayTime.value = 0.22; fb.gain.value = 0.3; wet.gain.value = 0.32; dlp.type = 'lowpass'; dlp.frequency.value = 2200;
    echoIn.connect(dl); dl.connect(dlp).connect(fb).connect(dl); dlp.connect(wet).connect(master);
    // 剧情配乐单独一路，跳过剧情时能一起淡出
    musicBus = AC.createGain(); musicBus.connect(master);
  } catch (e) { AC = null; }
}
let master = null, echoIn = null, musicBus = null;
// o: { atk 起音秒数, echo 是否加回声, lp 单独低通频率, bus 输出到哪路 }
function tone(f1, f2, dur, type = 'sine', vol = 0.15, delay = 0, o = {}) {
  if (!AC || muted) return;
  const t0 = AC.currentTime + delay, osc = AC.createOscillator(), g = AC.createGain(), atk = o.atk ?? 0.008;
  osc.type = type;
  osc.frequency.setValueAtTime(f1, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, atk + 0.02));
  let node = osc;
  if (o.lp) { const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node = node.connect(f); }
  node.connect(g).connect(o.bus || master);
  if (o.echo) g.connect(echoIn);
  osc.start(t0); osc.stop(t0 + Math.max(dur, atk + 0.02) + 0.05);
}
function noise(dur, vol = 0.2, freq = 900, delay = 0) {
  if (!AC || muted) return;
  const t0 = AC.currentTime + delay, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t0);
  f.frequency.exponentialRampToValueAtTime(120, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t0); s.stop(t0 + dur + 0.05);
}
// 柔和的长音和弦（剧情配乐用）：慢起慢收
function pad(freqs, dur, vol = 0.022, delay = 0) {
  freqs.forEach((f, i) => { tone(f, f * 1.002, dur, i ? 'sine' : 'triangle', vol, delay, { atk: Math.min(1.2, dur * 0.35), lp: 1400, bus: musicBus, echo: true }); });
}
const arp = (notes, gap, vol, type = 'sine') => notes.forEach((f, i) => tone(f, f, 0.32, type, vol, i * gap, { echo: true, lp: 2600 }));
const SFX = {
  throw: () => noise(0.22, 0.04, 1500),
  splash: () => noise(0.45, 0.07, 900),
  catch: () => { tone(784, 800, 0.1, 'sine', 0.045); tone(1175, 1190, 0.14, 'sine', 0.035, 0.07); },
  build: () => { tone(240, 150, 0.12, 'sine', 0.1); noise(0.07, 0.035, 1100); },
  bite: () => { tone(120, 55, 0.24, 'sine', 0.12); noise(0.12, 0.04, 380); },
  hit: () => tone(330, 260, 0.08, 'sine', 0.035),
  shot: () => noise(0.05, 0.016, 1400),
  laser: () => tone(700, 420, 0.09, 'sine', 0.018),
  kill: () => { tone(392, 400, 0.12, 'sine', 0.04); tone(587, 600, 0.18, 'sine', 0.035, 0.09); },
  gold: () => arp([523, 659, 784, 1046], 0.09, 0.05),
  up: () => arp([392, 523, 659, 784, 1046], 0.08, 0.045, 'triangle'),
  thunder: () => { noise(1.8, 0.1, 180); tone(52, 30, 1.2, 'sine', 0.09); },
  meow: () => { tone(820, 1150, 0.09, 'sine', 0.04); tone(1150, 650, 0.2, 'sine', 0.04, 0.09); },
  over: () => arp([392, 330, 262, 196], 0.2, 0.05, 'triangle'),
  no: () => tone(190, 150, 0.1, 'sine', 0.045),
  thud: () => { tone(110, 50, 0.3, 'sine', 0.14); noise(0.18, 0.05, 300); },
  crack: () => { tone(160, 60, 0.25, 'sine', 0.12); noise(0.3, 0.06, 1200); },
};
// 同一种音效短时间内只响一次，避免炮台、自动打捞一多就吵成一片
const SFX_GAP = { shot: 0.12, laser: 0.12, hit: 0.08, catch: 0.1, splash: 0.15, bite: 0.3, kill: 0.15, throw: 0.08 }, sfxLast = {};
function sfx(n) {
  if (!AC || muted) return;
  const now = AC.currentTime;
  if (SFX_GAP[n] && now - (sfxLast[n] || -9) < SFX_GAP[n]) return;
  sfxLast[n] = now;
  try { SFX[n] && SFX[n](); } catch (e) {}
}
// 8-bit 说话声：每个字一声短促的「嘟」，过一道低通，圆润不扎耳
function blip(freq, vol = 0.03, type = 'triangle', lp = 1600) { tone(freq * rand(0.95, 1.05), freq * rand(0.92, 1.0), 0.06, type, vol, 0, { atk: 0.006, lp }); }

// ================= 场景 =================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('#app').appendChild(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 400);
function fitCamera() { camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 1 ? 58 : 42; camera.updateProjectionMatrix(); }
fitCamera();
const SKY_DAY = new THREE.Color(0xa7b8bf), SKY_NIGHT = new THREE.Color(0x0d1822), SKY_DUSK = new THREE.Color(0xc98a63), SKY_STORM = new THREE.Color(0x56646c), SKY_FLASH = new THREE.Color(0xe3ecf2);
scene.background = SKY_DAY.clone();
scene.fog = new THREE.Fog(0xa7b8bf, 40, 110);
const hemi = new THREE.HemisphereLight(0xdff3ff, 0x1d5570, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 1.15);
sun.castShadow = true;
sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);

const matCache = {};
function mat(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!matCache[k]) matCache[k] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7, metalness: 0.05, flatShading: true }, o));
  return matCache[k];
}
function mesh(geo, m, x = 0, y = 0, z = 0) {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = true; me.receiveShadow = true;
  return me;
}
function grp(...ch) { const g = new THREE.Group(); ch.forEach(c => g.add(c)); return g; }

// ---------- 海面 ----------
const OCEAN = 260, SEG = IS_TOUCH ? 72 : 120, CELL = OCEAN / SEG;
const oceanGeo = new THREE.PlaneGeometry(OCEAN, OCEAN, SEG, SEG);
oceanGeo.rotateX(-Math.PI / 2);
const oceanBase = oceanGeo.attributes.position.array.slice();
const OCEAN_DAY = new THREE.Color(0x22505c), OCEAN_NIGHT = new THREE.Color(0x143a4c), OCEAN_STORM = new THREE.Color(0x1d4450);
const oceanMat = new THREE.MeshStandardMaterial({ color: 0x22505c, roughness: 0.55, metalness: 0, flatShading: true });
const ocean = new THREE.Mesh(oceanGeo, oceanMat);
ocean.receiveShadow = true; ocean.frustumCulled = false;
scene.add(ocean);
function waveH(x, z, t) {
  const w = 0.18 * Math.sin(x * 0.35 + t * 1.1) + 0.14 * Math.sin(z * 0.42 - t * 0.9) + 0.08 * Math.sin((x + z) * 0.8 + t * 1.7);
  // 木筏周围风平浪静：离木筏边缘 4 格以内浪逐渐变小，木筏再大也不会被海水漫过
  const k = clamp((Math.hypot(x - raftC.x, z - raftC.z) - raftR - 0.5) / 4, 0, 1);
  return w * (0.12 + 0.88 * k * k * (3 - 2 * k));
}
function updateOcean(t, cx, cz) {
  ocean.position.x = Math.round(cx / CELL) * CELL;
  ocean.position.z = Math.round(cz / CELL) * CELL;
  const p = oceanGeo.attributes.position.array, ox = ocean.position.x, oz = ocean.position.z;
  for (let i = 0; i < p.length; i += 3) p[i + 1] = waveH(oceanBase[i] + ox, oceanBase[i + 2] + oz, t);
  oceanGeo.attributes.position.needsUpdate = true;
}

// ---------- 贴图（canvas 画的） ----------
function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
const TEX = {
  wood: canvasTex(128, (g, s) => {
    const cols = ['#a87444', '#9a683b', '#b07d4c', '#93633a'];
    for (let i = 0; i < 4; i++) {
      const y = i * s / 4;
      g.fillStyle = cols[i]; g.fillRect(0, y, s, s / 4);
      g.fillStyle = 'rgba(60,35,15,.55)'; g.fillRect(0, y, s, 3);
      for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(70,40,20,.2)'; g.fillRect(Math.random() * s, y + 6 + Math.random() * (s / 4 - 12), 20 + Math.random() * 40, 2); }
      g.fillStyle = 'rgba(40,25,10,.7)'; g.fillRect(8, y + s / 8 - 2, 4, 4); g.fillRect(s - 12, y + s / 8 - 2, 4, 4);
    }
  }),
  metal: canvasTex(128, (g, s) => {
    g.fillStyle = '#8593a0'; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,255,255,.18)';
    for (let y = 8; y < s; y += 16) for (let x = (y / 16 % 2) * 8 + 8; x < s; x += 16) { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-4, -1.5, 8, 3); g.restore(); }
    g.strokeStyle = '#5c6873'; g.lineWidth = 6; g.strokeRect(3, 3, s - 6, s - 6);
    g.fillStyle = '#c9d1d8'; [[10, 10], [s - 10, 10], [10, s - 10], [s - 10, s - 10]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); });
  }),
  city: canvasTex(128, (g, s) => {
    g.fillStyle = '#e6eaee'; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 2;
    for (let i = 32; i < s; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); }
    g.strokeStyle = '#39b8ff'; g.lineWidth = 6; g.strokeRect(3, 3, s - 6, s - 6);
  }),
  cityGlow: canvasTex(128, (g, s) => { g.fillStyle = '#000'; g.fillRect(0, 0, s, s); g.strokeStyle = '#39b8ff'; g.lineWidth = 6; g.strokeRect(3, 3, s - 6, s - 6); }),
  net: canvasTex(64, (g, s) => {
    g.clearRect(0, 0, s, s); g.strokeStyle = '#f1e7c8'; g.lineWidth = 2;
    for (let i = 0; i <= s; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); }
  }),
  windows: canvasTex(64, (g, s) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
    for (let y = 4; y < s; y += 10) for (let x = 4; x < s; x += 10) { g.fillStyle = Math.random() < 0.7 ? '#ffd27a' : '#1a1a1a'; g.fillRect(x, y, 6, 6); }
  }),
};
TEX.windows.wrapS = TEX.windows.wrapT = THREE.RepeatWrapping;
// 肥强的粉色爱心大短裤
TEX.hearts = canvasTex(64, (g, s) => {
  g.fillStyle = '#f48fb1'; g.fillRect(0, 0, s, s); g.fillStyle = '#e53950';
  for (let y = 6; y < s; y += 16) for (let x = (y / 16 % 2) * 8 + 6; x < s; x += 16) {
    g.beginPath(); g.moveTo(x, y + 4); g.arc(x - 2, y + 1, 2.2, Math.PI * 0.8, Math.PI * 2.0); g.arc(x + 2, y + 1, 2.2, Math.PI, Math.PI * 2.2); g.lineTo(x, y + 6); g.fill();
  }
});
TEX.hearts.wrapS = TEX.hearts.wrapT = THREE.RepeatWrapping; TEX.hearts.repeat.set(2, 1);

// 夜里会亮的共享材质
const GLOW = {
  window: new THREE.MeshStandardMaterial({ color: 0xd8dde3, emissive: 0xffd27a, emissiveMap: TEX.windows, emissiveIntensity: 0, roughness: 0.6 }),
  lantern: new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd54f, emissiveIntensity: 0.3 }),
  coal: new THREE.MeshStandardMaterial({ color: 0x3b2a20, emissive: 0xff6d00, emissiveIntensity: 0.9, flatShading: true }),
  laser: new THREE.MeshStandardMaterial({ color: 0x7a1010, emissive: 0xff2d2d, emissiveIntensity: 0.8 }),
  eel: new THREE.MeshStandardMaterial({ color: 0xc6ff3d, emissive: 0x9cff00, emissiveIntensity: 0.6, flatShading: true }),
  window2: new THREE.MeshStandardMaterial({ color: 0x9fbcd4, emissive: 0xffe0a0, emissiveMap: TEX.windows, emissiveIntensity: 0, roughness: 0.4 }),
  window3: new THREE.MeshStandardMaterial({ color: 0xe6d3b0, emissive: 0xffd27a, emissiveMap: TEX.windows, emissiveIntensity: 0, roughness: 0.7 }),
  window4: new THREE.MeshStandardMaterial({ color: 0x7d8790, emissive: 0xbfe3ff, emissiveMap: TEX.windows, emissiveIntensity: 0, roughness: 0.5 }),
  water: new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x0b84c6, emissiveIntensity: 0.25, transparent: true, opacity: 0.85, roughness: 0.15 }),
};
const WINDOW_MATS = [GLOW.window, GLOW.window2, GLOW.window3, GLOW.window4];
const BEAM_MAT = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
// ---------- 夜间照明：建筑脚下的光斑（加法混合贴地圆片，白天透明）+ 几盏跟着镜头分配的真点光源 ----------
TEX.pool = canvasTex(64, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
// 类型 → [光色, 光斑半径, 点光源强度]；收集网和种植箱不发光
const LIGHT_SPEC = {
  urine: [0xd9ff6b, 0.9, 0.5], filter: [0x6fd3ff, 1.1, 0.6], grill: [0xff8a3d, 1.5, 1.1], turret: [0xffd27a, 1.0, 0.5],
  house: [0xffc56b, 1.7, 1.0], windmill: [0xa6ff3d, 1.8, 1.0], laser: [0xff4d4d, 1.5, 0.8], purifier: [0x5ad1ff, 1.9, 1.0],
  tower: [0xffd27a, 2.4, 1.3], lighthouse: [0xfff2b0, 3.8, 1.8],
};
const POOL_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), POOL_MATS = {};
function addLightPool(g, type) {
  const spec = LIGHT_SPEC[type]; if (!spec) return;
  const m = POOL_MATS[spec[0]] || (POOL_MATS[spec[0]] = new THREE.MeshBasicMaterial({ color: spec[0], map: TEX.pool, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  const p = new THREE.Mesh(POOL_GEO, m); p.scale.setScalar(spec[1] * 2); p.position.y = 0.02; p.renderOrder = 1; g.add(p);
  // 灯塔：在海面高度铺一大片光（木筏地板会挡住，只照亮周围的海），夜里看得清附近的鲨鱼和物资
  if (type === 'lighthouse') { const s = new THREE.Mesh(POOL_GEO, SEA_POOL_MAT); s.scale.setScalar(LH_SEA_R * 2); s.position.y = -0.27; g.add(s); g.userData.sea = s; }
}
const LH_SEA_R = 7;
const SEA_POOL_MAT = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, map: TEX.pool, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const LAMPS = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight(0xffd27a, 0, 6, 1.6); scene.add(l); return l; });
const NET_MAT = new THREE.MeshStandardMaterial({ map: TEX.net, transparent: true, side: THREE.DoubleSide, alphaTest: 0.3 });
const GHOST_OK = new THREE.MeshBasicMaterial({ color: 0x7cdb8a, transparent: true, opacity: 0.45, depthWrite: false });
const GHOST_NO = new THREE.MeshBasicMaterial({ color: 0xff5252, transparent: true, opacity: 0.35, depthWrite: false });

// ---------- 几何体 ----------
const GEO = {
  floor: new THREE.BoxGeometry(0.97, 0.3, 0.97),
  log: new THREE.CylinderGeometry(0.09, 0.09, 0.8, 6),
  bottle: new THREE.CylinderGeometry(0.07, 0.07, 0.32, 8),
  bag: new THREE.IcosahedronGeometry(0.12, 0),
  scrap: new THREE.DodecahedronGeometry(0.25, 0),
  plate: new THREE.BoxGeometry(0.35, 0.04, 0.25),
  barrel: new THREE.CylinderGeometry(0.22, 0.22, 0.55, 10),
  ring: new THREE.TorusGeometry(0.225, 0.025, 4, 12),
  crate: new THREE.BoxGeometry(0.6, 0.6, 0.6),
  beam: new THREE.CylinderGeometry(0.3, 0.3, 6, 12, 1, true),
  hook: new THREE.TorusGeometry(0.1, 0.03, 4, 8, Math.PI * 1.4),
  sharkBody: new THREE.SphereGeometry(0.5, 10, 8),
  fin: new THREE.ConeGeometry(0.22, 0.65, 4),
  spear: new THREE.ConeGeometry(0.05, 0.5, 4),
  puff: new THREE.IcosahedronGeometry(0.15, 0),
};

// ---------- 建筑模型 ----------
const CONTAINER_COLORS = [0xb5532e, 0x2f6fb0, 0x2e7d5b, 0xc9962a, 0x6b7378];
function makeContainer(c) {
  const dark = new THREE.Color(c).multiplyScalar(0.72).getHex(), darker = new THREE.Color(c).multiplyScalar(0.55).getHex();
  const g = grp(mesh(new THREE.BoxGeometry(0.9, 0.62, 0.74), mat(c), 0, 0.31, 0), mesh(new THREE.BoxGeometry(0.92, 0.04, 0.76), mat(darker), 0, 0.63, 0),
    mesh(new THREE.BoxGeometry(0.3, 0.46, 0.02), mat(darker), -0.2, 0.25, 0.38), mesh(new THREE.BoxGeometry(0.16, 0.12, 0.02), GLOW.lantern, 0.2, 0.42, 0.38));
  for (let i = -3; i <= 3; i++) g.add(mesh(new THREE.BoxGeometry(0.02, 0.58, 0.77), mat(dark), i * 0.12, 0.31, 0));
  const ac = grp(mesh(new THREE.BoxGeometry(0.1, 0.24, 0.32), mat(0xeceff1), 0, 0, 0));
  const fan = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 10), mat(0x78909c), 0.06, 0, 0); fan.rotation.z = Math.PI / 2; ac.add(fan);
  ac.position.set(0.51, 0.4, 0); g.add(ac);
  return g;
}
const BUILDERS = {
  filter() {
    const pipe = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.34, 6), mat(0xb0bec5), 0.07, 0.62, 0.18);
    pipe.rotation.z = Math.PI / 2;
    return grp(
      mesh(new THREE.BoxGeometry(0.72, 0.14, 0.72), mat(0xdfe6ea), 0, 0.07, 0),
      mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.62, 12), GLOW.water, -0.12, 0.45, -0.05),
      mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 12), mat(0xf2f4f5), -0.12, 0.79, -0.05),
      mesh(new THREE.ConeGeometry(0.14, 0.18, 8), mat(0xffc53d), -0.12, 0.92, -0.05),
      mesh(new THREE.BoxGeometry(0.22, 0.36, 0.22), mat(0x2f80c9), 0.22, 0.32, 0.18), pipe);
  },
  urine() {
    const pipe = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), mat(0x8d6e63), 0.2, 0.42, 0); pipe.rotation.z = Math.PI / 2;
    return grp(mesh(new THREE.BoxGeometry(0.6, 0.1, 0.6), mat(0x8d6e63), 0, 0.05, 0),
      mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.45, 8), mat(0xe8d36a, { transparent: true, opacity: 0.85, roughness: 0.3 }), -0.05, 0.32, 0),
      mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 8), mat(0x6d4c41), -0.05, 0.57, 0),
      mesh(new THREE.BoxGeometry(0.14, 0.2, 0.14), mat(0x9e9e9e), 0.32, 0.2, 0), pipe);
  },
  grill() {
    const fish = [-0.12, 0.12].map(z => { const f = mesh(new THREE.ConeGeometry(0.07, 0.3, 5), mat(0xff8a65), 0, 0.42, z); f.rotation.z = Math.PI / 2; return f; });
    return grp(
      mesh(new THREE.BoxGeometry(0.6, 0.3, 0.45), mat(0x4a4f55), 0, 0.15, 0),
      mesh(new THREE.BoxGeometry(0.5, 0.05, 0.36), GLOW.coal, 0, 0.32, 0),
      mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), mat(0xb0bec5), -0.25, 0.55, 0), ...fish);
  },
  net() {
    const n = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.6), NET_MAT);
    n.position.set(0, 0.5, 0);
    return grp(
      mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), mat(0x7b5230), -0.42, 0.45, 0),
      mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), mat(0x7b5230), 0.42, 0.45, 0), n);
  },
  planter() {
    const g = grp(mesh(new THREE.BoxGeometry(0.8, 0.25, 0.8), mat(0x6d4c33), 0, 0.12, 0), mesh(new THREE.BoxGeometry(0.7, 0.04, 0.7), mat(0x3e2a1c), 0, 0.26, 0));
    [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([x, z]) => g.add(mesh(new THREE.ConeGeometry(0.13, 0.35, 5), mat(0x66bb6a), x, 0.45, z)));
    return g;
  },
  turret() {
    const barrel = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), mat(0x37474f), 0.3, 0, 0);
    barrel.rotation.z = Math.PI / 2;
    const tip = mesh(GEO.spear, mat(0xffc53d), 0.62, 0, 0); tip.rotation.z = -Math.PI / 2;
    const head = grp(mesh(new THREE.BoxGeometry(0.32, 0.22, 0.32), mat(0x607d8b), 0, 0, 0), barrel, tip);
    head.position.y = 0.45;
    const g = grp(mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.32, 8), mat(0x455a64), 0, 0.16, 0), head,
      mesh(new THREE.BoxGeometry(0.1, 0.06, 0.02), GLOW.lantern, 0, 0.2, 0.32));
    g.userData.head = head; return g;
  },
  house(v = 0) {
    const style = v % 4, c1 = CONTAINER_COLORS[Math.floor(v / 4) % 5], c2 = CONTAINER_COLORS[(Math.floor(v / 4) + 2) % 5];
    const g = new THREE.Group();
    const box = (c, y, rot) => { const b = makeContainer(c); b.position.y = y; if (rot) b.rotation.y = rot; g.add(b); return b; };
    box(c1, 0);
    if (style === 1) {
      box(c2, 0.64, 0.25);
      for (let i = 0; i < 5; i++) g.add(mesh(new THREE.BoxGeometry(0.16, 0.02, 0.02), mat(0x9e9e9e), -0.38, 0.12 + i * 0.22, 0.42));
      [-0.46, -0.3].forEach(x => g.add(mesh(new THREE.BoxGeometry(0.02, 1.1, 0.02), mat(0x9e9e9e), x, 0.55, 0.42)));
    } else if (style === 2) {
      const tent = mesh(new THREE.ConeGeometry(0.4, 0.38, 4), mat([0xe53935, 0x43a047, 0x1e88e5][v % 3]), -0.12, 0.84, 0); tent.rotation.y = Math.PI / 4; g.add(tent);
      [[0.3, 0.2], [0.3, -0.2]].forEach(([x, z]) => { g.add(mesh(new THREE.BoxGeometry(0.16, 0.1, 0.16), mat(0x6d4c41), x, 0.7, z)); g.add(mesh(new THREE.SphereGeometry(0.1, 6, 4), mat(0x66bb6a), x, 0.82, z)); });
    } else if (style === 3) {
      g.add(mesh(new THREE.BoxGeometry(0.26, 0.18, 0.02), GLOW.lantern, -0.18, 0.4, -0.38));
      g.add(mesh(new THREE.BoxGeometry(0.5, 0.04, 0.3), mat(0x8d6e63), 0, 0.7, 0.2));
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), mat(0x9e9e9e), 0.2, 0.95, 0.2));
      g.add(mesh(new THREE.BoxGeometry(0.3, 0.18, 0.02), mat([0xffc53d, 0xe53935, 0x29b6f6][v % 3]), 0.2, 1.12, 0.2));
    }
    return g;
  },
  windmill() {
    const eel = new THREE.Group();
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 1.6; eel.add(mesh(new THREE.SphereGeometry(0.07 - i * 0.006, 6, 4), GLOW.eel, Math.cos(a) * 0.2, 0.02 * i, Math.sin(a) * 0.2)); }
    eel.position.y = 0.45;
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.62, 0.72), new THREE.MeshStandardMaterial({ color: 0x9be7ff, transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false }));
    tank.position.y = 0.45;
    const g = grp(mesh(new THREE.BoxGeometry(0.8, 0.14, 0.8), mat(0x37474f), 0, 0.07, 0), eel, tank,
      mesh(new THREE.BoxGeometry(0.8, 0.06, 0.8), mat(0x37474f), 0, 0.79, 0),
      mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 4), mat(0xffc53d), 0.3, 1.0, 0.3),
      mesh(new THREE.SphereGeometry(0.07, 6, 4), GLOW.eel, 0.3, 1.22, 0.3));
    g.userData.spin = eel; return g;
  },
  toilet() {
    const g = grp(mesh(new THREE.BoxGeometry(0.34, 0.3, 0.3), mat(0xffc53d, { metalness: 0.3, roughness: 0.35, emissive: 0x7a5200, emissiveIntensity: 0.35 }), 0, 0.15, 0),
      mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.18, 12), mat(0xffc53d, { metalness: 0.3, roughness: 0.35, emissive: 0x7a5200, emissiveIntensity: 0.35 }), 0.12, 0.38, 0),
      mesh(new THREE.BoxGeometry(0.12, 0.5, 0.42), mat(0xffd76a, { metalness: 0.3, roughness: 0.35, emissive: 0x7a5200, emissiveIntensity: 0.35 }), -0.18, 0.5, 0));
    return g;
  },
  laser() {
    const head = grp(mesh(new THREE.BoxGeometry(0.26, 0.18, 0.2), mat(0x263238), 0, 0, 0), mesh(new THREE.SphereGeometry(0.11, 8, 6), GLOW.laser, 0.16, 0, 0));
    head.position.y = 0.72;
    const g = grp(mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), mat(0x37474f), 0, 0.09, 0), mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.5, 6), mat(0x546e7a), 0, 0.42, 0), head);
    g.userData.head = head; return g;
  },
  purifier() {
    return grp(mesh(new THREE.BoxGeometry(0.86, 0.5, 0.5), mat(0xeceff1), 0, 0.25, 0.18),
      mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.8, 10), GLOW.water, -0.22, 0.4, -0.22),
      mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.8, 10), GLOW.water, 0.22, 0.4, -0.22),
      mesh(new THREE.BoxGeometry(0.86, 0.06, 0.5), mat(0x2f80c9), 0, 0.53, 0.18),
      mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), mat(0x90a4ae), 0.3, 0.75, 0.25),
      mesh(new THREE.SphereGeometry(0.07, 8, 6), GLOW.lantern, 0.3, 1.03, 0.25));
  },
  tower(v = 0) {
    const style = v % 5, wm = WINDOW_MATS[Math.floor(v / 5) % WINDOW_MATS.length], h = 1.7 + ((v * 37) % 100) / 100 * 2.1;
    const gold = mat(0xffc53d, { metalness: 0.3, roughness: 0.35, emissive: 0x7a5200, emissiveIntensity: 0.35 });
    if (style === 0) return grp(mesh(new THREE.BoxGeometry(0.8, h, 0.8), wm, 0, h / 2, 0), mesh(new THREE.BoxGeometry(0.84, 0.08, 0.84), gold, 0, h + 0.04, 0),
      mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), mat(0x90a4ae), 0.15, h + 0.2, 0.1), mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4), mat(0xeceff1), -0.2, h + 0.38, -0.2));
    if (style === 1) { const a = h * 0.5, b = h * 0.3, c = h * 0.2;
      return grp(mesh(new THREE.BoxGeometry(0.86, a, 0.86), wm, 0, a / 2, 0), mesh(new THREE.BoxGeometry(0.64, b, 0.64), wm, 0, a + b / 2, 0),
        mesh(new THREE.BoxGeometry(0.42, c, 0.42), wm, 0, a + b + c / 2, 0), mesh(new THREE.ConeGeometry(0.06, 0.5, 6), gold, 0, h + 0.25, 0)); }
    if (style === 2) return grp(mesh(new THREE.CylinderGeometry(0.38, 0.42, h, 12), wm, 0, h / 2, 0),
      mesh(new THREE.SphereGeometry(0.38, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), gold, 0, h, 0), mesh(new THREE.TorusGeometry(0.41, 0.03, 4, 16), mat(0xeceff1), 0, h * 0.55, 0).rotateX(Math.PI / 2));
    if (style === 3) { const h2 = h * 0.75;
      return grp(mesh(new THREE.BoxGeometry(0.34, h, 0.6), wm, -0.24, h / 2, 0), mesh(new THREE.BoxGeometry(0.34, h2, 0.6), wm, 0.24, h2 / 2, 0),
        mesh(new THREE.BoxGeometry(0.2, 0.14, 0.3), mat(0xeceff1), 0, h2 * 0.8, 0), mesh(new THREE.BoxGeometry(0.36, 0.05, 0.62), gold, -0.24, h + 0.02, 0)); }
    const pool = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.8), new THREE.MeshStandardMaterial({ color: 0x29b6f6, emissive: 0x0b84c6, emissiveIntensity: 0.4, roughness: 0.1 }));
    pool.position.set(0.24, 0.03, 0);
    return grp(mesh(new THREE.BoxGeometry(0.5, 0.5, 0.8), wm, -0.15, 0.25, 0), mesh(new THREE.BoxGeometry(0.42, 0.4, 0.6), wm, -0.2, 0.7, 0.05),
      mesh(new THREE.BoxGeometry(0.56, 0.05, 0.86), mat(0xf5f5f5), -0.15, 0.51, 0), mesh(new THREE.BoxGeometry(0.48, 0.05, 0.66), gold, -0.2, 0.92, 0.05), pool,
      mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.5, 4), mat(0x8d6e63), 0.36, 0.25, -0.32), mesh(new THREE.ConeGeometry(0.2, 0.1, 5), mat(0x43a047), 0.36, 0.52, -0.32));
  },
  lighthouse() {
    const g = grp(mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.7, 10), mat(0xf5f5f5), 0, 0.35, 0),
      mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.7, 10), mat(0xe53935), 0, 1.05, 0),
      mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.5, 10), mat(0xf5f5f5), 0, 1.65, 0),
      mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.26, 10), GLOW.lantern, 0, 2.03, 0),
      mesh(new THREE.ConeGeometry(0.22, 0.25, 10), mat(0xe53935), 0, 2.3, 0));
    return g;
  },
};

// ---------- 漂浮物模型 ----------
function makeDebris(type) {
  const g = new THREE.Group();
  if (type === 'wood') {
    const n = randi(2, 3);
    for (let i = 0; i < n; i++) { const m = mesh(GEO.log, mat(0x8d5a2b)); m.rotation.z = Math.PI / 2; m.rotation.y = rand(-0.3, 0.3); m.position.set(rand(-0.15, 0.15), 0, (i - (n - 1) / 2) * 0.2); g.add(m); }
  } else if (type === 'plastic') {
    for (let i = 0; i < 2; i++) { const b = mesh(GEO.bottle, mat(i ? 0x7fd3ff : 0xf2f4f5, { roughness: 0.3 })); b.rotation.z = Math.PI / 2; b.rotation.y = rand(0, 3); b.position.set(rand(-0.2, 0.2), 0, i * 0.25 - 0.12); g.add(b); }
    g.add(mesh(GEO.bag, mat(0xffe082), 0.2, 0, 0.12));
  } else if (type === 'scrap') {
    const a = mesh(GEO.scrap, mat(0x8a9097, { metalness: 0.6, roughness: 0.4 })); a.scale.set(1, 0.5, 0.8); g.add(a);
    const b = mesh(GEO.plate, mat(0x6d747b, { metalness: 0.6 }), 0.2, 0.05, 0.1); b.rotation.y = 0.6; g.add(b);
  } else if (type === 'barrel') {
    const b = mesh(GEO.barrel, mat(0x2f7fd1)); b.rotation.z = Math.PI / 2; g.add(b);
    for (const x of [-0.18, 0.18]) { const r = mesh(GEO.ring, mat(0xf2f4f5), x, 0, 0); r.rotation.y = Math.PI / 2; g.add(r); }
  } else if (type === 'cat') {
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.36, 0.5), mat(0xc8a26b), 0, 0, 0));
    const c = makeCat(); c.position.set(0, 0.05, 0); c.scale.setScalar(1.3); g.add(c);
  } else if (type === 'goldbar') {
    g.add(mesh(new THREE.BoxGeometry(0.7, 0.16, 0.22), mat(0xffc53d, { emissive: 0xffa000, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.35 })));
    g.add(mesh(new THREE.SphereGeometry(0.1, 6, 4), mat(0xffc53d, { metalness: 0.3, roughness: 0.35, emissive: 0x7a5200, emissiveIntensity: 0.35 }), 0.38, 0, 0));
    g.add(mesh(new THREE.SphereGeometry(0.1, 6, 4), mat(0xffc53d, { metalness: 0.3, roughness: 0.35, emissive: 0x7a5200, emissiveIntensity: 0.35 }), -0.38, 0, 0));
  } else if (type === 'ac') {
    g.add(mesh(new THREE.BoxGeometry(0.6, 0.42, 0.3), mat(0xeceff1), 0, 0, 0));
    const fan = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 12), mat(0x78909c), 0.1, 0, 0.16); fan.rotation.x = Math.PI / 2; g.add(fan);
  } else if (type === 'sword') {
    const gold = mat(0xffc53d, { emissive: 0xffa000, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.3 });
    const blade = mesh(new THREE.BoxGeometry(1.1, 0.04, 0.14), mat(0xe8eef2, { emissive: 0x9fd8ff, emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.2 }), 0.2, 0, 0);
    g.add(blade, mesh(new THREE.BoxGeometry(0.08, 0.08, 0.42), gold, -0.38, 0, 0), mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), mat(0x8d3b2a), -0.55, 0, 0).rotateZ(Math.PI / 2), mesh(new THREE.SphereGeometry(0.06, 6, 4), gold, -0.72, 0, 0));
    const beam = new THREE.Mesh(GEO.beam, BEAM_MAT); beam.position.y = 3; beam.scale.set(0.6, 1, 0.6); g.add(beam);
  } else if (type === 'gold') {
    g.add(mesh(GEO.crate, mat(0xffc53d, { emissive: 0xffa000, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.3 })));
    g.add(mesh(new THREE.BoxGeometry(0.64, 0.1, 0.64), mat(0x8d6e63), 0, 0.12, 0));
    const beam = new THREE.Mesh(GEO.beam, BEAM_MAT); beam.position.y = 3; g.add(beam);
  }
  g.scale.setScalar(1.25);
  return g;
}

// ---------- 鲨鱼模型 ----------
function makeShark(boss) {
  const bodyMat = new THREE.MeshStandardMaterial({ color: boss ? 0x2e3a4a : 0x4b5d6b, roughness: 0.6, flatShading: true, emissive: 0xff0000, emissiveIntensity: 0 });
  const body = mesh(GEO.sharkBody, bodyMat); body.scale.set(2.2, 0.6, 0.75);
  const fin = mesh(GEO.fin, bodyMat, -0.05, 0.42, 0); fin.scale.set(1.3, 1.3, 0.35); fin.rotation.z = -0.3;
  const tail = mesh(GEO.fin, bodyMat, -1.2, 0.05, 0); tail.scale.z = 0.3; tail.rotation.z = Math.PI / 2;
  const g = grp(body, fin, tail);
  if (boss) {
    [-0.18, 0.18].forEach(z => g.add(mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3d3d }), 0.85, 0.12, z)));
    g.scale.setScalar(2.4);
  }
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x1d1d1f, depthTest: false, transparent: true, opacity: 0.75 }));
  const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff5252, depthTest: false }));
  const w = boss ? 3 : 1.1;
  bg.scale.set(w, 0.12, 1); fg.scale.set(w, 0.12, 1); bg.renderOrder = 10; fg.renderOrder = 11;
  const bar = grp(bg, fg); bar.visible = false; scene.add(bar);
  return { g, bodyMat, bar, fg, barW: w };
}

// ---------- 路过的富人游艇 ----------
// ---------- 末日：沉没的城市 ----------
const TEX_RUIN = canvasTex(128, (g, s) => {
  g.fillStyle = '#5f676b'; g.fillRect(0, 0, s, s);
  for (let y = 6; y < s; y += 14) for (let x = 6; x < s; x += 12) { const r = Math.random(); g.fillStyle = r < 0.18 ? '#121517' : r < 0.26 ? '#3d6a78' : '#2b3134'; g.fillRect(x, y, 7, 9); }
  for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(120,70,40,.35)'; g.fillRect(Math.random() * s, 0, 3 + Math.random() * 6, s * Math.random()); }
  g.fillStyle = 'rgba(40,70,55,.5)'; g.fillRect(0, s * 0.82, s, s * 0.18);
});
function textTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return new THREE.CanvasTexture(c); }
function makeSign(a, b) {
  const tex = textTex(512, 256, (g, w, h) => {
    g.fillStyle = '#1f6b3a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8efe9'; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#e8efe9'; g.textAlign = 'center'; g.font = 'bold 84px PingFang SC, Microsoft YaHei, sans-serif'; g.fillText(a, w / 2, h * 0.47);
    g.font = 'bold 56px PingFang SC, Microsoft YaHei, sans-serif'; g.fillText(b, w / 2, h * 0.8);
    g.fillStyle = 'rgba(120,70,40,.45)'; for (let i = 0; i < 5; i++) g.fillRect(Math.random() * w, Math.random() * h * 0.3, 6, h * Math.random());
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }));
  board.position.y = 4;
  return grp(board, mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 6), mat(0x6b7378), -1.6, 1.5, -0.05), mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 6), mat(0x6b7378), 1.6, 1.5, -0.05));
}
function makeRuins() {
  const root = new THREE.Group(), placed = [];
  function spot(minR, maxR, size) {
    for (let k = 0; k < 40; k++) {
      const a = rand(0, Math.PI * 2), r = rand(minR, maxR), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (placed.every(p => Math.hypot(p[0] - x, p[1] - z) > p[2] + size + 2)) { placed.push([x, z, size]); return [x, z]; }
    }
    return [rand(-70, 70), rand(-70, 70)];
  }
  for (let i = 0; i < 16; i++) {
    const w = rand(3, 6), d = rand(3, 6), h = rand(6, 18), [x, z] = spot(20, 62, Math.max(w, d) / 2);
    const t = TEX_RUIN.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 3)));
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
    b.position.set(x, h / 2 - rand(1.5, 4), z); b.rotation.set(rand(-0.12, 0.12), rand(0, 3), rand(-0.12, 0.12)); b.receiveShadow = true;
    if (Math.random() < 0.6) b.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 8), mat(0x7d6a5a), rand(-w / 4, w / 4), h / 2 + 0.5, rand(-d / 4, d / 4)));
    if (Math.random() < 0.5) { const an = mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 4), mat(0x555b5e), rand(-w / 3, w / 3), h / 2 + 1.4, 0); an.rotation.z = rand(-0.6, 0.6); b.add(an); }
    if (Math.random() < 0.4) { const slab = mesh(new THREE.BoxGeometry(w * 0.6, 0.3, d * 0.5), mat(0x6b7378), rand(-0.5, 0.5), h / 2 + 0.2, 0); slab.rotation.z = rand(0.3, 0.6); b.add(slab); }
    root.add(b);
  }
  for (let i = 0; i < 10; i++) {
    const [x, z] = spot(11, 32, 0.5), h = rand(3, 4.5);
    const lamp = grp(mesh(new THREE.CylinderGeometry(0.07, 0.09, h, 6), mat(0x4a5256), 0, h / 2 - 1, 0),
      mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), mat(0x4a5256), 0.4, h - 1, 0), mesh(new THREE.BoxGeometry(0.3, 0.1, 0.18), mat(0x9aa3a7), 0.85, h - 1.05, 0));
    lamp.position.set(x, 0, z); lamp.rotation.set(rand(-0.3, 0.3), rand(0, 6), rand(-0.3, 0.3)); root.add(lamp);
  }
  for (let i = 0; i < 6; i++) {
    const [x, z] = spot(14, 45, 0.5);
    const pole = grp(mesh(new THREE.CylinderGeometry(0.1, 0.12, 6, 6), mat(0x5b4a3c), 0, 2, 0), mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), mat(0x5b4a3c), 0, 4.6, 0));
    pole.position.set(x, 0, z); pole.rotation.set(rand(-0.35, 0.35), rand(0, 6), rand(-0.35, 0.35)); root.add(pole);
  }
  for (let i = 0; i < 3; i++) {
    const [x, z] = spot(13, 36, 3);
    const bus = grp(mesh(new THREE.BoxGeometry(2.4, 0.8, 6), mat(0xa88a3a), 0, -0.25, 0), mesh(new THREE.BoxGeometry(2.42, 0.25, 5.6), mat(0x1d2326), 0, -0.05, 0),
      mesh(new THREE.BoxGeometry(1.2, 0.25, 1.4), mat(0x8a9196), 0, 0.25, 1), mesh(new THREE.BoxGeometry(2.3, 0.04, 0.6), mat(0x6b4a2a), 0, 0.17, -2.2));
    bus.position.set(x, 0, z); bus.rotation.set(rand(-0.06, 0.06), rand(0, 6), rand(-0.06, 0.06)); root.add(bus);
  }
  {
    const [x, z] = spot(38, 50, 8), wheel = new THREE.Group();
    wheel.add(mesh(new THREE.TorusGeometry(7, 0.25, 6, 40), mat(0xd8d2c4)));
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, sp = mesh(new THREE.BoxGeometry(0.12, 7, 0.12), mat(0xd8d2c4), Math.cos(a) * 3.5, Math.sin(a) * 3.5, 0); sp.rotation.z = a - Math.PI / 2; wheel.add(sp);
      wheel.add(mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), mat([0xe57373, 0x64b5f6, 0xffd54f][i % 3]), Math.cos(a) * 7, Math.sin(a) * 7 - 0.6, 0));
    }
    wheel.position.set(x, 2.5, z); wheel.rotation.set(0, rand(0, 3), rand(-0.25, 0.25)); root.add(wheel);
  }
  [['外环高速', '出口 2km'], ['人民广场', '↓ 已淹没'], ['前方海域', '鲨鱼出没']].forEach(([a, b]) => {
    const [x, z] = spot(13, 28, 2), s = makeSign(a, b);
    s.position.set(x, -1, z); s.rotation.set(rand(-0.15, 0.15), Math.atan2(-x, -z) + rand(-0.4, 0.4), rand(-0.15, 0.15)); root.add(s);
  });
  return root;
}
scene.add(makeRuins());

// ---------- 雨 ----------
const RAIN_N = IS_TOUCH ? 700 : 1400, rainPos = new Float32Array(RAIN_N * 6);
for (let i = 0; i < RAIN_N; i++) { const x = rand(-28, 28), y = rand(0, 24), z = rand(-28, 28); rainPos.set([x, y, z, x + 0.18, y - 1, z], i * 6); }
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.LineBasicMaterial({ color: 0xd5e3ea, transparent: true, opacity: 0, fog: false });
const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; scene.add(rain);
function updateRain(dt, amount, cx, cz) {
  rainMat.opacity = 0.42 * amount; rain.visible = amount > 0.03; if (!rain.visible) return;
  rain.position.set(cx, 0, cz);
  for (let i = 0; i < RAIN_N; i++) {
    const k = i * 6; rainPos[k + 1] -= dt * 24; rainPos[k + 4] -= dt * 24; rainPos[k] -= dt * 4; rainPos[k + 3] -= dt * 4;
    if (rainPos[k + 4] < 0) { const x = rand(-28, 28), y = rand(20, 26), z = rand(-28, 28); rainPos.set([x, y, z, x + 0.18, y - 1, z], k); }
  }
  rainGeo.attributes.position.needsUpdate = true;
}

function makeYacht() {
  const hull = mesh(new THREE.BoxGeometry(2.6, 0.45, 1), mat(0xf5f5f5), 0, 0.15, 0);
  const bow = mesh(new THREE.ConeGeometry(0.5, 0.9, 4), mat(0xf5f5f5), 1.7, 0.15, 0); bow.rotation.z = -Math.PI / 2; bow.rotation.x = Math.PI / 4; bow.scale.set(1, 1, 0.7);
  return grp(hull, bow, mesh(new THREE.BoxGeometry(1.2, 0.42, 0.8), mat(0x4fc3f7, { roughness: 0.2 }), -0.2, 0.58, 0),
    mesh(new THREE.BoxGeometry(0.7, 0.3, 0.7), mat(0xf5f5f5), -0.3, 0.92, 0),
    mesh(new THREE.BoxGeometry(2.62, 0.08, 1.02), mat(0x1565c0), 0, 0.02, 0),
    mesh(new THREE.BoxGeometry(0.3, 0.2, 0.02), mat(0xffc53d), -1.1, 1.2, 0),
    mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4), mat(0xeceff1), -1.25, 1.0, 0));
}

// ---------- 肥强、阿水、哈吉米 ----------
function makeFeiqiang() {
  const skin = mat(0xf2b98a), shirt = mat(0xf3efe6), dark = mat(0x2b2b2b);
  const shorts = new THREE.MeshStandardMaterial({ map: TEX.hearts, roughness: 0.8 });
  const belly = mesh(new THREE.SphereGeometry(0.25, 10, 8), shirt, 0, 0.5, 0.02); belly.scale.set(1, 1.1, 0.95);
  const g = grp(belly,
    mesh(new THREE.CylinderGeometry(0.21, 0.2, 0.14, 10), shorts, 0, 0.27, 0),
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 6), skin, -0.1, 0.12, 0),
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 6), skin, 0.1, 0.12, 0),
    mesh(new THREE.BoxGeometry(0.1, 0.03, 0.16), mat(0xe53935), -0.1, 0.015, 0.03),
    mesh(new THREE.BoxGeometry(0.1, 0.03, 0.16), mat(0xe53935), 0.1, 0.015, 0.03),
    mesh(new THREE.SphereGeometry(0.17, 10, 8), skin, 0, 0.9, 0),
    mesh(new THREE.SphereGeometry(0.05, 6, 4), mat(0xffead6), 0.03, 1.04, 0.04),
    mesh(new THREE.SphereGeometry(0.022, 4, 3), dark, -0.06, 0.93, 0.15),
    mesh(new THREE.SphereGeometry(0.022, 4, 3), dark, 0.06, 0.93, 0.15),
    mesh(new THREE.BoxGeometry(0.14, 0.05, 0.03), mat(0x5d5149), 0, 0.84, 0.15));
  [[0.12, 0.57], [-0.1, 0.44], [0.04, 0.36]].forEach(([x, y]) => g.add(mesh(new THREE.SphereGeometry(0.035, 5, 4), skin, x, y, 0.22)));
  [-1, 1].forEach(s => { const a = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 6), skin, s * 0.29, 0.55, 0); a.rotation.z = s * 0.35; g.add(a); });
  return g;
}
// 阿水：第一个是广告里的样子——乱糟糟黑发、红色无袖背心、牛仔裤；后面来的幸存者换衣服颜色
function makeAshui(shirtColor, hairColor = 0x1d1d1f, legsColor = 0x37474f, messy = false) {
  const skin = mat(0xf5c9a0);
  const hair = mesh(new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(hairColor), 0, 0.88, -0.01);
  const g = grp(mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.42, 8), mat(shirtColor), 0, 0.48, 0),
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.28, 6), mat(legsColor), -0.06, 0.14, 0),
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.28, 6), mat(legsColor), 0.06, 0.14, 0),
    mesh(new THREE.SphereGeometry(0.14, 8, 6), skin, 0, 0.83, 0), hair);
  if (messy) for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, sp = mesh(new THREE.ConeGeometry(0.05, 0.14, 4), mat(hairColor), Math.cos(a) * 0.1, 0.98, Math.sin(a) * 0.1); sp.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); g.add(sp); }
  else return g;
  [-1, 1].forEach(sd => { const arm = mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.32, 6), skin, sd * 0.17, 0.5, 0); arm.rotation.z = sd * 0.18; g.add(arm); });
  return g;
}
function makeCat() {
  const fur = mat(0xf4a340);
  const tail = mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.25, 4), fur, 0, 0.2, -0.2); tail.rotation.x = -0.7;
  return grp(mesh(new THREE.BoxGeometry(0.16, 0.13, 0.28), fur, 0, 0.12, 0),
    mesh(new THREE.SphereGeometry(0.09, 8, 6), fur, 0, 0.22, 0.16),
    mesh(new THREE.ConeGeometry(0.035, 0.07, 4), fur, -0.05, 0.31, 0.16),
    mesh(new THREE.ConeGeometry(0.035, 0.07, 4), fur, 0.05, 0.31, 0.16),
    mesh(new THREE.SphereGeometry(0.015, 4, 3), mat(0x1d1d1f), -0.035, 0.24, 0.24),
    mesh(new THREE.SphereGeometry(0.015, 4, 3), mat(0x1d1d1f), 0.035, 0.24, 0.24), tail);
}
// ---------- 坐骑（朝 +z 前进） ----------
function makeMount(kind) {
  if (kind === 'tub') {
    const tub = mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.36, 14), mat(0xe53935, { roughness: 0.4 }), 0, 0.12, 0); tub.scale.z = 1.3;
    const rim = mesh(new THREE.TorusGeometry(0.55, 0.04, 4, 16), mat(0xf5f5f5), 0, 0.3, 0); rim.rotation.x = Math.PI / 2; rim.scale.y = 1.3;
    const paddle = grp(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 5), mat(0x8d5a2b), 0, 0, 0), mesh(new THREE.BoxGeometry(0.14, 0.24, 0.03), mat(0x8d5a2b), 0, -0.48, 0));
    paddle.position.set(0.5, 0.45, 0); paddle.rotation.z = 0.5;
    const g = grp(tub, rim, mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.02, 14), mat(0x9be7ff), 0, 0.26, 0), paddle);
    g.userData.paddle = paddle; g.userData.seat = 0.0; return g;
  }
  if (kind === 'jetski') {
    const nose = mesh(new THREE.ConeGeometry(0.3, 0.5, 4), mat(0xffc53d), 0, 0.15, 0.85); nose.rotation.x = Math.PI / 2; nose.rotation.y = Math.PI / 4;
    const g = grp(mesh(new THREE.BoxGeometry(0.6, 0.3, 1.3), mat(0xffc53d, { roughness: 0.3 }), 0, 0.15, 0), nose,
      mesh(new THREE.BoxGeometry(0.4, 0.14, 0.6), mat(0x263238), 0, 0.37, -0.15),
      mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), mat(0x263238), 0, 0.6, 0.35),
      mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 4), mat(0x263238), 0, 0.45, 0.35),
      mesh(new THREE.BoxGeometry(0.62, 0.06, 1.32), mat(0x1565c0), 0, 0.02, 0));
    g.userData.seat = 0.15; return g;
  }
  const y = makeYacht(); y.rotation.y = -Math.PI / 2; y.scale.setScalar(0.75);
  const g = grp(y); g.userData.seat = 0.55; return g;
}

// ---------- 主角 ----------
function makeAvatar() {
  return grp(
    mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.45, 8), mat(0xff7043), 0, 0.53, 0),
    mesh(new THREE.SphereGeometry(0.13, 8, 6), mat(0xffcc99), 0, 0.9, 0),
    mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 10), mat(0xe6c35c), 0, 1.02, 0),
    mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.1, 10), mat(0xe6c35c), 0, 1.08, 0),
    mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 6), mat(0x3949ab), -0.07, 0.15, 0),
    mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 6), mat(0x3949ab), 0.07, 0.15, 0));
}
