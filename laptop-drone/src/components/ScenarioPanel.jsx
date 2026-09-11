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
  Terminal, 
  Sparkles 
} from 'lucide-react';

/**
 * Scenario Injection Matrix (Defense Flight Simulation & ASTM Conformance Testing)
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
    <div className="w-full flex flex-col rounded-xl border border-tactical-700/80 bg-tactical-900/90 p-3.5 glass-panel tactical-bracket shadow-2xl font-mono text-slate-200">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-tactical-700/60">
        <div className="flex items-center space-x-2">
          <Terminal size={16} className="text-cyber-cyan" />
          <span className="text-xs font-bold uppercase tracking-widest text-cyber-cyan font-orbitron">
            SCENARIO INJECTION MATRIX
          </span>
        </div>
        <div className="text-[10px] px-2.5 py-0.5 rounded-lg bg-tactical-950 text-cyber-cyan border border-cyber-cyan/30 font-orbitron font-bold">
          TACTICAL INJECTION
        </div>
      </div>

      {/* Grid of 4 Primary Mission Scenarios */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* 1. NORMAL PATROL */}
        <button
          onClick={() => handleScenario('NORMAL_PATROL', 'Normal Cooperative Patrol (60m, Tx ON)')}
          className={`group relative p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
            transmissionState === 'BROADCASTING' && alt <= 120 && uasId === 'UIN-IND-2026-X89'
              ? 'bg-cyber-cyan/15 border-cyber-cyan shadow-cyan-glow'
              : 'bg-tactical-950/80 hover:bg-tactical-850 border-tactical-750 hover:border-cyber-cyan/70'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <ShieldCheck size={20} className="text-cyber-cyan group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold text-cyber-cyan bg-cyber-cyan/15 px-1.5 py-0.5 rounded">01</span>
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
          className={`group relative p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
            alt > 120
              ? 'bg-red-950/80 border-cyber-red shadow-red-glow animate-pulse'
              : 'bg-tactical-950/80 hover:bg-red-950/30 border-tactical-750 hover:border-cyber-red/70'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <AlertTriangle size={20} className="text-cyber-red group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold text-cyber-red bg-cyber-red/15 px-1.5 py-0.5 rounded">02</span>
          </div>
          <div className="font-bold text-xs text-slate-100 font-orbitron group-hover:text-cyber-red">
            BREACH CEILINGS
          </div>
          <div className="text-[10px] text-red-300/80 mt-0.5 leading-tight">
            Climb to 160m (&gt;120m DGCA Limit)
          </div>
        </button>

        {/* 3. CUT TRANSMITTER (GO DARK) */}
        <button
          onClick={() => handleScenario('GO_DARK', 'Cut Transmitter: SILENT_DARK Rogue Stealth')}
          className={`group relative p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
            transmissionState === 'SILENT_DARK'
              ? 'bg-purple-950/80 border-cyber-purple shadow-purple-glow'
              : 'bg-tactical-950/80 hover:bg-purple-950/30 border-tactical-750 hover:border-cyber-purple/70'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <Radio size={20} className="text-cyber-purple group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold text-cyber-purple bg-cyber-purple/15 px-1.5 py-0.5 rounded">03</span>
          </div>
          <div className="font-bold text-xs text-slate-100 font-orbitron group-hover:text-cyber-purple">
            CUT TRANSMITTER
          </div>
          <div className="text-[10px] text-purple-300/80 mt-0.5 leading-tight">
            Go Dark · Silent Stealth Mode
          </div>
        </button>

        {/* 4. SPOOF IDENTITY */}
        <button
          onClick={() => handleScenario('SPOOF_IDENTITY', 'Spoof ID to UNAUTH-DRONE-999')}
          className={`group relative p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
            transmissionState === 'SPOOFED_ID'
              ? 'bg-amber-950/80 border-cyber-amber shadow-amber-glow'
              : 'bg-tactical-950/80 hover:bg-amber-950/30 border-tactical-750 hover:border-cyber-amber/70'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <UserX size={20} className="text-cyber-amber group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold text-cyber-amber bg-cyber-amber/15 px-1.5 py-0.5 rounded">04</span>
          </div>
          <div className="font-bold text-xs text-slate-100 font-orbitron group-hover:text-cyber-amber">
            SPOOF IDENTITY
          </div>
          <div className="text-[10px] text-amber-300/80 mt-0.5 leading-tight">
            Emit as: UNAUTH-DRONE-999
          </div>
        </button>
      </div>

      {/* Tactical Quick Action Deck */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-tactical-700/60 font-orbitron">
        <button
          onClick={() => handleScenario('RTH', 'Engaged Autonomous Return to Home')}
          className="py-2 px-2.5 bg-tactical-950 hover:bg-tactical-850 border border-tactical-750 hover:border-cyber-blue/70 rounded-lg text-xs text-slate-200 flex items-center justify-center space-x-1.5 transition-all shadow-sm active:scale-95"
        >
          <Home size={14} className="text-cyber-blue" />
          <span>RETURN HOME</span>
        </button>

        <button
          onClick={() => handleScenario('LOITER', 'Position Hold (Stationary Hover)')}
          className="py-2 px-2.5 bg-tactical-950 hover:bg-tactical-850 border border-tactical-750 hover:border-cyber-green/70 rounded-lg text-xs text-slate-200 flex items-center justify-center space-x-1.5 transition-all shadow-sm active:scale-95"
        >
          <Anchor size={14} className="text-cyber-green" />
          <span>LOITER HOVER</span>
        </button>

        <button
          onClick={() => handleScenario('EVASION', 'High-speed 26 m/s Evasive Dash')}
          className="py-2 px-2.5 bg-tactical-950 hover:bg-tactical-850 border border-tactical-750 hover:border-cyber-amber/70 rounded-lg text-xs text-slate-200 flex items-center justify-center space-x-1.5 transition-all shadow-sm active:scale-95"
        >
          <Zap size={14} className="text-cyber-amber" />
          <span>EVASION DASH</span>
        </button>
      </div>

      {/* Real-time Acknowledgement Banner */}
      {lastAction && (
        <div className="mt-2.5 p-2 rounded-lg bg-tactical-950/95 border border-cyber-cyan/60 flex items-center justify-between text-xs text-cyber-cyan animate-fadeIn shadow-cyan-glow font-mono">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={15} className="text-cyber-cyan" />
            <span>COMMAND EXECUTED: <strong className="text-white">{lastAction.label}</strong></span>
          </div>
          <span className="text-[10px] text-slate-400">{lastAction.time}</span>
        </div>
      )}
    </div>
  );
}
