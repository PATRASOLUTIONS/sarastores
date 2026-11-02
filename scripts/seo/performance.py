"""Public, credential-free PageSpeed request; field and lab evidence stay separate."""
from datetime import datetime, timezone
import json
from pathlib import Path
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
if __name__ == "__main__":
    target = "https://www.sarastores.com/"
    endpoint = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?" + urllib.parse.urlencode({"url": target, "strategy": "mobile", "category": "performance"})
    result = {"url": target, "collected_at": datetime.now(timezone.utc).isoformat(), "field_status": "UNVERIFIED", "lab_status": "UNVERIFIED"}
    output = ROOT / ".seo-local/performance"
    output.mkdir(parents=True, exist_ok=True)
    try:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(endpoint, timeout=120) as response:
            raw = response.read(5_000_001)
        if len(raw) > 5_000_000:
            raise ValueError("PageSpeed response exceeded read limit")
        data = json.loads(raw)
        (output / "pagespeed.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
        for name in ["loadingExperience", "originLoadingExperience"]:
            experience = data.get(name, {})
            metrics = experience.get("metrics", {})
            values = {}
            for field, key, scale in [("lcp_ms", "LARGEST_CONTENTFUL_PAINT_MS", 1), ("inp_ms", "INTERACTION_TO_NEXT_PAINT", 1), ("cls", "CUMULATIVE_LAYOUT_SHIFT_SCORE", 100)]:
                percentile = metrics.get(key, {}).get("percentile")
                values[field] = percentile / scale if isinstance(percentile, (int, float)) else None
            result[name] = {"scope": experience.get("id"), "p75": values}
        url_values = result["loadingExperience"]["p75"]
        if all(value is not None for value in url_values.values()):
            result["field_status"] = "PASS" if url_values["lcp_ms"] <= 2500 and url_values["inp_ms"] <= 200 and url_values["cls"] <= 0.1 else "NEEDS_IMPROVEMENT"
        lighthouse = data.get("lighthouseResult", {})
        if lighthouse:
            result["lab_status"] = "MEASURED"
            result["mobile_performance_score"] = lighthouse.get("categories", {}).get("performance", {}).get("score")
            result["lab_metrics"] = {key: lighthouse.get("audits", {}).get(key, {}).get("numericValue") for key in ["largest-contentful-paint", "cumulative-layout-shift", "total-blocking-time"]}
    except Exception as error:
        result["error"] = type(error).__name__
        result["http_status"] = getattr(error, "code", None)
    (output / "summary.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["lab_status"] == "MEASURED" else 1)
