import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Compass, RotateCw, Eye, Layers } from 'lucide-react';

/**
 * 3D Flight Attitude Indicator (Attitude Director Indicator - ADI & 3D Drone View)
 * Powered by Three.js WebGL Engine
 */
export default function AttitudeIndicator({ 
  pitch = 0, 
  roll = 0, 
  yaw = 0, 
  speed = 0, 
  alt = 0 
}) {
  const mountRef = useRef(null);
  const [viewMode, setViewMode] = useState('ADI'); // 'ADI' (Artificial Horizon) or 'DRONE' (3D Quadcopter)
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const gyroGroupRef = useRef(null);
  const droneGroupRef = useRef(null);
  const propellersRef = useRef([]);
  const animFrameIdRef = useRef(null);

  // Store target attitudes for smooth lerping
  const targetAttitude = useRef({ pitch: 0, roll: 0, yaw: 0 });
  const currentAttitude = useRef({ pitch: 0, roll: 0, yaw: 0 });

  useEffect(() => {
    targetAttitude.current = { pitch, roll, yaw };
  }, [pitch, roll, yaw]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 320;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 10);
    cameraRef.current = camera;

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00ffcc, 1.2);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xff2a5f, 0.8);
    dirLight2.position.set(-5, -10, -5);
    scene.add(dirLight2);

    // ==========================================
    // A. ARTIFICIAL HORIZON (ADI GYRO SPHERE)
    // ==========================================
    const gyroGroup = new THREE.Group();
    scene.add(gyroGroup);
    gyroGroupRef.current = gyroGroup;

    // Create custom canvas texture for the gyro ball (Sky / Ground / Pitch ladder)
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 1024;
    textureCanvas.height = 1024;
    const ctx = textureCanvas.getContext('2d');

    // Sky gradient (Top half)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 512);
    skyGrad.addColorStop(0, '#005588');
    skyGrad.addColorStop(1, '#0099cc');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 1024, 512);

    // Ground gradient (Bottom half)
    const groundGrad = ctx.createLinearGradient(0, 512, 0, 1024);
    groundGrad.addColorStop(0, '#553311');
    groundGrad.addColorStop(1, '#221105');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 512, 1024, 512);

    // Horizon line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 512);
    ctx.lineTo(1024, 512);
    ctx.stroke();

    // Pitch ladder markings
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Pitch steps: 10, 20, 30, 40, 50, 60, 70, 80 degrees
    const pixelsPerDeg = 512 / 90;
    for (let deg = -80; deg <= 80; deg += 10) {
      if (deg === 0) continue;
      const y = 512 - deg * pixelsPerDeg;
      const isMajor = deg % 20 === 0;
      const lineWidth = isMajor ? 120 : 60;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      // Left tick
      ctx.moveTo(512 - lineWidth, y);
      ctx.lineTo(512 - 25, y);
      // Right tick
      ctx.moveTo(512 + 25, y);
      ctx.lineTo(512 + lineWidth, y);
      ctx.stroke();

      // Degree labels
      ctx.fillText(Math.abs(deg).toString(), 512 - lineWidth - 25, y);
      ctx.fillText(Math.abs(deg).toString(), 512 + lineWidth + 25, y);
    }

    const gyroTexture = new THREE.CanvasTexture(textureCanvas);
    const gyroGeo = new THREE.SphereGeometry(3.6, 64, 64);
    const gyroMat = new THREE.MeshStandardMaterial({
      map: gyroTexture,
      roughness: 0.4,
      metalness: 0.2,
      side: THREE.FrontSide
    });
    const gyroSphere = new THREE.Mesh(gyroGeo, gyroMat);
    gyroGroup.add(gyroSphere);

    // Outer Gimbal Ring / Compass Bezel
    const ringGeo = new THREE.TorusGeometry(3.8, 0.08, 16, 100);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ffcc,
      emissiveIntensity: 0.3,
      metalness: 0.8,
      roughness: 0.2
    });
    const gimbalRing = new THREE.Mesh(ringGeo, ringMat);
    scene.add(gimbalRing);

    // ==========================================
    // B. 3D DRONE MODEL MESH
    // ==========================================
    const droneGroup = new THREE.Group();
    scene.add(droneGroup);
    droneGroupRef.current = droneGroup;

    // Central Fuselage / Pod
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.35, 1.8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x141b2d,
      roughness: 0.3,
      metalness: 0.85
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    droneGroup.add(bodyMesh);

    // Canopy / Sensor dome
    const domeGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.3, 16);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ffcc,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.85
    });
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.position.set(0, 0.28, 0.2);
    droneGroup.add(domeMesh);

    // Quad Arms (4 Carbon Booms in X configuration)
    const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.2, 12);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x2d3c5f, metalness: 0.9 });

    const arm1 = new THREE.Mesh(armGeo, armMat);
    arm1.rotation.z = Math.PI / 4;
    arm1.rotation.x = Math.PI / 2;
    droneGroup.add(arm1);

    const arm2 = new THREE.Mesh(armGeo, armMat);
    arm2.rotation.z = -Math.PI / 4;
    arm2.rotation.x = Math.PI / 2;
    droneGroup.add(arm2);

    // 4 Rotors & Propellers
    const propGeo = new THREE.BoxGeometry(1.2, 0.02, 0.12);
    const propMat = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.75
    });

    const motorPositions = [
      [1.15, 0.15, 1.15],
      [-1.15, 0.15, 1.15],
      [1.15, 0.15, -1.15],
      [-1.15, 0.15, -1.15]
    ];

    const propMeshes = [];
    motorPositions.forEach(([x, y, z]) => {
      // Motor base
      const motorGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.25, 16);
      const motorMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.95 });
      const motor = new THREE.Mesh(motorGeo, motorMat);
      motor.position.set(x, y, z);
      droneGroup.add(motor);

      // Propeller blade
      const prop = new THREE.Mesh(propGeo, propMat);
      prop.position.set(x, y + 0.15, z);
      droneGroup.add(prop);
      propMeshes.push(prop);

      // LED Nav light under motor
      const ledGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const isStarboard = x > 0;
      const ledColor = isStarboard ? 0x00ff66 : 0xff2a5f; // Green on right, Red on left
      const ledMat = new THREE.MeshBasicMaterial({ color: ledColor });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(x, y - 0.15, z);
      droneGroup.add(led);
    });
    propellersRef.current = propMeshes;

    // Heading Arrow on Drone
    const arrowGeo = new THREE.ConeGeometry(0.2, 0.6, 12);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.set(0, 0.4, 1.3);
    arrow.rotation.x = Math.PI / 2;
    droneGroup.add(arrow);

    // Initial visibility based on mode
    gyroGroup.visible = (viewMode === 'ADI');
    droneGroup.visible = (viewMode === 'DRONE');

    // 5. Animation Loop
    let lastTime = performance.now();
    const animate = (time) => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Smooth interpolation (LERP)
      const lerpSpeed = 12 * delta;
      currentAttitude.current.pitch += (targetAttitude.current.pitch - currentAttitude.current.pitch) * lerpSpeed;
      currentAttitude.current.roll += (targetAttitude.current.roll - currentAttitude.current.roll) * lerpSpeed;
      
      // Yaw wrapping
      let yawDiff = (targetAttitude.current.yaw - currentAttitude.current.yaw + 180) % 360 - 180;
      currentAttitude.current.yaw = (currentAttitude.current.yaw + yawDiff * lerpSpeed + 360) % 360;

      const pitchRad = THREE.MathUtils.degToRad(currentAttitude.current.pitch);
      const rollRad = THREE.MathUtils.degToRad(currentAttitude.current.roll);
      const yawRad = THREE.MathUtils.degToRad(currentAttitude.current.yaw);

      if (gyroGroupRef.current) {
        // Gyro horizon: Pitch moves X axis, Roll rotates Z axis
        gyroGroupRef.current.rotation.x = -pitchRad;
        gyroGroupRef.current.rotation.z = -rollRad;
        gyroGroupRef.current.rotation.y = THREE.MathUtils.degToRad(-currentAttitude.current.yaw * 0.1);
      }

      if (droneGroupRef.current) {
        // 3D Drone Model orientation
        droneGroupRef.current.rotation.x = pitchRad;
        droneGroupRef.current.rotation.z = -rollRad;
        droneGroupRef.current.rotation.y = -yawRad + Math.PI;

        // Spin propellers
        const propSpeed = 25.0 + speed * 1.5;
        propellersRef.current.forEach((prop, i) => {
          prop.rotation.y += (i % 2 === 0 ? 1 : -1) * propSpeed * delta;
        });
      }

      renderer.render(scene, camera);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // 6. Responsive Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update visibility on mode change
  useEffect(() => {
    if (gyroGroupRef.current) gyroGroupRef.current.visible = (viewMode === 'ADI');
    if (droneGroupRef.current) droneGroupRef.current.visible = (viewMode === 'DRONE');
    if (cameraRef.current) {
      if (viewMode === 'DRONE') {
        cameraRef.current.position.set(0, 4, 8);
        cameraRef.current.lookAt(0, 0, 0);
      } else {
        cameraRef.current.position.set(0, 0, 9);
        cameraRef.current.lookAt(0, 0, 0);
      }
    }
  }, [viewMode]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden rounded-xl border border-tactical-700 bg-tactical-950/80 p-2">
      {/* Top Instrument Header */}
      <div className="absolute top-2 left-3 right-3 flex items-center justify-between z-20 pointer-events-auto">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse"></div>
          <span className="text-xs font-bold tracking-widest text-cyber-cyan uppercase font-orbitron">
            {viewMode === 'ADI' ? 'ATTITUDE DIRECTOR (ADI)' : '3D AIRFRAME GYRO'}
          </span>
        </div>
        
        {/* Toggle Mode Button */}
        <button
          onClick={() => setViewMode(prev => prev === 'ADI' ? 'DRONE' : 'ADI')}
          className="flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-semibold bg-tactical-800/90 hover:bg-tactical-700 border border-cyber-cyan/30 text-cyber-cyan rounded transition-all shadow-sm active:scale-95"
          title="Switch between Artificial Horizon and 3D Drone Model"
        >
          {viewMode === 'ADI' ? <Layers size={13} /> : <Eye size={13} />}
          <span>{viewMode === 'ADI' ? '3D MESH' : 'ADI HORIZON'}</span>
        </button>
      </div>

      {/* 3D WebGL Canvas Container */}
      <div 
        ref={mountRef} 
        className="w-full h-64 md:h-72 flex items-center justify-center cursor-grab active:cursor-grabbing"
      />

      {/* Overlaid Tactical Crosshairs & Aircraft Fixed Reference (Only shown in ADI mode) */}
      {viewMode === 'ADI' && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* Aircraft Reference Symbol (Yellow/Cyan Wings) */}
          <div className="relative w-28 h-8 flex items-center justify-center">
            {/* Center dot */}
            <div className="w-3 h-3 rounded-full border-2 border-amber-400 bg-amber-400/30"></div>
            {/* Left Wing */}
            <div className="absolute left-0 w-9 h-1.5 bg-amber-400 shadow-amber-glow"></div>
            <div className="absolute left-9 top-1.5 w-1.5 h-3 bg-amber-400"></div>
            {/* Right Wing */}
            <div className="absolute right-0 w-9 h-1.5 bg-amber-400 shadow-amber-glow"></div>
            <div className="absolute right-9 top-1.5 w-1.5 h-3 bg-amber-400"></div>
          </div>

          {/* Roll Bank Angle Index (Arc at top) */}
          <div className="absolute top-10 flex flex-col items-center">
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-amber-400"></div>
          </div>
        </div>
      )}

      {/* Live Numerical Readouts on Bottom Bar */}
      <div className="w-full mt-1 grid grid-cols-3 gap-1.5 text-center text-xs z-10">
        <div className="bg-tactical-900/90 border border-tactical-700/80 px-2 py-1.5 rounded">
          <div className="text-[10px] text-slate-400 tracking-wider">PITCH</div>
          <div className={`font-bold font-mono text-sm ${Math.abs(pitch) > 20 ? 'text-cyber-amber' : 'text-cyber-cyan'}`}>
            {pitch > 0 ? `+${pitch.toFixed(1)}°` : `${pitch.toFixed(1)}°`}
          </div>
        </div>
        <div className="bg-tactical-900/90 border border-tactical-700/80 px-2 py-1.5 rounded">
          <div className="text-[10px] text-slate-400 tracking-wider">ROLL</div>
          <div className={`font-bold font-mono text-sm ${Math.abs(roll) > 25 ? 'text-cyber-amber' : 'text-cyber-cyan'}`}>
            {roll > 0 ? `+${roll.toFixed(1)}°` : `${roll.toFixed(1)}°`}
          </div>
        </div>
        <div className="bg-tactical-900/90 border border-tactical-700/80 px-2 py-1.5 rounded">
          <div className="text-[10px] text-slate-400 tracking-wider">HEADING</div>
          <div className="font-bold font-mono text-sm text-cyber-green">
            {Math.round(yaw).toString().padStart(3, '0')}°
          </div>
        </div>
      </div>
    </div>
  );
}
