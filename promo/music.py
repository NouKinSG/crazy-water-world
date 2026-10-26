#!/usr/bin/env python3
"""宣传片背景音乐：代码合成的轻快电子乐（C G Am F，128 BPM），没有版权问题。
用法：python3 promo/music.py <timeline.json> <输出 wav>（由 make_promo.py 调用）
"""
import json
import sys
import wave

import numpy as np

SR = 44100


def synth_music(tl):
    total = tl['total'] + 0.5
    n = int(total * SR)
    out = np.zeros(n)
    bpm, beat = 128, 60 / 128
    t = np.arange(n) / SR
    chords = [[261.6, 329.6, 392.0], [196.0, 246.9, 293.7], [220.0, 261.6, 329.6], [174.6, 220.0, 261.6]]  # C G Am F

    def env(length, a=0.005, d=0.15):
        x = np.arange(length) / SR
        return np.minimum(1, x / a) * np.exp(-x / d)

    def add(start, sig):
        i = int(start * SR)
        if i >= n:
            return
        sig = sig[:n - i]
        out[i:i + len(sig)] += sig

    sc = {s['id']: s for s in tl['scenes']}
    silent = [(sc['twist']['start'] + sc['twist'].get('bigAt', 1.5) - 1.6, sc['title']['start'])]  # 反转时音乐停
    b = 0
    while b * beat < total:
        st = b * beat
        if not any(a <= st < z for a, z in silent):
            L = int(beat * SR)
            # 底鼓
            kt = np.arange(L) / SR
            add(st, 0.55 * np.sin(2 * np.pi * (55 + 90 * np.exp(-kt * 30)) * kt) * np.exp(-kt * 9))
            # 反拍踩镲
            hh = np.random.randn(int(0.05 * SR)) * env(int(0.05 * SR), 0.001, 0.015)
            add(st + beat / 2, 0.08 * hh)
            # 贝斯 + 和弦琶音
            ch = chords[(b // 4) % 4]
            bl = int(beat * 0.9 * SR)
            add(st, 0.16 * np.sign(np.sin(2 * np.pi * ch[0] / 2 * np.arange(bl) / SR)) * env(bl, 0.005, 0.25) * 0.6)
            for j in range(2):
                f = ch[(b * 2 + j) % 3] * 2
                L2 = int(beat / 2 * SR)
                tt = np.arange(L2) / SR
                add(st + j * beat / 2, 0.07 * (2 * np.abs(2 * (tt * f % 1) - 1) - 1) * env(L2, 0.004, 0.12))
        b += 1
    # 反转那一下：泄气的「哇哇哇」长号
    tw = sc['twist']['start'] + sc['twist'].get('bigAt', 1.5)
    for k, f in enumerate([392, 370, 349, 311]):
        L = int((0.32 if k < 3 else 0.9) * SR)
        tt = np.arange(L) / SR
        wob = f * (1 + 0.012 * np.sin(2 * np.pi * 6 * tt)) if k == 3 else f
        add(tw + k * 0.32, 0.22 * np.sign(np.sin(2 * np.pi * wob * tt)) * env(L, 0.02, 0.6 if k == 3 else 0.25) * 0.5)
    # 结尾「启动」重音
    end = sc['end']
    hit = end['start'] + end['subs'][-1][0]
    L = int(1.6 * SR)
    tt = np.arange(L) / SR
    add(hit, 0.5 * np.sin(2 * np.pi * (60 + 60 * np.exp(-tt * 8)) * tt) * np.exp(-tt * 2.5))
    for f in [523.3, 659.3, 784.0, 1046.5]:
        add(hit, 0.06 * np.sin(2 * np.pi * f * tt) * np.exp(-tt * 1.5))
    out = np.tanh(out * 1.2) * 0.7
    fade = int(1.2 * SR)
    out[-fade:] *= np.linspace(1, 0, fade)
    path = sys.argv[2]
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((out * 32767).astype(np.int16).tobytes())
    return path



if __name__ == '__main__':
    synth_music(json.loads(open(sys.argv[1], encoding='utf-8').read()))
