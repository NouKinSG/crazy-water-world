#!/usr/bin/env python3
"""原声混剪版宣传片：用原广告的镜头和原声台词拼出我们自己的故事线，反转和亮底处补我们的旁白。
仅供私下分享——原广告画面和声音版权归原游戏厂商。

前置：先跑过一次 make_promo.py（复用 promo/out/voice/*.wav 里的旁白）；原广告视频和音轨用 --src / --audio 指定。
用法：tools/.venv/bin/python promo/make_promo_remix.py --src ads.mp4 --audio ads.m4a
输出：promo/out/疯狂水世界宣传片-原声版.mp4
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
from make_promo_ads import BAND_H, BAND_Y, CSS, fmt  # noqa: E402

OUT, W, H = m.OUT, m.W, m.H
VOICE = OUT / 'voice'

# 原声段：(源视频开始秒, 结束秒, 说明)——起止点按原广告烧录字幕的出现/消失逐 0.25 秒对过
ORIGINAL = [
    (240.6, 243.6, '3分钟一局 / 超爽超解压 / 疯狂水世界 / 启动'),
    (248.2, 250.4, '海水过滤器怎么卖 / 1万 / 2万来一台'),
    (288.7, 291.9, '你连海水过滤器都没有 / 带你玩就不错了'),
    (379.95, 381.6, '为什么我总是住不上高级庇护所'),
    (764.3, 766.4, '房间已到期 / 请尽快离开'),
    (227.2, 230.3, '不给住就算了 / 我这就去打捞海水过滤器 / 升级豪华避难所'),
    (541.2, 543.6, '我终于打捞到海水过滤器啦'),
    (563.2, 565.3, '住进高级庇护所啦'),
    (877.95, 879.2, '真正的老钱来了'),
]
FINALE = (499.7, 501.85)   # 原声「疯狂水世界启动」收尾


def build_plan():
    segs, t = [], 0.0
    for a, b, note in ORIGINAL:
        segs.append({'src': a, 'dur': round(b - a, 3), 'orig': True, 'start': t}); t += b - a
    ads_end = t
    # 反转：解说一句，说完后画面变灰盖印章
    v_tw = m.duration(VOICE / '02.wav')
    tw = {'src': 636.6, 'dur': round(v_tw + 1.9, 3), 'start': t, 'blur': True, 'grey_from': v_tw - 0.1,
          'voice': [(0.15, VOICE / '02.wav', '天天刷到这个广告，点进去一看——')], 'stamp': True}
    segs.append(tw); t += tw['dur']
    v_ti = m.duration(VOICE / '03.wav')
    ti = {'src': 556.0, 'dur': round(v_ti + 0.5, 3), 'start': t, 'blur': True, 'title': True,
          'voice': [(0.2, VOICE / '03.wav', '这次，我们把广告**做成了真的**！')]}
    segs.append(ti); t += ti['dur']
    v_en = m.duration(VOICE / '19.wav')
    en = {'src': 549.8, 'dur': round(v_en + 0.35, 3), 'start': t, 'blur': True, 'card': True,
          'voice': [(0.15, VOICE / '19.wav', '不用下载，不用氪金，**打开网页就能玩**！')]}
    segs.append(en); t += en['dur']
    fi = {'src': FINALE[0], 'dur': round(FINALE[1] - FINALE[0], 3), 'start': t, 'orig': True, 'card': True, 'hold': 0.9}
    segs.append(fi); t += fi['dur'] + fi['hold']
    return segs, ads_end, t


def render(jobs):
    import websocket
    d = OUT / 'remix_layers'; d.mkdir(parents=True, exist_ok=True)
    page = d / 'layer.html'
    page.write_text(f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body id="b"></body></html>', encoding='utf-8')
    port = 9340
    proc = subprocess.Popen([m.CHROME, '--headless=new', f'--remote-debugging-port={port}', '--remote-allow-origins=http://127.0.0.1', f'--window-size={W},{H}',
                             '--hide-scrollbars', f'--user-data-dir={OUT / "chrome-profile4"}', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    out = []
    try:
        for _ in range(50):
            try:
                tabs = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{port}/json').read())
                ws_url = next(x['webSocketDebuggerUrl'] for x in tabs if x.get('type') == 'page'); break
            except Exception:
                time.sleep(0.2)
        cdp = m.CDP(websocket.create_connection(ws_url, max_size=None, suppress_origin=True))
        cdp.call('Emulation.setDeviceMetricsOverride', width=W, height=H, deviceScaleFactor=1, mobile=False)
        cdp.call('Emulation.setDefaultBackgroundColorOverride', color={'r': 0, 'g': 0, 'b': 0, 'a': 0})
        cdp.call('Page.navigate', url=page.as_uri()); time.sleep(1.0)
        for name, html, a, b in jobs:
            cdp.js(f'document.getElementById("b").innerHTML = {json.dumps(html)}'); time.sleep(0.05)
            png = d / f'{name}.png'
            png.write_bytes(base64.b64decode(cdp.call('Page.captureScreenshot', format='png')['data']))
            out.append((png, a, b))
    finally:
        proc.terminate()
    return out


def main():
    src = sys.argv[sys.argv.index('--src') + 1]
    src_audio = sys.argv[sys.argv.index('--audio') + 1]
    segs, ads_end, total = build_plan()
    print(f'片长 {total:.1f} 秒（原声段 {ads_end:.1f} 秒）')

    # ---- 图层：反转/亮底段的字幕、印章、标题、网址卡片 ----
    END_CARD = ('<div class="card"><h1>疯狂<em>水世界</em></h1><p>不用下载 · 不用氪金</p><p>打开网页就能玩</p>'
                '<div class="url">nimble-snickerdoodle-21ff2e.netlify.app</div></div>')
    jobs = []
    for i, s in enumerate(segs):
        a, b = s['start'], s['start'] + s['dur'] + s.get('hold', 0)
        if s.get('blur'):
            jobs.append((f'band{i}', '<div class="band"></div>', a, b))
        for k, (t0, wav, text) in enumerate(s.get('voice', [])):
            jobs.append((f'sub{i}_{k}', f'<div class="sub">{fmt(text)}</div>', a + t0, a + t0 + m.duration(wav) + 0.15))
        if s.get('stamp'):
            jobs.append((f'stamp{i}', '<div class="stamp">广告里的玩法<br>一个都没有？</div>', a + s['grey_from'], b))
        if s.get('title'):
            jobs.append((f'title{i}', '<div class="card"><h1>疯狂<em>水世界</em></h1><p>这次，是真的</p></div>', a + 0.1, b))
        if s.get('card'):
            jobs.append((f'card{i}', END_CARD, a + 0.1, b))
    layers = render(jobs)

    # ---- 视频：逐段截取、需要时模糊原字幕条/变灰，再拼接 ----
    n = len(segs)
    inputs, f = [], []
    for s in segs:
        inputs += ['-ss', f"{s['src']:.3f}", '-t', f"{s['dur'] + 0.2:.3f}", '-i', src]
    for i, s in enumerate(segs):
        chain = f"[{i}:v]setpts=PTS-STARTPTS,fps=30,scale={W}:{H}:flags=lanczos,setsar=1,trim=duration={s['dur']:.3f}"
        if s.get('hold'):
            chain += f",tpad=stop_mode=clone:stop_duration={s['hold']}"
        if s.get('grey_from') is not None:
            chain += f",hue=s=0:enable='gte(t,{s['grey_from']:.3f})'"
        if s.get('blur'):
            f.append(chain + f'[r{i}]')
            f.append(f'[r{i}]split[r{i}a][r{i}b];[r{i}b]crop={W}:{BAND_H}:0:{BAND_Y},boxblur=22:2[r{i}c];[r{i}a][r{i}c]overlay=0:{BAND_Y}[c{i}]')
        else:
            f.append(chain + f'[c{i}]')
    f.append(''.join(f'[c{i}]' for i in range(n)) + f'concat=n={n}:v=1:a=0[cat]')
    last = 'cat'
    base = n + 2   # n 段视频 → 原广告音轨 → 配乐 → 旁白们 → 图层
    voices = [(s['start'] + t0, wav) for s in segs for t0, wav, _ in s.get('voice', [])]
    lay0 = base + len(voices)
    for j, (png, a, b) in enumerate(layers):
        f.append(f"[{last}][{lay0 + j}:v]overlay=0:0:enable='between(t,{a:.3f},{b:.3f})'[o{j}]"); last = f'o{j}'

    # ---- 音频：原声段从原广告音轨截取（两头 30ms 淡入淡出防爆音），其余段静音；叠旁白和配乐 ----
    aparts = []
    for i, s in enumerate(segs):
        if s.get('orig'):
            f.append(f"[{n}:a]atrim=start={s['src']:.3f}:duration={s['dur']:.3f},asetpts=PTS-STARTPTS,aresample=44100,"
                     f"afade=t=in:d=0.03,afade=t=out:st={s['dur'] - 0.04:.3f}:d=0.04,apad=pad_dur={s.get('hold', 0)},aformat=sample_rates=44100:channel_layouts=stereo[oa{i}]")
        else:
            f.append(f"anullsrc=r=44100:cl=stereo,atrim=duration={s['dur']:.3f},aformat=sample_rates=44100:channel_layouts=stereo[oa{i}]")
        aparts.append(f'[oa{i}]')
    f.append(''.join(aparts) + f'concat=n={n}:v=0:a=1,aformat=channel_layouts=stereo,volume=0.95[orig]')
    for k, (t0, wav) in enumerate(voices):
        ms = int(t0 * 1000)
        f.append(f'[{base + k}:a]aresample=44100,adelay={ms}|{ms},volume=3.6[vo{k}]')
    music_from = ads_end
    f.append(f"[{n + 1}:a]adelay={int(music_from * 1000)}|{int(music_from * 1000)},volume=0.95[mu]")
    f.append('[orig][mu]' + ''.join(f'[vo{k}]' for k in range(len(voices))) + f'amix=inputs={2 + len(voices)}:normalize=0,alimiter=limit=0.95[aout]')

    # 配乐只给反转之后的部分：按这段的时间重新合成
    tl = {'total': total - ads_end + 0.5, 'scenes': [
        {'id': 'twist', 'start': 0.0, 'bigAt': segs[n - 4]['grey_from']},
        {'id': 'title', 'start': segs[n - 3]['start'] - ads_end},
        {'id': 'end', 'start': segs[n - 2]['start'] - ads_end, 'subs': [[segs[n - 1]['start'] - segs[n - 2]['start'] + 0.1]]}]}
    (OUT / 'remix_tl.json').write_text(json.dumps(tl), encoding='utf-8')
    m.run([__import__('shutil').which('python3'), str(m.ROOT / 'promo' / 'music.py'), str(OUT / 'remix_tl.json'), str(OUT / 'remix_music.wav')])

    inputs += ['-i', src_audio, '-i', str(OUT / 'remix_music.wav')]
    for _, wav in voices:
        inputs += ['-i', str(wav)]
    for png, _, _ in layers:
        inputs += ['-loop', '1', '-t', f'{total:.3f}', '-i', str(png)]
    script = OUT / 'remix_filter.txt'
    script.write_text(';\n'.join(f), encoding='utf-8')
    final = OUT / '疯狂水世界宣传片-原声版.mp4'
    m.run(['ffmpeg', '-y', *inputs, '-/filter_complex', str(script), '-map', f'[{last}]', '-map', '[aout]', '-t', f'{total:.3f}',
           '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', str(final)])
    print(f'完成：{final.relative_to(m.ROOT)}（{m.duration(final):.1f} 秒）')


if __name__ == '__main__':
    main()
