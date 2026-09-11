import React from 'react';
import { Shield, AlertTriangle, Radio, Navigation, Gauge, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

/**
 * Primary Flight Display (PFD) HUD
 * Featuring airspeed ladder tape, altitude tape with 120m DGCA ceiling, compass ribbon, and VSI.
 */
export default function FlightHUD({ 
  telemetry, 
  regulatoryCeiling = 120.0 
}) {
  const speed = telemetry?.speed_horizontal_mps || 0;
  const vspeed = telemetry?.speed_vertical_mps || 0;
  const alt = telemetry?.alt_geo_m || 0;
  const heading = telemetry?.heading_deg || 0;
  const uasId = telemetry?.uas_id || 'UIN-IND-2026-X89';
  const isCeilingBreached = alt > regulatoryCeiling;
  const isDark = telemetry?.transmission_state === 'SILENT_DARK';
  const isSpoofed = telemetry?.transmission_state === 'SPOOFED_ID';

  // Generate Altitude Tape tick marks (steps of 10m around current altitude)
  const altBase = Math.floor(alt / 10) * 10;
  const altTicks = [];
  for (let i = altBase + 40; i >= Math.max(0, altBase - 40); i -= 10) {
    altTicks.push(i);
  }

  // Generate Speed Tape tick marks (steps of 5 m/s around current speed)
  const speedBase = Math.floor(speed / 5) * 5;
  const speedTicks = [];
  for (let i = speedBase + 20; i >= Math.max(0, speedBase - 20); i -= 5) {
    speedTicks.push(i);
  }

  // Generate Compass Ribbon ticks (360 degrees around current heading)
  const compassTicks = [];
  for (let h = heading - 30; h <= heading + 30; h += 5) {
    const norm = (Math.round(h) + 360) % 360;
    let label = `${norm}°`;
    if (norm === 0 || norm === 360) label = 'N';
    else if (norm === 45) label = 'NE';
    else if (norm === 90) label = 'E';
    else if (norm === 135) label = 'SE';
    else if (norm === 180) label = 'S';
    else if (norm === 225) label = 'SW';
    else if (norm === 270) label = 'W';
    else if (norm === 315) label = 'NW';
    compassTicks.push({ deg: norm, label, isMajor: norm % 45 === 0 });
  }

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-3 rounded-xl border border-tactical-700 bg-tactical-950/90 text-slate-200 overflow-hidden font-mono shadow-2xl">
      {/* Background HUD Grid Scanline */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none"></div>

      {/* ---------------------------------------------------- */}
      {/* TOP: COMPASS RIBBON & CRITICAL ALERT ANNUNCIATORS   */}
      {/* ---------------------------------------------------- */}
      <div className="relative z-10 flex flex-col items-center w-full">
        {/* Urgent Warning Banners */}
        {isCeilingBreached && (
          <div className="w-full mb-2 py-1 px-3 bg-red-950/90 border border-cyber-red rounded flex items-center justify-between text-xs font-bold text-cyber-red animate-pulse shadow-red-glow">
            <div className="flex items-center space-x-2">
              <AlertTriangle size={15} />
              <span>REGULATORY CEILING VIOLATION: {alt.toFixed(1)}m (MAX {regulatoryCeiling}m DGCA)</span>
            </div>
            <span className="bg-cyber-red text-black px-1.5 py-0.5 rounded text-[10px]">ALERT LEVEL 1</span>
          </div>
        )}

        {isDark && (
          <div className="w-full mb-2 py-1 px-3 bg-purple-950/90 border border-cyber-purple rounded flex items-center justify-between text-xs font-bold text-cyber-purple animate-pulse">
            <div className="flex items-center space-x-2">
              <Radio size={15} />
              <span>TRANSMITTER SILENT / STEALTH DARK ACTIVE (EXTERNAL BROADCAST MUTED)</span>
            </div>
            <span className="bg-cyber-purple text-white px-1.5 py-0.5 rounded text-[10px]">NON-COOP</span>
          </div>
        )}

        {isSpoofed && (
          <div className="w-full mb-2 py-1 px-3 bg-amber-950/90 border border-cyber-amber rounded flex items-center justify-between text-xs font-bold text-cyber-amber animate-pulse shadow-amber-glow">
            <div className="flex items-center space-x-2">
              <Shield size={15} />
              <span>SPOOFED IDENTITY BROADCAST: {uasId} (UNREGISTERED DRONE ID)</span>
            </div>
            <span className="bg-cyber-amber text-black px-1.5 py-0.5 rounded text-[10px]">SUSPICIOUS</span>
          </div>
        )}

        {/* Heading Compass Tape */}
        <div className="relative w-full max-w-md h-10 border-b border-cyber-cyan/40 flex items-center justify-center overflow-hidden bg-tactical-900/80 px-2 rounded-t">
          {/* Center Indicator Triangle */}
          <div className="absolute top-0 z-20 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-cyber-cyan"></div>
          
          {/* Compass Ribbon Ticks */}
          <div className="flex items-center space-x-6">
            {compassTicks.map((t, idx) => (
              <div key={idx} className="flex flex-col items-center flex-shrink-0">
                <span className={`text-[11px] font-bold ${t.isMajor ? 'text-cyber-cyan font-orbitron' : 'text-slate-400'}`}>
                  {t.label}
                </span>
                <div className={`w-0.5 ${t.isMajor ? 'h-3 bg-cyber-cyan' : 'h-1.5 bg-slate-500'}`}></div>
              </div>
            ))}
          </div>

          {/* Center Digital Heading Box */}
          <div className="absolute right-2 px-2 py-0.5 bg-tactical-800 border border-cyber-cyan/50 text-cyber-cyan text-xs font-bold rounded">
            HDG: {Math.round(heading).toString().padStart(3, '0')}°
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* MIDDLE: SPEED TAPE (LEFT) & ALTITUDE TAPE (RIGHT)     */}
      {/* ---------------------------------------------------- */}
      <div className="relative z-10 flex items-center justify-between my-2 w-full px-1">
        {/* Left: Speed Ladder Tape */}
        <div className="flex items-center">
          <div className="relative w-16 h-48 border-r border-cyber-cyan/40 bg-tactical-900/70 rounded-l p-1 flex flex-col justify-between overflow-hidden">
            <div className="text-[10px] text-slate-400 font-bold text-center border-b border-tactical-700 pb-0.5">
              SPD m/s
            </div>
            
            <div className="flex flex-col justify-around h-full py-1">
              {speedTicks.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px] px-1">
                  <span className={Math.abs(s - speed) < 3 ? 'text-cyber-cyan font-bold' : 'text-slate-500'}>
                    {s}
                  </span>
                  <div className="w-2 h-0.5 bg-slate-600"></div>
                </div>
              ))}
            </div>

            {/* Current Speed Bug Box */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 py-1 bg-cyber-cyan/20 border-y border-cyber-cyan text-cyber-cyan text-center font-bold text-sm shadow-cyan-glow">
              {speed.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Center: Flight Vector / Crosshair info */}
        <div className="flex flex-col items-center justify-center space-y-2 text-center opacity-85">
          <div className="text-[11px] text-slate-400 font-semibold tracking-widest uppercase">
            TARGET TRACK
          </div>
          <div className="text-xl font-bold font-orbitron text-cyber-cyan">
            {speed > 0.5 ? `${(speed * 3.6).toFixed(1)} km/h` : 'STATIONARY'}
          </div>
          <div className="flex items-center space-x-2 text-xs text-slate-300">
            <span>V/S:</span>
            <span className={`font-bold flex items-center ${vspeed > 0.1 ? 'text-cyber-green' : vspeed < -0.1 ? 'text-cyber-amber' : 'text-slate-400'}`}>
              {vspeed > 0.1 ? <ArrowUpRight size={14} className="mr-0.5" /> : vspeed < -0.1 ? <ArrowDownRight size={14} className="mr-0.5" /> : null}
              {vspeed > 0 ? `+${vspeed.toFixed(1)}` : vspeed.toFixed(1)} m/s
            </span>
          </div>
          
          <div className="px-2.5 py-1 rounded bg-tactical-800/90 border border-tactical-600 text-[11px] font-mono text-slate-300">
            LOC: {telemetry?.lat?.toFixed(5)}, {telemetry?.lon?.toFixed(5)}
          </div>
        </div>

        {/* Right: Altitude Ladder Tape */}
        <div className="flex items-center">
          <div className="relative w-18 h-48 border-l border-cyber-cyan/40 bg-tactical-900/70 rounded-r p-1 flex flex-col justify-between overflow-hidden">
            <div className="text-[10px] text-slate-400 font-bold text-center border-b border-tactical-700 pb-0.5">
              ALT (m)
            </div>

            <div className="flex flex-col justify-around h-full py-1">
              {altTicks.map((a, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px] px-1">
                  <div className={`w-2 h-0.5 ${a >= regulatoryCeiling ? 'bg-cyber-red' : 'bg-slate-600'}`}></div>
                  <span className={`font-mono ${a >= regulatoryCeiling ? 'text-cyber-red font-bold' : Math.abs(a - alt) < 5 ? 'text-cyber-cyan font-bold' : 'text-slate-500'}`}>
                    {a}
                  </span>
                </div>
              ))}
            </div>

            {/* Regulatory Ceiling Limit line at 120m */}
            <div className="absolute right-0 top-6 text-[9px] bg-red-900/80 text-red-300 px-1 border-r-2 border-cyber-red">
              120m CEILING
            </div>

            {/* Current Altitude Bug Box */}
            <div className={`absolute top-1/2 -translate-y-1/2 left-0 right-0 py-1 border-y text-center font-bold text-sm ${isCeilingBreached ? 'bg-red-950/80 border-cyber-red text-cyber-red shadow-red-glow' : 'bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan shadow-cyan-glow'}`}>
              {alt.toFixed(1)}m
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* BOTTOM: TELEMETRY QUICK READOUTS & STATUS BADGES    */}
      {/* ---------------------------------------------------- */}
      <div className="relative z-10 w-full grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-tactical-700/80 text-xs">
        <div className="bg-tactical-900/80 p-1.5 rounded border border-tactical-700">
          <div className="text-[10px] text-slate-400">FLIGHT MODE</div>
          <div className="font-bold text-cyber-cyan font-orbitron">
            {telemetry?.flight_mode || 'AUTO_PATROL'}
          </div>
        </div>

        <div className="bg-tactical-900/80 p-1.5 rounded border border-tactical-700">
          <div className="text-[10px] text-slate-400">BATTERY (V/%)</div>
          <div className={`font-bold ${(telemetry?.battery_percent || 100) < 20 ? 'text-cyber-red' : 'text-cyber-green'}`}>
            {telemetry?.battery_percent?.toFixed(1) || '96.0'}% / 22.4V
          </div>
        </div>

        <div className="bg-tactical-900/80 p-1.5 rounded border border-tactical-700">
          <div className="text-[10px] text-slate-400">GNSS LOCK</div>
          <div className="font-bold text-cyber-cyan">
            {telemetry?.gps_satellites || 18} SVs (3D RTK)
          </div>
        </div>

        <div className="bg-tactical-900/80 p-1.5 rounded border border-tactical-700">
          <div className="text-[10px] text-slate-400">LINK RSSI</div>
          <div className={`font-bold ${(telemetry?.rssi_dbm || -45) < -75 ? 'text-cyber-amber' : 'text-cyber-green'}`}>
            {telemetry?.rssi_dbm || -45} dBm
          </div>
        </div>
      </div>
    </div>
  );
}
