"""Windows/Unix adapter to the reviewed upstream runtime; no credential discovery."""
import os
import json
import subprocess
import sys
from pathlib import Path
from install import ROOT, verify_checkout

# All run entries must be source-reviewed before extending this list.
# Auth and external-write tools are deliberately absent.
REVIEWED = {"portability_check.py", "schema_ecommerce_validate.py", "metadata_template.py"}

if __name__ == "__main__":
    verify_checkout()
    args = sys.argv[1:]
    if args and args[0] == "setup":
        if args[1:]:
            raise SystemExit("Pinned local setup takes no options; run doctor before changing an existing runtime")
        raise SystemExit(subprocess.call([sys.executable, str(ROOT / "scripts/seo/setup-runtime.py")], cwd=ROOT))
    if not args or args[0] not in {"doctor", "setup", "run"}:
        raise SystemExit("Use doctor --json, setup, or run <reviewed script> ...")
    if args[0] == "run" and (len(args) < 2 or args[1] not in REVIEWED):
        raise SystemExit("Script is not reviewed for execution here. Review it and update the allowlist first.")
    if args[0:2] == ["run", "schema_ecommerce_validate.py"]:
        from audit import validate_product
        if len(args) < 3 or args[2].startswith("-"):
            raise SystemExit("Provide a local Product JSON file for the mandatory Sara eligibility checks")
        check = validate_product(json.loads(Path(args[2]).read_text(encoding="utf-8")))
        if not check["ok"]:
            print(json.dumps({"ok": False, "source": "mandatory Sara Offer checks", "errors": check["errors"]}))
            raise SystemExit(1)
    data = (ROOT / ".seo-local/runtime").resolve()
    if not data.is_relative_to(ROOT.resolve()):
        raise SystemExit("Runtime must remain inside this workspace")
    env = os.environ.copy()
    env["CLAUDE_SEO_DATA_DIR"] = str(data)
    env["PYTHONUTF8"] = "1"
    env.pop("CLAUDE_PLUGIN_DATA", None)
    env.pop("CLAUDE_PLUGIN_ROOT", None)
    raise SystemExit(subprocess.call([sys.executable, str(ROOT / ".seo-tools/scripts/runtime.py"), *args], env=env, cwd=ROOT))
