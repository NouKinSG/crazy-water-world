#!/usr/bin/env python3
"""原广告画面版宣传片：画面用 B 站广告合集（BV1m8Yw6KE6W）里的镜头，配音/音乐/时间轴沿用 make_promo.py 的产物。
仅供私下分享——原广告画面版权归原游戏厂商。

前置：先跑过一次 make_promo.py（需要 promo/out/timeline.json、audio.m4a）；原广告视频路径用 --src 指定。
用法：tools/.venv/bin/python promo/make_promo_ads.py --src /path/to/ads.mp4
输出：promo/out/疯狂水世界宣传片-广告版.mp4
"""
import base64
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_promo as m  # noqa: E402
from edl_ads import EDL  # noqa: E402

OUT, W, H = m.OUT, m.W, m.H
BAND_Y, BAND_H = 858, 282          # 原广告烧在画面里的字幕大致在这一条，模糊掉再印我们的

CSS = """
html,body{margin:0;background:transparent;width:720px;height:1280px;overflow:hidden}
.sub{position:absolute;left:5%%;right:5%%;top:930px;text-align:center;font:900 40px/1.3 -apple-system,"PingFang SC",sans-serif;color:#fff;
  -webkit-text-stroke:8px #000;paint-order:stroke fill;letter-spacing:1px}
.sub b{color:#FFE14D}
.band{position:absolute;left:0;right:0;top:%dpx;height:%dpx;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.42) 30%%,rgba(0,0,0,.42) 70%%,rgba(0,0,0,0))}
.stamp{position:absolute;left:50%%;top:36%%;transform:translate(-50%%,-50%%) rotate(-6deg);text-align:center;font:900 52px/1.25 -apple-system,"PingFang SC",sans-serif;
  color:#ff3b30;-webkit-text-stroke:3px #fff;paint-order:stroke fill;border:7px solid #ff3b30;padding:12px 20px;border-radius:14px;background:rgba(255,255,255,.9);white-space:nowrap}
.card{position:absolute;left:0;right:0;top:15%%;text-align:center}
.card h1{margin:0;font:900 84px/1.05 -apple-system,"PingFang SC",sans-serif;color:#fff;-webkit-text-stroke:7px #000;paint-order:stroke fill}
.card h1 em{font-style:normal;color:#FFC53D}
.card p{margin:12px 0 0;font:900 34px -apple-system,"PingFang SC",sans-serif;color:#FFE14D;-webkit-text-stroke:6px #000;paint-order:stroke fill}
.card .url{margin-top:22px;display:inline-block;padding:12px 18px;border-radius:14px;background:rgba(0,0,0,.72);border:2px solid #FFC53D;font:800 22px -apple-system,sans-serif;color:#fff}
""" % (BAND_Y, BAND_H)


def fmt(s):
    import re
    s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)


def render_layers(tl):
    """用无头 Chrome 把字幕、印章、标题、结尾卡片各画成一张透明 PNG，返回 [(png, 开始秒, 结束秒)]"""
    import websocket
    layers, d = [], OUT / 'ads_layers'
    d.mkdir(parents=True, exist_ok=True)
    jobs = [('band', f'<div class="band"></div>', 0, tl['total'])]
    for sc in tl['scenes']:
        for i, (t0, t1, who, text) in enumerate(sc['subs']):
            jobs.append((f"sub_{sc['id']}_{i}", f'<div class="sub">{fmt(text)}</div>', sc['start'] + t0, sc['start'] + t1))
        if sc['id'] == 'twist':
            jobs.append(('stamp', '<div class="stamp">广告里的玩法<br>一个都没有？</div>', sc['start'] + sc['bigAt'], sc['start'] + sc['dur']))
        if sc['id'] == 'title':
            jobs.append(('title', '<div class="card"><h1>疯狂<em>水世界</em></h1><p>这次，是真的</p></div>', sc['start'] + 0.3, sc['start'] + sc['dur']))
        if sc['id'] == 'end':
            jobs.append(('end', '<div class="card"><h1>疯狂<em>水世界</em></h1><p>不用下载 · 不用氪金</p><p>打开网页就能玩</p>'
                                '<div class="url">nimble-snickerdoodle-21ff2e.netlify.app</div></div>', sc['start'] + 0.2, sc['start'] + sc['dur']))
    page = d / 'layer.html'
    page.write_text(f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body id="b"></body></html>', encoding='utf-8')
    port = 9339
    proc = subprocess.Popen([m.CHROME, '--headless=new', f'--remote-debugging-port={port}', '--remote-allow-origins=http://127.0.0.1', f'--window-size={W},{H}',
                             '--hide-scrollbars', f'--user-data-dir={OUT / "chrome-profile3"}', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                tabs = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{port}/json').read())
                ws_url = next(t['webSocketDebuggerUrl'] for t in tabs if t.get('type') == 'page'); break
            except Exception:
                time.sleep(0.2)
        cdp = m.CDP(websocket.create_connection(ws_url, max_size=None, suppress_origin=True))
        cdp.call('Emulation.setDeviceMetricsOverride', width=W, height=H, deviceScaleFactor=1, mobile=False)
        cdp.call('Emulation.setDefaultBackgroundColorOverride', color={'r': 0, 'g': 0, 'b': 0, 'a': 0})
        cdp.call('Page.navigate', url=page.as_uri()); time.sleep(1.0)
        for name, html, a, b in jobs:
            cdp.js(f'document.getElementById("b").innerHTML = {json.dumps(html)}')
            time.sleep(0.05)
            png = d / f'{name}.png'
            png.write_bytes(base64.b64decode(cdp.call('Page.captureScreenshot', format='png')['data']))
            layers.append((png, a, b))
    finally:
        proc.terminate()
    return layers


def main():
    src = sys.argv[sys.argv.index('--src') + 1] if '--src' in sys.argv else None
    if not src:
        raise SystemExit('用 --src 指定原广告视频路径')
    tl = json.loads((OUT / 'timeline.json').read_text(encoding='utf-8'))
    audio = OUT / 'audio.m4a'
    if not audio.exists():
        raise SystemExit('缺少 promo/out/audio.m4a，先跑一次 make_promo.py')
    print('1/2 画字幕和卡片')
    layers = render_layers(tl)
    print('2/2 剪辑原广告画面并合成')
    clips = []
    for sc in tl['scenes']:
        segs = EDL[sc['id']]
        used = 0.0
        for k, seg in enumerate(segs):
            s0, frac, speed = (seg + (1.0,))[:3]
            dur = sc['dur'] - used if k == len(segs) - 1 else round(sc['dur'] * frac, 3)
            used += dur
            clips.append((s0, dur, speed))
    f = []
    n = len(clips)   # 输入顺序：n 段原广告片段 → 配音音乐 → 各张透明图层
    for i, (s0, dur, speed) in enumerate(clips):
        f.append(f'[{i}:v]setpts=(PTS-STARTPTS)/{speed},fps=30,scale={W}:{H}:flags=lanczos,setsar=1,trim=duration={dur:.3f}[c{i}]')
    f.append(''.join(f'[c{i}]' for i in range(len(clips))) + f'concat=n={len(clips)}:v=1:a=0[cat]')
    f.append(f'[cat]split[base][tmp];[tmp]crop={W}:{BAND_H}:0:{BAND_Y},boxblur=22:2[blur];[base][blur]overlay=0:{BAND_Y}[v0]')
    tw = next(s for s in tl['scenes'] if s['id'] == 'twist')
    g0, g1 = tw['start'] + tw['bigAt'], tw['start'] + tw['dur']
    f.append(f"[v0]hue=s=0:enable='between(t,{g0:.3f},{g1:.3f})'[v1]")
    last = 'v1'
    for j, (png, a, b) in enumerate(layers):
        f.append(f"[{last}][{n + 1 + j}:v]overlay=0:0:enable='between(t,{a:.3f},{b:.3f})'[o{j}]")
        last = f'o{j}'
    inputs = []
    for s0, dur, speed in clips:
        inputs += ['-ss', f'{s0:.3f}', '-t', f'{dur * speed + 0.2:.3f}', '-i', src]
    inputs += ['-i', str(audio)]
    for png, _, _ in layers:
        inputs += ['-loop', '1', '-t', str(tl['total']), '-i', str(png)]
    final = OUT / '疯狂水世界宣传片-广告版.mp4'
    script = OUT / 'ads_filter.txt'
    script.write_text(';\n'.join(f), encoding='utf-8')
    m.run(['ffmpeg', '-y', *inputs, '-/filter_complex', str(script), '-map', f'[{last}]', '-map', f'{n}:a', '-t', str(tl['total']),
           '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-c:a', 'copy', '-movflags', '+faststart', str(final)])
    print(f'完成：{final.relative_to(m.ROOT)}（{m.duration(final):.1f} 秒）')


if __name__ == '__main__':
    main()
