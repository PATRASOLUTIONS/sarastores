"""Offline adversarial checks for the integration's validation boundaries."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest
import subprocess
import tempfile

TOOLS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS))
from audit import allowed_url, validate_product, validate_sitemap, public_audit_ok, Page
from rendered_audit import request_allowed, robots_allowed
from drift import compare
import full_public_crawl

spec = importlib.util.spec_from_file_location("google_preflight", TOOLS / "google-preflight.py")
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)

PRODUCT = {"@type": "Product", "name": "Synthetic", "image": ["https://sarastores.com/image.webp"],
           "offers": {"@type": "Offer", "price": 100, "priceCurrency": "INR", "url": "https://sarastores.com/product/synthetic", "availability": "https://schema.org/InStock"}}


class ValidationTests(unittest.TestCase):
    def test_full_crawler_refuses_external_private_and_token_urls_before_network(self):
        for url in ["https://external.example/", "https://sarastores.com/admin", "https://sarastores.com/product/a?token=secret", "http://sarastores.com/"]:
            with self.assertRaises(ValueError):
                full_public_crawl.fetch(url)

    def test_drift_detects_removed_urls_and_offer_changes(self):
        before = {"sitemap_urls": ["/", "/product/synthetic"], "schemas": PRODUCT}
        after = copy.deepcopy(before)
        after["sitemap_urls"].pop()
        after["schemas"]["offers"]["price"] = 200
        self.assertEqual(set(compare(before, after)), {"sitemap_urls", "schemas"})
        self.assertEqual(compare(before, copy.deepcopy(before)), {})

    def test_upstream_adapter_cannot_pass_missing_price(self):
        product = copy.deepcopy(PRODUCT)
        del product["offers"]["price"]
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "product.json"
            file.write_text(json.dumps(product), encoding="utf-8")
            result = subprocess.run([sys.executable, str(TOOLS / "run.py"), "run", "schema_ecommerce_validate.py", str(file)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertIn("mandatory Sara Offer checks", result.stdout)
        self.assertFalse(json.loads(result.stdout)["ok"])

    def test_browser_scope_refuses_writes_private_routes_and_external_resources(self):
        for url, method, resource in [
            ("https://sarastores.com/products", "POST", "document"),
            ("https://sarastores.com/account", "GET", "document"),
            ("https://sarastores.com/api/products/export", "GET", "fetch"),
            ("https://sarastores.com/api/products", "GET", "fetch"),
            ("https://external.example/script.js", "GET", "script"),
        ]:
            self.assertFalse(request_allowed(url, method, resource))
        self.assertTrue(request_allowed("https://sarastores.com/products", "GET", "document"))
        self.assertTrue(request_allowed("https://www.sarastores.com/_next/static/chunk.js", "GET", "script"))

    def test_robots_longest_rule_blocks_api_even_after_allow_root(self):
        rules = "User-Agent: *\nAllow: /\nDisallow: /api\nAllow: /api/media/brand-logo/\nDisallow: /*?*sort=\n"
        self.assertFalse(robots_allowed("https://sarastores.com/api/products", rules))
        self.assertFalse(robots_allowed("https://sarastores.com/products?sort=price", rules))
        self.assertTrue(robots_allowed("https://sarastores.com/products", rules))
        self.assertTrue(robots_allowed("https://sarastores.com/api/media/brand-logo/a", rules))

    def test_missing_or_invalid_money_cannot_pass(self):
        for price in [None, "INR 100", "NaN", float("inf"), 0, -1, True, False]:
            product = copy.deepcopy(PRODUCT)
            product["offers"]["price"] = price
            self.assertFalse(validate_product(product)["ok"])
        self.assertTrue(validate_product(PRODUCT)["ok"])

    def test_required_currency_and_offer_type_cannot_pass_as_advisory(self):
        for field, value in [("priceCurrency", None), ("priceCurrency", "USD"), ("@type", "AggregateOffer")]:
            product = copy.deepcopy(PRODUCT)
            product["offers"][field] = value
            self.assertFalse(validate_product(product)["ok"])

    def test_product_graph_and_input_immutability(self):
        graph = {"@context": "https://schema.org", "@graph": [copy.deepcopy(PRODUCT)]}
        before = json.dumps(graph)
        self.assertTrue(validate_product(graph)["ok"])
        self.assertEqual(json.dumps(graph), before)

    def test_url_scope_excludes_foreign_private_and_token_routes(self):
        for url in ["https://evil.example/product/1", "http://sarastores.com/", "https://sarastores.com/order/1", "https://sarastores.com/%61ccount", "https://sarastores.com/product/1?token=secret", "https://user:pass@sarastores.com/"]:
            self.assertFalse(allowed_url(url))
        self.assertTrue(allowed_url("https://sarastores.com/product/synthetic"))

    def test_sitemap_refuses_entities_and_duplicate_or_private_urls(self):
        namespace = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
        self.assertFalse(validate_sitemap('<!DOCTYPE x [<!ENTITY e "data">]><urlset/>')["ok"])
        for content in ["<url><loc>https://sarastores.com/account</loc></url>",
                        "<url><loc>https://sarastores.com/</loc></url>" * 2,
                        "<url><loc>https://sarastores.com/</loc><lastmod>invalid</lastmod></url>"]:
            self.assertFalse(validate_sitemap(f"<urlset {namespace}>{content}</urlset>")["ok"])

    def test_malformed_urls_are_rejected_without_crashing(self):
        for url in ["https://sarastores.com:invalid/", "https://[broken/", "https://sarastores.com:99999/"]:
            self.assertFalse(allowed_url(url))

    def test_public_audit_cannot_pass_with_missing_or_failed_evidence(self):
        result = {"errors": [], "sitemap": {"ok": True}, "pages": [
            {"status": 200, "metadata_validation": {"ok": True}, "jsonld_errors": []}
        ]}
        self.assertTrue(public_audit_ok(result))
        for changes in [{"pages": []}, {"errors": [{"error": "URLError"}]}, {"sitemap": {"ok": False}},
                        {"pages": [{"status": "UNVERIFIED"}]},
                        {"pages": [{**result["pages"][0], "product_validation": {"ok": False}}]},
                        {"pages": [{**result["pages"][0], "jsonld_errors": ["Invalid JSON-LD syntax"]}]}]:
            self.assertFalse(public_audit_ok({**result, **changes}))

    def test_html_parser_does_not_execute_fetched_content(self):
        page = Page()
        page.feed('<h1>Fixture</h1><script>throw new Error("never execute")</script><script nonce="x" type="application/ld+json">{"@type":"Product"}</script>')
        self.assertEqual(page.h1, 1)
        self.assertEqual(page.schemas, [{"@type": "Product"}])

    def test_config_never_claims_authenticated_access(self):
        result = preflight.check({"ga4": {"property_id": "1234", "api_enabled": True, "resource_access_confirmed": True, "scopes": ["https://www.googleapis.com/auth/analytics.readonly"]}})
        self.assertTrue(result["ga4"]["configuration_complete"])
        self.assertEqual(result["ga4"]["authenticated_access"], "UNVERIFIED")

    def test_scope_string_and_measurement_id_are_not_valid_config(self):
        result = preflight.check({"ga4": {"property_id": "G-FAKE", "api_enabled": True, "resource_access_confirmed": True, "scopes": "https://www.googleapis.com/auth/analytics.readonly"}})
        self.assertFalse(result["ga4"]["configuration_complete"])


if __name__ == "__main__":
    unittest.main()
