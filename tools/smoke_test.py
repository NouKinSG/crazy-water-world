#!/usr/bin/env python3
"""冒烟测试：先打包，再用无头 Chrome 自动跑一遍核心流程，检查有没有报错。

用法：python3 tools/smoke_test.py
需要本机装有 Google Chrome / Chromium。测试页生成在 tools/.tmp/，不进仓库。
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from build import build  # noqa: E402

CHROME_CANDIDATES = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
]

# 在页面里自动走一遍：开局、铺地板、升满级、各种建筑、坐骑出海、鲨鱼、拆除、存档读档、开场剧情
TEST_SCRIPT = r"""
<script>window.__ERR=[];window.onerror=(m,s,l,c)=>{__ERR.push(m+' @'+l+':'+c)};</script>
<script>setTimeout(()=>{try{
const A=__G, log=[];
A.newGame('filter'); const G=A.G; G.res.wood=G.res.plastic=G.res.scrap=999;
for(let k=0;k<40;k++) step(0.05);
A.onClickWorld({x:A.raftC.x+22,z:A.raftC.z+3}); for(let k=0;k<400;k++) step(0.05);
log.push('坐骑回港='+(A.mount.state==='dock'));
A.setSel('floor'); for(let r=0;r<4;r++)for(let x=-3;x<=4;x++)for(let z=-3;z<=4;z++) A.tryPlace(x,z);
for(let i=0;i<4;i++) A.upgrade(); log.push('等级='+G.tier);
for(const k of ['house','tower','turret','laser','windmill','net','planter','purifier','lighthouse']){
  for(const t of A.tiles.values()) if(!t.b){ A.setSel(k); A.tryPlace(t.x,t.z); break; }
}
A.setSel(null); log.push('阿水='+A.npcs.length);
collect(A.spawnDebris('sword',0)); collect(A.spawnDebris('cat',0)); log.push('尚方宝剑='+!!G.sword+' 哈吉米='+cats.length);
A.spawnShark(true); for(let k=0;k<1500;k++){ step(0.05); if(G.over) break; }
log.push('天数='+G.day+' 结束='+G.over);
const w=G.res.wood; A.setSel('demolish'); const t=[...A.tiles.values()].find(t=>t.b&&t.b.type==='house'); A.onClickWorld({x:t.x,z:t.z}); A.setSel(null);
log.push('拆除返还木头='+(G.res.wood-w));
save(); const v1=[...A.tiles.values()].map(t=>t.b?t.b.v:'').join(); loadGame(readSave()); const v2=[...A.tiles.values()].map(t=>t.b?t.b.v:'').join();
log.push('读档造型一致='+(v1===v2));
playIntro(()=>A.newGame('urine')); for(let k=0;k<560;k++) step(0.05); log.push('剧情播完进游戏='+(!CS.active&&A.tiles.size===4));
document.title='RESULT '+log.join(' | ')+' | ERR '+JSON.stringify(__ERR);
}catch(e){document.title='EXC '+e.message+' '+(e.stack||'').split('\n')[1];}},800);</script>
"""


def find_chrome():
    for c in CHROME_CANDIDATES:
        if Path(c).exists() or shutil.which(c):
            return c
    raise SystemExit('没找到 Chrome，请先安装 Google Chrome')


def main():
    out = build()
    tmp = ROOT / 'tools' / '.tmp'
    tmp.mkdir(exist_ok=True)
    page = tmp / 'smoke.html'
    html = out.read_text(encoding='utf-8')
    page.write_text(html.replace('</body>', TEST_SCRIPT + '</body>'), encoding='utf-8')
    res = subprocess.run([find_chrome(), '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
                          '--window-size=1280,800', '--virtual-time-budget=30000', '--dump-dom', page.as_uri()],
                         capture_output=True, text=True, timeout=300)
    m = re.search(r'<title>(.*?)</title>', res.stdout)
    title = m.group(1) if m else '(没拿到结果)'
    print(title)
    ok = title.startswith('RESULT') and 'ERR []' in title
    print('通过 ✅' if ok else '失败 ❌')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
