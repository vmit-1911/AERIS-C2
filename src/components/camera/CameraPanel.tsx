import React, { useRef, useEffect, useState } from 'react';
import { VisionObservation, VisionModelStatus, Track } from '../../types';
import { triggerVisionDetect, uploadVisionFrame } from '../../services/api';
import { formatTimestamp } from '../../utils/formatting';
import { Video, Eye, Upload, Crosshair } from 'lucide-react';

interface CameraPanelProps {
  observations: VisionObservation[];
  modelStatus: VisionModelStatus | null;
  tracks: Map<string, Track>;
  onNewObservation: (obs: VisionObservation) => void;
}

export const CameraPanel: React.FC<CameraPanelProps> = ({
  observations,
  modelStatus,
  tracks,
  onNewObservation,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [latestObs, setLatestObs] = useState<VisionObservation | null>(
    observations.length > 0 ? observations[observations.length - 1] : null
  );
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (observations.length > 0) {
      setLatestObs(observations[observations.length - 1]);
    }
  }, [observations]);

  // Draw Synthetic Airspace HUD on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Dark Tactical Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#060d17');
    skyGrad.addColorStop(0.7, '#0b1626');
    skyGrad.addColorStop(1, '#132135');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Reticle Grid Lines
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Crosshair Rings
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 35, 0, Math.PI * 2);
    ctx.arc(w / 2, h / 2, 75, 0, Math.PI * 2);
    ctx.stroke();

    // Camera HUD Overlay
    ctx.fillStyle = 'rgba(0, 242, 254, 0.8)';
    ctx.font = '10px JetBrains Mono';
    ctx.fillText('CAM-01 [AZ: 045° EL: +12°]', 10, 16);
    ctx.fillText(new Date().toISOString().substring(11, 19) + ' UTC', 10, 30);

    // Draw Simulated Airborne Drone Silhouette if recent observation exists
    if (latestObs && latestObs.bbox) {
      const [x1, y1] = latestObs.bbox;
      const droneX = Math.max(20, Math.min(w - 60, x1));
      const droneY = Math.max(20, Math.min(h - 50, y1));

      // Drone Body
      ctx.fillStyle = '#00f2fe';
      ctx.beginPath();
      ctx.ellipse(droneX + 25, droneY + 20, 22, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rotor Arms
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(droneX, droneY + 5);
      ctx.lineTo(droneX + 50, droneY + 35);
      ctx.moveTo(droneX + 50, droneY + 5);
      ctx.lineTo(droneX, droneY + 35);
      ctx.stroke();
    }
  }, [latestObs]);

  const handleSimulateDetection = async () => {
    try {
      setIsProcessing(true);
      const obs = await triggerVisionDetect();
      onNewObservation(obs);
      setLatestObs(obs);
    } catch (err) {
      console.error('Error triggering vision detection:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setIsProcessing(true);
        const b64 = reader.result ? reader.result.toString().split(',')[1] : null;
        const obs = await uploadVisionFrame({
          camera_id: 'CAM-01',
          confidence: 0.95,
          filename: file.name,
          frame_data_b64: b64,
        });
        onNewObservation(obs);
        setLatestObs(obs);
      } catch (err) {
        console.error('Error uploading frame:', err);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const correlation = latestObs?.correlation;
  const corrStatus = correlation?.status || 'UNMATCHED';
  const matchedTrack = correlation?.correlated_drone_id ? tracks.get(correlation.correlated_drone_id) : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '12px',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      {/* Model Disclaimer Notice */}
      <div
        style={{
          background: 'rgba(13, 22, 35, 0.85)',
          border: '1px solid var(--border-dim)',
          borderRadius: '4px',
          padding: '8px 10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-cyan)' }} />
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
            {modelStatus?.model_name || 'YOLOv8 DETECTOR (DEMO / MOCK)'}
          </span>
        </div>
        <div style={{ fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', lineHeight: '1.3' }}>
          Model evaluation pending; current vision mode is demonstration/mock. Precision/Recall: UNMEASURED.
        </div>
      </div>

      {/* Video Viewport / Canvas Card */}
      <div
        style={{
          background: 'rgba(6, 9, 14, 0.85)',
          border: '1px solid var(--border-dim)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 10px',
            background: 'rgba(17, 27, 39, 0.9)',
            borderBottom: '1px solid var(--border-dim)',
          }}
        >
          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
            CAM-01 • AIRSPACE BEARING 045°
          </span>
          <span
            style={{
              fontSize: '8px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ef4444' }} />
            LIVE INFERENCE
          </span>
        </div>

        {/* Viewport Container with Bounding Box Overlay */}
        <div style={{ position: 'relative', width: '100%', height: '180px', background: '#000' }}>
          <canvas
            ref={canvasRef}
            width={340}
            height={180}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />

          {latestObs && (
            <div
              style={{
                position: 'absolute',
                left: '25%',
                top: '25%',
                width: '45%',
                height: '45%',
                border: '1.5px solid #00f2fe',
                background: 'rgba(0, 242, 254, 0.08)',
                boxShadow: '0 0 8px rgba(0, 242, 254, 0.3)',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-16px',
                  left: '-1px',
                  background: 'var(--accent-cyan)',
                  color: '#06090e',
                  fontSize: '8px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  padding: '1px 4px',
                  borderRadius: '2px',
                }}
              >
                {latestObs.class} {Math.round(latestObs.confidence * 100)}% [MOCK]
              </div>
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div style={{ display: 'flex', gap: '6px', padding: '8px' }}>
          <button
            onClick={handleSimulateDetection}
            disabled={isProcessing}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: 'rgba(0, 242, 254, 0.15)',
              border: '1px solid var(--accent-cyan)',
              color: 'var(--accent-cyan)',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              padding: '6px 8px',
              borderRadius: '3px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
            }}
          >
            <Eye size={12} />
            {isProcessing ? 'PROCESSING...' : 'Simulate Frame Detection'}
          </button>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-dim)',
              color: 'var(--text-main)',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '6px 10px',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            <Upload size={12} />
            Upload Frame
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* Telemetry Correlation Card */}
      <div
        style={{
          background: 'rgba(13, 22, 35, 0.85)',
          border: '1px solid var(--border-dim)',
          borderRadius: '4px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
            TELEMETRY CORRELATION
          </span>
          <span
            style={{
              fontSize: '9px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '3px',
              background:
                corrStatus === 'CORRELATED'
                  ? 'rgba(16, 185, 129, 0.2)'
                  : corrStatus === 'POTENTIAL MATCH'
                  ? 'rgba(234, 179, 8, 0.2)'
                  : 'rgba(100, 116, 139, 0.2)',
              border:
                corrStatus === 'CORRELATED'
                  ? '1px solid #10b981'
                  : corrStatus === 'POTENTIAL MATCH'
                  ? '1px solid #eab308'
                  : '1px solid #64748b',
              color:
                corrStatus === 'CORRELATED'
                  ? '#34d399'
                  : corrStatus === 'POTENTIAL MATCH'
                  ? '#facc15'
                  : '#94a3b8',
            }}
          >
            {corrStatus}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
          <div>
            <span style={{ color: 'var(--text-dim)', fontSize: '8px' }}>ASSOCIATED TRACK:</span>
            <div style={{ color: '#fff', fontWeight: 600 }}>
              {correlation?.correlated_drone_id ? `${correlation.correlated_drone_id} (${correlation.correlated_track_id})` : 'None'}
            </div>
          </div>

          <div>
            <span style={{ color: 'var(--text-dim)', fontSize: '8px' }}>CLASSIFICATION:</span>
            <div style={{ color: matchedTrack ? 'var(--accent-cyan)' : 'var(--text-dim)' }}>
              {matchedTrack ? matchedTrack.current_classification : '--'}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {correlation?.notes || 'No active telemetry correlated with optical sighting.'}
        </div>
      </div>

      {/* Recent Observations Log */}
      <div>
        <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: '6px' }}>
          RECENT OPTICAL SIGHTINGS ({observations.length})
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {observations.slice(-6).reverse().map((obs) => (
            <div
              key={obs.observation_id}
              style={{
                background: 'rgba(6, 9, 14, 0.6)',
                border: '1px solid var(--border-dim)',
                borderRadius: '3px',
                padding: '6px 8px',
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-cyan)' }}>
                <span>{obs.observation_id} [{obs.camera_id}]</span>
                <span style={{ color: 'var(--text-dim)' }}>{formatTimestamp(obs.timestamp)}</span>
              </div>
              <div style={{ color: 'var(--text-main)', marginTop: '2px' }}>
                Detected: <b>{obs.class}</b> ({Math.round(obs.confidence * 100)}%) • Track: <b>{obs.correlation.correlated_drone_id || 'None'}</b>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
