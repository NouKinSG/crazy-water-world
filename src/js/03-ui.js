// ================= 特效 =================
function puff(p, color, n) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(GEO.puff, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    m.position.copy(p); scene.add(m);
    fx.push({ m, v: new THREE.Vector3(rand(-1.5, 1.5), rand(1.5, 3.5), rand(-1.5, 1.5)), life: 0.6, max: 0.6 });
  }
}
function beam(a, b, color) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color, transparent: true }));
  scene.add(l); fx.push({ m: l, life: 0.14, max: 0.14, line: true });
}
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.life -= dt;
    if (!f.line) { f.v.y -= 9 * dt; f.m.position.addScaledVector(f.v, dt); }
    f.m.material.opacity = Math.max(0, f.life / f.max);
    if (f.life <= 0) { scene.remove(f.m); f.m.geometry !== GEO.puff && f.m.geometry.dispose(); f.m.material.dispose(); fx.splice(i, 1); }
  }
}
function floatText(pos, txt, color = '#fff', life = 1.2) {
  const el = document.createElement('div'); el.className = 'ft'; el.textContent = txt; el.style.color = color;
  $('#floats').appendChild(el); floats.push({ el, pos: pos.clone(), life, max: life });
}
const _v = new THREE.Vector3();
function updateFloats(dt) {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.life -= dt;
    _v.copy(f.pos).project(camera);
    const rise = Math.min(1.2, f.max - f.life) * 40;
    f.el.style.left = ((_v.x + 1) / 2 * innerWidth) + 'px';
    f.el.style.top = ((1 - _v.y) / 2 * innerHeight - rise) + 'px';
    f.el.style.opacity = Math.min(1, f.life * 2);
    if (f.life <= 0) { f.el.remove(); floats.splice(i, 1); }
  }
}
let bannerTimer = 0;
function banner(t, s = '', kind = '') {
  const b = $('#banner'); b.querySelector('.t').textContent = t; b.querySelector('.t').className = 't ' + kind;
  b.querySelector('.s').textContent = s; b.classList.add('show');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), 2600);
}
let hintTimer = 0, hintLock = 0;
function hint(t, warn) {
  const h = $('#hint'); h.textContent = t; h.classList.toggle('warn', !!warn);
  if (warn) { hintLock = 2; }
}
let shakeAmt = 0;
function shake(a) { shakeAmt = Math.max(shakeAmt, a); }

// ================= HUD =================
const setT = (el, v) => { if (el._v !== v) { el._v = v; el.textContent = v; } };
function setBar(id, v) {
  const b = $(id); setT(b.querySelector('.v'), Math.round(v));
  b.querySelector('.fill').style.width = v + '%'; b.classList.toggle('low', v < 25);
}
let barSig = '', upSig = '', resSig = '';
function renderHUD() {
  const phase = (G.t % DAY_LEN) / DAY_LEN;
  $('#dayNum').innerHTML = `第 ${G.day} <small>天</small>`;
  const wt = WEATHER[G.weather || 'overcast'];
  setT($('#tierName'), TIERS[G.tier].name + ' · ' + (G.wasNight ? '夜晚' : phase > 0.55 ? '黄昏' : '白天') + ' · ' + wt.icon + wt.name);
  setBar('#bw', G.water); setBar('#bf', G.food); setBar('#bh', G.hp);

  const pw = power(), n = survivors();
  const rs = [G.res.wood, G.res.plastic, G.res.scrap, n, pw.used, pw.total, tiles.size].join('|');
  if (rs !== resSig) {
    resSig = rs;
    let h = Object.keys(RES).map(r => `<div class="chip" title="${RES[r].n}"><span class="i">${RES[r].i}</span>${G.res[r]}</div>`).join('');
    h += `<div class="chip sep dim" title="木筏格数">🟫 ${tiles.size}</div>`;
    if (n) h += `<div class="chip dim" title="幸存者，会自动帮你甩钩">👥 ${n}</div>`;
    if (G.tier >= 2) h += `<div class="chip dim" title="电力：激光炮台用掉的/风力发电提供的">⚡ ${pw.used}/${pw.total}</div>`;
    $('#resBox').innerHTML = h;
  }

  const bs = [G.tier, sel, G.freeFilter, ...ORDER.map(k => canAfford(k) ? 1 : 0)].join('|');
  if (bs !== barSig) {
    barSig = bs;
    let idx = 0;
    $('#buildBar').innerHTML = ORDER.filter(k => DEFS[k].tier <= G.tier + 2).map(k => {
      const d = DEFS[k], lock = !unlocked(k), free = k === 'filter' && G.freeFilter > 0;
      const num = lock ? '' : `<span class="key">${++idx}</span>`;
      const cost = lock ? '🔒 ' + TIERS[d.tier - 1].name : free ? '免费' : costText(d.cost);
      return `<div class="card ${sel === k ? 'sel' : ''} ${lock ? 'lock' : ''} ${!lock && !canAfford(k) ? 'poor' : ''}" data-k="${k}" title="${d.desc}">
        ${num}${free ? `<span class="badge">×${G.freeFilter}</span>` : ''}<div class="ic">${d.icon}</div><div class="nm">${d.name}</div><div class="cost">${cost}</div></div>`;
    }).join('') + `<div class="card ${sel === 'demolish' ? 'sel' : ''}" data-k="demolish" title="拆掉建筑或地板，全额返还材料"><span class="key">0</span><div class="ic">🔨</div><div class="nm">拆除</div><div class="cost">全额返还</div></div>`;
  }

  const nx = TIERS[G.tier + 1];
  const us = nx ? [G.tier, tiles.size, G.res.wood, G.res.plastic, G.res.scrap].join('|') : 'max' + G.kills + G.caught;
  if (us !== upSig) {
    upSig = us;
    if (nx) {
      const rows = [`<div class="req ${tiles.size >= nx.tiles ? 'ok' : ''}"><span>🟫 木筏格数</span><span class="v">${tiles.size}/${nx.tiles}</span></div>`]
        .concat(Object.entries(nx.cost).map(([r, v]) => `<div class="req ${G.res[r] >= v ? 'ok' : ''}"><span>${RES[r].i} ${RES[r].n}</span><span class="v">${Math.min(G.res[r], v)}/${v}</span></div>`));
      const un = ORDER.filter(k => DEFS[k].tier === G.tier + 2).map(k => DEFS[k].icon + DEFS[k].name).join('  ');
      const ok = tierReady();
      $('#upBox').innerHTML = `<h4>下一阶段</h4><div class="nm">${nx.name}</div>${rows.join('')}
        <button class="primary ${ok ? 'ready' : ''}" id="upBtn" ${ok ? '' : 'disabled'}>升级成${nx.name}</button><div class="unlock">解锁：${un}</div>`;
      $('#upBtn').onclick = () => { audioInit(); upgrade(); };
    } else {
      $('#upBox').innerHTML = `<h4>已经是最高阶段</h4><div class="nm">海上豪宅区 🏰</div>
        <div class="req"><span>捞起物资</span><span class="v">${G.caught}</span></div><div class="req"><span>击杀鲨鱼</span><span class="v">${G.kills}</span></div>
        <div class="unlock">继续扩建，看你能撑多少天</div>`;
    }
  }

  if (hintLock <= 0) {
    let t;
    if (sel) t = (sel === 'demolish' ? '点建筑拆掉，空地板再点一次拆地板 · 全额返还' : sel === 'floor' ? '点亮起的格子铺地板' : `点木筏空格子放下${DEFS[sel].name}`) + (IS_TOUCH ? ' · 点这里取消 ✕' : ' · 右键 / Esc 取消');
    else if (G.water < 25 && !counts.filter && !counts.purifier) t = '连个海水过滤器都没有？赶紧造一个 💧';
    else if (G.food < 25) t = '食物快没了！造烤鱼架或者捞物资桶';
    else if (sharks.some(s => !s.dead)) t = '鲨鱼来了！点它扎它，被咬坏的木板点一下就能修';
    else if (tierReady()) t = '材料够了，点右上角升级！';
    else t = `点海面甩钩 · 点钩子够不着的远处，肥强会坐${MOUNT[mount.kind].name}过去扫货`;
    hint(t, G.water < 25 || G.food < 25);
  }
}
$('#hint').addEventListener('click', () => { if (sel) setSel(null); });
$('#buildBar').addEventListener('click', e => {
  const c = e.target.closest('.card'); if (!c || c.classList.contains('lock')) return;
  audioInit(); setSel(sel === c.dataset.k ? null : c.dataset.k);
});
function setSel(k) { sel = k; ghost.visible = false; barSig = ''; $('#hint').classList.toggle('cancel', !!k && IS_TOUCH); }

// ================= 镜头与输入 =================
const cam = { theta: -0.7, zoom: 1, tx: 0.5, tz: 0.5 };
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25);
function groundAt(cx, cy) {
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3(); return ray.ray.intersectPlane(plane, p) ? p : null;
}
const camPan = new THREE.Vector3(), panKeys = new Set();
function camAxes() { return { fx: -Math.sin(cam.theta), fz: -Math.cos(cam.theta), rx: Math.cos(cam.theta), rz: -Math.sin(cam.theta) }; }
function updateCamera(dt) {
  // 镜头焦点：出海时跟坐骑，平时跟肥强；再叠加玩家手动平移的偏移
  if (panKeys.size && !idle) {
    const a = camAxes(), sp = dt * 12 * cam.zoom;
    if (panKeys.has('f')) { camPan.x += a.fx * sp; camPan.z += a.fz * sp; }
    if (panKeys.has('b')) { camPan.x -= a.fx * sp; camPan.z -= a.fz * sp; }
    if (panKeys.has('r')) { camPan.x += a.rx * sp; camPan.z += a.rz * sp; }
    if (panKeys.has('l')) { camPan.x -= a.rx * sp; camPan.z -= a.rz * sp; }
  }
  if (camPan.length() > raftR + 14) camPan.setLength(raftR + 14);
  const out = mount.g && mount.state !== 'dock' && !idle;
  const fx_ = (out ? mount.pos.x : idle ? raftC.x : avatar.position.x) + camPan.x, fz_ = (out ? mount.pos.z : idle ? raftC.z : avatar.position.z) + camPan.z;
  cam.tx = lerp(cam.tx, fx_, Math.min(1, dt * 1.8)); cam.tz = lerp(cam.tz, fz_, Math.min(1, dt * 1.8));
  const dist = (11 + Math.min(raftR, 6) * 1.4) * cam.zoom, el = 0.46;
  camera.position.set(cam.tx + dist * Math.cos(el) * Math.sin(cam.theta), dist * Math.sin(el), cam.tz + dist * Math.cos(el) * Math.cos(cam.theta));
  if (shakeAmt > 0) { camera.position.x += rand(-1, 1) * shakeAmt * 0.3; camera.position.y += rand(-1, 1) * shakeAmt * 0.3; shakeAmt = Math.max(0, shakeAmt - dt * 1.5); }
  camera.lookAt(cam.tx, 0, cam.tz);
  sun.position.set(cam.tx + 14, 26, cam.tz + 9); sun.target.position.set(cam.tx, 0, cam.tz);
}
let down = null, hover = null, pinch = null;
const ptrs = new Map();
const ptrDist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
canvas.addEventListener('contextmenu', e => e.preventDefault());
// 电脑：左键只负责点（按下即生效，连点不会误转视角），右键/中键按住拖动转视角，右键单击取消建造
// 手机：单指点按、单指拖动转视角、双指缩放
let rot = null, dragHinted = false;
canvas.addEventListener('pointerdown', e => {
  audioInit();
  if (e.pointerType === 'mouse') {
    if (e.button === 0) { onClick(e.clientX, e.clientY); down = { x: e.clientX, y: e.clientY, mouse: true }; }
    else if (e.button === 1 || e.button === 2) { e.preventDefault(); rot = { x: e.clientX, theta: cam.theta, moved: false, btn: e.button }; }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    return;
  }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  if (ptrs.size === 2) { const [p1, p2] = [...ptrs.values()]; pinch = { d: ptrDist(), zoom: cam.zoom, mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2, pan: camPan.clone() }; if (down) down.moved = true; return; }
  down = { x: e.clientX, y: e.clientY, theta: cam.theta, moved: false, touch: e.pointerType === 'touch' };
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') {
    hover = { x: e.clientX, y: e.clientY };
    if (rot) { const dx = e.clientX - rot.x; if (Math.abs(dx) > 4) rot.moved = true; if (rot.moved) cam.theta = rot.theta - dx * 0.006; }
    else if (down && !dragHinted && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 60) { dragHinted = true; hint('按住鼠标右键拖动可以转视角，Q / E 也行'); hintLock = 3; }
    return;
  }
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && ptrs.size >= 2) {
    cam.zoom = clamp(pinch.zoom * pinch.d / ptrDist(), 0.45, 2.6);
    // 双指一起拖动 = 平移视角
    const [p1, p2] = [...ptrs.values()], mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, a = camAxes(), k = 0.03 * cam.zoom;
    camPan.set(pinch.pan.x - a.rx * (mx - pinch.mx) * k + a.fx * (my - pinch.my) * k, 0, pinch.pan.z - a.rz * (mx - pinch.mx) * k + a.fz * (my - pinch.my) * k);
    return;
  }
  if (down) {
    const dx = e.clientX - down.x, lim = down.touch ? 12 : 6;
    if (Math.abs(dx) > lim || Math.abs(e.clientY - down.y) > lim) down.moved = true;
    if (down.moved) cam.theta = down.theta - dx * (down.touch ? 0.009 : 0.006);
  }
});
function ptrEnd(e, cancel) {
  if (e.pointerType === 'mouse') {
    if (rot && e.button === rot.btn) { if (!rot.moved && rot.btn === 2) setSel(null); rot = null; }
    if (e.button === 0) down = null;
    return;
  }
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (!cancel && down && !down.moved && ptrs.size === 0) onClick(e.clientX, e.clientY);
  if (ptrs.size === 0) down = null;
}
canvas.addEventListener('pointerup', e => ptrEnd(e, false));
canvas.addEventListener('pointercancel', e => ptrEnd(e, true));
canvas.addEventListener('wheel', e => { e.preventDefault(); cam.zoom = clamp(cam.zoom * (1 + e.deltaY * 0.001), 0.45, 2.6); }, { passive: false });
const PAN_KEY = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' };
addEventListener('keydown', e => { const k = PAN_KEY[e.key.toLowerCase()]; if (k && G && !G.over && !idle) { panKeys.add(k); e.preventDefault(); } });
addEventListener('keyup', e => { const k = PAN_KEY[e.key.toLowerCase()]; if (k) panKeys.delete(k); });
addEventListener('blur', () => panKeys.clear());
addEventListener('keydown', e => {
  if ($('#help').classList.contains('show')) { if (e.key === 'Escape') closeHelp(); return; }
  if (!G || G.over || idle) return;
  if (e.key === 'h' || e.key === 'H' || e.key === '?') { openHelp(); return; }
  if (e.key === 'Escape') setSel(null);
  else if (e.key === ' ') { e.preventDefault(); togglePause(); }
  else if (e.key === 'c' || e.key === 'C') camPan.set(0, 0, 0);
  else if (e.key === 'q' || e.key === 'Q') cam.theta += 0.35;
  else if (e.key === 'e' || e.key === 'E') cam.theta -= 0.35;
  else if (e.key === '0') setSel(sel === 'demolish' ? null : 'demolish');
  else if (/^[1-9]$/.test(e.key)) { const ks = ORDER.filter(unlocked), k = ks[+e.key - 1]; if (k) setSel(sel === k ? null : k); }
});
function onClick(cx, cy) {
  if (!G || G.over || paused) return;
  const p = groundAt(cx, cy); if (p) clickAt(p);
}
function sharkAt(p) {
  let best = null, bd = 1e9;
  sharks.forEach(s => { if (s.dead) return; const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < (s.boss || s.kind ? 3.2 : 1.6) && d < bd) { bd = d; best = s; } });
  return best;
}
function clickAt(p) {
  const cx = Math.round(p.x), cz = Math.round(p.z);
  if (sel === 'demolish') { tryDemolish(cx, cz); return; }
  if (sel) {
    // 建造模式里也能修木板、扎鲨鱼：咬坏的木板先修，能放就放，点到鲨鱼就扎
    const bt = tiles.get(key(cx, cz));
    if (bt && bt.hp < tileMaxHp()) { tryRepair(bt); return; }
    if (validPlace(sel, cx, cz)) { tryPlace(cx, cz); return; }
    const sk = sharkAt(p); if (sk) return playerSpear(sk);
    tryPlace(cx, cz); return;
  }
  const best = sharkAt(p);
  if (best) return playerSpear(best);
  const t = tiles.get(key(Math.round(p.x), Math.round(p.z)));
  if (t) { if (!tryRepair(t)) hint('点海面甩钩，点鲨鱼扎它'); return; }
  const edge = nearestTile(p, true);
  if (edge && Math.hypot(p.x - edge.x, p.z - edge.z) > 14.5) { if (mount.state === 'dock') rideTo(p); else hint('肥强还在海上，等他回来', true); return; }
  if (mount.state !== 'dock') { hint('肥强还在海上，等他回来', true); return; }
  playerThrow(p);
}
const marks = [];
const MARK_GEO = new THREE.BoxGeometry(0.9, 0.06, 0.9);
function updateMarks() {
  let n = 0;
  if (sel && G && !idle && IS_TOUCH) {
    const cells = [];
    if (sel === 'demolish') tiles.forEach(t => cells.push([t.x, t.z, t.b ? 0.33 : 0.32]));
    else if (sel === 'floor') {
      const seen = new Set();
      tiles.forEach(t => neighbors(t.x, t.z).forEach(([x, z]) => { const k = key(x, z); if (!tiles.has(k) && !seen.has(k)) { seen.add(k); cells.push([x, z, 0.05]); } }));
    } else tiles.forEach(t => { if (!t.b) cells.push([t.x, t.z, 0.33]); });
    const ok = sel !== 'demolish' && canAfford(sel);
    cells.slice(0, 80).forEach(([x, z, y]) => {
      let m = marks[n]; if (!m) { m = new THREE.Mesh(MARK_GEO, GHOST_OK); scene.add(m); marks.push(m); }
      m.material = ok ? GHOST_OK : GHOST_NO; m.visible = true;
      m.position.set(x, raft.position.y + y + Math.sin(T * 4) * 0.03, z); n++;
    });
  }
  for (let i = n; i < marks.length; i++) marks[i].visible = false;
}
function updateGhost() {
  updateMarks();
  if (!sel || !hover) { ghost.visible = false; return; }
  const p = groundAt(hover.x, hover.y); if (!p) return;
  const x = Math.round(p.x), z = Math.round(p.z);
  if (sel === 'demolish') { const t = tiles.get(key(x, z)); ghost.visible = !!t; ghost.material = GHOST_NO; ghost.position.set(x, raft.position.y + (t && t.b ? 0.45 : 0.15), z); ghost.scale.set(1.05, t && t.b ? 0.25 : 1.05, 1.05); return; }
  const ok = validPlace(sel, x, z) && canAfford(sel);
  ghost.visible = true; ghost.material = ok ? GHOST_OK : GHOST_NO;
  ghost.position.set(x, raft.position.y + (sel === 'floor' ? 0.15 : 0.45), z);
  ghost.scale.set(1, sel === 'floor' ? 1 : 0.2, 1);
}
function togglePause() { paused = !paused; $('#paused').style.display = paused ? 'block' : 'none'; $('#pauseBtn').textContent = paused ? '▶' : '⏸'; }
$('#pauseBtn').onclick = togglePause;
const SOUND_UI = [['🔊', '声音全开'], ['🔉', '已关海浪雨声，保留音效'], ['🔇', '已静音']];
function applySound() {
  muted = soundMode === 2; $('#muteBtn').textContent = SOUND_UI[soundMode][0]; $('#muteBtn').title = SOUND_UI[soundMode][1];
  document.querySelectorAll('#soundSeg button').forEach(b => b.classList.toggle('on', +b.dataset.v === soundMode));
}
// ---------- 设置与玩法说明 ----------
let helpPausedBefore = false;
function helpTab(t) {
  document.querySelectorAll('.helpTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('table.keys').forEach(tb => tb.style.display = tb.dataset.for === t ? '' : 'none');
}
function openHelp() {
  if ($('#help').classList.contains('show')) return;
  helpPausedBefore = paused; if (!paused && G && !idle) togglePause();
  $('#paused').style.display = 'none';
  helpTab(IS_TOUCH ? 'mobile' : 'pc'); applySound();
  $('#help').classList.add('show');
}
function closeHelp() {
  if (!$('#help').classList.contains('show')) return;
  $('#help').classList.remove('show');
  if (paused && !helpPausedBefore) togglePause(); else if (paused) $('#paused').style.display = 'block';
}
$('#helpBtn').onclick = openHelp;
$('#helpOk').onclick = $('#helpClose').onclick = closeHelp;
$('#help').addEventListener('click', e => { if (e.target.id === 'help') closeHelp(); });
document.querySelectorAll('.helpTabs button').forEach(b => b.onclick = () => helpTab(b.dataset.tab));
document.querySelectorAll('#soundSeg button').forEach(b => b.onclick = () => { soundMode = +b.dataset.v; localStorage.setItem('cww-sound', soundMode); audioInit(); applySound(); });
$('#helpReplay').onclick = () => { $('#help').classList.remove('show'); playIntro(() => { $('#hud').style.display = ''; if (paused) togglePause(); }); };
$('#helpHome').onclick = () => { $('#help').classList.remove('show'); save(); if (!paused) togglePause(); showStart(); };
$('#muteBtn').onclick = () => { soundMode = (soundMode + 1) % 3; localStorage.setItem('cww-sound', soundMode); applySound(); hint(SOUND_UI[soundMode][1]); hintLock = 1.5; };
applySound();
if (/netlify\.app$/.test(location.hostname)) document.body.classList.add('has-badge');
addEventListener('resize', () => { fitCamera(); renderer.setSize(innerWidth, innerHeight); });

// ================= 昼夜 =================
const _c = new THREE.Color();
let wRain = 0, wStorm = 0, flash = 0, boltTimer = 6;
function updateWeather(dt) {
  const w = WEATHER[CS.active ? CS.weather : ((G && !idle && G.weather) || 'overcast')];
  wRain = lerp(wRain, w.rain, Math.min(1, dt * 0.5)); wStorm = lerp(wStorm, w.storm, Math.min(1, dt * 0.5));
  flash = Math.max(0, flash - dt * 3);
  if (wStorm > 0.8 && !paused) {
    boltTimer -= dt;
    if (boltTimer <= 0) { boltTimer = rand(6, 12); flash = 0.55; setTimeout(() => sfx('thunder'), rand(150, 600)); }
  }
  updateRain(dt, wRain, cam.tx, cam.tz);
}
// 4 盏点光源分给离镜头最近、最亮的发光建筑（数量固定，不会触发着色器重编译）
const _lampPos = new THREE.Vector3();
function updateLamps(nk) {
  const lit = [];
  if (nk > 0.05 && G) tiles.forEach(t => { const sp = t.b && LIGHT_SPEC[t.b.type];
    if (sp) lit.push({ t, sp, d: Math.hypot(t.x - cam.tx, t.z - cam.tz) - sp[2] * 3 }); });
  lit.sort((a, b) => a.d - b.d);
  LAMPS.forEach((l, i) => {
    const o = lit[i];
    if (!o) { l.intensity = 0; return; }
    l.color.setHex(o.sp[0]); l.intensity = nk * o.sp[2] * 0.6; l.distance = o.sp[1] * 3.2;
    l.position.copy(_lampPos.set(o.t.x, raft.position.y + 1.4, o.t.z));
  });
}
function updateLighting() {
  const p = G ? (G.t % DAY_LEN) / DAY_LEN : 0.2, k = daylight(p), dusk = Math.max(0, 1 - Math.abs(p - 0.68) / 0.1);
  _c.copy(SKY_DAY).lerp(SKY_STORM, wStorm * 0.85);
  _c.copy(SKY_NIGHT).lerp(_c, k).lerp(SKY_DUSK, dusk * 0.35 * (1 - wStorm)).lerp(SKY_FLASH, flash * 0.6);
  scene.background.copy(_c); scene.fog.color.copy(_c);
  scene.fog.near = lerp(40, 16, wStorm); scene.fog.far = lerp(110, 62, wStorm);
  sun.intensity = (0.18 + 0.95 * k) * (1 - wStorm * 0.55) + flash * 1.2; sun.color.setHex(k > 0.5 ? 0xfff1d6 : 0x9fb8ff);
  hemi.intensity = (0.32 + 0.5 * k) * (1 - wStorm * 0.3) + flash * 1.4;
  _c.copy(OCEAN_DAY).lerp(OCEAN_STORM, wStorm);
  oceanMat.color.copy(OCEAN_NIGHT).lerp(_c, k);
  const nk = 1 - k;
  WINDOW_MATS.forEach(m => m.emissiveIntensity = nk * 1.1); GLOW.lantern.emissiveIntensity = 0.3 + nk; GLOW.coal.emissiveIntensity = 0.9 + nk * 0.6;
  GLOW.water.emissiveIntensity = 0.25 + nk * 0.7; GLOW.eel.emissiveIntensity = 0.6 + nk * 0.9; GLOW.laser.emissiveIntensity = 0.8 + nk * 0.8;
  LH_BEAM_MAT.opacity = nk * 0.09;
  // 豪宅区本身有窗灯和发光地板，再加光斑和点光源会过曝，只给前面几个阶段补光
  const lampK = G && G.tier >= 4 ? 0 : nk;
  for (const c in POOL_MATS) POOL_MATS[c].opacity = lampK * 0.3;
  updateLamps(lampK);
  if (G && G.tier >= 4) tiles.forEach(t => t.floor.material.emissiveIntensity = nk * 0.9);
}

// ================= 存档 =================
function save() {
  if (!G || G.over) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ G, tiles: [...tiles.values()].map(t => [t.x, t.z, t.hp, t.b ? t.b.type : null, t.b ? t.b.v : null, t.b ? t.b.free : 0]) })); } catch (e) {}
}
function readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }
function resetWorld() {
  [...tiles.values()].forEach(removeTile);
  debris.slice().forEach(removeDebris);
  sharks.forEach(s => { scene.remove(s.g); scene.remove(s.bar); }); sharks.length = 0;
  hooks.forEach(h => { h.obj && scene.remove(h.obj); h.line && scene.remove(h.line); }); hooks.length = 0;
  fx.forEach(f => scene.remove(f.m)); fx.length = 0;
  floats.forEach(f => f.el.remove()); floats.length = 0;
  if (yacht) { scene.remove(yacht.g); yacht = null; } yachtTimer = 25;
  npcs.forEach(n => raft.remove(n.g)); npcs.length = 0; cats.forEach(c => raft.remove(c.g)); cats.length = 0;
  if (mount.g) { mount.g.remove(rider); scene.remove(mount.g); } mount.g = null; mount.kind = null; mount.launched = false; avatar.visible = true; jumpT = 0;
  cannonballs.forEach(b => scene.remove(b.m)); cannonballs.length = 0; bsay.left = 0;
  camPan.set(0, 0, 0); panKeys.clear();
  playerHook = null; sel = null; barSig = upSig = resSig = ''; spawnTimer = 0; autoTimer = 3;
}
function begin() {
  idle = false;
  recount(); cam.tx = raftC.x; cam.tz = raftC.z; if (innerWidth < innerHeight) cam.zoom = 0.8;
  avatarTo.set(raftC.x, 0, raftC.z); avatar.position.copy(avatarTo);
  setMount(); mount.pos.copy(dockPos()); recount();
  for (let i = 0; i < (G.cats || 0); i++) addCat();
  for (let i = 0; i < 10; i++) { const d = spawnDebris(pickType()); d.x -= rand(5, 60); }
  $('#start').classList.remove('show'); $('#over').classList.remove('show'); $('#hud').style.display = '';
  if (paused) togglePause();
}
function newGame(perk) {
  resetWorld(); G = newState(perk);
  [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([x, z]) => addTile(x, z));
  if (perk === 'filter') { placeBuilding(tiles.get(key(1, 1)), 'filter', null, true); G.filtersFound = 1; }
  if (perk === 'urine') placeBuilding(tiles.get(key(1, 1)), 'urine');
  if (perk === 'toilet') { placeBuilding(tiles.get(key(1, 1)), 'toilet'); G.res.scrap += 15; G.res.wood += 10; }
  begin(); banner('疯狂水世界，启动！', '三分钟一局，巨爽巨解压'); jumpT = 1.1; sayIdle = 14;
  if (!localStorage.getItem('cww-help-seen')) { localStorage.setItem('cww-help-seen', '1'); setTimeout(() => G && !G.over && openHelp(), 1800); }
  setTimeout(() => G && !G.over && qsay('老板你等着，我一定会回来的！', 3.5, true), 2600);
  save();
}
function loadGame(data) {
  resetWorld(); G = data.G; G.over = false;
  data.tiles.forEach(([x, z, hp, b, v, fr]) => { const t = addTile(x, z, hp); if (b) placeBuilding(t, b, v, fr); });
  begin(); banner(`第 ${G.day} 天`, '欢迎回来，接着捞');
}
function gameOver(reason) {
  if (G.over) return;
  G.over = true; sfx('over');
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  setTimeout(() => showEnd(false, reason), 900);
}
function showEnd(win, reason) {
  const mins = Math.max(1, Math.round(G.t / 60));
  $('#overTitle').textContent = win ? `第 ${G.day} 天，你住进了海上豪宅！` : `你在第 ${G.day} 天沉没了`;
  $('#overSub').textContent = win ? `从五级小木筏到这里，说好的三分钟一局，你玩了 ${mins} 分钟` : `${reason} · 说好的三分钟一局，你撑了 ${mins} 分钟`;
  $('#overStats').innerHTML = [[G.day, '存活天数'], [G.caught, '捞起物资'], [G.kills, '击杀鲨鱼'], [tiles.size, '木筏格数']]
    .map(([v, l]) => `<div class="panel"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#overBtn').textContent = win ? '继续巨爽巨解压' : '我这就去打捞海水过滤器';
  $('#overBtn').onclick = () => { $('#over').classList.remove('show'); if (!win) showStart(); };
  $('#over').classList.add('show');
}
function showStart() {
  $('#hud').style.display = 'none';
  const s = readSave(), btn = $('#continueBtn');
  if (s && s.G) { btn.style.display = ''; btn.textContent = `继续上次 · 第 ${s.G.day} 天 · ${TIERS[s.G.tier].name}`; btn.onclick = () => { audioInit(); loadGame(s); }; }
  else btn.style.display = 'none';
  $('#start').classList.add('show');
}
document.querySelectorAll('.perk').forEach(el => el.onclick = () => { audioInit(); newGame(el.dataset.perk); });
addEventListener('beforeunload', save);

// ================= 主循环 =================
let idle = false, jumpT = 0;
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  step(dt);
  renderer.render(scene, camera);
}
function step(dt) {
  T += dt;
  if (CS.active) { updateIntro(dt); updateOcean(T, cam.tx, cam.tz); updateWeather(dt); updateLighting(); updateFx(dt); updateFloats(dt); updateAmbient(); return; }
  updateAmbient(); updateSay(dt); updateBossUI(dt);
  if (G && !G.over && !paused) gameUpdate(dt);
  if (G && !idle) {
    hintLock -= dt;
    raft.position.y = waveH(raftC.x, raftC.z, T) * 0.35 + 0.02;
    raft.rotation.x = Math.sin(T * 0.8) * 0.012; raft.rotation.z = Math.cos(T * 0.7) * 0.012;
    avatar.position.lerp(avatarTo, Math.min(1, dt * 6));
    if (jumpT > 0) jumpT = Math.max(0, jumpT - dt);
    avatar.position.y = 0.3 + Math.sin(Math.min(1, 1.1 - jumpT) * Math.PI) * (jumpT > 0 ? 1.1 : 0);
    renderHUD();
  } else {
    raft.position.y = waveH(0.5, 0.5, T) * 0.35 + 0.02; cam.theta += dt * 0.05;
  }
  updateOcean(T, cam.tx, cam.tz); updateWeather(dt);
  updateCamera(dt); updateLighting(); updateFx(dt); updateFloats(dt); updateGhost();
}
// 开始画面背后放一块漂着的木筏当背景
(function idleScene() {
  G = newState('filter'); [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([x, z]) => addTile(x, z));
  placeBuilding(tiles.get(key(1, 1)), 'filter'); recount();
  for (let i = 0; i < 12; i++) { const d = spawnDebris(pickType()); d.x -= rand(5, 60); d.g.position.set(d.x, 0, d.z); }
  G.over = true; idle = true;
})();
showStart();
requestAnimationFrame(frame);
window.__G = { get G() { return G; }, newGame, step, tiles, sharks, debris, hooks, spawnShark, tryPlace, setSel, upgrade, playerThrow, onClick, recount, counts: () => counts, onClickWorld: clickAt, mount, npcs, spawnDebris, raftC };
