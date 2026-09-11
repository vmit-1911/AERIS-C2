import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Compass, RotateCw, Eye, Layers, Maximize2 } from 'lucide-react';

/**
 * 3D Flight Attitude Director Indicator (ADI) & 3D Airframe Gyro
 * Engineered with Three.js WebGL & MIL-STD-1472 Avionics Visual Standards
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

  // Smooth lerp state
  const targetAttitude = useRef({ pitch: 0, roll: 0, yaw: 0 });
  const currentAttitude = useRef({ pitch: 0, roll: 0, yaw: 0 });

  useEffect(() => {
    targetAttitude.current = { pitch, roll, yaw };
  }, [pitch, roll, yaw]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 280;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(0, 0, 9.5);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting System
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 1.4);
    dirLight1.position.set(6, 10, 8);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xff2e63, 0.7);
    dirLight2.position.set(-6, -8, -4);
    scene.add(dirLight2);

    // ==========================================
    // A. ARTIFICIAL HORIZON (MILITARY EFIS GYRO SPHERE)
    // ==========================================
    const gyroGroup = new THREE.Group();
    scene.add(gyroGroup);
    gyroGroupRef.current = gyroGroup;

    // Canvas texture for Pitch Ladder & Sky/Ground
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 1024;
    textureCanvas.height = 1024;
    const ctx = textureCanvas.getContext('2d');

    // Sky Gradient (Top)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 512);
    skyGrad.addColorStop(0, '#003366');
    skyGrad.addColorStop(1, '#0088cc');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 1024, 512);

    // Ground Gradient (Bottom)
    const groundGrad = ctx.createLinearGradient(0, 512, 0, 1024);
    groundGrad.addColorStop(0, '#553311');
    groundGrad.addColorStop(1, '#1a0d05');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 512, 1024, 512);

    // Horizon Center Line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 512);
    ctx.lineTo(1024, 512);
    ctx.stroke();

    // Pitch Ladder Lines
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const pixelsPerDeg = 512 / 90;
    for (let deg = -80; deg <= 80; deg += 10) {
      if (deg === 0) continue;
      const y = 512 - deg * pixelsPerDeg;
      const isMajor = deg % 20 === 0;
      const lineWidth = isMajor ? 130 : 70;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = isMajor ? 3 : 2;
      ctx.beginPath();
      // Left pitch bar
      ctx.moveTo(512 - lineWidth, y);
      ctx.lineTo(512 - 28, y);
      // Right pitch bar
      ctx.moveTo(512 + 28, y);
      ctx.lineTo(512 + lineWidth, y);
      ctx.stroke();

      // Numerical pitch labels
      ctx.fillText(Math.abs(deg).toString(), 512 - lineWidth - 28, y);
      ctx.fillText(Math.abs(deg).toString(), 512 + lineWidth + 28, y);
    }

    const gyroTexture = new THREE.CanvasTexture(textureCanvas);
    const gyroGeo = new THREE.SphereGeometry(3.6, 64, 64);
    const gyroMat = new THREE.MeshStandardMaterial({
      map: gyroTexture,
      roughness: 0.35,
      metalness: 0.15,
    });
    const gyroSphere = new THREE.Mesh(gyroGeo, gyroMat);
    gyroGroup.add(gyroSphere);

    // Tactical Gimbal Bezel Ring
    const ringGeo = new THREE.TorusGeometry(3.8, 0.08, 16, 120);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.35,
      metalness: 0.85,
      roughness: 0.2
    });
    const gimbalRing = new THREE.Mesh(ringGeo, ringMat);
    scene.add(gimbalRing);

    // ==========================================
    // B. 3D DRONE AIRFRAME MESH
    // ==========================================
    const droneGroup = new THREE.Group();
    scene.add(droneGroup);
    droneGroupRef.current = droneGroup;

    // Fuselage Pod
    const bodyGeo = new THREE.BoxGeometry(1.3, 0.38, 1.9);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0e1626,
      roughness: 0.3,
      metalness: 0.9
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    droneGroup.add(bodyMesh);

    // Sensor Gimbal Dome
    const domeGeo = new THREE.CylinderGeometry(0.32, 0.42, 0.32, 16);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.65,
      transparent: true,
      opacity: 0.85
    });
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.position.set(0, 0.3, 0.25);
    droneGroup.add(domeMesh);

    // Carbon Booms (X-Configuration)
    const armGeo = new THREE.CylinderGeometry(0.065, 0.065, 3.4, 12);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x22355c, metalness: 0.95 });

    const arm1 = new THREE.Mesh(armGeo, armMat);
    arm1.rotation.z = Math.PI / 4;
    arm1.rotation.x = Math.PI / 2;
    droneGroup.add(arm1);

    const arm2 = new THREE.Mesh(armGeo, armMat);
    arm2.rotation.z = -Math.PI / 4;
    arm2.rotation.x = Math.PI / 2;
    droneGroup.add(arm2);

    // 4 Rotors & Spinning Propellers
    const propGeo = new THREE.BoxGeometry(1.25, 0.02, 0.14);
    const propMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.8
    });

    const motorPositions = [
      [1.2, 0.16, 1.2],
      [-1.2, 0.16, 1.2],
      [1.2, 0.16, -1.2],
      [-1.2, 0.16, -1.2]
    ];

    const propMeshes = [];
    motorPositions.forEach(([x, y, z]) => {
      const motorGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.26, 16);
      const motorMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.95 });
      const motor = new THREE.Mesh(motorGeo, motorMat);
      motor.position.set(x, y, z);
      droneGroup.add(motor);

      const prop = new THREE.Mesh(propGeo, propMat);
      prop.position.set(x, y + 0.16, z);
      droneGroup.add(prop);
      propMeshes.push(prop);

      // Strobe Nav Lights (Green right / Red left)
      const ledGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const isStarboard = x > 0;
      const ledColor = isStarboard ? 0x00f59b : 0xff2e63;
      const ledMat = new THREE.MeshBasicMaterial({ color: ledColor });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(x, y - 0.16, z);
      droneGroup.add(led);
    });
    propellersRef.current = propMeshes;

    // Heading Arrow on Nose
    const arrowGeo = new THREE.ConeGeometry(0.22, 0.65, 12);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.set(0, 0.42, 1.35);
    arrow.rotation.x = Math.PI / 2;
    droneGroup.add(arrow);

    gyroGroup.visible = (viewMode === 'ADI');
    droneGroup.visible = (viewMode === 'DRONE');

    // 5. Animation Loop
    let lastTime = performance.now();
    const animate = (time) => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Lerp attitudes
      const lerpSpeed = 12 * delta;
      currentAttitude.current.pitch += (targetAttitude.current.pitch - currentAttitude.current.pitch) * lerpSpeed;
      currentAttitude.current.roll += (targetAttitude.current.roll - currentAttitude.current.roll) * lerpSpeed;
      
      let yawDiff = (targetAttitude.current.yaw - currentAttitude.current.yaw + 180) % 360 - 180;
      currentAttitude.current.yaw = (currentAttitude.current.yaw + yawDiff * lerpSpeed + 360) % 360;

      const pitchRad = THREE.MathUtils.degToRad(currentAttitude.current.pitch);
      const rollRad = THREE.MathUtils.degToRad(currentAttitude.current.roll);
      const yawRad = THREE.MathUtils.degToRad(currentAttitude.current.yaw);

      if (gyroGroupRef.current) {
        gyroGroupRef.current.rotation.x = -pitchRad;
        gyroGroupRef.current.rotation.z = -rollRad;
        gyroGroupRef.current.rotation.y = THREE.MathUtils.degToRad(-currentAttitude.current.yaw * 0.1);
      }

      if (droneGroupRef.current) {
        droneGroupRef.current.rotation.x = pitchRad;
        droneGroupRef.current.rotation.z = -rollRad;
        droneGroupRef.current.rotation.y = -yawRad + Math.PI;

        const propSpeed = 26.0 + speed * 2.0;
        propellersRef.current.forEach((prop, i) => {
          prop.rotation.y += (i % 2 === 0 ? 1 : -1) * propSpeed * delta;
        });
      }

      renderer.render(scene, camera);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // 6. Resize Observer
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

  // View Mode Switcher
  useEffect(() => {
    if (gyroGroupRef.current) gyroGroupRef.current.visible = (viewMode === 'ADI');
    if (droneGroupRef.current) droneGroupRef.current.visible = (viewMode === 'DRONE');
    if (cameraRef.current) {
      if (viewMode === 'DRONE') {
        cameraRef.current.position.set(0, 4.2, 8.2);
        cameraRef.current.lookAt(0, 0, 0);
      } else {
        cameraRef.current.position.set(0, 0, 9.5);
        cameraRef.current.lookAt(0, 0, 0);
      }
    }
  }, [viewMode]);

  return (
    <div className="relative w-full flex flex-col justify-between select-none overflow-hidden rounded-xl border border-tactical-700/80 bg-tactical-900/90 p-3 glass-panel tactical-bracket shadow-2xl">
      {/* Top Instrument Header */}
      <div className="flex items-center justify-between z-20 pb-2 border-b border-tactical-700/60">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyber-cyan animate-pulse shadow-cyan-glow"></div>
          <span className="text-xs font-bold tracking-widest text-cyber-cyan uppercase font-orbitron">
            {viewMode === 'ADI' ? 'ATTITUDE DIRECTOR (ADI)' : '3D AIRFRAME GYRO'}
          </span>
        </div>
        
        <button
          onClick={() => setViewMode(prev => prev === 'ADI' ? 'DRONE' : 'ADI')}
          className="flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-bold bg-tactical-800 hover:bg-tactical-750 border border-cyber-cyan/40 text-cyber-cyan rounded-lg transition-all shadow-sm active:scale-95 font-orbitron"
          title="Toggle between Military ADI Horizon and 3D Airframe"
        >
          {viewMode === 'ADI' ? <Layers size={13} /> : <Eye size={13} />}
          <span>{viewMode === 'ADI' ? '3D AIRFRAME' : 'ADI HORIZON'}</span>
        </button>
      </div>

      {/* 3D WebGL Canvas */}
      <div className="relative w-full h-56 md:h-64 flex items-center justify-center my-1">
        <div 
          ref={mountRef} 
          className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
        />

        {/* Aircraft Reference Symbol (Only in ADI mode) */}
        {viewMode === 'ADI' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-32 h-8 flex items-center justify-center">
              {/* Center Target Dot */}
              <div className="w-3 h-3 rounded-full border-2 border-amber-400 bg-amber-400/40 shadow-amber-glow"></div>
              {/* Left Wing Bar */}
              <div className="absolute left-0 w-10 h-1.5 bg-amber-400 shadow-amber-glow"></div>
              <div className="absolute left-10 top-1.5 w-1.5 h-3.5 bg-amber-400"></div>
              {/* Right Wing Bar */}
              <div className="absolute right-0 w-10 h-1.5 bg-amber-400 shadow-amber-glow"></div>
              <div className="absolute right-10 top-1.5 w-1.5 h-3.5 bg-amber-400"></div>
            </div>

            {/* Top Bank Angle Pointer */}
            <div className="absolute top-3 flex flex-col items-center">
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[9px] border-t-amber-400 shadow-amber-glow"></div>
            </div>
          </div>
        )}
      </div>

      {/* Numerical Pitch, Roll & Heading Metrics */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-tactical-700/60 font-mono">
        <div className="bg-tactical-950/80 border border-tactical-700/70 px-2 py-1.5 rounded-lg">
          <div className="text-[10px] text-slate-400 tracking-wider font-semibold">PITCH</div>
          <div className={`font-bold text-sm ${Math.abs(pitch) > 20 ? 'text-cyber-amber' : 'text-cyber-cyan'}`}>
            {pitch > 0 ? `+${pitch.toFixed(1)}°` : `${pitch.toFixed(1)}°`}
          </div>
        </div>

        <div className="bg-tactical-950/80 border border-tactical-700/70 px-2 py-1.5 rounded-lg">
          <div className="text-[10px] text-slate-400 tracking-wider font-semibold">ROLL</div>
          <div className={`font-bold text-sm ${Math.abs(roll) > 25 ? 'text-cyber-amber' : 'text-cyber-cyan'}`}>
            {roll > 0 ? `+${roll.toFixed(1)}°` : `${roll.toFixed(1)}°`}
          </div>
        </div>

        <div className="bg-tactical-950/80 border border-tactical-700/70 px-2 py-1.5 rounded-lg">
          <div className="text-[10px] text-slate-400 tracking-wider font-semibold">YAW/HDG</div>
          <div className="font-bold text-sm text-cyber-green">
            {Math.round(yaw).toString().padStart(3, '0')}°
          </div>
        </div>
      </div>
    </div>
  );
}
