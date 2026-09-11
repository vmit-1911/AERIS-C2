import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Radio, 
  Activity, 
  Shield, 
  ShieldAlert, 
  Volume2, 
  VolumeX, 
  Radar, 
  Wifi, 
  WifiOff, 
  Clock, 
  Maximize2, 
  Minimize2, 
  Compass, 
  Power, 
  Sliders, 
  Terminal, 
  AlertOctagon, 
  RotateCw, 
  Eye, 
  EyeOff, 
  Info 
} from 'lucide-react';

import AttitudeIndicator from './components/AttitudeIndicator';
import FlightHUD from './components/FlightHUD';
import TacticalMap from './components/TacticalMap';
import FlightControls from './components/FlightControls';
import RemoteIdInspector from './components/RemoteIdInspector';
import SurveillanceConsoleModal from './components/SurveillanceConsoleModal';

// Web Audio API Synthesizer for Aerospace Cockpit Sound Effects
class CockpitSoundSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  playBeep(freq = 880, duration = 0.08, type = 'sine', volume = 0.08) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Handled silently
    }
  }

  playCeilingAlarm() {
    if (!this.enabled) return;
    this.playBeep(1200, 0.12, 'sawtooth', 0.12);
    setTimeout(() => this.playBeep(850, 0.12, 'sawtooth', 0.12), 100);
  }

  playClick() {
    this.playBeep(2200, 0.025, 'triangle', 0.05);
  }

  playModeSwitch() {
    this.playBeep(1400, 0.04, 'sine', 0.06);
    setTimeout(() => this.playBeep(1760, 0.04, 'sine', 0.06), 40);
  }
}

const sfx = new CockpitSoundSystem();

export default function App() {
  const [wsUrl, setWsUrl] = useState(`ws://${window.location.hostname || 'localhost'}:8765`);
  const [connected, setConnected] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const [packetCount, setPacketCount] = useState(0);
  const [latencyMs, setLatencyMs] = useState(3);
  const [regulatoryCeiling, setRegulatoryCeiling] = useState(120.0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [nightVision, setNightVision] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSurveillanceModalOpen, setIsSurveillanceModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC');

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const lastAlarmTimeRef = useRef(0);

  // Mission Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Connect WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        sfx.playClick();
        ws.send(JSON.stringify({ type: 'identify', role: 'gcs' }));

        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', client_ts: performance.now() }));
          }
        }, 2000);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.type === 'telemetry' || payload.type === 'init_state') {
            const data = payload.data;
            setTelemetry(data);
            setPacketCount(prev => prev + 1);

            // Ceiling Breach Warning Sound
            if (data.alt_geo_m > regulatoryCeiling) {
              const now = Date.now();
              if (now - lastAlarmTimeRef.current > 3200) {
                sfx.playCeilingAlarm();
                lastAlarmTimeRef.current = now;
              }
            }
          } else if (payload.type === 'pong') {
            const rtt = Math.round(performance.now() - payload.client_ts);
            setLatencyMs(Math.max(1, rtt));
          }
        } catch (err) {
          console.error('Error parsing WS frame:', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
      };

      ws.onerror = () => setConnected(false);
    } catch (e) {
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
    }
  }, [wsUrl, regulatoryCeiling]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [connectWebSocket]);

  // Command Dispatcher
  const sendControl = useCallback((controlData) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'control',
        ...controlData
      }));
      sfx.playClick();
    }
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sfx.enabled = next;
    if (next) sfx.playClick();
  };

  // Telemetry attributes
  const currentAlt = telemetry?.alt_geo_m || 60.0;
  const currentSpeed = telemetry?.speed_horizontal_mps || 12.5;
  const currentHeading = telemetry?.heading_deg || 45.0;
  const currentPitch = telemetry?.pitch_deg || 1.8;
  const currentRoll = telemetry?.roll_deg || 0.0;
  const currentYaw = telemetry?.yaw_deg || currentHeading;
  const uasId = telemetry?.uas_id || 'UIN-IND-2026-X89';
  const transmissionState = telemetry?.transmission_state || 'BROADCASTING';
  const flightMode = telemetry?.flight_mode || 'AUTO_PATROL';

  return (
    <div className={`min-h-screen bg-tactical-950 text-slate-100 flex flex-col justify-between select-none bg-grid-pattern overflow-x-hidden ${
      nightVision ? 'hue-rotate-90 contrast-125' : ''
    }`}>
      {/* Scanline CRT overlay */}
      <div className="fixed inset-0 scanline-overlay pointer-events-none z-30 opacity-40"></div>

      {/* ---------------------------------------------------- */}
      {/* 1. TOP COMMAND HEADER                                */}
      {/* ---------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-tactical-900/95 border-b border-tactical-700/80 px-4 py-2.5 backdrop-blur-xl shadow-2xl flex flex-wrap items-center justify-between gap-2.5">
        {/* Callsign & Airframe Brand */}
        <div className="flex items-center space-x-3.5">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-tactical-850 border border-cyber-cyan/50 text-cyber-cyan shadow-cyan-glow">
            <Radio size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-sm md:text-base font-black tracking-widest text-slate-100 uppercase font-orbitron">
                VIRTUAL DRONE GCS <span className="text-cyber-cyan font-normal">// LAPTOP 1 TRANSMITTER</span>
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/40 rounded-md font-orbitron shadow-cyan-glow">
                ASTM F3411-22a
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center space-x-2">
              <span>UAS ID: <strong className="text-cyber-cyan font-bold">{uasId}</strong></span>
              <span>·</span>
              <span className="text-slate-400 font-medium">MISSION TIME: <strong className="text-slate-200">{currentTime}</strong></span>
            </div>
          </div>
        </div>

        {/* Global Control & Diagnostics Widgets */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          {/* Audio SFX Toggle */}
          <button
            onClick={toggleSound}
            className={`p-2 rounded-lg border transition-all ${
              soundEnabled ? 'bg-tactical-800 border-tactical-600 text-cyber-cyan shadow-cyan-glow' : 'bg-tactical-950 border-tactical-800 text-slate-500'
            }`}
            title="Toggle Cockpit Audio SFX"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Night Vision Mode Toggle */}
          <button
            onClick={() => setNightVision(!nightVision)}
            className={`p-2 rounded-lg border transition-all ${
              nightVision ? 'bg-cyber-green/20 border-cyber-green text-cyber-green shadow-green-glow' : 'bg-tactical-800 border-tactical-700 text-slate-400 hover:text-white'
            }`}
            title="Toggle Night / Thermal Vision Shader"
          >
            {nightVision ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>

          {/* Fullscreen Mode */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg border border-tactical-700 bg-tactical-800 hover:bg-tactical-750 text-slate-300 hover:text-white transition-all hidden md:block"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {/* Surveillance Radar Listener Modal Trigger */}
          <button
            onClick={() => setIsSurveillanceModalOpen(true)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-cyber-cyan/15 hover:bg-cyber-cyan/25 border border-cyber-cyan/50 text-cyber-cyan font-bold text-xs transition-all shadow-cyan-glow active:scale-95 font-orbitron"
          >
            <Radar size={16} className="animate-spin" style={{ animationDuration: '6s' }} />
            <span>SURVEILLANCE RADAR LIVE</span>
          </button>

          {/* WebSocket Server Connection Badge */}
          <div className="flex items-center space-x-2 bg-tactical-950 border border-tactical-750 px-3 py-1.5 rounded-lg font-mono">
            <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-cyber-green animate-pulse shadow-green-glow' : 'bg-cyber-red shadow-red-glow'}`}></div>
            <div className="text-[11px]">
              <span className={connected ? 'text-cyber-green font-bold font-orbitron' : 'text-cyber-red font-bold font-orbitron'}>
                {connected ? 'WS ONLINE' : 'DISCONNECTED'}
              </span>
              <span className="text-slate-400 ml-1.5 hidden md:inline">({latencyMs}ms)</span>
            </div>
          </div>

          {/* Transmission State Pill */}
          <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold font-orbitron flex items-center space-x-2 ${
            transmissionState === 'BROADCASTING'
              ? 'bg-cyber-green/15 border-cyber-green text-cyber-green shadow-green-glow'
              : transmissionState === 'SILENT_DARK'
              ? 'bg-purple-950/80 border-cyber-purple text-cyber-purple shadow-purple-glow'
              : 'bg-amber-950/80 border-cyber-amber text-cyber-amber shadow-amber-glow'
          }`}>
            <span className="w-2 h-2 rounded-full bg-current"></span>
            <span>{transmissionState}</span>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------- */}
      {/* 2. MAIN COCKPIT DASHBOARD GRID                       */}
      {/* ---------------------------------------------------- */}
      <main className="flex-1 p-3.5 grid grid-cols-1 lg:grid-cols-12 gap-3.5 max-w-[1920px] mx-auto w-full">
        {/* COLUMN 1: 3D ATTITUDE DIRECTOR (ADI) & PILOT CONTROLS (4 COLS) */}
        <div className="lg:col-span-4 flex flex-col space-y-3.5">
          <AttitudeIndicator
            pitch={currentPitch}
            roll={currentRoll}
            yaw={currentYaw}
            speed={currentSpeed}
            alt={currentAlt}
          />
          <FlightControls
            onSendControl={sendControl}
            speed={currentSpeed}
            heading={currentHeading}
            alt={currentAlt}
          />
        </div>

        {/* COLUMN 2: TACTICAL RADAR GEO-MAP DISPLAY (4 COLS) */}
        <div className="lg:col-span-4 flex flex-col space-y-3.5">
          <TacticalMap
            telemetry={telemetry}
            onSendWaypoint={(lat, lon) => sendControl({ lat, lon })}
          />
        </div>

        {/* COLUMN 3: PRIMARY FLIGHT DISPLAY (PFD) HUD & ASTM INSPECTOR (4 COLS) */}
        <div className="lg:col-span-4 flex flex-col space-y-3.5">
          <FlightHUD
            telemetry={telemetry}
            regulatoryCeiling={regulatoryCeiling}
          />
          <RemoteIdInspector
            telemetry={telemetry}
            latencyMs={latencyMs}
            packetCount={packetCount}
          />
        </div>
      </main>

      {/* ---------------------------------------------------- */}
      {/* 3. FOOTER AVIONICS STATUS BAR                        */}
      {/* ---------------------------------------------------- */}
      <footer className="bg-tactical-950 border-t border-tactical-800 px-4 py-2 text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2 shadow-xl">
        <div className="flex items-center space-x-4">
          <span>PORT: <strong className="text-slate-200">0.0.0.0:8765</strong></span>
          <span>PROTOCOL: <strong className="text-cyber-cyan font-bold font-orbitron">ASTM F3411-22a</strong></span>
          <span>BROADCAST: <strong className="text-slate-200">2.0 Hz</strong></span>
          <span>PHYSICS RATE: <strong className="text-slate-200">20.0 Hz</strong></span>
        </div>
        <div className="flex items-center space-x-3 text-slate-300">
          <span>DGCA CEILING LIMIT: <strong className="text-cyber-amber font-bold">120m AGL</strong></span>
          <span>·</span>
          <span>AEROSPACE COCKPIT UI V2.0</span>
        </div>
      </footer>

      {/* Surveillance Console Modal */}
      <SurveillanceConsoleModal
        isOpen={isSurveillanceModalOpen}
        onClose={() => setIsSurveillanceModalOpen(false)}
        wsUrl={wsUrl}
      />
    </div>
  );
}
