#!/usr/bin/env python3
"""
GrewAnalytics Revenue — Windows launcher
Starts the bundled Node.js backend, waits for it to be ready, then opens the browser.
Works both in source (python launcher.py) and as a frozen PyInstaller onedir .exe.
"""

import os
import sys
import subprocess
import time
import webbrowser
import signal
import threading
from pathlib import Path


def get_data_root() -> Path:
    """
    Return the directory that contains apps/, monitoring/, node/, node_modules/.
    - Frozen onedir (PyInstaller 6+): sys._MEIPASS  →  dist/GrewAnalytics/_internal/
    - Source run:                       __file__ parent  →  repo root
    """
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS)
    return Path(__file__).parent


def get_exe_dir() -> Path:
    """Directory that contains the .exe itself (user-visible folder)."""
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).parent


def find_node(data_root: Path) -> str:
    """Return path to node.exe — bundled copy first, then system PATH."""
    bundled = data_root / 'node' / 'node.exe'
    if bundled.exists():
        return str(bundled)
    return 'node'


def wait_for_port(port: int = 8000, timeout: int = 30) -> bool:
    """Poll until the TCP port accepts connections or timeout expires."""
    import socket
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(('127.0.0.1', port), timeout=1):
                return True
        except OSError:
            time.sleep(0.4)
    return False


def pipe_output(stream, prefix: str):
    """Forward node stdout/stderr to this console with a prefix."""
    try:
        for line in iter(stream.readline, ''):
            if line:
                print(f"[node] {line}", end='', flush=True)
    except Exception:
        pass


def build_env(data_root: Path, exe_dir: Path) -> dict:
    """
    Build the environment for the Node.js process.
    Priority (highest first):
      1. Env vars already in the process (set by user before launching)
      2. .env file next to the .exe  (user-editable after install)
      3. Bundled defaults below
    dotenv in env.js will load the .env at _internal/.env via '../../.env',
    which OVERRIDES everything with override:true — so we just set safe fallbacks.
    """
    env = os.environ.copy()

    # Production defaults — dotenv in env.js will override these if .env exists
    env.setdefault('NODE_ENV',               'production')
    env.setdefault('HOST',                   '0.0.0.0')
    env.setdefault('PORT',                   '8000')
    env.setdefault('HIDE_GIT_ENDPOINTS',     'true')

    # Feature flags: opt-in defaults.  Flip in .env or system env to enable.
    env.setdefault('FEATURE_AGENTATION',      'false')
    env.setdefault('FEATURE_STORY',           'true')
    env.setdefault('FEATURE_COMMIT_DRILLDOWN','false')

    # If the user placed a .env next to the .exe, read it and let it win over
    # the defaults above (but not over env vars already in the process).
    user_env_file = exe_dir / '.env'
    if user_env_file.exists():
        for line in user_env_file.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                k = k.strip()
                if k and k not in os.environ:   # only if not already set
                    env[k] = v.strip()

    return env


def main():
    data_root = get_data_root()
    exe_dir   = get_exe_dir()

    backend_dir  = data_root / 'apps' / 'api'
    node_exe     = find_node(data_root)

    print("=" * 56)
    print("  GrewAnalytics Revenue Analytics Platform")
    print("=" * 56)
    print(f"  Data root : {data_root}")
    print(f"  Backend   : {backend_dir}")
    print(f"  Node      : {node_exe}")
    print()

    if not backend_dir.exists():
        print(f"ERROR: backend not found at {backend_dir}")
        input("Press Enter to exit...")
        sys.exit(1)

    env = build_env(data_root, exe_dir)

    try:
        proc = subprocess.Popen(
            [node_exe, 'index.js'],
            cwd=str(backend_dir),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
    except FileNotFoundError:
        print(f"ERROR: Node.js not found ({node_exe}). Install Node.js or re-run build_exe.py.")
        input("Press Enter to exit...")
        sys.exit(1)

    # Stream node output in background thread so startup messages are visible
    log_thread = threading.Thread(target=pipe_output, args=(proc.stdout, 'node'), daemon=True)
    log_thread.start()

    print("Waiting for backend (up to 30 s)...")
    if not wait_for_port(8000, timeout=30):
        print("ERROR: Backend did not start within 30 seconds.")
        proc.terminate()
        input("Press Enter to exit...")
        sys.exit(1)

    url = 'http://127.0.0.1:8000'
    print(f"\nBackend ready  →  {url}")
    print("Opening browser...\n")
    webbrowser.open(url)
    print("Press Ctrl+C to stop the server.\n")

    def shutdown(sig=None, frame=None):
        print("\nShutting down...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        print("Done.")
        sys.exit(0)

    signal.signal(signal.SIGINT,  shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        proc.wait()
        print(f"\nBackend exited (code {proc.returncode}).")
        input("Press Enter to exit...")
        sys.exit(proc.returncode or 1)
    except KeyboardInterrupt:
        shutdown()


if __name__ == '__main__':
    main()
