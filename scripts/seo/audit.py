"""Fixture validators and bounded fixed-origin public GET audit. No DB/API credentials."""
import argparse
from datetime import datetime, timezone
from html.parser import HTMLParser
import ipaddress
import json
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ORIGIN = "https://sarastores.com"
PRIVATE = ("/api", "/account", "/admin", "/dashboard", "/vendor", "/order", "/checkout", "/cart", "/track", "/spin", "/login", "/register", "/lucky-draw/draw")


def allowed_url(url):
    try:
        parsed = urllib.parse.urlsplit(url)
        port = parsed.port
    except (TypeError, ValueError):
        return False
    if parsed.scheme != "https" or parsed.hostname not in {"sarastores.com", "www.sarastores.com"} or port not in (None, 443):
        return False
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        return False
    path = urllib.parse.unquote(parsed.path).lower()
    return not any(path == item or path.startswith(item + "/") for item in PRIVATE) and "\\" not in path and "/../" not in path


def validate_product(payload):
    errors = []
    products = []
    def walk(value):
        if isinstance(value, dict):
            kind = value.get("@type", [])
            if kind == "Product" or isinstance(kind, list) and "Product" in kind:
                products.append(value)
            for item in value.values():
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)
    walk(payload)
    if not products:
        errors.append("No Product entity found")
    for product in products:
        if not product.get("name") or not product.get("image"):
            errors.append("Product name/image missing")
        images = product.get("image", [])
        if isinstance(images, str):
            images = [images]
        if not isinstance(images, list) or any(not isinstance(image, str) or urllib.parse.urlsplit(image).scheme != "https" for image in images):
            errors.append("Product images must be absolute HTTPS URLs")
        offers = product.get("offers")
        if isinstance(offers, dict):
            offers = [offers]
        if not isinstance(offers, list) or not offers:
            errors.append("Product has no Offer")
            continue
        for offer in offers:
            if not isinstance(offer, dict) or offer.get("@type") != "Offer":
                errors.append("Merchant listings require Offer")
                continue
            try:
                if isinstance(offer.get("price"), bool):
                    raise ValueError()
                price = float(offer.get("price"))
                if not 0 < price < float("inf"):
                    raise ValueError()
            except (TypeError, ValueError):
                errors.append("Offer price must be finite and positive")
            if offer.get("priceCurrency") != "INR":
                errors.append("Sara Offer currency must be INR")
            if not isinstance(offer.get("url"), str) or not allowed_url(offer["url"]):
                errors.append("Offer URL must be a clean public Sara URL")
            if offer.get("availability") not in {"https://schema.org/InStock", "https://schema.org/OutOfStock", "https://schema.org/PreOrder", "https://schema.org/BackOrder", "https://schema.org/Discontinued", "https://schema.org/LimitedAvailability", "https://schema.org/SoldOut", "https://schema.org/OnlineOnly", "https://schema.org/InStoreOnly"}:
                errors.append("Offer availability is missing/invalid")
    return {"ok": not errors, "products": len(products), "errors": errors}


def validate_sitemap(xml):
    errors = []
    if len(xml.encode("utf-8")) > 50 * 1024 * 1024:
        errors.append("Sitemap exceeds 50 MiB uncompressed")
    if "<!DOCTYPE" in xml.upper() or "<!ENTITY" in xml.upper():
        return {"ok": False, "errors": ["DTD/entity declarations refused"], "urls": [], "kind": "invalid"}
    try:
        tree = ET.fromstring(xml)
    except ET.ParseError:
        return {"ok": False, "errors": ["Invalid sitemap XML"], "urls": [], "kind": "invalid"}
    ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    kind = tree.tag.removeprefix(ns)
    if tree.tag not in {ns + "urlset", ns + "sitemapindex"}:
        errors.append("Invalid sitemap root or namespace")
    children = list(tree)
    if len(children) > 50000:
        errors.append("Sitemap exceeds 50,000 entries")
    urls = []
    expected = ns + ("sitemap" if kind == "sitemapindex" else "url")
    for entry in children:
        if entry.tag != expected:
            errors.append("Invalid sitemap entry")
        locations = entry.findall(ns + "loc")
        if len(locations) != 1:
            errors.append("Sitemap entry must contain exactly one loc")
        url = (locations[0].text or "").strip() if locations else ""
        urls.append(url)
        if not allowed_url(url):
            errors.append("Sitemap includes non-public, query or foreign URL")
        lastmod = entry.findtext(ns + "lastmod")
        if lastmod:
            try:
                value = datetime.fromisoformat(lastmod.replace("Z", "+00:00"))
                if value.replace(tzinfo=value.tzinfo or timezone.utc) > datetime.now(timezone.utc):
                    errors.append("Sitemap lastmod is in the future")
            except ValueError:
                errors.append("Invalid lastmod")
        for image in entry.findall("{http://www.google.com/schemas/sitemap-image/1.1}image"):
            location = image.findtext("{http://www.google.com/schemas/sitemap-image/1.1}loc") or ""
            if urllib.parse.urlsplit(location).scheme != "https":
                errors.append("Image sitemap URL must be absolute HTTPS")
    if len(urls) != len(set(urls)):
        errors.append("Duplicate sitemap URLs")
    return {"ok": not errors, "errors": sorted(set(errors)), "count": len(urls), "urls": urls, "kind": kind}


def validate_metadata(data):
    errors = []
    for field in ("title", "description"):
        if not isinstance(data.get(field), str) or not data[field].strip():
            errors.append(f"Missing {field}")
    canonical = data.get("alternates", {}).get("canonical")
    if not isinstance(canonical, str) or not allowed_url(canonical):
        errors.append("Canonical is missing or not a clean public Sara URL")
    if data.get("openGraph", {}).get("url") != canonical:
        errors.append("Open Graph URL differs from canonical")
    return {"ok": not errors, "errors": errors}


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title_parts, self.metas, self.canonicals, self.schemas, self.errors = [], {}, [], [], []
        self.in_title = self.in_schema = False
        self.schema_parts = []
        self.h1 = 0
    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag == "title":
            self.in_title = True
        if tag == "h1":
            self.h1 += 1
        if tag == "meta":
            self.metas[data.get("name", data.get("property", "")).lower()] = data.get("content", "")
        if tag == "link" and "canonical" in data.get("rel", "").lower().split():
            self.canonicals.append(data.get("href", ""))
        if tag == "script" and data.get("type", "").lower() == "application/ld+json":
            self.in_schema, self.schema_parts = True, []
    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "script" and self.in_schema:
            try:
                self.schemas.append(json.loads("".join(self.schema_parts)))
            except json.JSONDecodeError:
                self.errors.append("Invalid JSON-LD syntax")
            self.in_schema = False
    def handle_data(self, data):
        if self.in_title:
            self.title_parts.append(data)
        if self.in_schema:
            self.schema_parts.append(data)


class PublicRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not allowed_url(newurl):
            raise ValueError("Redirect outside clean public Sara URLs refused")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch(url):
    if not allowed_url(url):
        raise ValueError("URL is outside allowed public Sara scope")
    # No inherited proxy, cookie jar, authorization or user-supplied host.
    for address in socket.getaddrinfo(urllib.parse.urlsplit(url).hostname, 443, type=socket.SOCK_STREAM):
        if not ipaddress.ip_address(address[4][0]).is_global:
            raise ValueError("Non-public DNS address refused")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), PublicRedirect())
    request = urllib.request.Request(url, headers={"User-Agent": "SaraSEOAudit/1.0"})
    with opener.open(request, timeout=25) as response:
        raw = response.read(6_000_001)
        if len(raw) > 6_000_000:
            raise ValueError("Public response exceeds bounded read limit")
        return raw.decode("utf-8", errors="replace"), dict(response.headers), response.url


def public_audit():
    result = {"mode": "bounded-public-GET", "collected_at": datetime.now(timezone.utc).isoformat(), "pages": [], "errors": [], "cwv": "UNVERIFIED: no authorized field or laboratory data"}
    output = ROOT / ".seo-local/public"
    output.mkdir(parents=True, exist_ok=True)
    try:
        robots, _, _ = fetch(ORIGIN + "/robots.txt")
        policy = urllib.robotparser.RobotFileParser()
        policy.parse(robots.splitlines())
        (output / "robots.txt").write_text(robots, encoding="utf-8")
        declared = policy.site_maps() or [ORIGIN + "/sitemap.xml"]
        target = next((url for url in declared if allowed_url(url)), None)
        if not target:
            raise ValueError("No allowed sitemap declaration")
        if not policy.can_fetch("SaraSEOAudit", target):
            raise ValueError("Sitemap is disallowed by robots")
        time.sleep(1)
        xml, _, _ = fetch(target)
        (output / "sitemap.xml").write_text(xml, encoding="utf-8")
        sitemap = validate_sitemap(xml)
        result["sitemap"] = {k: v for k, v in sitemap.items() if k != "urls"}
        if sitemap["kind"] == "sitemapindex":
            result["errors"].append("Index sitemap detected; child sitemaps not audited in this bounded run")
        urls = [ORIGIN + "/", ORIGIN + "/products", ORIGIN + "/store-locator"]
        for prefix in ("/product/", "/category/", "/brands/", "/stores/"):
            candidate = next((url for url in sitemap["urls"] if urllib.parse.urlsplit(url).path.startswith(prefix)), None)
            if candidate:
                urls.append(candidate)
        for url in list(dict.fromkeys(urls))[:10]:
            if not allowed_url(url) or not policy.can_fetch("SaraSEOAudit", url) or not policy.can_fetch("Googlebot", url):
                result["pages"].append({"url": url, "status": "SKIPPED: robots"})
                continue
            time.sleep(1)
            try:
                source, headers, final = fetch(url)
                page = Page()
                page.feed(source)
                metadata = {"title": "".join(page.title_parts), "description": page.metas.get("description", ""),
                            "alternates": {"canonical": page.canonicals[0] if len(page.canonicals) == 1 else None},
                            "openGraph": {"url": page.metas.get("og:url")}}
                item = {"url": url, "final_url": final, "status": 200, "metadata": metadata, "metadata_validation": validate_metadata(metadata),
                        "h1_count": page.h1, "schema_blocks": len(page.schemas), "jsonld_errors": page.errors,
                        "robots": page.metas.get("robots"), "headers_present": {name: bool(next((v for k, v in headers.items() if k.lower() == name), None)) for name in ["content-security-policy", "strict-transport-security", "x-content-type-options"]}}
                if urllib.parse.urlsplit(url).path.startswith("/product/"):
                    item["product_validation"] = validate_product(page.schemas)
                (output / f"page-{len(result['pages'])}.html").write_text(source, encoding="utf-8")
                result["pages"].append(item)
            except Exception as error:
                result["pages"].append({"url": url, "status": "UNVERIFIED", "error": type(error).__name__, "http_status": getattr(error, "code", None)})
    except Exception as error:
        result["errors"].append({"error": type(error).__name__, "http_status": getattr(error, "code", None)})
    result["ok"] = public_audit_ok(result)
    (output / "audit.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    return result


def public_audit_ok(result):
    pages = result.get("pages", [])
    return bool(pages) and not result.get("errors") and result.get("sitemap", {}).get("ok") is True and all(
        page.get("status") == 200 and page.get("metadata_validation", {}).get("ok") is True
        and not page.get("jsonld_errors") and page.get("product_validation", {"ok": True}).get("ok") is True
        for page in pages
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--fixtures", action="store_true")
    mode.add_argument("--public", action="store_true")
    args = parser.parse_args()
    if args.public:
        raise SystemExit(0 if public_audit()["ok"] else 1)
    else:
        directory = ROOT / ".seo-local/fixtures"
        result = {"mode": "synthetic-fixtures", "product": validate_product(json.loads((directory / "product.json").read_text())),
                  "metadata": validate_metadata(json.loads((directory / "metadata.json").read_text())),
                  "sitemap": validate_sitemap((directory / "sitemap.xml").read_text()), "cwv": "UNVERIFIED: fixtures cannot measure CWV"}
        result["sitemap"].pop("urls", None)
        (directory / "validation.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(json.dumps(result, indent=2))
        raise SystemExit(0 if all(result[key]["ok"] for key in ["product", "metadata", "sitemap"]) else 1)
