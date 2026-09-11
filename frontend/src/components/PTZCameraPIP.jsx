import React, { useState } from 'react';
import { Camera, Maximize2, Minimize2, AlertOctagon, Eye, ZoomIn, ZoomOut, Expand, X } from 'lucide-react';

export default function PTZCameraPIP({ visionStatus, isDarkTargetActive }) {
  const [viewState, setViewState] = useState('normal'); // 'normal' | 'minimized' | 'maximized'

  const isDarkTarget = isDarkTargetActive || visionStatus?.dark_target_detected;

  // Render Fullscreen Maximized Modal Overlay
  if (viewState === 'maximized') {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-mono select-none">
        <div className={`w-full max-w-5xl h-[85vh] bg-[#0f172a] border rounded-2xl overflow-hidden shadow-2xl flex flex-col ${
          isDarkTarget ? 'border-red-500 shadow-red-500/30' : 'border-slate-700'
        }`}>
          {/* Header */}
          <div className="bg-[#070b14] px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Camera className={`w-5 h-5 ${isDarkTarget ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`} />
              <div>
                <h2 className="font-bold text-sm text-slate-100 uppercase tracking-wider">
                  ARIES-C2 OPTICAL PTZ SURVEILLANCE FEED (FULLSCREEN 4K)
                </h2>
                <p className="text-[11px] text-slate-400">Autonomous Target Tracking & AI Object Classifier</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {isDarkTarget && (
                <span className="text-xs bg-red-500 text-white font-bold px-2 py-1 rounded animate-bounce">
                  NON-COOPERATIVE TARGET DETECTED
                </span>
              )}
              <button
                onClick={() => setViewState('normal')}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
                title="Restore Normal View"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Video Container */}
          <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
            <img
              src="/video_feed"
              alt="Optical PTZ Camera Stream Fullscreen"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='500' viewBox='0 0 800 500'%3E%3Crect width='800' height='500' fill='%23070b14'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2300f0ff' font-family='monospace' font-size='16'%3EOPTICAL FEED INITIALIZING...%3C/text%3E%3C/svg%3E";
              }}
            />

            {/* Dark Target Warning Banner */}
            {isDarkTarget && (
              <div className="absolute top-4 left-4 right-4 bg-red-600/90 text-white p-2.5 rounded-xl text-xs font-bold text-center border border-red-400 shadow-2xl animate-pulse flex items-center justify-center space-x-2">
                <AlertOctagon className="w-4 h-4 text-white" />
                <span>NON-COOPERATIVE DRONE TARGET ACQUIRED BY OPTICAL SENSOR (NO REMOTE ID BROADCAST)</span>
              </div>
            )}

            {/* HUD Status Bar */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center text-xs text-emerald-400 bg-black/75 px-3 py-2 rounded-xl backdrop-blur-md border border-slate-800">
              <span className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span className="font-bold">YOLOv8n OPTICAL SURVEILLANCE ENGINE</span>
              </span>
              <div className="flex items-center space-x-4">
                <span>INFERENCE: <b>14.5ms</b></span>
                <span>FPS: <b>30 FPS</b></span>
                <span>RESOLUTION: <b>1920x1080 FHD</b></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`absolute bottom-6 left-4 md:left-96 z-20 font-mono transition-all duration-300 ${
      viewState === 'minimized' ? 'w-48 h-12' : 'w-72 sm:w-80 h-56 sm:h-60'
    }`}>
      <div className={`w-full h-full bg-[#0f172a]/95 border rounded-xl overflow-hidden shadow-2xl flex flex-col backdrop-blur-md ${
        isDarkTarget ? 'border-red-500 pulse-crimson' : 'border-slate-800'
      }`}>
        {/* PIP Titlebar */}
        <div className="bg-[#070b14]/90 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-xs select-none">
          <div className="flex items-center space-x-2">
            <Camera className={`w-3.5 h-3.5 ${isDarkTarget ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`} />
            <span className="font-bold text-[11px] text-slate-200 uppercase tracking-wider">
              OPTICAL PTZ SURVEILLANCE
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            {isDarkTarget && (
              <span className="text-[9px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded animate-bounce">
                DARK TARGET
              </span>
            )}
            <button
              onClick={() => setViewState(viewState === 'minimized' ? 'normal' : 'minimized')}
              className="text-slate-400 hover:text-white p-0.5"
              title={viewState === 'minimized' ? 'Expand PIP' : 'Minimize PIP'}
            >
              {viewState === 'minimized' ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setViewState('maximized')}
              className="text-cyan-400 hover:text-cyan-300 p-0.5"
              title="Maximize Fullscreen"
            >
              <Expand className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Video Canvas Container */}
        {viewState !== 'minimized' && (
          <div className="relative flex-1 bg-black overflow-hidden group">
            {/* Live MJPEG Feed Stream */}
            <img
              src="/video_feed"
              alt="Optical PTZ Camera Stream"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='200' viewBox='0 0 320 200'%3E%3Crect width='320' height='200' fill='%23070b14'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2300f0ff' font-family='monospace' font-size='12'%3EOPTICAL FEED INITIALIZING...%3C/text%3E%3C/svg%3E";
              }}
            />

            {/* Dark Target Alert Overlay */}
            {isDarkTarget && (
              <div className="absolute top-2 left-2 right-2 bg-red-600/90 text-white p-1.5 rounded text-[10px] font-bold text-center border border-red-400 shadow-lg animate-pulse flex items-center justify-center space-x-1">
                <AlertOctagon className="w-3.5 h-3.5 text-white" />
                <span>NON-COOPERATIVE DRONE DETECTED</span>
              </div>
            )}

            {/* HUD Overlay */}
            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[10px] text-emerald-400 bg-black/60 px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
              <span className="flex items-center space-x-1">
                <Eye className="w-3 h-3 text-emerald-400" />
                <span>YOLOv8n OPTICAL ENGINE</span>
              </span>
              <span>14.5ms | 30 FPS</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

