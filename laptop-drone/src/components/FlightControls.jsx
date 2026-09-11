import React, { useEffect, useState, useRef } from 'react';
import { 
  Keyboard, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  Zap, 
  RotateCcw, 
  Sliders, 
  Radio, 
  Pause 
} from 'lucide-react';

/**
 * Flight Controls & Pilot Input Engine
 * Supports hardware keyboard mapping + virtual on-screen controls
 */
export default function FlightControls({ 
  onSendControl, 
  speed = 12.0, 
  heading = 45.0, 
  alt = 60.0 
}) {
  const [activeKeys, setActiveKeys] = useState({});
  const [keyboardEnabled, setKeyboardEnabled] = useState(true);
  const keyIntervalRef = useRef(null);

  // Track active keys pressed
  useEffect(() => {
    if (!keyboardEnabled) return;

    const handleKeyDown = (e) => {
      // Prevent scrolling on arrow keys and space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      const key = e.key.toLowerCase();
      setActiveKeys(prev => ({ ...prev, [key]: true, [e.key]: true }));

      // Immediate action on key press
      if (key === 'w') {
        onSendControl({ throttle_delta: 1.5 });
      } else if (key === 's') {
        onSendControl({ throttle_delta: -1.5 });
      } else if (key === 'a') {
        onSendControl({ yaw_delta: -5.0 });
      } else if (key === 'd') {
        onSendControl({ yaw_delta: 5.0 });
      } else if (e.key === 'ArrowUp') {
        onSendControl({ climb_delta: 3.0 });
      } else if (e.key === 'ArrowDown') {
        onSendControl({ climb_delta: -3.0 });
      } else if (e.key === ' ') {
        onSendControl({ speed_set: 0.0, climb_delta: 0.0 });
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      setActiveKeys(prev => {
        const next = { ...prev };
        delete next[key];
        delete next[e.key];
        return next;
      });

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        onSendControl({ climb_delta: 0.0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [keyboardEnabled, onSendControl]);

  return (
    <div className="w-full flex flex-col rounded-xl border border-tactical-700 bg-tactical-950/90 p-3 shadow-2xl font-mono text-slate-200">
      {/* Controls Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-tactical-700">
        <div className="flex items-center space-x-2">
          <Sliders size={15} className="text-cyber-cyan" />
          <span className="text-xs font-bold uppercase tracking-widest text-cyber-cyan font-orbitron">
            FLIGHT CONTROLS & AVIONICS LINK
          </span>
        </div>

        <button
          onClick={() => setKeyboardEnabled(!keyboardEnabled)}
          className={`flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] border transition-all ${
            keyboardEnabled 
              ? 'bg-cyber-cyan/15 border-cyber-cyan text-cyber-cyan font-bold shadow-cyan-glow' 
              : 'bg-tactical-900 border-tactical-700 text-slate-500'
          }`}
        >
          <Keyboard size={13} />
          <span>KEYBOARD: {keyboardEnabled ? 'ARMED' : 'STANDBY'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Left: Keyboard HUD Keypad Visualizer */}
        <div className="flex flex-col justify-between p-2.5 rounded-lg bg-tactical-900/80 border border-tactical-800">
          <div className="text-[11px] font-bold text-slate-300 mb-2 flex items-center justify-between">
            <span>KEYBOARD HOTKEYS</span>
            <span className="text-[10px] text-slate-500">LIVE FEEDBACK</span>
          </div>

          <div className="flex items-center justify-around my-1">
            {/* WASD Block */}
            <div className="flex flex-col items-center space-y-1">
              {/* W */}
              <button
                onClick={() => onSendControl({ throttle_delta: 2.0 })}
                className={`w-10 h-10 rounded border flex flex-col items-center justify-center transition-all ${
                  activeKeys['w'] ? 'bg-cyber-cyan border-cyber-cyan text-black shadow-cyan-glow scale-95' : 'bg-tactical-800 border-tactical-600 text-slate-200 hover:border-cyber-cyan/50'
                }`}
              >
                <span className="font-bold text-xs">W</span>
                <span className="text-[8px] opacity-75">SPD+</span>
              </button>

              <div className="flex space-x-1">
                {/* A */}
                <button
                  onClick={() => onSendControl({ yaw_delta: -10.0 })}
                  className={`w-10 h-10 rounded border flex flex-col items-center justify-center transition-all ${
                    activeKeys['a'] ? 'bg-cyber-cyan border-cyber-cyan text-black shadow-cyan-glow scale-95' : 'bg-tactical-800 border-tactical-600 text-slate-200 hover:border-cyber-cyan/50'
                  }`}
                >
                  <span className="font-bold text-xs">A</span>
                  <span className="text-[8px] opacity-75">YAW-</span>
                </button>

                {/* S */}
                <button
                  onClick={() => onSendControl({ throttle_delta: -2.0 })}
                  className={`w-10 h-10 rounded border flex flex-col items-center justify-center transition-all ${
                    activeKeys['s'] ? 'bg-cyber-cyan border-cyber-cyan text-black shadow-cyan-glow scale-95' : 'bg-tactical-800 border-tactical-600 text-slate-200 hover:border-cyber-cyan/50'
                  }`}
                >
                  <span className="font-bold text-xs">S</span>
                  <span className="text-[8px] opacity-75">SPD-</span>
                </button>

                {/* D */}
                <button
                  onClick={() => onSendControl({ yaw_delta: 10.0 })}
                  className={`w-10 h-10 rounded border flex flex-col items-center justify-center transition-all ${
                    activeKeys['d'] ? 'bg-cyber-cyan border-cyber-cyan text-black shadow-cyan-glow scale-95' : 'bg-tactical-800 border-tactical-600 text-slate-200 hover:border-cyber-cyan/50'
                  }`}
                >
                  <span className="font-bold text-xs">D</span>
                  <span className="text-[8px] opacity-75">YAW+</span>
                </button>
              </div>
            </div>

            {/* Arrow Altitude Block */}
            <div className="flex flex-col items-center space-y-1">
              {/* Arrow Up */}
              <button
                onClick={() => onSendControl({ climb_delta: 3.0 })}
                className={`w-12 h-10 rounded border flex flex-col items-center justify-center transition-all ${
                  activeKeys['ArrowUp'] ? 'bg-cyber-cyan border-cyber-cyan text-black shadow-cyan-glow scale-95' : 'bg-tactical-800 border-tactical-600 text-slate-200 hover:border-cyber-cyan/50'
                }`}
              >
                <ArrowUp size={14} />
                <span className="text-[8px] opacity-75">CLIMB</span>
              </button>

              {/* Arrow Down */}
              <button
                onClick={() => onSendControl({ climb_delta: -3.0 })}
                className={`w-12 h-10 rounded border flex flex-col items-center justify-center transition-all ${
                  activeKeys['ArrowDown'] ? 'bg-cyber-cyan border-cyber-cyan text-black shadow-cyan-glow scale-95' : 'bg-tactical-800 border-tactical-600 text-slate-200 hover:border-cyber-cyan/50'
                }`}
              >
                <ArrowDown size={14} />
                <span className="text-[8px] opacity-75">SINK</span>
              </button>
            </div>
          </div>

          {/* Spacebar Hover */}
          <button
            onClick={() => onSendControl({ speed_set: 0, climb_delta: 0 })}
            className={`w-full py-1.5 mt-2 rounded border flex items-center justify-center space-x-2 text-xs transition-all ${
              activeKeys[' '] ? 'bg-cyber-amber border-cyber-amber text-black shadow-amber-glow' : 'bg-tactical-800 border-tactical-700 text-slate-300 hover:border-cyber-amber/50'
            }`}
          >
            <Pause size={13} />
            <span>[SPACEBAR] EMERGENCY HOVER / LOITER HOLD</span>
          </button>
        </div>

        {/* Right: Manual Sliders & Quick Step Adjusters */}
        <div className="flex flex-col justify-between p-2.5 rounded-lg bg-tactical-900/80 border border-tactical-800 space-y-2.5">
          {/* Target Speed Slider */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">GROUND SPEED SET:</span>
              <strong className="text-cyber-cyan font-mono">{speed.toFixed(1)} m/s</strong>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="0"
                max="28"
                step="0.5"
                value={speed}
                onChange={(e) => onSendControl({ speed_set: parseFloat(e.target.value) })}
                className="w-full accent-cyber-cyan bg-tactical-950 h-2 rounded-lg cursor-pointer"
              />
              <button
                onClick={() => onSendControl({ speed_set: 0 })}
                className="px-2 py-0.5 text-[10px] bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 rounded text-slate-300"
              >
                STOP
              </button>
            </div>
          </div>

          {/* Altitude Step Buttons */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">ALTITUDE ADJUST:</span>
              <strong className={alt > 120 ? 'text-cyber-red font-mono' : 'text-cyber-cyan font-mono'}>
                {alt.toFixed(1)} m
              </strong>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => onSendControl({ alt_set: Math.max(0, alt - 20) })}
                className="py-1 px-1 text-[10px] bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 rounded text-slate-300"
              >
                -20m
              </button>
              <button
                onClick={() => onSendControl({ alt_set: Math.max(0, alt - 5) })}
                className="py-1 px-1 text-[10px] bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 rounded text-slate-300"
              >
                -5m
              </button>
              <button
                onClick={() => onSendControl({ alt_set: Math.min(300, alt + 5) })}
                className="py-1 px-1 text-[10px] bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 rounded text-slate-300"
              >
                +5m
              </button>
              <button
                onClick={() => onSendControl({ alt_set: Math.min(300, alt + 20) })}
                className="py-1 px-1 text-[10px] bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 rounded text-slate-300"
              >
                +20m
              </button>
            </div>
          </div>

          {/* Heading Yaw Step Buttons */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">YAW HEADING TRIM:</span>
              <strong className="text-cyber-green font-mono">{Math.round(heading)}°</strong>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => onSendControl({ yaw_delta: -45 })}
                className="py-1 px-1 text-[10px] bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 rounded text-slate-300"
              >
                -45°
              </button>
              <button
                onClick={() => onSendControl({ yaw_delta: -10 })}
                className="py-1 px-1 text-[10px] bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 rounded text-slate-300"
              >
                -10°
              </button>
              <button
                onClick={() => onSendControl({ yaw_delta: 10 })}
                className="py-1 px-1 text-[10px] bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 rounded text-slate-300"
              >
                +10°
              </button>
              <button
                onClick={() => onSendControl({ yaw_delta: 45 })}
                className="py-1 px-1 text-[10px] bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 rounded text-slate-300"
              >
                +45°
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
