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
  Pause, 
  Navigation, 
  Compass 
} from 'lucide-react';

/**
 * Flight Controls & Pilot Input Engine
 * Real-time Hardware Keyboard Mapping + Virtual Avionics Dial Deck
 */
export default function FlightControls({ 
  onSendControl, 
  speed = 12.0, 
  heading = 45.0, 
  alt = 60.0 
}) {
  const [activeKeys, setActiveKeys] = useState({});
  const [keyboardEnabled, setKeyboardEnabled] = useState(true);

  // Keyboard Event Handlers
  useEffect(() => {
    if (!keyboardEnabled) return;

    const handleKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      const key = e.key.toLowerCase();
      setActiveKeys(prev => ({ ...prev, [key]: true, [e.key]: true }));

      if (key === 'w') {
        onSendControl({ throttle_delta: 2.0 });
      } else if (key === 's') {
        onSendControl({ throttle_delta: -2.0 });
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
    <div className="w-full flex flex-col rounded-xl border border-tactical-700/80 bg-tactical-900/90 p-3.5 glass-panel tactical-bracket shadow-2xl font-mono text-slate-200">
      {/* Controls Header */}
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-tactical-700/60">
        <div className="flex items-center space-x-2">
          <Sliders size={16} className="text-cyber-cyan" />
          <span className="text-xs font-bold uppercase tracking-widest text-cyber-cyan font-orbitron">
            FLIGHT YOKE & ACTUATION LINK
          </span>
        </div>

        <button
          onClick={() => setKeyboardEnabled(!keyboardEnabled)}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] border transition-all font-orbitron ${
            keyboardEnabled 
              ? 'bg-cyber-cyan/15 border-cyber-cyan text-cyber-cyan font-bold shadow-cyan-glow' 
              : 'bg-tactical-950 border-tactical-700 text-slate-500'
          }`}
        >
          <Keyboard size={13} />
          <span>KEYBOARD: {keyboardEnabled ? 'ARMED' : 'STANDBY'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Left: Keyboard HUD Keypad Visualizer */}
        <div className="flex flex-col justify-between p-3 rounded-xl bg-tactical-950/80 border border-tactical-750">
          <div className="text-[11px] font-bold text-slate-300 mb-2 flex items-center justify-between font-orbitron">
            <span>KEYBOARD YOKE</span>
            <span className="text-[10px] text-cyber-cyan flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-cyan animate-pulse"></span>
              <span>TACTILE HUD</span>
            </span>
          </div>

          <div className="flex items-center justify-around my-1.5">
            {/* WASD Speed/Yaw Block */}
            <div className="flex flex-col items-center space-y-1.5">
              {/* W */}
              <button
                onClick={() => onSendControl({ throttle_delta: 2.0 })}
                className={`w-10 h-10 rounded-lg border flex flex-col items-center justify-center transition-all ${
                  activeKeys['w'] 
                    ? 'bg-cyber-cyan border-cyber-cyan text-black shadow-cyan-glow scale-95 font-black' 
                    : 'bg-tactical-850 border-tactical-600 text-slate-200 hover:border-cyber-cyan/60 hover:bg-tactical-800'
                }`}
              >
                <span className="font-bold text-xs">W</span>
                <span className="text-[8px] opacity-80">SPD+</span>
              </button>

              <div className="flex space-x-1.5">
                {/* A */}
                <button
                  onClick={() => onSendControl({ yaw_delta: -10.0 })}
                  className={`w-10 h-10 rounded-lg border flex flex-col items-center justify-center transition-all ${
                    activeKeys['a'] 
                      ? 'bg-cyber-cyan border-cyber-cyan text-black shadow-cyan-glow scale-95 font-black' 
                      : 'bg-tactical-850 border-tactical-600 text-slate-200 hover:border-cyber-cyan/60 hover:bg-tactical-800'
                  }`}
                >
                  <span className="font-bold text-xs">A</span>
                  <span className="text-[8px] opacity-80">YAW-</span>
                </button>

                {/* S */}
                <button
                  onClick={() => onSendControl({ throttle_delta: -2.0 })}
                  className={`w-10 h-10 rounded-lg border flex flex-col items-center justify-center transition-all ${
                    activeKeys['s'] 
                      ? 'bg-cyber-cyan border-cyber-cyan text-black shadow-cyan-glow scale-95 font-black' 
                      : 'bg-tactical-850 border-tactical-600 text-slate-200 hover:border-cyber-cyan/60 hover:bg-tactical-800'
                  }`}
                >
                  <span className="font-bold text-xs">S</span>
                  <span className="text-[8px] opacity-80">SPD-</span>
                </button>

                {/* D */}
                <button
                  onClick={() => onSendControl({ yaw_delta: 10.0 })}
                  className={`w-10 h-10 rounded-lg border flex flex-col items-center justify-center transition-all ${
                    activeKeys['d'] 
                      ? 'bg-cyber-cyan border-cyber-cyan text-black shadow-cyan-glow scale-95 font-black' 
                      : 'bg-tactical-850 border-tactical-600 text-slate-200 hover:border-cyber-cyan/60 hover:bg-tactical-800'
                  }`}
                >
                  <span className="font-bold text-xs">D</span>
                  <span className="text-[8px] opacity-80">YAW+</span>
                </button>
              </div>
            </div>

            {/* Altitude Climb / Sink Block */}
            <div className="flex flex-col items-center space-y-1.5">
              <button
                onClick={() => onSendControl({ climb_delta: 3.0 })}
                className={`w-12 h-10 rounded-lg border flex flex-col items-center justify-center transition-all ${
                  activeKeys['ArrowUp'] 
                    ? 'bg-cyber-green border-cyber-green text-black shadow-green-glow scale-95 font-black' 
                    : 'bg-tactical-850 border-tactical-600 text-slate-200 hover:border-cyber-green/60 hover:bg-tactical-800'
                }`}
              >
                <ArrowUp size={15} />
                <span className="text-[8px] opacity-80">CLIMB</span>
              </button>

              <button
                onClick={() => onSendControl({ climb_delta: -3.0 })}
                className={`w-12 h-10 rounded-lg border flex flex-col items-center justify-center transition-all ${
                  activeKeys['ArrowDown'] 
                    ? 'bg-cyber-amber border-cyber-amber text-black shadow-amber-glow scale-95 font-black' 
                    : 'bg-tactical-850 border-tactical-600 text-slate-200 hover:border-cyber-amber/60 hover:bg-tactical-800'
                }`}
              >
                <ArrowDown size={15} />
                <span className="text-[8px] opacity-80">SINK</span>
              </button>
            </div>
          </div>

          {/* Spacebar Hover Hold */}
          <button
            onClick={() => onSendControl({ speed_set: 0, climb_delta: 0 })}
            className={`w-full py-1.5 mt-2 rounded-lg border flex items-center justify-center space-x-2 text-xs font-orbitron transition-all ${
              activeKeys[' '] 
                ? 'bg-cyber-amber border-cyber-amber text-black shadow-amber-glow font-black' 
                : 'bg-tactical-850 border-tactical-700 text-slate-300 hover:border-cyber-amber/60 hover:bg-tactical-800'
            }`}
          >
            <Pause size={13} />
            <span>[SPACEBAR] EMERGENCY HOVER HOLD</span>
          </button>
        </div>

        {/* Right: Manual Sliders & Quick Step Adjusters */}
        <div className="flex flex-col justify-between p-3 rounded-xl bg-tactical-950/80 border border-tactical-750 space-y-2">
          {/* Target Speed Slider */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400 font-semibold">GROUND SPEED:</span>
              <strong className="text-cyber-cyan font-mono">{speed.toFixed(1)} m/s ({(speed * 3.6).toFixed(1)} km/h)</strong>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="0"
                max="28"
                step="0.5"
                value={speed}
                onChange={(e) => onSendControl({ speed_set: parseFloat(e.target.value) })}
                className="w-full accent-cyber-cyan bg-tactical-900 h-2 rounded-lg cursor-pointer"
              />
              <button
                onClick={() => onSendControl({ speed_set: 0 })}
                className="px-2.5 py-0.5 text-[10px] font-bold bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 rounded-lg text-slate-300 hover:text-white"
              >
                ZERO
              </button>
            </div>
          </div>

          {/* Altitude Step Adjusters */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400 font-semibold">ALTITUDE STEPPER:</span>
              <strong className={alt > 120 ? 'text-cyber-red font-mono' : 'text-cyber-cyan font-mono'}>
                {alt.toFixed(1)} m AGL
              </strong>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => onSendControl({ alt_set: Math.max(0, alt - 20) })}
                className="py-1 px-1 text-[10px] font-bold bg-tactical-850 hover:bg-tactical-750 border border-tactical-700 hover:border-slate-500 rounded-lg text-slate-300"
              >
                -20m
              </button>
              <button
                onClick={() => onSendControl({ alt_set: Math.max(0, alt - 5) })}
                className="py-1 px-1 text-[10px] font-bold bg-tactical-850 hover:bg-tactical-750 border border-tactical-700 hover:border-slate-500 rounded-lg text-slate-300"
              >
                -5m
              </button>
              <button
                onClick={() => onSendControl({ alt_set: Math.min(300, alt + 5) })}
                className="py-1 px-1 text-[10px] font-bold bg-tactical-850 hover:bg-tactical-750 border border-tactical-700 hover:border-slate-500 rounded-lg text-slate-300"
              >
                +5m
              </button>
              <button
                onClick={() => onSendControl({ alt_set: Math.min(300, alt + 20) })}
                className="py-1 px-1 text-[10px] font-bold bg-tactical-850 hover:bg-tactical-750 border border-tactical-700 hover:border-slate-500 rounded-lg text-slate-300"
              >
                +20m
              </button>
            </div>
          </div>

          {/* Heading Yaw Trim */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400 font-semibold">YAW HEADING TRIM:</span>
              <strong className="text-cyber-green font-mono">{Math.round(heading)}° COMPASS</strong>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => onSendControl({ yaw_delta: -45 })}
                className="py-1 px-1 text-[10px] font-bold bg-tactical-850 hover:bg-tactical-750 border border-tactical-700 hover:border-slate-500 rounded-lg text-slate-300"
              >
                -45°
              </button>
              <button
                onClick={() => onSendControl({ yaw_delta: -10 })}
                className="py-1 px-1 text-[10px] font-bold bg-tactical-850 hover:bg-tactical-750 border border-tactical-700 hover:border-slate-500 rounded-lg text-slate-300"
              >
                -10°
              </button>
              <button
                onClick={() => onSendControl({ yaw_delta: 10 })}
                className="py-1 px-1 text-[10px] font-bold bg-tactical-850 hover:bg-tactical-750 border border-tactical-700 hover:border-slate-500 rounded-lg text-slate-300"
              >
                +10°
              </button>
              <button
                onClick={() => onSendControl({ yaw_delta: 45 })}
                className="py-1 px-1 text-[10px] font-bold bg-tactical-850 hover:bg-tactical-750 border border-tactical-700 hover:border-slate-500 rounded-lg text-slate-300"
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
