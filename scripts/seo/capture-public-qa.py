"""No-JavaScript desktop/mobile screenshots of synthetic public pages only."""
import asyncio
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
PATHS = ["/", "/products", "/product/synthetic-phone", "/brands", "/software", "/stores/synthetic-city/synthetic-store", "/contact"]


async def main():
    from playwright.async_api import async_playwright
    output = ROOT / ".seo-local/public-qa"
    output.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as runtime:
        browser = await runtime.chromium.launch(headless=True)
        for mode, viewport in [("desktop", {"width": 1440, "height": 1000}), ("mobile", {"width": 390, "height": 844})]:
            context = await browser.new_context(java_script_enabled=False, service_workers="block", viewport=viewport)

            async def route_request(route):
                request = route.request
                target = urlsplit(request.url)
                allowed = target.scheme == "http" and target.hostname == "127.0.0.1" and target.port == 3016 and request.method in {"GET", "HEAD"} and not target.path.startswith("/api/")
                await route.continue_() if allowed else await route.abort()

            await context.route("**/*", route_request)
            for path in PATHS:
                page = await context.new_page()
                response = await page.goto("http://127.0.0.1:3016" + path, wait_until="load", timeout=30000)
                if response.status != 200:
                    raise ValueError(f"Synthetic page status {response.status}")
                name = path.strip("/").replace("/", "-") or "home"
                await page.screenshot(path=str(output / f"{mode}-{name}.png"))
                await page.close()
            await context.close()
        await browser.close()
    print("Captured 14 synthetic screenshots with JavaScript disabled; no external resources or APIs")


if __name__ == "__main__":
    asyncio.run(main())
