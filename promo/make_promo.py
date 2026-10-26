#!/usr/bin/env python3
"""一条命令出宣传片：配音 → 排时间轴 → 逐帧录游戏画面 → 合成背景音乐 → 混音出片。

用法（需要 tools/.venv 里装好 edge-tts、websocket-client，本机有 Chrome 和 ffmpeg）：
  tools/.venv/bin/python promo/make_promo.py            # 全流程
  tools/.venv/bin/python promo/make_promo.py --skip-tts # 台词没改时复用已生成的配音
输出：promo/out/疯狂水世界宣传片.mp4（竖屏 720x1280）
"""
import asyncio
import base64
import json
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'promo' / 'out'
sys.path.insert(0, str(ROOT))
from build import build  # noqa: E402

FPS = 30
W, H = 720, 1280
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

# 角色 → (edge-tts 声音, 语速, 音高)
VOICES = {
    '旁白': ('zh-CN-YunjianNeural', '+22%', '+0Hz'),
    '解说': ('zh-CN-YunyangNeural', '+4%', '-2Hz'),
    '肥强': ('zh-CN-YunxiNeural', '+14%', '-14Hz'),
    '老板': ('zh-CN-YunyangNeural', '+4%', '-22Hz'),
    '肌肉佬': ('zh-CN-YunjianNeural', '+0%', '-26Hz'),
    '王总': ('zh-CN-YunyangNeural', '+20%', '-6Hz'),
}

# 镜头脚本：(镜头, 最短时长, [(说话人, 字幕（**高亮**）, 指定开始秒数或 None)], 额外参数)
SCRIPT = [
    ('hook', 4.2, [('旁白', '开局一定要选**海水过滤器**！', None), ('旁白', '**三分钟一局**，巨爽巨解压！', None)], {}),
    ('twist', 4.6, [('解说', '天天刷到这个广告，点进去一看——', None)], {'bigAfter': 0}),
    ('title', 3.4, [('旁白', '这次，我们把广告**做成了真的**！', 0.3)], {}),
    ('kick', 6.9, [('老板', '没有**海水过滤器**，也配住高级庇护所？', 0.2), ('肥强', '老板，我能干活！', None), ('老板', '滚！', 5.6)], {}),
    ('vow', 5.8, [('肥强', '三十年河东，三十年河西！', 0.3), ('肥强', '我这就去打捞**海水过滤器**！', None)], {}),
    ('fish', 4.0, [('旁白', '甩钩就能捞，捞到就是赚！', 0.3)], {}),
    ('gold', 3.6, [('肥强', '捞到**海水过滤器**了！', 0.6), ('旁白', '人生，一键重启！', None)], {}),
    ('grow', 6.0, [('旁白', '从五级小木筏，一路建到**海上豪宅区**！', 0.4)], {}),
    ('mount', 3.6, [('肥强', '别人开游艇？现在**我也开上了**！', 0.4)], {}),
    ('crab', 5.6, [('肌肉佬', '这墙挡我视线了，推了！', 0.3), ('肥强', '肌肉佬，你怎么把我的**外墙**都吸走？', None)], {}),
    ('rent', 4.2, [('王总', '怎么这么快就到期了？每月多交**五十床位费**！', 0.3)], {}),
    ('warship', 6.2, [('老板', '连个海水过滤器都没有，也配住**豪宅**？', 0.3), ('肥强', '老板，现在谁住豪宅？', None)], {'sinkAfter': 0}),
    ('end', 6.8, [('旁白', '不用下载，不用氪金，**打开网页就能玩**！', 0.3), ('旁白', '疯狂水世界，**启动**！', None)], {}),
]


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)


def duration(path):
    return float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)]).stdout.strip())


# ---------- 1. 配音 ----------
async def tts_all(lines):
    import edge_tts
    for i, (who, text) in enumerate(lines):
        voice, rate, pitch = VOICES[who]
        path = OUT / 'voice' / f'{i:02d}.mp3'
        await edge_tts.Communicate(text.replace('**', ''), voice, rate=rate, pitch=pitch).save(str(path))
        print(f'  配音 {i:02d} {who}：{text}')


def make_timeline(skip_tts):
    (OUT / 'voice').mkdir(parents=True, exist_ok=True)
    flat = [(who, text) for _, _, lines, _ in SCRIPT for who, text, _ in lines]
    if not skip_tts:
        asyncio.run(tts_all(flat))
    for i in range(len(flat)):
        src, dst = OUT / 'voice' / f'{i:02d}.mp3', OUT / 'voice' / f'{i:02d}.wav'
        trim = 'silenceremove=start_periods=1:start_threshold=-42dB,areverse,silenceremove=start_periods=1:start_threshold=-42dB,areverse'
        run(['ffmpeg', '-y', '-i', str(src), '-af', trim, '-ar', '44100', str(dst)])
    scenes, clips, t0, k = [], [], 0.0, 0
    for sid, min_dur, lines, extra in SCRIPT:
        subs, cursor = [], 0.25
        for who, text, at in lines:
            d = duration(OUT / 'voice' / f'{k:02d}.wav')
            start = at if at is not None else cursor
            subs.append([round(start, 3), round(start + d + 0.12, 3), who, text])
            clips.append((t0 + start, OUT / 'voice' / f'{k:02d}.wav'))
            cursor = start + d + 0.12
            k += 1
        dur = max(min_dur, cursor + 0.3)
        sc = {'id': sid, 'dur': round(dur, 3), 'start': round(t0, 3), 'subs': subs}
        if 'bigAfter' in extra:
            sc['bigAt'] = subs[extra['bigAfter']][1] - 0.15
        if 'sinkAfter' in extra:
            sc['sinkAt'] = subs[extra['sinkAfter']][1] + 0.1
        scenes.append(sc)
        t0 += dur
    tl = {'fps': FPS, 'total': round(t0, 3), 'scenes': scenes}
    (OUT / 'timeline.json').write_text(json.dumps(tl, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'时间轴：{len(scenes)} 个镜头，共 {t0:.1f} 秒')
    return tl, clips


# ---------- 2. 逐帧录画面（用 Chrome 调试协议遥控无头浏览器） ----------
class CDP:
    def __init__(self, ws):
        self.ws, self.n = ws, 0

    def call(self, method, **params):
        self.n += 1
        self.ws.send(json.dumps({'id': self.n, 'method': method, 'params': params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get('id') == self.n:
                if 'error' in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get('result', {})

    def js(self, expr):
        r = self.call('Runtime.evaluate', expression=expr, returnByValue=True)
        if 'exceptionDetails' in r:
            raise RuntimeError(f"JS 出错：{expr[:60]} → {r['exceptionDetails'].get('exception', {}).get('description', r['exceptionDetails'])}")
        return r.get('result', {}).get('value')


def record(tl):
    import websocket
    frames = OUT / 'frames'
    shutil.rmtree(frames, ignore_errors=True)
    frames.mkdir(parents=True)
    page = OUT / 'promo_page.html'
    html = build().read_text(encoding='utf-8')
    head = '<script>window.requestAnimationFrame=function(){return 0};window.PROMO=' + json.dumps(tl, ensure_ascii=False) + ';</script>'
    html = html.replace('<head>', '<head>' + head, 1)
    html = html.replace('</body>', '<script>' + (ROOT / 'promo' / 'promo.js').read_text(encoding='utf-8') + '</script></body>')
    page.write_text(html, encoding='utf-8')

    port = 9337
    proc = subprocess.Popen([CHROME, '--headless=new', f'--remote-debugging-port={port}', f'--window-size={W},{H}', '--hide-scrollbars',
                             '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio', '--remote-allow-origins=http://127.0.0.1', f'--user-data-dir={OUT / "chrome-profile"}', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                tabs = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{port}/json').read())
                ws_url = next(t['webSocketDebuggerUrl'] for t in tabs if t.get('type') == 'page')
                break
            except Exception:
                time.sleep(0.2)
        cdp = CDP(websocket.create_connection(ws_url, max_size=None, suppress_origin=True))
        cdp.call('Emulation.setDeviceMetricsOverride', width=W, height=H, deviceScaleFactor=1, mobile=False)
        cdp.call('Page.navigate', url=page.as_uri())
        for _ in range(100):
            time.sleep(0.2)
            if cdp.js('typeof P !== "undefined" && typeof P.tick === "function"'):
                break
        n, t_start = 0, time.time()
        for i, sc in enumerate(tl['scenes']):
            cdp.js(f'P.begin({i})')
            for _ in range(round(sc['dur'] * FPS)):
                cdp.js('P.tick()')
                shot = cdp.call('Page.captureScreenshot', format='jpeg', quality=90)
                (frames / f'{n:05d}.jpg').write_bytes(base64.b64decode(shot['data']))
                n += 1
            print(f"  镜头 {i + 1:2d}/{len(tl['scenes'])} {sc['id']:8s} 完成（累计 {n} 帧，{time.time() - t_start:.0f} 秒）")
        return n
    finally:
        proc.terminate()


# ---------- 3. 背景音乐：交给 promo/music.py（用系统自带 numpy 的 Python 跑） ----------
def synth_music(tl):
    py = shutil.which('python3') or 'python3'
    run([py, str(ROOT / 'promo' / 'music.py'), str(OUT / 'timeline.json'), str(OUT / 'music.wav')])
    return OUT / 'music.wav'


# ---------- 4. 混音 + 出片 ----------
def mix_and_encode(tl, clips, music, nframes):
    inputs, filters = ['-i', str(music)], ['[0:a]volume=0.32[m]']
    for i, (start, path) in enumerate(clips):
        inputs += ['-i', str(path)]
        ms = int(start * 1000)
        filters.append(f'[{i + 1}:a]aresample=44100,adelay={ms}|{ms},volume=1.6[v{i}]')
    filters.append(''.join(f'[v{i}]' for i in range(len(clips))) + f'amix=inputs={len(clips)}:normalize=0[vo]')
    filters.append('[m][vo]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]')
    audio = OUT / 'audio.m4a'
    run(['ffmpeg', '-y', *inputs, '-filter_complex', ';'.join(filters), '-map', '[a]', '-t', str(tl['total']), '-c:a', 'aac', '-b:a', '160k', str(audio)])
    final = OUT / '疯狂水世界宣传片.mp4'
    run(['ffmpeg', '-y', '-framerate', str(FPS), '-i', str(OUT / 'frames' / '%05d.jpg'), '-i', str(audio),
         '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', str(final)])
    return final


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    skip = '--skip-tts' in sys.argv
    print('1/4 配音和时间轴')
    tl, clips = make_timeline(skip)
    print('2/4 逐帧录制游戏画面（比较慢）')
    n = record(tl)
    print('3/4 合成背景音乐')
    music = synth_music(tl)
    print('4/4 混音出片')
    final = mix_and_encode(tl, clips, music, n)
    print(f'完成：{final.relative_to(ROOT)}（{duration(final):.1f} 秒）')


if __name__ == '__main__':
    main()
