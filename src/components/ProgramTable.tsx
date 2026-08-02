/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BenderStep } from '../types';

interface ProgramTableProps {
  steps: BenderStep[];
  onStepsChange: (steps: BenderStep[]) => void;
  hoveredStepIndex: number | null;
  onHoverStep: (idx: number | null) => void;
  selectedStepIndex: number | null;
  onSelectStep: (idx: number | null) => void;
  wireDiameter: number;
}

export default function ProgramTable({
  steps,
  onStepsChange,
  hoveredStepIndex,
  onHoverStep,
  selectedStepIndex,
  onSelectStep,
  wireDiameter,
}: ProgramTableProps) {
  
  // Handle cell edit change
  const handleCellChange = (
    stepId: string,
    field: keyof BenderStep,
    value: string
  ) => {
    const updatedSteps = steps.map((step) => {
      if (step.id !== stepId) return step;

      let parsedValue: any = null;
      if (field === 'comment') {
        parsedValue = value;
      } else {
        const num = parseFloat(value);
        parsedValue = isNaN(num) ? null : num;
      }

      return {
        ...step,
        [field]: parsedValue,
      };
    });
    onStepsChange(updatedSteps);
  };

  const handleDesenhoChange = (stepId: string, value: string) => {
    const updatedSteps = steps.map((step) => {
      if (step.id !== stepId) return step;

      const num = parseFloat(value);
      if (isNaN(num)) {
        // If they clear it, maybe we don't do anything or clear AC
        return { ...step, ac: null };
      }

      // Drawing Angle = 180 - |AC + ACCorr|
      // |AC + ACCorr| = 180 - Drawing Angle
      const absNewAcTotal = 180 - num;
      
      // Determine the sign based on previous AC (default to positive if null/0)
      const isNegative = step.ac !== null && step.ac < 0;
      let newAc = isNegative ? -absNewAcTotal : absNewAcTotal;
      
      // Subtract the correction to get the base AC
      newAc = newAc - (step.acCorr || 0);

      // Keep it nicely formatted to 1 decimal place to avoid floating point errors
      newAc = parseFloat(newAc.toFixed(2));

      return {
        ...step,
        ac: newAc,
      };
    });
    onStepsChange(updatedSteps);
  };

  // Add a new row
  const handleAddRow = () => {
    const nextN = steps.length + 1;
    const newStep: BenderStep = {
      id: crypto.randomUUID(),
      n: nextN,
      l: 25, // default feed length
      esp: null,
      ap: null,
      apCorr: null,
      ac: null,
      acCorr: null,
      r: 1.5, // default standard bend radius
      comment: '',
    };
    onStepsChange([...steps, newStep]);
  };

  // Remove the last row
  const handleRemoveLastRow = () => {
    if (steps.length <= 1) return; // keep at least 1 row
    const updated = steps.slice(0, -1);
    onStepsChange(updated);
    if (selectedStepIndex === steps.length) {
      onSelectStep(null);
    }
  };

  // Remove a specific row by index and reindex
  const handleDeleteRow = (idxToDelete: number) => {
    if (steps.length <= 1) return;
    const filtered = steps.filter((s) => s.n !== idxToDelete);
    // Reindex
    const reindexed = filtered.map((step, idx) => ({
      ...step,
      n: idx + 1,
    }));
    onStepsChange(reindexed);
    if (selectedStepIndex === idxToDelete || selectedStepIndex === steps.length) {
      onSelectStep(null);
    }
  };

  // Clear all steps but keep one blank row
  const handleClearAll = () => {
    const initialStep: BenderStep = {
      id: crypto.randomUUID(),
      n: 1,
      l: 10,
      esp: null,
      ap: null,
      apCorr: null,
      ac: null,
      acCorr: null,
      r: 1.5,
      comment: 'Início',
    };
    onStepsChange([initialStep]);
    onSelectStep(null);
  };

  // Get bend direction symbol (X* column)
  const getBendDirectionIcon = (ac: number | null) => {
    if (ac === null || ac === 0) return '—';
    if (ac > 0) return '↪️ Dir';
    return '↩️ Esq';
  };

  return (
    <div className="flex flex-col h-full" id="program-table-root">
      {/* Table Actions bar */}
      <div className="flex justify-between items-center mb-4" id="table-actions-container">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold bg-[#2D3748] text-[#E2E8F0] py-1 px-2.5 rounded-md uppercase tracking-wider font-mono border border-[#4A5568]">
            Tabela de Coordenadas
          </span>
          <span className="text-xs text-[#718096]">({steps.length} passos)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddRow}
            className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] cursor-pointer"
            id="btn-add-row"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Adicionar Passo
          </button>
          <button
            onClick={handleRemoveLastRow}
            disabled={steps.length <= 1}
            className="bg-[#2D3748] hover:bg-[#4A5568] disabled:opacity-40 text-slate-200 border border-[#4A5568] disabled:cursor-not-allowed text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            id="btn-remove-row"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
            </svg>
            Remover Último
          </button>
          <button
            onClick={handleClearAll}
            className="bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/50 text-rose-300 text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            title="Limpar tabela inteira"
            id="btn-clear-table"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Limpar Tudo
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto border border-[#2D3748] rounded-xl bg-[#121418] backdrop-blur" id="table-scroll-container">
        <table className="w-full text-left border-collapse font-mono text-xs text-[#E2E8F0]">
          <thead>
            <tr className="bg-[#1A202C] text-[#A0AEC0] border-b border-[#2D3748] uppercase tracking-wider text-[10px]">
              <th className="py-3 px-2.5 text-center font-bold w-10">Nº</th>
              <th className="py-3 px-2 text-center w-16">Tipo (X*)</th>
              <th className="py-3 px-2 text-center w-24">Avanço (L)</th>
              <th className="py-3 px-2 text-center w-16">Esp</th>
              <th className="py-3 px-2 text-center w-24">Torção (AP)</th>
              <th className="py-3 px-2 text-center w-16">+/- (AP)</th>
              <th className="py-3 px-2 text-center w-24">Dobra (AC)</th>
              <th className="py-3 px-2 text-center w-16">Corr (D)</th>
              <th className="py-3 px-2 text-center w-14">Raio (r)</th>
              <th className="py-3 px-2 text-center w-20 text-blue-400 font-semibold bg-blue-950/20 border-l border-[#2D3748]">Desenho*</th>
              <th className="py-3 px-3">Comentários</th>
              <th className="py-3 px-2 text-center w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2D3748]/30">
            {steps.map((step) => {
              const isHovered = hoveredStepIndex === step.n;
              const isSelected = selectedStepIndex === step.n;
              const isLastRow = step.n === steps.length;

              // Color palette for step markers matching the 3D viewer
              const stepColors = [
                'bg-rose-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-cyan-500',
                'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-teal-500', 'bg-blue-500'
              ];
              const markerColor = stepColors[(step.n - 1) % stepColors.length];

              // Drawing Angle: Included angle 180 - |AC|
              const drawingAngleValue = step.ac !== null && step.ac !== 0 
                ? parseFloat((180 - Math.abs(step.ac + (step.acCorr || 0))).toFixed(1))
                : '';

              return (
                <tr
                  key={step.id}
                  onMouseEnter={() => onHoverStep(step.n)}
                  onMouseLeave={() => onHoverStep(null)}
                  onClick={() => onSelectStep(step.n)}
                  className={`transition-colors cursor-pointer group ${
                    isSelected 
                      ? 'bg-blue-500/10 border-l-2 border-blue-500 text-blue-100' 
                      : isHovered 
                        ? 'bg-white/5' 
                        : 'hover:bg-white/5 bg-[#121418]'
                  }`}
                  id={`row-step-${step.n}`}
                >
                  {/* Step index */}
                  <td className="py-2 px-1 text-center font-bold font-sans">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${markerColor} inline-block`} title={`Passo ${step.n}`} />
                      <span>{step.n}</span>
                    </div>
                  </td>

                  {/* Bend shape icon */}
                  <td className="py-2 px-1 text-center font-sans text-[10px] font-medium">
                    <span className={`px-1.5 py-0.5 rounded ${
                      step.ac === null || step.ac === 0 
                        ? 'text-[#718096]' 
                        : step.ac > 0 
                          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/60' 
                          : 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/60'
                    }`}>
                      {getBendDirectionIcon(step.ac)}
                    </span>
                  </td>

                  {/* Feed L */}
                  <td className="py-1 px-1">
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      placeholder="0"
                      value={step.l === null ? '' : step.l}
                      onChange={(e) => handleCellChange(step.id, 'l', e.target.value)}
                      className="w-full bg-[#0F1115] hover:bg-[#171923] focus:bg-[#171923] text-center py-1 rounded border border-[#2D3748] focus:border-blue-500 text-slate-100 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </td>

                  {/* Esp parameter */}
                  <td className="py-1 px-1">
                    <input
                      type="number"
                      step="any"
                      placeholder=""
                      value={step.esp === null ? '' : step.esp}
                      onChange={(e) => handleCellChange(step.id, 'esp', e.target.value)}
                      className="w-full bg-[#0F1115] hover:bg-[#171923] focus:bg-[#171923] text-center py-1 rounded border border-[#2D3748]/80 focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-slate-300"
                    />
                  </td>

                  {/* Twist AP */}
                  <td className="py-1 px-1">
                    <input
                      type="number"
                      step="any"
                      placeholder="—"
                      value={step.ap === null ? '' : step.ap}
                      onChange={(e) => handleCellChange(step.id, 'ap', e.target.value)}
                      className="w-full bg-[#0F1115] hover:bg-[#171923] focus:bg-[#171923] text-center py-1 rounded border border-[#2D3748] focus:border-blue-500 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-purple-400"
                    />
                  </td>

                  {/* AP Correction */}
                  <td className="py-1 px-1">
                    <input
                      type="number"
                      step="any"
                      placeholder=""
                      value={step.apCorr === null ? '' : step.apCorr}
                      onChange={(e) => handleCellChange(step.id, 'apCorr', e.target.value)}
                      className="w-full bg-[#0F1115] hover:bg-[#171923] focus:bg-[#171923] text-center py-1 rounded border border-[#2D3748]/80 focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-orange-400"
                    />
                  </td>

                  {/* Bend AC */}
                  <td className="py-1 px-1">
                    <input
                      type="number"
                      step="any"
                      placeholder={isLastRow ? 'Corte' : '—'}
                      value={step.ac === null ? '' : step.ac}
                      onChange={(e) => handleCellChange(step.id, 'ac', e.target.value)}
                      className="w-full bg-[#0F1115] hover:bg-[#171923] focus:bg-[#171923] text-center py-1 rounded border border-[#2D3748] focus:border-blue-500 text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-orange-400"
                    />
                  </td>

                  {/* Bending Correction D */}
                  <td className="py-1 px-1">
                    <input
                      type="number"
                      step="any"
                      placeholder=""
                      value={step.acCorr === null ? '' : step.acCorr}
                      onChange={(e) => handleCellChange(step.id, 'acCorr', e.target.value)}
                      className="w-full bg-[#0F1115] hover:bg-[#171923] focus:bg-[#171923] text-center py-1 rounded border border-[#2D3748]/80 focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-orange-400"
                    />
                  </td>

                  {/* Radius r */}
                  <td className="py-1 px-1">
                    <input
                      type="number"
                      step="any"
                      placeholder="1.5"
                      value={step.r}
                      onChange={(e) => handleCellChange(step.id, 'r', e.target.value)}
                      className="w-full bg-[#0F1115] hover:bg-[#171923] focus:bg-[#171923] text-center py-1 rounded border border-[#2D3748]/80 focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-slate-300"
                    />
                  </td>

                  {/* Drawing included angle */}
                  <td className="py-1 px-1 bg-blue-950/20 border-l border-[#2D3748]">
                    <div className="relative w-full flex items-center justify-center">
                      <input
                        type="number"
                        step="any"
                        placeholder="—"
                        value={drawingAngleValue}
                        onChange={(e) => handleDesenhoChange(step.id, e.target.value)}
                        className="w-full bg-transparent hover:bg-[#171923] focus:bg-[#171923] text-center py-1 rounded border border-transparent focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-sans font-bold text-blue-400"
                      />
                      {drawingAngleValue !== '' && <span className="absolute right-1 text-blue-400 font-bold pointer-events-none text-xs">°</span>}
                    </div>
                  </td>

                  {/* User Comment */}
                  <td className="py-1 px-2">
                    <input
                      type="text"
                      placeholder="ex: Dobra interna"
                      value={step.comment}
                      onChange={(e) => handleCellChange(step.id, 'comment', e.target.value)}
                      className="w-full bg-transparent hover:bg-[#0F1115]/40 focus:bg-[#0F1115] px-2 py-1 rounded border border-transparent focus:border-[#2D3748] text-left text-slate-400 focus:text-slate-200 focus:outline-none text-[11px]"
                    />
                  </td>

                  {/* Action delete row button */}
                  <td className="py-1 px-1 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRow(step.n);
                      }}
                      disabled={steps.length <= 1}
                      className="text-[#718096] hover:text-rose-400 disabled:opacity-0 disabled:pointer-events-none p-1 rounded hover:bg-[#2D3748] transition-colors"
                      title="Excluir este passo"
                      id={`btn-delete-step-${step.n}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[11px] text-[#A0AEC0] flex flex-col gap-1 px-2.5 bg-[#171923] py-2.5 rounded-lg border border-[#2D3748]" id="table-disclaimer">
        <p className="flex items-center gap-1">
          <span className="text-orange-400 font-bold font-sans">*Dica:</span>
          <span><b>Ângulo do Desenho</b> calcula automaticamente o ângulo de abertura da peça conforme o desenho técnico (180° - Ângulo de Dobra).</span>
        </p>
        <p className="flex items-center gap-1">
          <span className="text-blue-400 font-bold font-sans">*Correções:</span>
          <span>Valores inseridos em <b>Corr (D)</b> e <b>+/- (AP)</b> alteram diretamente a dobra real no gráfico 3D sem modificar o nominal.</span>
        </p>
      </div>
    </div>
  );
}
