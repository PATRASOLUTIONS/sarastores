"""Offline SEO baseline/diff using JSON files; no database or network."""
import argparse
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]


def snapshot(directory):
    metadata = json.loads((directory / "metadata.json").read_text(encoding="utf-8"))
    product = json.loads((directory / "product.json").read_text(encoding="utf-8"))
    xml = (directory / "sitemap.xml").read_text(encoding="utf-8")
    if "<!DOCTYPE" in xml.upper() or "<!ENTITY" in xml.upper():
        raise ValueError("Sitemap DTD/entities refused")
    urls = sorted(node.text for node in ET.fromstring(xml).iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc") if node.text)
    return {"metadata": metadata, "schemas": product, "sitemap_urls": urls}


def compare(before, after):
    return {key: {"before": before.get(key), "after": after.get(key)}
            for key in sorted(set(before) | set(after)) if before.get(key) != after.get(key)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["baseline", "diff"])
    args = parser.parse_args()
    directory = ROOT / ".seo-local/drift"
    directory.mkdir(parents=True, exist_ok=True)
    baseline = directory / "baseline.json"
    current = snapshot(ROOT / ".seo-local/fixtures")
    if args.action == "baseline":
        if baseline.exists():
            raise SystemExit("Baseline already exists; review its diff before intentionally replacing it")
        baseline.write_text(json.dumps(current, indent=2), encoding="utf-8")
        print(json.dumps({"baseline": ".seo-local/drift/baseline.json", "scope": "synthetic fixture SEO; not live deployment monitoring"}))
    else:
        changes = compare(json.loads(baseline.read_text(encoding="utf-8")), current)
        (directory / "diff.json").write_text(json.dumps(changes, indent=2), encoding="utf-8")
        print(json.dumps({"changed_sections": list(changes), "scope": "synthetic fixture SEO"}))
        raise SystemExit(1 if changes else 0)
