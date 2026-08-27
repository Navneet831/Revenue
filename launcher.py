#!/usr/bin/env python3
"""
GrewAnalytics Revenue — Windows launcher
Starts the FastAPI backend (uvicorn), waits for it to be ready, then opens the browser.
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


def fail(msg: str):
    """Show the error and exit. The exe is built console=False, so stdin is
    unavailable — a message box is the only way the user ever sees the error."""
    print(msg)
    if os.name == 'nt':
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, msg, 'GrewAnalytics', 0x10)  # MB_ICONERROR
    sys.exit(1)


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
    """Forward backend stdout/stderr to this console with a prefix."""
    try:
        for line in iter(stream.readline, ''):
            if line:
                print(f"[{prefix}] {line}", end='', flush=True)
    except Exception:
        pass


def build_env(data_root: Path, exe_dir: Path) -> dict:
    """
    Build the environment for the Node.js process.
    Priority (highest first):
      1. Env vars already in the process (set by user before launching)
      2. .env file next to the .exe  (user-editable after install)
      3. Bundled defaults below
      4. Bundled _internal/.env — loaded by dotenv in env.js (override:false,
         so anything we put in the process env here wins over it)
    """
    env = os.environ.copy()

    # Production defaults — dotenv in env.js will override these if .env exists
    env.setdefault('NODE_ENV',               'production')
    env.setdefault('HOST',                   '127.0.0.1')
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
                    env[k] = v.strip().strip('"').strip("'")

    return env


def ensure_cert(data_root: Path) -> tuple:
    """
    Ensure a self-signed certificate exists for HTTPS on 127.0.0.1.
    Returns (cert_path, key_path) as absolute Paths, or (None, None) if the
    certificate could not be produced (caller then falls back to plain HTTP).
    Skips regeneration when certs/cert.pem + certs/key.pem already exist.
    """
    certs_dir = data_root / 'certs'
    cert_path = certs_dir / 'cert.pem'
    key_path  = certs_dir / 'key.pem'

    if cert_path.exists() and key_path.exists():
        print(f"  TLS cert  : {cert_path} (exists, reusing)")
        return cert_path, key_path

    print("  TLS cert  : generating self-signed cert for 127.0.0.1 ...")
    certs_dir.mkdir(parents=True, exist_ok=True)

    # 1) Prefer openssl if available on PATH.
    try:
        import shutil
        if shutil.which('openssl'):
            subprocess.run(
                ['openssl', 'req', '-x509', '-newkey', 'rsa:2048',
                 '-keyout', str(key_path), '-out', str(cert_path),
                 '-days', '825', '-nodes', '-subj', '/CN=127.0.0.1',
                 '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost'],
                check=True, capture_output=True, timeout=60,
            )
            if cert_path.exists() and key_path.exists():
                return cert_path, key_path
    except Exception as exc:
        print(f"    openssl failed: {exc} — trying cryptography")

    # 2) Fallback: python cryptography.
    try:
        import datetime
        import ipaddress
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.x509.oid import NameOID

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, '127.0.0.1')])
        now = datetime.datetime.now(datetime.timezone.utc)
        cert = (
            x509.CertificateBuilder()
            .subject_name(name)
            .issuer_name(name)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now)
            .not_valid_after(now + datetime.timedelta(days=825))
            .add_extension(
                x509.SubjectAlternativeName([
                    x509.IPAddress(ipaddress.ip_address('127.0.0.1')),
                    x509.DNSName('localhost'),
                ]),
                critical=False,
            )
            .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
            .sign(key, hashes.SHA256())
        )
        key_path.write_bytes(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ))
        cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
        return cert_path, key_path
    except Exception as exc:
        print(f"    cryptography failed: {exc}")

    # 3) Last resort: try installing cryptography, then retry once.
    try:
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'cryptography'],
                       check=True, capture_output=True, timeout=300)
        return ensure_cert(data_root) if key_path.exists() is False else (cert_path, key_path)
    except Exception as exc:
        print(f"    pip install cryptography failed: {exc}")

    print("  WARNING: could not generate TLS certificate — falling back to http.")
    return None, None


def main():
    # Named mutex lets the installer (AppMutex in GrewAnalytics.iss) detect a
    # running instance. Held until process exit; no handle needed.
    if os.name == 'nt':
        import ctypes
        ctypes.windll.kernel32.CreateMutexW(None, False, 'GrewAnalyticsAppMutex')

    data_root = get_data_root()
    exe_dir   = get_exe_dir()

    backend_dir  = data_root / 'backend'
    # Run uvicorn with the current interpreter. ponytail: frozen-exe packaging
    # (bundling uvicorn/psycopg2 via PyInstaller) is a build_exe.py concern —
    # this covers source runs and any env where `python -m uvicorn` resolves.
    python_exe   = sys.executable

    print("=" * 56)
    print("  GrewAnalytics Revenue Analytics Platform")
    print("=" * 56)
    print(f"  Data root : {data_root}")
    print(f"  Backend   : {backend_dir}")
    print(f"  Python    : {python_exe}")
    print()

    if not backend_dir.exists():
        fail(f"ERROR: backend not found at {backend_dir}")

    env = build_env(data_root, exe_dir)
    port = env.get('PORT', '8000')
    host = env.get('HOST', '127.0.0.1')

    # TLS: opt-in via USE_HTTPS env var
    use_https = env.get('USE_HTTPS', 'false').lower() in ('true', '1')
    cert_path, key_path = (ensure_cert(data_root) if use_https else (None, None))
    scheme = 'https' if cert_path and key_path else 'http'
    url = f'{scheme}://127.0.0.1:{port}'

    try:
        creationflags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        uvicorn_cmd = [
            python_exe, '-m', 'uvicorn', 'backend.main:app',
            '--host', host, '--port', str(port),
        ]
        if cert_path and key_path:
            uvicorn_cmd += [
                '--ssl-certfile', str(cert_path),
                '--ssl-keyfile', str(key_path),
            ]
        proc = subprocess.Popen(
            uvicorn_cmd,
            cwd=str(data_root),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            creationflags=creationflags,
        )
    except FileNotFoundError:
        fail(f"ERROR: Python not found ({python_exe}). Re-run build_exe.py.")

    # Stream node output in background thread so startup messages are visible
    log_thread = threading.Thread(target=pipe_output, args=(proc.stdout, 'api'), daemon=True)
    log_thread.start()

    print("Waiting for backend (up to 30 s)...")
    if not wait_for_port(int(port), timeout=30):
        proc.terminate()
        fail("ERROR: Backend did not start within 30 seconds.")

    def shutdown(sig=None, frame=None):
        print("\nShutting down...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        print("Done.")
        sys.exit(0)

    # Use native OS WebView as the primary container
    try:
        import webview
        
        # Resolve application icon path
        app_icon = str(data_root / 'Logo.ico')
        
        # Initialize native Window
        window = webview.create_window(
            title='Grew Energy | Analytics', 
            url=url, 
            width=1280, 
            height=800,
            min_size=(1024, 768),
            background_color='#0b101e',
            maximized=True
        )
        
        # When desktop window is closed, shut down the Node backend
        window.events.closed += shutdown
        
        start_kwargs = {
            'private_mode': False,
        }
        if os.path.exists(app_icon):
            start_kwargs['icon'] = app_icon
            
        # Launch WebView
        webview.start(**start_kwargs)
        
    except Exception as e:
        # Failsafe: fall back to default system browser if webview is unavailable
        print(f"WebView initialization failed: {e}. Falling back to default browser.")
        webbrowser.open(url)
        
        signal.signal(signal.SIGINT,  shutdown)
        signal.signal(signal.SIGTERM, shutdown)
        
        try:
            proc.wait()
        except KeyboardInterrupt:
            shutdown()


if __name__ == '__main__':
    main()
