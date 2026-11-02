"""Validate the exact source pin and the shared agent skill discovery layout."""
import ast
import hashlib
import json
import re
from pathlib import Path
import yaml
from install import ROOT, UPSTREAM, COMMIT, verify_checkout


def validate():
    verify_checkout()
    lock = json.loads((ROOT / "scripts/seo/upstream-lock.json").read_text(encoding="utf-8"))
    errors, inventory = [], []
    if lock["commit"] != COMMIT:
        errors.append("lock commit mismatch")
    for relative, expected in lock["files"].items():
        file = UPSTREAM / relative
        if not file.is_file():
            errors.append(f"missing upstream file: {relative}")
            continue
        content = file.read_bytes()
        if b"\0" not in content:
            content = content.replace(b"\r\n", b"\n")
        if hashlib.sha256(content).hexdigest() != expected:
            errors.append(f"upstream integrity mismatch: {relative}")
    names = {}
    for location in [".agents/skills", ".cursor/skills", ".codex/skills", ".claude/skills"]:
        for skill in (ROOT / location).rglob("SKILL.md"):
            text = skill.read_text(encoding="utf-8")
            try:
                front = yaml.safe_load(text.split("---", 2)[1])
                name, description = front.get("name"), front.get("description")
                if not isinstance(name, str) or not re.fullmatch(r"[a-z][a-z0-9-]{1,62}", name):
                    raise ValueError("invalid name")
                if not isinstance(description, str) or not description.strip() or len(description) > 1024:
                    raise ValueError("invalid description")
                if skill.parent.name != name:
                    raise ValueError("folder/name mismatch")
                if name in names:
                    errors.append(f"duplicate discovered skill: {name}")
                names[name] = str(skill.relative_to(ROOT))
                for link in re.findall(r"`(\.\./\.\./\.\./[^`]+)`", text):
                    if not (skill.parent / link).exists():
                        errors.append(f"unresolved reference: {name}: {link}")
                inventory.append({"name": name, "path": skill.relative_to(ROOT).as_posix()})
            except (ValueError, IndexError, AttributeError, yaml.YAMLError):
                errors.append(f"invalid skill frontmatter: {skill.relative_to(ROOT)}")
    if len(inventory) != 22:
        errors.append(f"expected 22 installed skills, found {len(inventory)}")
    # Compile without bytecode writes or importing/launching any upstream tool.
    scripts = []
    for script in sorted((UPSTREAM / "scripts").glob("*.py")):
        tree = ast.parse(script.read_text(encoding="utf-8"), filename=script.name)
        imports = sorted({node.module or "" for node in ast.walk(tree) if isinstance(node, ast.ImportFrom)} |
                         {alias.name for node in ast.walk(tree) if isinstance(node, ast.Import) for alias in node.names})
        calls = sorted({ast.unparse(node.func) for node in ast.walk(tree) if isinstance(node, ast.Call) and any(term in ast.unparse(node.func) for term in ["subprocess", "requests", "urlopen", "write", "unlink", "rmtree", "chmod", "connect", "publish", "delete", "insert"])})
        scripts.append({"file": script.name, "imports": imports, "side_effect_calls_to_review": calls})
    result = {"ok": not errors, "commit": COMMIT, "upstream_files_verified": len(lock["files"]),
              "skills": inventory, "shared_discovery": {"codex": ".agents/skills", "cursor": ".agents/skills"},
              "host_ui_verification": "filesystem checks only; see testing report for observed host discovery", "scripts_syntax_checked": len(scripts),
              "errors": errors, "script_inventory": scripts}
    output = ROOT / ".seo-local"
    output.mkdir(exist_ok=True)
    (output / "installation-validation.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k != "script_inventory"}, indent=2))
    return not errors


if __name__ == "__main__":
    raise SystemExit(0 if validate() else 1)
