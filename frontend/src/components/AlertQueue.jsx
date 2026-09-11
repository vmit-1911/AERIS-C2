import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, Crosshair, Navigation, CheckCircle, ShieldX, Radio, Send, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function AlertQueue({
  activeAlerts,
  onCenterTarget,
  onAlertDisposition,
  isMobileQueueOpen,
  setIsMobileQueueOpen
}) {
  const [dismissModalTarget, setDismissModalTarget] = useState(null);
  const [dismissReason, setDismissReason] = useState('Authorized Emergency Flight Clearance');

  const handleAction = (alert, actionType) => {
    if (actionType === 'DISMISS_FALSE_ALARM') {
      setDismissModalTarget(alert);
      return;
    }

    onAlertDisposition({
      operator_id: 'SP_DUTY_DESK_01',
      uas_id: alert.uas_id,
      event_type: alert.status,
      action_taken: actionType,
      reason_code: actionType === 'DISPATCH_QRT' 
        ? 'Sector 4 QRT Vector Dispatched to Ground Controller Location' 
        : 'Escalated to State Police Airspace Command Center',
      snapshot_data: alert
    });
  };

  const submitDismissal = () => {
    if (!dismissModalTarget) return;
    onAlertDisposition({
      operator_id: 'SP_DUTY_DESK_01',
      uas_id: dismissModalTarget.uas_id,
      event_type: dismissModalTarget.status,
      action_taken: 'DISMISS_FALSE_ALARM',
      reason_code: dismissReason,
      snapshot_data: dismissModalTarget
    });
    setDismissModalTarget(null);
  };

  return (
    <div
      className={`bg-[#0f172a] border-t md:border-t-0 md:border-l border-[#1e293b] flex flex-col z-20 font-mono select-none transition-all duration-300 ${
        isMobileQueueOpen
          ? 'fixed inset-x-0 bottom-0 top-16 md:relative md:top-0 md:w-96 md:h-full'
          : 'w-full md:w-96 h-12 md:h-full overflow-hidden'
      }`}
    >
      {/* Sidebar Header & Mobile Drag Handle Bar */}
      <div
        onClick={() => setIsMobileQueueOpen && setIsMobileQueueOpen(!isMobileQueueOpen)}
        className="p-3 md:p-4 border-b border-[#1e293b] flex items-center justify-between bg-[#070b14]/50 cursor-pointer md:cursor-default"
      >
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
          <h2 className="font-bold text-xs md:text-sm text-slate-100 uppercase tracking-wider">
            DRONE INCURSION QUEUE
          </h2>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/40 px-2 py-0.5 rounded font-bold">
            {activeAlerts?.length || 0} ACTIVE
          </span>
          <button className="md:hidden text-slate-400">
            {isMobileQueueOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Alert Feed List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {(!activeAlerts || activeAlerts.length === 0) ? (
          <div className="text-center py-12 text-slate-500 space-y-2">
            <CheckCircle className="w-10 h-10 mx-auto text-emerald-500/60" />
            <p className="text-xs">SECTOR DRONE ZONE CLEAR</p>
            <p className="text-[10px] text-slate-600">Zero Rule 24 TRZ breaches or dark targets detected.</p>
          </div>
        ) : (
          activeAlerts.map(alert => {
            const tel = alert.telemetry || {};
            const intercept = alert.intercept_vector || {};
            const isTriaged = !!alert.disposition;

            let priorityBg = 'bg-red-500/20 border-red-500 text-red-400';
            if (alert.priority === 'HIGH') priorityBg = 'bg-amber-500/20 border-amber-500 text-amber-400';
            if (alert.priority === 'MEDIUM') priorityBg = 'bg-yellow-500/20 border-yellow-500 text-yellow-400';

            return (
              <div
                key={alert.uas_id}
                className={`bg-[#070b14] border rounded-xl p-3 shadow-lg transition-all ${
                  isTriaged ? 'border-slate-800 opacity-60' : 'border-red-500/60 pulse-crimson'
                }`}
              >
                {/* Priority & Status Header */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${priorityBg}`}>
                    {alert.priority}: {alert.status}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {alert.first_detected ? alert.first_detected.substring(11, 19) : ''}
                  </span>
                </div>

                {/* Target Identity */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <div>
                    <div className="font-bold text-sm text-slate-100 flex items-center space-x-1.5">
                      <span>{alert.uas_id}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      ALT: <b className="text-cyan-400">{tel.alt_m ? tel.alt_m.toFixed(1) : 0}m AMSL</b> | SPD: <b className="text-cyan-400">{tel.speed_mps ? tel.speed_mps.toFixed(1) : 0} m/s</b>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onCenterTarget({ lat: tel.lat, lon: tel.lon }, alert.uas_id);
                      if (setIsMobileQueueOpen) setIsMobileQueueOpen(false);
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-cyan-500 hover:text-[#070b14] text-cyan-400 rounded transition"
                    title="Center Map & Track Target"
                  >
                    <Crosshair className="w-4 h-4" />
                  </button>
                </div>

                {/* Pilot Ground Station Location & Trace Button */}
                <div className="bg-[#0f172a] p-2 rounded border border-slate-800 mb-2 text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center space-x-1">
                      <Navigation className="w-3 h-3 text-red-400" />
                      <span>PILOT LAUNCH ORIGIN:</span>
                    </span>
                    <button
                      onClick={() => {
                        onCenterTarget({ lat: tel.pilot_lat || intercept.pilot_lat, lon: tel.pilot_lon || intercept.pilot_lon });
                        if (setIsMobileQueueOpen) setIsMobileQueueOpen(false);
                      }}
                      className="text-[10px] text-cyan-400 hover:underline font-bold"
                    >
                      TRACE LAUNCH PIN
                    </button>
                  </div>
                  <div className="font-mono text-slate-200 text-[10px]">
                    LAT: <b>{(tel.pilot_lat || intercept.pilot_lat || 0).toFixed(4)}</b> | LON: <b>{(tel.pilot_lon || intercept.pilot_lon || 0).toFixed(4)}</b>
                  </div>
                </div>

                {/* Duty Officer SOP Action Card */}
                <div className="bg-red-950/30 border border-red-500/30 p-2.5 rounded-lg mb-3 text-[11px] text-red-200 leading-relaxed">
                  <div className="font-bold text-[10px] text-red-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    <span>DUTY OFFICER SOP DIRECTIVE:</span>
                  </div>
                  {alert.sop_instruction}
                </div>

                {/* Triaged Status or One-Click Action Buttons */}
                {isTriaged ? (
                  <div className="bg-slate-800/80 border border-slate-700 p-2 rounded text-center text-xs text-emerald-400 font-bold">
                    ✅ DISPOSITION RECORDED: {alert.disposition}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button
                      onClick={() => handleAction(alert, 'DISPATCH_QRT')}
                      className="bg-red-600 hover:bg-red-500 text-white py-1.5 px-1 rounded text-[10px] font-bold transition flex items-center justify-center space-x-1 shadow-md shadow-red-600/20"
                    >
                      <Send className="w-3 h-3" />
                      <span>DISPATCH QRT</span>
                    </button>

                    <button
                      onClick={() => handleAction(alert, 'LOG_AND_ESCALATE')}
                      className="bg-amber-600 hover:bg-amber-500 text-white py-1.5 px-1 rounded text-[10px] font-bold transition flex items-center justify-center space-x-1"
                    >
                      <ShieldX className="w-3 h-3" />
                      <span>ESCALATE</span>
                    </button>

                    <button
                      onClick={() => handleAction(alert, 'DISMISS_FALSE_ALARM')}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-1 rounded text-[10px] font-semibold transition"
                    >
                      DISMISS
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Mandatory Reason Modal for Alert Dismissal */}
      {dismissModalTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-5 w-96 shadow-2xl text-slate-100 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <h3 className="font-bold text-sm text-amber-400">DISMISS ALERT REASON CODE</h3>
              <button onClick={() => setDismissModalTarget(null)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Mandatory under Section 65B BSA compliance. State rationale for dismissing alert on <b className="text-white">{dismissModalTarget.uas_id}</b>.
            </p>

            <select
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              className="w-full bg-[#070b14] border border-slate-700 rounded p-2 text-xs text-slate-100 mb-4"
            >
              <option value="Authorized Emergency Medical Flight">Authorized Emergency Medical Flight</option>
              <option value="Registered Disaster Management Survey">Registered Disaster Management Survey</option>
              <option value="Confirmed Authorized Law Enforcement Test">Confirmed Authorized Law Enforcement Test</option>
              <option value="Sensor False Positive / Duplicate Track">Sensor False Positive / Duplicate Track</option>
            </select>

            <div className="flex space-x-2">
              <button
                onClick={() => setDismissModalTarget(null)}
                className="w-1/2 bg-slate-800 hover:bg-slate-700 py-2 rounded text-xs font-semibold"
              >
                CANCEL
              </button>
              <button
                onClick={submitDismissal}
                className="w-1/2 bg-amber-500 hover:bg-amber-400 text-black font-bold py-2 rounded text-xs"
              >
                CONFIRM LOG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

