#!/usr/bin/env python3
"""
Elaborate browser fingerprint test via WebDriver.
Collects every fingerprint signal possible from servoshell.

Usage:
    docker run -d --name ng -p 7000:7000 \
        registry.noogoo.ch/orderout/nightglow:latest \
        --headless --webdriver 7000 about:blank

    python3 fingerprint.py [--url http://localhost:7000] [--json]
"""

import sys
import time
import json
import argparse
import urllib.request

BASE = "http://localhost:7000"


# ── WebDriver helpers ─────────────────────────────────────────────────────────

def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read())


def wait_ready(timeout=30):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            req("GET", "/status")
            return
        except Exception:
            time.sleep(0.5)
    raise TimeoutError("Browser not ready")


def new_session():
    resp = req("POST", "/session", {
        "capabilities": {"alwaysMatch": {"browserName": "servo"}}
    })
    return resp["value"]["sessionId"]


def js(sid, script):
    return req("POST", f"/session/{sid}/execute/sync", {
        "script": script, "args": []
    })["value"]


def navigate(sid, url):
    req("POST", f"/session/{sid}/url", {"url": url})


def delete_session(sid):
    try:
        req("DELETE", f"/session/{sid}")
    except Exception:
        pass


# ── Fingerprint collection scripts ───────────────────────────────────────────

SCRIPTS = {

    # ── Navigator ────────────────────────────────────────────────────────────
    "navigator.userAgent":              "return navigator.userAgent",
    "navigator.appVersion":             "return navigator.appVersion",
    "navigator.appName":                "return navigator.appName",
    "navigator.appCodeName":            "return navigator.appCodeName",
    "navigator.product":                "return navigator.product",
    "navigator.productSub":             "return navigator.productSub",
    "navigator.vendor":                 "return navigator.vendor",
    "navigator.vendorSub":              "return navigator.vendorSub",
    "navigator.platform":               "return navigator.platform",
    "navigator.language":               "return navigator.language",
    "navigator.languages":              "return Array.from(navigator.languages || [])",
    "navigator.hardwareConcurrency":    "return navigator.hardwareConcurrency",
    "navigator.deviceMemory":           "return navigator.deviceMemory ?? null",
    "navigator.maxTouchPoints":         "return navigator.maxTouchPoints",
    "navigator.cookieEnabled":          "return navigator.cookieEnabled",
    "navigator.doNotTrack":             "return navigator.doNotTrack",
    "navigator.webdriver":              "return navigator.webdriver ?? null",
    "navigator.onLine":                 "return navigator.onLine",
    "navigator.pdfViewerEnabled":       "return navigator.pdfViewerEnabled ?? null",
    "navigator.plugins.length":         "return navigator.plugins ? navigator.plugins.length : null",
    "navigator.plugins.list": """
        if (!navigator.plugins) return [];
        return Array.from(navigator.plugins).map(p => ({
            name: p.name, filename: p.filename, description: p.description
        }))
    """,
    "navigator.mimeTypes.length":       "return navigator.mimeTypes ? navigator.mimeTypes.length : null",
    "navigator.connection": """
        const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (!c) return null;
        return { effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: c.saveData }
    """,
    "navigator.credentials":            "return typeof navigator.credentials !== 'undefined'",
    "navigator.serviceWorker":          "return typeof navigator.serviceWorker !== 'undefined'",
    "navigator.bluetooth":              "return typeof navigator.bluetooth !== 'undefined'",
    "navigator.usb":                    "return typeof navigator.usb !== 'undefined'",
    "navigator.serial":                 "return typeof navigator.serial !== 'undefined'",
    "navigator.hid":                    "return typeof navigator.hid !== 'undefined'",
    "navigator.wakeLock":               "return typeof navigator.wakeLock !== 'undefined'",
    "navigator.geolocation":            "return typeof navigator.geolocation !== 'undefined'",
    "navigator.mediaDevices":           "return typeof navigator.mediaDevices !== 'undefined'",
    "navigator.permissions":            "return typeof navigator.permissions !== 'undefined'",

    # ── Screen ───────────────────────────────────────────────────────────────
    "screen.width":                     "return screen.width",
    "screen.height":                    "return screen.height",
    "screen.availWidth":                "return screen.availWidth",
    "screen.availHeight":               "return screen.availHeight",
    "screen.availLeft":                 "return screen.availLeft ?? null",
    "screen.availTop":                  "return screen.availTop ?? null",
    "screen.colorDepth":                "return screen.colorDepth",
    "screen.pixelDepth":                "return screen.pixelDepth",
    "screen.orientation": """
        if (!screen.orientation) return null;
        return { type: screen.orientation.type, angle: screen.orientation.angle }
    """,
    "window.devicePixelRatio":          "return window.devicePixelRatio",
    "window.innerWidth":                "return window.innerWidth",
    "window.innerHeight":               "return window.innerHeight",
    "window.outerWidth":                "return window.outerWidth",
    "window.outerHeight":               "return window.outerHeight",
    "window.screenX":                   "return window.screenX",
    "window.screenY":                   "return window.screenY",

    # ── Timezone ─────────────────────────────────────────────────────────────
    "timezone.offset":                  "return new Date().getTimezoneOffset()",
    "timezone.name": """
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch(e) { return null }
    """,
    "timezone.locale": """
        try { return Intl.DateTimeFormat().resolvedOptions().locale } catch(e) { return null }
    """,
    "timezone.dateString":              "return new Date().toString()",
    "timezone.toLocaleDateString":      "return new Date(2024,0,15).toLocaleDateString()",
    "timezone.toLocaleTimeString":      "return new Date(2024,0,15,12,0,0).toLocaleTimeString()",

    # ── WebGL ─────────────────────────────────────────────────────────────────
    "webgl.available": """
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl') || c.getContext('experimental-webgl'))
    """,
    "webgl.renderer": """
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
        if (!gl) return null;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    """,
    "webgl.vendor": """
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
        if (!gl) return null;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)
    """,
    "webgl.version": """
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
        return gl ? gl.getParameter(gl.VERSION) : null
    """,
    "webgl.shadingLanguageVersion": """
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
        return gl ? gl.getParameter(gl.SHADING_LANGUAGE_VERSION) : null
    """,
    "webgl.extensions": """
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
        return gl ? gl.getSupportedExtensions() : null
    """,
    "webgl2.available": """
        const c = document.createElement('canvas');
        return !!c.getContext('webgl2')
    """,
    "webgl.maxTextureSize": """
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
        return gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : null
    """,
    "webgl.maxViewportDims": """
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
        if (!gl) return null;
        const d = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
        return d ? [d[0], d[1]] : null
    """,

    # ── Canvas fingerprint ────────────────────────────────────────────────────
    "canvas.fingerprint": """
        try {
            const c = document.createElement('canvas');
            c.width = 200; c.height = 50;
            const ctx = c.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = '#069';
            ctx.fillText('Cwm fjordbank glyphs vext quiz', 2, 15);
            ctx.fillStyle = 'rgba(102,204,0,0.7)';
            ctx.fillText('Cwm fjordbank glyphs vext quiz', 4, 17);
            return c.toDataURL().slice(-50)
        } catch(e) { return 'error: ' + e.message }
    """,
    "canvas.winding": """
        try {
            const c = document.createElement('canvas');
            const ctx = c.getContext('2d');
            ctx.rect(0,0,10,10); ctx.rect(2,2,6,6);
            return ctx.isPointInPath(5,5,'evenodd')
        } catch(e) { return null }
    """,

    # ── Audio ─────────────────────────────────────────────────────────────────
    "audio.available": """
        return typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined'
    """,
    "audio.sampleRate": """
        try {
            const ctx = new (AudioContext || webkitAudioContext)();
            const sr = ctx.sampleRate;
            ctx.close();
            return sr;
        } catch(e) { return null }
    """,
    "audio.fingerprint": """
        try {
            const ctx = new OfflineAudioContext(1, 44100, 44100);
            const osc = ctx.createOscillator();
            const comp = ctx.createDynamicsCompressor();
            osc.type = 'triangle';
            osc.frequency.value = 10000;
            comp.threshold.value = -50;
            comp.knee.value = 40;
            comp.ratio.value = 12;
            comp.reduction;
            comp.attack.value = 0;
            comp.release.value = 0.25;
            osc.connect(comp);
            comp.connect(ctx.destination);
            osc.start(0);
            return new Promise(resolve => {
                ctx.oncomplete = e => {
                    const buf = e.renderedBuffer.getChannelData(0);
                    let sum = 0;
                    for (let i = 4500; i < 5000; i++) sum += Math.abs(buf[i]);
                    resolve(sum.toString());
                };
                ctx.startRendering();
            });
        } catch(e) { return null }
    """,

    # ── Fonts ─────────────────────────────────────────────────────────────────
    "fonts.detected": """
        const base = ['monospace','sans-serif','serif'];
        const test = ['Arial','Arial Black','Arial Narrow','Calibri','Cambria',
            'Comic Sans MS','Courier','Courier New','Georgia','Helvetica',
            'Impact','Lucida Console','Lucida Sans Unicode','Palatino Linotype',
            'Tahoma','Times New Roman','Trebuchet MS','Verdana',
            'Roboto','Open Sans','Ubuntu','Noto Sans'];
        const c = document.createElement('canvas');
        c.width = 200; c.height = 100;
        const ctx = c.getContext('2d');
        function width(font) {
            ctx.font = '72px ' + font;
            return ctx.measureText('mmmmmmmmmmlli').width;
        }
        const bases = base.map(width);
        return test.filter((f,i) => {
            const w = width(f + ',' + base[i % base.length]);
            return w !== bases[i % base.length];
        });
    """,

    # ── CSS / DOM ─────────────────────────────────────────────────────────────
    "css.supports.grid":                "return CSS.supports('display','grid')",
    "css.supports.flex":                "return CSS.supports('display','flex')",
    "css.supports.customProperties":    "return CSS.supports('--test','0')",
    "css.supports.colorScheme":         "return CSS.supports('color-scheme','dark')",
    "dom.localStorage":                 "return typeof localStorage !== 'undefined'",
    "dom.sessionStorage":               "return typeof sessionStorage !== 'undefined'",
    "dom.indexedDB":                    "return typeof indexedDB !== 'undefined'",
    "dom.openDatabase":                 "return typeof openDatabase !== 'undefined'",
    "dom.Worker":                       "return typeof Worker !== 'undefined'",
    "dom.SharedWorker":                 "return typeof SharedWorker !== 'undefined'",
    "dom.WebSocket":                    "return typeof WebSocket !== 'undefined'",
    "dom.WebAssembly":                  "return typeof WebAssembly !== 'undefined'",
    "dom.Proxy":                        "return typeof Proxy !== 'undefined'",
    "dom.Symbol":                       "return typeof Symbol !== 'undefined'",
    "dom.BigInt":                       "return typeof BigInt !== 'undefined'",

    # ── Media ─────────────────────────────────────────────────────────────────
    "media.video.h264": """
        const v = document.createElement('video');
        return v.canPlayType('video/mp4; codecs="avc1.42E01E"') || 'no'
    """,
    "media.video.vp8": """
        const v = document.createElement('video');
        return v.canPlayType('video/webm; codecs="vp8"') || 'no'
    """,
    "media.video.vp9": """
        const v = document.createElement('video');
        return v.canPlayType('video/webm; codecs="vp9"') || 'no'
    """,
    "media.audio.aac": """
        const a = document.createElement('audio');
        return a.canPlayType('audio/aac') || 'no'
    """,
    "media.audio.mp3": """
        const a = document.createElement('audio');
        return a.canPlayType('audio/mpeg') || 'no'
    """,
    "media.audio.ogg": """
        const a = document.createElement('audio');
        return a.canPlayType('audio/ogg; codecs="vorbis"') || 'no'
    """,

    # ── Math / JS engine ──────────────────────────────────────────────────────
    "math.PI":                          "return Math.PI.toString()",
    "math.tan":                         "return Math.tan(1e300).toString()",
    "math.atan2":                       "return Math.atan2(1e-323, -1e300).toString()",
    "math.sinh":                        "return Math.sinh(1).toString()",
    "math.cosh":                        "return Math.cosh(1).toString()",
    "math.log1p":                       "return Math.log1p(-1e-17).toString()",
    "math.acos":                        "return Math.acos(0.123456789).toString()",
    "math.pow":                         "return Math.pow(-0.123, -1e-300).toString()",
    "math.sin":                         "return Math.sin(Math.PI/4).toString()",

    # ── Misc ──────────────────────────────────────────────────────────────────
    "misc.buildID":                     "return typeof navigator.buildID !== 'undefined' ? navigator.buildID : null",
    "misc.oscpu":                       "return typeof navigator.oscpu !== 'undefined' ? navigator.oscpu : null",
    "misc.javaEnabled":                 "return typeof navigator.javaEnabled === 'function' ? navigator.javaEnabled() : null",
    "misc.userAgentData": """
        if (!navigator.userAgentData) return null;
        return { brands: navigator.userAgentData.brands, mobile: navigator.userAgentData.mobile, platform: navigator.userAgentData.platform }
    """,
    "misc.performance.memory": """
        if (!performance.memory) return null;
        return { jsHeapSizeLimit: performance.memory.jsHeapSizeLimit, totalJSHeapSize: performance.memory.totalJSHeapSize }
    """,
    "misc.speechSynthesis":             "return typeof speechSynthesis !== 'undefined'",
    "misc.RTCPeerConnection":           "return typeof RTCPeerConnection !== 'undefined'",
    "misc.Request":                     "return typeof Request !== 'undefined'",
    "misc.crypto":                      "return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'",
    "misc.document.characterSet":       "return document.characterSet",
    "misc.document.compatMode":         "return document.compatMode",
}


# ── Report ────────────────────────────────────────────────────────────────────

SECTIONS = {
    "Navigator":    [k for k in SCRIPTS if k.startswith("navigator.")],
    "Screen":       [k for k in SCRIPTS if k.startswith("screen.") or k.startswith("window.")],
    "Timezone":     [k for k in SCRIPTS if k.startswith("timezone.")],
    "WebGL":        [k for k in SCRIPTS if k.startswith("webgl")],
    "Canvas":       [k for k in SCRIPTS if k.startswith("canvas.")],
    "Audio":        [k for k in SCRIPTS if k.startswith("audio.")],
    "Fonts":        [k for k in SCRIPTS if k.startswith("fonts.")],
    "CSS/DOM":      [k for k in SCRIPTS if k.startswith("css.") or k.startswith("dom.")],
    "Media":        [k for k in SCRIPTS if k.startswith("media.")],
    "Math/Engine":  [k for k in SCRIPTS if k.startswith("math.")],
    "Misc":         [k for k in SCRIPTS if k.startswith("misc.")],
}

EXPECTED = {
    "navigator.userAgent":           lambda v: "servo" in v.lower() or "mozilla" in v.lower(),
    "navigator.platform":            lambda v: isinstance(v, str) and len(v) > 0,
    "navigator.hardwareConcurrency": lambda v: isinstance(v, int) and v > 0,
    "navigator.webdriver":           lambda v: v is None or v is False,
    "screen.width":                  lambda v: isinstance(v, int) and v > 0,
    "screen.height":                 lambda v: isinstance(v, int) and v > 0,
    "timezone.name":                 lambda v: v is not None,
    "canvas.fingerprint":            lambda v: v and not v.startswith("error"),
}


def collect(sid):
    results = {}
    for key, script in SCRIPTS.items():
        try:
            results[key] = js(sid, script)
        except Exception as e:
            results[key] = f"ERROR: {e}"
    return results


def print_report(results, as_json=False):
    if as_json:
        print(json.dumps(results, indent=2, default=str))
        return

    print("\n" + "═" * 70)
    print("  NIGHTGLOW BROWSER FINGERPRINT REPORT")
    print("═" * 70)

    all_pass = 0
    all_fail = 0

    for section, keys in SECTIONS.items():
        print(f"\n{'─' * 70}")
        print(f"  {section.upper()}")
        print(f"{'─' * 70}")
        for k in keys:
            v = results.get(k, "MISSING")
            check = EXPECTED.get(k)
            if check:
                ok = False
                try:
                    ok = check(v)
                except Exception:
                    pass
                status = "✓" if ok else "✗"
                if ok:
                    all_pass += 1
                else:
                    all_fail += 1
            else:
                status = " "

            # Format value for display
            if isinstance(v, list):
                display = f"[{len(v)} items] " + str(v[:3])[:-1] + ("..." if len(v) > 3 else "]")
            elif isinstance(v, dict):
                display = str(v)
            elif isinstance(v, str) and len(v) > 80:
                display = v[:77] + "..."
            else:
                display = str(v)

            print(f"  {status} {k:<45} {display}")

    print(f"\n{'═' * 70}")
    if all_pass + all_fail > 0:
        print(f"  Checks: {all_pass} passed, {all_fail} failed")
    print("═" * 70 + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:7000")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--page", default="about:blank",
                        help="Page to load before collecting fingerprint")
    args = parser.parse_args()

    global BASE
    BASE = args.url.rstrip("/")

    print("Waiting for browser...")
    wait_ready()

    sid = new_session()
    print(f"Session: {sid}")

    if args.page != "about:blank":
        print(f"Loading: {args.page}")
        navigate(sid, args.page)
        time.sleep(2)

    try:
        results = collect(sid)
    finally:
        delete_session(sid)

    print_report(results, as_json=args.json)


if __name__ == "__main__":
    main()
