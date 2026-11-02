"""High-signal secret scan of integration files; never print matched values."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATTERN = re.compile(r"AIza[0-9A-Za-z_-]{35}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16}|GOCSPX-[A-Za-z0-9_-]{20,}|sk-(?:proj-)?[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")

if __name__ == "__main__":
    findings = []
    checked = 0
    for folder in ["scripts/seo", ".agents/skills", "documents/seo"]:
        for file in (ROOT / folder).rglob("*"):
            if not file.is_file() or file.suffix in {".pyc"} or "__pycache__" in file.parts:
                continue
            text = file.read_text(encoding="utf-8", errors="replace")
            checked += 1
            if PATTERN.search(text):
                findings.append(file.relative_to(ROOT).as_posix())
    print(json.dumps({"ok": not findings, "files_checked": checked, "potential_secret_files": findings, "scope": "integration files only; not a complete repository or dependency audit"}, indent=2))
    raise SystemExit(1 if findings else 0)
