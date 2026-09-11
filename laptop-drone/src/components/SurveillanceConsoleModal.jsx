import React, { useEffect, useState, useRef } from 'react';
import { 
  Radar, 
  X, 
  Radio, 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  WifiOff, 
  Activity, 
  Terminal, 
  Maximize2 
} from 'lucide-react';

/**
 * External Surveillance Console Simulator
 * Opens a dedicated WebSocket client configured with role="surveillance_listener"
 * to demonstrate what an external air traffic / police radar console perceives in real time.
 */
export default function SurveillanceConsoleModal({ isOpen, onClose, wsUrl = 'ws://127.0.0.1:8765' }) {
  const [messages, setMessages] = useState([]);
  const [currentPacket, setCurrentPacket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPacketTime, setLastPacketTime] = useState(null);
  const [isSignalLost, setIsSignalLost] = useState(false);
  const wsRef = useRef(null);
  const signalTimerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      if (wsRef.current) wsRef.current.close();
      return;
    }

    // Connect separate listener WebSocket
    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        // Register role as surveillance listener
        socket.send(JSON.stringify({ type: 'identify', role: 'surveillance_listener' }));
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const now = Date.now();
          setLastPacketTime(now);
          setIsSignalLost(false);

          if (payload.type === 'astm_broadcast' || payload.type === 'init_state' || payload.type === 'telemetry') {
            const data = payload.data;
            setCurrentPacket(data);
            setMessages(prev => [
              {
                id: Math.random().toString(),
                time: new Date().toLocaleTimeString(),
                uas_id: data.uas_id,
                alt: data.alt_geo_m,
                status: data.status,
                speed: data.speed_horizontal_mps,
                raw: data
              },
              ...prev.slice(0, 49) // Keep last 50 logs
            ]);
          }
        } catch (e) {
          console.error(e);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
      };

      socket.onerror = () => {
        setIsConnected(false);
      };
    } catch (err) {
      console.error(err);
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (signalTimerRef.current) clearInterval(signalTimerRef.current);
    };
  }, [isOpen, wsUrl]);

  // Check for signal loss (e.g. if Go Dark / SILENT_DARK is engaged and no packet arrives in >1.8s)
  useEffect(() => {
    if (!isOpen) return;

    signalTimerRef.current = setInterval(() => {
      if (lastPacketTime && (Date.now() - lastPacketTime > 1800)) {
        setIsSignalLost(true);
      }
    }, 500);

    return () => {
      if (signalTimerRef.current) clearInterval(signalTimerRef.current);
    };
  }, [isOpen, lastPacketTime]);

  if (!isOpen) return null;

  const isBreached = currentPacket?.alt_geo_m > 120.0;
  const isSpoofed = currentPacket?.uas_id === 'UNAUTH-DRONE-999';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl h-[640px] flex flex-col rounded-xl border border-tactical-600 bg-tactical-950 p-4 shadow-2xl font-mono text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-tactical-700">
          <div className="flex items-center space-x-2">
            <Radar className="text-cyber-cyan animate-spin" style={{ animationDuration: '6s' }} size={22} />
            <div>
              <h2 className="text-sm font-bold tracking-widest text-slate-100 uppercase font-orbitron">
                EXTERNAL SURVEILLANCE RADAR LISTENER
              </h2>
              <p className="text-[11px] text-slate-400">
                Independent Air Traffic Telemetry Sink listening on <code className="text-cyber-cyan">{wsUrl}</code>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className={`px-2.5 py-1 rounded text-xs font-bold border flex items-center space-x-1.5 ${
              isConnected ? 'bg-cyber-green/15 border-cyber-green text-cyber-green' : 'bg-red-950 border-red-500 text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-cyber-green animate-pulse' : 'bg-red-500'}`}></div>
              <span>{isConnected ? 'STREAM LINKED' : 'DISCONNECTED'}</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-tactical-900 hover:bg-tactical-800 border border-tactical-700 text-slate-400 hover:text-slate-200"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Status Alerts in Surveillance Receiver */}
        {isSignalLost ? (
          <div className="mb-3 p-3 rounded-lg bg-purple-950/80 border border-cyber-purple text-cyber-purple flex items-center justify-between animate-pulse">
            <div className="flex items-center space-x-2.5">
              <WifiOff size={20} />
              <div>
                <strong className="block text-xs uppercase font-orbitron">CRITICAL: REMOTE ID SIGNAL LOST / SILENCED</strong>
                <span className="text-[11px] text-purple-300">
                  Target ceased ASTM F3411 broadcast emissions (Possible Rogue / Dark Mode Evasion).
                </span>
              </div>
            </div>
            <span className="px-2 py-1 bg-cyber-purple text-black font-bold text-xs rounded">STEALTH ROGUE</span>
          </div>
        ) : isBreached ? (
          <div className="mb-3 p-3 rounded-lg bg-red-950/80 border border-cyber-red text-cyber-red flex items-center justify-between animate-pulse shadow-red-glow">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle size={20} />
              <div>
                <strong className="block text-xs uppercase font-orbitron">AIRSPACE VIOLATION DETECTED</strong>
                <span className="text-[11px] text-red-300">
                  Drone {currentPacket?.uas_id} operating at {currentPacket?.alt_geo_m?.toFixed(1)}m AGL (Exceeds 120m DGCA limit).
                </span>
              </div>
            </div>
            <span className="px-2 py-1 bg-cyber-red text-black font-bold text-xs rounded">CEILING BREACH</span>
          </div>
        ) : isSpoofed ? (
          <div className="mb-3 p-3 rounded-lg bg-amber-950/80 border border-cyber-amber text-cyber-amber flex items-center justify-between animate-pulse shadow-amber-glow">
            <div className="flex items-center space-x-2.5">
              <ShieldAlert size={20} />
              <div>
                <strong className="block text-xs uppercase font-orbitron">SECURITY ALERT: UNREGISTERED UAS DETECTED</strong>
                <span className="text-[11px] text-amber-300">
                  UAS ID "{currentPacket?.uas_id}" not found in DGCA Registry database.
                </span>
              </div>
            </div>
            <span className="px-2 py-1 bg-cyber-amber text-black font-bold text-xs rounded">SPOOFED ID</span>
          </div>
        ) : (
          <div className="mb-3 p-2.5 rounded-lg bg-emerald-950/40 border border-cyber-green text-cyber-green flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <ShieldCheck size={18} />
              <span>COOPERATIVE UAS BROADCASTING NORMAL DIRECT REMOTE ID TELEMETRY</span>
            </div>
            <span className="text-[11px] text-slate-400">DGCA REGISTRY COMPLIANT</span>
          </div>
        )}

        {/* Live Target Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div className="bg-tactical-900/90 border border-tactical-800 p-2.5 rounded-lg">
            <div className="text-[10px] text-slate-400">DETECTED UAS ID</div>
            <div className={`text-base font-bold font-orbitron ${isSpoofed ? 'text-cyber-amber' : 'text-cyber-cyan'}`}>
              {isSignalLost ? `${currentPacket?.uas_id || 'UNKNOWN'} (LAST KNOWN)` : currentPacket?.uas_id || 'SCANNING...'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">TYPE: {currentPacket?.ua_type || 'Multirotor'}</div>
          </div>

          <div className="bg-tactical-900/90 border border-tactical-800 p-2.5 rounded-lg">
            <div className="text-[10px] text-slate-400">SURVEILLANCE RADAR ALTITUDE</div>
            <div className={`text-base font-bold font-mono ${isBreached ? 'text-cyber-red' : 'text-cyber-cyan'}`}>
              {currentPacket?.alt_geo_m?.toFixed(1) || '0.0'} m AGL
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">DGCA CEILING: 120.0 m</div>
          </div>

          <div className="bg-tactical-900/90 border border-tactical-800 p-2.5 rounded-lg">
            <div className="text-[10px] text-slate-400">GROUND VECTOR</div>
            <div className="text-base font-bold text-slate-100 font-mono">
              {(currentPacket?.speed_horizontal_mps || 0).toFixed(1)} m/s @ {Math.round(currentPacket?.heading_deg || 0)}°
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">COORDS: {currentPacket?.lat?.toFixed(4)}, {currentPacket?.lon?.toFixed(4)}</div>
          </div>
        </div>

        {/* Live Packet Log Stream */}
        <div className="flex-1 flex flex-col overflow-hidden bg-tactical-900/90 border border-tactical-800 rounded-lg p-2">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-tactical-800 text-[11px] text-slate-400">
            <div className="flex items-center space-x-1.5">
              <Terminal size={13} className="text-cyber-cyan" />
              <span>LIVE ASTM F3411 STREAM LOGS</span>
            </div>
            <span>TOTAL CAPTURED: {messages.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[11px] pr-1">
            {messages.length === 0 ? (
              <div className="text-center text-slate-500 py-10">Awaiting ASTM broadcast packets...</div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="flex items-center justify-between p-1.5 rounded bg-tactical-950/80 border border-tactical-800/80 hover:border-slate-600">
                  <div className="flex items-center space-x-3">
                    <span className="text-slate-500 text-[10px]">{msg.time}</span>
                    <span className="font-bold text-cyber-cyan">{msg.uas_id}</span>
                    <span className={msg.alt > 120 ? 'text-cyber-red font-bold' : 'text-slate-300'}>
                      {msg.alt.toFixed(1)}m
                    </span>
                    <span className="text-slate-400">{msg.speed.toFixed(1)}m/s</span>
                  </div>
                  <div className="text-[10px] text-slate-400 bg-tactical-900 px-1.5 py-0.5 rounded border border-tactical-700">
                    {msg.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
