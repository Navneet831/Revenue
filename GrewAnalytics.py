import webview
import sys
import os
import threading
import socket
import webbrowser
from http.server import SimpleHTTPRequestHandler
from socketserver import ThreadingTCPServer

# -----------------------------------------------------------------------------------------
# EXECUTIVE DEPLOYMENT SETTINGS
# -----------------------------------------------------------------------------------------
DEBUG = False
TARGET_PORT = 45678  # Primary port. Critical for Supabase localStorage persistence.

def get_available_port(start_port=45678, max_attempts=20):
    """
    Enterprise-grade port negotiation.
    Attempts to bind to the primary port to preserve localStorage auth tokens.
    Only falls back to dynamic routing if the port is hard-locked by another service.
    """
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            # connect_ex returns 0 if the port is OPEN (in use). != 0 means it's FREE.
            if s.connect_ex(("127.0.0.1", port)) != 0:
                if port != start_port and DEBUG:
                    print(f"WARNING: Port {start_port} blocked. Shifted to {port}. Auth state may reset.")
                return port
    raise RuntimeError("CRITICAL: Local network stack exhausted. No free ports available.")

def get_resource_path(relative_path):
    """Translates relative paths to absolute paths dynamically for PyInstaller --onedir."""
    try:
        base_path = sys._MEIPASS
    except AttributeError:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

class SecureQuietHandler(SimpleHTTPRequestHandler):
    """A highly optimized, silent HTTP handler. Terminal IO logging causes severe bottlenecks."""
    def __init__(self, *args, **kwargs):
        # Explicitly resolve the directory containing index.html to prevent root-path mapping failures
        target_directory = os.path.dirname(get_resource_path("index.html"))
        super().__init__(*args, directory=target_directory, **kwargs)
    
    def log_message(self, format, *args):
        if DEBUG:
            super().log_message(format, *args)

def start_server(port, stop_event):
    """Launches the threaded HTTP server."""
    ThreadingTCPServer.allow_reuse_address = True
    try:
        with ThreadingTCPServer(("127.0.0.1", port), SecureQuietHandler) as server:
            server_thread = threading.Thread(target=server.serve_forever, daemon=True)
            server_thread.start()
            stop_event.wait()
            server.shutdown()
    except OSError as e:
        if DEBUG: print(f"FATAL: Port bind failed. {e}")
        sys.exit(1)

if __name__ == '__main__':
    # 1. Server Lifecycle Management via Hierarchical Port Mapping
    PORT = get_available_port(TARGET_PORT)
    stop_event = threading.Event()
    server_thread = threading.Thread(target=start_server, args=(PORT, stop_event), daemon=True)
    server_thread.start()
    
    # 2. Construct Origin URL
    local_url = f'http://127.0.0.1:{PORT}/index.html'
    
    # 3. Graceful Teardown Hook
    def on_closed():
        stop_event.set()

    # 4. Resolve Application Icon natively
    app_icon = get_resource_path("Logo.ico")

    # 5. Persistent Data Storage
    app_data_dir = os.environ.get('LOCALAPPDATA', os.environ.get('APPDATA', os.path.expanduser('~')))
    persistent_storage_path = os.path.join(app_data_dir, 'GrewAnalytics_Data')
    os.makedirs(persistent_storage_path, exist_ok=True)

    # 6. Initialize Native OS WebView with Fallback Protocol
    try:
        window = webview.create_window(
            title='Grew Energy | Analytics', 
            url=local_url, 
            width=1280, 
            height=800,
            min_size=(1024, 768),
            background_color='#0b101e'
        )
        
        window.events.closed += on_closed
        
        start_kwargs = {
            'private_mode': False,
            'storage_path': persistent_storage_path
        }
        if os.path.exists(app_icon):
            start_kwargs['icon'] = app_icon
            
        # Attempt to launch Edge WebView2
        webview.start(**start_kwargs)
        
    except Exception as e:
        # FAILSAFE ARCHITECTURE: If WebView2 fails entirely, do NOT crash the executable.
        # Reroute the local server payload directly to the OS default browser (Chrome/Brave).
        webbrowser.open(local_url)
        
        # Keep the backend alive for the external browser
        try:
            while True:
                threading.Event().wait(1)
        except KeyboardInterrupt:
            on_closed()
            sys.exit(0)