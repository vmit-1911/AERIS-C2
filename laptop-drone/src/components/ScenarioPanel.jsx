import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Radio, 
  UserX, 
  Home, 
  Anchor, 
  Zap, 
  CheckCircle2, 
  Terminal 
} from 'lucide-react';

/**
 * Scenario Injection Panel (Critical for Live Demo & Surveillance Testing)
 */
export default function ScenarioPanel({ 
  onInjectScenario, 
  transmissionState, 
  flightMode, 
  uasId, 
  alt 
}) {
  const [lastAction, setLastAction] = useState(null);

  const handleScenario = (scenarioKey, label) => {
    onInjectScenario(scenarioKey);
    setLastAction({
      label,
      time: new Date().toLocaleTimeString(),
      key: scenarioKey
    });
  };

  return (
    <div className="w-full flex flex-col rounded-xl border border-tactical-700 bg-tactical-950/90 p-3 shadow-2xl font-mono text-slate-200">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-tactical-700">
        <div className="flex items-center space-x-2">
          <Terminal size={15} className="text-cyber-cyan" />
          <span className="text-xs font-bold uppercase tracking-widest text-cyber-cyan font-orbitron">
            SCENARIO INJECTION MATRIX
          </span>
        </div>
        <div className="text-[10px] px-2 py-0.5 rounded bg-tactical-800 text-slate-400 border border-tactical-700">
          LIVE DEMO CONTROLS
        </div>
      </div>

      {/* Grid of Scenario Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* 1. NORMAL PATROL */}
        <button
          onClick={() => handleScenario('NORMAL_PATROL', 'Normal Cooperative Patrol (60m, Tx ON)')}
          className={`group relative p-2.5 rounded-lg border text-left transition-all duration-200 flex flex-col justify-between ${
            transmissionState === 'BROADCASTING' && alt <= 120 && uasId === 'UIN-IND-2026-X89'
              ? 'bg-cyber-cyan/15 border-cyber-cyan shadow-cyan-glow'
              : 'bg-tactical-900/80 hover:bg-tactical-800/90 border-tactical-700 hover:border-cyber-cyan/60'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <ShieldCheck size={18} className="text-cyber-cyan group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold text-cyber-cyan bg-cyber-cyan/10 px-1.5 py-0.5 rounded">01</span>
          </div>
          <div className="font-bold text-xs text-slate-100 font-orbitron group-hover:text-cyber-cyan">
            NORMAL PATROL
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
            ID: UIN-IND-X89 · Alt: 60m · Tx: ACTIVE
          </div>
        </button>

        {/* 2. BREACH CEILINGS */}
        <button
          onClick={() => handleScenario('BREACH_CEILINGS', 'Climb to 160m (>120m DGCA Limit)')}
          className={`group relative p-2.5 rounded-lg border text-left transition-all duration-200 flex flex-col justify-between ${
            alt > 120
              ? 'bg-cyber-red/20 border-cyber-red shadow-red-glow animate-pulse'
              : 'bg-tactical-900/80 hover:bg-red-950/40 border-tactical-700 hover:border-cyber-red/70'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <AlertTriangle size={18} className="text-cyber-red group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold text-cyber-red bg-cyber-red/10 px-1.5 py-0.5 rounded">02</span>
          </div>
          <div className="font-bold text-xs text-slate-100 font-orbitron group-hover:text-cyber-red">
            BREACH CEILINGS
          </div>
          <div className="text-[10px] text-red-300/80 mt-0.5 leading-tight">
            Climb to 160m (&gt;120m Ceiling Limit)
          </div>
        </button>

        {/* 3. CUT TRANSMITTER (GO DARK) */}
        <button
          onClick={() => handleScenario('GO_DARK', 'Cut Transmitter: SILENT_DARK Rogue Stealth')}
          className={`group relative p-2.5 rounded-lg border text-left transition-all duration-200 flex flex-col justify-between ${
            transmissionState === 'SILENT_DARK'
              ? 'bg-purple-950/40 border-cyber-purple shadow-lg'
              : 'bg-tactical-900/80 hover:bg-purple-950/30 border-tactical-700 hover:border-cyber-purple/70'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <Radio size={18} className="text-cyber-purple group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold text-cyber-purple bg-cyber-purple/10 px-1.5 py-0.5 rounded">03</span>
          </div>
          <div className="font-bold text-xs text-slate-100 font-orbitron group-hover:text-cyber-purple">
            CUT TRANSMITTER
          </div>
          <div className="text-[10px] text-purple-300/80 mt-0.5 leading-tight">
            Go Dark · Cease External Emissions
          </div>
        </button>

        {/* 4. SPOOF IDENTITY */}
        <button
          onClick={() => handleScenario('SPOOF_IDENTITY', 'Spoof ID to UNAUTH-DRONE-999')}
          className={`group relative p-2.5 rounded-lg border text-left transition-all duration-200 flex flex-col justify-between ${
            transmissionState === 'SPOOFED_ID'
              ? 'bg-amber-950/30 border-cyber-amber shadow-amber-glow'
              : 'bg-tactical-900/80 hover:bg-amber-950/30 border-tactical-700 hover:border-cyber-amber/70'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <UserX size={18} className="text-cyber-amber group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold text-cyber-amber bg-cyber-amber/10 px-1.5 py-0.5 rounded">04</span>
          </div>
          <div className="font-bold text-xs text-slate-100 font-orbitron group-hover:text-cyber-amber">
            SPOOF IDENTITY
          </div>
          <div className="text-[10px] text-amber-300/80 mt-0.5 leading-tight">
            Emit as: UNAUTH-DRONE-999
          </div>
        </button>
      </div>

      {/* Secondary Quick Tactical Actions */}
      <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-tactical-800">
        <button
          onClick={() => handleScenario('RTH', 'Engaged Autonomous Return to Home')}
          className="py-1.5 px-2 bg-tactical-900 hover:bg-tactical-800 border border-tactical-700 hover:border-slate-500 rounded text-xs text-slate-300 flex items-center justify-center space-x-1.5 transition-all"
        >
          <Home size={13} className="text-cyber-blue" />
          <span>RETURN HOME (RTH)</span>
        </button>

        <button
          onClick={() => handleScenario('LOITER', 'Position Hold (Stationary Hover)')}
          className="py-1.5 px-2 bg-tactical-900 hover:bg-tactical-800 border border-tactical-700 hover:border-slate-500 rounded text-xs text-slate-300 flex items-center justify-center space-x-1.5 transition-all"
        >
          <Anchor size={13} className="text-cyber-green" />
          <span>LOITER / HOVER</span>
        </button>

        <button
          onClick={() => handleScenario('EVASION', 'High-speed 26 m/s Evasive Dash')}
          className="py-1.5 px-2 bg-tactical-900 hover:bg-tactical-800 border border-tactical-700 hover:border-slate-500 rounded text-xs text-slate-300 flex items-center justify-center space-x-1.5 transition-all"
        >
          <Zap size={13} className="text-cyber-amber" />
          <span>EVASION DASH (26 m/s)</span>
        </button>
      </div>

      {/* Real-time Scenario Feedback Banner */}
      {lastAction && (
        <div className="mt-2.5 p-2 rounded bg-tactical-900 border border-tactical-700/80 flex items-center justify-between text-xs animate-fadeIn">
          <div className="flex items-center space-x-2 text-cyber-cyan">
            <CheckCircle2 size={14} className="text-cyber-cyan" />
            <span>COMMAND EXECUTED: <strong>{lastAction.label}</strong></span>
          </div>
          <span className="text-[10px] text-slate-500">{lastAction.time}</span>
        </div>
      )}
    </div>
  );
}
