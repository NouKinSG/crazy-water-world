// ================= 游戏状态 =================
let G = null, paused = false, sel = null, T = 0;
const raft = new THREE.Group(); scene.add(raft);
const avatar = makeFeiqiang(); raft.add(avatar);
const tiles = new Map(), debris = [], sharks = [], hooks = [], fx = [], floats = [];
const raftC = new THREE.Vector3(); let raftR = 1;
let counts = {}, spawnTimer = 0, autoTimer = 3, spearCd = 0, playerHook = null, avatarTo = new THREE.Vector3(0.5, 0, 0.5);
const ghost = new THREE.Mesh(GEO.floor, GHOST_OK); ghost.visible = false; scene.add(ghost);

function newState(perk) {
  return { t: 0, day: 1, tier: 0, res: { wood: 6, plastic: 2, scrap: 0 }, water: 100, food: 100, hp: 100,
    freeFilter: 0, perk, filtersFound: 0, kills: 0, caught: 0, built: 0, won: false, over: false, wasNight: false, weather: 'overcast' };
}

// ---------- 木筏格子 ----------
function tileMaxHp() { return G.tier >= 4 ? 10 : G.tier >= 2 ? 6 : 3; }
function floorMat() {
  const t = G.tier;
  const m = new THREE.MeshStandardMaterial({ map: t >= 4 ? TEX.city : t >= 2 ? TEX.metal : TEX.wood, roughness: t >= 2 ? 0.5 : 0.85, metalness: t >= 2 && t < 4 ? 0.35 : 0 });
  if (t >= 4) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = TEX.cityGlow; m.emissiveIntensity = 0; }
  return m;
}
function addTile(x, z, hp) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const f = mesh(GEO.floor, floorMat(), 0, 0.15, 0); g.add(f); raft.add(g);
  const t = { x, z, hp: hp ?? tileMaxHp(), g, floor: f, b: null, flash: 0 };
  tiles.set(key(x, z), t); paintTile(t); return t;
}
function removeTile(t) { if (t.b) removeBuilding(t); raft.remove(t.g); t.floor.material.dispose(); tiles.delete(key(t.x, t.z)); }
function paintTile(t) {
  const k = t.hp / tileMaxHp();
  t.floor.material.color.setRGB(lerp(0.55, 1, k), lerp(0.35, 1, k), lerp(0.35, 1, k));
  if (t.flash > 0) t.floor.material.color.setRGB(1, 0.3, 0.3);
}
function reskin() { tiles.forEach(t => { t.floor.material.dispose(); t.floor.material = floorMat(); t.hp = tileMaxHp(); paintTile(t); }); }
function placeBuilding(t, type, v, free) {
  if (v == null) v = randi(0, 999);
  const g = BUILDERS[type](v); g.position.y = 0.3; g.rotation.y = type === 'net' ? 0 : (v % 4) * Math.PI / 2; addLightPool(g, type);
  t.g.add(g); t.b = { type, g, v, free: !!free, cd: rand(0, 1), head: g.userData.head, spin: g.userData.spin, spin2: g.userData.spin2 };
}
function removeBuilding(t) { t.g.remove(t.b.g); t.b = null; }
function neighbors(x, z) { return [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]; }
function isEdge(t) { return neighbors(t.x, t.z).some(([a, b]) => !tiles.has(key(a, b))); }
function tileWorld(t, y = 0.3) { return new THREE.Vector3(t.x, raft.position.y + y, t.z); }
function nearestTile(p, edgeOnly) {
  let best = null, bd = 1e9;
  tiles.forEach(t => { if (edgeOnly && !isEdge(t)) return; const d = (t.x - p.x) ** 2 + (t.z - p.z) ** 2; if (d < bd) { bd = d; best = t; } });
  return best || (edgeOnly ? nearestTile(p, false) : null);
}
function recount() {
  counts = { toilet: 0 }; ORDER.forEach(k => counts[k] = 0);
  let sx = 0, sz = 0;
  tiles.forEach(t => { sx += t.x; sz += t.z; if (t.b) counts[t.b.type]++; });
  const n = Math.max(1, tiles.size);
  raftC.set(sx / n, 0, sz / n);
  raftR = 1; tiles.forEach(t => { raftR = Math.max(raftR, Math.hypot(t.x - raftC.x, t.z - raftC.z) + 0.7); });
  syncNpcs();
}
function survivors() { return counts.house + counts.tower * 3; }
function power() { return { total: counts.windmill * 2, used: Math.min(counts.laser, counts.windmill * 2) }; }

// ---------- 资源 ----------
function canAfford(k) {
  if (k === 'filter' && G.freeFilter > 0) return true;
  return Object.entries(DEFS[k].cost).every(([r, n]) => G.res[r] >= n);
}
function pay(cost) { Object.entries(cost).forEach(([r, n]) => G.res[r] -= n); }
function costText(cost) { return Object.entries(cost).map(([r, n]) => RES[r].i + n).join(' '); }
function unlocked(k) { return G.tier + 1 >= DEFS[k].tier; }

// ---------- 漂浮物 ----------
const DEBRIS_W = [['wood', 38], ['plastic', 30], ['scrap', 18], ['ac', 5], ['barrel', 9]];
function pickType() { let r = rand(0, 100); for (const [t, w] of DEBRIS_W) { if ((r -= w) <= 0) return t; } return 'wood'; }
function spawnDebris(type, laneW) {
  const g = makeDebris(type); scene.add(g);
  const lane = laneW != null ? rand(-laneW, laneW) : (Math.random() < 0.6 ? rand(-raftR - 4, raftR + 4) : rand(-24, 24));
  const d = { type, g, x: raftC.x + rand(34, 40), z: raftC.z + lane, vx: -rand(1.1, 1.7), vz: rand(-0.12, 0.12), spin: rand(-0.6, 0.6), reserved: false, attached: false };
  g.position.set(d.x, 0, d.z); debris.push(d); return d;
}
function removeDebris(d) { scene.remove(d.g); const i = debris.indexOf(d); if (i >= 0) debris.splice(i, 1); }
function collect(d, quiet) {
  const at = d.g.position.clone(); at.y += 0.8;
  removeDebris(d); G.caught++;
  let txt = '', color = '#fff';
  if (d.type === 'wood') { const n = randi(2, 3); G.res.wood += n; txt = `+${n} 🪵`; }
  else if (d.type === 'plastic') { const n = randi(2, 3); G.res.plastic += n; txt = `+${n} 🧴`; }
  else if (d.type === 'scrap') { const n = randi(1, 2); G.res.scrap += n; txt = `+${n} ⚙️`; }
  else if (d.type === 'sword') {
    if (!G.sword) { G.sword = true; txt = '尚方宝剑！'; banner('捞到尚方宝剑！', '扎鲨鱼伤害永久翻倍'); qsay('尚方宝剑在手，鲨鱼先斩后奏！', 3.5, true); }
    else { G.res.scrap += 20; txt = '又一把？熔了 +20 ⚙️'; }
    color = '#FFC53D'; sfx('gold'); quiet = false;
  }
  else if (d.type === 'ac') { G.res.scrap += 4; txt = '空调外机，拆了 +4 ⚙️'; color = '#cfd8dc'; }
  else if (d.type === 'goldbar') { G.res.scrap += 30; G.res.plastic += 10; txt = '+30 ⚙️ +10 🧴'; color = '#FFC53D'; banner('验货：黄金棒！', '还不错，价值一把尚方宝剑'); sfx('gold'); qsay('价值一把尚方宝剑！发了发了！', 3, true); }
  else if (d.type === 'cat') {
    if ((G.cats || 0) < 3) { G.cats = (G.cats || 0) + 1; addCat(); banner('捞到一只哈吉米！', '十块钱送楼下洗澡？不，它现在归你了'); qsay('哈吉米，以后跟着强哥混！', 3, true); txt = '哈吉米 +1'; }
    else { G.food = Math.min(100, G.food + 15); txt = '猫粮 +15 🍖'; }
    color = '#f4a340';
  }
  else if (d.type === 'barrel') {
    G.res.wood += 3; G.res.plastic += 3; G.res.scrap += 2;
    if (Math.random() < 0.5) { G.water = Math.min(100, G.water + 20); txt = '验货！+20 💧'; qsayKey('barrel', 20, ['验货！', '好东西！']); } else { G.food = Math.min(100, G.food + 20); txt = '验货！+20 🍖'; }
    color = '#9be7ff';
  } else if (d.type === 'gold') {
    G.freeFilter++; G.filtersFound++; txt = '海水过滤器 ×1'; color = '#FFC53D';
    banner('捞到海水过滤器了！', '三十年河东，三十年河西 · 已放进建造栏'); sfx('gold'); qsay('哈哈哈！海水过滤器！我肥强也有今天！', 3.5, true);
    if (!sel) setSel('filter');
  }
  if (['goldbar', 'cat', 'gold'].includes(d.type)) quiet = false;
  if (!quiet) { floatText(at, txt, color); sfx('catch'); }
}

// ---------- 钩子 ----------
function throwHook(from, to, o = {}) {
  const h = { from: from.clone(), to: to.clone(), land: null, t: 0, state: o.state || 'fly', dur: o.dur || 0.4,
    target: o.target || null, player: !!o.player, obj: null, line: null };
  if (o.rope !== false) {
    h.obj = mesh(GEO.hook, mat(o.player ? 0xffc53d : 0xcfd8dc, { metalness: 0.6 })); scene.add(h.obj);
    h.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 16 }, () => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: o.player ? 0xf5ecd0 : 0x9bd6ff }));
    scene.add(h.line);
  }
  if (h.state === 'reel') { h.land = to.clone(); h.dur = Math.max(0.35, h.land.distanceTo(h.from) / 16); if (h.target) h.target.attached = true; }
  hooks.push(h); return h;
}
function hookPos(h) {
  if (h.state === 'fly') { const p = h.from.clone().lerp(h.to, h.t); p.y += Math.sin(Math.PI * h.t) * 2.2 * Math.min(1, h.from.distanceTo(h.to) / 8); return p; }
  const e = 1 - (1 - h.t) * (1 - h.t), p = h.land.clone().lerp(h.from, e);
  p.y = Math.max(waveH(p.x, p.z, T) + 0.1, lerp(p.y, h.from.y, e)); return p;
}
function updateHooks(dt) {
  for (let i = hooks.length - 1; i >= 0; i--) {
    const h = hooks[i];
    h.t += dt / h.dur;
    if (h.state === 'fly' && h.t >= 1) {
      h.land = h.to.clone(); h.land.y = waveH(h.land.x, h.land.z, T);
      sfx('splash'); puff(h.land, 0xffffff, 5);
      if (h.player) {
        let best = null, bd = 1.9 * 1.9;
        debris.forEach(d => { if (d.attached || d.reserved) return; const dd = (d.x - h.land.x) ** 2 + (d.z - h.land.z) ** 2; if (dd < bd) { bd = dd; best = d; } });
        h.target = best;
      }
      if (h.target) h.target.attached = true;
      h.state = 'reel'; h.t = 0; h.dur = Math.max(0.35, h.land.distanceTo(h.from) / 16);
    }
    const p = hookPos(h);
    if (h.obj) { h.obj.position.copy(p); h.obj.rotation.y = T * 6; }
    if (h.line) {
      const a = h.from.clone(), arr = h.line.geometry.attributes.position;
      const sag = h.state === 'reel' ? 0.15 : 0.5;
      for (let k = 0; k < 16; k++) { const s = k / 15, q = a.clone().lerp(p, s); q.y -= Math.sin(Math.PI * s) * sag; arr.setXYZ(k, q.x, q.y, q.z); }
      arr.needsUpdate = true;
    }
    if (h.state === 'reel' && h.target) { h.target.g.position.copy(p); h.target.x = p.x; h.target.z = p.z; }
    if (h.state === 'reel' && h.t >= 1) {
      if (h.target) collect(h.target, !h.player);
      if (h.obj) scene.remove(h.obj);
      if (h.line) { scene.remove(h.line); h.line.geometry.dispose(); }
      if (h.player) playerHook = null;
      hooks.splice(i, 1);
    }
  }
}

// ---------- 鲨鱼 ----------
function spawnShark(boss, delayR = 0) {
  const m = makeShark(boss), ang = rand(0, Math.PI * 2);
  const hp = boss ? 40 + G.day * 2 : 4 + Math.floor(G.day / 3);
  const s = { boss, hp, maxHp: hp, ang, r: raftR + 22 + delayR, state: 'circle', timer: rand(3, 6), dir: Math.random() < 0.5 ? 1 : -1,
    speed: boss ? 2.2 : 3, target: null, dead: false, sink: 0, flash: 0, ...m, x: 0, z: 0 };
  s.x = raftC.x + Math.cos(ang) * s.r; s.z = raftC.z + Math.sin(ang) * s.r;
  s.g.position.set(s.x, -0.3, s.z); scene.add(s.g); sharks.push(s); return s;
}
function sharkDesiredR(s) { return raftR + (s.boss ? 5 : 3); }
function damageShark(s, dmg, show) {
  if (s.dead) return;
  s.hp -= dmg; s.flash = 0.15; sfx('hit');
  if (show) floatText(new THREE.Vector3(s.x, 1.2, s.z), '-' + dmg, '#ff8a80');
  if (s.hp <= 0) {
    s.dead = true; G.kills++; sfx('kill'); s.bar.visible = false;
    if (s.boss) qsay('深海巨兽？就这？', 3, true); else qsayKey('kill', 8, ['就这？', '晚饭有着落了！', '还有谁！']);
    const at = new THREE.Vector3(s.x, 1.4, s.z);
    if (s.kind) bossDefeated(s);
    else if (s.boss) { G.bossWins = (G.bossWins || 0) + 1; G.res.scrap += 25; G.res.plastic += 20; G.food = Math.min(100, G.food + 50); banner('击败深海巨兽！', '+25 ⚙️  +20 🧴  +50 🍖'); sfx('up'); }
    else { G.res.scrap += 2; G.food = Math.min(100, G.food + 10); floatText(at, '+10 🍖 +2 ⚙️', '#FFC53D'); }
  }
}
function updateSharks(dt) {
  updateCannonballs(dt); if (G.over) return;
  for (let i = sharks.length - 1; i >= 0; i--) {
    const s = sharks[i];
    if (s.dead) {
      s.sink += dt; s.g.position.y -= dt * 1.5; s.g.rotation.x += dt * (s.kind ? 0.4 : 2);
      if (s.sink > (s.kind ? 2.2 : 1.3)) { scene.remove(s.g); scene.remove(s.bar); sharks.splice(i, 1); }
      continue;
    }
    // 肌肉佬 / 收租船 / 战舰走 05-boss.js 里的专属行为
    if (s.kind) {
      BOSS_AI[s.kind](s, dt); if (G.over) return;
      if (s.gone) { scene.remove(s.g); sharks.splice(i, 1); continue; }
      s.flash = Math.max(0, s.flash - dt); s.bodyMat.emissiveIntensity = s.flash > 0 ? 0.6 : 0;
      continue;
    }
    const night = G.wasNight;
    let dx = 0, dz = 0, spd = s.speed;
    if (s.state === 'circle') {
      s.r = lerp(s.r, sharkDesiredR(s), Math.min(1, dt * 0.5));
      s.ang += s.dir * s.speed / Math.max(s.r, 1) * dt;
      const nx = raftC.x + Math.cos(s.ang) * s.r, nz = raftC.z + Math.sin(s.ang) * s.r;
      dx = nx - s.x; dz = nz - s.z; s.x = nx; s.z = nz;
      s.timer -= dt;
      if (s.timer <= 0 && tiles.size && s.r < sharkDesiredR(s) + 2) {
        const edges = [...tiles.values()].filter(isEdge);
        s.target = edges.sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[randi(0, Math.min(2, edges.length - 1))];
        s.state = 'attack'; catWarn(s);
      }
    } else if (s.state === 'attack') {
      if (!s.target || !tiles.has(key(s.target.x, s.target.z))) { s.state = 'retreat'; continue; }
      dx = s.target.x - s.x; dz = s.target.z - s.z;
      const d = Math.hypot(dx, dz); spd = s.speed * 1.8;
      if (d < (s.boss ? 1.6 : 0.9)) {
        const t = s.target; t.hp -= s.boss ? 3 : 1; t.flash = 0.25; paintTile(t);
        sfx('bite'); shake(s.boss ? 0.5 : 0.25);
        floatText(tileWorld(t, 0.8), s.boss ? '咔嚓 -3' : '咔嚓 -1', '#ff6b5b');
        qsayKey('bite', 9, ['别咬我房子！', '鲨鱼你也欺负我？', '我的木板！', '有本事上来咬我！']);
        if (t.hp <= 0) { puff(tileWorld(t), 0x8d5a2b, 10); floatText(tileWorld(t, 1.2), '房子给淹了！', '#ff6b5b', 2); qsay('我的房子！', 2, true); removeTile(t); recount(); if (!tiles.size) return gameOver('木筏被鲨鱼啃光了'); }
        s.state = 'retreat';
      } else { s.x += dx / d * spd * dt; s.z += dz / d * spd * dt; }
    } else if (s.state === 'retreat') {
      dx = s.x - raftC.x; dz = s.z - raftC.z;
      const d = Math.hypot(dx, dz) || 1;
      s.x += dx / d * s.speed * 1.4 * dt; s.z += dz / d * s.speed * 1.4 * dt;
      if (d >= sharkDesiredR(s)) { s.r = d; s.ang = Math.atan2(dz, dx); s.state = 'circle'; s.timer = s.boss ? rand(3, 4.5) : rand(night ? 4 : 6, night ? 7 : 10); }
    }
    if (dx || dz) s.g.rotation.y = Math.atan2(-dz, dx);
    s.g.position.set(s.x, waveH(s.x, s.z, T) - (s.boss ? 0.3 : 0.12), s.z);
    s.flash = Math.max(0, s.flash - dt); s.bodyMat.emissiveIntensity = s.flash > 0 ? 0.8 : 0;
    s.bar.visible = s.hp < s.maxHp || s.boss;
    s.bar.position.set(s.x, s.boss ? 2.6 : 1.3, s.z);
    s.fg.scale.x = s.barW * Math.max(0, s.hp / s.maxHp);
  }
}

// ---------- 炮台 / 自动化 ----------
function nearestShark(x, z, range) {
  let best = null, bd = range * range;
  sharks.forEach(s => { if (s.dead) return; const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; best = s; } });
  return best;
}
function updateBuildings(dt) {
  let laserBudget = power().total;
  tiles.forEach(t => {
    const b = t.b; if (!b) return;
    if (b.spin) b.spin.rotation.y += dt * 2.5;
    if (b.spin2) b.spin2.rotation.y += dt * 0.8;
    if (b.type === 'turret' || b.type === 'laser') {
      const isLaser = b.type === 'laser';
      if (isLaser) { if (laserBudget <= 0) return; laserBudget--; }
      b.cd -= dt;
      const s = nearestShark(t.x, t.z, isLaser ? 12 : 9);
      if (!s) return;
      b.head.rotation.y = Math.atan2(-(s.z - t.z), s.x - t.x) - b.g.rotation.y;
      if (b.cd <= 0) {
        b.cd = isLaser ? 0.6 : 1.1;
        beam(tileWorld(t, isLaser ? 1.0 : 0.75), new THREE.Vector3(s.x, 0.2, s.z), isLaser ? 0xff3b3b : 0xf5ecd0);
        sfx(isLaser ? 'laser' : 'shot'); damageShark(s, isLaser ? 2 : 1);
      }
    }
    if (b.type === 'net') {
      debris.forEach(d => {
        if (d.reserved || d.attached) return;
        if ((d.x - t.x) ** 2 + (d.z - t.z) ** 2 < 2.6 * 2.6) { d.reserved = true; throwHook(tileWorld(t, 0.5), d.g.position.clone(), { state: 'reel', target: d, rope: false }); }
      });
    }
  });
  const n = survivors();
  if (n > 0) {
    autoTimer -= dt * n;
    if (autoTimer <= 0) {
      autoTimer += 5;
      let best = null, bd = (raftR + 11) ** 2;
      debris.forEach(d => { if (d.reserved || d.attached) return; const dd = (d.x - raftC.x) ** 2 + (d.z - raftC.z) ** 2; if (dd < bd) { bd = dd; best = d; } });
      if (best) {
        best.reserved = true;
        const npc = npcs.length ? npcs[randi(0, npcs.length - 1)] : null;
        const tile = npc && tiles.has(key(npc.tile.x, npc.tile.z)) ? npc.tile : nearestTile(best, true), dur = 0.45;
        if (npc) npc.g.rotation.y = Math.atan2(best.x - tile.x, best.z - tile.z);
        const to = new THREE.Vector3(best.x + best.vx * dur, 0, best.z + best.vz * dur);
        throwHook(tileWorld(tile, 0.9), to, { target: best, dur });
      }
    }
  }
}

// ---------- 主角动作 ----------
function playerThrow(p) {
  if (playerHook || mount.state !== 'dock') return;
  const t = nearestTile(p, true); if (!t) return;
  const from = tileWorld(t, 0.9), dir = new THREE.Vector3(p.x - t.x, 0, p.z - t.z), len = dir.length();
  if (len < 0.8) return;
  if (len > 15) dir.multiplyScalar(15 / len);
  const to = new THREE.Vector3(t.x + dir.x, 0, t.z + dir.z);
  const dn = dir.clone().normalize(); avatarTo.set(t.x + dn.x * 0.32, 0, t.z + dn.z * 0.32); avatar.rotation.y = Math.atan2(dir.x, dir.z); camPan.set(0, 0, 0);
  playerHook = throwHook(from, to, { player: true, dur: 0.38 }); sfx('throw');
}
function playerSpear(s) {
  if (spearCd > 0) return;
  const t = nearestTile(s, true); if (!t) return;
  if (Math.hypot(s.x - t.x, s.z - t.z) > 16) { hint('太远了，等它游近点再扎', true); return; }
  spearCd = 0.4; avatarTo.set(t.x, 0, t.z); avatar.rotation.y = Math.atan2(s.x - t.x, s.z - t.z);
  beam(tileWorld(t, 0.9), new THREE.Vector3(s.x, 0.3, s.z), 0xffc53d);
  damageShark(s, G.sword || G.perk === 'spear' ? 2 : 1, true);
}
function tryRepair(t) {
  const mx = tileMaxHp(); if (t.hp >= mx) return false;
  const r = G.tier >= 2 ? 'scrap' : 'wood';
  if (G.res[r] < 1) { hint(`修补要 1 个${RES[r].n}`, true); sfx('no'); return true; }
  G.res[r]--; t.hp = mx; paintTile(t); sfx('build'); floatText(tileWorld(t, 0.8), '修好了', '#7CDB8A'); return true;
}
function validPlace(k, x, z) {
  if (k === 'floor') return !tiles.has(key(x, z)) && neighbors(x, z).some(([a, b]) => tiles.has(key(a, b)));
  const t = tiles.get(key(x, z)); return !!t && !t.b;
}
function tryPlace(x, z) {
  const k = sel;
  if (!unlocked(k)) return;
  if (!validPlace(k, x, z)) { hint(k === 'floor' ? '地板要接着木筏边上铺' : '要放在木筏的空格子上', true); sfx('no'); return; }
  if (!canAfford(k)) { hint('材料不够：' + costText(DEFS[k].cost), true); sfx('no'); return; }
  const free = k === 'filter' && G.freeFilter > 0;
  if (free) G.freeFilter--; else pay(DEFS[k].cost);
  if (k === 'floor') addTile(x, z); else placeBuilding(tiles.get(key(x, z)), k, null, free);
  G.built++; announceNpc = true; recount(); announceNpc = false; sfx('build'); puff(new THREE.Vector3(x, 0.5, z), 0xf5ecd0, 6);
  const BUILD_SAY = { filter: '纯净水自由了！老板你看见没？', urine: '祖传的手艺，不能丢', grill: '烤鱼走起，再也不饿肚子', net: '躺着都有东西进网，爽！', turret: '鲨鱼？来一条射一条！', house: '集装箱也是房，总比泡海里强', planter: '自己种菜，自给自足', windmill: '电鳗发电，绿色无污染！', laser: '激光炮！鲨鱼你完了', purifier: '净水厂！淡水喝不完！', tower: '住豪宅了！三十年河东，三十年河西！', lighthouse: '灯塔一亮，物资全往我这漂' };
  if (k === 'floor') qsayKey('floor', 25, ['又大了一圈！', '地盘越来越大了！', '这块地是我肥强的！']); else if (BUILD_SAY[k]) qsayKey('b-' + k, 30, [BUILD_SAY[k]], true);
  if (k === 'filter' && counts.filter === 1) banner('有了海水过滤器，人生一键重启', '淡水 +0.8/秒，高级庇护所随便搬');
  if (k === 'windmill' && counts.windmill === 1) banner('电鳗发电机，启动！', '电鳗发电，绿色无污染，纯纯的新能源');
  if (k === 'house' && counts.house === 1) banner('住进集装箱了！', '集装箱上温度快40度，空调外机装我家里');
  if (k === 'tower' && counts.tower === 1) banner('住进海景豪宅了！', '别人开游艇，现在你也开得起了');
  if (k === 'urine' && counts.urine === 1) banner('尿液过滤器，启动！', '祖传三代，自产自销，循环利用');
  if (!canAfford(k) && k !== 'floor') setSel(null);
  save();
}

// ---------- 升级 ----------
function tierReady() {
  const n = TIERS[G.tier + 1]; if (!n) return false;
  return tiles.size >= n.tiles && Object.entries(n.cost).every(([r, v]) => G.res[r] >= v);
}
function upgrade() {
  if (!tierReady()) return;
  const n = TIERS[G.tier + 1]; pay(n.cost); G.tier++; reskin(); sfx('up'); shake(0.3);
  const un = ORDER.filter(k => DEFS[k].tier === G.tier + 1).map(k => DEFS[k].name).join(' · ');
  const title = G.tier === 2 ? '终于住进高级庇护所！' : G.tier === 4 ? '住进海上豪宅区！' : '升级成功：' + n.name + '！';
  banner(title, un ? '解锁 ' + un : '三分钟一局，巨爽巨解压');
  tiles.forEach(t => puff(tileWorld(t, 0.4), 0xffe08a, 1));
  save();
  const TIER_SAY = ['', '有个像样的庇护所了！', '我也住进高级庇护所了！三十年河东，三十年河西！', '水上城堡！老板，你看到了吗？', '豪宅！游艇！肥强彻底逆袭！'];
  setTimeout(() => G && !G.over && qsay(TIER_SAY[G.tier], 4, true), 900);
  const oldKind = mount.kind; setMount();
  if (mount.kind !== oldKind) setTimeout(() => G && !G.over && banner(MOUNT[mount.kind].up, MOUNT[mount.kind].upSub), 2800);
  if (G.tier === 4 && !G.won) { G.won = true; setTimeout(() => showEnd(true), 4600); }
}

// ---------- 天数 ----------
const DAY_TIPS = { 2: '天黑以后鲨鱼会来咬木筏', 3: '蓝色物资桶记得验货', 4: '明晚肌肉佬要来推墙，多铺几块地板', 5: '今晚肌肉佬骑着翡翠蟹来了', 6: '开局一定要选海水过滤器（你选了吗）', 7: 'No more fake ads', 8: '妹子排队倒贴？不存在的，先活下来', 9: '明晚王总来收床位费，先把炮台造好', 10: '今晚王总的收租船来了', 14: '明晚深海巨兽出没', 15: '今晚深海巨兽来了', 19: '明晚……当年踢你出门的老板来了', 20: '今晚老板的黄金战舰来了' };
const MEME = ['海平面又涨了，陆地一块也不剩', '陆地全淹了，只剩你这块木筏', '三分钟一局，巨爽巨解压', '三十年河东，三十年河西', '海水过滤器，你捞到了吗？', '我这就去打捞海水过滤器', '疯狂水世界，启动！'];
const WEATHER = { overcast: { name: '阴天', icon: '☁️', rain: 0, storm: 0 }, rain: { name: '下雨', icon: '🌧', rain: 0.55, storm: 0.35 }, storm: { name: '暴雨', icon: '⛈', rain: 1, storm: 1 } };
function onNewDay() {
  const r = Math.random();
  G.weather = G.day <= 2 ? 'overcast' : r < 0.4 ? 'overcast' : r < 0.72 ? 'rain' : 'storm';
  if (G.weather === 'storm') { banner(`第 ${G.day} 天 · 暴雨来袭`, '电闪雷鸣，今晚鲨鱼更多', 'red'); setTimeout(() => G && !G.over && qsay('这雨下得，跟我命一样苦', 3), 2800); }
  else banner(`第 ${G.day} 天`, DAY_TIPS[G.day] || (G.day % 5 === 0 ? '今晚有大家伙' : MEME[G.day % MEME.length]));
}
function onNight() {
  setTimeout(() => G && !G.over && qsayKey('night', 0, ['鲨鱼又来了……抄家伙！', '天黑了，看好木板！']), 1500);
  let n = (G.day === 1 ? 1 : Math.min(6, 1 + Math.floor(G.day / 3))) + (G.weather === 'storm' ? 1 : 0);
  if (G.day % 5 === 0) { n += 1; spawnBossForDay(G.day); }
  for (let i = 0; i < n; i++) spawnShark(false, i * 5);
}
function daylight(p) { return p < 0.62 ? 1 : p < 0.74 ? 1 - (p - 0.62) / 0.12 : p < 0.94 ? 0 : (p - 0.94) / 0.06; }

// ---------- 每帧逻辑 ----------
function gameUpdate(dt) {
  const prevDay = G.day;
  G.t += dt; G.day = Math.floor(G.t / DAY_LEN) + 1;
  const phase = (G.t % DAY_LEN) / DAY_LEN, night = phase >= 0.7 && phase < 0.95;
  if (G.day > prevDay) onNewDay();
  if (night && !G.wasNight) onNight();
  G.wasNight = night;

  const n = survivors();
  G.water = clamp(G.water + (counts.urine * 0.4 + counts.filter * 0.8 + counts.purifier * 2.5 - (0.55 + 0.07 * n)) * dt, 0, 100);
  G.food = clamp(G.food + (counts.grill * 0.5 + counts.planter * 0.9 + cats.length * 0.12 - (0.38 + 0.05 * n)) * dt, 0, 100);
  if (G.water <= 0 || G.food <= 0) G.hp -= 3 * dt; else G.hp = Math.min(100, G.hp + 1.5 * dt);
  if (G.hp <= 0) { G.hp = 0; return gameOver(G.water <= 0 ? '渴死了，下次先造海水过滤器' : '饿死了，下次多造烤鱼架'); }

  spawnTimer -= dt;
  if (spawnTimer <= 0 && debris.length < 40) {
    const lh = counts.lighthouse ? 1.5 + 0.15 * (counts.lighthouse - 1) : 1;
    spawnTimer = 1.25 / (1 + 0.22 * G.tier) / lh;
    // 黄金马桶镇宅：稀有物概率翻倍
    const r = Math.random(), L = counts.toilet ? 2 : 1;
    let ty = pickType();
    if (r < 0.012 * L) ty = 'gold'; else if (r < 0.027 * L) ty = 'goldbar'; else if (r < 0.035 * L && !G.sword && G.t > 20) ty = 'sword'; else if (r < 0.05 * L && G.t > 30) ty = 'cat';
    spawnDebris(ty);
  }
  if (!G.filtersFound && G.t > 18 && !debris.some(d => d.type === 'gold')) spawnDebris('gold', 2);

  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    if (!d.attached) {
      d.x += d.vx * dt; d.z += d.vz * dt;
      d.g.position.set(d.x, waveH(d.x, d.z, T) + 0.05, d.z);
      d.g.rotation.y += d.spin * dt; d.g.rotation.z = Math.sin(T * 1.3 + d.z) * 0.15;
      if (d.x < raftC.x - 42) removeDebris(d);
    }
  }
  spearCd -= dt;
  updateYacht(dt); updateMount(dt); updateCats(dt);
  tiles.forEach(t => { if (t.flash > 0) { t.flash -= dt; paintTile(t); } });
  updateHooks(dt); updateSharks(dt); if (G.over) return; updateBuildings(dt);
  saveTimer -= dt; if (saveTimer <= 0) { saveTimer = 5; save(); }
}
let saveTimer = 5;

// ---------- 拆除：全额返还 ----------
function tryDemolish(x, z) {
  const t = tiles.get(key(x, z));
  if (!t) { hint('点木筏上的格子拆除', true); sfx('no'); return; }
  const at = tileWorld(t, 1); let txt;
  if (t.b) {
    const { type, free } = t.b;
    removeBuilding(t);
    if (type === 'filter' && free) { G.freeFilter++; txt = '退回 海水过滤器 ×1'; }
    else if (DEFS[type]) { Object.entries(DEFS[type].cost).forEach(([r, n]) => G.res[r] += n); txt = '返还 ' + costText(DEFS[type].cost); }
    else if (type === 'toilet') { G.res.scrap += 40; txt = '黄金马桶卖了 +40 ⚙️'; }
    else txt = '拆了';
  } else {
    if (tiles.size <= 1) { hint('最后一块木板可不能拆', true); sfx('no'); return; }
    removeTile(t); G.res.wood += DEFS.floor.cost.wood; txt = '返还 ' + costText(DEFS.floor.cost);
  }
  recount(); sfx('build'); puff(at, 0xd7ccc8, 8); floatText(at, txt, '#7CDB8A', 1.4);
  if (Math.hypot(avatarTo.x - x, avatarTo.z - z) < 0.8) avatarTo.set(raftC.x, 0, raftC.z);
  qsayKey('demolish', 20, ['拆了重盖，我乐意', '这块地另有安排', '拆！']);
  barSig = ''; save();
}

// ---------- 阿水们（幸存者） ----------
const npcs = [];
let announceNpc = false;
const NPC_SHIRTS = [0x29b6f6, 0x66bb6a, 0xab47bc, 0xff7043, 0x26a69a, 0xec407a];
function freeTile() {
  const all = [...tiles.values()], free = all.filter(t => !t.b && !npcs.some(n => n.tile === t));
  return (free.length ? free : all)[randi(0, (free.length ? free : all).length - 1)];
}
function syncNpcs() {
  if (!G) return;
  const want = Math.min(6, counts.house + counts.tower * 3);
  while (npcs.length > want) raft.remove(npcs.pop().g);
  while (npcs.length < want && tiles.size) {
    const i = npcs.length, g = i === 0 ? makeAshui(0xb71c1c, 0x1d1d1f, 0x5b7ea8, true) : makeAshui(NPC_SHIRTS[i % NPC_SHIRTS.length]), tile = freeTile();
    g.position.set(tile.x + rand(-0.2, 0.2), 0.3, tile.z + rand(-0.2, 0.2)); raft.add(g);
    npcs.push({ g, tile });
    if (i === 0 && announceNpc) { banner('阿水加入了！', '主角来给配角打工了，他会帮你自动甩钩'); floatText(tileWorld(tile, 1.4), '阿水', '#9bd6ff', 2); }
  }
  npcs.forEach(n => { if (!tiles.has(key(n.tile.x, n.tile.z))) { n.tile = freeTile(); n.g.position.set(n.tile.x, 0.3, n.tile.z); } });
}

// ---------- 哈吉米 ----------
const cats = [];
function addCat() {
  const g = makeCat(), t = freeTile(); if (!t) return;
  g.position.set(t.x, 0.3, t.z); raft.add(g);
  cats.push({ g, to: new THREE.Vector3(t.x, 0.3, t.z), wait: rand(1, 3), meow: rand(6, 14) });
}
// 鲨鱼扑过来咬木板时，哈吉米喵一声提醒
let catWarnAt = -99;
function catWarn(s) {
  if (!cats.length || G.t - catWarnAt < 6) return;
  catWarnAt = G.t;
  const c = cats[randi(0, cats.length - 1)];
  floatText(c.g.position.clone().add(new THREE.Vector3(0, raft.position.y + 0.7, 0)), '喵！鲨鱼来了', '#f4a340', 1.6); sfx('meow');
}
function updateCats(dt) {
  cats.forEach(c => {
    c.wait -= dt;
    if (c.wait <= 0) { const t = freeTile(); if (t) c.to.set(t.x + rand(-0.3, 0.3), 0.3, t.z + rand(-0.3, 0.3)); c.wait = rand(3, 7); }
    const d = c.to.clone().sub(c.g.position); d.y = 0;
    if (d.length() > 0.05) { c.g.position.addScaledVector(d.normalize(), Math.min(d.length(), dt * 0.8)); c.g.rotation.y = Math.atan2(d.x, d.z); }
    c.meow -= dt;
    if (c.meow <= 0) { c.meow = rand(10, 20); floatText(c.g.position.clone().add(new THREE.Vector3(0, raft.position.y + 0.6, 0)), '哈吉米~', '#f4a340', 1.6); }
  });
}

// ---------- 坐骑 ----------
const MOUNT = {
  tub:    { name: '红色澡盆', speed: 6, radius: 2.4, up: '', upSub: '' },
  jetski: { name: '摩托艇',   speed: 9.5, radius: 3, up: '换上摩托艇了！', upSub: '再也不用划澡盆了' },
  yacht:  { name: '豪华游艇', speed: 13,  radius: 3.6, up: '别人开游艇，现在你也开上了！', upSub: '点远处海面，开游艇去扫货' },
};
const rider = makeFeiqiang(); rider.visible = false;
const mount = { kind: null, g: null, state: 'dock', pos: new THREE.Vector3(), to: new THREE.Vector3(), launched: false, chase: null, extra: 0 };
function setMount() {
  const kind = !G || G.tier < 2 ? 'tub' : G.tier < 4 ? 'jetski' : 'yacht';
  if (mount.kind === kind) return;
  if (mount.g) { mount.g.remove(rider); scene.remove(mount.g); }
  mount.kind = kind; mount.g = makeMount(kind); mount.g.add(rider);
  rider.position.set(0, mount.g.userData.seat, kind === 'tub' ? 0 : -0.15);
  scene.add(mount.g); mount.state = 'dock'; rider.visible = false; avatar.visible = true;
}
// 停靠点：木筏北侧最靠外、又离中心最近的那块地板，往外挪一格
function dockPos() {
  let best = null, bs = 1e9;
  tiles.forEach(t => { if (tiles.has(key(t.x, t.z - 1))) return; const sc = t.z * 10 + Math.abs(t.x - raftC.x); if (sc < bs) { bs = sc; best = t; } });
  const off = mount.kind === 'yacht' ? 1.7 : 1.0;
  return best ? new THREE.Vector3(best.x, 0, best.z - off) : new THREE.Vector3(raftC.x, 0, raftC.z - raftR - off);
}
function nearestDebris(p, r) {
  let best = null, bd = r * r;
  debris.forEach(d => { if (d.attached || d.reserved) return; const dd = (d.x - p.x) ** 2 + (d.z - p.z) ** 2; if (dd < bd) { bd = dd; best = d; } });
  return best;
}
function rideTo(p) {
  if (mount.state !== 'dock' || playerHook) return;
  const from = dockPos(), dir = new THREE.Vector3(p.x - from.x, 0, p.z - from.z);
  if (dir.length() > 32) dir.setLength(32);
  mount.to.copy(from).add(dir); mount.state = 'out';
  mount.chase = nearestDebris(p, 5); mount.extra = 2; camPan.set(0, 0, 0);
  avatar.visible = false; rider.visible = true; sfx('throw');
  if (!mount.launched) { mount.launched = true; banner('疯狂水世界，启动！', '肥强跳进' + MOUNT[mount.kind].name + '出海了'); }
  qsayKey('ride', 6, mount.kind === 'tub' ? ['划起来！', '红澡盆，启动！'] : mount.kind === 'jetski' ? ['再也不用划澡盆了！'] : ['别人开游艇，我也开游艇！'], true);
}
function updateMount(dt) {
  if (!mount.g) return;
  const m = MOUNT[mount.kind];
  if (mount.state === 'dock') mount.pos.lerp(dockPos(), Math.min(1, dt * 3));
  else {
    // 追着目标漂浮物跑（带一点提前量）；目标被捞走后，附近还有就再追，最多追 3 个
    if (mount.state === 'out' && mount.chase && (mount.chase.attached || mount.chase.reserved || !debris.includes(mount.chase))) {
      mount.chase = mount.extra-- > 0 ? nearestDebris(mount.pos, 7) : null;
      if (!mount.chase) mount.state = 'back';
    }
    if (mount.state === 'out' && Math.hypot(mount.pos.x - raftC.x, mount.pos.z - raftC.z) > raftR + 36) mount.state = 'back';
    const ch = mount.chase, target = mount.state === 'out' ? (ch ? new THREE.Vector3(ch.x + ch.vx * 0.4, 0, ch.z + ch.vz * 0.4) : mount.to) : dockPos();
    const d = target.clone().sub(mount.pos); d.y = 0;
    const len = d.length();
    if (len < 0.3 && !(mount.state === 'out' && ch)) {
      if (mount.state === 'out') { mount.chase = mount.extra-- > 0 ? nearestDebris(mount.pos, 6) : null; if (!mount.chase) mount.state = 'back'; }
      else { mount.state = 'dock'; avatar.visible = true; rider.visible = false; }
    } else {
      mount.pos.addScaledVector(d.normalize(), Math.min(len, m.speed * dt));
      mount.g.rotation.y = Math.atan2(d.x, d.z);
    }
    debris.slice().forEach(db => {
      if (db.attached || db.reserved) return;
      if ((db.x - mount.pos.x) ** 2 + (db.z - mount.pos.z) ** 2 < m.radius * m.radius) collect(db);
    });
    if (mount.g.userData.paddle) mount.g.userData.paddle.rotation.x = Math.sin(T * 8) * 0.6;
  }
  mount.g.position.set(mount.pos.x, waveH(mount.pos.x, mount.pos.z, T) * 0.8 - 0.05, mount.pos.z);
  mount.g.rotation.z = Math.sin(T * 1.5) * 0.05;
}

// ---------- 游艇路过嘲讽 ----------
let yacht = null, yachtTimer = 25;
function yachtLine() {
  const has = counts.filter || counts.purifier;
  const pool = G.tier >= 3 ? ['大佬，带带我！', '这豪宅，巨爽巨解压啊', '哥，过滤器卖我一台？']
    : !has ? ['连个海水过滤器都没有？', '哟，还在划澡盆呢？', '空调外机装你家门口了啊']
    : ['哟，也有海水过滤器了？', '三十年河东，三十年河西……', '也就那样吧'];
  return pool[randi(0, pool.length - 1)];
}
function updateYacht(dt) {
  if (!yacht) {
    yachtTimer -= dt;
    if (yachtTimer <= 0) {
      yachtTimer = rand(60, 90);
      const g = makeYacht(); scene.add(g);
      yacht = { g, x: raftC.x - 40, z: raftC.z - raftR - 6, said: false };
    }
    return;
  }
  yacht.x += 4.5 * dt;
  yacht.g.position.set(yacht.x, waveH(yacht.x, yacht.z, T) * 0.5, yacht.z);
  yacht.g.rotation.z = Math.sin(T * 1.2) * 0.04;
  if (!yacht.said && yacht.x > raftC.x - 3) { yacht.said = true; floatText(new THREE.Vector3(yacht.x + 3, 2.2, yacht.z), yachtLine(), '#ffffff', 3.2);
    setTimeout(() => G && !G.over && qsay(G.tier >= 3 ? '现在谁开游艇还不一定呢！' : '你给我等着！三十年河东，三十年河西！', 3, true), 1600); }
  if (yacht.x > raftC.x + 45) { scene.remove(yacht.g); yacht = null; }
}
