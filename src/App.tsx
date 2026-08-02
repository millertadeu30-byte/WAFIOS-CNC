/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FileDown,
  FileUp,
  Settings,
  AlertTriangle,
  Layers,
  Trash2,
  Copy,
  Plus,
  Activity,
  Check,
  BookOpen,
  Info,
  Sliders,
  Sparkles,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Square,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff
} from 'lucide-react';
import { BenderStep, RotationMode, PieceTemplate } from './types';
import { generateWireGeometry } from './utils/geometry';
import ProgramTable from './components/ProgramTable';
import ThreeVisualizer from './components/ThreeVisualizer';
import InstructionGuide from './components/InstructionGuide';

// Initial pre-loaded piece templates
const TEMPLATES: PieceTemplate[] = [
  {
    name: 'Haste Boia 23321',
    description: 'Haste Boia 23321 baseada nas medidas do desenho em PDF',
    rotationMode: 'relative',
    wireDiameter: 2.5,
    steps: [
      { id: '1', n: 1, l: 7.25,  esp: null, ap: null,  apCorr: null, ac: 90.0,  acCorr: null, r: 1.5, comment: 'Dobra 1' },
      { id: '2', n: 2, l: 22.50, esp: null, ap: -90.0, apCorr: null, ac: -60.0, acCorr: null, r: 1.5, comment: 'Dobra 2 (120° int)' },
      { id: '3', n: 3, l: 64.00, esp: null, ap: null,  apCorr: null, ac: -67.0, acCorr: null, r: 1.5, comment: 'Dobra 3 (113° int)' },
      { id: '4', n: 4, l: 30.00, esp: null, ap: 90.0,  apCorr: null, ac: 60.0,  acCorr: null, r: 1.5, comment: 'Dobra 4 (120° int)' },
      { id: '5', n: 5, l: 74.00, esp: null, ap: null,  apCorr: null, ac: -60.0, acCorr: null, r: 1.5, comment: 'Dobra 5 (120° int)' },
      { id: '6', n: 6, l: 51.07, esp: null, ap: null,  apCorr: null, ac: 90.0,  acCorr: null, r: 1.5, comment: 'Dobra 6 (90° int)' },
      { id: '7', n: 7, l: 71.80, esp: null, ap: null,  apCorr: null, ac: null,  acCorr: null, r: 1.5, comment: 'Corte E' },
    ],
  },
  {
    name: 'Haste Boia 23700',
    description: 'Haste Longa Dupla Curvatura (Modelo 23700) - 8 passos de dobra complexos em modo ABSOLUTO',
    rotationMode: 'absolute',
    wireDiameter: 2.5,
    steps: [
      { id: 'a1', n: 1, l: 6.5, esp: null, ap: 0.0, apCorr: null, ac: 90.0, acCorr: null, r: 1.5, comment: 'Dobra de fixação' },
      { id: 'a2', n: 2, l: 26.0, esp: null, ap: -90.0, apCorr: null, ac: -65.0, acCorr: 1.7, r: 1.5, comment: 'Gancho inclinado (D=1.7)' },
      { id: 'a3', n: 3, l: 20.0, esp: null, ap: -90.0, apCorr: null, ac: 60.0, acCorr: 1.8, r: 1.5, comment: 'Nível 1 (D=1.8)' },
      { id: 'a4', n: 4, l: 102.5, esp: null, ap: -90.0, apCorr: null, ac: 45.0, acCorr: 2.0, r: 1.5, comment: 'Perna longa principal' },
      { id: 'a5', n: 5, l: 26.2, esp: 3.0, ap: -87.0, apCorr: -1.0, ac: -45.0, acCorr: 2.0, r: 1.5, comment: 'Pescoço superior' },
      { id: 'a6', n: 6, l: 150.0, esp: 5.5, ap: -83.0, apCorr: null, ac: -97.0, acCorr: -0.3, r: 1.5, comment: 'Corpo longo boia' },
      { id: 'a7', n: 7, l: 125.0, esp: null, ap: 7.0, apCorr: -2.0, ac: -90.0, acCorr: null, r: 1.5, comment: 'Gancho de fechamento' },
      { id: 'a8', n: 8, l: 45.0, esp: null, ap: 7.0, apCorr: null, ac: 90.0, acCorr: null, r: 1.5, comment: 'Gancho final (Corte)' },
    ],
  },
];

export default function App() {
  // State for steps
  const [steps, setSteps] = useState<BenderStep[]>(TEMPLATES[0].steps);
  const [rotationMode, setRotationMode] = useState<RotationMode>('relative');
  const [alignmentMode, setAlignmentMode] = useState<'relative' | 'nozzle'>('relative');
  const [wireDiameter, setWireDiameter] = useState<number>(2.5);

  // Hovered and selected row tracking (for interactive table-graphic communication)
  const [hoveredStepIndex, setHoveredStepIndex] = useState<number | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);

  // Animation simulation state
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [animationProgress, setAnimationProgress] = useState<number>(0);
  const [animationSpeed, setAnimationSpeed] = useState<number>(1.5); // steps per second

  // Import/Export and Help dialog states
  const [showDataIO, setShowDataIO] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [ioText, setIoText] = useState<string>('');
  const [ioError, setIoError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Camera communication trigger
  const [cameraActionTrigger, setCameraActionTrigger] = useState<{ action: 'fit' | 'reset'; ts: number } | null>(null);

  // Theme control (Default to sophisticated light theme as per priority rules, with dark technical elements)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Maximized Graph state
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  // PDF / Drawing analysis state
  const [isAnalyzingPDF, setIsAnalyzingPDF] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfSuccess, setPdfSuccess] = useState<string | null>(null);

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAnalyzingPDF(true);
    setPdfError(null);
    setPdfSuccess(null);

    try {
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');
      if (!isPdf && !isImage) {
        throw new Error('Formato inválido! Por favor anexe um arquivo PDF ou Imagem do desenho técnico.');
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          if (!base64Data) {
            throw new Error('Falha ao ler os dados binários do arquivo.');
          }

          const response = await fetch('/api/analyze-drawing', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileData: base64Data,
              mimeType: file.type,
            }),
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `Erro do servidor (${response.status})`);
          }

          const data = await response.json();
          if (data && data.steps && Array.isArray(data.steps)) {
            const stepsWithIds = data.steps.map((s: any, idx: number) => ({
              id: `pdf-${idx}-${Date.now()}`,
              n: s.n || idx + 1,
              l: s.l || 0,
              esp: s.esp || null,
              ap: s.ap !== undefined && s.ap !== null ? s.ap : null,
              apCorr: null,
              ac: s.ac !== undefined && s.ac !== null ? s.ac : null,
              acCorr: null,
              r: s.r || 1.5,
              comment: s.comment || '',
            }));

            setSteps(stepsWithIds);
            if (data.wireDiameter) {
              setWireDiameter(data.wireDiameter);
            }
            if (data.rotationMode) {
              setRotationMode(data.rotationMode as RotationMode);
            }
            setPdfSuccess(`Desenho técnico "${data.name || file.name}" analisado e importado com sucesso via IA!`);
            setAnimationProgress(1.0);
            setTimeout(() => {
              setCameraActionTrigger({ action: 'fit', ts: Date.now() });
            }, 100);
          } else {
            throw new Error('O Gemini não retornou a tabela de passos de dobra no formato esperado.');
          }
        } catch (err: any) {
          setPdfError(err?.message || 'Erro inesperado ao analisar o desenho.');
        } finally {
          setIsAnalyzingPDF(false);
        }
      };

      reader.onerror = () => {
        setPdfError('Erro de leitura do arquivo local.');
        setIsAnalyzingPDF(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setPdfError(err?.message || 'Erro ao carregar o desenho técnico.');
      setIsAnalyzingPDF(false);
    }
  };

  // Animation Frame Ref for loop timing
  const lastTimeRef = useRef<number | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Persistence: load from LocalStorage on mount
  useEffect(() => {
    const savedSteps = localStorage.getItem('wafios_steps');
    const savedMode = localStorage.getItem('wafios_rotation_mode');
    const savedDiameter = localStorage.getItem('wafios_wire_diameter');
    
    if (savedSteps) {
      try {
        const parsed = JSON.parse(savedSteps);
        // Force upgrade to the corrected coplanar template if they have the old steps loaded
        if (Array.isArray(parsed) && parsed.length === 7 && parsed[2].ap === 0.0 && parsed[2].l === 64.00) {
          localStorage.setItem('wafios_steps', JSON.stringify(TEMPLATES[0].steps));
          setSteps(TEMPLATES[0].steps);
        } else {
          setSteps(parsed);
        }
      } catch (e) {
        console.error('Failed to load steps from localStorage', e);
      }
    }
    if (savedMode) {
      setRotationMode(savedMode as RotationMode);
    }
    if (savedDiameter) {
      setWireDiameter(parseFloat(savedDiameter) || 2.5);
    }
  }, []);

  // Save changes to LocalStorage
  useEffect(() => {
    localStorage.setItem('wafios_steps', JSON.stringify(steps));
    localStorage.setItem('wafios_rotation_mode', rotationMode);
    localStorage.setItem('wafios_wire_diameter', wireDiameter.toString());
  }, [steps, rotationMode, wireDiameter]);

  // Compute stats on steps
  const totalLength = steps.reduce((sum, s) => sum + (s.l || 0), 0);
  const totalBends = steps.filter((s) => s.ac !== null && s.ac !== 0).length;
  
  // Calculate steel weight (Density = 7.85 g/cm3)
  const volumeCm3 = Math.PI * Math.pow((wireDiameter / 10) / 2, 2) * (totalLength / 10);
  const pieceWeightGrams = volumeCm3 * 7.85;

  // Estimated Cycle Time Calculation
  // Feed: 100 mm/s. Bend: 150 deg/s. Rotate: 240 deg/s. Delays: 0.4s per bend, 0.7s final cut.
  const feedSpeed = 100; // mm/s
  const bendSpeed = 150; // deg/s
  const rotateSpeed = 240; // deg/s
  
  let totalFeedTime = totalLength / feedSpeed;
  let totalBendingTime = 0;
  let totalRotationTime = 0;
  let prevAP = 0;

  steps.forEach((step, idx) => {
    // Bending time
    if (step.ac !== null && step.ac !== 0) {
      totalBendingTime += Math.abs(step.ac + (step.acCorr || 0)) / bendSpeed;
    }
    // Rotation time
    if (step.ap !== null) {
      const apReal = step.ap + (step.apCorr || 0);
      const delta = rotationMode === 'absolute' ? Math.abs(apReal - prevAP) : Math.abs(apReal);
      totalRotationTime += delta / rotateSpeed;
      if (rotationMode === 'absolute') prevAP = apReal;
    }
  });

  const estimatedCycleTimeSec = (
    totalFeedTime +
    totalBendingTime +
    totalRotationTime +
    (totalBends * 0.4) + // tool operations delay
    0.8 // final cutter cycle
  );

  // Math results for alerts & warnings
  const { warnings } = generateWireGeometry(steps, rotationMode, wireDiameter);

  // Animation Loop Handler
  const updateAnimation = (timestamp: number) => {
    if (lastTimeRef.current === null) {
      lastTimeRef.current = timestamp;
      animFrameIdRef.current = requestAnimationFrame(updateAnimation);
      return;
    }

    const elapsedSec = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    setAnimationProgress((prev) => {
      // Calculate next progress step
      // Total duration depends on number of steps and the speed factor
      const durationSec = steps.length / animationSpeed;
      const nextProgress = prev + (elapsedSec / durationSec);

      if (nextProgress >= 1.0) {
        setIsAnimating(false);
        lastTimeRef.current = null;
        return 1.0;
      }
      return nextProgress;
    });

    animFrameIdRef.current = requestAnimationFrame(updateAnimation);
  };

  useEffect(() => {
    if (isAnimating) {
      animFrameIdRef.current = requestAnimationFrame(updateAnimation);
    } else {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      lastTimeRef.current = null;
    }

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isAnimating, steps, animationSpeed]);

  const handlePlayPause = () => {
    if (isAnimating) {
      setIsAnimating(false);
    } else {
      setSelectedStepIndex(null); // Clear selected step so the player can animate continuously from its current position
      if (animationProgress >= 1.0) {
        setAnimationProgress(0); // restart
      }
      setIsAnimating(true);
    }
  };

  const handleStopAnimation = () => {
    setIsAnimating(false);
    setAnimationProgress(1.0); // Complete program view ("finaliza o pgm completo")
    setSelectedStepIndex(null); // Return to default complete piece overview
    setCameraActionTrigger({ action: 'fit', ts: Date.now() }); // Frame the full finished shape ("volta na visão padrão")
  };

  const handleStepForward = () => {
    setIsAnimating(false);
    let nextIdx = 1;
    if (selectedStepIndex !== null) {
      nextIdx = Math.min(steps.length, selectedStepIndex + 1);
    }
    setSelectedStepIndex(nextIdx);
    setAnimationProgress(nextIdx / steps.length);
  };

  const handleStepBackward = () => {
    setIsAnimating(false);
    if (selectedStepIndex === null || selectedStepIndex <= 1) {
      setSelectedStepIndex(null);
      setAnimationProgress(0);
    } else {
      const prevIdx = selectedStepIndex - 1;
      setSelectedStepIndex(prevIdx);
      setAnimationProgress(prevIdx / steps.length);
    }
  };

  const handleSelectStep = (idx: number | null) => {
    setIsAnimating(false);
    setSelectedStepIndex(idx);
    if (idx !== null) {
      setAnimationProgress(idx / steps.length);
    } else {
      setAnimationProgress(1.0);
    }
  };

  const triggerCameraFit = () => {
    setCameraActionTrigger({ action: 'fit', ts: Date.now() });
  };

  // Preset loading handler
  const loadTemplate = (template: PieceTemplate) => {
    setSteps(template.steps);
    setRotationMode(template.rotationMode);
    setWireDiameter(template.wireDiameter);
    setAnimationProgress(1.0); // Load fully formed by default
    setIsAnimating(false);
    setSelectedStepIndex(null);
    // Auto-fit camera to preloaded templates after a short delay
    setTimeout(() => {
      setCameraActionTrigger({ action: 'fit', ts: Date.now() });
    }, 100);
  };

  // Export Program to text format
  const handleOpenExport = () => {
    const exportData = {
      version: '1.0',
      rotationMode,
      wireDiameter,
      steps,
    };
    setIoText(JSON.stringify(exportData, null, 2));
    setShowDataIO(true);
    setIoError(null);
    setCopySuccess(false);
  };

  // Import Program from text format
  const handleImport = () => {
    try {
      const parsed = JSON.parse(ioText);
      if (!parsed.steps || !Array.isArray(parsed.steps)) {
        throw new Error('Formato inválido. O objeto deve conter uma lista "steps".');
      }
      setSteps(parsed.steps);
      if (parsed.rotationMode) setRotationMode(parsed.rotationMode);
      if (parsed.wireDiameter) setWireDiameter(parsed.wireDiameter);
      setShowDataIO(false);
      setIoError(null);
      setAnimationProgress(0);
    } catch (e: any) {
      setIoError(`Erro na leitura do JSON: ${e.message}`);
    }
  };

  // Copy to clipboard helper
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(ioText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  // Compact cell edit handler
  const handleCompactCellChange = (stepId: string, field: keyof BenderStep, value: string) => {
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
    setSteps(updatedSteps);
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-[#E2E8F0] font-sans flex flex-col" id="app-container">
      
      {/* Upper Navigation Header */}
      <header className="border-b border-[#2D3748] bg-[#171923] px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0" id="app-header">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)]">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 6H16" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-[#E2E8F0] flex flex-wrap items-center gap-2 font-sans">
              WAFIOS CNC
              <span className="text-[9px] font-mono bg-emerald-950/40 text-emerald-400 py-0.5 px-2 rounded-full border border-emerald-800/40 uppercase tracking-widest font-bold">
                Wafios System Active
              </span>
            </h1>
            <p className="text-xs text-[#718096] font-sans mt-0.5">
              Programa Ativo: <span className="text-blue-400 font-mono font-bold">HASTE_BOIA_23321</span> | Orientação: <span className="text-amber-400 font-bold font-mono">{rotationMode.toUpperCase()}</span> | Gráfico: <span className="text-indigo-400 font-bold font-mono">{alignmentMode === 'relative' ? 'RELATIVO' : 'ABSOLUTO'}</span>
            </p>
          </div>
        </div>

        {/* Action presets and options */}
        <div className="flex flex-wrap items-center gap-3" id="header-actions">
          {/* Compact Wire Diameter Control */}
          <div className="flex items-center gap-2 bg-[#121418] px-3 py-1.5 rounded-xl border border-[#2D3748] text-xs font-sans">
            <span className="font-semibold text-[#A0AEC0] uppercase font-mono text-[10px]">Fio (Ø):</span>
            <input
              type="range"
              min="1.0"
              max="6.0"
              step="0.5"
              value={wireDiameter}
              onChange={(e) => setWireDiameter(parseFloat(e.target.value))}
              className="w-16 accent-blue-500 h-1 bg-[#2D3748] rounded-lg appearance-none cursor-pointer"
              id="header-wire-diameter"
            />
            <span className="font-mono font-bold text-blue-400 text-xs">{wireDiameter.toFixed(1)}mm</span>
          </div>

          {/* Machine Orientation Mode (Relative/Absolute AP calculation) */}
          <div className="flex items-center gap-1 bg-[#121418] p-1 rounded-xl border border-[#2D3748]">
            <span className="text-[10px] font-semibold text-[#718096] px-2 font-mono uppercase">Orientação:</span>
            <button
              onClick={() => setRotationMode('relative')}
              className={`text-[11px] font-semibold py-1 px-2.5 rounded-lg transition-all cursor-pointer ${
                rotationMode === 'relative'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-[#A0AEC0] hover:text-white'
              }`}
              title="Giro AP é incremental a partir de cada ponto"
              id="btn-rot-mode-relative"
            >
              Relativa (Incremental)
            </button>
            <button
              onClick={() => setRotationMode('absolute')}
              className={`text-[11px] font-semibold py-1 px-2.5 rounded-lg transition-all cursor-pointer ${
                rotationMode === 'absolute'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-[#A0AEC0] hover:text-white'
              }`}
              title="Giro AP é absoluto em relação à mesa original"
              id="btn-rot-mode-absolute"
            >
              Absoluta
            </button>
          </div>

          {/* 3D Visualizer Camera/Alignment Frame Mode */}
          <div className="flex items-center gap-1 bg-[#121418] p-1 rounded-xl border border-[#2D3748]">
            <span className="text-[10px] font-semibold text-[#718096] px-2 font-mono uppercase">Enquadramento 3D:</span>
            <button
              onClick={() => setAlignmentMode('relative')}
              className={`text-[11px] font-semibold py-1 px-2.5 rounded-lg transition-all cursor-pointer ${
                alignmentMode === 'relative'
                  ? 'bg-amber-600 text-white font-bold shadow-sm'
                  : 'text-[#A0AEC0] hover:text-white'
              }`}
              title="Desenha a haste a partir da ponta inicial (origem), ideal para ver a geometria pura da peça"
              id="btn-align-mode-relative"
            >
              Fixo na Haste
            </button>
            <button
              onClick={() => setAlignmentMode('nozzle')}
              className={`text-[11px] font-semibold py-1 px-2.5 rounded-lg transition-all cursor-pointer ${
                alignmentMode === 'nozzle'
                  ? 'bg-amber-600 text-white font-bold shadow-sm'
                  : 'text-[#A0AEC0] hover:text-white'
              }`}
              title="Desenha a haste saindo do bocal, simulando o bocal como origem fixa"
              id="btn-align-mode-nozzle"
            >
              Fixo no Bocal
            </button>
          </div>

          {/* Preset templates */}
          <div className="flex items-center gap-1 bg-[#121418] p-1 rounded-xl border border-[#2D3748]">
            <span className="text-[10px] font-semibold text-[#718096] px-2 font-mono uppercase">Gabaritos:</span>
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                onClick={() => loadTemplate(tpl)}
                className="bg-[#2D3748] hover:bg-[#4A5568] text-white text-xs font-semibold py-1 px-2.5 rounded-lg border border-[#4A5568]/60 shadow-sm active:scale-95 transition-all cursor-pointer"
                id={`btn-load-${tpl.name.replace(/\s+/g, '-').toLowerCase()}`}
              >
                {tpl.name.split(' ').slice(2).join(' ') || tpl.name}
              </button>
            ))}
          </div>

          {/* PDF Drawing Attachment Button */}
          <div className="relative">
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={handlePdfUpload}
              className="hidden"
              id="pdf-upload-input"
              disabled={isAnalyzingPDF}
            />
            <label
              htmlFor="pdf-upload-input"
              className={`bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1.5 shadow-[0_0_15px_rgba(79,70,229,0.25)] active:scale-95 transition-all cursor-pointer border border-indigo-500 ${isAnalyzingPDF ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isAnalyzingPDF ? (
                <RefreshCw className="w-3.5 h-3.5 text-indigo-200 animate-spin" />
              ) : (
                <FileUp className="w-3.5 h-3.5 text-indigo-200" />
              )}
              <span>{isAnalyzingPDF ? 'Analisando...' : 'Anexar Desenho PDF'}</span>
            </label>
          </div>

          {/* Import / Export */}
          <button
            onClick={handleOpenExport}
            className="bg-[#2D3748] hover:bg-[#3D485C] text-[#E2E8F0] text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1.5 border border-[#4A5568]/60 shadow-sm active:scale-95 transition-all cursor-pointer"
            id="btn-import-export"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-400" />
            Salvar / Enviar
          </button>

          {/* Floating/Modal Help System Button */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="bg-[#2D3748] hover:bg-[#3B4A62] text-slate-100 border border-[#4A5568]/40 text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
            id="btn-help-modal-trigger"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            Ajuda & Operação
          </button>
        </div>
      </header>

      {/* Main Workspace Dashboard */}
      {isMaximized ? (
        <main className="w-full p-4 flex flex-col md:flex-row gap-4 flex-1 h-[calc(100vh-80px)] overflow-hidden bg-[#090B0E]" id="dashboard-main-maximized">
          {/* Left Panel: Compact Coordinates micro-table */}
          <section className="w-full md:w-[320px] shrink-0 flex flex-col gap-4 bg-[#121418] border border-[#2D3748] rounded-2xl p-4 shadow-xl h-full" id="maximized-left-panel">
            <div className="flex items-center justify-between border-b border-[#2D3748] pb-3" id="maximized-panel-header">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#A0AEC0] font-mono">Tabela Compacta</h3>
              </div>
              <button
                onClick={() => {
                  setIsMaximized(false);
                  // Fit camera after restoring to split-screen
                  setTimeout(() => {
                    setCameraActionTrigger({ action: 'fit', ts: Date.now() });
                  }, 100);
                }}
                className="bg-[#2D3748]/80 hover:bg-[#4A5568] border border-[#2D3748] text-[#E2E8F0] text-[10px] font-bold py-1 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                title="Sair de Tela Inteira e voltar para a tela padrão"
                id="btn-minimize-back"
              >
                <Minimize2 className="w-3 h-3 text-amber-400" />
                <span>Minimizar</span>
              </button>
            </div>

            {/* Micro-table scrollable list */}
            <div className="flex-1 overflow-y-auto pr-1 text-xs text-slate-300 max-h-[300px] md:max-h-none" id="maximized-micro-table">
              <table className="w-full text-left border-collapse font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-[#2D3748]/50 text-[#718096] uppercase text-[9px] tracking-wider">
                    <th className="py-2 px-1 text-center font-sans">Nº</th>
                    <th className="py-2 px-1">L (Alim.)</th>
                    <th className="py-2 px-1">AP (Giro)</th>
                    <th className="py-2 px-1">AC (Dobr.)</th>
                    <th className="py-2 px-1">R (Raio)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2D3748]/30">
                  {steps.map((step, idx) => {
                    const sIdx = idx + 1;
                    const isSelected = selectedStepIndex === sIdx;
                    const stepColors = [
                      '#FF2E63', '#FF9F1C', '#F4D03F', '#2ECC71',
                      '#00D2FC', '#7B2CBF', '#E040FB', '#10AC84',
                      '#54A0FF', '#FF6B6B'
                    ];
                    const col = stepColors[idx % stepColors.length];
                    return (
                      <tr
                        key={step.id}
                        onClick={() => handleSelectStep(sIdx)}
                        className={`hover:bg-[#2D3748]/50 transition-all cursor-pointer ${
                          isSelected ? 'bg-blue-950/40 border-l-2 border-blue-500' : ''
                        }`}
                      >
                        <td className="py-1 px-1 text-center font-bold" style={{ color: col }}>
                          {step.n}
                        </td>
                        <td className="py-1 px-0.5">
                          <input
                            type="number"
                            step="any"
                            value={step.l === null ? '' : step.l}
                            onChange={(e) => handleCompactCellChange(step.id, 'l', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-[#0F1115] hover:bg-[#1C1F26] focus:bg-[#1C1F26] text-center py-1 rounded border border-[#2D3748]/60 focus:border-blue-500 focus:outline-none text-[#E2E8F0] font-bold text-[11px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="py-1 px-0.5">
                          <input
                            type="number"
                            step="any"
                            placeholder="—"
                            value={step.ap === null ? '' : step.ap}
                            onChange={(e) => handleCompactCellChange(step.id, 'ap', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-[#0F1115] hover:bg-[#1C1F26] focus:bg-[#1C1F26] text-center py-1 rounded border border-[#2D3748]/60 focus:border-blue-500 focus:outline-none text-sky-400 font-semibold text-[11px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="py-1 px-0.5">
                          <input
                            type="number"
                            step="any"
                            placeholder="—"
                            value={step.ac === null ? '' : step.ac}
                            onChange={(e) => handleCompactCellChange(step.id, 'ac', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-[#0F1115] hover:bg-[#1C1F26] focus:bg-[#1C1F26] text-center py-1 rounded border border-[#2D3748]/60 focus:border-blue-500 focus:outline-none text-emerald-400 font-semibold text-[11px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="py-1 px-0.5">
                          <input
                            type="number"
                            step="any"
                            placeholder="1.5"
                            value={step.r === null ? '' : step.r}
                            onChange={(e) => handleCompactCellChange(step.id, 'r', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-[#0F1115] hover:bg-[#1C1F26] focus:bg-[#1C1F26] text-center py-1 rounded border border-[#2D3748]/60 focus:border-blue-500 focus:outline-none text-amber-400 font-semibold text-[11px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Quick status in compact view */}
            <div className="border-t border-[#2D3748] pt-3 text-[11px] text-slate-400 space-y-2 font-sans" id="maximized-compact-status">
              <div className="flex justify-between items-center bg-[#0F1115] p-2 rounded-lg border border-[#2D3748]/50 font-mono text-[10px]">
                <div>L. total: <b className="text-white">{totalLength.toFixed(1)}mm</b></div>
                <div>Tempo: <b className="text-emerald-400">{estimatedCycleTimeSec.toFixed(1)}s</b></div>
              </div>
              <p className="text-[10px] text-slate-500 italic leading-snug">
                Dica: Clique sobre as linhas das coordenadas acima para destacar o segmento correspondente no gráfico 3D!
              </p>
            </div>
          </section>

          {/* Right Panel: Grand Maximized 3D Viewer viewport and controls */}
          <section className="flex-1 flex flex-col gap-4 h-full" id="maximized-right-panel">
            <div className="bg-[#090B0E] border border-[#2D3748] rounded-2xl overflow-hidden shadow-2xl flex-1 flex flex-col min-h-[450px]" id="maximized-visualizer-card">
              {/* Header */}
              <div className="bg-[#121418] border-b border-[#2D3748] px-4 py-3 flex items-center justify-between" id="maximized-visualizer-header">
                <span className="text-xs font-bold text-[#E2E8F0] tracking-wider font-mono uppercase flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                  Visualização 3D Maximizada
                </span>
                <div className="flex items-center gap-2">
                  {selectedStepIndex && (
                    <span className="text-[11px] bg-blue-950/40 border border-blue-800/50 text-blue-400 py-0.5 px-2 rounded-full font-mono">
                      Passo {selectedStepIndex} Ativo
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setIsMaximized(false);
                      setTimeout(() => {
                        setCameraActionTrigger({ action: 'fit', ts: Date.now() });
                      }, 100);
                    }}
                    className="bg-[#2D3748] hover:bg-[#4A5568] border border-[#2D3748] text-slate-200 text-xs font-semibold py-1 px-2.5 rounded-lg flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-sm"
                    id="btn-exit-maximize"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Sair da Tela Inteira</span>
                  </button>
                </div>
              </div>

              {/* ThreeJS inside maximized */}
              <div className="flex-1 bg-[#090B0E] relative" id="maximized-three-viewport">
                <ThreeVisualizer
                  steps={steps}
                  rotationMode={rotationMode}
                  wireDiameter={wireDiameter}
                  hoveredStepIndex={hoveredStepIndex}
                  selectedStepIndex={selectedStepIndex}
                  onSelectStep={handleSelectStep}
                  animationProgress={animationProgress}
                  isAnimating={isAnimating}
                  cameraActionTrigger={cameraActionTrigger}
                  alignmentMode={alignmentMode}
                />
              </div>

              {/* Controller scrubber and player bar inside maximized */}
              <div className="bg-[#171923] border-t border-[#2D3748] p-4 space-y-3" id="maximized-player-controls-hud">
                <div className="flex justify-between items-center text-xs text-[#A0AEC0]">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-500" />
                    Simulador de Dobra Realista (Potenciômetro Ativo)
                  </span>
                  <span className="font-mono text-[#E2E8F0]">
                    {Math.round(animationProgress * 100)}%
                  </span>
                </div>

                {/* Progress track scrubber */}
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={animationProgress}
                    onChange={(e) => {
                      setIsAnimating(false);
                      const val = parseFloat(e.target.value);
                      setAnimationProgress(val);
                      const stepNum = Math.ceil(val * steps.length);
                      setSelectedStepIndex(stepNum > 0 ? stepNum : null);
                    }}
                    className="flex-1 h-1 bg-[#2D3748] rounded-lg appearance-none cursor-pointer accent-blue-500 border-none focus:outline-none"
                  />
                </div>

                {/* Buttons and speed slider potentiometer */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={handleStepBackward}
                      className="p-2 py-1.5 rounded-lg bg-[#2D3748] hover:bg-[#4A5568] border border-[#4A5568]/40 text-[#E2E8F0] transition-all cursor-pointer shadow-sm flex items-center justify-center"
                      id="maximized-btn-step-backward"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-300" />
                      <span className="text-[11px] font-semibold ml-1">Recuar</span>
                    </button>

                    {!isAnimating ? (
                      <button
                        onClick={handlePlayPause}
                        className="p-2 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white transition-all font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                        id="maximized-btn-play"
                      >
                        <Play className="w-3.5 h-3.5 fill-white text-white" />
                        <span className="text-[11px]">Executar</span>
                      </button>
                    ) : (
                      <button
                        onClick={handlePlayPause}
                        className="p-2 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-all font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                        id="maximized-btn-freeze"
                      >
                        <Pause className="w-3.5 h-3.5 text-white fill-white" />
                        <span className="text-[11px]">Congelar</span>
                      </button>
                    )}

                    <button
                      onClick={handleStepForward}
                      className="p-2 py-1.5 rounded-lg bg-[#2D3748] hover:bg-[#4A5568] border border-[#4A5568]/40 text-[#E2E8F0] transition-all cursor-pointer shadow-sm flex items-center justify-center"
                      id="maximized-btn-step-forward"
                    >
                      <span className="text-[11px] font-semibold mr-1">Avançar</span>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </button>

                    <button
                      onClick={handleStopAnimation}
                      className="p-2 py-1.5 rounded-lg bg-[#311C24] hover:bg-[#4E2B38] border border-[#E11D48]/30 text-[#FDA4AF] transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                      id="maximized-btn-stop"
                    >
                      <Square className="w-3 h-3 fill-rose-500 text-rose-500" />
                      <span className="text-[11px] font-semibold">Parar</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={triggerCameraFit}
                      className="p-2 py-1.5 rounded-lg bg-[#090D16] hover:bg-[#1A2542] border border-[#1A2542] text-blue-300 hover:text-white transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-[11px] font-semibold">Enquadrar</span>
                    </button>

                    {/* Potentiometer slider in maximized layout */}
                    <div className="flex items-center gap-1.5 bg-[#0F1115] border border-[#2D3748] px-2.5 py-1.5 rounded-xl text-slate-400 text-xs font-mono" id="maximized-speed-potentiometer">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Vel:</span>
                      <input
                        type="range"
                        min="0.2"
                        max="4.0"
                        step="0.1"
                        value={animationSpeed}
                        onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
                        className="w-16 sm:w-24 accent-amber-500 h-1 bg-[#2D3748] rounded-lg appearance-none cursor-pointer"
                        title="Potenciômetro de Velocidade"
                        id="maximized-speed-pot"
                      />
                      <span className="text-amber-400 font-bold font-sans text-[11px] min-w-[26px] text-right">
                        {animationSpeed.toFixed(1)}x
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      ) : (
        <main className="max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-auto" id="dashboard-main">
          
          {/* PDF Analysis Alert */}
          {(pdfError || pdfSuccess || isAnalyzingPDF) && (
            <div className="col-span-12 font-sans">
              {isAnalyzingPDF && (
                <div className="bg-indigo-950/20 border border-indigo-900/30 text-indigo-200 p-4 rounded-2xl flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-indigo-100">Analisando desenho técnico por IA...</p>
                    <p className="text-indigo-300 mt-0.5">O Gemini está lendo a tabela de dobras e as imagens em 3D do desenho para gerar as coordenadas completas.</p>
                  </div>
                </div>
              )}
              {pdfError && (
                <div className="bg-rose-950/20 border border-rose-900/30 text-rose-200 p-4 rounded-2xl flex items-start gap-3 relative">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-xs pr-8">
                    <p className="font-bold text-rose-100">Erro na análise do desenho</p>
                    <p className="text-rose-300 mt-0.5">{pdfError}</p>
                  </div>
                  <button
                    onClick={() => setPdfError(null)}
                    className="absolute top-4 right-4 text-rose-400 hover:text-rose-200 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}
              {pdfSuccess && (
                <div className="bg-emerald-950/20 border border-emerald-900/30 text-emerald-200 p-4 rounded-2xl flex items-start gap-3 relative">
                  <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs pr-8">
                    <p className="font-bold text-emerald-100">Sucesso!</p>
                    <p className="text-emerald-300 mt-0.5">{pdfSuccess}</p>
                  </div>
                  <button
                    onClick={() => setPdfSuccess(null)}
                    className="absolute top-4 right-4 text-emerald-400 hover:text-emerald-200 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Left Column (Grid col 7) - The Coordinates table and config */}
          <section className="lg:col-span-7 flex flex-col gap-6 h-full" id="dashboard-left-panel">
          
          {/* Compact Quick Tip Bar */}
          <div className="bg-[#121418] border border-[#2D3748] rounded-xl px-4 py-2 flex items-center justify-between text-[11px] text-[#A0AEC0] shadow-sm" id="compact-quick-tip">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Simulador operando em modo de <b>Orientação Absoluta</b>. Selecione ou passe o mouse sobre qualquer linha na tabela abaixo para focar no respectivo segmento em 3D.</span>
            </div>
          </div>

          {/* Program Table component container */}
          <div className="bg-[#121418] border border-[#2D3748] rounded-2xl p-5 shadow-md flex-1 min-h-[480px] flex flex-col" id="table-card">
            <ProgramTable
              steps={steps}
              onStepsChange={setSteps}
              hoveredStepIndex={hoveredStepIndex}
              onHoverStep={setHoveredStepIndex}
              selectedStepIndex={selectedStepIndex}
              onSelectStep={handleSelectStep}
              wireDiameter={wireDiameter}
            />
          </div>

          {/* Alerts / Warnings Panel (Only if there are physical interference issues) */}
          {warnings.length > 0 && (
            <div className="bg-amber-950/20 border border-amber-900/30 rounded-2xl p-4 flex gap-3 text-amber-200 leading-normal" id="alerts-panel">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <h4 className="font-bold flex items-center gap-1 text-[13px] text-amber-100 font-sans">
                  Possíveis Alertas Geométricos ({warnings.length})
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-amber-300 font-mono text-[11px]">
                  {warnings.slice(0, 3).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {warnings.length > 3 && (
                    <li>...e mais {warnings.length - 3} alertas de curvatura.</li>
                  )}
                </ul>
              </div>
            </div>
          )}

        </section>

        {/* Right Column (Grid col 5) - 3D Viewer viewport and animation simulator */}
        <section className="lg:col-span-5 flex flex-col gap-6" id="dashboard-right-panel">
          
          {/* 3D Graphics Canvas Box */}
          <div className="bg-[#090B0E] border border-[#2D3748] rounded-2xl overflow-hidden shadow-md flex flex-col min-h-[400px] h-[550px] sticky top-6" id="visualizer-card">
            {/* 3D header */}
            <div className="bg-[#121418] border-b border-[#2D3748] px-4 py-3 flex items-center justify-between" id="visualizer-header">
              <span className="text-xs font-bold text-[#E2E8F0] tracking-wider font-mono uppercase flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                Gráfico 3D Interativo
              </span>
              <div className="flex items-center gap-2">
                {selectedStepIndex && (
                  <span className="text-[11px] bg-blue-950/40 border border-blue-800/50 text-blue-400 py-0.5 px-2 rounded-full font-mono">
                    Passo {selectedStepIndex} Ativo
                  </span>
                )}
                <button
                  onClick={() => {
                    setIsMaximized(true);
                    // Trigger camera fit right after entering maximized mode
                    setTimeout(() => {
                      setCameraActionTrigger({ action: 'fit', ts: Date.now() });
                    }, 100);
                  }}
                  className="bg-[#2D3748] hover:bg-[#4A5568] hover:text-white text-slate-300 border border-[#2D3748] py-1 px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-sm"
                  title="Maximizar Tela Inteira"
                  id="btn-maximize-canvas"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Maximizar</span>
                </button>
              </div>
            </div>

            {/* ThreeJS viewer component viewport */}
            <div className="flex-1 bg-[#090B0E] relative" id="three-viewer-viewport">
              <ThreeVisualizer
                steps={steps}
                rotationMode={rotationMode}
                wireDiameter={wireDiameter}
                hoveredStepIndex={hoveredStepIndex}
                selectedStepIndex={selectedStepIndex}
                onSelectStep={handleSelectStep}
                animationProgress={animationProgress}
                isAnimating={isAnimating}
                cameraActionTrigger={cameraActionTrigger}
                alignmentMode={alignmentMode}
              />
            </div>

            {/* Bending Simulator Player HUD bar */}
            <div className="bg-[#171923] border-t border-[#2D3748] p-4 space-y-3" id="player-controls-hud">
              <div className="flex justify-between items-center text-xs text-[#A0AEC0]" id="player-header">
                <span className="font-semibold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-500" />
                  Simulador de Dobra Realista
                </span>
                <span className="font-mono text-[#E2E8F0]">
                  {Math.round(animationProgress * 100)}%
                </span>
              </div>

              {/* Progress track scrubber */}
              <div className="flex items-center gap-3" id="scrubber-container">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={animationProgress}
                  onChange={(e) => {
                    setIsAnimating(false);
                    const val = parseFloat(e.target.value);
                    setAnimationProgress(val);
                    // Match selectedStepIndex with the scrubber position
                    const stepNum = Math.ceil(val * steps.length);
                    setSelectedStepIndex(stepNum > 0 ? stepNum : null);
                  }}
                  className="flex-1 h-1 bg-[#2D3748] rounded-lg appearance-none cursor-pointer accent-blue-500 border-none focus:outline-none"
                  id="scrubber-slider"
                />
              </div>

              {/* Play buttons, block-by-block, and speed */}
              <div className="flex flex-wrap items-center justify-between gap-3" id="player-buttons-container">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Backward step-by-step block */}
                  <button
                    onClick={handleStepBackward}
                    className="p-2 py-1.5 rounded-lg bg-[#2D3748] hover:bg-[#4A5568] border border-[#4A5568]/40 text-[#E2E8F0] transition-all cursor-pointer shadow-sm flex items-center justify-center"
                    title="Recuar Bloco a Bloco (Passo anterior)"
                    id="btn-step-backward"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-300" />
                    <span className="text-[11px] font-semibold ml-1 hidden sm:inline">Recuar</span>
                  </button>

                  {/* Play Button */}
                  {!isAnimating ? (
                    <button
                      onClick={handlePlayPause}
                      className="p-2 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white transition-all font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/20"
                      title="Iniciar Simulação da Máquina"
                      id="btn-play"
                    >
                      <Play className="w-3.5 h-3.5 fill-white text-white" />
                      <span className="text-[11px]">Executar</span>
                    </button>
                  ) : (
                    /* Congelar (Pause) Button */
                    <button
                      onClick={handlePlayPause}
                      className="p-2 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-all font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-950/20"
                      title="Congelar Movimento (Pausar)"
                      id="btn-freeze"
                    >
                      <Pause className="w-3.5 h-3.5 text-white fill-white" />
                      <span className="text-[11px]">Congelar</span>
                    </button>
                  )}

                  {/* Forward step-by-step block */}
                  <button
                    onClick={handleStepForward}
                    className="p-2 py-1.5 rounded-lg bg-[#2D3748] hover:bg-[#4A5568] border border-[#4A5568]/40 text-[#E2E8F0] transition-all cursor-pointer shadow-sm flex items-center justify-center"
                    title="Avançar Bloco a Bloco (Próximo passo)"
                    id="btn-step-forward"
                  >
                    <span className="text-[11px] font-semibold mr-1 hidden sm:inline">Avançar</span>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>

                  {/* Stop button (Finaliza e volta enquadrado) */}
                  <button
                    onClick={handleStopAnimation}
                    className="p-2 py-1.5 rounded-lg bg-[#311C24] hover:bg-[#4E2B38] border border-[#E11D48]/30 text-[#FDA4AF] transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                    title="Finalizar Programação (Completa e enquadra)"
                    id="btn-stop-complete"
                  >
                    <Square className="w-3 h-3 fill-rose-500 text-rose-500" />
                    <span className="text-[11px] font-semibold">Parar</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Enquadrar button */}
                  <button
                    onClick={triggerCameraFit}
                    className="p-2 py-1.5 rounded-lg bg-[#090D16] hover:bg-[#1A2542] border border-[#1A2542] text-blue-300 hover:text-white transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                    title="Enquadrar Peça Inteira no Gráfico"
                    id="btn-hud-fit-camera"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[11px] font-semibold">Enquadrar</span>
                  </button>

                  {/* Potentiometer range input */}
                  <div className="flex items-center gap-1.5 bg-[#0F1115] border border-[#2D3748] px-2.5 py-1.5 rounded-xl text-slate-400 text-xs font-mono" id="speed-potentiometer">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Vel:</span>
                    <input
                      type="range"
                      min="0.2"
                      max="4.0"
                      step="0.1"
                      value={animationSpeed}
                      onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
                      className="w-16 sm:w-24 accent-amber-500 h-1 bg-[#2D3748] rounded-lg appearance-none cursor-pointer"
                      title="Potenciômetro de Velocidade"
                      id="input-speed-potentiometer"
                    />
                    <span className="text-amber-400 font-bold font-sans text-[11px] min-w-[26px] text-right">
                      {animationSpeed.toFixed(1)}x
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Manufacturing Planning Statistics Dashboard card */}
          <div className="bg-[#121418] border border-[#2D3748] rounded-2xl p-5 shadow-md space-y-4" id="stats-card">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#A0AEC0] font-mono flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-500" />
              Análise de Produção Estimada
            </h3>

            <div className="grid grid-cols-2 gap-4 text-xs font-sans" id="stats-grid">
              {/* Stat 1: Total Length */}
              <div className="bg-[#1A202C] border border-[#2D3748]/60 rounded-xl p-3" id="stat-length">
                <span className="text-[#A0AEC0] text-[10px] uppercase font-mono tracking-wider block mb-1">Fio Necessário</span>
                <span className="text-lg font-bold text-white font-mono">
                  {totalLength.toFixed(1)} mm
                </span>
                <span className="text-[10px] text-[#718096] block mt-1">({(totalLength / 1000).toFixed(3)} metros por peça)</span>
              </div>

              {/* Stat 2: Total Weight */}
              <div className="bg-[#1A202C] border border-[#2D3748]/60 rounded-xl p-3" id="stat-weight">
                <span className="text-[#A0AEC0] text-[10px] uppercase font-mono tracking-wider block mb-1">Peso da Peça</span>
                <span className="text-lg font-bold text-white font-mono">
                  {pieceWeightGrams.toFixed(2)} g
                </span>
                <span className="text-[10px] text-[#718096] block mt-1">(Aço Inox, densidade ~7.85g/cm³)</span>
              </div>

              {/* Stat 3: Total bends */}
              <div className="bg-[#1A202C] border border-[#2D3748]/60 rounded-xl p-3" id="stat-bends">
                <span className="text-[#A0AEC0] text-[10px] uppercase font-mono tracking-wider block mb-1">Dobras (Pino)</span>
                <span className="text-lg font-bold text-white font-mono">
                  {totalBends} dobras
                </span>
                <span className="text-[10px] text-[#718096] block mt-1">({steps.length} segmentos totais)</span>
              </div>

              {/* Stat 4: Estimated Production cycle */}
              <div className="bg-[#1A202C] border border-[#2D3748]/60 rounded-xl p-3" id="stat-cycle">
                <span className="text-[#A0AEC0] text-[10px] uppercase font-mono tracking-wider block mb-1">Tempo de Ciclo (Est.)</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">
                  {estimatedCycleTimeSec.toFixed(1)} segundos
                </span>
                <span className="text-[10px] text-[#718096] block mt-1">
                  (~{Math.round(3600 / estimatedCycleTimeSec)} peças por hora)
                </span>
              </div>
            </div>
          </div>

        </section>

      </main>
      )}

      {/* Floating Modal for Save/Export and Import coordinates */}
      {showDataIO && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" id="modal-io-container">
          <div className="bg-[#121418] border border-[#2D3748] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col" id="modal-io-card">
            
            {/* Modal Header */}
            <div className="bg-[#171923] border-b border-[#2D3748] px-5 py-4 flex justify-between items-center" id="modal-io-header">
              <h3 className="font-bold text-[#E2E8F0] text-sm font-sans flex items-center gap-1.5">
                <FileDown className="w-5 h-5 text-blue-400" />
                Salvar ou Importar Programa (Formato JSON)
              </h3>
              <button
                onClick={() => setShowDataIO(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#2D3748] transition-colors cursor-pointer"
                id="btn-close-modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 flex flex-col gap-4" id="modal-io-body">
              <p className="text-xs text-[#A0AEC0] font-sans leading-normal">
                Você pode copiar o código JSON abaixo para fazer backup de seus ajustes e programas de haste, ou colar um código JSON previamente salvo para carregar no simulador.
              </p>

              {/* Textarea */}
              <div className="flex-1 min-h-[220px]" id="textarea-container">
                <textarea
                  value={ioText}
                  onChange={(e) => setIoText(e.target.value)}
                  className="w-full h-full bg-[#0F1115] text-[#E2E8F0] p-3 rounded-xl border border-[#2D3748] font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                  id="textarea-io"
                />
              </div>

              {/* Error message */}
              {ioError && (
                <div className="bg-rose-950/20 border border-rose-800/40 text-rose-300 text-xs p-3 rounded-xl flex gap-2 items-center leading-normal" id="io-error-container">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{ioError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-[#171923] border-t border-[#2D3748] px-5 py-3.5 flex justify-between items-center" id="modal-io-footer">
              <button
                onClick={handleCopyToClipboard}
                className="bg-[#2D3748] hover:bg-[#4A5568] border border-[#4A5568] text-[#E2E8F0] text-xs font-semibold py-2 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                id="btn-copy-io"
              >
                {copySuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500 animate-scale" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-400" />
                    Copiar Código
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleImport}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 px-4 rounded-xl transition-all shadow-sm shadow-blue-600/10 cursor-pointer"
                  id="btn-apply-io"
                >
                  Carregar no Painel
                </button>
                <button
                  onClick={() => setShowDataIO(false)}
                  className="bg-[#2D3748] hover:bg-[#4A5568] border border-[#4A5568] text-slate-200 text-xs font-semibold py-2 px-4 rounded-xl transition-all shadow-sm cursor-pointer"
                  id="btn-cancel-io"
                >
                  Cancelar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Floating Modal for Instruction Guide and Machine Operation Help */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto" id="modal-help-container">
          <div className="bg-[#121418] border border-[#2D3748] rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col my-8 animate-scale" id="modal-help-card">
            
            {/* Modal Header */}
            <div className="bg-[#171923] border-b border-[#2D3748] px-6 py-4 flex justify-between items-center" id="modal-help-header">
              <h3 className="font-bold text-[#E2E8F0] text-sm md:text-base font-sans flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
                <span>Manual de Orientação e Operação (Simulador WAFIOS 3D)</span>
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#2D3748] transition-colors cursor-pointer"
                id="btn-close-help-modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 overflow-y-auto max-h-[70vh] space-y-6 text-slate-300" id="modal-help-body">
              <p className="text-xs text-[#A0AEC0] leading-relaxed">
                Este simulador 3D foi desenvolvido para tornar o processo de programação de dobras de fios (padrão WAFIOS) intuitivo e livre de erros. Conforme você preenche a tabela de coordenadas, a peça é calculada geometricamente em tempo real, partindo do bocal de alimentação fixo.
              </p>
              
              <InstructionGuide />
            </div>

            {/* Modal Footer */}
            <div className="bg-[#171923] border-t border-[#2D3748] px-6 py-4 flex justify-end items-center" id="modal-help-footer">
              <button
                onClick={() => setShowHelpModal(false)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 px-6 rounded-xl transition-all shadow-md shadow-blue-600/15 cursor-pointer"
                id="btn-close-help-footer"
              >
                Entendi, voltar para a Simulação
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Global CSS animation injections for micro transitions */}
      <style>{`
        @keyframes scaleIn {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale {
          animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

    </div>
  );
}
