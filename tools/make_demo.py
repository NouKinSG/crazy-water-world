#!/usr/bin/env python3
"""生成本地演示版：在打包好的游戏上加一个「演示控制面板」，用假数据直接跳到各种场景看效果。

用法：python3 tools/make_demo.py   → 生成 tools/.tmp/demo.html 并用浏览器打开
演示版只用来本地看效果，不要发布。
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from build import build  # noqa: E402

PANEL = r"""
<style>
#demo{position:fixed;left:12px;top:50%;transform:translateY(-50%);z-index:50;width:176px;max-height:92vh;overflow-y:auto;
  background:rgba(16,24,34,.9);border:1px solid #FFC53D;border-radius:12px;padding:10px;font:12px -apple-system,"PingFang SC",sans-serif;color:#F5F5F7}
#demo h5{font-size:12px;color:#FFC53D;margin:8px 0 4px;font-weight:800}
#demo h5:first-child{margin-top:0}
#demo button{display:block;width:100%;margin:3px 0;padding:6px 8px;border-radius:7px;border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.06);color:#F5F5F7;font-size:12px;text-align:left;cursor:pointer}
#demo button:hover{border-color:#FFC53D}
#demo .x{position:absolute;right:8px;top:6px;cursor:pointer;color:rgba(255,255,255,.5)}
#dayBox{left:200px!important}
@media (max-width:760px){#demo{left:4px;width:132px;top:auto;bottom:230px;transform:none;max-height:40vh}#dayBox{left:8px!important}}
</style>
<div id="demo"><span class="x" onclick="this.parentNode.style.display='none'">✕</span>
<h5>🎬 演示面板</h5>
<button data-a="mid">🔄 中期存档（简易庇护所）</button>
<button data-a="city">🏙️ 满级城市（各种豪宅）</button>
<button data-a="big">🧪 不规则大木筏（测停靠/视角/海浪）</button>
<button data-a="far">🧪 远处漂来物资（测坐骑追物）</button>
<h5>Boss（直接出现在跟前）</h5>
<button data-a="b5">💪 肌肉佬 · 翡翠蟹</button>
<button data-a="b10">💰 王总 · 收租船</button>
<button data-a="b15">🦈 深海巨兽</button>
<button data-a="b20">🚢 老板 · 黄金战舰</button>
<button data-a="kill">⚔️ 秒杀当前 Boss</button>
<h5>稀有物（漂到眼前）</h5>
<button data-a="sword">🗡️ 尚方宝剑</button>
<button data-a="cat">🐱 哈吉米</button>
<button data-a="goldbar">🥇 黄金棒</button>
<button data-a="gold">✨ 海水过滤器金箱</button>
<h5>天气 / 时间</h5>
<button data-a="storm">⛈️ 暴雨</button>
<button data-a="clear">☁️ 阴天</button>
<button data-a="night">🌙 跳到晚上</button>
<button data-a="day">☀️ 跳到白天</button>
<h5>其他</h5>
<button data-a="sharks">🦈 来 3 条鲨鱼</button>
<button data-a="yacht">🛥️ 富人游艇路过嘲讽</button>
<button data-a="say">💬 肥强说句话</button>
<button data-a="intro">🎞️ 看开场剧情</button>
<button data-a="help">⚙️ 设置与玩法面板</button>
<button data-a="res">💎 资源 +999</button>
</div>
<script>
(function () {
  localStorage.setItem('cww-help-seen', '1');
  const A = window.__G;
  const near = (type) => { const d = A.spawnDebris(type, 0); d.x = A.raftC.x + 7; d.z = A.raftC.z + 1; d.g.position.set(d.x, 0, d.z); };
  const fill = () => { const G = A.G; G.res.wood = G.res.plastic = G.res.scrap = 999; G.water = G.food = G.hp = 100; };
  // Boss 直接放到跟前，不用等它游过来
  const near5 = (day) => {
    const s = spawnBossForDay(day), ang = 0.4, R = (s.kind ? bossAnchorR(s.kind, ang) : raftR + 5);
    s.ang = ang; s.r = R; s.x = A.raftC.x + Math.cos(ang) * R; s.z = A.raftC.z + Math.sin(ang) * R;
    if (s.kind === 'rent' || s.kind === 'warship') { s.state = 'anchor'; s.timer = 1.5; }
    if (s.kind === 'crab') { s.state = 'circle'; s.timer = 1; }
    if (s.kind) bossArrived(s);
  };
  const build = (types) => { types.forEach(k => { for (const t of A.tiles.values()) if (!t.b) { A.setSel(k); A.tryPlace(t.x, t.z); break; } }); A.setSel(null); };
  function mid() {
    A.newGame('filter'); fill(); const G = A.G;
    A.setSel('floor'); for (const [x, z] of [[2,0],[2,1],[-1,0],[-1,1],[0,2],[1,2],[2,2],[-1,2],[0,-1],[1,-1]]) A.tryPlace(x, z);
    A.upgrade(); build(['grill', 'net', 'house', 'turret', 'planter', 'house']); G.t = 3 * 40 + 4; G.day = 4; G.weather = 'overcast'; fill();
  }
  function city() {
    A.newGame('toilet'); fill(); const G = A.G; G.won = true;
    A.setSel('floor'); for (let r = 0; r < 3; r++) for (let x = -3; x <= 4; x++) for (let z = -3; z <= 4; z++) A.tryPlace(x, z);
    for (let i = 0; i < 4; i++) A.upgrade();
    build(['tower','tower','house','tower','laser','windmill','purifier','house','tower','lighthouse','tower','house','tower','planter','tower','house','turret','tower']);
    G.t = 5 * 40 + 5; fill(); setTimeout(() => document.querySelector('#over').classList.remove('show'), 1800);
  }
  const ACT = {
    mid, city,
    b5: () => near5(5), b10: () => near5(10), b15: () => near5(15), b20: () => near5(20),
    big() {
      A.newGame('filter'); fill(); G.weather = 'overcast';
      A.setSel('floor');
      for (const [x, z] of [[2,0],[3,0],[4,0],[5,0],[5,1],[5,2],[5,3],[6,3],[7,3],[-1,1],[-2,1],[-3,1],[-3,2],[-3,3],[-4,3],[0,2],[1,2],[1,3],[1,4],[2,4],[3,4]]) A.tryPlace(x, z);
      A.setSel(null); fill(); A.upgrade(); fill();
      build(['house', 'grill', 'net', 'planter']); G.t = 2 * 40 + 6; fill();
    },
    far() { for (let i = 0; i < 4; i++) { const d = A.spawnDebris(['barrel', 'wood', 'plastic', 'scrap'][i], 0); d.x = A.raftC.x + 18 + i * 2; d.z = A.raftC.z + (i - 1.5) * 3; d.g.position.set(d.x, 0, d.z); } hint('点那几个远处的物资，看澡盆会不会追过去'); hintLock = 4; },
    kill: () => sharks.filter(s => !s.dead && (s.kind || s.boss)).forEach(s => damageShark(s, 99999, true)),
    sword: () => near('sword'), cat: () => near('cat'), goldbar: () => near('goldbar'), gold: () => near('gold'),
    storm: () => { A.G.weather = 'storm'; }, clear: () => { A.G.weather = 'overcast'; },
    night: () => { const G = A.G; G.t = Math.floor(G.t / 40) * 40 + 29; }, day: () => { const G = A.G; G.t = Math.floor(G.t / 40 + 1) * 40 + 2; },
    sharks: () => { for (let i = 0; i < 3; i++) A.spawnShark(false, i * 3); },
    yacht: () => { yachtTimer = 0; }, say: () => qsay(['三十年河东，三十年河西！', '老板，你给我等着！', '莫欺中年穷！'][Math.floor(Math.random() * 3)], 3, true),
    intro: () => playIntro(() => { document.querySelector('#hud').style.display = ''; if (paused) togglePause(); }),
    help: () => openHelp(), res: fill,
  };
  document.querySelectorAll('#demo button').forEach(b => b.onclick = (e) => { e.stopPropagation(); audioInit(); startAmbient(); ACT[b.dataset.a](); b.blur(); });
  setTimeout(mid, 300);
})();
</script>
"""


def main():
    out = build()
    tmp = ROOT / 'tools' / '.tmp'
    tmp.mkdir(exist_ok=True)
    demo = tmp / 'demo.html'
    demo.write_text(out.read_text(encoding='utf-8').replace('</body>', PANEL + '</body>'), encoding='utf-8')
    print(f'已生成 {demo.relative_to(ROOT)}')
    if sys.platform == 'darwin':
        subprocess.run(['open', str(demo)])


if __name__ == '__main__':
    main()
