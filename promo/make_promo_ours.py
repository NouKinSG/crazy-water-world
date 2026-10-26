#!/usr/bin/env python3
"""「借原广告画面讲我们游戏」版宣传片：人物和画面用原广告的镜头，台词讲的是我们游戏的玩法和卖点。
开头结尾用原广告原声，讲玩法的台词用 AI 配音，全程铺一层我们自己的配乐把各段粘起来。
仅供私下分享——原广告画面和声音版权归原游戏厂商。

用法：tools/.venv/bin/python promo/make_promo_ours.py --src ads.mp4 --audio ads.m4a [--skip-tts]
输出：promo/out/疯狂水世界宣传片-玩法版.mp4
"""
import asyncio
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_promo as m  # noqa: E402
from make_promo_ads import BAND_H, BAND_Y, fmt  # noqa: E402
from make_promo_remix import render  # noqa: E402

OUT, W, H = m.OUT, m.W, m.H
VDIR = OUT / 'voice_ours'
VOICES = {'旁白': ('zh-CN-YunjianNeural', '+26%', '+2Hz'), '肥强': ('zh-CN-YunxiNeural', '+14%', '-14Hz')}
END_CARD = ('<div class="card"><h1>疯狂<em>水世界</em></h1><p>不用下载 · 不用氪金</p><p>打开网页就能玩</p>'
            '<div class="url">nimble-snickerdoodle-21ff2e.netlify.app</div></div>')
TITLE_CARD = '<div class="card"><h1>疯狂<em>水世界</em></h1><p>这次，是真的</p></div>'

# 分镜：orig = 原广告原声段（源视频起止秒）；否则是 AI 配音段，clips 为配的原广告镜头（按顺序平分时长）
PLAN = [
    {'orig': (240.6, 243.6)},                                                                    # 原声：3分钟一局 超爽超解压 疯狂水世界 启动
    {'who': '旁白', 'text': '天天刷到这个广告？这次——**是真能玩的**！', 'clips': [556.0], 'card': TITLE_CARD},
    {'who': '旁白', 'text': '点海面甩钩，木头、塑料、废铁，**捞到就是赚**！', 'clips': [541.2]},
    {'who': '肥强', 'text': '捞到**海水过滤器**了！', 'clips': [493.3]},
    {'who': '旁白', 'text': '从五级小木筏，一路升到**海上豪宅区**！', 'clips': [310.6, 304.3, 296.9]},
    {'who': '旁白', 'text': '红澡盆、摩托艇、豪华游艇，**坐骑一路换**！', 'clips': [184.7, 331.9, 478.9]},
    {'who': '肥强', 'text': '肌肉佬，你怎么把我的**外墙**都吸走？', 'clips': [408.9]},
    {'who': '旁白', 'text': '王总上门收床位费？**打沉他的收租船**！', 'clips': [764.3, 244.0]},
    {'who': '旁白', 'text': '当年踢你出门的老板，**开着战舰来了**！', 'clips': [877.9]},
    {'who': '肥强', 'text': '三十年河东，**三十年河西**！', 'clips': [228.0]},
    {'who': '旁白', 'text': '还有哈吉米、尚方宝剑、**电鳗发电机**……', 'clips': [463.6, 45.0, 252.6]},
    {'who': '旁白', 'text': '不用下载，不用氪金，**打开网页就能玩**！', 'clips': [549.8], 'card': END_CARD},
    {'orig': (499.7, 501.85), 'card': END_CARD, 'hold': 0.9},                                   # 原声：疯狂水世界启动
]


async def tts(lines):
    import edge_tts
    for i, (who, text) in lines:
        voice, rate, pitch = VOICES[who]
        await edge_tts.Communicate(text.replace('**', ''), voice, rate=rate, pitch=pitch).save(str(VDIR / f'{i:02d}.mp3'))


def main():
    src = sys.argv[sys.argv.index('--src') + 1]
    src_audio = sys.argv[sys.argv.index('--audio') + 1]
    VDIR.mkdir(parents=True, exist_ok=True)
    spoken = [(i, (p['who'], p['text'])) for i, p in enumerate(PLAN) if 'who' in p]
    if '--skip-tts' not in sys.argv:
        print('1/3 配音'); asyncio.run(tts(spoken))
    trim = 'silenceremove=start_periods=1:start_threshold=-42dB,areverse,silenceremove=start_periods=1:start_threshold=-42dB,areverse'
    for i, _ in spoken:
        m.run(['ffmpeg', '-y', '-i', str(VDIR / f'{i:02d}.mp3'), '-af', trim, '-ar', '44100', str(VDIR / f'{i:02d}.wav')])

    # ---- 排时间轴 ----
    segs, t = [], 0.0
    for i, p in enumerate(PLAN):
        if 'orig' in p:
            a, b = p['orig']
            s = {'pieces': [(a, b - a)], 'dur': b - a, 'orig': True}
        else:
            vd = m.duration(VDIR / f'{i:02d}.wav')
            dur = round(vd + 0.35, 3)
            k = len(p['clips'])
            s = {'pieces': [(c, dur / k) for c in p['clips']], 'dur': dur, 'voice': (0.12, VDIR / f'{i:02d}.wav', p['text'])}
        s.update(start=t, card=p.get('card'), hold=p.get('hold', 0))
        segs.append(s); t += s['dur'] + s['hold']
    total = t
    print(f'片长 {total:.1f} 秒')

    # ---- 图层 ----
    jobs = []
    for i, s in enumerate(segs):
        a, b = s['start'], s['start'] + s['dur'] + s['hold']
        if 'voice' in s:
            t0, wav, text = s['voice']
            jobs.append((f'band{i}', '<div class="band"></div>', a, b))
            jobs.append((f'sub{i}', f'<div class="sub">{fmt(text)}</div>', a + t0, a + t0 + m.duration(wav) + 0.15))
        if s['card']:
            jobs.append((f'card{i}', s['card'], a + 0.1, b))
    print('2/3 画字幕和卡片')
    layers = render(jobs)

    # ---- 视频 ----
    print('3/3 剪辑合成')
    pieces = [(i, src0, d) for i, s in enumerate(segs) for src0, d in s['pieces']]
    inputs, f = [], []
    for _, src0, d in pieces:
        inputs += ['-ss', f'{src0:.3f}', '-t', f'{d + 0.2:.3f}', '-i', src]
    seg_labels = {}
    for j, (i, src0, d) in enumerate(pieces):
        f.append(f'[{j}:v]setpts=PTS-STARTPTS,fps=30,scale={W}:{H}:flags=lanczos,setsar=1,trim=duration={d:.3f}[p{j}]')
        seg_labels.setdefault(i, []).append(f'[p{j}]')
    for i, s in enumerate(segs):
        lab = ''.join(seg_labels[i])
        chain = f'{lab}concat=n={len(seg_labels[i])}:v=1:a=0' + (f',tpad=stop_mode=clone:stop_duration={s["hold"]}' if s['hold'] else '')
        if 'voice' in s:
            f.append(chain + f'[r{i}]')
            f.append(f'[r{i}]split[r{i}a][r{i}b];[r{i}b]crop={W}:{BAND_H}:0:{BAND_Y},boxblur=22:2[r{i}c];[r{i}a][r{i}c]overlay=0:{BAND_Y}[s{i}]')
        else:
            f.append(chain + f'[s{i}]')
    f.append(''.join(f'[s{i}]' for i in range(len(segs))) + f'concat=n={len(segs)}:v=1:a=0[cat]')
    np_ = len(pieces)
    voices = [(s['start'] + s['voice'][0], s['voice'][1]) for s in segs if 'voice' in s]
    lay0 = np_ + 2 + len(voices)
    last = 'cat'
    for j, (png, a, b) in enumerate(layers):
        f.append(f"[{last}][{lay0 + j}:v]overlay=0:0:enable='between(t,{a:.3f},{b:.3f})'[o{j}]"); last = f'o{j}'

    # ---- 音频：原声段取原广告音轨，其余静音；全程铺配乐（原声段压低），叠 AI 配音 ----
    aparts = []
    for i, s in enumerate(segs):
        if s.get('orig'):
            a0, d = s['pieces'][0]
            f.append(f"[{np_}:a]atrim=start={a0:.3f}:duration={d:.3f},asetpts=PTS-STARTPTS,aresample=44100,afade=t=in:d=0.03,"
                     f"afade=t=out:st={d - 0.05:.3f}:d=0.05,apad=pad_dur={s['hold']},aformat=sample_rates=44100:channel_layouts=stereo[oa{i}]")
        else:
            f.append(f"anullsrc=r=44100:cl=stereo,atrim=duration={s['dur']:.3f},aformat=sample_rates=44100:channel_layouts=stereo[oa{i}]")
        aparts.append(f'[oa{i}]')
    f.append(''.join(aparts) + f'concat=n={len(segs)}:v=0:a=1,volume=0.95[orig]')
    orig_win = '+'.join(f"between(t,{s['start']:.3f},{s['start'] + s['dur'] + s['hold']:.3f})" for s in segs if s.get('orig'))
    f.append(f"[{np_ + 1}:a]aresample=44100,volume='if({orig_win},0.12,0.55)':eval=frame[mu]")
    for k, (t0, wav) in enumerate(voices):
        ms = int(t0 * 1000)
        f.append(f'[{np_ + 2 + k}:a]aresample=44100,adelay={ms}|{ms},volume=3.4[vo{k}]')
    f.append('[orig][mu]' + ''.join(f'[vo{k}]' for k in range(len(voices))) + f'amix=inputs={2 + len(voices)}:normalize=0,alimiter=limit=0.95[aout]')

    # 配乐：全程连续（不做反转停顿），收尾在原声「启动」处来一记重音
    fin = segs[-1]['start']
    tl = {'total': total + 0.5, 'scenes': [{'id': 'twist', 'start': -100.0, 'bigAt': 0.0}, {'id': 'title', 'start': -99.0},
                                           {'id': 'end', 'start': fin, 'subs': [[0.05]]}]}
    (OUT / 'ours_tl.json').write_text(json.dumps(tl), encoding='utf-8')
    m.run([shutil.which('python3'), str(m.ROOT / 'promo' / 'music.py'), str(OUT / 'ours_tl.json'), str(OUT / 'ours_music.wav')])

    inputs += ['-i', src_audio, '-i', str(OUT / 'ours_music.wav')]
    for _, wav in voices:
        inputs += ['-i', str(wav)]
    for png, _, _ in layers:
        inputs += ['-loop', '1', '-t', f'{total:.3f}', '-i', str(png)]
    script = OUT / 'ours_filter.txt'
    script.write_text(';\n'.join(f), encoding='utf-8')
    final = OUT / '疯狂水世界宣传片-玩法版.mp4'
    m.run(['ffmpeg', '-y', *inputs, '-/filter_complex', str(script), '-map', f'[{last}]', '-map', '[aout]', '-t', f'{total:.3f}',
           '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', str(final)])
    print(f'完成：{final.relative_to(m.ROOT)}（{m.duration(final):.1f} 秒）')


if __name__ == '__main__':
    main()
