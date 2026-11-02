"""Record exact installed SEO dependency versions; no installation or network."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
runtime = ROOT / ".seo-local/runtime"
python = runtime / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
packages = json.loads(subprocess.check_output([str(python), "-m", "pip", "list", "--format=json", "--disable-pip-version-check"], text=True))
for item in packages:
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", item["name"]) or not re.fullmatch(r"[A-Za-z0-9_.+!-]+", item["version"]):
        raise SystemExit("Unexpected dependency name/version; freeze refused")
lock = "# Resolved SEO runtime: Windows, Python 3.13; versions pinned, artifacts not hash-pinned.\n"
lock += "\n".join(f"{item['name']}=={item['version']}" for item in sorted(packages, key=lambda item: item["name"].lower())) + "\n"
(ROOT / "scripts/seo/requirements-lock.txt").write_text(lock, encoding="utf-8")
(runtime / "resolved-packages.json").write_text(json.dumps(packages, indent=2), encoding="utf-8")
print(json.dumps({"packages_pinned": len(packages), "lock": "scripts/seo/requirements-lock.txt"}))
