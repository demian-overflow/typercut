#!/usr/bin/env python3
"""
Nightglow scraping integration test.
Drives servoshell via WebDriver to scrape pages.

Usage:
    # Start nightglow first:
    docker run -d --name ng -p 7000:7000 \
        registry.noogoo.ch/orderout/nightglow:latest \
        --headless --webdriver 7000 about:blank

    python3 scrape.py [URL]
"""

import sys
import time
import json
import urllib.request
import urllib.error

BASE = "http://localhost:7000"


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
            return True
        except Exception:
            time.sleep(0.5)
    raise TimeoutError("Browser not ready")


def new_session():
    resp = req("POST", "/session", {
        "capabilities": {"alwaysMatch": {"browserName": "servo"}}
    })
    return resp["value"]["sessionId"]


def navigate(sid, url):
    req("POST", f"/session/{sid}/url", {"url": url})


def get_title(sid):
    return req("GET", f"/session/{sid}/title")["value"]


def get_url(sid):
    return req("GET", f"/session/{sid}/url")["value"]


def js(sid, script):
    return req("POST", f"/session/{sid}/execute/sync", {
        "script": script, "args": []
    })["value"]


def find(sid, css):
    resp = req("POST", f"/session/{sid}/element", {
        "using": "css selector", "value": css
    })
    return resp["value"]["ELEMENT"]


def text(sid, element_id):
    return req("GET", f"/session/{sid}/element/{element_id}/text")["value"]


def find_all(sid, css):
    resp = req("POST", f"/session/{sid}/elements", {
        "using": "css selector", "value": css
    })
    return [e["ELEMENT"] for e in resp["value"]]


def delete_session(sid):
    req("DELETE", f"/session/{sid}")


def scrape(url):
    print(f"Waiting for browser...")
    wait_ready()

    print(f"Opening session...")
    sid = new_session()
    print(f"Session: {sid}")

    try:
        print(f"Navigating to {url}...")
        navigate(sid, url)
        time.sleep(2)  # let page settle

        title = get_title(sid)
        current = get_url(sid)
        print(f"Title:   {title}")
        print(f"URL:     {current}")

        # Extract all visible text
        body_text = js(sid, "return document.body ? document.body.innerText : ''")
        print(f"\n--- Body text (first 500 chars) ---")
        print((body_text or "")[:500])

        # Extract all links
        links = js(sid, """
            return Array.from(document.querySelectorAll('a[href]'))
                .map(a => ({text: a.innerText.trim(), href: a.href}))
                .filter(a => a.text && a.href)
                .slice(0, 20)
        """)
        if links:
            print(f"\n--- Links ({len(links)}) ---")
            for l in links:
                print(f"  {l['text'][:40]:<40} {l['href']}")

        # Extract meta description
        desc = js(sid, """
            const m = document.querySelector('meta[name=description]');
            return m ? m.content : null;
        """)
        if desc:
            print(f"\nMeta description: {desc}")

        return {"title": title, "url": current, "text": body_text, "links": links}

    finally:
        delete_session(sid)
        print("\nSession closed.")


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://example.com"
    scrape(url)
