import React, { useState } from 'react';
import { Database, CheckCircle, AlertTriangle, ShieldCheck, Download, X, RefreshCw } from 'lucide-react';

export default function AuditLogModal({ isOpen, onClose, auditRecords, onExportBsaDossier }) {
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  if (!isOpen) return null;

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    try {
      const res = await fetch('/api/audit/verify');
      const data = await res.json();
      setVerifyResult(data);
    } catch (e) {
      setVerifyResult({ is_valid: false, errors: ['Failed to reach verification endpoint.'] });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6 font-mono text-slate-100 select-none">
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#1e293b] flex items-center justify-between bg-[#070b14]/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-base text-cyan-400 uppercase tracking-wider">
                FORENSIC CHAIN OF CUSTODY LEDGER
              </h2>
              <p className="text-xs text-slate-400">
                BHARATIYA SAKSHYA ADHINIYAM (BSA) SECTION 65B / INDIAN EVIDENCE ACT COMPLIANCE
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleVerifyIntegrity}
              disabled={verifying}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 px-3 py-2 rounded-lg text-xs font-bold transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
              <span>VERIFY HASH CHAIN</span>
            </button>

            <button
              onClick={onExportBsaDossier}
              className="flex items-center space-x-1.5 bg-cyan-500 hover:bg-cyan-400 text-black px-3 py-2 rounded-lg text-xs font-bold transition shadow-md shadow-cyan-500/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>EXPORT DOSSIER</span>
            </button>

            <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Verification Status Banner */}
        {verifyResult && (
          <div className={`px-5 py-2.5 text-xs font-bold flex items-center justify-between border-b ${
            verifyResult.is_valid 
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-red-950/40 border-red-500/40 text-red-300'
          }`}>
            <div className="flex items-center space-x-2">
              {verifyResult.is_valid ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400" />
              )}
              <span>
                {verifyResult.is_valid
                  ? '✅ CRYPTOGRAPHIC HASH CHAIN INTEGRITY VERIFIED (0 TAMPERING DETECTED)'
                  : `⚠️ CHAIN TAMPERING DETECTED: ${verifyResult.errors.join(', ')}`}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">VERIFIED AT {verifyResult.verified_at?.substring(11, 19)} UTC</span>
          </div>
        )}

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">INDEX</th>
                <th className="py-2.5 px-3">TIMESTAMP (UTC)</th>
                <th className="py-2.5 px-3">OPERATOR</th>
                <th className="py-2.5 px-3">UAS / ZONE ID</th>
                <th className="py-2.5 px-3">ACTION TAKEN</th>
                <th className="py-2.5 px-3">PREVIOUS HASH</th>
                <th className="py-2.5 px-3">CURRENT SHA-256 HASH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {(!auditRecords || auditRecords.length === 0) ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    No ledger entries recorded yet.
                  </td>
                </tr>
              ) : (
                auditRecords.map(rec => (
                  <tr key={rec.log_index} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 font-bold text-cyan-400">#{rec.log_index}</td>
                    <td className="py-3 px-3 text-slate-400">{rec.timestamp?.substring(0, 19)}</td>
                    <td className="py-3 px-3 text-slate-200 font-semibold">{rec.operator_id}</td>
                    <td className="py-3 px-3 font-bold text-amber-400">{rec.uas_id}</td>
                    <td className="py-3 px-3">
                      <span className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-700">
                        {rec.action_taken}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[10px] text-slate-500" title={rec.prev_hash}>
                      {rec.prev_hash ? rec.prev_hash.substring(0, 12) + '...' : ''}
                    </td>
                    <td className="py-3 px-3 font-mono text-[10px] text-emerald-400 font-semibold" title={rec.curr_hash}>
                      {rec.curr_hash ? rec.curr_hash.substring(0, 14) + '...' : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#1e293b] bg-[#070b14]/70 flex items-center justify-between text-xs text-slate-400">
          <div>
            GENESIS BLOCK ROOT: <span className="text-cyan-400 font-mono">GENESIS_POLICE_DISTRICT_ROOT_HASH_001</span>
          </div>
          <div>
            TOTAL CHAIN BLOCKS: <b className="text-slate-200">{auditRecords?.length || 0}</b>
          </div>
        </div>
      </div>
    </div>
  );
}
