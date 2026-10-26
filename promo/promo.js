// ================= 宣传片录制模式 =================
// 由 promo/record.py 注入到打包好的游戏里：关掉实时循环，按镜头脚本逐帧推进，叠加广告风字幕。
// window.PROMO（由 record.py 注入）= { fps, scenes: [{ id, dur, subs: [[t0, t1, 说话人, 文本]] }] }
(function () {
  const A = window.__G, P = window.P = {};
  const realSay = qsay, realBossSay = bossSay;
  qsay = () => {}; bossSay = () => {};           // 游戏里随机冒的台词全部屏蔽，只放脚本安排的
  banner = () => {}; hint = () => {};
  onNight = () => {}; onNewDay = () => {};   // 不让游戏自己换天气、刷鲨鱼和 Boss
  localStorage.setItem('cww-help-seen', '1');

  const $o = id => document.getElementById(id);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const fill = () => { G.res.wood = G.res.plastic = G.res.scrap = 999; G.water = G.food = G.hp = 100; };
  function fresh(perk = 'filter') { A.newGame(perk); fill(); G.weather = 'overcast'; setClock(2, 6); sayLeft = 0; yachtTimer = 999; }
  function setClock(day, sec) { G.t = (day - 1) * 40 + sec; G.day = day; G.wasNight = sec / 40 >= 0.7 && sec / 40 < 0.95; }
  function build(types) { types.forEach(k => { for (const t of A.tiles.values()) if (!t.b) { A.setSel(k); A.tryPlace(t.x, t.z); break; } }); A.setSel(null); }
  function spiralFloors(n) {
    A.setSel('floor'); let added = 0;
    for (let r = 1; r < 8 && added < n; r++) for (let x = -r + 1; x <= r && added < n; x++) for (let z = -r + 1; z <= r && added < n; z++) if (!A.tiles.has(key(x, z)) && validPlace('floor', x, z)) { A.tryPlace(x, z); added++; }
    A.setSel(null); return added;
  }
  function city(perk = 'toilet') {
    fresh(perk); G.won = true;
    for (let i = 0; i < 6; i++) spiralFloors(10);
    for (let i = 0; i < 4; i++) { fill(); A.upgrade(); }
    build(['tower','tower','house','tower','laser','windmill','purifier','house','tower','lighthouse','tower','house','tower','planter','tower','turret','laser','tower','house','tower']);
    fill(); document.querySelector('#over').classList.remove('show');
  }
  function placeDebris(type, dx, dz, still = true) { const d = A.spawnDebris(type, 0); d.x = A.raftC.x + dx; d.z = A.raftC.z + dz; if (still) { d.vx = -0.15; d.vz = 0; } d.g.position.set(d.x, 0, d.z); return d; }
  function throwAt(d) { if (d && !d.attached && !d.reserved) A.playerThrow({ x: d.x + d.vx * 0.38, z: d.z + d.vz * 0.38 }); }
  function bossNear(day, dist) {
    const s = spawnBossForDay(day); const ang = Math.PI * 0.15, R = bossAnchorR(s.kind || 'beast') + (dist || 0);
    s.ang = ang; s.r = R; s.x = A.raftC.x + Math.cos(ang) * R; s.z = A.raftC.z + Math.sin(ang) * R;
    if (s.kind === 'rent' || s.kind === 'warship') { s.state = 'anchor'; s.timer = 1.2; s.said = true; }
    if (s.kind === 'crab') { s.state = 'circle'; s.timer = 0.8; s.said = true; }
    return s;
  }
  // 镜头：围着目标点转、推拉
  function orbit(cx, cz, { dist = 14, h = 7, ang = 0.6, spin = 0.08, look = 0.6 } = {}) {
    return t => { const a = ang + spin * t; return { pos: V3(cx + Math.sin(a) * dist, h, cz + Math.cos(a) * dist), look: V3(cx, look, cz) }; };
  }
  const lerpV = (a, b, k) => a.clone().lerp(b, k);

  // ---------- 13 个镜头 ----------
  const S = {
    // 1 模仿原广告开头：破木筏 + 发金光的海水过滤器箱子
    hook: {
      setup() { fresh('urine'); P.gold = placeDebris('gold', 3.6, -1.2); G.weather = 'overcast'; P.tag('作品含AI生成内容'); },
      cam: t => { const c = A.raftC; return { pos: lerpV(V3(c.x + 0.6, 5.2, c.z + 10), V3(c.x + 0.4, 3.6, c.z + 7.2), Math.min(1, t / 4)), look: V3(c.x + 1.0, 0.6, c.z - 0.2) }; },
    },
    // 2 反转：天暗、画面变灰，盖一个大红字
    twist: {
      setup() { G.weather = 'storm'; flash = 0.6; },
      tick(t) { const on = t > P.bigAt; $o('pBig').classList.toggle('show', on); document.querySelector('canvas').style.filter = on ? 'grayscale(.85) contrast(1.1)' : ''; },
      cam: t => { const c = A.raftC, sh = t > P.bigAt && t < P.bigAt + 0.3 ? Math.sin(t * 60) * 0.18 : 0; return { pos: V3(c.x + 0.4 + sh, 3.6, c.z + 7.2), look: V3(c.x + 1.0, 0.6, c.z - 0.2) }; },
      end() { $o('pBig').classList.remove('show'); document.querySelector('canvas').style.filter = ''; },
    },
    // 3 亮标题：镜头扫过沉没的城市
    title: {
      setup() { city('filter'); G.weather = 'overcast'; setClock(6, 4); P.tag('本视频均为游戏实机画面', true); },
      tick(t) { $o('pTitle').classList.toggle('show', t > 0.3); },
      cam: t => ({ pos: V3(-14 + t * 2.4, 8, 18 - t * 1.2), look: V3(0.5, 1.4, 0.5) }),
      end() { $o('pTitle').classList.remove('show'); },
    },
    // 4 被老板赶出高级庇护所（开场剧情 4.4s→12.4s）
    kick: {
      setup() { fresh(); playIntro(() => {}); $o('cut').classList.remove('show'); CS.t = 4.3; P.csSpeed = 1.15; },
      cam: t => { const q = CS.qiang.position; return CS.t < 11 ? null : { pos: V3(4, 4.2, 7.5), look: q.clone() }; },
      end() { CS.onEnd = null; endIntro(); P.csSpeed = 0; },
    },
    // 5 发誓逆袭（剧情 17.0s→22.8s）
    vow: {
      setup() { fresh(); playIntro(() => {}); $o('cut').classList.remove('show'); CS.t = 16.9; CS.weather = 'storm'; CS.fired = {}; ['card','cardOff','m1','m2','m3','kick','splash','rain','laugh'].forEach(k => CS.fired[k] = true); CS.wall.visible = true; P.csSpeed = 1.0; },
      cam: t => { const q = CS.qiang.position; return { pos: V3(q.x - 0.8, 2.0, q.z + 6.2), look: V3(q.x + 1.2, 0.5, q.z) }; },
      end() { CS.onEnd = null; endIntro(); P.csSpeed = 0; },
    },
    // 6 甩钩捞东西
    fish: {
      setup() {
        fresh('filter'); spiralFloors(4); build(['net', 'grill']);
        P.deb = []; for (let i = 0; i < 6; i++) P.deb.push(placeDebris(['wood', 'plastic', 'scrap', 'barrel', 'wood', 'ac'][i], 2.5 + i * 1.3, (i % 3 - 1) * 2.4 + 0.5));
        P.nextThrow = 0.2;
      },
      tick(t) { if (t > P.nextThrow) { P.nextThrow += 0.62; throwAt(P.deb.find(d => !d.attached && !d.reserved && debris.includes(d))); } },
      cam: t => { const c = A.raftC; return { pos: V3(c.x + 1.4 + t * 0.3, 6.5, c.z + 10.5), look: V3(c.x + 2.2, 0.3, c.z + 0.4) }; },
    },
    // 7 捞到海水过滤器
    gold: {
      setup() { P.g = placeDebris('gold', 4.2, 0.6); P.thrown = false; P.placed = false; },
      tick(t) {
        if (!P.thrown && t > 0.2) { P.thrown = true; throwAt(P.g); }
        if (!P.placed && G.freeFilter > 0 && t > 1.6) { P.placed = true; const free = [...A.tiles.values()].find(x => !x.b); A.setSel('filter'); A.tryPlace(free.x, free.z); A.setSel(null); }
      },
      cam: t => { const c = A.raftC; return { pos: lerpV(V3(c.x + 1, 4.5, c.z + 6.5), V3(c.x + 0.5, 3.2, c.z + 4.5), Math.min(1, t / 3)), look: V3(c.x + 1.2, 0.6, c.z + 0.2) }; },
    },
    // 8 延时：从五级小木筏建成海上豪宅区
    grow: {
      setup() { fresh('filter'); P.step = 0; setClock(3, 2); },
      tick(t, dt) {
        G.t = 2 * 40 + 6 + t * 1.5; fill();
        const want = Math.floor(t * 9); while (P.step < want) { P.step++; spiralFloors(1); fill();
          if (P.step % 9 === 0) A.upgrade();
          if (P.step > 6 && P.step % 2 === 0) build([['house', 'grill', 'net', 'planter', 'turret', 'windmill', 'tower', 'tower', 'purifier', 'lighthouse', 'tower', 'laser', 'tower', 'tower'][(P.step / 2) % 14]]);
        }
      },
      cam: t => { const c = A.raftC, d = 8 + t * 2.0, a = 0.5 + t * 0.3; return { pos: V3(c.x + Math.sin(a) * d, 5 + t * 1.3, c.z + Math.cos(a) * d), look: V3(c.x, 1.0, c.z) }; },
    },
    // 9 开游艇出海
    mount: {
      setup() { city(); setClock(6, 8); P.rode = false; },
      tick(t) { if (!P.rode && t > 0.2) { P.rode = true; rideTo({ x: A.raftC.x + 26, z: A.raftC.z + 10 }); } },
      cam: t => { const m = mount.pos; return { pos: V3(m.x - 5, 3.2, m.z + 6), look: V3(m.x + 1, 0.6, m.z) }; },
    },
    // 10 肌肉佬推墙
    crab: {
      setup() { fresh('filter'); spiralFloors(16); fill(); A.upgrade(); fill(); A.upgrade(); build(['house', 'grill', 'planter', 'house']); setClock(5, 6); P.b = bossNear(5); P.b.timer = 0.6; },
      cam: t => { const c = A.raftC, b = P.b, mx = (c.x + b.x) / 2, mz = (c.z + b.z) / 2; return { pos: V3(mx - 1, 13, mz + 15), look: V3(mx, 0.6, mz) }; },
    },
    // 11 王总收床位费
    rent: {
      setup() { fresh('filter'); spiralFloors(14); fill(); A.upgrade(); build(['house', 'grill', 'house']); setClock(10, 6); G.res.wood = 60; G.res.plastic = 40; G.res.scrap = 30; P.b = bossNear(10); P.b.timer = 1.0; },
      cam: t => { const c = A.raftC, b = P.b, mx = (c.x + b.x) / 2, mz = (c.z + b.z) / 2; return { pos: V3(mx + 1, 11.5, mz + 16), look: V3(mx, 0.8, mz) }; },
    },
    // 12 老板的黄金战舰开炮，被炮台打沉
    warship: {
      setup() { city(); setClock(20, 9); P.b = bossNear(20); P.b.timer = 0.5; P.b.hp = P.b.maxHp * 0.55; P.sunk = false; },
      tick(t) { if (!P.sunk && t > P.sinkAt) { P.sunk = true; damageShark(P.b, 99999, true); } },
      cam: t => { const c = A.raftC, b = P.b, mx = (c.x + b.x) / 2, mz = (c.z + b.z) / 2; return { pos: V3(mx + 2, 19, mz + 27), look: V3(mx, 1, mz) }; },
    },
    // 13 收尾：夜里的海上豪宅区 + 网址
    end: {
      setup() { city(); G.weather = 'overcast'; setClock(7, 31); },
      tick(t) { $o('pEnd').classList.toggle('show', t > 0.2); },
      cam: orbit(0.5, 0.5, { dist: 17, h: 8.5, ang: 0.4, spin: 0.09, look: 1.2 }),
    },
  };

  // ---------- 叠加层：广告风字幕、标签、小字 ----------
  const css = document.createElement('style');
  css.textContent = `
    #hud,#start,#over,#help,#banner,#cutSkip{display:none!important}
    #cut .lb{display:none}#cutSub,#cutCard,#cutTitle{display:none!important}
    .pTag{position:fixed;left:14px;top:12px;z-index:60;font:600 13px -apple-system,"PingFang SC",sans-serif;color:rgba(255,255,255,.82);text-shadow:0 1px 2px #000}
    .pTag.real{color:#FFC53D}
    #pSub{position:fixed;left:6%;right:6%;top:70%;z-index:60;text-align:center;font:900 38px/1.3 -apple-system,"PingFang SC",sans-serif;color:#fff;
      -webkit-text-stroke:7px #000;paint-order:stroke fill;letter-spacing:1px}
    #pSub b{color:#FFE14D}
    #pWho{display:none}
    #pFine{position:fixed;left:0;right:0;bottom:16px;z-index:60;text-align:center;font:600 12px -apple-system,"PingFang SC",sans-serif;color:rgba(255,255,255,.8);text-shadow:0 1px 2px #000}
    #pBig{position:fixed;left:50%;top:36%;z-index:61;transform:translate(-50%,-50%) rotate(-6deg) scale(1.6);opacity:0;transition:all .25s cubic-bezier(.2,1.6,.4,1);
      text-align:center;font:900 46px/1.25 -apple-system,"PingFang SC",sans-serif;color:#ff3b30;-webkit-text-stroke:3px #fff;paint-order:stroke fill;border:6px solid #ff3b30;padding:10px 18px;border-radius:12px;background:rgba(255,255,255,.88);white-space:nowrap}
    #pBig.show{opacity:1;transform:translate(-50%,-50%) rotate(-6deg) scale(1)}
    #pTitle,#pEnd{position:fixed;left:0;right:0;top:24%;z-index:61;text-align:center;opacity:0;transition:opacity .4s,transform .5s cubic-bezier(.2,1.6,.4,1);transform:scale(1.3)}
    #pTitle.show,#pEnd.show{opacity:1;transform:scale(1)}
    #pTitle h1,#pEnd h1{font:900 74px/1.05 -apple-system,"PingFang SC",sans-serif;color:#fff;-webkit-text-stroke:6px #000;paint-order:stroke fill}
    #pTitle h1 em,#pEnd h1 em{font-style:normal;color:#FFC53D}
    #pTitle p,#pEnd p{margin-top:12px;font:900 30px -apple-system,"PingFang SC",sans-serif;color:#FFE14D;-webkit-text-stroke:5px #000;paint-order:stroke fill}
    #pEnd .url{margin-top:22px;display:inline-block;padding:10px 16px;border-radius:12px;background:rgba(0,0,0,.6);border:2px solid #FFC53D;font:800 20px -apple-system,sans-serif;color:#fff;-webkit-text-stroke:0}
    #pEnd{top:16%}
    #say{font-size:20px!important;padding:9px 16px!important;max-width:none!important;white-space:nowrap!important}
    #bsay{font-size:20px!important;padding:9px 16px!important;white-space:nowrap!important}`;
  document.head.appendChild(css);
  const ov = document.createElement('div');
  ov.innerHTML = `<div class="pTag" id="pTag"></div><div id="pSub"></div>
    <div id="pFine">以上场景无需达到任何关卡，开局就有 · 非官方粉丝作品</div>
    <div id="pBig">广告里的玩法<br>一个都没有？</div>
    <div id="pTitle"><h1>疯狂<em>水世界</em></h1><p>这次，是真的</p></div>
    <div id="pEnd"><h1>疯狂<em>水世界</em></h1><p>不用下载 · 不用氪金</p><p>打开网页就能玩</p><div class="url">nimble-snickerdoodle-21ff2e.netlify.app</div></div>`;
  document.body.appendChild(ov);
  P.tag = (text, real) => { const e = $o('pTag'); e.textContent = text; e.classList.toggle('real', !!real); };
  const fmt = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  // ---------- 逐帧驱动（record.py 调用） ----------
  let cur = null, curDef = null, frame = 0;
  P.begin = i => {
    if (curDef && curDef.end) curDef.end();
    cur = PROMO.scenes[i]; curDef = S[cur.id]; frame = 0; P.csSpeed = 0; P.sinkAt = cur.sinkAt ?? 99; P.bigAt = cur.bigAt ?? 99;
    curDef.setup();
    // 气泡台词：说话人是肥强的字幕，同时在头顶冒气泡；Boss 的台词冒在 Boss 头顶
    cur.subs.forEach(s => s.shown = false);
  };
  P.tick = () => {
    const dt = 1 / PROMO.fps, t = frame / PROMO.fps; frame++;
    if (curDef.tick) curDef.tick(t, dt);
    if (P.csSpeed) { CS.active = true; step(dt * P.csSpeed); } else step(dt);
    const c = curDef.cam && curDef.cam(t);
    if (c) {
      camera.position.copy(c.pos); camera.lookAt(c.look); cam.tx = c.look.x; cam.tz = c.look.z;
      sun.position.set(c.look.x + 14, 26, c.look.z + 9); sun.target.position.set(c.look.x, 0, c.look.z);
    }
    const sub = cur.subs.find(s => t >= s[0] && t < s[1]);
    $o('pSub').innerHTML = sub ? fmt(sub[3]) : '';
    cur.subs.forEach(s => {
      if (s.shown || t < s[0]) return; s.shown = true;
      const plain = s[3].replace(/\*\*/g, '');
      if (s[2] === '肥强' && !CS.active) realSay(plain, s[1] - s[0] + 0.3, true);
      if (['老板', '肌肉佬', '王总'].includes(s[2]) && P.b && !CS.active) realBossSay(P.b, plain, s[1] - s[0]);
    });
    renderer.render(scene, camera);
  };
  P.sinkAt = 99; P.bigAt = 99;
})();
