import React, { useState, useEffect } from 'react';
import { Shield, Radio, Camera, FileText, Clock, AlertTriangle, Database, Menu, X } from 'lucide-react';

export default function Header({
  metrics,
  onOpenAuditModal,
  onExportBsaDossier,
  isMobileQueueOpen,
  onToggleMobileQueue
}) {
  const [timeUtc, setTimeUtc] = useState('');
  const [timeIst, setTimeIst] = useState('');

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setTimeUtc(now.toUTCString().split(' ')[4] + ' UTC');
      
      // IST conversion (UTC + 5:30)
      const options = { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' };
      setTimeIst(new Intl.DateTimeFormat('en-IN', options).format(now) + ' IST');
    };
    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-[#0f172a] border-b border-[#1e293b] px-3 md:px-4 flex items-center justify-between text-slate-100 z-30 shadow-lg select-none">
      {/* Left: Branding & District Title */}
      <div className="flex items-center space-x-2 md:space-x-3">
        <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
          <Shield className="w-5 h-5 md:w-6 md:h-6 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-1.5 md:space-x-2">
            <h1 className="font-bold text-xs md:text-base tracking-wider text-cyan-400 uppercase font-mono">
              ARIES-C2
            </h1>
            <span className="hidden sm:inline-block text-[10px] bg-slate-800 text-cyan-300 font-mono px-2 py-0.5 rounded border border-cyan-500/30 font-semibold">
              RULE 24 3D
            </span>
          </div>
          <p className="text-[10px] md:text-xs text-slate-400 font-mono">
            DRONE C2 COMMAND DESK • <span className="text-slate-300 font-semibold">SP_DUTY_DESK_01</span>
          </p>
        </div>
      </div>

      {/* Center: Real-time System Metrics */}
      <div className="hidden lg:flex items-center space-x-6 bg-[#070b14]/70 px-4 py-2 rounded-lg border border-[#1e293b] font-mono text-xs">
        <div className="flex items-center space-x-2">
          <Radio className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-400">DRONE TARGETS:</span>
          <span className="font-bold text-cyan-400 text-sm">{metrics?.total_tracks || 0}</span>
        </div>

        <div className="h-4 w-px bg-slate-800" />

        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-amber-400" />
          <span className="text-slate-400">RULE 24 TRZs:</span>
          <span className="font-bold text-amber-400 text-sm">{metrics?.active_trzs_count || 0}</span>
        </div>

        <div className="h-4 w-px bg-slate-800" />

        <div className="flex items-center space-x-2">
          <AlertTriangle className={`w-4 h-4 ${(metrics?.active_alerts_count || 0) > 0 ? 'text-red-500 animate-bounce' : 'text-slate-500'}`} />
          <span className="text-slate-400">ALERTS:</span>
          <span className={`font-bold text-sm ${(metrics?.active_alerts_count || 0) > 0 ? 'text-red-500' : 'text-slate-300'}`}>
            {metrics?.active_alerts_count || 0}
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800" />

        <div className="flex items-center space-x-2">
          <Camera className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-400">PTZ OPTICAL:</span>
          <span className="font-bold text-emerald-400 text-xs uppercase">
            {metrics?.camera_status || 'ONLINE'}
          </span>
        </div>
      </div>

      {/* Right: Clocks & BSA Export Action + Mobile Menu Toggle */}
      <div className="flex items-center space-x-2 md:space-x-3 font-mono text-xs">
        <div className="hidden xl:flex flex-col items-end text-slate-300 pr-2 border-r border-slate-800">
          <div className="flex items-center space-x-1.5 text-cyan-300 font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>{timeIst}</span>
          </div>
          <span className="text-[10px] text-slate-400">{timeUtc}</span>
        </div>

        <button
          onClick={onOpenAuditModal}
          className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded text-xs font-semibold transition"
          title="View Cryptographic Forensic Ledger"
        >
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">AUDIT LEDGER</span>
        </button>

        <button
          onClick={onExportBsaDossier}
          className="hidden sm:flex items-center space-x-1.5 bg-cyan-500 hover:bg-cyan-400 text-[#070b14] font-bold px-3 py-1.5 rounded text-xs transition shadow-md shadow-cyan-500/20"
          title="Export Section 65B BSA Legal Dossier"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>BSA SEC 65B</span>
        </button>

        {/* Mobile Queue Toggle */}
        <button
          onClick={onToggleMobileQueue}
          className="md:hidden flex items-center space-x-1 bg-red-500/20 border border-red-500/60 text-red-400 px-2.5 py-1.5 rounded text-xs font-bold"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>{metrics?.active_alerts_count || 0}</span>
        </button>
      </div>
    </header>
  );
}

