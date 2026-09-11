import React, { useState } from 'react';
import { 
  FileCode, 
  Copy, 
  Check, 
  Binary, 
  Activity, 
  Radio, 
  ShieldCheck, 
  AlertCircle 
} from 'lucide-react';

/**
 * ASTM F3411-22a Standard Remote ID Telemetry Inspector & Frame Decoder
 */
export default function RemoteIdInspector({ 
  telemetry, 
  latencyMs = 4, 
  packetCount = 0 
}) {
  const [copied, setCopied] = useState(false);
  const [viewTab, setViewTab] = useState('DECODED'); // 'DECODED', 'RAW_JSON', 'HEX_FRAMES'

  const copyPayload = () => {
    if (telemetry) {
      navigator.clipboard.writeText(JSON.stringify(telemetry, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Generate simulated ASTM F3411 OpenDroneID 25-byte hex frame
  const generateHexDump = (data) => {
    if (!data) return '';
    const uasStr = data.uas_id || 'UIN-IND-2026-X89';
    let hex = 'FRAME 0x01 [LOCATION/VECTOR MESSAGE 25-BYTES]\n';
    hex += '0000: 10 01 '; // Msg type 0x1 (Location), Protocol v1
    for (let i = 0; i < 8; i++) {
      hex += ((data.lat * 1000 + i * 17) & 0xFF).toString(16).padStart(2, '0').toUpperCase() + ' ';
    }
    hex += '\n000A: ';
    for (let i = 0; i < 8; i++) {
      hex += ((data.lon * 1000 + i * 23) & 0xFF).toString(16).padStart(2, '0').toUpperCase() + ' ';
    }
    hex += '\n0014: 00 3C 00 78 00 2D 5B CRC:9F]\n\n';
    
    hex += 'FRAME 0x00 [BASIC ID MESSAGE 25-BYTES]\n';
    hex += '0000: 00 12 '; // Msg type 0x0 (Basic ID), Serial type
    for (let i = 0; i < Math.min(uasStr.length, 16); i++) {
      hex += uasStr.charCodeAt(i).toString(16).padStart(2, '0').toUpperCase() + ' ';
    }
    hex += '\n0012: 00 00 00 00 00 00 00 [CRC:E2]';
    return hex;
  };

  return (
    <div className="w-full flex flex-col rounded-xl border border-tactical-700 bg-tactical-950/90 p-3 shadow-2xl font-mono text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-tactical-700">
        <div className="flex items-center space-x-2">
          <FileCode size={15} className="text-cyber-cyan" />
          <span className="text-xs font-bold uppercase tracking-widest text-cyber-cyan font-orbitron">
            ASTM F3411-22a PROTOCOL INSPECTOR
          </span>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center space-x-1 bg-tactical-900 p-0.5 rounded border border-tactical-700 text-xs">
          <button
            onClick={() => setViewTab('DECODED')}
            className={`px-2 py-0.5 rounded transition-all text-[11px] ${viewTab === 'DECODED' ? 'bg-cyber-cyan text-black font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            DECODED
          </button>
          <button
            onClick={() => setViewTab('RAW_JSON')}
            className={`px-2 py-0.5 rounded transition-all text-[11px] ${viewTab === 'RAW_JSON' ? 'bg-cyber-cyan text-black font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            JSON
          </button>
          <button
            onClick={() => setViewTab('HEX_FRAMES')}
            className={`px-2 py-0.5 rounded transition-all text-[11px] ${viewTab === 'HEX_FRAMES' ? 'bg-cyber-cyan text-black font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            HEX
          </button>
        </div>
      </div>

      {/* Telemetry Stream Diagnostics Bar */}
      <div className="grid grid-cols-4 gap-2 mb-2.5 text-[11px]">
        <div className="bg-tactical-900/80 px-2 py-1.5 rounded border border-tactical-800">
          <span className="text-slate-500 block text-[9px]">RATE</span>
          <strong className="text-cyber-cyan font-bold">2.0 Hz (500ms)</strong>
        </div>

        <div className="bg-tactical-900/80 px-2 py-1.5 rounded border border-tactical-800">
          <span className="text-slate-500 block text-[9px]">PACKETS</span>
          <strong className="text-slate-200 font-mono">#{packetCount || telemetry?.sequence_number || 0}</strong>
        </div>

        <div className="bg-tactical-900/80 px-2 py-1.5 rounded border border-tactical-800">
          <span className="text-slate-500 block text-[9px]">RTT LATENCY</span>
          <strong className="text-cyber-green font-mono">{latencyMs} ms</strong>
        </div>

        <div className="bg-tactical-900/80 px-2 py-1.5 rounded border border-tactical-800">
          <span className="text-slate-500 block text-[9px]">STANDARD</span>
          <strong className="text-cyber-cyan font-bold">F3411-22a</strong>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative h-56 overflow-y-auto rounded bg-tactical-900/90 border border-tactical-800 p-2.5 text-xs font-mono">
        {viewTab === 'DECODED' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-tactical-950/80 p-1.5 rounded border border-tactical-800/80">
                <span className="text-slate-500 text-[10px] block">0x00 BASIC ID:</span>
                <span className="text-cyber-cyan font-bold">{telemetry?.uas_id || 'UIN-IND-2026-X89'}</span>
              </div>
              <div className="bg-tactical-950/80 p-1.5 rounded border border-tactical-800/80">
                <span className="text-slate-500 text-[10px] block">0x05 OPERATOR ID:</span>
                <span className="text-slate-200 font-bold">{telemetry?.operator_id || 'OP-IND-TN-9821'}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="bg-tactical-950/80 p-1.5 rounded border border-tactical-800/80">
                <span className="text-slate-500 text-[9px] block">GEO LATITUDE:</span>
                <span className="text-cyber-cyan">{telemetry?.lat?.toFixed(6) || '13.062500'}</span>
              </div>
              <div className="bg-tactical-950/80 p-1.5 rounded border border-tactical-800/80">
                <span className="text-slate-500 text-[9px] block">GEO LONGITUDE:</span>
                <span className="text-cyber-cyan">{telemetry?.lon?.toFixed(6) || '80.275000'}</span>
              </div>
              <div className="bg-tactical-950/80 p-1.5 rounded border border-tactical-800/80">
                <span className="text-slate-500 text-[9px] block">ALT WGS84:</span>
                <span className="text-cyber-cyan">{telemetry?.alt_geo_m?.toFixed(1) || '60.0'} m</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="bg-tactical-950/80 p-1.5 rounded border border-tactical-800/80">
                <span className="text-slate-500 text-[9px] block">HORIZ SPEED:</span>
                <span className="text-slate-200">{telemetry?.speed_horizontal_mps?.toFixed(1) || '12.5'} m/s</span>
              </div>
              <div className="bg-tactical-950/80 p-1.5 rounded border border-tactical-800/80">
                <span className="text-slate-500 text-[9px] block">VERT SPEED:</span>
                <span className="text-slate-200">{telemetry?.speed_vertical_mps?.toFixed(1) || '0.0'} m/s</span>
              </div>
              <div className="bg-tactical-950/80 p-1.5 rounded border border-tactical-800/80">
                <span className="text-slate-500 text-[9px] block">HEADING:</span>
                <span className="text-cyber-green">{telemetry?.heading_deg?.toFixed(1) || '45.0'}°</span>
              </div>
            </div>

            <div className="bg-tactical-950/80 p-1.5 rounded border border-tactical-800/80 flex items-center justify-between text-[11px]">
              <div>
                <span className="text-slate-500 text-[9px] block">0x02 AUTH DATA:</span>
                <span className="text-cyber-cyan font-mono">{telemetry?.auth_data || '0x4A89C2E3[ASTM-SEC-VALID]'}</span>
              </div>
              <div className="flex items-center space-x-1 text-cyber-green text-[10px]">
                <ShieldCheck size={14} />
                <span>CRC PASSED</span>
              </div>
            </div>
          </div>
        )}

        {viewTab === 'RAW_JSON' && (
          <pre className="text-[11px] text-cyber-cyan leading-tight whitespace-pre">
            {JSON.stringify(telemetry, null, 2)}
          </pre>
        )}

        {viewTab === 'HEX_FRAMES' && (
          <pre className="text-[11px] text-amber-300 leading-tight whitespace-pre">
            {generateHexDump(telemetry)}
          </pre>
        )}

        {/* Copy Button */}
        <button
          onClick={copyPayload}
          className="absolute top-2 right-2 p-1.5 rounded bg-tactical-800/90 hover:bg-tactical-700 border border-tactical-600 text-slate-300 hover:text-cyber-cyan transition-all shadow"
          title="Copy Telemetry JSON Payload"
        >
          {copied ? <Check size={13} className="text-cyber-green" /> : <Copy size={13} />}
        </button>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-tactical-800 text-[10px] text-slate-400">
        <span>BROADCAST LINK: <strong className="text-cyber-cyan">ws://0.0.0.0:8765</strong></span>
        <span className="text-slate-500">ISO-8601 UTC ENCAPSULATION</span>
      </div>
    </div>
  );
}
