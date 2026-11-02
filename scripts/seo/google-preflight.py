"""Configuration-only Google readiness checks: no token reads or API calls."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SERVICES = {
    "gsc": ("property", r"(?:sc-domain:sarastores\.com|https://(?:www\.)?sarastores\.com/)", "https://www.googleapis.com/auth/webmasters.readonly"),
    "ga4": ("property_id", r"[0-9]+", "https://www.googleapis.com/auth/analytics.readonly"),
    "merchant": ("account_id", r"[0-9]+", "https://www.googleapis.com/auth/content"),
    "gbp": ("account", r"accounts/[0-9]+", "https://www.googleapis.com/auth/business.manage"),
    "psi": ("url", r"https://sarastores\.com/?", None),
}


def check(config):
    results = {}
    for name, (field, pattern, scope) in SERVICES.items():
        entry = config.get(name, {})
        problems = []
        if not isinstance(entry, dict):
            entry = {}
            problems.append("configuration must be an object")
        if not isinstance(entry.get(field), str) or not re.fullmatch(pattern, entry[field]):
            problems.append(f"missing or invalid {field}")
        if entry.get("api_enabled") is not True:
            problems.append("API enablement not confirmed")
        if scope and (not isinstance(entry.get("scopes"), list) or scope not in entry["scopes"]):
            problems.append("required scope not confirmed")
        if name != "psi" and entry.get("resource_access_confirmed") is not True:
            problems.append("account/property access not confirmed")
        if name == "merchant" and not entry.get("data_source_id"):
            problems.append("Merchant data source not identified")
        if name == "gbp" and entry.get("project_approved") is not True:
            problems.append("Business Profile API project approval not confirmed")
        results[name] = {"configuration_complete": not problems, "authenticated_access": "UNVERIFIED", "issues": problems}
    return results


if __name__ == "__main__":
    file = ROOT / ".seo-local/google/config.json"
    try:
        config = json.loads(file.read_text(encoding="utf-8")) if file.exists() else {}
        if not isinstance(config, dict):
            raise ValueError("Config must be an object")
        print(json.dumps({"mode": "configuration-only", "services": check(config)}, indent=2))
    except (ValueError, OSError):
        raise SystemExit("Google configuration could not be read; values were not printed")
