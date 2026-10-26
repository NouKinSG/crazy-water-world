#!/usr/bin/env python3
"""把 src/ 下的源码和 vendor/three.min.js 合成一个单文件游戏：dist/index.html。

用法：python3 build.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
JS_FILES = sorted((ROOT / 'src' / 'js').glob('*.js'))  # 按文件名前缀 01-、02-… 的顺序拼接


def build() -> Path:
    shell = (ROOT / 'src' / 'index.template.html').read_text(encoding='utf-8')
    three = (ROOT / 'vendor' / 'three.min.js').read_text(encoding='utf-8')
    game = '\n'.join(f.read_text(encoding='utf-8') for f in JS_FILES)
    for marker in ('/*__THREE__*/', '/*__GAME__*/'):
        if marker not in shell:
            raise SystemExit(f'模板里缺少占位符 {marker}')
    html = shell.replace('/*__THREE__*/', three).replace('/*__GAME__*/', game)
    out = ROOT / 'dist' / 'index.html'
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding='utf-8')
    return out


if __name__ == '__main__':
    out = build()
    print(f'已生成 {out.relative_to(ROOT)}（{out.stat().st_size // 1024} KB，拼接了 {len(JS_FILES)} 个 JS 文件）')
