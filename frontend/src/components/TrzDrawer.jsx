import React, { useState } from 'react';
import { Shield, Plus, X, Check, Sliders, AlertOctagon } from 'lucide-react';

export default function TrzDrawer({
  isDrawMode,
  setIsDrawMode,
  drawPoints,
  onClearPoints,
  onCreateTrz
}) {
  const [name, setName] = useState('SP_TEMPORARY_RED_ZONE_02');
  const [ceilingAlt, setCeilingAlt] = useState(120);
  const [durationHours, setDurationHours] = useState(24);
  const [reason, setReason] = useState('VIP Convoy Security Protocol under Rule 24 Drone Rules 2021');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (drawPoints.length < 3) {
      alert('Please click at least 3 or 4 points on the map to define the perimeter.');
      return;
    }

    // Convert draw points [[lng, lat]] and ensure closed ring
    const coords = drawPoints.map(pt => [pt.lng, pt.lat]);
    if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
      coords.push(coords[0]);
    }

    onCreateTrz({
      name,
      declared_by: 'SUPERINTENDENT_OF_POLICE_CHQ',
      floor_m: 0.0,
      ceiling_m: parseFloat(ceilingAlt),
      duration_hours: parseFloat(durationHours),
      coordinates: coords,
      reason
    });
  };

  return (
    <div className="absolute top-4 left-4 z-20 font-mono text-xs">
      {!isDrawMode ? (
        <button
          onClick={() => setIsDrawMode(true)}
          className="flex items-center space-x-2 bg-[#0f172a] hover:bg-[#1e293b] text-red-400 border border-red-500/40 px-4 py-2.5 rounded-lg shadow-xl font-bold transition hover:shadow-red-500/10"
        >
          <AlertOctagon className="w-4 h-4 text-red-500 animate-pulse" />
          <span>ENACT RULE 24 TRZ (DRAW)</span>
        </button>
      ) : (
        <div className="bg-[#0f172a]/95 border border-red-500/50 rounded-xl p-4 w-80 shadow-2xl backdrop-blur-md text-slate-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center space-x-2 text-red-400 font-bold">
              <Shield className="w-4 h-4" />
              <span>DECLARE RULE 24 TRZ</span>
            </div>
            <button
              onClick={() => {
                setIsDrawMode(false);
                onClearPoints();
              }}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-red-500/10 border border-red-500/30 p-2 rounded mb-3 text-[11px] text-red-300">
            {drawPoints.length === 0 ? (
              <span>👆 Click 4 points on map to set perimeter polygon.</span>
            ) : (
              <span>Points defined: <b className="text-white">{drawPoints.length}</b>. Keep clicking or submit below.</span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Zone Identifier</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                required
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>VERTICAL CEILING</span>
                <span className="text-cyan-400 font-bold">{ceilingAlt} m AMSL</span>
              </div>
              <input
                type="range"
                min="30"
                max="300"
                step="10"
                value={ceilingAlt}
                onChange={(e) => setCeilingAlt(e.target.value)}
                className="w-full accent-cyan-400"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Duration (Rule 24 Max 48h)</label>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono"
              >
                <option value="1">1 Hour (Tactical Emergency)</option>
                <option value="12">12 Hours (Half-Day Protocol)</option>
                <option value="24">24 Hours (Standard VIP Convoy)</option>
                <option value="48">48 Hours (Maximum Permissible)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Tactical Rationale / SP Order</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono resize-none"
                required
              />
            </div>

            <div className="flex space-x-2 pt-1">
              <button
                type="button"
                onClick={onClearPoints}
                className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded text-xs font-semibold"
              >
                CLEAR
              </button>
              <button
                type="submit"
                disabled={drawPoints.length < 3}
                className="w-2/3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-2 rounded text-xs transition shadow-lg shadow-red-600/30"
              >
                ENACT TRZ NOW
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
