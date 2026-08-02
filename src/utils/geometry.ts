/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { BenderStep, RotationMode } from '../types';

export interface WirePoint {
  pos: THREE.Vector3;
  type: 'straight' | 'bend' | 'nozzle';
  stepIndex: number; // 1-based index of the step that generated this point
}

export interface BendInfo {
  stepIndex: number;
  center: THREE.Vector3;
  angle: number;       // Machine angle (AC)
  drawingAngle: number; // Included angle (180 - |AC|)
  radius: number;
  warning?: string;
}

export interface StepFrame {
  stepIndex: number;
  position: THREE.Vector3; // Joint position where rotation/bend happens (at currentPos)
  dir: THREE.Vector3;      // Local Z axis (feed direction)
  up: THREE.Vector3;       // Local Y axis (bend normal)
  right: THREE.Vector3;    // Local X axis (binormal)
}

export interface GeometryResult {
  sharpPoints: THREE.Vector3[];         // For schematic visualization
  smoothPoints: THREE.Vector3[];        // For realistic 3D tube
  pointsWithMetadata: WirePoint[];      // Points labeled by type/step
  bends: BendInfo[];                    // List of bends with details
  warnings: string[];                   // Global geometry warnings
  stepSegmentLengths: number[];         // Actual straight segment lengths
  stepFrames: StepFrame[];              // Local coordinate systems at each step's joint
}

/**
 * Converts a table of WAFIOS coordinates into 3D wire geometry.
 */
export function generateWireGeometry(
  steps: BenderStep[],
  rotationMode: RotationMode,
  wireDiameter: number = 2.5,
  alignmentMode: 'relative' | 'nozzle' = 'relative'
): GeometryResult {
  const warnings: string[] = [];
  const bends: BendInfo[] = [];
  
  if (steps.length === 0) {
    return {
      sharpPoints: [],
      smoothPoints: [],
      pointsWithMetadata: [],
      bends: [],
      warnings: [],
      stepSegmentLengths: [],
      stepFrames: [],
    };
  }

  // Forward chronological pass: simulating the wire feed and bend sequence
  // We trace the wire starting at the first fed tip (Step 1) to the nozzle (Step N).
  let pos = new THREE.Vector3(0, 0, 0);
  let dir = new THREE.Vector3(0, 0, 1);    // Current feed direction
  let up = new THREE.Vector3(0, 1, 0);     // Current bend plane normal
  let right = new THREE.Vector3(1, 0, 0);  // Current binormal (right direction)

  // Keep track of the absolute nozzle rotation (for absolute mode)
  let currentAbsoluteRotation = 0;

  // We will build a list of sharp joints (vertices)
  // Each step i produces:
  // - A straight feed of length L_i
  // - A rotation AP_i
  // - A bend of angle AC_i and radius r_i
  const sharpVertices: { pos: THREE.Vector3; stepIndex: number }[] = [];
  sharpVertices.push({ pos: pos.clone(), stepIndex: 1 });

  // Array to hold information about each step's bend tangent lengths
  // tangentLength = r * tan(|AC|/2)
  const tangentLengths = steps.map((step) => {
    if (step.ac === null || step.ac === 0) return 0;
    const rad = Math.abs(step.ac) * Math.PI / 180;
    // Cap at 89 degrees to avoid infinite tangent length for 180 degree bends
    const capRad = Math.min(rad, 178 * Math.PI / 180);
    return step.r * Math.tan(capRad / 2);
  });

  // Verify physical limits: segment length vs tangent lengths of its adjacent bends
  const stepSegmentLengths = steps.map((step, idx) => {
    const l = step.l;
    const tStart = idx > 0 ? tangentLengths[idx - 1] : 0;
    const tEnd = tangentLengths[idx];
    
    // For a segment, its start tangent comes from the previous bend,
    // and its end tangent comes from the current bend.
    const requiredLength = tStart + tEnd;
    
    if (l < requiredLength) {
      const needed = requiredLength.toFixed(1);
      warnings.push(
        `Passo ${step.n}: Comprimento L=${l}mm é menor que o necessário (${needed}mm) para os raios de dobra adjacentes (Interferência de dobras!).`
      );
    }
    return Math.max(0, l - requiredLength);
  });

  // Apply visual scale (decreased by ~30% as requested from 1.5 to 1.2 to be closer to real scale)
  const visualScale = 1.2;
  const scaledSteps = steps.map((s) => ({
    ...s,
    l: s.l * visualScale,
    r: s.r * visualScale,
  }));

  const scaledTangentLengths = scaledSteps.map((step) => {
    if (step.ac === null || step.ac === 0) return 0;
    const rad = Math.abs(step.ac) * Math.PI / 180;
    // Cap at 89 degrees to avoid infinite tangent length for 180 degree bends
    const capRad = Math.min(rad, 178 * Math.PI / 180);
    return step.r * Math.tan(capRad / 2);
  });

  // Now, let's run the simulation to compute the 3D path
  // We first compute the skeleton of sharp bends (the joints)
  const tempFrames: { dir: THREE.Vector3; up: THREE.Vector3; right: THREE.Vector3 }[] = [];

  for (let i = 0; i < scaledSteps.length; i++) {
    const step = scaledSteps[i];
    const L = step.l;
    
    // 1. Feed the wire
    pos = pos.clone().addScaledVector(dir, L);
    sharpVertices.push({ pos: pos.clone(), stepIndex: step.n });

    // Save frame before rotation/bending
    tempFrames.push({
      dir: dir.clone(),
      up: up.clone(),
      right: right.clone(),
    });

    // 2. Twist / Rotation (AP)
    let deltaAP = 0;
    if (step.ap !== null) {
      const apReal = step.ap + (step.apCorr || 0);
      if (rotationMode === 'absolute') {
        deltaAP = apReal - currentAbsoluteRotation;
        currentAbsoluteRotation = apReal;
      } else {
        deltaAP = apReal;
      }
    }

    if (Math.abs(deltaAP) > 0.001) {
      // Invert the sign of AP to match the Wafios CNC machine's coordinate system
      // where a positive AP rotates the wire such that the bending plane changes appropriately.
      const angleRad = -(deltaAP * Math.PI) / 180;
      // Rotate up and right axes around the current feed direction
      up.applyAxisAngle(dir, angleRad).normalize();
      right.applyAxisAngle(dir, angleRad).normalize();
    }

    // 3. Bend (AC)
    if (step.ac !== null && step.ac !== 0) {
      const acReal = step.ac + (step.acCorr || 0);
      const acRad = (acReal * Math.PI) / 180;
      
      // Rotate feed direction and up vector around the right axis (the bend normal)
      // Note: A positive AC bends the wire direction DOWN (towards -up), negative AC bends UP (towards +up)
      dir.applyAxisAngle(right, acRad).normalize();
      up.applyAxisAngle(right, acRad).normalize();
    }
  }

  const P_final = sharpVertices[sharpVertices.length - 1].pos.clone();
  
  // The final orientation is the nozzle's frame
  const D_final = dir.clone();
  const N_final = up.clone();
  const B_final = right.clone(); // binormal

  // Create alignment matrix based on alignmentMode:
  let alignMatrix = new THREE.Matrix4(); // Default is Identity (relative mode)

  if (alignmentMode === 'nozzle') {
    // Calculate nozzlePos: the final position of the wire at the nozzle exit
    const tEndLast = scaledTangentLengths[scaledSteps.length - 1] || 0;
    const nozzlePos = P_final.clone().addScaledVector(D_final, tEndLast);

    // Create alignment matrix:
    // We want to transform the coordinates such that:
    // nozzlePos becomes (0, 0, 0)
    // D_final becomes (0, 0, 1) (pointing straight out of nozzle)
    // N_final becomes (0, 1, 0) (vertical axis of nozzle)
    // B_final becomes (1, 0, 0) (horizontal axis of nozzle)
    const basisMatrix = new THREE.Matrix4().makeBasis(B_final, N_final, D_final);
    basisMatrix.setPosition(nozzlePos);
    alignMatrix = basisMatrix.clone().invert();
  }

  // Align sharp points
  const alignedSharpPoints = sharpVertices.map((v) => v.pos.clone().applyMatrix4(alignMatrix));

  // Let's generate metadata-enriched points and a smooth curved path
  const pointsWithMetadata: WirePoint[] = [];
  const smoothPoints: THREE.Vector3[] = [];
  const stepFrames: StepFrame[] = [];

  // Re-run simulation but this time generating the smooth curved vertices
  pos.set(0, 0, 0);
  dir.set(0, 0, 1);
  up.set(0, 1, 0);
  right.set(1, 0, 0);
  currentAbsoluteRotation = 0;

  let currentPos = pos.clone();

  for (let i = 0; i < scaledSteps.length; i++) {
    const step = scaledSteps[i];
    const L = step.l;
    const tStart = i > 0 ? scaledTangentLengths[i - 1] : 0;
    const tEnd = scaledTangentLengths[i];

    // Start point of this segment
    const segStart = currentPos.clone();
    
    // We feed a straight portion of length: L - tStart - tEnd
    const straightLength = L - tStart - tEnd;
    
    // Draw straight section
    const straightEnd = currentPos.clone().addScaledVector(dir, Math.max(0, straightLength));
    
    // Save smooth points for this straight segment
    smoothPoints.push(segStart.clone());
    smoothPoints.push(straightEnd.clone());

    pointsWithMetadata.push({
      pos: segStart.clone(),
      type: i === scaledSteps.length - 1 ? 'nozzle' : 'straight',
      stepIndex: step.n,
    });
    pointsWithMetadata.push({
      pos: straightEnd.clone(),
      type: 'straight',
      stepIndex: step.n,
    });

    currentPos = straightEnd;

    // Apply rotation (AP)
    let deltaAP = 0;
    if (step.ap !== null) {
      const apReal = step.ap + (step.apCorr || 0);
      if (rotationMode === 'absolute') {
        deltaAP = apReal - currentAbsoluteRotation;
        currentAbsoluteRotation = apReal;
      } else {
        deltaAP = apReal;
      }
    }
    if (Math.abs(deltaAP) > 0.001) {
      // Invert the sign of AP to match the Wafios CNC machine's coordinate system
      const angleRad = -(deltaAP * Math.PI) / 180;
      up.applyAxisAngle(dir, angleRad).normalize();
      right.applyAxisAngle(dir, angleRad).normalize();
    }

    // Now, perform bend (AC) as a smooth circular arc of radius r
    if (step.ac !== null && step.ac !== 0) {
      const acReal = step.ac + (step.acCorr || 0);
      const acRad = (acReal * Math.PI) / 180;
      const radius = step.r;
      const t = tEnd; // The tangent length of this bend is indeed tEnd!

      if (t > 0) {
        // Bend center is located along the 'up' vector (bending plane is dir-up).
        // Positive AC = bend DOWN, so center is below (-up).
        // Negative AC = bend UP, so center is above (+up).
        const inwardNormal = up.clone().multiplyScalar(acReal > 0 ? -1 : 1);
        const arcCenter = currentPos.clone().addScaledVector(inwardNormal, radius);

        // Generate arc points
        const numArcPoints = 12;
        const arcPoints: THREE.Vector3[] = [];
        
        // Sweep angle from 0 to acRad
        for (let k = 0; k <= numArcPoints; k++) {
          const frac = k / numArcPoints;
          const currentSweep = acRad * frac;
          
          // Vector from center to starting point of arc
          const vStart = currentPos.clone().sub(arcCenter);
          
          // Rotate vStart around the bend axis (right) by currentSweep
          const vRotated = vStart.clone().applyAxisAngle(right, currentSweep);
          
          const arcPt = arcCenter.clone().add(vRotated);
          arcPoints.push(arcPt);
        }

        // Add arc points to smooth array
        smoothPoints.push(...arcPoints);
        
        arcPoints.forEach((pt) => {
          pointsWithMetadata.push({
            pos: pt.clone(),
            type: 'bend',
            stepIndex: step.n,
          });
        });

        // Record bend info (before alignment)
        bends.push({
          stepIndex: step.n,
          center: arcCenter.clone().applyMatrix4(alignMatrix),
          angle: acReal,
          drawingAngle: 180 - Math.abs(acReal),
          radius,
        });

        // Update position to end of arc
        currentPos = arcPoints[arcPoints.length - 1].clone();
      }

      // Rotate vectors to represent the new direction
      dir.applyAxisAngle(right, acRad).normalize();
      up.applyAxisAngle(right, acRad).normalize();
    } else {
      // If no bend, we just advance by the remaining tangent length
      currentPos.addScaledVector(dir, tEnd);
    }

    // Save step frame (local coordinate system) for step i
    stepFrames.push({
      stepIndex: step.n,
      position: currentPos.clone().applyMatrix4(alignMatrix),
      dir: dir.clone().transformDirection(alignMatrix),
      up: up.clone().transformDirection(alignMatrix),
      right: right.clone().transformDirection(alignMatrix),
    });
  }

  // Align smooth points and metadata points
  const alignedSmoothPoints = smoothPoints.map((p) => p.clone().applyMatrix4(alignMatrix));
  const alignedMetadataPoints = pointsWithMetadata.map((pt) => ({
    ...pt,
    pos: pt.pos.clone().applyMatrix4(alignMatrix),
  }));

  // Clean duplicates in smooth points (which can happen at segment connections)
  const uniqueSmoothPoints: THREE.Vector3[] = [];
  for (let i = 0; i < alignedSmoothPoints.length; i++) {
    const pt = alignedSmoothPoints[i];
    if (uniqueSmoothPoints.length === 0) {
      uniqueSmoothPoints.push(pt);
    } else {
      const prev = uniqueSmoothPoints[uniqueSmoothPoints.length - 1];
      if (prev.distanceTo(pt) > 0.01) {
        uniqueSmoothPoints.push(pt);
      }
    }
  }

  return {
    sharpPoints: alignedSharpPoints,
    smoothPoints: uniqueSmoothPoints,
    pointsWithMetadata: alignedMetadataPoints,
    bends,
    warnings,
    stepSegmentLengths,
    stepFrames,
  };
}
