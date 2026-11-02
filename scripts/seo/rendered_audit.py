"""Bounded read-only browser check of previously sampled public Sara pages."""
import asyncio
import json
import re
import urllib.parse
from audit import ROOT, allowed_url

def robots_allowed(url, text):
    # Google's longest matching rule wins; urllib.robotparser uses first match
    # and would let the initial Allow: / override this site's Disallow: /api.
    path = urllib.parse.urlsplit(url).path
    if urllib.parse.urlsplit(url).query:
        path += "?" + urllib.parse.urlsplit(url).query
    generic, matches = False, []
    for line in text.splitlines():
        key, _, value = line.partition(":")
        key, value = key.strip().lower(), value.split("#", 1)[0].strip()
        if key == "user-agent":
            generic = value == "*"
        elif generic and key in {"allow", "disallow"} and value:
            pattern = re.escape(value).replace(r"\*", ".*").replace(r"\$", "$")
            if re.match(pattern, path):
                matches.append((len(value.replace("*", "").rstrip("$")), key == "allow"))
    return not matches or max(matches)[1]


def request_allowed(url, method, resource):
    if method not in {"GET", "HEAD"}:
        return False
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname not in {"sarastores.com", "www.sarastores.com"}:
        return False
    if parsed.username or parsed.password or parsed.port not in {None, 443}:
        return False
    if resource in {"image", "media", "font"}:
        return False
    if parsed.path.startswith("/api/"):
        return False
    if resource == "document":
        return allowed_url(url)
    return resource in {"script", "stylesheet"} and parsed.path.startswith("/_next/")


async def main():
    from playwright.async_api import async_playwright
    output = ROOT / ".seo-local/public"
    previous = json.loads((output / "audit.json").read_text(encoding="utf-8"))
    robots = (output / "robots.txt").read_text(encoding="utf-8")
    urls = list(dict.fromkeys(page["url"] for page in previous["pages"]))[:7]
    result = {"mode": "bounded-read-only-rendering", "pages": [], "cwv": "UNVERIFIED: heading check only"}
    async with async_playwright() as runtime:
        browser = await runtime.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 1000}, service_workers="block", user_agent="SaraSEOAudit/1.0")
        for url in urls:
            if not allowed_url(url) or not robots_allowed(url, robots):
                result["pages"].append({"url": url, "status": "SKIPPED: robots/scope"})
                continue
            await asyncio.sleep(1)
            page = await context.new_page()
            counts = {"blocked_requests": 0, "robots_blocked_resources": 0}

            async def intercept(route):
                request = route.request
                try:
                    robots_permits = robots_allowed(request.url, robots)
                    permitted = robots_permits and request_allowed(request.url, request.method, request.resource_type)
                    if not robots_permits:
                        counts["robots_blocked_resources"] += 1
                except ValueError:
                    permitted = False
                if not permitted:
                    counts["blocked_requests"] += 1
                    return await route.abort()
                headers = {key: value for key, value in request.headers.items() if key.lower() not in {"cookie", "authorization"}}
                await route.continue_(headers=headers)

            await page.route("**/*", intercept)
            try:
                response = await page.goto(url, wait_until="domcontentloaded", timeout=45000)
                try:
                    await page.locator("h1").first.wait_for(state="attached", timeout=15000)
                except Exception:
                    pass
                await page.wait_for_timeout(3000)
                headings = await page.locator("h1").all_text_contents()
                item = {"url": url, "final_url": page.url, "status": response.status if response else None,
                        "h1_count": len(headings), "h1_text": [text.strip() for text in headings], **counts}
                result["pages"].append(item)
            except Exception as error:
                code = re.search(r"net::ERR_[A-Z_]+", str(error))
                result["pages"].append({"url": url, "status": "UNVERIFIED", "error": type(error).__name__, "network_error": code.group(0) if code else None, **counts})
            await page.close()
        await context.close()
        await browser.close()
    result["completed"] = bool(result["pages"]) and all(page.get("status") == 200 for page in result["pages"])
    (output / "rendered-audit.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    return 0 if result["completed"] else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
