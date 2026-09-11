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
 * External Surveillance Radar Listener Modal
 * Emulates an external passive radio monitoring station (Air Traffic / Police Radar)
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

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
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
              ...prev.slice(0, 49)
            ]);
          }
        } catch (e) {
          console.error(e);
        }
      };

      socket.onclose = () => setIsConnected(false);
      socket.onerror = () => setIsConnected(false);
    } catch (err) {
      console.error(err);
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (signalTimerRef.current) clearInterval(signalTimerRef.current);
    };
  }, [isOpen, wsUrl]);

  // Signal drop detection
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl h-[640px] flex flex-col rounded-2xl border border-tactical-600 bg-tactical-950 p-5 shadow-2xl font-mono text-slate-200 glass-panel tactical-bracket">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-tactical-700/80">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-cyber-cyan/15 border border-cyber-cyan/40 text-cyber-cyan shadow-cyan-glow">
              <Radar className="animate-spin" style={{ animationDuration: '6s' }} size={22} />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-widest text-slate-100 uppercase font-orbitron">
                EXTERNAL SURVEILLANCE RADAR SINK
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Independent Air Traffic Telemetry Listener at <code className="text-cyber-cyan">{wsUrl}</code>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className={`px-3 py-1 rounded-lg text-xs font-bold font-orbitron border flex items-center space-x-1.5 ${
              isConnected ? 'bg-cyber-green/15 border-cyber-green text-cyber-green shadow-green-glow' : 'bg-red-950 border-red-500 text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-cyber-green animate-pulse' : 'bg-red-500'}`}></div>
              <span>{isConnected ? 'RF STREAM ONLINE' : 'DISCONNECTED'}</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-tactical-900 hover:bg-tactical-800 border border-tactical-700 text-slate-400 hover:text-white transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Dynamic Threat & Annunciator Banners */}
        {isSignalLost ? (
          <div className="mb-3.5 p-3 rounded-xl bg-purple-950/90 border border-cyber-purple text-cyber-purple flex items-center justify-between animate-pulse shadow-purple-glow">
            <div className="flex items-center space-x-3">
              <WifiOff size={22} />
              <div>
                <strong className="block text-xs uppercase font-orbitron">CRITICAL: REMOTE ID TRANSMITTER SILENCED (SIGNAL LOST)</strong>
                <span className="text-[11px] text-purple-300">
                  Target airframe ceased ASTM F3411 broadcast emissions (Stealth Dark Evasion active).
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-cyber-purple text-black font-black text-xs rounded-lg font-orbitron">
              STEALTH ROGUE
            </span>
          </div>
        ) : isBreached ? (
          <div className="mb-3.5 p-3 rounded-xl bg-red-950/90 border border-cyber-red text-cyber-red flex items-center justify-between animate-pulse shadow-red-glow">
            <div className="flex items-center space-x-3">
              <AlertTriangle size={22} />
              <div>
                <strong className="block text-xs uppercase font-orbitron">AIRSPACE REGULATORY CEILING VIOLATION DETECTED</strong>
                <span className="text-[11px] text-red-300">
                  Drone {currentPacket?.uas_id} operating at {currentPacket?.alt_geo_m?.toFixed(1)}m AGL (Exceeds 120m DGCA limit).
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-cyber-red text-black font-black text-xs rounded-lg font-orbitron">
              CEILING BREACH
            </span>
          </div>
        ) : isSpoofed ? (
          <div className="mb-3.5 p-3 rounded-xl bg-amber-950/90 border border-cyber-amber text-cyber-amber flex items-center justify-between animate-pulse shadow-amber-glow">
            <div className="flex items-center space-x-3">
              <ShieldAlert size={22} />
              <div>
                <strong className="block text-xs uppercase font-orbitron">SECURITY ALERT: UNREGISTERED UAS DETECTED</strong>
                <span className="text-[11px] text-amber-300">
                  UAS ID "{currentPacket?.uas_id}" not found in DGCA Registry database.
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-cyber-amber text-black font-black text-xs rounded-lg font-orbitron">
              SPOOFED ID
            </span>
          </div>
        ) : (
          <div className="mb-3.5 p-3 rounded-xl bg-emerald-950/40 border border-cyber-green text-cyber-green flex items-center justify-between text-xs font-mono shadow-green-glow">
            <div className="flex items-center space-x-2.5">
              <ShieldCheck size={20} />
              <span className="font-semibold">COOPERATIVE UAS BROADCASTING NORMAL DIRECT REMOTE ID TELEMETRY</span>
            </div>
            <span className="text-[11px] text-slate-300 font-bold bg-emerald-900/60 px-2 py-0.5 rounded">
              DGCA REGISTRY VALID
            </span>
          </div>
        )}

        {/* Live Target Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3.5">
          <div className="bg-tactical-900/90 border border-tactical-750 p-3 rounded-xl">
            <div className="text-[10px] text-slate-400 font-semibold">INTERCEPTED UAS ID</div>
            <div className={`text-base font-black font-orbitron ${isSpoofed ? 'text-cyber-amber' : 'text-cyber-cyan'}`}>
              {isSignalLost ? `${currentPacket?.uas_id || 'UNKNOWN'} (LAST KNOWN)` : currentPacket?.uas_id || 'SCANNING...'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">CATEGORY: {currentPacket?.ua_type || 'Aeroplane/Multirotor'}</div>
          </div>

          <div className="bg-tactical-900/90 border border-tactical-750 p-3 rounded-xl">
            <div className="text-[10px] text-slate-400 font-semibold">SURVEILLANCE RADAR ALTITUDE</div>
            <div className={`text-base font-black font-mono ${isBreached ? 'text-cyber-red' : 'text-cyber-cyan'}`}>
              {currentPacket?.alt_geo_m?.toFixed(1) || '0.0'} m AGL
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">MAX AUTHORIZED: 120.0 m AGL</div>
          </div>

          <div className="bg-tactical-900/90 border border-tactical-750 p-3 rounded-xl">
            <div className="text-[10px] text-slate-400 font-semibold">RADAR GROUND VECTOR</div>
            <div className="text-base font-black text-slate-100 font-mono">
              {(currentPacket?.speed_horizontal_mps || 0).toFixed(1)} m/s @ {Math.round(currentPacket?.heading_deg || 0)}°
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">GPS: {currentPacket?.lat?.toFixed(4)}, {currentPacket?.lon?.toFixed(4)}</div>
          </div>
        </div>

        {/* Live Packet Log Stream */}
        <div className="flex-1 flex flex-col overflow-hidden bg-tactical-900/90 border border-tactical-750 rounded-xl p-3">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-tactical-800 text-[11px] text-slate-400 font-orbitron font-bold">
            <div className="flex items-center space-x-2 text-cyber-cyan">
              <Terminal size={14} className="text-cyber-cyan" />
              <span>INTERCEPTED ASTM F3411 PACKET STREAM</span>
            </div>
            <span>LOGGED FRAMES: {messages.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[11px] pr-1">
            {messages.length === 0 ? (
              <div className="text-center text-slate-500 py-12">Listening for incoming Direct Remote ID broadcast packets...</div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="flex items-center justify-between p-2 rounded-lg bg-tactical-950/80 border border-tactical-800 hover:border-slate-600 transition-colors">
                  <div className="flex items-center space-x-3.5">
                    <span className="text-slate-500 text-[10px]">{msg.time}</span>
                    <span className="font-bold text-cyber-cyan font-mono">{msg.uas_id}</span>
                    <span className={msg.alt > 120 ? 'text-cyber-red font-bold font-mono' : 'text-slate-300 font-mono'}>
                      {msg.alt.toFixed(1)}m
                    </span>
                    <span className="text-slate-400 font-mono">{msg.speed.toFixed(1)}m/s</span>
                  </div>
                  <div className="text-[10px] text-slate-300 bg-tactical-900 px-2 py-0.5 rounded border border-tactical-700 font-orbitron">
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
