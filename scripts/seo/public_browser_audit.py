"""All public templates on synthetic localhost; APIs and foreign resources blocked."""
import asyncio
import json
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]


async def main():
    from playwright.async_api import async_playwright
    previous = json.loads((ROOT / ".seo-local/public-route-audit.json").read_text(encoding="utf-8"))
    results = []
    mobile = "--mobile" in sys.argv
    no_js = "--no-js" in sys.argv
    async with async_playwright() as runtime:
        browser = await runtime.chromium.launch(headless=True)
        for row in previous["pages"]:
            path = row["path"]
            context = await browser.new_context(java_script_enabled=not no_js, service_workers="block", viewport={"width": 390 if mobile else 1440, "height": 844 if mobile else 1000})
            page = await context.new_page()
            counts = {"blocked_api_requests": 0}

            async def intercept(route):
                request = route.request
                target = urlsplit(request.url)
                if target.path.startswith("/api/"):
                    counts["blocked_api_requests"] += 1
                permitted = (target.scheme == "http" and target.hostname == "127.0.0.1" and target.port == 3016
                             and request.method in {"GET", "HEAD"}
                             and request.resource_type in {"document", "script", "stylesheet"}
                             and (target.path == path or target.path.startswith("/_next/")))
                await route.continue_() if permitted else await route.abort()

            await page.route("**/*", intercept)
            try:
                response = await page.goto("http://127.0.0.1:3016" + path, wait_until="domcontentloaded", timeout=30000)
                if not no_js:
                    await page.wait_for_timeout(2000)
                headings = [text.strip() for text in await page.locator("h1").all_text_contents()]
                main = page.locator("main")
                body = await (main.first if await main.count() else page.locator("body")).inner_text()
                errors = []
                if response.status != 200:
                    errors.append(f"HTTP {response.status}")
                if headings != row["h1"]:
                    errors.append("Heading changed/lost after hydration")
                if await page.locator("h1").count() != 1 or not await page.locator("h1").first.is_visible():
                    errors.append("Primary heading is not visible")
                elif await page.locator("h1").evaluate("node => { for (let el = node; el; el = el.parentElement) { if (getComputedStyle(el).opacity === '0') return true; } return false; }"):
                    errors.append("Primary heading has a transparent ancestor")
                if len(body.strip()) < 80:
                    errors.append("Primary page content lost")
                if mobile:
                    overflow = await page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
                    if overflow:
                        errors.append("Document has horizontal overflow on mobile")
                if any(text in body for text in ["Category Not Found", "Brand Not Found", "Unable to Load Campaign"]):
                    errors.append("False missing/error state")
                if path in {"/products", "/product/synthetic-phone", "/category/synthetic-phones", "/sub-category/Synthetic%20Smartphones", "/campaign/synthetic-campaign", "/super-sunday", "/epic-sale"} and "Synthetic Phone" not in body:
                    errors.append("Seeded catalogue content lost")
                if path == "/software" and "Synthetic Software" not in body:
                    errors.append("Seeded software lost")
                for brand in ["Bosch", "Haier", "LG", "TCL"]:
                    if path == "/" + brand.lower() and f"Synthetic {brand} Appliance" not in body:
                        errors.append("Seeded manufacturer shelf lost")
                results.append({"path": path, "status": response.status, "h1": headings, "primary_text_length": len(body), "errors": errors, **counts})
            except Exception as error:
                results.append({"path": path, "status": "UNVERIFIED", "errors": [type(error).__name__], **counts})
            await context.close()
        await browser.close()
    report = {"scope": "all indexable route templates; synthetic localhost; APIs/foreign resources blocked", "javascript_enabled": not no_js, "pages": results,
              "checked": len(results), "failures": [row for row in results if row["errors"]]}
    name = "public-browser-no-js" if no_js else "public-browser"
    name += "-mobile" if mobile else "-audit"
    (ROOT / f".seo-local/{name}.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"checked": len(results), "failures": report["failures"]}, indent=2))
    return 0 if not report["failures"] else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
