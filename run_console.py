import os
import socket
import sys
import subprocess
import time
import signal

def get_lan_ip():
    """Detects the local IPv4 address on the active network interface."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        # Doesn't need to connect, used to find interface IP
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

def main():
    lan_ip = get_lan_ip()
    base_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(base_dir, "backend")
    frontend_dir = os.path.join(base_dir, "frontend")

    print("\n" + "="*76)
    print(" ARIES-C2 | CIVIL POLICE DRONE RECONNAISSANCE, TRACKING & TRZ CONSOLE ")
    print(" Under Rule 24 of Drone Rules, 2021 & BSA Section 65B Audit Ledger ")
    print("="*76)
    print(f" Local Console Workstation UI:  http://localhost:5173")
    print(f" LAN Console Workstation UI:    http://{lan_ip}:5173")
    print(f" Mobile Remote ID Transmitter:  http://{lan_ip}:8000/drone")
    print(f" Remote Ingestion WS Endpoint:  ws://{lan_ip}:8000/ws/drone")
    print(f" Section 65B Audit Ledger API:  http://localhost:8000/api/audit/export")
    print("="*76 + "\n")

    # Start FastAPI Backend Server
    print("[RUN] Starting FastAPI Airspace Server on 0.0.0.0:8000...")
    backend_cmd = [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
    backend_proc = subprocess.Popen(backend_cmd, cwd=backend_dir)

    # Wait for backend port 8000 to be listening
    print("[WAIT] Waiting for FastAPI Backend to initialize on port 8000...")
    for _ in range(30):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.5)
            s.connect(("127.0.0.1", 8000))
            s.close()
            print("[OK] FastAPI Backend is ready on port 8000!")
            break
        except Exception:
            time.sleep(0.5)

    # Start Vite Frontend Dev Server
    print("[RUN] Starting React Vite Console UI on 0.0.0.0:5173...")
    npm_bin = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_cmd = [npm_bin, "run", "dev"]
    frontend_proc = subprocess.Popen(frontend_cmd, cwd=frontend_dir)

    def signal_handler(sig, frame):
        print("\n[SHUTDOWN] Terminating C2 Console processes...")
        try:
            backend_proc.terminate()
            frontend_proc.terminate()
        except Exception:
            pass
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)

    try:
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        signal_handler(None, None)

if __name__ == "__main__":
    main()
