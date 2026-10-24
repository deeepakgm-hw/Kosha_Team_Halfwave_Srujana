"""
KOSHA Environment Verification Script
Checks prerequisite Python packages, Node.js version, and environment settings.
"""

import sys
import subprocess
import os

REQUIRED_PYTHON_MODULES = [
    "fastapi",
    "uvicorn",
    "pydantic",
    "numpy",
    "pandas",
    "pytest",
]


def check_python_environment():
    print(f"[*] Python version: {sys.version.split()[0]}")
    missing = []
    for mod in REQUIRED_PYTHON_MODULES:
        try:
            __import__(mod)
            print(f"  [+] {mod}: OK")
        except ImportError:
            print(f"  [-] {mod}: MISSING")
            missing.append(mod)
    return len(missing) == 0


def check_node_environment():
    try:
        use_shell = sys.platform.startswith("win")
        node_res = subprocess.run(["node", "--version"], capture_output=True, text=True, check=True, shell=use_shell)
        print(f"[*] Node version: {node_res.stdout.strip()}")
        npm_cmd = "npm.cmd" if use_shell else "npm"
        npm_res = subprocess.run([npm_cmd, "--version"], capture_output=True, text=True, check=True, shell=use_shell)
        print(f"[*] npm version: {npm_res.stdout.strip()}")
        return True
    except Exception as e:
        print(f"[-] Node/npm check failed: {e}")
        return False


def main():
    print("=== KOSHA Development Environment Check ===")
    py_ok = check_python_environment()
    node_ok = check_node_environment()
    print("-" * 40)
    if py_ok and node_ok:
        print("[SUCCESS] All required foundation runtimes are present.")
        sys.exit(0)
    else:
        print("[WARN] Some prerequisites are missing. Check above output.")
        sys.exit(1)


if __name__ == "__main__":
    main()
