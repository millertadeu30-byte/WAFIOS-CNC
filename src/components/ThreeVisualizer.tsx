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
  cameraDirection?: { x: number; y: number; z: number } | null;
  activeModelName?: string;
  isFrozen?: boolean;
  setIsFrozen?: (val: boolean) => void;
  onStepsChange?: (steps: BenderStep[]) => void;
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
  cameraDirection,
  activeModelName,
  isFrozen = false,
  setIsFrozen,
  onStepsChange,
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
  const gridFloorRef = useRef<THREE.GridHelper | null>(null);
  const gridVerticalRef = useRef<THREE.GridHelper | null>(null);
  const gridWRef = useRef<THREE.GridHelper | null>(null);

  // Store dimensions
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });
  const [showHud, setShowHud] = useState(true);
  const [showMachine, setShowMachine] = useState(true);
  const [showFloorGrid, setShowFloorGrid] = useState(true);
  const [showVerticalGrid, setShowVerticalGrid] = useState(true);
  const [showWGrid, setShowWGrid] = useState(true);
  const [customGDirection, setCustomGDirection] = useState<{ x: number; y: number; z: number } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [isCameraLocked, setIsCameraLocked] = useState(false);

  // Set camera to specific orthogonal 90° views relative to the grid
  const handlePresetView = (view: 'top' | 'bottom' | 'left' | 'right' | 'front' | 'iso') => {
    if (isCameraLocked) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const wireGroup = wireGroupRef.current;
    if (!camera || !controls) return;

    // Calculate center target of wire geometry
    const box = new THREE.Box3().setFromObject(wireGroup || new THREE.Group());
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    if (!box.isEmpty()) {
      box.getCenter(center);
      box.getSize(size);
    } else {
      center.set(0, 0, 0);
      size.set(40, 40, 40);
    }

    const maxDim = Math.max(size.x, size.y, size.z, 25);
    const dist = maxDim * 2.5;

    switch (view) {
      case 'top': // Vista Superior 90° da grade
        camera.position.set(center.x, center.y + dist, center.z + 0.001);
        camera.up.set(0, 0, -1);
        break;
      case 'bottom': // Vista Inferior 90° da grade
        camera.position.set(center.x, center.y - dist, center.z + 0.001);
        camera.up.set(0, 0, 1);
        break;
      case 'left': // Vista Esquerda 90° da grade (-X)
        camera.position.set(center.x - dist, center.y, center.z);
        camera.up.set(0, 1, 0);
        break;
      case 'right': // Vista Direita 90° da grade (+X)
        camera.position.set(center.x + dist, center.y, center.z);
        camera.up.set(0, 1, 0);
        break;
      case 'front': // Vista Frontal 90° (+Z)
        camera.position.set(center.x, center.y, center.z + dist);
        camera.up.set(0, 1, 0);
        break;
      case 'iso': // Isometric 3D
        camera.position.set(center.x + dist * 0.7, center.y + dist * 0.7, center.z + dist * 0.7);
        camera.up.set(0, 1, 0);
        break;
    }

    controls.target.copy(center);
    controls.update();
  };
  const [padPosition, setPadPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [padScale, setPadScale] = useState(1.0);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  const handlePadPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('select')) {
      return;
    }
    
    const elem = e.currentTarget;
    elem.setPointerCapture(e.pointerId);
    
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: padPosition.x,
      posY: padPosition.y,
    };
    
    e.stopPropagation();
  };

  const handlePadPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    
    setPadPosition({
      x: dragStartRef.current.posX + dx,
      y: dragStartRef.current.posY + dy,
    });
    
    e.stopPropagation();
  };

  const handlePadPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    
    const elem = e.currentTarget;
    elem.releasePointerCapture(e.pointerId);
    
    dragStartRef.current = null;
    e.stopPropagation();
  };

  // Load custom camera direction bound to these specific steps when they change
  useEffect(() => {
    const stepsKey = steps.map(s => `${s.l}_${s.ac}`).join('|');
    const saved = localStorage.getItem(`wafios_custom_g_dir_${stepsKey}`);
    if (saved) {
      try {
        setCustomGDirection(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse custom camera orientation', e);
      }
    } else {
      setCustomGDirection(null);
    }
  }, [steps]);

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

    if (renderer.domElement) {
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.top = '0';
      renderer.domElement.style.left = '0';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
    }

    // Pass false as 3rd parameter (updateStyle) so Three.js does NOT mutate canvas style width/height px,
    // which eliminates the cyclic ResizeObserver loop that causes the window to shrink over time!
    renderer.setSize(dimensions.width, dimensions.height, false);
  }, [dimensions]);

  // Set up Three.js Scene
  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090b0e'); // Sleek Interface dark theme background
    sceneRef.current = scene;

    // Add a subtle grid floor positioned neatly under the bocal/wire plane
    const gridFloor = new THREE.GridHelper(500, 50, '#334155', '#1e293b');
    gridFloor.position.y = -10;
    scene.add(gridFloor);
    gridFloorRef.current = gridFloor;

    // Add a vertical wall grid aligned in 3D space (XY plane - Grade V)
    const gridVertical = new THREE.GridHelper(500, 50, '#334155', '#1e293b');
    gridVertical.rotation.x = Math.PI / 2;
    gridVertical.position.z = -10;
    scene.add(gridVertical);
    gridVerticalRef.current = gridVertical;

    // Add a vertical side wall grid aligned in 3D space (YZ plane - Grade W)
    const gridW = new THREE.GridHelper(500, 50, '#334155', '#1e293b');
    gridW.rotation.z = Math.PI / 2;
    gridW.position.x = -10;
    scene.add(gridW);
    gridWRef.current = gridW;

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
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.setSize(dimensions.width, dimensions.height, false);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Trackball Controls setup (Sleek, gentle, high-precision CAD control)
    const controls = new TrackballControls(camera, renderer.domElement);
    controls.rotateSpeed = 1.2; // Smooth and precise CAD rotation
    controls.zoomSpeed = 0.9;
    controls.panSpeed = 0.6;
    controls.noZoom = false;
    controls.noPan = false;
    controls.staticMoving = false;
    controls.dynamicDampingFactor = 0.08; // Smooth deceleration and inertia
    controls.target.set(0, 0, 0);  // Center focus on bocal/nozzle
    controls.enabled = !isCameraLocked;
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

  // Draw permanent highly legible sequence numbers on each joint
  function createStepNumberLabel(parent: THREE.Group, numberText: string, pos: THREE.Vector3, isSelected: boolean, color: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 128, 128);
      
      // We want ONLY the number, in the color of the bends ("da cor das dobras somente o numero")
      // To ensure readability on both dark and light zones, we use a neat black outline.
      ctx.font = isSelected ? 'bold 84px "Arial Black", Arial, sans-serif' : 'bold 70px "Arial Black", Arial, sans-serif';
      
      // Stroke (outline)
      ctx.strokeStyle = '#090d16'; // Rich dark outline for contrast
      ctx.lineWidth = 14;
      ctx.lineJoin = 'round';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(numberText, 64, 64);
      
      // Fill with the step's specific color
      ctx.fillStyle = color;
      ctx.fillText(numberText, 64, 64);

      if (isSelected) {
        // Simple elegant thin outline ring around the number to indicate active selection
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(64, 64, 48, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ 
      map: texture,
      depthTest: false, // Force render on top of the wire so it is ALWAYS visible and sharp!
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.name = `step-sprite-${numberText}`;
    sprite.userData = { stepIndex: parseInt(numberText, 10) };
    const scaleSize = isSelected ? 12 : 9.5;
    sprite.scale.set(scaleSize, scaleSize, 1);
    sprite.renderOrder = 999; // Draw over other transparent or mesh items
    parent.add(sprite);
  }

  // Fit Camera to Wire bounding box (Framing)
  const handleFitCamera = () => {
    if (isCameraLocked) return;
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
    const direction = cameraDirection
      ? new THREE.Vector3(cameraDirection.x, cameraDirection.y, cameraDirection.z).normalize()
      : new THREE.Vector3(1.1, 0.8, 1.4).normalize();
    const newPos = center.clone().addScaledVector(direction, cameraZ);

    camera.position.copy(newPos);
    camera.up.set(0, 1, 0);
    controls.target.copy(center);
    controls.update();
  };

  // Set camera to look from Visão G (perfect isometric perspective matching PDF region G)
  const handleVisaoG = () => {
    if (isCameraLocked) return;
    const wireGroup = wireGroupRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    // Calculate bounding box of the wire to center on it
    const box = new THREE.Box3().setFromObject(wireGroup || new THREE.Group());
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    if (!box.isEmpty()) {
      box.getCenter(center);
      box.getSize(size);
    } else {
      center.set(10, 10, 20);
      size.set(40, 40, 60);
    }

    const maxDim = Math.max(size.x, size.y, size.z, 30);
    const fov = camera.fov * (Math.PI / 180);
    let cameraDistance = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.55;

    // Direction vector pointing to align with the PDF G perspective
    const direction = new THREE.Vector3(-1.45, 1.15, -1.25).normalize();
    const newPos = center.clone().addScaledVector(direction, cameraDistance);

    camera.position.copy(newPos);
    camera.up.set(0, 1, 0);
    controls.target.copy(center);
    controls.update();
  };

  // Reset Camera View to focus directly on the Nozzle/Bocal (0,0,0) matching technical drawing view
  const handleResetCamera = () => {
    if (isCameraLocked) return;
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(60, 45, 80);
      cameraRef.current.up.set(0, 1, 0);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  // Raycaster click handler with drag prevention
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    let startX = 0;
    let startY = 0;

    const handlePointerDown = (event: PointerEvent) => {
      startX = event.clientX;
      startY = event.clientY;
    };

    const handlePointerUp = (event: PointerEvent) => {
      const diffX = Math.abs(event.clientX - startX);
      const diffY = Math.abs(event.clientY - startY);
      
      // If pointer moved more than 6 pixels, it is a drag, not a click
      if (diffX > 6 || diffY > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.params.Sprite = { threshold: 5 };
      raycaster.params.Line = { threshold: 3.5 };
      
      if (cameraRef.current && wireGroupRef.current) {
        raycaster.setFromCamera(mouse, cameraRef.current);
        const intersects = raycaster.intersectObjects(wireGroupRef.current.children, true);
        
        const hit = intersects.find(
          (intersect) =>
            intersect.object.userData &&
            typeof intersect.object.userData.stepIndex === 'number'
        );
        
        if (hit) {
          const stepIdx = hit.object.userData.stepIndex;
          onSelectStep(stepIdx);
        }
      }
    };

    const canvasElement = renderer.domElement;
    canvasElement.addEventListener('pointerdown', handlePointerDown);
    canvasElement.addEventListener('pointerup', handlePointerUp);
    
    return () => {
      canvasElement.removeEventListener('pointerdown', handlePointerDown);
      canvasElement.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onSelectStep, steps]);

  // Helper to adjust the sign of AP or AC of the selected step
  const handleAdjustSign = (field: 'ap' | 'ac', direction: 'positive' | 'negative') => {
    if (selectedStepIndex === null || !onStepsChange) return;
    
    const stepIndexInArray = selectedStepIndex - 1;
    const currentStep = steps[stepIndexInArray];
    if (!currentStep) return;

    let value = currentStep[field];
    
    // If the value is null or 0, we can give it a default value
    if (value === null || value === 0) {
      value = 90; // Default angle magnitude
    }

    const magnitude = Math.abs(value);
    const newValue = direction === 'positive' ? magnitude : -magnitude;

    // Update parent state
    const updatedSteps = steps.map((s, idx) => {
      if (idx === stepIndexInArray) {
        return {
          ...s,
          [field]: newValue,
        };
      }
      return s;
    });

    onStepsChange(updatedSteps);
  };

  // Helper to rotate AP by some degrees
  const handleRotateAP = (degrees: number) => {
    if (selectedStepIndex === null || !onStepsChange) return;

    const stepIndexInArray = selectedStepIndex - 1;
    const currentStep = steps[stepIndexInArray];
    if (!currentStep) return;

    let currentAp = currentStep.ap ?? 0;
    let newAp = currentAp + degrees;

    // Normalize newAp between -180 and 180
    if (newAp > 180) newAp -= 360;
    if (newAp < -180) newAp += 360;

    const updatedSteps = steps.map((s, idx) => {
      if (idx === stepIndexInArray) {
        return {
          ...s,
          ap: newAp,
        };
      }
      return s;
    });

    onStepsChange(updatedSteps);
  };

  // Helper to invert positive/negative sign
  const handleInvertSign = (field: 'ap' | 'ac') => {
    if (selectedStepIndex === null || !onStepsChange) return;

    const stepIndexInArray = selectedStepIndex - 1;
    const currentStep = steps[stepIndexInArray];
    if (!currentStep) return;

    const currentValue = currentStep[field] ?? 0;
    const newValue = -currentValue;

    const updatedSteps = steps.map((s, idx) => {
      if (idx === stepIndexInArray) {
        return {
          ...s,
          [field]: newValue,
        };
      }
      return s;
    });

    onStepsChange(updatedSteps);
  };

  const lastProcessedCameraTsRef = useRef<number | null>(null);

  // Listen for parent camera action requests (fit/reset)
  useEffect(() => {
    if (!cameraActionTrigger || isCameraLocked) return;
    if (lastProcessedCameraTsRef.current === cameraActionTrigger.ts) return;

    lastProcessedCameraTsRef.current = cameraActionTrigger.ts;

    if (cameraActionTrigger.action === 'fit') {
      // Delay slightly to ensure geometry is fully populated/rendered in 3D scene first
      setTimeout(handleFitCamera, 50);
    } else if (cameraActionTrigger.action === 'reset') {
      handleResetCamera();
    }
  }, [cameraActionTrigger, isCameraLocked]);

  // Handle toggling axis helper lines and sprites when HUD visibility changes
  useEffect(() => {
    const axesGroup = nozzleGroupRef.current?.getObjectByName('axesHelperGroup');
    if (axesGroup) {
      axesGroup.visible = showHud;
    }
  }, [showHud]);

  // Handle toggling machine parts (nozzle, backing, pins) visibility
  useEffect(() => {
    if (nozzleGroupRef.current) {
      nozzleGroupRef.current.visible = showMachine;
    }
  }, [showMachine]);

  // Handle toggling horizontal floor grid visibility
  useEffect(() => {
    if (gridFloorRef.current) {
      gridFloorRef.current.visible = showFloorGrid;
    }
  }, [showFloorGrid]);

  // Handle toggling vertical wall grid visibility
  useEffect(() => {
    if (gridVerticalRef.current) {
      gridVerticalRef.current.visible = showVerticalGrid;
    }
  }, [showVerticalGrid]);

  // Handle toggling side wall grid (Grade W) visibility
  useEffect(() => {
    if (gridWRef.current) {
      gridWRef.current.visible = showWGrid;
    }
  }, [showWGrid]);

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

    if (!isFrozen && (isAnimating || selectedStepIndex !== null)) {
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
    const maxStepToDraw = isFrozen ? steps.length : activeIndex;

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

      // Filter out duplicate or near-identical points to prevent 0-length tangent vectors and mesh distortion
      const cleanStepPts: THREE.Vector3[] = [];
      for (const pt of stepPts) {
        if (cleanStepPts.length === 0 || cleanStepPts[cleanStepPts.length - 1].distanceTo(pt) > 0.05) {
          cleanStepPts.push(pt);
        }
      }

      if (cleanStepPts.length < 2) continue;

      let curve: THREE.Curve<THREE.Vector3>;
      if (cleanStepPts.length === 2) {
        curve = new THREE.LineCurve3(cleanStepPts[0], cleanStepPts[1]);
      } else {
        curve = new THREE.CatmullRomCurve3(cleanStepPts, false, 'centripetal', 0.05);
      }
      
      const isHovered = hoveredStepIndex === sIdx;
      const isSelected = selectedStepIndex === sIdx;

      // Tube parameters: curve, tubularSegments, radius, radialSegments, closed
      const radius = (isFrozen && (isHovered || isSelected))
        ? (wireDiameter / 2) * 1.4
        : (wireDiameter / 2);

      const tubeGeometry = new THREE.TubeGeometry(
        curve,
        Math.max(24, cleanStepPts.length * 6), // Subdivisions proportional to the exact smooth points
        radius,
        14, // Smoother cylinder radial segments
        false
      );

      // Determine material color
      const colorHex = stepColors[(sIdx - 1) % stepColors.length];

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

      // Draw permanent highly legible sequence numbers for each step (1, 2, 3...)
      if (showHud) {
        // Place the number badge offset from the wire axis to be beautifully clean
        const offsetDirection = frame.up.clone().add(frame.right).normalize();
        const numPos = frame.position.clone().addScaledVector(offsetDirection, 8.0);
        const colHex = stepColors[(sIdx - 1) % stepColors.length];
        createStepNumberLabel(wireGroup, String(sIdx), numPos, isSelected, colHex);
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

  }, [steps, rotationMode, wireDiameter, hoveredStepIndex, selectedStepIndex, animationProgress, isAnimating, alignmentMode, showHud, isFrozen]);

  useEffect(() => {
    if (controlsRef.current && cameraRef.current) {
      controlsRef.current.enabled = !isCameraLocked;
      if (!isCameraLocked) {
        // Force update trackball controls state to current camera pose so unlocking view maintains exact position with 0 jump
        controlsRef.current.update();
      }
    }
  }, [isCameraLocked]);

  return (
    <div ref={containerRef} className="w-full h-full relative" id="three-container">
      {/* ThreeJS mount element */}
      <div ref={mountRef} className="w-full h-full" id="three-canvas-mount" />

      {/* Top Right Camera View Presets & Lock Bar (FOTO 1 REQUIREMENT) */}
      {showHud && (
        <div className="absolute top-4 right-4 flex flex-wrap items-center gap-1 bg-[#121418]/90 border border-[#2D3748] rounded-xl p-1 shadow-2xl backdrop-blur-md pointer-events-auto z-40" id="three-hud-top-right-views">
          <span className="text-[9px] font-mono font-bold text-slate-400 px-2 uppercase tracking-wider hidden sm:inline">
            Vistas 90°:
          </span>
          <button
            onClick={() => handlePresetView('top')}
            className="bg-[#1A202C] hover:bg-blue-600/30 text-slate-200 hover:text-white border border-[#2D3748] hover:border-blue-500/50 rounded-lg px-2 py-1 text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Vista Superior a 90° da Grade"
            id="btn-view-top"
          >
            Superior
          </button>
          <button
            onClick={() => handlePresetView('bottom')}
            className="bg-[#1A202C] hover:bg-blue-600/30 text-slate-200 hover:text-white border border-[#2D3748] hover:border-blue-500/50 rounded-lg px-2 py-1 text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Vista Inferior a 90° da Grade"
            id="btn-view-bottom"
          >
            Inferior
          </button>
          <button
            onClick={() => handlePresetView('left')}
            className="bg-[#1A202C] hover:bg-blue-600/30 text-slate-200 hover:text-white border border-[#2D3748] hover:border-blue-500/50 rounded-lg px-2 py-1 text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Vista Lateral Esquerda a 90° da Grade"
            id="btn-view-left"
          >
            Esquerda
          </button>
          <button
            onClick={() => handlePresetView('right')}
            className="bg-[#1A202C] hover:bg-blue-600/30 text-slate-200 hover:text-white border border-[#2D3748] hover:border-blue-500/50 rounded-lg px-2 py-1 text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Vista Lateral Direita a 90° da Grade"
            id="btn-view-right"
          >
            Direita
          </button>
          <button
            onClick={() => handlePresetView('front')}
            className="bg-[#1A202C] hover:bg-blue-600/30 text-slate-200 hover:text-white border border-[#2D3748] hover:border-blue-500/50 rounded-lg px-2 py-1 text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Vista Frontal a 90° da Grade"
            id="btn-view-front"
          >
            Frontal
          </button>

          {/* TRAVAR VISTA BUTTON */}
          <button
            onClick={() => setIsCameraLocked(!isCameraLocked)}
            className={`ml-1 px-2.5 py-1 text-[10px] font-bold rounded-lg border flex items-center gap-1 transition-all cursor-pointer shadow-md active:scale-95 ${
              isCameraLocked
                ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 shadow-[0_0_10px_rgba(217,119,6,0.4)]'
                : 'bg-[#1A202C] hover:bg-[#2D3748] text-slate-300 border-[#2D3748]'
            }`}
            title={
              isCameraLocked
                ? 'Câmera Trava Ativa! Alterações na tabela não irão mover a câmera.'
                : 'Travar a vista atual para que edições na tabela não reposicionem a câmera'
            }
            id="btn-toggle-camera-lock"
          >
            <svg className="w-3 h-3 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isCameraLocked ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              )}
            </svg>
            <span>{isCameraLocked ? 'Vista Travada 🔒' : 'Travar Vista'}</span>
          </button>
        </div>
      )}

      {/* Floating UI HUD elements */}
      {showHud && activeModelName && (
        <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none" id="three-hud-top-left">
          <div className="bg-[#171923]/90 border border-blue-500/30 rounded-xl p-3 text-xs text-slate-300 backdrop-blur-md shadow-lg pointer-events-auto flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
            <div>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono block">Modelo Ativo:</span>
              <span className="font-bold text-slate-100 font-mono text-[11px]">{activeModelName}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3D Direction Cross Adjustment Pad (floating overlay) */}
      {selectedStepIndex !== null && onStepsChange && showHud && (
        <div 
          className="absolute bottom-4 left-4 bg-[#121418]/95 hover:bg-[#121418] border border-[#2D3748] rounded-2xl p-4 shadow-2xl backdrop-blur-md w-72 pointer-events-auto transition-all select-none z-50 touch-none"
          id="direction-adjuster-pad"
          style={{ 
            transform: `translate3d(${padPosition.x}px, ${padPosition.y}px, 0) scale(${padScale})`,
            transformOrigin: 'bottom left',
            animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Header (Acts as drag handle) */}
          <div 
            onPointerDown={handlePadPointerDown}
            onPointerMove={handlePadPointerMove}
            onPointerUp={handlePadPointerUp}
            className="flex items-center justify-between border-b border-[#2D3748] pb-2 mb-2.5 cursor-grab active:cursor-grabbing select-none touch-none"
            title="Arraste pelo cabeçalho para mover"
          >
            <div className="flex items-center gap-1.5 pointer-events-none">
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span className="text-xs font-bold text-slate-100 font-sans">
                Ajuste (Passo {selectedStepIndex})
              </span>
            </div>
            
            {/* Control Group: Scale and Close */}
            <div className="flex items-center gap-2">
              {/* Scale Adjuster (Diminuir/Aumentar) */}
              <div className="flex items-center gap-1 bg-[#1A202C] border border-[#2D3748] rounded-lg px-1.5 py-0.5 text-[9px] font-mono text-slate-300">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPadScale(prev => Math.max(0.6, prev - 0.1));
                  }}
                  className="hover:text-amber-400 font-bold px-1 rounded hover:bg-[#2D3748] cursor-pointer"
                  title="Diminuir tamanho (-10%)"
                >
                  -
                </button>
                <span className="min-w-[30px] text-center select-none">{Math.round(padScale * 100)}%</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPadScale(prev => Math.min(1.5, prev + 0.1));
                  }}
                  className="hover:text-amber-400 font-bold px-1 rounded hover:bg-[#2D3748] cursor-pointer"
                  title="Aumentar tamanho (+10%)"
                >
                  +
                </button>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectStep(null);
                }}
                className="text-slate-400 hover:text-white text-xs p-1 rounded-lg hover:bg-[#2D3748] transition-colors cursor-pointer"
                title="Fechar Ajustador"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Current Step Value Summary */}
          <div className="bg-[#0F1115] border border-[#2D3748]/50 p-2 rounded-lg mb-3 text-[10px] font-mono text-slate-400 flex justify-between items-center">
            <div>
              Torção AP: <b className="text-purple-400">{(steps[selectedStepIndex - 1]?.ap ?? 0)}°</b>
            </div>
            <div>
              Dobra AC: <b className="text-orange-400">{(steps[selectedStepIndex - 1]?.ac ?? 0)}°</b>
            </div>
          </div>

          {/* D-Pad Circular Cross controls */}
          <div className="flex flex-col items-center justify-center relative my-2">
            {/* Label for UP: AC Positiva */}
            <span className="text-[9px] text-[#A0AEC0] font-sans font-bold uppercase tracking-wider mb-1">
              Dobra AC (+)
            </span>

            <div className="relative w-36 h-36 flex items-center justify-center bg-[#0d0f13] rounded-full border border-[#2D3748]/40 shadow-inner">
              {/* Internal Cross Grid lines */}
              <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-[#2D3748]/40 pointer-events-none transform -translate-x-1/2" />
              <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-[#2D3748]/40 pointer-events-none transform -translate-y-1/2" />

              {/* UP Arrow button: Sets AC to Positive */}
              <button
                onClick={() => handleAdjustSign('ac', 'positive')}
                className="absolute top-1 left-1/2 -translate-x-1/2 w-9 h-9 bg-[#1A202C] hover:bg-emerald-950/40 text-white border border-[#2D3748] hover:border-emerald-500 rounded-xl flex items-center justify-center cursor-pointer transition-all shadow-md group"
                title="Definir Dobra (AC) como POSITIVA"
              >
                <svg className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300 transform group-hover:-translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                </svg>
              </button>

              {/* LEFT Arrow button: Sets AP to Negative */}
              <button
                onClick={() => handleAdjustSign('ap', 'negative')}
                className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 bg-[#1A202C] hover:bg-purple-950/40 text-white border border-[#2D3748] hover:border-purple-500 rounded-xl flex items-center justify-center cursor-pointer transition-all shadow-md group"
                title="Definir Torção (AP) como NEGATIVA"
              >
                <svg className="w-4 h-4 text-purple-400 group-hover:text-purple-300 transform group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* RIGHT Arrow button: Sets AP to Positive */}
              <button
                onClick={() => handleAdjustSign('ap', 'positive')}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 bg-[#1A202C] hover:bg-purple-950/40 text-white border border-[#2D3748] hover:border-purple-500 rounded-xl flex items-center justify-center cursor-pointer transition-all shadow-md group"
                title="Definir Torção (AP) como POSITIVA"
              >
                <svg className="w-4 h-4 text-purple-400 group-hover:text-purple-300 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* DOWN Arrow button: Sets AC to Negative */}
              <button
                onClick={() => handleAdjustSign('ac', 'negative')}
                className="absolute bottom-1 left-1/2 -translate-x-1/2 w-9 h-9 bg-[#1A202C] hover:bg-emerald-950/40 text-white border border-[#2D3748] hover:border-indigo-500 rounded-xl flex items-center justify-center cursor-pointer transition-all shadow-md group"
                title="Definir Dobra (AC) como NEGATIVA"
              >
                <svg className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300 transform group-hover:translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* D-Pad center status circle */}
              <div className="w-10 h-10 bg-[#121418] border-2 border-dashed border-[#2D3748] rounded-full flex flex-col items-center justify-center shadow-inner text-[8px] font-bold text-slate-500 font-mono">
                <span>AP/AC</span>
                <span className="text-amber-500 animate-pulse text-[9px] font-sans">+/-</span>
              </div>
            </div>

            {/* Label for DOWN: AC Negativa */}
            <span className="text-[9px] text-[#A0AEC0] font-sans font-bold uppercase tracking-wider mt-1">
              Dobra AC (-)
            </span>

            {/* Side Labels */}
            <div className="absolute left-0.5 top-1/2 -translate-y-1/2 -translate-x-3 text-[8px] text-[#A0AEC0] font-sans font-bold uppercase tracking-wider rotate-90 origin-center pointer-events-none">
              AP (-)
            </div>
            <div className="absolute right-0.5 top-1/2 -translate-y-1/2 translate-x-3 text-[8px] text-[#A0AEC0] font-sans font-bold uppercase tracking-wider -rotate-90 origin-center pointer-events-none">
              AP (+)
            </div>
          </div>

          {/* Quick Shortcuts Buttons block */}
          <div className="grid grid-cols-2 gap-1.5 mt-3 pt-2.5 border-t border-[#2D3748]">
            <button
              onClick={() => handleRotateAP(90)}
              className="bg-[#1A202C] hover:bg-[#2D3748] text-[9px] text-slate-300 py-1 px-2 rounded-lg border border-[#2D3748] flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer font-sans"
              title="Girar o plano de torção (AP) +90°"
            >
              <svg className="w-2.5 h-2.5 text-purple-400 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 6H16" />
              </svg>
              <span>Girar AP +90°</span>
            </button>

            <button
              onClick={() => handleRotateAP(-90)}
              className="bg-[#1A202C] hover:bg-[#2D3748] text-[9px] text-slate-300 py-1 px-2 rounded-lg border border-[#2D3748] flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer font-sans"
              title="Girar o plano de torção (AP) -90°"
            >
              <svg className="w-2.5 h-2.5 text-purple-400 transform scale-x-[-1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 6H16" />
              </svg>
              <span>Girar AP -90°</span>
            </button>

            <button
              onClick={() => handleInvertSign('ap')}
              className="bg-[#1A202C] hover:bg-[#2D3748] text-[9px] text-slate-300 py-1 px-2 rounded-lg border border-[#2D3748] flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer font-sans"
              title="Inverter o sinal positivo/negativo da torção (AP)"
            >
              <svg className="w-2.5 h-2.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span>Inverter AP (+/-)</span>
            </button>

            <button
              onClick={() => handleInvertSign('ac')}
              className="bg-[#1A202C] hover:bg-[#2D3748] text-[9px] text-slate-300 py-1 px-2 rounded-lg border border-[#2D3748] flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer font-sans"
              title="Inverter o sinal positivo/negativo da dobra (AC)"
            >
              <svg className="w-2.5 h-2.5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span>Inverter AC (+/-)</span>
            </button>
          </div>

          {/* Mini Help Caption */}
          <p className="text-[8px] text-[#718096] text-center mt-2.5 leading-relaxed">
            Pressione as setas para alinhar o sinal (+ ou -) de AP e AC em tempo real no desenho.
          </p>
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

        {/* Toggle Horizontal Grid (Piso) */}
        <button
          onClick={() => setShowFloorGrid(!showFloorGrid)}
          className={`py-1.5 px-3 text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-lg active:scale-95 cursor-pointer backdrop-blur-md rounded-lg border ${
            showFloorGrid
              ? "bg-cyan-950/90 text-cyan-200 border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.3)]"
              : "bg-[#171923]/95 hover:bg-[#2D3748]/90 text-slate-400 border-[#2D3748]"
          }`}
          title={showFloorGrid ? "Desligar Grade Horizontal (Piso)" : "Ligar Grade Horizontal (Piso)"}
          id="btn-toggle-floor-grid"
        >
          <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <span>Grade H {showFloorGrid ? 'ON' : 'OFF'}</span>
        </button>

        {/* Toggle Vertical Grid (Parede Frontal) */}
        <button
          onClick={() => setShowVerticalGrid(!showVerticalGrid)}
          className={`py-1.5 px-3 text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-lg active:scale-95 cursor-pointer backdrop-blur-md rounded-lg border ${
            showVerticalGrid
              ? "bg-purple-950/90 text-purple-200 border-purple-500/50 shadow-[0_0_8px_rgba(168,85,247,0.3)]"
              : "bg-[#171923]/95 hover:bg-[#2D3748]/90 text-slate-400 border-[#2D3748]"
          }`}
          title={showVerticalGrid ? "Desligar Grade Vertical (Parede)" : "Ligar Grade Vertical (Parede)"}
          id="btn-toggle-vertical-grid"
        >
          <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4v16M10 4v16M14 4v16M18 4v16" />
          </svg>
          <span>Grade V {showVerticalGrid ? 'ON' : 'OFF'}</span>
        </button>

        {/* Toggle Side Grid (Grade W) */}
        <button
          onClick={() => setShowWGrid(!showWGrid)}
          className={`py-1.5 px-3 text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-lg active:scale-95 cursor-pointer backdrop-blur-md rounded-lg border ${
            showWGrid
              ? "bg-emerald-950/90 text-emerald-200 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
              : "bg-[#171923]/95 hover:bg-[#2D3748]/90 text-slate-400 border-[#2D3748]"
          }`}
          title={showWGrid ? "Desligar Grade W (Parede Lateral)" : "Ligar Grade W (Parede Lateral)"}
          id="btn-toggle-w-grid"
        >
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <span>Grade W {showWGrid ? 'ON' : 'OFF'}</span>
        </button>

        {/* Toggle Machine/Nozzle parts (Only show the rod/haste) */}
        <button
          onClick={() => setShowMachine(!showMachine)}
          className="bg-[#171923]/95 hover:bg-[#2D3748]/90 text-slate-200 border border-[#2D3748] rounded-lg py-1.5 px-3 text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-lg active:scale-95 cursor-pointer backdrop-blur-md"
          title={showMachine ? "Ocultar bocal e pinos da máquina (Deixar apenas a haste)" : "Mostrar bocal e pinos da máquina"}
          id="btn-toggle-machine-parts"
        >
          {showMachine ? (
            <>
              {/* Eye-off style icon or wire-only icon */}
              <svg className="w-3.5 h-3.5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
              Ocultar Bocal (Apenas Haste)
            </>
          ) : (
            <>
              {/* Eye icon to show machine back */}
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Mostrar Bocal
            </>
          )}
        </button>

        {/* Freeze Mode button requested by user */}
        <button
          onClick={() => setIsFrozen && setIsFrozen(!isFrozen)}
          className={`py-1.5 px-3 text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-lg active:scale-95 cursor-pointer backdrop-blur-md rounded-lg border ${
            isFrozen
              ? "bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-[0_0_10px_rgba(37,99,235,0.4)]"
              : "bg-[#171923]/95 hover:bg-[#2D3748]/90 text-slate-200 border-[#2D3748]"
          }`}
          title={isFrozen ? "Clique para Descongelar (Voltar à visualização por etapas)" : "Clique para Congelar (Exibir haste completa e destacar etapa atual)"}
          id="btn-toggle-freeze"
        >
          <svg className={`w-3.5 h-3.5 ${isFrozen ? "text-white animate-pulse" : "text-blue-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isFrozen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            )}
          </svg>
          {isFrozen ? "Congelado ❄️" : "Congelar"}
        </button>
      </div>

      {/* Touch instruction overlays removed to save space */}
    </div>
  );
}
