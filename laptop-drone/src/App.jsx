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
  Compass, 
  Power, 
  Sliders, 
  Terminal, 
  AlertOctagon, 
  RotateCw 
} from 'lucide-react';

import AttitudeIndicator from './components/AttitudeIndicator';
import FlightHUD from './components/FlightHUD';
import TacticalMap from './components/TacticalMap';
import ScenarioPanel from './components/ScenarioPanel';
import FlightControls from './components/FlightControls';
import RemoteIdInspector from './components/RemoteIdInspector';
import SurveillanceConsoleModal from './components/SurveillanceConsoleModal';

// Web Audio API Synthesizer for Tactical Cockpit SFX
class SoundEffects {
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

  playBeep(freq = 880, duration = 0.08, type = 'sine') {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio might be blocked by browser policy until interaction
    }
  }

  playAlarm() {
    if (!this.enabled) return;
    this.playBeep(1200, 0.15, 'sawtooth');
    setTimeout(() => this.playBeep(900, 0.15, 'sawtooth'), 120);
  }

  playClick() {
    this.playBeep(1800, 0.03, 'triangle');
  }
}

const sfx = new SoundEffects();

export default function App() {
  // WebSocket and Telemetry State
  const [wsUrl, setWsUrl] = useState(`ws://${window.location.hostname || 'localhost'}:8765`);
  const [connected, setConnected] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const [packetCount, setPacketCount] = useState(0);
  const [latencyMs, setLatencyMs] = useState(3);
  const [regulatoryCeiling, setRegulatoryCeiling] = useState(120.0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSurveillanceModalOpen, setIsSurveillanceModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toUTCString());

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const lastAlarmTimeRef = useRef(0);

  // Update Mission Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
        // Register client role as GCS
        ws.send(JSON.stringify({ type: 'identify', role: 'gcs' }));

        // Ping every 2 seconds for latency
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

            // Audio Alert if Ceiling Breached
            if (data.alt_geo_m > regulatoryCeiling) {
              const now = Date.now();
              if (now - lastAlarmTimeRef.current > 3000) {
                sfx.playAlarm();
                lastAlarmTimeRef.current = now;
              }
            }
          } else if (payload.type === 'pong') {
            const rtt = Math.round(performance.now() - payload.client_ts);
            setLatencyMs(Math.max(1, rtt));
          } else if (payload.type === 'scenario_feedback') {
            sfx.playClick();
          }
        } catch (err) {
          console.error('Error parsing WS frame:', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        // Automatic reconnection attempt
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
      };

      ws.onerror = () => {
        setConnected(false);
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
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

  // Command Send Handlers
  const sendControl = useCallback((controlData) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'control',
        ...controlData
      }));
      sfx.playClick();
    }
  }, []);

  const injectScenario = useCallback((scenarioKey) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'set_scenario',
        scenario: scenarioKey
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

  // Fallback telemetry defaults when connecting
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
    <div className="min-h-screen bg-tactical-950 text-slate-100 flex flex-col justify-between font-mono select-none bg-grid-pattern overflow-x-hidden">
      {/* ---------------------------------------------------- */}
      {/* TOP COMMAND HEADER                                   */}
      {/* ---------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-tactical-900/95 border-b border-tactical-700/90 px-4 py-2.5 backdrop-blur-md shadow-2xl flex flex-wrap items-center justify-between gap-2">
        {/* Callsign & Mission Brand */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-tactical-800 border border-cyber-cyan/40 text-cyber-cyan shadow-cyan-glow">
            <Radio size={18} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-black tracking-widest text-slate-100 uppercase font-orbitron">
                VIRTUAL DRONE GCS <span className="text-cyber-cyan font-normal">// LAPTOP 1 TRANSMITTER</span>
              </h1>
              <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/40 rounded font-bold">
                ASTM F3411-22a COMPLIANT
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center space-x-2">
              <span>UAS ID: <strong className="text-cyber-cyan font-bold">{uasId}</strong></span>
              <span>·</span>
              <span className="text-slate-400">MISSION CLOCK: {currentTime}</span>
            </div>
          </div>
        </div>

        {/* Global Action & Link Status Widgets */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={`p-1.5 rounded border transition-all ${
              soundEnabled ? 'bg-tactical-800 border-tactical-600 text-cyber-cyan' : 'bg-tactical-900 border-tactical-800 text-slate-600'
            }`}
            title="Toggle Cockpit Audio SFX"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Surveillance Radar Listener Simulator Modal Button */}
          <button
            onClick={() => setIsSurveillanceModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyber-cyan/10 hover:bg-cyber-cyan/20 border border-cyber-cyan/40 text-cyber-cyan font-bold text-xs transition-all shadow-sm active:scale-95 font-orbitron"
          >
            <Radar size={15} className="animate-spin" style={{ animationDuration: '8s' }} />
            <span>SURVEILLANCE RADAR LIVE</span>
          </button>

          {/* WebSocket Server Connection Badge */}
          <div className="flex items-center space-x-2 bg-tactical-900 border border-tactical-700 px-2.5 py-1 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-cyber-green animate-pulse' : 'bg-cyber-red'}`}></div>
            <div className="text-[11px]">
              <span className={connected ? 'text-cyber-green font-bold' : 'text-cyber-red font-bold'}>
                {connected ? 'WS LINKED' : 'OFFLINE'}
              </span>
              <span className="text-slate-500 ml-1.5 hidden md:inline">({latencyMs}ms)</span>
            </div>
          </div>

          {/* Transmission Mode Indicator */}
          <div className={`px-2.5 py-1 rounded-lg border text-xs font-bold font-orbitron flex items-center space-x-1.5 ${
            transmissionState === 'BROADCASTING'
              ? 'bg-cyber-green/15 border-cyber-green text-cyber-green shadow-green-glow'
              : transmissionState === 'SILENT_DARK'
              ? 'bg-purple-950/60 border-cyber-purple text-cyber-purple'
              : 'bg-amber-950/60 border-cyber-amber text-cyber-amber shadow-amber-glow'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            <span>{transmissionState}</span>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------- */}
      {/* MAIN COCKPIT DASHBOARD GRID                          */}
      {/* ---------------------------------------------------- */}
      <main className="flex-1 p-3 grid grid-cols-1 lg:grid-cols-12 gap-3 max-w-[1920px] mx-auto w-full">
        {/* COLUMN 1: 3D ATTITUDE DIRECTOR (ADI) & PILOT CONTROLS (4 COLS) */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
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

        {/* COLUMN 2: PRIMARY FLIGHT DISPLAY (PFD) HUD & SCENARIO MATRIX (4 COLS) */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          <FlightHUD
            telemetry={telemetry}
            regulatoryCeiling={regulatoryCeiling}
          />
          <ScenarioPanel
            onInjectScenario={injectScenario}
            transmissionState={transmissionState}
            flightMode={flightMode}
            uasId={uasId}
            alt={currentAlt}
          />
        </div>

        {/* COLUMN 3: TACTICAL RADAR MAP & ASTM PROTOCOL INSPECTOR (4 COLS) */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          <TacticalMap
            telemetry={telemetry}
            onSendWaypoint={(lat, lon) => sendControl({ lat, lon })}
          />
          <RemoteIdInspector
            telemetry={telemetry}
            latencyMs={latencyMs}
            packetCount={packetCount}
          />
        </div>
      </main>

      {/* ---------------------------------------------------- */}
      {/* FOOTER AVIONICS STATUS BAR                           */}
      {/* ---------------------------------------------------- */}
      <footer className="bg-tactical-950 border-t border-tactical-800 px-4 py-1.5 text-[11px] text-slate-500 flex flex-wrap items-center justify-between">
        <div className="flex items-center space-x-4">
          <span>PORT: <strong className="text-slate-300">0.0.0.0:8765</strong></span>
          <span>PROTOCOL: <strong className="text-cyber-cyan">ASTM F3411-22a</strong></span>
          <span>BROADCAST FREQ: <strong className="text-slate-300">2.0 Hz</strong></span>
          <span>KINEMATICS: <strong className="text-slate-300">20.0 Hz</strong></span>
        </div>
        <div className="flex items-center space-x-3 text-slate-400">
          <span>DGCA REGULATORY ALTITUDE LIMIT: <strong className="text-cyber-amber">120m AGL</strong></span>
          <span>·</span>
          <span>COCKPIT CLIENT V1.0</span>
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
