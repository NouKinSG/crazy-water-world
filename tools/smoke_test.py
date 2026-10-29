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
// 声音：启动音频，把所有音效、配乐、说话声都触发一遍，确认不报错
audioInit(); startAmbient(); Object.keys(SFX).forEach(k=>SFX[k]()); pad([220,261.6,329.6],2); blip(...VOICE['肥强']); log.push('音频='+(!!AC&&!!master));
A.newGame('filter'); const G=A.G; G.res.wood=G.res.plastic=G.res.scrap=999;
for(let k=0;k<40;k++) step(0.05);
A.onClickWorld({x:A.raftC.x+22,z:A.raftC.z+3}); for(let k=0;k<400;k++) step(0.05);
log.push('坐骑回港='+(A.mount.state==='dock'));
// 不规则木筏：停靠点要挨着真实地板；木筏边上的浪要比远处小；点远处漂浮物，坐骑要追到手
A.setSel('floor'); for(const [x,z] of [[2,0],[3,0],[4,0],[4,1],[4,2],[-1,1],[-2,1],[-3,1]]) A.tryPlace(x,z); A.setSel(null); A.recount();
const dp=dockPos(); const nearTile=[...A.tiles.values()].some(t=>Math.hypot(t.x-dp.x,t.z-dp.z)<1.3);
let calm=0, rough=0; for(let k=0;k<40;k++){ const tt=k*0.37; calm=Math.max(calm,Math.abs(waveH(A.raftC.x+raftR*0.9,A.raftC.z,tt))); rough=Math.max(rough,Math.abs(waveH(A.raftC.x+raftR+12,A.raftC.z,tt))); }
for(let k=0;k<200;k++) step(0.05);
const dd=A.spawnDebris('barrel',0); dd.x=A.raftC.x+20; dd.z=A.raftC.z+3; const c0=G.caught; A.onClickWorld({x:dd.x,z:dd.z}); for(let k=0;k<400;k++) step(0.05);
log.push('停靠贴地板='+nearTile+' 近处浪/远处浪='+calm.toFixed(2)+'/'+rough.toFixed(2)+' 坐骑追到='+(G.caught>c0)+' 回港='+(A.mount.state==='dock'));
// 王总：收满就走
{ const b=spawnBossForDay(10); b.state='anchor'; b.timer=0; for(let k=0;k<1400;k++){ step(0.05); G.res.wood=G.res.plastic=G.res.scrap=999; if(!sharks.includes(b)) break; } log.push('王总收满走人='+!sharks.includes(b)+' 共收='+(b.taken||0)); }
// 鼠标：左键按下即甩钩、拖动不转视角；右键拖动转视角；右键单击取消建造；Q 键转视角
const cv=document.querySelector('canvas'), pe=(t,b,x,y)=>cv.dispatchEvent(new PointerEvent(t,{pointerId:1,button:b,clientX:x,clientY:y,pointerType:'mouse',bubbles:true}));
const th0=cam.theta, hk0=A.hooks.length; pe('pointerdown',0,innerWidth*0.7,innerHeight*0.5); pe('pointermove',-1,innerWidth*0.7+80,innerHeight*0.5); pe('pointerup',0,innerWidth*0.7+80,innerHeight*0.5);
const leftOk=A.hooks.length>hk0 && cam.theta===th0;
pe('pointerdown',2,500,400); pe('pointermove',-1,620,400); pe('pointerup',2,620,400); const rightRot=cam.theta!==th0;
A.setSel('floor'); pe('pointerdown',2,500,400); pe('pointerup',2,500,400); const cancelOk=sel===null;
const th1=cam.theta; window.dispatchEvent(new KeyboardEvent('keydown',{key:'q'})); const qOk=cam.theta!==th1;
for(let k=0;k<60;k++) step(0.05);
{ const bt=[...A.tiles.values()][0]; bt.hp=1; A.setSel('grill'); A.onClickWorld({x:bt.x,z:bt.z}); log.push('建造中修木板='+(bt.hp===tileMaxHp())); A.setSel(null); }
openHelp(); const hp1=paused&&document.querySelector('#help').classList.contains('show'); closeHelp(); log.push('设置面板 打开暂停='+hp1+' 关闭继续='+!paused);
log.push('鼠标 左键点且不转='+leftOk+' 右键拖转='+rightRot+' 右键取消='+cancelOk+' Q转='+qOk);
A.setSel('floor'); for(let r=0;r<4;r++)for(let x=-3;x<=4;x++)for(let z=-3;z<=4;z++) A.tryPlace(x,z);
for(let i=0;i<4;i++) A.upgrade(); log.push('等级='+G.tier);
for(const k of ['house','tower','turret','laser','windmill','net','planter','purifier','lighthouse']){
  for(const t of A.tiles.values()) if(!t.b){ A.setSel(k); A.tryPlace(t.x,t.z); break; }
}
A.setSel(null); log.push('阿水='+A.npcs.length);
collect(A.spawnDebris('sword',0)); collect(A.spawnDebris('cat',0)); log.push('尚方宝剑='+!!G.sword+' 哈吉米='+cats.length);
A.spawnShark(true); for(let k=0;k<1500;k++){ step(0.05); if(G.over) break; }
log.push('天数='+G.day+' 结束='+G.over);
// Boss：四个都刷一遍，跑一会儿再打死，看奖励和有没有报错
for(const d of [5,10,15,20]){ const b=spawnBossForDay(d); for(let k=0;k<300;k++){ step(0.05); if(G.over) break; } if(G.over) break; damageShark(b,9999,true); for(let k=0;k<60;k++) step(0.05); }
log.push('Boss 胜='+(G.bossWins||0)+' 炮弹残留='+cannonballs.length+' 结束='+G.over);
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
