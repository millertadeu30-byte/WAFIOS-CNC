/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { BenderStep, RotationMode } from '../types';
import { generateWireGeometry, WirePoint } from '../utils/geometry';

// Resample a set of points to ensure dense, even spacing.
// This prevents CatmullRomCurve3 from overshooting or bulging at transitions.
function resamplePoints(points: THREE.Vector3[], maxSpacing: number = 1.0): THREE.Vector3[] {
  if (points.length < 2) return points;
  const resampled: THREE.Vector3[] = [points[0].clone()];
  
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dist = p1.distanceTo(p2);
    
    if (dist > maxSpacing) {
      const numSegments = Math.ceil(dist / maxSpacing);
      for (let j = 1; j < numSegments; j++) {
        const t = j / numSegments;
        resampled.push(new THREE.Vector3().lerpVectors(p1, p2, t));
      }
    }
    resampled.push(p2.clone());
  }
  return resampled;
}

interface ThreeVisualizerProps {
  steps: BenderStep[];
  rotationMode: RotationMode;
  wireDiameter: number;
  hoveredStepIndex: number | null;
  selectedStepIndex: number | null;
  onSelectStep: (idx: number | null) => void;
  animationProgress: number; // 0 to 1 representing progress of the entire piece
  isAnimating: boolean;
  cameraActionTrigger?: { action: 'fit' | 'reset'; ts: number } | null;
  alignmentMode: 'relative' | 'nozzle';
}

export default function ThreeVisualizer({
  steps,
  rotationMode,
  wireDiameter,
  hoveredStepIndex,
  selectedStepIndex,
  onSelectStep,
  animationProgress,
  isAnimating,
  cameraActionTrigger,
  alignmentMode,
}: ThreeVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  
  // Keep references to objects we need to update
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<TrackballControls | null>(null);
  const wireGroupRef = useRef<THREE.Group | null>(null);
  const nozzleGroupRef = useRef<THREE.Group | null>(null);

  // Store dimensions
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });
  const [showHud, setShowHud] = useState(true);

  // Handle ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({
        width: Math.max(100, width),
        height: Math.max(100, height),
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Update renderer & camera when dimensions change
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) return;

    camera.aspect = dimensions.width / dimensions.height;
    camera.updateProjectionMatrix();
    renderer.setSize(dimensions.width, dimensions.height);
  }, [dimensions]);

  // Set up Three.js Scene
  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090b0e'); // Sleek Interface dark theme background
    sceneRef.current = scene;

    // Add a subtle grid floor
    const gridHelper = new THREE.GridHelper(500, 50, '#2d3748', '#121418');
    gridHelper.position.y = -50;
    scene.add(gridHelper);

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(
      45,
      dimensions.width / dimensions.height,
      0.1,
      2000
    );
    // Position camera looking down from front-right closely at the nozzle (bocal)
    camera.position.set(60, 45, 80);
    cameraRef.current = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(dimensions.width, dimensions.height);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Trackball Controls setup
    const controls = new TrackballControls(camera, renderer.domElement);
    controls.rotateSpeed = 4.0;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    controls.noZoom = false;
    controls.noPan = false;
    controls.staticMoving = false;
    controls.dynamicDampingFactor = 0.15;
    controls.target.set(0, 0, 0);  // Center focus on bocal/nozzle
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.5);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight('#ffffff', 0.8);
    dirLight1.position.set(200, 400, 200);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight('#38bdf8', 0.4); // Subtle cyan blue fill light
    dirLight2.position.set(-200, 200, -200);
    scene.add(dirLight2);

    // 6. Nozzle model (Bocal da Máquina)
    const nozzleGroup = new THREE.Group();
    scene.add(nozzleGroup);
    nozzleGroupRef.current = nozzleGroup;
    drawNozzle(nozzleGroup);

    // 7. Wire group
    const wireGroup = new THREE.Group();
    scene.add(wireGroup);
    wireGroupRef.current = wireGroup;

    // 8. Axis helper group (nested inside nozzleGroup, toggleable)
    const axesHelperGroup = new THREE.Group();
    axesHelperGroup.name = 'axesHelperGroup';
    nozzleGroup.add(axesHelperGroup);

    const axesHelper = new THREE.AxesHelper(30); // Compact axes representation
    axesHelperGroup.add(axesHelper);

    // 1. Machine head backing plate for mechanical realism
    const backingGeo = new THREE.CylinderGeometry(14, 14, 4, 32);
    const backingMat = new THREE.MeshStandardMaterial({
      color: '#475569', // Slate steel base
      roughness: 0.5,
      metalness: 0.3,
    });
    const backing = new THREE.Mesh(backingGeo, backingMat);
    backing.rotation.x = Math.PI / 2;
    backing.position.z = -10;
    nozzleGroup.add(backing);

    // 2. Main tapered machine nozzle body (bocal)
    const nozzleBodyGeo = new THREE.CylinderGeometry(3.5, 8.0, 8, 32);
    const nozzleBodyMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1', // Shiny steel nozzle
      roughness: 0.3,
      metalness: 0.4,
    });
    const nozzleBody = new THREE.Mesh(nozzleBodyGeo, nozzleBodyMat);
    nozzleBody.rotation.x = Math.PI / 2;
    nozzleBody.position.z = -4;
    nozzleGroup.add(nozzleBody);

    // 3. Inner guide-shaft tip from which the wire emerges at Z=0
    const nozzleTipGeo = new THREE.CylinderGeometry(2.0, 3.5, 3, 32);
    const nozzleTipMat = new THREE.MeshStandardMaterial({
      color: '#94a3b8', // Slightly darker high-strength steel tip
      roughness: 0.2,
      metalness: 0.5,
    });
    const nozzleTip = new THREE.Mesh(nozzleTipGeo, nozzleTipMat);
    nozzleTip.rotation.x = Math.PI / 2;
    nozzleTip.position.z = -0.5; // Tip meets Z=0 perfectly
    nozzleGroup.add(nozzleTip);

    // Text labels for axes inside axes helper group
    createAxisLabel(axesHelperGroup, 'X', new THREE.Vector3(35, 0, 0), '#ef4444');
    createAxisLabel(axesHelperGroup, 'Y', new THREE.Vector3(0, 35, 0), '#22c55e');
    createAxisLabel(axesHelperGroup, 'Z (Alimentação)', new THREE.Vector3(0, 0, 35), '#3b82f6');

    // 9. Animation loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Clean up
    return () => {
      cancelAnimationFrame(animationId);
      if (renderer && renderer.domElement) {
        renderer.domElement.remove();
      }
      renderer.dispose();
    };
  }, []);

  // Helper to draw a representation of the bender pin and its rotating base plate
  function drawNozzle(group: THREE.Group) {
    // Robust steel pin with a nice clean steel look that is illuminated correctly
    const pinGeo = new THREE.CylinderGeometry(1.8, 1.8, 15, 32);
    const pinMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0', // Clean steel/chrome look
      roughness: 0.25,
      metalness: 0.4,
    });
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(12, 0, 7.5);
    pin.name = 'bendingPin';
    group.add(pin);

    // Add a pin holder disc for mechanical realism (shows that it is part of a rotating ring)
    const holderGeo = new THREE.CylinderGeometry(13, 13, 1.5, 32);
    const holderMat = new THREE.MeshStandardMaterial({
      color: '#334155', // Darker industrial plate
      roughness: 0.4,
      metalness: 0.2,
    });
    const holder = new THREE.Mesh(holderGeo, holderMat);
    holder.rotation.x = Math.PI / 2;
    holder.position.z = -1;
    group.add(holder);
  }

  // Draw 2D labels in 3D canvas
  function createAxisLabel(parent: THREE.Group, text: string, pos: THREE.Vector3, color: string) {
    // Create a small colored sprite or plane for simple label representation
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, 128, 64);
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(text, 64, 40);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.scale.set(16, 8, 1);
    parent.add(sprite);
  }

  // Fit Camera to Wire bounding box (Framing)
  const handleFitCamera = () => {
    const wireGroup = wireGroupRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!wireGroup || !camera || !controls) return;

    // Calculate bounding box of the wire
    const box = new THREE.Box3().setFromObject(wireGroup);
    if (box.isEmpty()) {
      handleResetCamera();
      return;
    }

    const center = new THREE.Vector3();
    box.getCenter(center);

    const size = new THREE.Vector3();
    box.getSize(size);

    // Get max dimension of the bounding box
    const maxDim = Math.max(size.x, size.y, size.z, 20); // minimum 20 to avoid extreme zoom on tiny wire
    
    // We want the camera to be at a distance proportional to the size of the object
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2)));
    
    cameraZ *= 1.4; // Add generous margin padding

    // Position camera at a nice elevated isometric angle
    const direction = new THREE.Vector3(1.1, 0.8, 1.4).normalize();
    const newPos = center.clone().addScaledVector(direction, cameraZ);

    camera.position.copy(newPos);
    camera.up.set(0, 1, 0);
    controls.target.copy(center);
    controls.update();
  };

  // Reset Camera View to focus directly on the Nozzle/Bocal (0,0,0) matching technical drawing view
  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(60, 45, 80);
      cameraRef.current.up.set(0, 1, 0);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  // Listen for parent camera action requests (fit/reset)
  useEffect(() => {
    if (!cameraActionTrigger) return;
    if (cameraActionTrigger.action === 'fit') {
      // Delay slightly to ensure geometry is fully populated/rendered in 3D scene first
      setTimeout(handleFitCamera, 50);
    } else if (cameraActionTrigger.action === 'reset') {
      handleResetCamera();
    }
  }, [cameraActionTrigger]);

  // Handle toggling axis helper lines and sprites when HUD visibility changes
  useEffect(() => {
    const axesGroup = nozzleGroupRef.current?.getObjectByName('axesHelperGroup');
    if (axesGroup) {
      axesGroup.visible = showHud;
    }
  }, [showHud]);

  // Re-render wire whenever steps, rotationMode, wireDiameter, hovered/selected steps, or animation changes
  useEffect(() => {
    const wireGroup = wireGroupRef.current;
    if (!wireGroup) return;

    // Clear previous wire geometry recursively to prevent memory leaks with ArrowHelpers/Sprites
    const disposeNode = (node: THREE.Object3D) => {
      if (node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.Sprite || node instanceof THREE.LineSegments) {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach((m) => m.dispose());
          } else {
            node.material.dispose();
          }
        }
      }
      while (node.children.length > 0) {
        const child = node.children[0];
        node.remove(child);
        disposeNode(child);
      }
    };
    disposeNode(wireGroup);

    // Color Palette for step visualization: Vibrant Neon Fluorescents!
    const stepColors = [
      '#FF2E63', // Neon Rose/Red
      '#FF9F1C', // Neon Orange
      '#F4D03F', // Neon Yellow
      '#2ECC71', // Neon Green
      '#00D2FC', // Vibrant Cyan
      '#7B2CBF', // Vibrant Purple
      '#E040FB', // Bright Magenta
      '#10AC84', // Vibrant Teal
      '#54A0FF', // Bright Sky Blue
      '#FF6B6B', // Coral Red
    ];

    // Determine the active steps to render based on progress or selection
    let activeSteps = [...steps];
    let isSubset = false;
    let activeIndex = steps.length;
    let progressVal = 1.0;

    if (isAnimating || selectedStepIndex !== null) {
      isSubset = true;
      const maxStep = steps.length;

      if (selectedStepIndex !== null) {
        activeIndex = selectedStepIndex;
        progressVal = 1.0;
      } else {
        const rawStep = animationProgress * maxStep; // 0 to maxStep
        activeIndex = Math.max(1, Math.ceil(rawStep));
        progressVal = rawStep % 1 === 0 && rawStep > 0 ? 1.0 : rawStep % 1;
      }

      activeSteps = steps.slice(0, activeIndex).map((s, idx) => {
        if (idx === activeIndex - 1) {
          return {
            ...s,
            l: s.l * progressVal,
            ap: s.ap !== null ? s.ap * progressVal : null,
            ac: s.ac !== null ? s.ac * progressVal : null,
            apCorr: s.apCorr !== null ? s.apCorr * progressVal : null,
            acCorr: s.acCorr !== null ? s.acCorr * progressVal : null,
          };
        }
        return s;
      });
    }

    // Generate wire geometry based on activeSteps
    const { smoothPoints, pointsWithMetadata, bends, stepFrames } = generateWireGeometry(
      activeSteps,
      rotationMode,
      wireDiameter,
      alignmentMode
    );

    if (smoothPoints.length < 2) return;

    // Build the wire by steps
    const maxStepToDraw = activeIndex;

    for (let sIdx = 1; sIdx <= maxStepToDraw; sIdx++) {
      // Find points belonging to this step
      let stepPts = pointsWithMetadata
        .filter((pt) => pt.stepIndex === sIdx)
        .map((pt) => pt.pos);

      // To make them connect seamlessly, we prepend the last point of the previous step
      if (sIdx > 1) {
        const prevStepPts = pointsWithMetadata
          .filter((pt) => pt.stepIndex === sIdx - 1)
          .map((pt) => pt.pos);
        if (prevStepPts.length > 0) {
          stepPts.unshift(prevStepPts[prevStepPts.length - 1]);
        }
      }

      if (stepPts.length < 2) continue;

      // Resample the points to ensure high density and even spacing, which prevents CatmullRomCurve3 from overshooting or bulging at the transition between straight parts and bends
      const resampledPts = resamplePoints(stepPts, 1.0);
      const curve = new THREE.CatmullRomCurve3(resampledPts, false, 'centripetal');
      
      // Tube parameters: curve, tubularSegments, radius, radialSegments, closed
      const radius = wireDiameter / 2;
      const tubeGeometry = new THREE.TubeGeometry(
        curve,
        Math.max(64, resampledPts.length), // Subdivisions proportional to resampled point density for a flawless circular bend shape
        radius,
        16, // Smoother cylinder
        false
      );

      // Determine material color
      const colorHex = stepColors[(sIdx - 1) % stepColors.length];
      const isHovered = hoveredStepIndex === sIdx;
      const isSelected = selectedStepIndex === sIdx;

      let material: THREE.Material;
      if (isHovered || isSelected) {
        // Glowing neon emissive material for active step
        material = new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: isSelected ? 0.9 : 0.5,
          roughness: 0.1,
          metalness: 0.9,
        });
      } else {
        // Standard steel metallic look but tinted with fluorescent step color and slight emissive glow
        material = new THREE.MeshStandardMaterial({
          color: colorHex,
          roughness: 0.2,
          metalness: 0.8,
          emissive: colorHex,
          emissiveIntensity: 0.08,
        });
      }

      const tubeMesh = new THREE.Mesh(tubeGeometry, material);
      tubeMesh.name = `step-${sIdx}`;
      tubeMesh.userData = { stepIndex: sIdx };
      wireGroup.add(tubeMesh);

    }

    // Draw step coordinate frames (local axes) showing relative orientation at each joint
    stepFrames.forEach((frame) => {
      const sIdx = frame.stepIndex;
      const isHovered = hoveredStepIndex === sIdx;
      const isSelected = selectedStepIndex === sIdx;
      const isFocused = isHovered || isSelected;

      // Axis length scales slightly when active/hovered
      const length = isFocused ? 14 : 8;
      const headLength = isFocused ? 4 : 2.5;
      const headWidth = isFocused ? 2.0 : 1.2;
      const opacity = isFocused ? 1.0 : 0.45;

      // X Axis (Right) - Red/Crimson
      const xColor = '#f43f5e';
      const xArrow = new THREE.ArrowHelper(
        frame.right.clone().normalize(),
        frame.position,
        length,
        xColor,
        headLength,
        headWidth
      );
      if (xArrow.line.material instanceof THREE.Material) {
        xArrow.line.material.transparent = true;
        xArrow.line.material.opacity = opacity;
      }
      if (xArrow.cone.material instanceof THREE.Material) {
        xArrow.cone.material.transparent = true;
        xArrow.cone.material.opacity = opacity;
      }
      xArrow.name = `step-frame-axis-x-${sIdx}`;
      wireGroup.add(xArrow);

      // Y Axis (Up) - Green/Emerald
      const yColor = '#10b981';
      const yArrow = new THREE.ArrowHelper(
        frame.up.clone().normalize(),
        frame.position,
        length,
        yColor,
        headLength,
        headWidth
      );
      if (yArrow.line.material instanceof THREE.Material) {
        yArrow.line.material.transparent = true;
        yArrow.line.material.opacity = opacity;
      }
      if (yArrow.cone.material instanceof THREE.Material) {
        yArrow.cone.material.transparent = true;
        yArrow.cone.material.opacity = opacity;
      }
      yArrow.name = `step-frame-axis-y-${sIdx}`;
      wireGroup.add(yArrow);

      // Z Axis (Dir) - Blue/Sky
      const zColor = '#3b82f6';
      const zArrow = new THREE.ArrowHelper(
        frame.dir.clone().normalize(),
        frame.position,
        length,
        zColor,
        headLength,
        headWidth
      );
      if (zArrow.line.material instanceof THREE.Material) {
        zArrow.line.material.transparent = true;
        zArrow.line.material.opacity = opacity;
      }
      if (zArrow.cone.material instanceof THREE.Material) {
        zArrow.cone.material.transparent = true;
        zArrow.cone.material.opacity = opacity;
      }
      zArrow.name = `step-frame-axis-z-${sIdx}`;
      wireGroup.add(zArrow);

      // Draw a small text label sprite for the point if hovered or selected (when HUD is active)
      if (isFocused && showHud) {
        const labelPos = frame.position.clone().addScaledVector(frame.up, length + 2);
        createAxisLabel(wireGroup, `P${sIdx}`, labelPos, '#ffffff');
      }
    });

    // Animate nozzle bending pin rotation
    const pin = nozzleGroupRef.current?.getObjectByName('bendingPin');
    if (pin) {
      // Bending pin rotation is driven by the very last active step in activeSteps
      const activeStep = activeSteps[activeSteps.length - 1];
      if (activeStep && activeStep.ac !== null && isSubset) {
        const acReal = activeStep.ac + (activeStep.acCorr || 0);
        const angleRad = (acReal * Math.PI) / 180;
        pin.position.set(
          12 * Math.cos(angleRad),
          12 * Math.sin(angleRad),
          7.5
        );
      } else {
        pin.position.set(12, 0, 7.5);
      }
    }

    // Camera targeting on select removed to preserve user's manual perspective, zoom, and pan controls

  }, [steps, rotationMode, wireDiameter, hoveredStepIndex, selectedStepIndex, animationProgress, isAnimating, alignmentMode, showHud]);

  return (
    <div ref={containerRef} className="w-full h-full relative" id="three-container">
      {/* ThreeJS mount element */}
      <div ref={mountRef} className="w-full h-full" id="three-canvas-mount" />

      {/* Floating UI HUD elements */}
      {showHud && (
        <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none" id="three-hud-top-left">
          <div className="bg-[#171923]/95 border border-[#2D3748] rounded-lg p-3 text-xs text-slate-300 backdrop-blur-md shadow-lg pointer-events-auto max-w-[260px]">
            <h4 className="font-semibold text-slate-100 mb-1 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              Ponto de Partida (Bocal)
            </h4>
            <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
              O bocal da máquina está fixado na origem <b className="text-slate-200">(0,0,0)</b>. O fio é projetado no eixo Z para frente.
            </p>
            <div className="flex flex-col gap-1 text-[11px] font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-1 bg-red-500 rounded" />
                <span>Eixo X: Horizontal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-1 bg-green-500 rounded" />
                <span>Eixo Y: Vertical</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-1 bg-blue-500 rounded" />
                <span>Eixo Z: Direção de Alimentação</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons overlay */}
      <div className="absolute bottom-4 right-4 flex flex-wrap gap-2 pointer-events-auto" id="three-hud-bottom-right">
        {/* Toggle HUD visibility */}
        <button
          onClick={() => setShowHud(!showHud)}
          className="bg-[#171923]/95 hover:bg-[#2D3748]/90 text-slate-200 border border-[#2D3748] rounded-lg py-1.5 px-3 text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-lg active:scale-95 cursor-pointer backdrop-blur-md"
          title={showHud ? "Ocultar Painéis do Gráfico" : "Mostrar Painéis do Gráfico"}
          id="btn-toggle-hud"
        >
          {showHud ? (
            <>
              <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
              Limpar Gráfico
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Mostrar Painéis
            </>
          )}
        </button>

        {/* Fit Camera to Wire */}
        <button
          onClick={handleFitCamera}
          className="bg-[#171923]/95 hover:bg-[#2D3748]/90 text-slate-200 border border-[#2D3748] rounded-lg py-1.5 px-3 text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-lg active:scale-95 cursor-pointer backdrop-blur-md"
          title="Centralizar e Ajustar Zoom para a Peça Completa"
          id="btn-fit-camera"
        >
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 0l-5 5" />
          </svg>
          Enquadrar Peça
        </button>

        {/* Focus on Nozzle (Origin) */}
        <button
          onClick={handleResetCamera}
          className="bg-[#171923]/95 hover:bg-[#2D3748]/90 text-slate-200 border border-[#2D3748] rounded-lg py-1.5 px-3 text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-lg active:scale-95 cursor-pointer backdrop-blur-md"
          title="Focar Câmera no Bocal de Origem (0,0,0)"
          id="btn-reset-camera"
        >
          <svg className="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Focar Bocal
        </button>
      </div>

      {/* Touch instruction overlays */}
      {showHud && (
        <div className="absolute top-4 right-4 bg-[#171923]/40 border border-[#2D3748] rounded-lg p-2 text-[10px] text-slate-400 backdrop-blur-sm pointer-events-none select-none max-w-[150px] leading-snug">
          <p>🖱️ Botão esquerdo: Girar</p>
          <p>🖱️ Roda scroll: Zoom</p>
          <p>🖱️ Botão direito: Mover</p>
        </div>
      )}
    </div>
  );
}
