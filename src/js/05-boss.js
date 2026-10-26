// ================= Boss：每 5 天一个，都是广告里欺负肥强的人 =================
// 第 5 天肌肉佬骑翡翠蟹（推走外墙）→ 第 10 天王总收租船（扣床位费）→ 第 15 天深海巨兽 → 第 20 天老板的黄金战舰（开炮），之后轮流再来、血更厚
const BOSS_ORDER = ['crab', 'rent', 'beast', 'warship'];
const BOSS_INFO = {
  crab:    { name: '肌肉佬 · 翡翠蟹', hp: 34, banner: ['肌肉佬骑着翡翠蟹来了！', '他要把你木筏边上的空地板推走'], say: '这墙挡我视线了，推了！', reply: '肌肉佬，你怎么把我的外墙都吸走？', h: 2.8 },
  rent:    { name: '王总 · 收租船', hp: 46, banner: ['王总的收租船来了！', '不打沉它，它会一直收你的床位费'], say: '怎么这么快就到期了？交床位费！', reply: '我都给你免费修了二年半的庇护所了！', h: 2.4 },
  beast:   { name: '深海巨兽', hp: 60, banner: ['深海巨兽出现了！', '它一口能咬掉 3 点耐久'], say: '', reply: '这么大一条？！', h: 2.6 },
  warship: { name: '老板 · 黄金战舰', hp: 90, banner: ['庇护所老板的黄金战舰来了！', '当年把你踢出门的人，开着战舰来了'], say: '连个海水过滤器都没有，也配住豪宅？', reply: '老板，三十年河东，三十年河西！', h: 3.2 },
};
const BOSS_LINES = {
  crab: ['推了推了，挡我光了', '这块地归我了', '健身的人力气大，没办法'],
  rent: ['每月多交 50 床位费！', '续费续费！', '不交就搬走'],
  warship: ['开炮！', '豪宅区不欢迎你', '给我轰！'],
};
const cannonballs = [];

// ---------- 模型 ----------
function makeMuscle() {
  const skin = mat(0xd9956b), chain = mesh(new THREE.TorusGeometry(0.17, 0.025, 4, 12), mat(0xffc53d, { metalness: 0.4, roughness: 0.3 }), 0, 1.0, 0.1);
  chain.rotation.x = 1.2;
  return grp(mesh(new THREE.BoxGeometry(0.62, 0.5, 0.36), mat(0xf5f5f5), 0, 0.76, 0),
    mesh(new THREE.BoxGeometry(0.5, 0.22, 0.32), mat(0x9c27b0, { metalness: 0.4, roughness: 0.3 }), 0, 0.41, 0),
    mesh(new THREE.BoxGeometry(0.16, 0.32, 0.18), skin, -0.12, 0.16, 0), mesh(new THREE.BoxGeometry(0.16, 0.32, 0.18), skin, 0.12, 0.16, 0),
    mesh(new THREE.BoxGeometry(0.2, 0.5, 0.22), skin, -0.44, 0.72, 0), mesh(new THREE.BoxGeometry(0.2, 0.5, 0.22), skin, 0.44, 0.72, 0),
    mesh(new THREE.SphereGeometry(0.15, 8, 6), skin, -0.38, 0.98, 0), mesh(new THREE.SphereGeometry(0.15, 8, 6), skin, 0.38, 0.98, 0),
    mesh(new THREE.SphereGeometry(0.14, 8, 6), skin, 0, 1.16, 0), mesh(new THREE.BoxGeometry(0.26, 0.07, 0.26), mat(0x1d1d1f), 0, 1.28, -0.02),
    mesh(new THREE.BoxGeometry(0.26, 0.06, 0.04), mat(0x111111), 0, 1.18, 0.13), chain);
}
function makeGuard() {
  const g = makeBoss(0x1d1d1f);
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 10), mat(0x1d1d1f), 0, 1.25, 0), mesh(new THREE.BoxGeometry(0.2, 0.02, 0.12), mat(0x111111), 0, 1.22, 0.14));
  return g;
}
function bossMat(color, o = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.5, emissive: 0xff0000, emissiveIntensity: 0 }, o)); }
function signPlane(text, w, h, bg, fg) {
  const tex = textTex(256, Math.round(256 * h / w), (c, cw, ch) => {
    c.fillStyle = bg; c.fillRect(0, 0, cw, ch); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `bold ${Math.round(ch * 0.62)}px PingFang SC, Microsoft YaHei, sans-serif`; c.fillText(text, cw / 2, ch / 2 + 2);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }));
}
function makeCrab() {
  const shell = bossMat(0x2fa37f, { roughness: 0.25, metalness: 0.2 }), dark = mat(0x1f6e56);
  const body = mesh(new THREE.SphereGeometry(0.8, 12, 8), shell, 0, 0.35, 0); body.scale.set(1.25, 0.5, 1);
  const g = grp(body);
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const leg = mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.9, 5), dark, -0.4 + i * 0.4, 0.15, side * 0.85);
    leg.rotation.x = side * 1.0; g.add(leg);
  }
  for (const side of [-1, 1]) {
    const arm = mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.6, 5), shell, 0.95, 0.4, side * 0.45); arm.rotation.z = -1.0; g.add(arm);
    g.add(mesh(new THREE.BoxGeometry(0.45, 0.22, 0.3), shell, 1.3, 0.6, side * 0.5));
    g.add(mesh(new THREE.SphereGeometry(0.07, 6, 4), mat(0x111111), 0.75, 0.62, side * 0.18));
  }
  const rider = makeMuscle(); rider.position.set(-0.1, 0.55, 0); rider.rotation.y = Math.PI / 2; g.add(rider);
  g.scale.setScalar(1.5);
  return { g, bodyMat: shell };
}
function makeRentBoat() {
  const g = makeYacht(), hull = bossMat(0xf5f5f5);
  g.children[0].material = hull;
  const wang = makeBoss(0xd4a017); wang.position.set(0.5, 0.36, 0.15); wang.rotation.y = Math.PI / 2; g.add(wang);
  const guard = makeGuard(); guard.position.set(0.5, 0.36, -0.3); guard.rotation.y = Math.PI / 2; g.add(guard);
  const sign = signPlane('收床位费', 1.4, 0.45, '#c62828', '#fff'); sign.position.set(-0.3, 1.45, 0); sign.rotation.y = Math.PI / 2; g.add(sign);
  g.scale.setScalar(1.25);
  return { g, bodyMat: hull };
}
function makeWarship() {
  const hull = bossMat(0xc9a227, { metalness: 0.35, roughness: 0.35 });
  const bow = mesh(new THREE.ConeGeometry(0.8, 1.4, 4), hull, 2.75, 0.2, 0); bow.rotation.z = -Math.PI / 2; bow.rotation.x = Math.PI / 4; bow.scale.set(1, 1, 0.75);
  const g = grp(mesh(new THREE.BoxGeometry(4.2, 0.9, 1.6), hull, 0, 0.2, 0), bow,
    mesh(new THREE.BoxGeometry(4.2, 0.08, 1.62), mat(0x6d4c33), 0, 0.68, 0),
    mesh(new THREE.BoxGeometry(1.4, 0.8, 1.1), mat(0xeceff1), -0.9, 1.1, 0),
    mesh(new THREE.BoxGeometry(1.42, 0.18, 1.12), mat(0x263238), -0.9, 1.3, 0),
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), mat(0x9e9e9e), -1.5, 1.9, 0));
  for (const z of [-0.55, 0.55]) { const c = mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.9, 8), mat(0x263238), 0.9, 0.95, z); c.rotation.x = z > 0 ? -1.2 : 1.2; g.add(c); }
  const flag = signPlane('老板', 0.7, 0.42, '#c62828', '#ffc53d'); flag.position.set(-1.15, 2.45, 0); flag.rotation.y = Math.PI / 2; g.add(flag);
  const boss = makeBoss(0x1d1d1f); boss.position.set(0.1, 0.72, 0); boss.rotation.y = Math.PI / 2; g.add(boss);
  g.scale.setScalar(1.3);
  return { g, bodyMat: hull };
}

// ---------- 出场 ----------
function spawnBossForDay(day) {
  const round = day / 5 - 1, kind = BOSS_ORDER[round % 4], mul = 1 + 0.5 * Math.floor(round / 4);
  const info = BOSS_INFO[kind];
  let s;
  if (kind === 'beast') { s = spawnShark(true, 10); s.maxHp = s.hp = Math.round(info.hp * mul); setTimeout(() => G && !G.over && qsay(info.reply, 3, true), 5000); }
  else {
    const m = kind === 'crab' ? makeCrab() : kind === 'rent' ? makeRentBoat() : makeWarship();
    const ang = rand(0, Math.PI * 2), r = raftR + 26;
    s = { kind, boss: false, hp: Math.round(info.hp * mul), ang, r, state: 'come', timer: 2, dir: Math.random() < 0.5 ? 1 : -1, speed: kind === 'crab' ? 2.4 : 3,
      target: null, dead: false, sink: 0, flash: 0, g: m.g, bodyMat: m.bodyMat, bar: new THREE.Group(), fg: new THREE.Object3D(), barW: 0, loot: { wood: 0, plastic: 0, scrap: 0 },
      x: raftC.x + Math.cos(ang) * r, z: raftC.z + Math.sin(ang) * r };
    s.maxHp = s.hp; s.g.position.set(s.x, 0, s.z); scene.add(s.g); sharks.push(s);
  }
  s.bossKind = kind; s.bossName = info.name; s.said = false;
  setTimeout(() => G && !G.over && banner(info.banner[0], info.banner[1], 'red'), 2400);
  return s;
}
function bossAnchorR(kind) { return raftR + (kind === 'warship' ? 7 : kind === 'rent' ? 4.5 : 4); }
function moveToward(s, tx, tz, spd, dt) {
  const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
  if (d > 0.01) { const k = Math.min(d, spd * dt) / d; s.x += dx * k; s.z += dz * k; s.g.rotation.y = Math.atan2(-dz, dx); }
  return d;
}
function faceRaft(s) { s.g.rotation.y = Math.atan2(-(raftC.z - s.z), raftC.x - s.x); }
function bossArrived(s) {
  if (s.said) return; s.said = true;
  const info = BOSS_INFO[s.kind];
  if (info.say) bossSay(s, info.say, 3.5);
  setTimeout(() => G && !G.over && qsay(info.reply, 3.5, true), 3000);
}

// ---------- 行为 ----------
const BOSS_AI = {
  // 肌肉佬：绕着木筏转，冲过来把边上的空地板直接推走（有建筑的格子就砸 2 点耐久）
  crab(s, dt) {
    const R = bossAnchorR('crab');
    if (s.state === 'come' || s.state === 'circle') {
      s.r = lerp(s.r, R, Math.min(1, dt * 0.5)); s.ang += s.dir * s.speed / Math.max(s.r, 1) * dt;
      moveToward(s, raftC.x + Math.cos(s.ang) * s.r, raftC.z + Math.sin(s.ang) * s.r, 99, dt);
      if (s.r < R + 1.5) { bossArrived(s); s.state = 'circle'; }
      s.timer -= dt;
      if (s.state === 'circle' && s.timer <= 0 && tiles.size) {
        const edges = [...tiles.values()].filter(isEdge);
        s.target = edges.sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0];
        s.state = 'attack';
      }
    } else if (s.state === 'attack') {
      const t = s.target;
      if (!t || !tiles.has(key(t.x, t.z))) { s.state = 'retreat'; return; }
      if (moveToward(s, t.x, t.z, s.speed * 1.6, dt) < 2.0) {
        sfx('thud'); shake(0.45);
        if (!t.b && tiles.size > 6) {
          puff(tileWorld(t), 0x8d5a2b, 12); floatText(tileWorld(t, 1.2), '外墙被推走了！', '#ff6b5b', 2);
          removeTile(t); recount(); bossSay(s, BOSS_LINES.crab[randi(0, 2)], 2.5);
          qsayKey('crabpush', 8, ['肌肉佬，你怎么把我的外墙都吸走？', '我的地板！'], true);
        } else {
          t.hp -= 2; t.flash = 0.25; paintTile(t); floatText(tileWorld(t, 0.8), '砰 -2', '#ff6b5b');
          if (t.hp <= 0) { puff(tileWorld(t), 0x8d5a2b, 10); removeTile(t); recount(); if (!tiles.size) return gameOver('木筏被肌肉佬推没了'); }
        }
        s.state = 'retreat';
      }
    } else if (s.state === 'retreat') {
      const dx = s.x - raftC.x, dz = s.z - raftC.z, d = Math.hypot(dx, dz) || 1;
      moveToward(s, raftC.x + dx / d * (R + 1), raftC.z + dz / d * (R + 1), s.speed * 1.2, dt);
      if (d >= R) { s.r = d; s.ang = Math.atan2(dz, dx); s.state = 'circle'; s.timer = rand(3.5, 5.5); }
    }
    s.g.position.set(s.x, waveH(s.x, s.z, T) - 0.35, s.z);
  },
  // 王总：开到旁边停下，每 4 秒收一次床位费
  rent(s, dt) {
    const R = bossAnchorR('rent');
    if (s.state === 'come') {
      if (moveToward(s, raftC.x + Math.cos(s.ang) * R, raftC.z + Math.sin(s.ang) * R, s.speed, dt) < 0.3) { s.state = 'anchor'; s.timer = 3; bossArrived(s); }
    } else {
      s.x = raftC.x + Math.cos(s.ang) * R; s.z = raftC.z + Math.sin(s.ang) * R; faceRaft(s);
      s.timer -= dt;
      if (s.timer <= 0) {
        s.timer = 4;
        const take = { wood: Math.min(G.res.wood, 4), plastic: Math.min(G.res.plastic, 3), scrap: Math.min(G.res.scrap, 2) };
        const total = take.wood + take.plastic + take.scrap;
        Object.keys(take).forEach(r => { G.res[r] -= take[r]; s.loot[r] += take[r]; });
        const at = new THREE.Vector3(raftC.x, 1.6, raftC.z);
        if (total) floatText(at, `床位费 -${take.wood}🪵 -${take.plastic}🧴 -${take.scrap}⚙️`, '#ff8a80', 1.6);
        else { G.water = Math.max(0, G.water - 10); floatText(at, '没钱？拿水抵！-10 💧', '#ff8a80', 1.6); }
        sfx('no'); bossSay(s, BOSS_LINES.rent[randi(0, 2)], 2.2);
      }
    }
    s.g.position.set(s.x, waveH(s.x, s.z, T) * 0.5, s.z); s.g.rotation.z = Math.sin(T * 1.2) * 0.04;
  },
  // 老板：远远停下，每 3.2 秒朝木筏开一炮
  warship(s, dt) {
    const R = bossAnchorR('warship');
    if (s.state === 'come') {
      if (moveToward(s, raftC.x + Math.cos(s.ang) * R, raftC.z + Math.sin(s.ang) * R, s.speed, dt) < 0.3) { s.state = 'anchor'; s.timer = 2.5; bossArrived(s); }
    } else {
      s.x = raftC.x + Math.cos(s.ang) * R; s.z = raftC.z + Math.sin(s.ang) * R; faceRaft(s);
      s.timer -= dt;
      if (s.timer <= 0 && tiles.size) {
        s.timer = 3.2;
        const all = [...tiles.values()], t = all[randi(0, all.length - 1)];
        const ball = mesh(new THREE.SphereGeometry(0.22, 8, 6), mat(0x212121));
        ball.position.set(s.x, 1.6, s.z); scene.add(ball);
        cannonballs.push({ m: ball, from: ball.position.clone(), to: tileWorld(t, 0.4), tile: t, t: 0 });
        tone(90, 50, 0.3, 'sine', 0.1); noise(0.25, 0.05, 700);
        if (Math.random() < 0.35) bossSay(s, BOSS_LINES.warship[randi(0, 2)], 1.8);
      }
    }
    s.g.position.set(s.x, waveH(s.x, s.z, T) * 0.4 - 0.1, s.z); s.g.rotation.z = Math.sin(T * 0.9) * 0.03;
  },
};
function updateCannonballs(dt) {
  for (let i = cannonballs.length - 1; i >= 0; i--) {
    const b = cannonballs[i]; b.t += dt / 1.1;
    const p = b.from.clone().lerp(b.to, Math.min(1, b.t)); p.y += Math.sin(Math.PI * Math.min(1, b.t)) * 4; b.m.position.copy(p);
    if (b.t >= 1) {
      scene.remove(b.m); cannonballs.splice(i, 1);
      const t = b.tile;
      if (!tiles.has(key(t.x, t.z))) { puff(p, 0xffffff, 6); sfx('splash'); continue; }
      t.hp -= 2; t.flash = 0.3; paintTile(t); puff(tileWorld(t, 0.5), 0x9e9e9e, 10); shake(0.35); sfx('thud');
      floatText(tileWorld(t, 0.9), '轰！-2', '#ff6b5b');
      qsayKey('cannon', 10, ['别轰了别轰了！', '老板你玩真的？']);
      if (t.hp <= 0) { removeTile(t); recount(); if (!tiles.size) return gameOver('木筏被老板的战舰轰沉了'); }
    }
  }
}
// 打赢 Boss 的奖励
function bossDefeated(s) {
  const at = new THREE.Vector3(s.x, 1.6, s.z);
  G.bossWins = (G.bossWins || 0) + 1; sfx('up'); shake(0.4);
  if (s.kind === 'crab') { G.res.wood += 40; G.res.scrap += 25; banner('肌肉佬被你打下了蟹背！', '+40 🪵  +25 ⚙️'); qsay('健身有什么用，还不是被我扎下来了', 3.5, true); }
  else if (s.kind === 'rent') {
    const l = s.loot; G.res.wood += l.wood * 2 + 10; G.res.plastic += l.plastic * 2 + 10; G.res.scrap += l.scrap * 2 + 10;
    banner('王总的收租船沉了！', '床位费连本带利拿回来'); qsay('床位费？我收回来了，还带利息！', 3.5, true);
  } else if (s.kind === 'warship') {
    G.res.wood += 60; G.res.plastic += 50; G.res.scrap += 70; G.water = 100; G.food = 100;
    banner('老板的黄金战舰被你打沉了！', '三十年河东，三十年河西！'); qsay('老板，现在谁住豪宅？', 4, true);
  }
  floatText(at, 'Boss 击败！', '#FFC53D', 2);
}

// ---------- Boss 台词气泡与血条 ----------
const bsayEl = $('#bsay'), bossBarEl = $('#bossBar');
let bsay = { s: null, text: '', typed: 0, left: 0 };
function bossSay(s, text, dur = 2.5) { bsay = { s, text, typed: 0, left: dur + text.length / 18 }; typeInto(bsayEl, text, 0); bsayEl.classList.add('show'); }
const _bv = new THREE.Vector3();
function updateBossUI(dt) {
  const alive = !idle && G && !G.over ? sharks.find(s => !s.dead && (s.kind || s.boss)) : null;
  if (alive) {
    bossBarEl.classList.add('show');
    setT($('#bossName'), alive.bossName || '深海巨兽');
    $('#bossFill').style.width = Math.max(0, alive.hp / alive.maxHp * 100) + '%';
  } else bossBarEl.classList.remove('show');
  if (bsay.left > 0 && bsay.s && !bsay.s.dead && !CS.active) {
    if (!paused) bsay.left -= dt;
    if (bsay.typed < bsay.text.length && !paused) {
      const n = Math.min(bsay.text.length, bsay.typed + Math.max(1, Math.round(dt * 18)));
      if (n % 2 === 0 && !/[\s，。？！…、]/.test(bsay.text[n - 1])) blip(130, 0.028, 'square', 800);
      bsay.typed = n; typeInto(bsayEl, bsay.text, n);
    }
    bsay.s.g.getWorldPosition(_bv); _bv.y += BOSS_INFO[bsay.s.bossKind || 'beast'].h; _bv.project(camera);
    if (_bv.z < 1) { bsayEl.style.left = ((_bv.x + 1) / 2 * innerWidth) + 'px'; bsayEl.style.top = ((1 - _bv.y) / 2 * innerHeight) + 'px'; }
  } else bsayEl.classList.remove('show');
}
