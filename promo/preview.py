#!/usr/bin/env python3
"""试录：每个镜头完整跑一遍逻辑，但只在指定位置截一帧，用来快速检查脚本和构图。
用法：tools/.venv/bin/python promo/preview.py [截帧位置 0~1，默认 0.6]
"""
import base64
import json
import sys
import time
import subprocess
import urllib.request
sys.path.insert(0, __import__('os').path.dirname(__file__))
import make_promo as m  # noqa: E402


def main():
    at = float(sys.argv[1]) if len(sys.argv) > 1 else 0.6
    tl = json.loads((m.OUT / 'timeline.json').read_text(encoding='utf-8'))
    import websocket
    html = m.build().read_text(encoding='utf-8')
    head = '<script>window.requestAnimationFrame=function(){return 0};window.PROMO=' + json.dumps(tl, ensure_ascii=False) + ';</script>'
    html = html.replace('<head>', '<head>' + head, 1).replace('</body>', '<script>' + (m.ROOT / 'promo' / 'promo.js').read_text(encoding='utf-8') + '</script></body>')
    page = m.OUT / 'promo_page.html'
    page.write_text(html, encoding='utf-8')
    port = 9338
    proc = subprocess.Popen([m.CHROME, '--headless=new', f'--remote-debugging-port={port}', f'--window-size={m.W},{m.H}', '--hide-scrollbars',
                             '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio', '--remote-allow-origins=http://127.0.0.1', f'--user-data-dir={m.OUT / "chrome-profile2"}', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                tabs = json.loads(urllib.request.urlopen(f'http://127.0.0.1:{port}/json').read())
                ws_url = next(t['webSocketDebuggerUrl'] for t in tabs if t.get('type') == 'page'); break
            except Exception:
                time.sleep(0.2)
        cdp = m.CDP(websocket.create_connection(ws_url, max_size=None, suppress_origin=True))
        cdp.call('Emulation.setDeviceMetricsOverride', width=m.W, height=m.H, deviceScaleFactor=1, mobile=False)
        cdp.call('Page.navigate', url=page.as_uri())
        for _ in range(100):
            time.sleep(0.2)
            if cdp.js('typeof P !== "undefined" && typeof P.tick === "function"'):
                break
        out = m.OUT / 'preview'; out.mkdir(exist_ok=True)
        for i, sc in enumerate(tl['scenes']):
            cdp.js(f'P.begin({i})')
            nf = round(sc['dur'] * m.FPS); snap = int(nf * at)
            for f in range(nf):
                cdp.js('P.tick()')
                if f == snap:
                    (out / f'{i:02d}_{sc["id"]}.jpg').write_bytes(base64.b64decode(cdp.call('Page.captureScreenshot', format='jpeg', quality=80)['data']))
            print('ok', i, sc['id'])
    finally:
        proc.terminate()


if __name__ == '__main__':
    main()
