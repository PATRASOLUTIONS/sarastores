"""Fetch fixed official documentation pages; never execute downloaded content."""
import html
import argparse
import json
import re
import urllib.request
from pathlib import Path

SOURCES = {
    "codex": "https://developers.openai.com/codex/skills",
    "cursor": "https://cursor.com/docs/context/skills",
    "gsc": "https://developers.google.com/webmaster-tools/v1/how-tos/authorizing",
    "ga4": "https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart-client-libraries",
    "merchant": "https://developers.google.com/merchant/api",
    "merchant-auth": "https://developers.google.com/merchant/api/guides/authorization/overview",
    "github-pin": "https://api.github.com/repos/AgriciDaniel/claude-seo/commits/6be93f45064ffbadced572b5d5c95f55fd263af0",
    "gbp": "https://developers.google.com/my-business/content/prereqs",
    "psi": "https://developers.google.com/speed/docs/insights/v5/get-started",
    "product": "https://developers.google.com/search/docs/appearance/structured-data/merchant-listing",
}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", action="append", choices=list(SOURCES))
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    output = root / ".seo-local" / "official-docs"
    output.mkdir(parents=True, exist_ok=True)
    for key, url in SOURCES.items():
        if args.source and key not in args.source:
            continue
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "SaraSEO-DocumentationReview/1.0"})
            with urllib.request.urlopen(request, timeout=25) as response:
                raw = response.read(5_000_001)
                if len(raw) > 5_000_000:
                    raise ValueError("Documentation exceeds size limit")
                final_url = response.url
            text = raw.decode("utf-8", errors="replace")
            if key == "github-pin":
                commit = json.loads(text)
                print(json.dumps({"source": key, "sha": commit.get("sha"), "verification": commit.get("commit", {}).get("verification", {}).get("verified"), "reason": commit.get("commit", {}).get("verification", {}).get("reason")}))
                (output / f"{key}.json").write_text(text, encoding="utf-8")
                continue
            text = re.sub(r"<(script|style)\b[^>]*>[\s\S]*?</\1>", " ", text, flags=re.I)
            text = html.unescape(re.sub(r"<[^>]+>", " ", text))
            text = re.sub(r"\s+", " ", text)
            (output / f"{key}.txt").write_text(text, encoding="utf-8")
            terms = r"\.agents/skills|\.cursor/skills|symlink|SKILL\.md|analytics\.readonly|webmasters\.readonly|business\.manage|auth/content|service account|access request|API key|permission|quota|priceCurrency"
            excerpts = [m.group(0) for m in re.finditer(r".{0,100}(?:" + terms + r").{0,220}", text, flags=re.I)]
            print(json.dumps({"source": key, "url": final_url, "status": "fetched", "excerpts": excerpts[:22]}))
        except Exception as error:
            # Fixed public URLs, no credentials; record class rather than response bodies.
            print(json.dumps({"source": key, "url": url, "status": "unavailable", "error": type(error).__name__}))
