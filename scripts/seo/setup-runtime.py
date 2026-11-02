"""Reviewed first-install fallback for Windows folders that refuse atomic rename.

Creates the upstream runtime at its final isolated location, verifies imports and
only then records readiness. Refuses to overwrite an existing environment.
"""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
from install import ROOT, verify_checkout

if __name__ == "__main__":
    verify_checkout()
    data = (ROOT / ".seo-local/runtime").resolve()
    if not data.is_relative_to(ROOT.resolve()):
        raise SystemExit("Runtime target is outside the project")
    venv = data / ".venv"
    if venv.exists():
        raise SystemExit("Existing environment preserved; use doctor/review before any repair")
    data.mkdir(parents=True, exist_ok=True)
    environment = os.environ.copy()
    environment["PYTHONUTF8"] = "1"
    environment["PLAYWRIGHT_BROWSERS_PATH"] = str(data / "ms-playwright")
    subprocess.run([sys.executable, "-m", "venv", str(venv)], check=True, env=environment)
    python = venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    subprocess.run([str(python), "-m", "pip", "install", "--disable-pip-version-check", "--cache-dir", str(data / "pip-cache"), "-r", str(ROOT / "scripts/seo/requirements-lock.txt")], check=True, env=environment)
    subprocess.run([str(python), "-m", "playwright", "install", "chromium"], check=True, env=environment)
    subprocess.run([str(python), "-c", "import bs4,lxml,lxml_html_clean,playwright,requests,trafilatura,pytest,yaml"], check=True, env=environment)
    spec = importlib.util.spec_from_file_location("claude_seo_runtime", ROOT / ".seo-tools/scripts/runtime.py")
    runtime = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runtime)
    state = runtime._expected(ROOT / ".seo-tools")
    state["browser_ready"] = any(item.name.startswith(("chromium-", "chromium_headless_shell-")) for item in (data / "ms-playwright").iterdir())
    if not state["browser_ready"]:
        raise SystemExit("Chromium verification failed; runtime readiness not recorded")
    (data / "runtime-state.json").write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    packages = subprocess.check_output([str(python), "-m", "pip", "list", "--format=json", "--disable-pip-version-check"], env=environment, text=True)
    (data / "resolved-packages.json").write_text(packages, encoding="utf-8")
    print(json.dumps({"ready": True, "browser_ready": True, "mode": "reviewed first-install Windows fallback", "source_modified": False}))
