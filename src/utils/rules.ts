import { BenderStep, RotationMode } from '../types';

/**
 * Calculates the cumulative rotation angle (Eixo A) for each step in degrees.
 * In relative mode, cumulative = sum(ap_0 .. ap_i).
 * In absolute mode, cumulative = ap_i.
 */
export function calculateCumulativeTorsions(steps: BenderStep[], rotationMode: RotationMode): number[] {
  const result: number[] = [];
  let accum = 0;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const apVal = (s.ap || 0) + (s.apCorr || 0);
    if (rotationMode === 'relative') {
      accum += apVal;
    } else {
      accum = apVal;
    }
    result.push(accum);
  }
  return result;
}

export interface TorsionValidationError {
  stepNumber: number;
  accumTorsion: number;
  ap: number;
  message: string;
}

/**
 * Returns any validation errors where cumulative torsion strictly exceeds +/-200 degrees.
 */
export function getTorsionValidationErrors(steps: BenderStep[], rotationMode: RotationMode): TorsionValidationError[] {
  const accumList = calculateCumulativeTorsions(steps, rotationMode);
  const errors: TorsionValidationError[] = [];

  for (let i = 0; i < steps.length - 1; i++) { // Ignore last step (Corte)
    const accum = accumList[i];
    if (Math.abs(accum) > 200) {
      errors.push({
        stepNumber: steps[i].n,
        accumTorsion: accum,
        ap: steps[i].ap || 0,
        message: `Passo ${steps[i].n}: Torção acumulada (${accum > 0 ? '+' : ''}${accum.toFixed(1)}°) excede o limite máximo do Eixo A (máx ±200°)`,
      });
    }
  }

  return errors;
}

/**
 * Enforces key machine rules on step sequence:
 * 1. Corte line (last step) MUST ALWAYS HAVE Torção (AP) = 0 and Dobra (AC) = 0.
 */
export function enforceTorsionAndCorteRules(steps: BenderStep[], rotationMode: RotationMode): BenderStep[] {
  if (!steps || steps.length === 0) return steps;

  const totalSteps = steps.length;

  return steps.map((step, idx) => {
    const isLastRow = idx === totalSteps - 1;

    // RULE 2: Corte line (last step) MUST ALWAYS HAVE Torção (AP) = 0 and Dobra (AC) = 0
    if (isLastRow) {
      return {
        ...step,
        ap: 0,
        apCorr: null,
        ac: 0,
        acCorr: null,
        comment: step.comment && step.comment.toLowerCase().includes('corte') ? step.comment : 'Corte E',
      };
    }

    return step;
  });
}
