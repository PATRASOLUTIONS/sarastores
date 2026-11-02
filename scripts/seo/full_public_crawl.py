"""Full public sitemap HTML audit requested by owner. GET only, one second delay.

No authentication, API routes, forms, external origins, browser script execution,
or database access. Checkpoints support resuming without repeating completed URLs.
"""
from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
import http.client
import ipaddress
import socket
import ssl
import sys
import time
import urllib.error
import urllib.parse
from audit import ROOT, Page, allowed_url, validate_sitemap, validate_metadata, validate_product
from rendered_audit import robots_allowed

connection = None
dns_verified = False


def fetch(url, hops=0, retry=False):
    """Reuse TLS to the known www deployment; no cookies/proxies/authentication."""
    global connection, dns_verified
    if not allowed_url(url) or hops > 3:
        raise ValueError("Public Sara URL/redirect scope refused")
    target = urllib.parse.urlsplit(url)
    # Apex-to-www deployment redirects were observed before this optimization.
    url = urllib.parse.urlunsplit(("https", "www.sarastores.com", target.path or "/", "", ""))
    if not dns_verified:
        addresses = socket.getaddrinfo("www.sarastores.com", 443, type=socket.SOCK_STREAM)
        if any(not ipaddress.ip_address(address[4][0]).is_global for address in addresses):
            raise ValueError("Non-public DNS address refused")
        dns_verified = True
    if connection is None:
        connection = http.client.HTTPSConnection("www.sarastores.com", timeout=25, context=ssl.create_default_context())
    try:
        connection.request("GET", target.path or "/", headers={"User-Agent": "SaraSEOAudit/1.0"})
        response = connection.getresponse()
        raw = response.read(6_000_001)
    except (http.client.HTTPException, OSError):
        connection.close()
        connection = None
        if not retry:
            time.sleep(1)
            return fetch(url, hops, True)
        raise
    if len(raw) > 6_000_000:
        raise ValueError("Public response exceeds bounded read limit")
    headers = dict(response.headers)
    if response.status in {301, 302, 303, 307, 308}:
        time.sleep(1)
        return fetch(urllib.parse.urljoin(url, headers.get("Location", "")), hops + 1)
    if response.status != 200:
        raise urllib.error.HTTPError(url, response.status, "Public HTTP failure", response.headers, None)
    return raw.decode("utf-8", errors="replace"), headers, url


def main():
    output = ROOT / ".seo-local/full-public"
    output.mkdir(parents=True, exist_ok=True)
    robots, _, _ = fetch("https://www.sarastores.com/robots.txt")
    time.sleep(1)
    xml, _, _ = fetch("https://www.sarastores.com/sitemap.xml")
    sitemap = validate_sitemap(xml)
    if sitemap["kind"] != "urlset" or not sitemap["ok"]:
        raise SystemExit("Public sitemap must be a valid flat urlset; review index/invalid input before crawling")
    urls = sitemap["urls"]
    if len(urls) > 5000:
        raise SystemExit("Unexpected sitemap size; review scope before proceeding")
    # Put non-product templates first so their findings are actionable immediately.
    urls.sort(key=lambda url: ("/product/" in urllib.parse.urlsplit(url).path, url))
    (output / "sitemap.xml").write_text(xml, encoding="utf-8")
    (output / "robots.txt").write_text(robots, encoding="utf-8")
    checkpoint = output / "pages.jsonl"
    saved = [json.loads(line) for line in checkpoint.read_text(encoding="utf-8").splitlines()] if checkpoint.exists() else []
    pages = list({page["url"]: page for page in saved}.values())
    retry_failed = "--retry-failed" in sys.argv
    done = {page["url"] for page in pages if not retry_failed or page["status"] in {200, "ROBOTS/SCOPE SKIP"}}
    failures = 0
    for url in urls:
        if url in done:
            continue
        if not allowed_url(url) or not robots_allowed(url, robots):
            row = {"url": url, "status": "ROBOTS/SCOPE SKIP", "errors": []}
        else:
            time.sleep(1)
            row = {"url": url, "collected_at": datetime.now(timezone.utc).isoformat()}
            try:
                html, headers, final = fetch(url)
                page = Page()
                page.feed(html)
                canonical = page.canonicals[0] if page.canonicals else None
                metadata = {"title": "".join(page.title_parts).strip(), "description": page.metas.get("description", ""),
                            "alternates": {"canonical": canonical}, "openGraph": {"url": page.metas.get("og:url")}}
                errors = list(page.errors) + validate_metadata(metadata)["errors"]
                if len(page.canonicals) != 1:
                    errors.append("Requires one canonical")
                if page.h1 != 1:
                    errors.append(f"Initial HTML H1 count {page.h1}")
                if "noindex" in page.metas.get("robots", "").lower():
                    errors.append("Sitemap URL is noindex")
                if canonical and urllib.parse.urlsplit(canonical).hostname != urllib.parse.urlsplit(final).hostname:
                    errors.append("Canonical/redirect host mismatch")
                row.update(status=200, final_url=final, title=metadata["title"], description=metadata["description"],
                           canonical=canonical, h1_count=page.h1, errors=sorted(set(errors)))
                if urllib.parse.urlsplit(url).path.startswith("/product/"):
                    row["product_eligibility"] = validate_product(page.schemas)
                failures = 0
            except Exception as error:
                row.update(status=getattr(error, "code", "UNVERIFIED"), error=type(error).__name__, errors=["HTTP/read failure"])
                failures += 1
        with checkpoint.open("a", encoding="utf-8") as file:
            file.write(json.dumps(row) + "\n")
        pages.append(row)
        if len(pages) % 25 == 0:
            print(json.dumps({"checked": len(pages), "sitemap_urls": len(urls), "html_findings": sum(bool(page.get("errors")) for page in pages)}), flush=True)
        if row.get("status") == 429 or failures >= 3:
            print("Stopped for throttling/repeated HTTP failure; checkpoint preserved", flush=True)
            break
    current = list({page["url"]: page for page in pages if page["url"] in set(urls)}.values())
    titles = defaultdict(list)
    for page in current:
        if page.get("title"):
            titles[page["title"]].append(page["url"])
    summary = {"sitemap_urls": len(urls), "checked": len(current), "completed": len(current) == len(urls),
               "status_counts": dict(Counter(str(page["status"]) for page in current)),
               "html_findings": sum(bool(page.get("errors")) for page in current),
               "product_eligibility_failures": sum(page.get("product_eligibility", {}).get("ok") is False for page in current),
               "duplicate_titles": {title: values for title, values in titles.items() if len(values) > 1},
               "scope": "all URLs in current public sitemap; initial HTML only; unchanged live deployment; no CWV/indexing certification"}
    (output / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2), flush=True)
    return 0 if summary["completed"] and not summary["html_findings"] and not summary["product_eligibility_failures"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
