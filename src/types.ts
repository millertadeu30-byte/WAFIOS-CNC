/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BenderStep {
  id: string;
  n: number;            // Row number (1-based)
  l: number;            // Length of feed (L) in mm
  esp: number | null;   // Esp parameter (additional feed spacing/parameters)
  ap: number | null;    // Rotation angle (AP) in degrees, null means blank
  apCorr: number | null;// AP correction (+/-)
  ac: number | null;    // Bending angle (AC) in degrees, null means blank
  acCorr: number | null;// Bending correction (D) in degrees
  r: number;            // Bending radius (r) in mm
  comment: string;      // Optional user comment
}

export type RotationMode = 'absolute' | 'relative';

export interface PieceTemplate {
  name: string;
  description: string;
  rotationMode: RotationMode;
  wireDiameter: number;
  steps: BenderStep[];
}
