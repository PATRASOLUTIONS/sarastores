"""Browser regression against the guarded synthetic production server only."""
import asyncio
import json
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
PATHS = ["/", "/products", "/product/synthetic-phone", "/category/synthetic-phones", "/brands/synthetic-brand"]


async def main():
    from playwright.async_api import async_playwright
    results = []
    async with async_playwright() as runtime:
        browser = await runtime.chromium.launch(headless=True)
        for path in PATHS:
            context = await browser.new_context(service_workers="block")
            page = await context.new_page()
            counts = {"blocked_api_requests": 0}

            async def intercept(route):
                request = route.request
                parsed = urlsplit(request.url)
                if parsed.path.startswith("/api/"):
                    counts["blocked_api_requests"] += 1
                if (parsed.scheme == "http" and parsed.hostname == "127.0.0.1" and parsed.port == 3016
                    and request.method in {"GET", "HEAD"}
                    and (parsed.path == path or parsed.path.startswith("/_next/"))
                    and request.resource_type in {"document", "script", "stylesheet"}):
                    await route.continue_()
                else:
                    await route.abort()

            await page.route("**/*", intercept)
            response = await page.goto("http://127.0.0.1:3016" + path, wait_until="domcontentloaded")
            html = await response.text()
            await page.wait_for_timeout(5000)
            headings = [text.strip() for text in await page.locator("h1").all_text_contents()]
            body = await page.locator("body").inner_text()
            item = {"path": path, "status": response.status, "server_h1": "<h1" in html,
                    "h1": headings, "server_product": "Synthetic Phone" in html,
                    "hydrated_product": "Synthetic Phone" in body, **counts}
            item["passed"] = (item["status"] == 200 and item["server_h1"] and bool(headings)
                              and item["server_product"] and item["hydrated_product"]
                              and "Category Not Found" not in body and "Brand Not Found" not in body)
            results.append(item)
            await context.close()
        await browser.close()
    output = ROOT / ".seo-local/local-render.json"
    output.write_text(json.dumps({"scope": "synthetic production server; APIs and foreign resources blocked", "pages": results}, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))
    return 0 if all(item["passed"] for item in results) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
