// ================= 环境音：海浪 + 雨 =================
let ambient = null;
function startAmbient() {
  if (!AC || ambient) return;
  try {
    const len = AC.sampleRate * 3, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const sea = AC.createBufferSource(); sea.buffer = buf; sea.loop = true;
    const seaLp = AC.createBiquadFilter(); seaLp.type = 'lowpass'; seaLp.frequency.value = 420;
    const seaGain = AC.createGain(); seaGain.gain.value = 0.05;
    const lfo = AC.createOscillator(); lfo.frequency.value = 0.13;
    const lfoGain = AC.createGain(); lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(seaGain.gain);
    sea.connect(seaLp).connect(seaGain).connect(AC.destination);
    const rainSrc = AC.createBufferSource(); rainSrc.buffer = buf; rainSrc.loop = true; rainSrc.playbackRate.value = 1.3;
    const rainHp = AC.createBiquadFilter(); rainHp.type = 'bandpass'; rainHp.frequency.value = 1400; rainHp.Q.value = 0.5;
    const rainGain = AC.createGain(); rainGain.gain.value = 0;
    rainSrc.connect(rainHp).connect(rainGain).connect(AC.destination);
    sea.start(); lfo.start(); rainSrc.start();
    ambient = { seaGain, rainGain };
  } catch (e) {}
}
function updateAmbient() {
  if (!ambient) return;
  const t = AC.currentTime;
  const on = soundMode === 0;
  ambient.seaGain.gain.setTargetAtTime(on ? 0.035 + wStorm * 0.015 : 0, t, 0.3);
  ambient.rainGain.gain.setTargetAtTime(on ? wRain * 0.02 : 0, t, 0.3);
}

// ================= 开场剧情 =================
function makeBoss(suit) {
  const s = mat(suit), skin = mat(0xe0a679);
  const g = grp(
    mesh(new THREE.BoxGeometry(0.62, 0.55, 0.34), s, 0, 0.66, 0),
    mesh(new THREE.BoxGeometry(0.14, 0.3, 0.02), mat(0xf5f5f5), 0, 0.72, 0.175),
    mesh(new THREE.BoxGeometry(0.05, 0.26, 0.02), mat(0xc62828), 0, 0.7, 0.19),
    mesh(new THREE.BoxGeometry(0.16, 0.5, 0.18), s, -0.39, 0.64, 0),
    mesh(new THREE.BoxGeometry(0.16, 0.5, 0.18), s, 0.39, 0.64, 0),
    mesh(new THREE.BoxGeometry(0.16, 0.38, 0.18), mat(0x263238), -0.1, 0.19, 0),
    mesh(new THREE.BoxGeometry(0.16, 0.38, 0.18), mat(0x263238), 0.1, 0.19, 0),
    mesh(new THREE.SphereGeometry(0.15, 8, 6), skin, 0, 1.08, 0),
    mesh(new THREE.BoxGeometry(0.3, 0.08, 0.3), mat(0x1d1d1f), 0, 1.2, -0.02),
    mesh(new THREE.BoxGeometry(0.26, 0.06, 0.04), mat(0x111111), 0, 1.1, 0.14));
  return g;
}
function makeShelter() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(10, 0.8, 7), mat(0x55606a), 0, 0.1, 0));
  const cols = [0x2f7fd1, 0xb5532e, 0x2e7d5b, 0xd8a531, 0x8e44ad];
  [[-3.6, -2.2], [-1.2, -2.2], [1.2, -2.2], [3.6, -2.2], [-3.6, -1.0], [3.6, -1.0]].forEach(([x, z], i) => g.add(mesh(new THREE.BoxGeometry(2.3, 1.1, 1.1), mat(cols[i % 5]), x, 1.05, z)));
  [[-2.4, -2.2], [0, -2.2], [2.4, -2.2]].forEach(([x, z], i) => g.add(mesh(new THREE.BoxGeometry(2.3, 1.1, 1.1), mat(cols[(i + 2) % 5]), x, 2.15, z)));
  g.add(mesh(new THREE.BoxGeometry(4.2, 2.3, 0.3), mat(0xeef1f3), 0, 1.65, -0.8));
  g.add(mesh(new THREE.BoxGeometry(1.1, 1.7, 0.05), mat(0x37474f), 0, 1.35, -0.63));
  const signTex = textTex(512, 160, (c, w, h) => {
    c.fillStyle = '#16324f'; c.fillRect(0, 0, w, h); c.strokeStyle = '#FFC53D'; c.lineWidth = 8; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#FFC53D'; c.textAlign = 'center'; c.font = 'bold 92px PingFang SC, Microsoft YaHei, sans-serif'; c.fillText('高级庇护所', w / 2, h * 0.68);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1), new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.6 }));
  sign.position.set(0, 3.25, -0.63); g.add(sign);
  [-3.2, 3.2].forEach(x => { const f = BUILDERS.filter(); f.scale.setScalar(1.8); f.position.set(x, 0.5, 0.9); g.add(f); });
  [-4.6, 4.6].forEach(x => { g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), mat(0x37474f), x, 1.3, 3.2)); g.add(mesh(new THREE.SphereGeometry(0.16, 8, 6), GLOW.lantern, x, 2.15, 3.2)); });
  for (let x = -4.5; x <= 4.5; x += 0.75) if (Math.abs(x) > 0.9) g.add(mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), mat(0x90a4ae), x, 0.75, 3.4));
  g.add(mesh(new THREE.BoxGeometry(9, 0.05, 0.05), mat(0x90a4ae), 0, 0.98, 3.4));
  return g;
}

const CS = { active: false, t: 0, group: null, weather: 'overcast', fired: {}, onEnd: null };
const CS_END = 26.5;
const CS_SUBS = [
  [0.6, 4.2, '旁白', '陆地沉没的第三年。能活下来的人，都挤在高级庇护所里。'],
  [4.4, 7.4, '庇护所老板', '连个海水过滤器都没有，也配住高级庇护所？'],
  [7.5, 10.0, '肥强', '老板，我……我能干活，我力气大！'],
  [10.1, 11.6, '庇护所老板', '滚！'],
  [12.4, 14.4, '旁白', '打车不让坐，吃饭不让吃，洗澡没有水……'],
  [14.5, 17.0, '游艇上的富人', '哟，这不是肥强吗？连个澡盆都没有？'],
  [17.2, 19.4, '肥强', '三十年河东，三十年河西……'],
  [19.5, 22.4, '肥强', '我这就去打捞海水过滤器，住进高级庇护所！'],
];
const VOICE = { '旁白': [330, 0.02, 'triangle'], '庇护所老板': [150, 0.035, 'square'], '肥强': [230, 0.035, 'square'], '游艇上的富人': [520, 0.03, 'square'] };
// 打字机效果：没打出来的字先占位（透明），气泡和字幕的宽度不会跳
function typeInto(el, full, n) {
  const k = full + '|' + n; if (el._k === k) return; el._k = k;
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  el.innerHTML = esc(full.slice(0, n)) + '<span style="opacity:0">' + esc(full.slice(n)) + '</span>';
}
const WHO_COLOR = { '旁白': 'rgba(255,255,255,.55)', '庇护所老板': '#ff8a80', '肥强': '#FFC53D', '游艇上的富人': '#9be7ff' };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

function playIntro(onEnd) {
  audioInit(); startAmbient();
  CS.active = true; CS.t = 0; CS.fired = {}; CS.weather = 'overcast'; CS.onEnd = onEnd;
  const g = new THREE.Group(); CS.group = g; scene.add(g);
  const shelter = makeShelter(); shelter.position.set(0, 0, -7); g.add(shelter);
  CS.boss = makeBoss(0x1d1d1f); CS.boss.position.set(0, 0.5, -6.8); g.add(CS.boss);
  CS.qiang = makeFeiqiang(); CS.qiang.position.set(0, 0.5, -6.0); CS.qiang.rotation.y = Math.PI; g.add(CS.qiang);
  CS.wall = mesh(new THREE.BoxGeometry(1.6, 1.3, 0.18), mat(0xeef1f3), 3.0, 0.3, 3.0); CS.wall.rotation.y = -0.4; g.add(CS.wall);
  CS.tub = makeMount('tub'); CS.tub.position.set(4.6, 0, 2.4); g.add(CS.tub);
  CS.yacht = makeYacht(); CS.yacht.position.set(-30, 0, 7.5); g.add(CS.yacht);
  const rich = makeBoss(0xd4a017); rich.position.set(-0.3, 0.55, 0); rich.rotation.y = Math.PI; rich.scale.setScalar(0.8); CS.yacht.add(rich);
  CS.tubX = 4.6;
  raft.visible = false; if (mount.g) mount.g.visible = false;
  $('#start').classList.remove('show'); $('#hud').style.display = 'none';
  $('#cut').classList.add('show'); $('#cutTitle').classList.remove('show'); $('#cutCard').classList.remove('show');
  CS.skipping = 0;
}
function endIntro() {
  if (!CS.active) return;
  CS.active = false; scene.remove(CS.group); CS.group = null;
  raft.visible = true; if (mount.g) mount.g.visible = true;
  $('#cut').classList.remove('show'); typeInto($('#cutLine'), '', 0); $('#cutWho').textContent = '';
  const f = CS.onEnd; CS.onEnd = null; f && f();
}
$('#cutSkip').onclick = () => { if (CS.active && !CS.skipping) CS.skipping = 0.001; };

function csOnce(name, t, fn) { if (CS.t >= t && !CS.fired[name]) { CS.fired[name] = true; fn(); } }
function updateIntro(dt) {
  const t = (CS.t += dt), q = CS.qiang;
  // 字幕
  const sub = CS_SUBS.find(s => t >= s[0] && t < s[1]);
  setT($('#cutWho'), sub ? sub[2] : '');
  if (sub) {
    $('#cutWho').style.color = WHO_COLOR[sub[2]];
    const n = Math.min(sub[3].length, Math.floor((t - sub[0]) * 16) + 1);
    typeInto($('#cutLine'), sub[3], n);
    if (CS.subKey !== sub[3]) { CS.subKey = sub[3]; CS.typed = 0; }
    if (n > CS.typed) { const ch = sub[3][n - 1]; if (n % 2 && !/[\s，。？！…、]/.test(ch)) blip(VOICE[sub[2]][0], VOICE[sub[2]][1], VOICE[sub[2]][2]); CS.typed = n; }
  } else typeInto($('#cutLine'), '', 0);
  // 事件
  csOnce('card', 0.2, () => $('#cutCard').classList.add('show'));
  csOnce('cardOff', 3.6, () => $('#cutCard').classList.remove('show'));
  csOnce('kick', 11.0, () => { sfx('bite'); shake(0.4); floatText(V(0, 2.2, -6.4), '滚！', '#ff6b5b', 1.2); });
  csOnce('splash', 12.2, () => { sfx('splash'); puff(V(1.5, 0.2, 2.5), 0xffffff, 14); });
  csOnce('rain', 12.6, () => CS.weather = 'rain');
  csOnce('laugh', 15.2, () => floatText(CS.yacht.position.clone().setY(2.2), '哈哈哈哈哈', '#9be7ff', 1.8));
  csOnce('storm', 17.2, () => { CS.weather = 'storm'; flash = 0.6; setTimeout(() => sfx('thunder'), 200); });
  csOnce('punch', 19.0, () => { CS.wall.visible = false; puff(V(3.0, 0.6, 3.0), 0xeef1f3, 26); shake(0.5); sfx('bite'); sfx('hit'); floatText(V(3.0, 1.6, 3.0), '砰！', '#ffffff', 1); });
  csOnce('flash2', 19.6, () => { flash = 0.6; setTimeout(() => sfx('thunder'), 250); });
  csOnce('jump', 20.3, () => sfx('throw'));
  csOnce('title', 22.6, () => { $('#cutTitle').classList.add('show'); sfx('gold'); flash = 0.8; shake(0.4); });
  if (CS.skipping) CS.skipping += dt;
  const fade = Math.max(1 - t / 0.8, seg(t, CS_END - 0.6, CS_END), CS.skipping ? Math.min(1, CS.skipping / 0.3) : 0);
  $('#cutFade').style.opacity = fade.toFixed(3);
  if (t >= CS_END || CS.skipping > 0.32) return endIntro();

  // 肥强的动作
  const water = (x, z) => waveH(x, z, T);
  if (t < 11) {
    q.position.set(0, 0.5, -6.0); q.rotation.set(0, Math.PI, 0);
    if (t > 7.5 && t < 10) q.position.y = 0.5 + Math.abs(Math.sin(t * 9)) * 0.08;
  } else if (t < 12.2) {
    const u = seg(t, 11, 12.2);
    q.position.set(lerp(0, 1.5, u), lerp(0.5, -0.3, u) + Math.sin(Math.PI * u) * 3.5, lerp(-6.0, 2.5, u));
    q.rotation.set(u * Math.PI * 3, Math.PI, 0);
  } else if (t < 17.5) {
    q.rotation.set(0, 0.6, 0); q.position.set(1.5, water(1.5, 2.5) - 0.45, 2.5);
  } else if (t < 18.8) {
    const u = ease(seg(t, 17.5, 18.8)); q.rotation.set(0, 1.0, 0);
    q.position.set(lerp(1.5, 2.3, u), water(2, 2.7) - 0.45, lerp(2.5, 2.75, u));
  } else if (t < 20.3) {
    q.rotation.set(0, 1.0, 0); const punch = t > 18.9 && t < 19.2 ? 0.25 : 0;
    q.position.set(2.3 + punch, water(2.3, 2.75) - 0.4, 2.75);
  } else if (t < 21) {
    const u = seg(t, 20.3, 21);
    q.position.set(lerp(2.3, CS.tubX, u), lerp(-0.4, 0.15, u) + Math.sin(Math.PI * u) * 1.6, lerp(2.75, 2.4, u));
    q.rotation.set(0, Math.PI / 2, 0);
  } else {
    q.position.set(CS.tubX, CS.tub.position.y + 0.02, 2.4); q.rotation.set(0, Math.PI / 2, 0);
  }
  // 白墙和澡盆漂着
  CS.wall.position.y = water(3, 3) + 0.3; CS.wall.rotation.z = Math.sin(T) * 0.06;
  if (t > 22.5) CS.tubX += dt * Math.min(9, (t - 22.5) * 5);
  CS.tub.position.set(CS.tubX, water(CS.tubX, 2.4) * 0.8 - 0.05, 2.4); CS.tub.rotation.y = Math.PI / 2;
  if (t > 21 && CS.tub.userData.paddle) CS.tub.userData.paddle.rotation.x = Math.sin(T * 9) * 0.7;
  // 游艇开过
  const yu = seg(t, 13.6, 18.6);
  CS.yacht.position.set(lerp(-26, 26, yu), water(0, 7.5) * 0.5, 7.5);
  // 老板踢人的小动作
  CS.boss.rotation.set(t > 10.9 && t < 11.3 ? -0.25 : 0, 0, 0);

  // 镜头
  let p, l;
  if (t < 4.2) { const u = ease(seg(t, 0, 4.2)); p = V(-20 + 12 * u, 11 - 4 * u, 16 - 4 * u); l = V(0, 1, -6); }
  else if (t < 11) { const u = seg(t, 4.2, 11); p = V(3.8 - 0.6 * u, 2.0, -3.9 - 0.4 * u); l = V(0, 1.0, -6.4); }
  else if (t < 14.3) { p = V(7, 4.5, 8); l = q.position.clone(); }
  else if (t < 17) { p = V(-3, 2.4, 11.5); l = V(1, 0.8, 4.5); }
  else if (t < 20.2) { const u = seg(t, 17, 20.2); p = V(6.2 - 0.8 * u, 1.5, 6.8 - 0.6 * u); l = V(2.8, 0.5, 2.9); }
  else { p = V(CS.tubX - 4.5, 3, 7.4); l = V(CS.tubX + 0.5, 0.4, 2.4); }
  if (shakeAmt > 0) { p.x += rand(-1, 1) * shakeAmt * 0.3; p.y += rand(-1, 1) * shakeAmt * 0.3; shakeAmt = Math.max(0, shakeAmt - dt * 1.5); }
  camera.position.copy(p); camera.lookAt(l);
  cam.tx = l.x; cam.tz = l.z;
  sun.position.set(l.x + 14, 26, l.z + 9); sun.target.position.set(l.x, 0, l.z);
}

// 开局选完直接播剧情，播完再进游戏
document.querySelectorAll('.perk').forEach(el => el.onclick = () => {
  const s = readSave();
  if (s && s.G && !confirm(`开始新的一局会覆盖「第 ${s.G.day} 天 · ${TIERS[s.G.tier].name}」的存档，确定吗？`)) return;
  audioInit(); startAmbient(); const perk = el.dataset.perk; playIntro(() => newGame(perk));
});
$('#replayBtn').onclick = () => { audioInit(); startAmbient(); playIntro(() => showStart()); };
document.addEventListener('pointerdown', () => { audioInit(); startAmbient(); }, { once: true });

// ================= 肥强头顶台词 =================
const sayEl = $('#say');
let sayLeft = 0, sayIdle = 14, sayText = '', sayTyped = 0;
const sayCd = {};
const IDLE_LOW = ['三十年河东，三十年河西！', '莫欺中年穷！', '等我住进高级庇护所，看谁还敢踢我！', '老板，你给我等着！', '海水过滤器，我来了！', '三分钟一局，巨爽巨解压！', '今天也是捞垃圾的一天'];
const IDLE_HIGH = ['当年踢我的老板，现在得叫我强哥', '这豪宅，巨爽巨解压', '游艇都开上了，人生一键重启', '三十年河东，三十年河西，诚不欺我'];
function qsay(text, dur = 3, important = false) {
  if (!G || idle || G.over) return;
  if (!important && sayLeft > 0.8) return;
  sayText = text; sayTyped = 0; typeInto(sayEl, text, 0); sayEl.classList.add('show'); sayLeft = dur + text.length / 20;
}
function qsayKey(k, cd, lines, important) {
  const now = G ? G.t : 0;
  if (sayCd[k] != null && now - sayCd[k] < cd) return;
  sayCd[k] = now; qsay(lines[randi(0, lines.length - 1)], 2.8, important);
}
const _sv = new THREE.Vector3();
function updateSay(dt) {
  if (!G || idle || G.over || CS.active) { sayEl.classList.remove('show'); return; }
  if (!paused) {
    sayLeft -= dt; sayIdle -= dt;
    if (sayIdle <= 0) {
      sayIdle = rand(20, 30);
      if (G.water < 25 && !counts.filter && !counts.purifier) qsay('渴……得赶紧造个海水过滤器', 3);
      else if (G.food < 25) qsay('饿得前胸贴后背……', 3);
      else { const pool = G.tier >= 3 ? IDLE_HIGH.concat(IDLE_LOW.slice(0, 2)) : IDLE_LOW; qsay(pool[randi(0, pool.length - 1)], 3); }
    }
  }
  if (sayLeft <= 0) { sayEl.classList.remove('show'); return; }
  if (sayTyped < sayText.length && !paused) {
    const n = Math.min(sayText.length, sayTyped + Math.max(1, Math.round(dt * 20)));
    if (n % 3 === 0 && !/[\s，。？！…、]/.test(sayText[n - 1])) blip(240, 0.018);
    sayTyped = n; typeInto(sayEl, sayText, n);
  }
  const who = mount.state !== 'dock' ? rider : avatar;
  who.getWorldPosition(_sv); _sv.y += 1.35; _sv.project(camera);
  if (_sv.z > 1) { sayEl.classList.remove('show'); return; }
  sayEl.style.left = ((_sv.x + 1) / 2 * innerWidth) + 'px';
  sayEl.style.top = ((1 - _sv.y) / 2 * innerHeight) + 'px';
}
