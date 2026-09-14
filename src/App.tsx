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
  EyeOff,
  LayoutDashboard,
  Video,
  Film,
  Wand2,
  FileText,
  CheckCircle2,
  X
} from 'lucide-react';
import { BenderStep, RotationMode, PieceTemplate } from './types';
import { generateWireGeometry } from './utils/geometry';
import { enforceTorsionAndCorteRules, getTorsionValidationErrors } from './utils/rules';
import ProgramTable from './components/ProgramTable';
import ThreeVisualizer from './components/ThreeVisualizer';
import InstructionGuide from './components/InstructionGuide';
import html2pdf from 'html2pdf.js';

// Initial pre-loaded piece templates
const TEMPLATES: PieceTemplate[] = [
  {
    name: 'Haste Boia 23319',
    description: 'Haste Boia 23319 calibrada com cotas defletidas de máquina AC e rotação 3D sem cruzamento',
    rotationMode: 'relative',
    wireDiameter: 2.0,
    cameraDirection: { x: -0.45, y: -0.35, z: 1.8 },
    steps: [
      { id: '319-1', n: 1, l: 15.50, w: null, esp: null, ap: 90.0,  apCorr: null, ac: 90.0,  acCorr: null, r: 2.0, comment: 'Dobra 1 (90°)' },
      { id: '319-2', n: 2, l: 30.00, w: null, esp: null, ap: -90.0, apCorr: null, ac: -90.0, acCorr: null, r: 2.0, comment: 'Dobra 2 (90°)' },
      { id: '319-3', n: 3, l: 7.00,  w: null, esp: null, ap: 0.0,   apCorr: null, ac: 90.0,  acCorr: null, r: 2.0, comment: 'Dobra 3 (90°)' },
      { id: '319-4', n: 4, l: 23.00, w: null, esp: null, ap: 0.0,   apCorr: null, ac: -51.0, acCorr: null, r: 2.0, comment: 'Dobra 4 (51° / 129° int)' },
      { id: '319-5', n: 5, l: 25.00, w: null, esp: null, ap: 0.0,   apCorr: null, ac: 90.0,  acCorr: null, r: 2.0, comment: 'Dobra 5 (90°)' },
      { id: '319-6', n: 6, l: 86.00, w: null, esp: null, ap: 0.0,   apCorr: null, ac: -24.0, acCorr: null, r: 2.0, comment: 'Dobra 6 (24° / 156° int)' },
      { id: '319-7', n: 7, l: 111.62,w: null, esp: null, ap: 90.0,  apCorr: null, ac: 90.0,  acCorr: null, r: 2.0, comment: 'Dobra 7 (90°)' },
      { id: '319-8', n: 8, l: 68.30, w: null, esp: null, ap: 0.0,   apCorr: null, ac: null,  acCorr: null, r: 2.0, comment: 'Corte E' },
    ],
  },
  {
    name: 'Haste Boia 23259',
    description: 'Haste Boia 23259 baseada nas medidas do desenho em PDF',
    rotationMode: 'relative',
    wireDiameter: 2.5,
    cameraDirection: { x: -0.65, y: 0.85, z: 1.45 },
    steps: [
      { id: '259-1', n: 1, l: 18.0, w: null, esp: null, ap: null,  apCorr: null, ac: 90.0,  acCorr: null, r: 1.25, comment: 'Dobra 1 (90°)' },
      { id: '259-2', n: 2, l: 30.0, w: null, esp: null, ap: 90.0,  apCorr: null, ac: 82.5,  acCorr: null, r: 1.25, comment: 'Dobra 2 (97.5° int)' },
      { id: '259-3', n: 3, l: 85.8, w: null, esp: null, ap: null,  apCorr: null, ac: -47.5, acCorr: null, r: 1.25, comment: 'Dobra 3 (132.5° int)' },
      { id: '259-4', n: 4, l: 34.3, w: null, esp: null, ap: null,  apCorr: null, ac: 43.3,  acCorr: null, r: 1.25, comment: 'Dobra 4 (136.7° int)' },
      { id: '259-5', n: 5, l: 43.5, w: null, esp: null, ap: null,   apCorr: null, ac: -90.0, acCorr: null, r: 1.25, comment: 'Dobra 5 (90° int)' },
      { id: '259-6', n: 6, l: 65.8, w: null, esp: null, ap: null,  apCorr: null, ac: null,  acCorr: null, r: 1.25, comment: 'Corte E' },
    ],
  },
  {
    name: 'Haste Boia 23321',
    description: 'Haste Boia 23321 baseada nas medidas do desenho em PDF',
    rotationMode: 'relative',
    wireDiameter: 2.5,
    cameraDirection: { x: -0.45, y: -0.35, z: 1.8 },
    steps: [
      { id: '1', n: 1, l: 7.25,  w: null, esp: null, ap: null,  apCorr: null, ac: 90.0,  acCorr: null, r: 1.5, comment: 'Dobra 1' },
      { id: '2', n: 2, l: 22.50, w: null, esp: null, ap: -90.0, apCorr: null, ac: -60.0, acCorr: null, r: 1.5, comment: 'Dobra 2 (120° int)' },
      { id: '3', n: 3, l: 64.00, w: null, esp: null, ap: null,  apCorr: null, ac: -67.0, acCorr: null, r: 1.5, comment: 'Dobra 3 (113° int)' },
      { id: '4', n: 4, l: 30.00, w: null, esp: null, ap: 90.0,  apCorr: null, ac: 60.0,  acCorr: null, r: 1.5, comment: 'Dobra 4 (120° int)' },
      { id: '5', n: 5, l: 74.00, w: null, esp: null, ap: null,  apCorr: null, ac: -60.0, acCorr: null, r: 1.5, comment: 'Dobra 5 (120° int)' },
      { id: '6', n: 6, l: 51.07, w: null, esp: null, ap: null,  apCorr: null, ac: 90.0,  acCorr: null, r: 1.5, comment: 'Dobra 6 (90° int)' },
      { id: '7', n: 7, l: 71.80, w: null, esp: null, ap: null,  apCorr: null, ac: null,  acCorr: null, r: 1.5, comment: 'Corte E' },
    ],
  },
  {
    name: 'Haste Boia 23322',
    description: 'Haste Boia 23322 baseada nas medidas do desenho em PDF',
    rotationMode: 'relative',
    wireDiameter: 2.5,
    cameraDirection: { x: 0.45, y: 0.35, z: 1.8 },
    steps: [
      { id: '322-1', n: 1, l: 7.25,   w: null, esp: null, ap: null,  apCorr: null, ac: 90.0,  acCorr: null, r: 1.25, comment: 'Dobra 1 (90.0°)' },
      { id: '322-2', n: 2, l: 22.50,  w: null, esp: null, ap: -90.0, apCorr: null, ac: -52.0, acCorr: null, r: 1.25, comment: 'Dobra 2 (128.0° int)' },
      { id: '322-3', n: 3, l: 36.25,  w: null, esp: null, ap: null,  apCorr: null, ac: -70.0, acCorr: null, r: 1.25, comment: 'Dobra 3 (110.0° int)' },
      { id: '322-4', n: 4, l: 139.52, w: null, esp: null, ap: 90.0,  apCorr: null, ac: 90.0,  acCorr: null, r: 1.25, comment: 'Dobra 4 (90.0° int)' },
      { id: '322-5', n: 5, l: 62.80,  w: null, esp: null, ap: null,  apCorr: null, ac: null,  acCorr: null, r: 1.25, comment: 'Corte E' },
    ],
  },
  {
    name: 'Haste Boia 23217',
    description: 'Haste Boia 23217 baseada nas medidas do desenho em PDF com 8 dobras',
    rotationMode: 'relative',
    wireDiameter: 2.5,
    cameraDirection: { x: -0.5, y: -0.4, z: 1.8 },
    steps: [
      { id: '217-1', n: 1, l: 12.75, w: null, esp: null, ap: null,  apCorr: null, ac: 90.0,  acCorr: null, r: 1.25, comment: 'Dobra 1 (90°)' },
      { id: '217-2', n: 2, l: 40.50, w: null, esp: null, ap: -90.0, apCorr: null, ac: -30.0, acCorr: null, r: 1.25, comment: 'Dobra 2 (150° int)' },
      { id: '217-3', n: 3, l: 62.00, w: null, esp: null, ap: null,  apCorr: null, ac: 90.0,  acCorr: null, r: 1.25, comment: 'Dobra 3 (90° int)' },
      { id: '217-4', n: 4, l: 28.00, w: null, esp: null, ap: null,  apCorr: null, ac: -30.0, acCorr: null, r: 1.25, comment: 'Dobra 4 (150° int)' },
      { id: '217-5', n: 5, l: 24.70, w: null, esp: null, ap: null,  apCorr: null, ac: 56.2,  acCorr: null, r: 1.25, comment: 'Dobra 5 (123.8° int)' },
      { id: '217-6', n: 6, l: 79.17, w: null, esp: null, ap: null,  apCorr: null, ac: -50.0, acCorr: null, r: 1.25, comment: 'Dobra 6 (130° int)' },
      { id: '217-7', n: 7, l: 22.00, w: null, esp: null, ap: null,  apCorr: null, ac: 50.0,  acCorr: null, r: 1.25, comment: 'Dobra 7 (130° int)' },
      { id: '217-8', n: 8, l: 79.30, w: null, esp: null, ap: 90.0,  apCorr: null, ac: -90.0, acCorr: null, r: 1.25, comment: 'Dobra 8 (90° int)' },
      { id: '217-9', n: 9, l: 73.00, w: null, esp: null, ap: null,  apCorr: null, ac: null,  acCorr: null, r: 1.25, comment: 'Corte E' },
    ],
  },
  {
    name: 'Haste Boia 23713',
    description: 'Haste Boia 23713 ajustada perfeitamente com 8 passos',
    rotationMode: 'relative',
    wireDiameter: 2.5,
    cameraDirection: { x: -0.6, y: -0.5, z: 1.8 },
    steps: [
      { id: '713-1', n: 1, l: 7.20,  w: null, esp: null, ap: null,  apCorr: null, ac: 90.0,  acCorr: null, r: 1.5, comment: 'Dobra 1 (90°)' },
      { id: '713-2', n: 2, l: 23.50, w: null, esp: null, ap: -90.0, apCorr: null, ac: -50.0, acCorr: null, r: 1.5, comment: 'Dobra 2 (130° int)' },
      { id: '713-3', n: 3, l: 13.20, w: null, esp: null, ap: null,  apCorr: null, ac: 71.0,  acCorr: null, r: 1.5, comment: 'Dobra 3 (109° int)' },
      { id: '713-4', n: 4, l: 19.70, w: null, esp: null, ap: null,  apCorr: null, ac: -63.0, acCorr: null, r: 1.5, comment: 'Dobra 4 (117° int)' },
      { id: '713-5', n: 5, l: 18.60, w: null, esp: null, ap: null,  apCorr: null, ac: 40.0,  acCorr: null, r: 1.5, comment: 'Dobra 5 (140° int)' },
      { id: '713-6', n: 6, l: 69.10, w: null, esp: null, ap: null,  apCorr: null, ac: -40.0, acCorr: null, r: 1.5, comment: 'Dobra 6 (140° int)' },
      { id: '713-7', n: 7, l: 254.90,w: null, esp: null, ap: 180.0, apCorr: null, ac: -90.0, acCorr: null, r: 1.5, comment: 'Dobra 7 (90° int)' },
      { id: '713-8', n: 8, l: 77.20, w: null, esp: null, ap: null,  apCorr: null, ac: null,  acCorr: null, r: 1.5, comment: 'Corte E' },
    ],
  },
  {
    name: 'Haste boia 23323',
    description: 'Gabarito salvo a partir do simulador',
    rotationMode: 'relative',
    wireDiameter: 2.5,
    cameraDirection: { x: -0.45, y: -0.35, z: 1.8 },
    steps: [
      { id: '323-1', n: 1, l: 7.25,   w: null, esp: null, ap: null,  apCorr: null, ac: -90.0, acCorr: null, r: 1.5, comment: 'Dobra 1 (90°)' },
      { id: '323-2', n: 2, l: 22.50,  w: null, esp: null, ap: -90.0, apCorr: null, ac: 50.0,  acCorr: null, r: 1.5, comment: 'Dobra 2 (130° int)' },
      { id: '323-3', n: 3, l: 35.20,  w: null, esp: null, ap: 0.0,   apCorr: null, ac: 70.0,  acCorr: null, r: 1.5, comment: 'Dobra 3 (110° int)' },
      { id: '323-4', n: 4, l: 118.00, w: null, esp: null, ap: 90.0,  apCorr: null, ac: 90.0,  acCorr: null, r: 1.5, comment: 'Dobra 4 (90° int)' },
      { id: '323-5', n: 5, l: 67.50,  w: null, esp: null, ap: 0.0,   apCorr: null, ac: null,  acCorr: null, r: 1.5, comment: 'Corte E' },
    ],
  },
  {
    name: 'Haste boia 23323X',
    description: 'Gabarito salvo a partir do simulador',
    rotationMode: 'relative',
    wireDiameter: 2.5,
    cameraDirection: { x: -0.45, y: -0.35, z: 1.8 },
    steps: [
      { id: '323x-1', n: 1, l: 7.25,   w: null, esp: null, ap: null,  apCorr: null, ac: -90.0, acCorr: null, r: 1.5, comment: 'Dobra 1 (90°)' },
      { id: '323x-2', n: 2, l: 22.50,  w: null, esp: null, ap: -90.0, apCorr: null, ac: 50.0,  acCorr: null, r: 1.5, comment: 'Dobra 2 (130° int)' },
      { id: '323x-3', n: 3, l: 35.20,  w: null, esp: null, ap: 0.0,   apCorr: null, ac: 70.0,  acCorr: null, r: 1.5, comment: 'Dobra 3 (110° int)' },
      { id: '323x-4', n: 4, l: 118.00, w: null, esp: null, ap: 90.0,  apCorr: null, ac: 90.0,  acCorr: null, r: 1.5, comment: 'Dobra 4 (90° int)' },
      { id: '323x-5', n: 5, l: 67.50,  w: null, esp: null, ap: 0.0,   apCorr: null, ac: null,  acCorr: null, r: 1.5, comment: 'Corte E' },
    ],
  },
];

// Helper to normalize template names for deduplication & matching (ignores case, extra spaces, accents, and Portuguese articles like "da", "do", "de")
export const normalizeTemplateKey = (str: string): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase()
    .replace(/\b(da|do|de|das|dos)\b/g, '') // remove articles
    .replace(/[^a-z0-9]/g, ' ') // keep letters & numbers
    .replace(/\s+/g, ' ')
    .trim();
};

// Helper to deduplicate templates list based on normalized name
export const deduplicateTemplates = (list: PieceTemplate[]): PieceTemplate[] => {
  const map = new Map<string, PieceTemplate>();
  // 1. Add fresh built-in TEMPLATES definitions first as baseline defaults
  TEMPLATES.forEach(builtin => {
    const key = normalizeTemplateKey(builtin.name);
    if (key) {
      map.set(key, builtin);
    }
  });
  // 2. Override with saved user/custom templates so user modifications always take precedence!
  list.forEach(tpl => {
    const key = normalizeTemplateKey(tpl.name);
    if (key) {
      map.set(key, tpl);
    }
  });
  return Array.from(map.values());
};

export default function App() {
  // Helper to sanitize steps loaded from localStorage (cleans up any stale torsion on coplanar step 5)
  const sanitizeLoadedSteps = (rawSteps: any[]): BenderStep[] => {
    return rawSteps.map((s: any, idx: number) => {
      if (rawSteps.length === 6 && idx === 4 && s.ap === -90 && Math.abs(s.l - 43.5) < 1) {
        return { ...s, ap: null, w: s.w !== undefined ? s.w : null };
      }
      return { ...s, w: s.w !== undefined ? s.w : null };
    });
  };

  // State for steps
  const [steps, setSteps] = useState<BenderStep[]>(() => {
    const saved = localStorage.getItem('wafios_steps');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sanitizeLoadedSteps(parsed);
        }
      } catch (e) {
        console.error('Failed to load steps from localStorage', e);
      }
    }
    return TEMPLATES[0].steps;
  });

  const [referenceSteps, setReferenceSteps] = useState<BenderStep[]>(() => {
    const saved = localStorage.getItem('wafios_steps');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sanitizeLoadedSteps(parsed);
        }
      } catch (e) {
        console.error(e);
      }
    }
    return TEMPLATES[0].steps;
  });

  const [activeModelName, setActiveModelName] = useState<string>(() => {
    const saved = localStorage.getItem('wafios_active_model_name');
    if (saved) {
      return saved;
    }
    return 'Haste Boia 23321';
  });

  const [showComparison, setShowComparison] = useState<boolean>(false);
  const [rotationMode, setRotationMode] = useState<RotationMode>(() => {
    const saved = localStorage.getItem('wafios_rotation_mode');
    return (saved as RotationMode) || 'relative';
  });
  const [alignmentMode, setAlignmentMode] = useState<'relative' | 'nozzle'>('relative');
  const [wireDiameter, setWireDiameter] = useState<number>(() => {
    const saved = localStorage.getItem('wafios_wire_diameter');
    return saved ? parseFloat(saved) : 2.5;
  });
  const [cameraDirection, setCameraDirection] = useState<{ x: number; y: number; z: number } | null>(null);

  // Freeze state (Shows whole rod and highlights selected row)
  const [isFrozen, setIsFrozen] = useState<boolean>(false);

  // Dynamic template library states (persisted to localStorage)
  const [libraryTemplates, setLibraryTemplates] = useState<PieceTemplate[]>(() => {
    const saved = localStorage.getItem('wafios_library_templates');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return deduplicateTemplates(parsed);
        }
      } catch (e) {
        console.error('Failed to parse library templates', e);
      }
    }
    return deduplicateTemplates(TEMPLATES);
  });

  const [showLibraryModal, setShowLibraryModal] = useState<boolean>(false);
  const [showSaveLibraryModal, setShowSaveLibraryModal] = useState<boolean>(false);
  const [librarySearch, setLibrarySearch] = useState<string>('');
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [newTemplateDesc, setNewTemplateDesc] = useState<string>('');
  const [editingTemplateIndex, setEditingTemplateIndex] = useState<number | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState<string>('');
  const [editingTemplateDesc, setEditingTemplateDesc] = useState<string>('');
  const [deletingTemplateIndex, setDeletingTemplateIndex] = useState<number | null>(null);

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

  // Resizable layout state (Table vs 3D Visualizer window size)
  const [leftPanelRatio, setLeftPanelRatio] = useState<number>(() => {
    const saved = localStorage.getItem('wafios_left_panel_ratio');
    return saved ? parseFloat(saved) : 56;
  });
  const isResizingRef = useRef<boolean>(false);

  // Vertical Panel Height state (Adjust height of Table and 3D Visualizer windows)
  const [panelHeight, setPanelHeight] = useState<number>(() => {
    const saved = localStorage.getItem('wafios_panel_height');
    return saved ? parseFloat(saved) : 680;
  });
  const isHeightResizingRef = useRef<boolean>(false);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(680);

  const handleHeightResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isHeightResizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = panelHeight;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const handleHeightResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isHeightResizingRef.current) return;
    const deltaY = e.clientY - startYRef.current;
    const newHeight = startHeightRef.current + deltaY;
    // Constrain height between 380px and 1400px
    const clamped = Math.min(1400, Math.max(380, newHeight));
    setPanelHeight(clamped);
    localStorage.setItem('wafios_panel_height', clamped.toString());
  };

  const handleHeightResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isHeightResizingRef.current) {
      isHeightResizingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {
        // ignore
      }
    }
  };

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isResizingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizingRef.current) return;
    const container = document.getElementById('dashboard-main');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const ratio = (mouseX / rect.width) * 100;
    // Constrain between 25% and 75%
    const clamped = Math.min(75, Math.max(25, ratio));
    setLeftPanelRatio(clamped);
    localStorage.setItem('wafios_left_panel_ratio', clamped.toString());
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isResizingRef.current) {
      isResizingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {
        // ignore
      }
    }
  };

  // PDF / Drawing & Video Attachment & Multimodal AI Analysis State
  const [isAnalyzingPDF, setIsAnalyzingPDF] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfSuccess, setPdfSuccess] = useState<string | null>(null);

  const [attachedDrawing, setAttachedDrawing] = useState<{
    file: File;
    fileName: string;
    mimeType: string;
    fileData: string;
  } | null>(null);

  const [analysisReport, setAnalysisReport] = useState<{
    modelName?: string;
    notes?: string;
    warnings?: string[];
    isFallback?: boolean;
  } | null>(null);

  const drawingInputRef = useRef<HTMLInputElement | null>(null);

  const handleDrawingFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPdfError(null);
    setPdfSuccess(null);

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isPdf = file.type === 'application/pdf' || ext === 'pdf';
    const isImage = file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'svg'].includes(ext);

    if (!isPdf && !isImage) {
      setPdfError('Formato inválido! Envie um Desenho Técnico em PDF ou Imagem (PNG/JPG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1] || result;
      if (base64Data) {
        setAttachedDrawing({
          file,
          fileName: file.name,
          mimeType: isPdf ? 'application/pdf' : (file.type || 'image/png'),
          fileData: base64Data,
        });
        setPdfSuccess(`Desenho Técnico PDF "${file.name}" anexado com sucesso para análise.`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveDrawing = () => {
    setAttachedDrawing(null);
    if (drawingInputRef.current) drawingInputRef.current.value = '';
  };

  const handleRunAnalysis = async () => {
    setPdfError(null);
    setPdfSuccess(null);

    if (!attachedDrawing) {
      setPdfError(
        'Por favor, anexe o Desenho Técnico PDF antes de clicar em ANALISAR.'
      );
      return;
    }

    setIsAnalyzingPDF(true);

    try {
      const response = await fetch('/api/analyze-drawing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileData: attachedDrawing.fileData,
          mimeType: attachedDrawing.mimeType,
          fileName: attachedDrawing.fileName,
        }),
      });

      if (!response.ok) {
        let serverErrorMsg = `Erro do servidor (${response.status})`;
        try {
          const rawText = await response.text();
          try {
            const errJson = JSON.parse(rawText);
            if (errJson && errJson.error) {
              serverErrorMsg = errJson.error;
            }
          } catch {
            serverErrorMsg = 'Não foi possível processar a requisição no servidor.';
          }
        } catch {}
        throw new Error(serverErrorMsg);
      }

      const rawResponseText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(rawResponseText);
      } catch {
        throw new Error('A resposta recebida do servidor não é um JSON válido.');
      }
      if (data && data.steps && Array.isArray(data.steps)) {
        const referenceStepsIds = data.steps.map((s: any, idx: number) => ({
          id: `pdf-ref-${idx}-${Date.now()}`,
          n: s.n || idx + 1,
          l: s.l || 0,
          esp: s.esp || null,
          ap: s.ap !== undefined && s.ap !== null ? s.ap : null,
          apCorr: null,
          ac: s.ac !== undefined && s.ac !== null ? s.ac : null,
          acCorr: null,
          r: s.r || 1.25,
          comment: s.comment || '',
        }));

        const userStepsIds = data.steps.map((s: any, idx: number) => ({
          id: `pdf-user-${idx}-${Date.now()}`,
          n: s.n || idx + 1,
          l: s.l || 0,
          esp: s.esp || null,
          ap: s.ap !== undefined && s.ap !== null ? s.ap : null,
          apCorr: null,
          ac: s.ac !== undefined && s.ac !== null ? s.ac : null,
          acCorr: null,
          r: s.r || 1.25,
          comment: s.comment || '',
        }));

        const rotMode = (data.rotationMode as RotationMode) || rotationMode;
        const enforcedRefSteps = enforceTorsionAndCorteRules(referenceStepsIds, rotMode);
        const enforcedUserSteps = enforceTorsionAndCorteRules(userStepsIds, rotMode);

        setReferenceSteps(enforcedRefSteps);
        setSteps(enforcedUserSteps);
        setActiveModelName(data.name || attachedDrawing.fileName || 'Gabarito Extraído');
        if (data.wireDiameter) {
          setWireDiameter(data.wireDiameter);
        }
        if (data.rotationMode) {
          setRotationMode(data.rotationMode as RotationMode);
        }
        if (data.cameraDirection) {
          setCameraDirection(data.cameraDirection);
        } else {
          setCameraDirection(null);
        }

        setAnalysisReport({
          modelName: data.name || attachedDrawing.fileName,
          notes: data.analysisNotes || 'Análise executada extraindo as coordenadas e regras mecânicas do Desenho Técnico PDF.',
          warnings: data.warnings || [],
          isFallback: data.isFallback,
        });

        setPdfSuccess(`Análise concluída! Gabarito "${data.name || 'Haste'}" importado com ${enforcedUserSteps.length} passos de dobra.`);
        setAnimationProgress(1.0);
        setTimeout(() => {
          setCameraActionTrigger({ action: 'fit', ts: Date.now() });
        }, 100);
      } else {
        throw new Error('A análise não retornou a tabela de passos de dobra no formato esperado.');
      }
    } catch (err: any) {
      setPdfError(err?.message || 'Erro inesperado ao analisar o desenho PDF.');
    } finally {
      setIsAnalyzingPDF(false);
    }
  };

  // Animation Frame Ref for loop timing
  const lastTimeRef = useRef<number | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Save changes to LocalStorage and sync active model with libraryTemplates
  useEffect(() => {
    localStorage.setItem('wafios_steps', JSON.stringify(steps));
    localStorage.setItem('wafios_rotation_mode', rotationMode);
    localStorage.setItem('wafios_wire_diameter', wireDiameter.toString());
    localStorage.setItem('wafios_active_model_name', activeModelName);

    // Auto-update the active model inside libraryTemplates so modifications to a model overwrite it permanently
    if (activeModelName) {
      const activeKey = normalizeTemplateKey(activeModelName);
      setLibraryTemplates((prev) => {
        const existingIdx = prev.findIndex((t) => normalizeTemplateKey(t.name) === activeKey);
        if (existingIdx !== -1) {
          const currentTpl = prev[existingIdx];
          const isChanged =
            JSON.stringify(currentTpl.steps) !== JSON.stringify(steps) ||
            currentTpl.rotationMode !== rotationMode ||
            currentTpl.wireDiameter !== wireDiameter;
          if (isChanged) {
            const updated = [...prev];
            updated[existingIdx] = {
              ...currentTpl,
              rotationMode,
              wireDiameter,
              steps: steps.map((s) => ({ ...s })),
            };
            return updated;
          }
        } else {
          // If active model is new, add it to libraryTemplates
          const newTpl: PieceTemplate = {
            name: activeModelName,
            description: 'Gabarito salvo a partir do simulador',
            rotationMode,
            wireDiameter,
            steps: steps.map((s) => ({ ...s })),
          };
          return [...prev, newTpl];
        }
        return prev;
      });
    }
  }, [steps, rotationMode, wireDiameter, activeModelName]);

  // Save library changes to LocalStorage
  useEffect(() => {
    localStorage.setItem('wafios_library_templates', JSON.stringify(libraryTemplates));
  }, [libraryTemplates]);

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
    setIsFrozen(false);
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
    setIsFrozen(false);
    setAnimationProgress(1.0); // Complete program view ("finaliza o pgm completo")
    setSelectedStepIndex(null); // Return to default complete piece overview
    setCameraActionTrigger({ action: 'fit', ts: Date.now() }); // Frame the full finished shape ("volta na visão padrão")
  };

  const handleStepForward = () => {
    setIsAnimating(false);
    setIsFrozen(false);
    let nextIdx = 1;
    if (selectedStepIndex !== null) {
      nextIdx = Math.min(steps.length, selectedStepIndex + 1);
    }
    setSelectedStepIndex(nextIdx);
    setAnimationProgress(nextIdx / steps.length);
  };

  const handleStepBackward = () => {
    setIsAnimating(false);
    setIsFrozen(false);
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
    setActiveModelName(template.name);
    setReferenceSteps(template.steps);
    const userSteps = template.steps.map(s => ({
      ...s,
    }));
    setSteps(userSteps);
    setRotationMode(template.rotationMode);
    setWireDiameter(template.wireDiameter);
    if (template.cameraDirection) {
      setCameraDirection(template.cameraDirection);
    } else {
      setCameraDirection(null);
    }
    setAnimationProgress(1.0); // Load fully formed by default
    setIsAnimating(false);
    setSelectedStepIndex(null);
    // Auto-fit camera to preloaded templates after a short delay
    setTimeout(() => {
      setCameraActionTrigger({ action: 'fit', ts: Date.now() });
    }, 100);
  };

  // Save notification toast state
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);

  const handleQuickSaveActiveModel = () => {
    if (!activeModelName) return;
    const activeKey = normalizeTemplateKey(activeModelName);
    const existingIndex = libraryTemplates.findIndex(t => normalizeTemplateKey(t.name) === activeKey);

    const updatedTpl: PieceTemplate = {
      name: activeModelName,
      description: existingIndex !== -1 ? libraryTemplates[existingIndex].description : 'Gabarito salvo a partir do simulador',
      rotationMode,
      wireDiameter,
      steps: steps.map(s => ({ ...s })),
    };

    if (existingIndex !== -1) {
      const updated = [...libraryTemplates];
      updated[existingIndex] = updatedTpl;
      setLibraryTemplates(deduplicateTemplates(updated));
    } else {
      setLibraryTemplates(deduplicateTemplates([...libraryTemplates, updatedTpl]));
    }

    setSaveSuccessToast(`Modelo "${activeModelName}" salvo com sucesso! Edições mantidas permanentemente.`);
    setTimeout(() => {
      setSaveSuccessToast(null);
    }, 4500);
  };

  // Library of templates management helper functions
  const handleStartEditTemplate = (index: number, tpl: PieceTemplate) => {
    setEditingTemplateIndex(index);
    setEditingTemplateName(tpl.name);
    setEditingTemplateDesc(tpl.description || '');
  };

  const handleSaveEditTemplate = (index: number) => {
    const trimmedName = editingTemplateName.trim();
    if (!trimmedName) return;

    const targetKey = normalizeTemplateKey(trimmedName);
    const existingOtherIndex = libraryTemplates.findIndex((t, idx) => idx !== index && normalizeTemplateKey(t.name) === targetKey);

    if (existingOtherIndex !== -1) {
      const updated = [...libraryTemplates];
      updated[existingOtherIndex] = {
        ...updated[existingOtherIndex],
        name: trimmedName,
        description: editingTemplateDesc.trim() || updated[existingOtherIndex].description,
      };
      const finalTemplates = updated.filter((_, idx) => idx !== index);
      setLibraryTemplates(deduplicateTemplates(finalTemplates));
    } else {
      const updated = [...libraryTemplates];
      updated[index] = {
        ...updated[index],
        name: trimmedName,
        description: editingTemplateDesc.trim(),
      };
      setLibraryTemplates(deduplicateTemplates(updated));
    }
    setEditingTemplateIndex(null);
  };

  const handleDeleteTemplate = (index: number) => {
    const updated = libraryTemplates.filter((_, idx) => idx !== index);
    setLibraryTemplates(deduplicateTemplates(updated));
    setDeletingTemplateIndex(null);
  };

  const handleSaveCurrentToLibrary = () => {
    const trimmedName = newTemplateName.trim();
    if (!trimmedName) return;

    const targetKey = normalizeTemplateKey(trimmedName);
    const existingIndex = libraryTemplates.findIndex(t => normalizeTemplateKey(t.name) === targetKey);

    if (existingIndex !== -1) {
      const updated = [...libraryTemplates];
      updated[existingIndex] = {
        name: trimmedName,
        description: newTemplateDesc.trim() || updated[existingIndex].description || 'Gabarito salvo a partir do simulador',
        rotationMode,
        wireDiameter,
        steps: steps.map(s => ({ ...s })),
      };
      setLibraryTemplates(deduplicateTemplates(updated));
    } else {
      const newTpl: PieceTemplate = {
        name: trimmedName,
        description: newTemplateDesc.trim() || 'Gabarito salvo a partir do simulador',
        rotationMode,
        wireDiameter,
        steps: steps.map(s => ({ ...s })),
      };
      setLibraryTemplates(deduplicateTemplates([...libraryTemplates, newTpl]));
    }

    setActiveModelName(trimmedName);
    setShowSaveLibraryModal(false);
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

  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Trigger PDF Print via clean temporary window
  const handlePrint = () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    const element = document.getElementById('report-print-container');
    if (element) {
      // Criar uma nova janela/aba temporária para disparar a impressão fora do iframe sandbox
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        // Copiar os estilos originais da página (Tailwind e fontes)
        const styles = Array.from(document.querySelectorAll('style, link'))
          .map(style => style.outerHTML)
          .join('\n');

        // Gerar o documento completo
        printWindow.document.write(`
          <!DOCTYPE html>
          <html lang="pt-BR">
            <head>
              <meta charset="utf-8">
              <title>Ficha Técnica de Dobra - ${activeModelName || 'Gabarito'}</title>
              ${styles}
              <style>
                body {
                  background-color: white !important;
                  color: black !important;
                  padding: 20px !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                #report-print-container {
                  display: block !important;
                  position: static !important;
                  width: 100% !important;
                  max-width: 900px !important;
                  margin: 0 auto !important;
                  z-index: 1 !important;
                }
                /* Forçar exibição e cores de fundo */
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                @media print {
                  @page {
                    margin: 0.4in;
                    size: letter;
                  }
                  body {
                    padding: 0 !important;
                  }
                }
              </style>
            </head>
            <body>
              <div id="report-print-container">
                ${element.innerHTML}
              </div>
              <script>
                // Executar o diálogo de impressão imediatamente
                window.onload = function() {
                  setTimeout(function() {
                    window.print();
                    // Fecha a janela após a impressão/cancelamento
                    setTimeout(function() {
                      window.close();
                    }, 250);
                  }, 100);
                };
              <\/script>
            </body>
          </html>
        `);
        printWindow.document.close();
      } else {
        // Fallback se bloqueado pelo pop-up blocker
        window.print();
      }
    }
    
    setIsGeneratingPdf(false);
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
    setSteps(enforceTorsionAndCorteRules(updatedSteps, rotationMode));
  };

  const torsionErrors = getTorsionValidationErrors(steps, rotationMode);

  return (
    <div className="min-h-screen bg-[#0F1115] text-[#E2E8F0] font-sans flex flex-col" id="app-container">
      <div className="print:hidden flex flex-col min-h-screen w-full">
      
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
            {activeModelName && (
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-blue-400 font-mono font-bold" id="active-model-display">
                  <span className="text-[#718096] font-sans font-normal">Gabarito Ativo:</span> {activeModelName}
                </p>
                <button
                  onClick={handleQuickSaveActiveModel}
                  className="bg-emerald-600/90 hover:bg-emerald-500 active:scale-95 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer shadow border border-emerald-400/40"
                  title="Salvar alterações no modelo atual (Sobrescrever e nunca mais perder)"
                  id="btn-quick-save-model"
                >
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Salvar no Modelo</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Floating Toast Notification */}
        {saveSuccessToast && (
          <div className="fixed top-20 right-6 z-50 bg-emerald-950/95 border border-emerald-500 text-emerald-100 text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 animate-bounce">
            <span className="text-base">✅</span>
            <span>{saveSuccessToast}</span>
          </div>
        )}

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


          {/* Biblioteca de Gabaritos & Salvar */}
          <div className="flex items-center gap-2 bg-[#121418] p-1 rounded-xl border border-[#2D3748]">
            <button
              onClick={() => {
                setLibrarySearch('');
                setShowLibraryModal(true);
              }}
              className="bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-sm border border-blue-500/30"
              title="Abrir a Biblioteca de Gabaritos para escolher, editar ou deletar programas"
              id="btn-open-library"
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
              </svg>
              <span>Biblioteca de Gabaritos</span>
            </button>

            <button
              onClick={() => {
                setNewTemplateName(activeModelName || 'Novo Gabarito');
                setNewTemplateDesc('Gabarito salvo a partir do simulador');
                setShowSaveLibraryModal(true);
              }}
              className="bg-[#2D3748] hover:bg-[#4A5568] text-white text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-sm border border-[#4A5568]/60"
              title="Salvar o programa de dobra atual na sua biblioteca de gabaritos"
              id="btn-save-to-library"
            >
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              <span>Salvar na Biblioteca</span>
            </button>
          </div>

          {/* PDF Drawing Attachment Input & Status Badge */}
          <div className="flex items-center gap-1.5">
            <input
              type="file"
              accept="application/pdf,image/*,.step,.stp,.dxf,.dwg,.gltf,.glb,.stl,.igs,.eprt,.x_t"
              onChange={handleDrawingFileSelect}
              className="hidden"
              ref={drawingInputRef}
              id="pdf-upload-input"
              disabled={isAnalyzingPDF}
            />
            {attachedDrawing ? (
              <div className="bg-indigo-950/80 border border-indigo-500/50 text-indigo-200 text-xs py-1 px-2.5 rounded-lg flex items-center gap-1.5 shadow-sm">
                <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate max-w-[110px]" title={attachedDrawing.fileName}>
                  {attachedDrawing.fileName}
                </span>
                <button
                  onClick={handleRemoveDrawing}
                  className="text-indigo-400 hover:text-red-400 ml-0.5 p-0.5 rounded cursor-pointer transition-colors"
                  title="Remover desenho anexado"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label
                htmlFor="pdf-upload-input"
                className={`bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1.5 shadow-[0_0_12px_rgba(79,70,229,0.2)] active:scale-95 transition-all cursor-pointer border border-indigo-400/40 ${isAnalyzingPDF ? 'opacity-70 cursor-not-allowed' : ''}`}
                title="Anexar arquivo PDF ou Imagem do Desenho Técnico com as cotas"
              >
                <FileUp className="w-3.5 h-3.5 text-indigo-200" />
                <span>Anexar Desenho PDF</span>
              </label>
            )}
          </div>

          {/* Discreet Torsion Warning Quadrinho (Top Upper Bar) */}
          {torsionErrors.length > 0 && (
            <div 
              className="bg-red-950/90 border border-red-500/80 text-red-200 text-xs font-bold px-3 py-1.5 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.4)] flex items-center gap-2 animate-pulse font-sans shrink-0 cursor-pointer"
              title="Corrija a torção acumulada (AP) na tabela para não exceder os ±200° do Eixo A. Clique ou corrija no passo indicado."
              id="torsion-error-discreet-quadrinho-header"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
              <span className="font-mono text-red-200 text-[11px]">⚠️ CORRIGIR TORÇÃO (EIXO A &gt; ±200°)</span>
            </div>
          )}



          {/* PROMINENT ANALISAR BUTTON */}
          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzingPDF}
            className={`bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-xs py-1.5 px-3.5 rounded-lg flex items-center gap-1.5 shadow-[0_0_18px_rgba(124,58,237,0.45)] active:scale-95 transition-all cursor-pointer border border-purple-300/40 ring-2 ring-purple-500/20 ${
              isAnalyzingPDF ? 'opacity-75 cursor-not-allowed animate-pulse' : ''
            }`}
            id="btn-analyze-multimodal"
            title="Analisar Desenho PDF e Modelo STEP 3D com Inteligência Artificial Gemini"
          >
            {isAnalyzingPDF ? (
              <RefreshCw className="w-3.5 h-3.5 text-white animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            )}
            <span>{isAnalyzingPDF ? 'ANALISANDO IA...' : 'ANALISAR'}</span>
          </button>

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

          {/* IMPRIMIR Button */}
          <button
            onClick={handlePrint}
            disabled={isGeneratingPdf}
            className={`bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-md border border-amber-500/30 ${isGeneratingPdf ? 'opacity-75 cursor-not-allowed' : ''}`}
            id="btn-print-report"
            title="Imprimir ficha técnica de dobra e salvar em PDF"
          >
            {isGeneratingPdf ? (
              <svg className="animate-spin w-3.5 h-3.5 text-amber-100" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-amber-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            )}
            <span>{isGeneratingPdf ? 'GERANDO PDF...' : 'IMPRIMIR'}</span>
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
              <div className={`flex-1 bg-[#090B0E] relative ${showComparison ? 'flex flex-row' : ''}`} id="maximized-three-viewport">
                {showComparison && (
                  <div className="flex-1 border-r border-[#2D3748] relative">
                    <div className="absolute top-2 left-2 z-10 bg-black/60 px-2 py-1 rounded text-xs font-semibold text-purple-400 backdrop-blur-sm pointer-events-none border border-purple-500/30">
                      Modelo Referência (PDF)
                    </div>
                    <ThreeVisualizer
                      steps={referenceSteps}
                      rotationMode={rotationMode}
                      wireDiameter={wireDiameter}
                      hoveredStepIndex={hoveredStepIndex}
                      selectedStepIndex={selectedStepIndex}
                      onSelectStep={() => {}}
                      animationProgress={animationProgress}
                      isAnimating={isAnimating}
                      cameraActionTrigger={cameraActionTrigger}
                      alignmentMode={alignmentMode}
                      cameraDirection={cameraDirection}
                      activeModelName={`${activeModelName} (Desenho PDF)`}
                    />
                  </div>
                )}
                <div className={`relative ${showComparison ? 'flex-1' : 'w-full h-full'}`}>
                  {showComparison && (
                    <div className="absolute top-2 left-2 z-10 bg-black/60 px-2 py-1 rounded text-xs font-semibold text-blue-400 backdrop-blur-sm pointer-events-none border border-blue-500/30">
                      Seu Programa (Simulador)
                    </div>
                  )}
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
                    cameraDirection={cameraDirection}
                    activeModelName={activeModelName}
                    isFrozen={isFrozen}
                    setIsFrozen={setIsFrozen}
                    onStepsChange={setSteps}
                  />
                </div>
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
        <main className="w-full max-w-[1920px] mx-auto p-4 lg:p-6 flex flex-col lg:flex-row gap-4 flex-1 overflow-auto" id="dashboard-main">
          
          {/* PDF Analysis Error or Success Popups */}
          {(pdfError || pdfSuccess) && (
            <div className="w-full font-sans mb-2">
              {pdfError && (
                <div className="bg-rose-950/30 border border-rose-900/50 text-rose-200 p-4 rounded-2xl flex items-start gap-3 relative shadow-xl backdrop-blur-md">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-xs pr-8">
                    <p className="font-bold text-rose-100">Erro na Análise do Desenho</p>
                    <p className="text-rose-300 mt-0.5 whitespace-pre-line">{pdfError}</p>
                  </div>
                  <button
                    onClick={() => setPdfError(null)}
                    className="absolute top-4 right-4 text-rose-400 hover:text-rose-200 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}
              {pdfSuccess && (
                <div className="bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 p-4 rounded-2xl flex items-start gap-3 relative shadow-xl backdrop-blur-md mb-3">
                  <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs pr-8 space-y-1">
                    <p className="font-bold text-emerald-100 flex items-center gap-2">
                      <span>Análise do Desenho PDF Concluída com Sucesso!</span>
                    </p>
                    <p className="text-emerald-300">{pdfSuccess}</p>
                  </div>
                  <button
                    onClick={() => setPdfSuccess(null)}
                    className="absolute top-4 right-4 text-emerald-400 hover:text-emerald-200 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Left Column - The Coordinates table and config */}
          <section 
            className="w-full flex flex-col gap-6 h-full shrink-0 min-w-[320px]" 
            style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${leftPanelRatio}%` : '100%' }}
            id="dashboard-left-panel"
          >
          
          {/* Compact Quick Tip & Discrete Layout Resize Bar (FOTO 2 REQUIREMENT) */}
          <div className="bg-[#121418] border border-[#2D3748] rounded-xl px-4 py-2 flex flex-wrap items-center justify-between text-[11px] text-[#A0AEC0] shadow-sm gap-2" id="compact-quick-tip">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Simulador operando em modo de <b>Orientação Absoluta</b>. Selecione qualquer linha para focar no 3D.</span>
            </div>

            {/* Discrete Layout Controls (FOTO 2 REQUIREMENT) */}
            <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono">
              {/* Width Pill Controls */}
              <div className="flex items-center gap-0.5 bg-[#171923] p-1 rounded-lg border border-[#2D3748]">
                <span className="text-slate-500 font-bold px-1 text-[9px] uppercase">Largura:</span>
                <button 
                  onClick={() => setLeftPanelRatio(65)} 
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${leftPanelRatio > 55 ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  title="Expandir largura da tabela (65%)"
                  id="btn-width-table"
                >
                  + Tabela
                </button>
                <button 
                  onClick={() => setLeftPanelRatio(50)} 
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${leftPanelRatio === 50 ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  title="Dividir 50/50"
                  id="btn-width-50"
                >
                  50/50
                </button>
                <button 
                  onClick={() => setLeftPanelRatio(35)} 
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${leftPanelRatio < 45 ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  title="Expandir largura do 3D (65%)"
                  id="btn-width-3d"
                >
                  + 3D
                </button>
              </div>

              {/* Height Pill Controls */}
              <div className="flex items-center gap-0.5 bg-[#171923] p-1 rounded-lg border border-[#2D3748]">
                <span className="text-slate-500 font-bold px-1 text-[9px] uppercase">Altura:</span>
                <button 
                  onClick={() => { setPanelHeight(650); localStorage.setItem('wafios_panel_height', '650'); }} 
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${panelHeight === 650 ? 'bg-amber-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  title="Altura Normal (650px)"
                  id="btn-height-650"
                >
                  650px
                </button>
                <button 
                  onClick={() => { setPanelHeight(850); localStorage.setItem('wafios_panel_height', '850'); }} 
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${panelHeight === 850 ? 'bg-amber-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  title="Altura Expandida (850px)"
                  id="btn-height-850"
                >
                  850px
                </button>
                <button 
                  onClick={() => { setPanelHeight(1050); localStorage.setItem('wafios_panel_height', '1050'); }} 
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${panelHeight === 1050 ? 'bg-amber-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  title="Altura Máxima (1050px)"
                  id="btn-height-1050"
                >
                  1050px
                </button>
              </div>
            </div>
          </div>

          {/* Program Table component container */}
          <div 
            className="bg-[#121418] border border-[#2D3748] rounded-2xl p-5 shadow-md flex-1 flex flex-col relative" 
            style={{ height: `${panelHeight}px` }}
            id="table-card"
          >
            <ProgramTable
              steps={steps}
              onStepsChange={(newSteps) => setSteps(enforceTorsionAndCorteRules(newSteps, rotationMode))}
              hoveredStepIndex={hoveredStepIndex}
              onHoverStep={setHoveredStepIndex}
              selectedStepIndex={selectedStepIndex}
              onSelectStep={handleSelectStep}
              wireDiameter={wireDiameter}
              rotationMode={rotationMode}
            />

            {/* Bottom Draggable Height Resizer Handle for Table */}
            <div
              onPointerDown={handleHeightResizePointerDown}
              onPointerMove={handleHeightResizePointerMove}
              onPointerUp={handleHeightResizePointerUp}
              className="w-full h-5 bg-[#171923] border-t border-[#2D3748] hover:bg-blue-600/30 cursor-row-resize flex items-center justify-center group select-none touch-none shrink-0 transition-colors mt-auto -mx-5 -mb-5 rounded-b-2xl"
              title="Clique e arraste para BAIXO ou PARA CIMA para alterar a altura da janela (aproveitar espaço)"
              id="table-height-handle"
            >
              <div className="w-16 h-1.5 bg-slate-500 group-hover:bg-blue-400 group-active:bg-blue-300 rounded-full transition-colors flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
              </div>
            </div>
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

        {/* Draggable Vertical Splitter Handle */}
        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          className="hidden lg:flex w-3 hover:w-4 items-center justify-center cursor-col-resize group shrink-0 relative z-30 transition-all select-none touch-none py-4"
          title="Clique e arraste para redimensionar a Tabela e o Visualizador 3D"
          id="panel-resizer-handle"
        >
          <div className="w-1.5 h-full bg-[#2D3748] group-hover:bg-blue-500 group-active:bg-blue-400 rounded-full transition-colors flex flex-col items-center justify-center gap-2 shadow-md">
            <div className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-white" />
            <div className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-white" />
            <div className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-white" />
          </div>
        </div>

        {/* Right Column - 3D Viewer viewport and animation simulator */}
        <section 
          className="w-full flex flex-col gap-6 flex-1 min-w-[320px]" 
          id="dashboard-right-panel"
        >
          
          {/* 3D Graphics Canvas Box */}
          <div 
            className="bg-[#090B0E] border border-[#2D3748] rounded-2xl overflow-hidden shadow-md flex flex-col sticky top-6 relative" 
            style={{ height: `${panelHeight}px` }}
            id="visualizer-card"
          >
            {/* 3D header */}
            <div className="bg-[#121418] border-b border-[#2D3748] px-4 py-3 flex items-center justify-between" id="visualizer-header">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[#E2E8F0] tracking-wider font-mono uppercase flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                  Gráfico 3D Interativo
                </span>

                {/* Discreet Red Warning Quadrinho (Top of 3D Graph) */}
                {torsionErrors.length > 0 && (
                  <div 
                    className="bg-red-950/90 border border-red-500/80 text-red-200 text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-[0_0_12px_rgba(239,68,68,0.35)] flex items-center gap-1.5 animate-pulse font-sans"
                    title="Torção acumulada no Eixo A excedeu ±200°. Corrija o valor de AP na tabela."
                    id="torsion-error-discreet-quadrinho-3d"
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block shrink-0" />
                    <span className="font-mono text-red-200 uppercase">⚠️ CORRIGIR TORÇÃO (&gt; ±200°)</span>
                  </div>
                )}
              </div>
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
            <div className={`flex-1 bg-[#090B0E] relative ${showComparison ? 'flex flex-col' : ''}`} id="three-viewer-viewport">
              {showComparison && (
                <div className="flex-1 border-b border-[#2D3748] relative">
                  <div className="absolute top-2 left-2 z-10 bg-black/60 px-2 py-1 rounded text-xs font-semibold text-purple-400 backdrop-blur-sm pointer-events-none border border-purple-500/30">
                    Modelo Referência (PDF)
                  </div>
                  <ThreeVisualizer
                    steps={referenceSteps}
                    rotationMode={rotationMode}
                    wireDiameter={wireDiameter}
                    hoveredStepIndex={hoveredStepIndex}
                    selectedStepIndex={selectedStepIndex}
                    onSelectStep={() => {}}
                    animationProgress={animationProgress}
                    isAnimating={isAnimating}
                    cameraActionTrigger={cameraActionTrigger}
                    alignmentMode={alignmentMode}
                    cameraDirection={cameraDirection}
                    activeModelName={`${activeModelName} (Desenho PDF)`}
                  />
                </div>
              )}
              <div className={`relative ${showComparison ? 'flex-1' : 'w-full h-full'}`}>
                {showComparison && (
                  <div className="absolute top-2 left-2 z-10 bg-black/60 px-2 py-1 rounded text-xs font-semibold text-blue-400 backdrop-blur-sm pointer-events-none border border-blue-500/30">
                    Seu Programa (Simulador)
                  </div>
                )}
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
                  cameraDirection={cameraDirection}
                  activeModelName={activeModelName}
                  isFrozen={isFrozen}
                  setIsFrozen={setIsFrozen}
                  onStepsChange={setSteps}
                />
              </div>
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

            {/* Bottom Draggable Height Resizer Handle for 3D Visualizer */}
            <div
              onPointerDown={handleHeightResizePointerDown}
              onPointerMove={handleHeightResizePointerMove}
              onPointerUp={handleHeightResizePointerUp}
              className="w-full h-5 bg-[#171923] border-t border-[#2D3748] hover:bg-blue-600/30 cursor-row-resize flex items-center justify-center group select-none touch-none shrink-0 transition-colors"
              title="Clique e arraste para BAIXO ou PARA CIMA para alterar a altura da janela (aproveitar espaço)"
              id="visualizer-height-handle"
            >
              <div className="w-16 h-1.5 bg-slate-500 group-hover:bg-blue-400 group-active:bg-blue-300 rounded-full transition-colors flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
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
          </div>
        </div>
      )}

      {/* Biblioteca de Gabaritos Modal */}
      {showLibraryModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-scale" id="modal-library-container">
          <div className="bg-[#121418] border border-[#2D3748] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col my-8" id="modal-library-card">
            
            {/* Modal Header */}
            <div className="bg-[#171923] border-b border-[#2D3748] px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-[#E2E8F0] text-sm md:text-base font-sans flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>Biblioteca de Gabaritos ({libraryTemplates.length})</span>
              </h3>
              <button
                onClick={() => {
                  setEditingTemplateIndex(null);
                  setDeletingTemplateIndex(null);
                  setShowLibraryModal(false);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#2D3748] transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-1 flex flex-col gap-4 max-h-[60vh] overflow-y-auto" id="modal-library-body">
              {/* Search Bar */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Pesquisar gabaritos por nome..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="w-full bg-[#0F1115] text-slate-200 pl-10 pr-4 py-2 rounded-xl border border-[#2D3748] text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                />
              </div>

              {/* Templates List */}
              <div className="space-y-3 mt-2">
                {libraryTemplates.filter(t => t.name.toLowerCase().includes(librarySearch.toLowerCase())).length === 0 ? (
                  <div className="text-center py-8 bg-[#0F1115] border border-dashed border-[#2D3748] rounded-2xl text-slate-400 text-xs font-sans">
                    Nenhum gabarito encontrado para a busca.
                  </div>
                ) : (
                  libraryTemplates
                    .map((tpl, index) => {
                      // Filter verification
                      if (librarySearch && !tpl.name.toLowerCase().includes(librarySearch.toLowerCase())) {
                        return null;
                      }

                      const isEditing = editingTemplateIndex === index;
                      const bendsCount = tpl.steps.filter((s) => s.ac !== null && s.ac !== 0).length;

                      return (
                        <div
                          key={`lib-item-${index}`}
                          className="bg-[#1A202C]/60 hover:bg-[#1A202C] border border-[#2D3748]/70 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                        >
                          {isEditing ? (
                            <div className="flex-1 space-y-2">
                              <div>
                                <label className="block text-[10px] text-slate-400 uppercase font-mono font-bold mb-1">Nome do Gabarito</label>
                                <input
                                  type="text"
                                  value={editingTemplateName}
                                  onChange={(e) => setEditingTemplateName(e.target.value)}
                                  className="w-full bg-[#0F1115] text-white text-xs p-2 rounded-lg border border-blue-500/50 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 uppercase font-mono font-bold mb-1">Descrição</label>
                                <input
                                  type="text"
                                  value={editingTemplateDesc}
                                  onChange={(e) => setEditingTemplateDesc(e.target.value)}
                                  className="w-full bg-[#0F1115] text-white text-xs p-2 rounded-lg border border-[#2D3748] focus:outline-none"
                                />
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => handleSaveEditTemplate(index)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold py-1 px-3 rounded-md transition-colors cursor-pointer"
                                >
                                  Salvar
                                </button>
                                <button
                                  onClick={() => setEditingTemplateIndex(null)}
                                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-bold py-1 px-3 rounded-md transition-colors cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 space-y-1">
                              <h4 className="text-xs font-bold text-slate-100 font-mono flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                {tpl.name}
                              </h4>
                              <p className="text-[11px] text-slate-400 leading-normal font-sans">
                                {tpl.description || 'Sem descrição.'}
                              </p>
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                <span className="text-[9px] bg-slate-800 text-slate-300 font-mono py-0.5 px-1.5 rounded">
                                  {tpl.steps.length} segmentos ({bendsCount} dobras)
                                </span>
                                <span className="text-[9px] bg-blue-950/40 text-blue-300 border border-blue-900/30 font-mono py-0.5 px-1.5 rounded">
                                  Fio: Ø {tpl.wireDiameter.toFixed(1)}mm
                                </span>
                                <span className="text-[9px] bg-amber-950/40 text-amber-300 border border-amber-900/30 font-mono py-0.5 px-1.5 rounded uppercase">
                                  AP: {tpl.rotationMode === 'relative' ? 'Relativo' : 'Absoluto'}
                                </span>
                              </div>
                            </div>
                          )}

                          {!isEditing && (
                            <div className="flex flex-wrap items-center gap-2 md:self-center">
                              <button
                                onClick={() => {
                                  loadTemplate(tpl);
                                  setShowLibraryModal(false);
                                }}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg active:scale-95 transition-all cursor-pointer shadow-sm"
                                title="Carregar no simulador"
                              >
                                Carregar
                              </button>
                              <button
                                onClick={() => handleStartEditTemplate(index, tpl)}
                                className="bg-[#2D3748] hover:bg-[#4A5568] text-slate-200 text-xs font-semibold py-1.5 px-2.5 rounded-lg active:scale-95 transition-all cursor-pointer"
                                title="Editar nome e descrição"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeleteTemplate(index)}
                                className="bg-[#5c1d24] hover:bg-red-600 text-red-100 hover:text-white border border-red-900/30 hover:border-red-500 text-xs font-semibold py-1.5 px-2.5 rounded-lg active:scale-95 transition-all cursor-pointer"
                                title="Excluir da biblioteca"
                              >
                                Deletar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#171923] border-t border-[#2D3748] px-6 py-4 flex justify-between items-center">
              <button
                onClick={() => {
                  const updated = [...libraryTemplates];
                  TEMPLATES.forEach(tpl => {
                    if (!updated.some(t => t.name.toLowerCase() === tpl.name.toLowerCase())) {
                      updated.push(tpl);
                    }
                  });
                  setLibraryTemplates(updated);
                }}
                className="text-amber-400 hover:text-amber-300 text-xs font-semibold flex items-center gap-1.5 bg-[#2D3748]/30 hover:bg-[#2D3748]/60 py-1.5 px-3 rounded-lg border border-amber-900/20 cursor-pointer transition-colors"
                title="Restaurar os gabaritos de fábrica da Wafios"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 6H16" />
                </svg>
                Restaurar Padrões Wafios
              </button>
              
              <button
                onClick={() => {
                  setEditingTemplateIndex(null);
                  setDeletingTemplateIndex(null);
                  setShowLibraryModal(false);
                }}
                className="bg-[#2D3748] hover:bg-[#4A5568] border border-[#4A5568] text-slate-200 text-xs font-semibold py-2 px-5 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Salvar na Biblioteca Modal */}
      {showSaveLibraryModal && (() => {
        const existingMatch = newTemplateName.trim()
          ? libraryTemplates.find(t => normalizeTemplateKey(t.name) === normalizeTemplateKey(newTemplateName))
          : null;

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-scale" id="modal-save-library">
            <div className="bg-[#121418] border border-[#2D3748] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col" id="modal-save-card">
              
              {/* Modal Header */}
              <div className="bg-[#171923] border-b border-[#2D3748] px-5 py-4 flex justify-between items-center">
                <h3 className="font-bold text-[#E2E8F0] text-sm font-sans flex items-center gap-1.5">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Salvar Programa na Biblioteca
                </h3>
                <button
                  onClick={() => setShowSaveLibraryModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#2D3748] transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 flex flex-col gap-4" id="modal-save-body">
                <p className="text-xs text-slate-400 leading-normal font-sans">
                  Grave o programa de coordenadas atual na sua biblioteca de gabaritos persistente para carregá-lo, editá-lo ou exportá-lo quando quiser.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-mono font-bold mb-1">Nome do Gabarito / Modelo</label>
                    <input
                      type="text"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="Ex: Haste Boia 23323 Custom"
                      className="w-full bg-[#0F1115] text-white text-xs p-2.5 rounded-lg border border-[#2D3748] focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-mono font-bold mb-1">Descrição Breve (Opcional)</label>
                    <textarea
                      value={newTemplateDesc}
                      onChange={(e) => setNewTemplateDesc(e.target.value)}
                      placeholder="Ex: Haste esticada com raio de dobra de 1.5mm"
                      className="w-full h-20 bg-[#0F1115] text-white text-xs p-2.5 rounded-lg border border-[#2D3748] focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
                    />
                  </div>
                </div>

                {existingMatch && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5 text-amber-300 text-xs font-sans animate-scale">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-200">Atenção: Gabarito existente detectado</p>
                      <p className="text-[11px] text-amber-300/90 mt-0.5">
                        Já existe o gabarito <strong>"{existingMatch.name}"</strong> na biblioteca. Ao salvar, ele será <strong>SOBRESCRITO</strong> com as novas coordenadas.
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-[#1A202C]/40 p-3 rounded-lg border border-[#2D3748]/40 space-y-1 text-[11px] font-sans text-slate-400">
                  <div className="flex justify-between">
                    <span>Passos de dobra:</span>
                    <span className="font-mono font-bold text-slate-200">{steps.length} passes</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Diâmetro do fio (Ø):</span>
                    <span className="font-mono font-bold text-slate-200">{wireDiameter.toFixed(1)}mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Orientação AP:</span>
                    <span className="font-mono font-bold text-slate-200 uppercase">{rotationMode === 'relative' ? 'Relativa' : 'Absoluta'}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-[#171923] border-t border-[#2D3748] px-5 py-3.5 flex justify-end gap-2 items-center">
                <button
                  onClick={() => setShowSaveLibraryModal(false)}
                  className="bg-[#2D3748] hover:bg-[#4A5568] border border-[#4A5568] text-slate-200 text-xs font-semibold py-2 px-4 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveCurrentToLibrary}
                  className={
                    existingMatch
                      ? "bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold py-2 px-4 rounded-xl transition-all shadow-md cursor-pointer"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 px-4 rounded-xl transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
                  }
                >
                  {existingMatch ? "Sobrescrever Gabarito Existente" : "Confirmar e Gravar"}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Multimodal Analysis Result Dialog (FOTO 3 REQUIREMENT) */}
      {analysisReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-scale" id="modal-analysis-report">
          <div className="bg-[#121418] border border-purple-500/40 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-900 border-b border-purple-500/30 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-600/30 border border-purple-400/40 text-purple-300">
                  <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-sans">
                    Resultado da Análise IA Gemini
                  </h3>
                  <p className="text-[11px] text-purple-300 font-mono">
                    {analysisReport.modelName || 'Gabarito Extraído'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAnalysisReport(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Fechar Relatório"
                id="btn-close-analysis-report-x"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs text-slate-300 max-h-[60vh] overflow-y-auto">
              {analysisReport.isFallback && (
                <div className="p-3 bg-amber-950/40 border border-amber-800/50 rounded-xl text-amber-200 text-[11px]">
                  <b>Modo Contingência:</b> Análise offline processada com o modelo gabarito de fábrica.
                </div>
              )}

              <div className="bg-[#171923] p-4 rounded-xl border border-[#2D3748] space-y-2">
                <h4 className="font-bold text-slate-200 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Cotas e Dobras Extraídas
                </h4>
                <p className="text-slate-300 leading-relaxed font-sans">
                  {analysisReport.notes || 'Foram extraídas todas as coordenadas, giros de torção (AP) e ângulos de dobra (AC).'}
                </p>
              </div>

              {analysisReport.warnings && analysisReport.warnings.length > 0 && (
                <div className="bg-amber-950/20 p-4 rounded-xl border border-amber-900/30 space-y-2">
                  <h4 className="font-bold text-amber-300 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Observações Geométricas CNC ({analysisReport.warnings.length})
                  </h4>
                  <ul className="list-disc pl-4 space-y-1 text-amber-200 font-mono text-[11px]">
                    {analysisReport.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-[#0F1115] p-3 rounded-xl border border-[#2D3748] font-mono text-[11px] text-slate-400 flex justify-between items-center">
                <span>Passos Importados na Tabela:</span>
                <b className="text-emerald-400 text-xs">{steps.length} segmentos</b>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-[#171923] border-t border-[#2D3748] px-6 py-3.5 flex justify-end">
              <button
                onClick={() => setAnalysisReport(null)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2 px-5 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
                id="btn-close-analysis-report"
              >
                Entendi / Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* Global CSS animation injections for micro transitions */}
      <style>{`
        @keyframes scaleIn {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale {
          animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          /* Ensure headers and footers repeat correctly and background colors are printed */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Printable Technical Report (Rendered off-screen so html2pdf.js can capture it without showing on screen) */}
      <div 
        className="bg-white text-black p-8 font-sans print:block" 
        id="report-print-container"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          width: '900px',
          zIndex: -1000
        }}
      >
        {/* Report Header */}
        <div className="border-b-2 border-slate-950 pb-4 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">WAFIOS CNC - FICHA TÉCNICA DE PRODUÇÃO</h1>
            <p className="text-[11px] text-slate-500 mt-1 uppercase font-mono tracking-wider">Simulador de Dobra Realista 3D</p>
          </div>
          <div className="text-right text-[11px] font-mono text-slate-600">
            <div>DATA: {new Date().toLocaleDateString('pt-BR')}</div>
            <div>HORA: {new Date().toLocaleTimeString('pt-BR')}</div>
          </div>
        </div>

        {/* General Info & Analytics Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="border border-slate-300 rounded-xl p-5 bg-slate-50/50">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 border-b border-slate-200 pb-1">Identificação do Gabarito</h2>
            <div className="space-y-2 text-sm">
              <div><span className="font-semibold text-slate-700">Modelo / Nome:</span> <span className="font-mono font-bold text-slate-900 text-sm">{activeModelName || 'Novo Gabarito'}</span></div>
              <div><span className="font-semibold text-slate-700">Diâmetro do Fio (Ø):</span> <span className="font-mono font-bold text-slate-900 text-sm">{wireDiameter.toFixed(1)} mm</span></div>
              <div><span className="font-semibold text-slate-700">Modo de Orientação (AP):</span> <span className="font-mono font-bold uppercase text-slate-900 text-sm">{rotationMode === 'relative' ? 'Relativa (Incremental)' : 'Absoluta'}</span></div>
            </div>
          </div>

          <div className="border border-slate-300 rounded-xl p-5 bg-slate-50/50">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 border-b border-slate-200 pb-1">Análise de Produção Estimada</h2>
            <div className="grid grid-cols-2 gap-3.5 text-xs">
              <div>
                <span className="text-slate-500 block uppercase font-mono text-[9px] tracking-wider">Fio Necessário</span>
                <span className="font-mono font-black text-slate-900 text-[13px] block">{totalLength.toFixed(1)} mm</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">({(totalLength / 1000).toFixed(3)} metros)</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-mono text-[9px] tracking-wider">Peso da Peça</span>
                <span className="font-mono font-black text-slate-900 text-[13px] block">{pieceWeightGrams.toFixed(2)} g</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">(Aço Inox, 7.85g/cm³)</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-mono text-[9px] tracking-wider">Dobras (Pino)</span>
                <span className="font-mono font-black text-slate-900 text-[13px] block">{totalBends} dobras</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">({steps.length} seg. totais)</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-mono text-[9px] tracking-wider">Tempo de Ciclo (Est.)</span>
                <span className="font-mono font-black text-emerald-800 text-[13px] block">{estimatedCycleTimeSec.toFixed(1)} seg.</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">(~{Math.round(3600 / estimatedCycleTimeSec)} pç/hora)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Coordinates Table */}
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 border-b border-slate-200 pb-1">Tabela de Coordenadas de Dobra (Lista de Passos)</h2>
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-900 text-xs uppercase font-mono border-y border-slate-300">
                <th className="py-2.5 px-3 border border-slate-300 text-center font-black">Nº</th>
                <th className="py-2.5 px-3 border border-slate-300 font-black">TIPO</th>
                <th className="py-2.5 px-3 border border-slate-300 text-right font-black">AVANÇO (L)</th>
                <th className="py-2.5 px-3 border border-slate-300 text-right font-black">TORÇÃO (AP)</th>
                <th className="py-2.5 px-3 border border-slate-300 text-right font-black">DOBRA (AC)</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center font-black">RAIO (R)</th>
                <th className="py-2.5 px-3 border border-slate-300 font-black">DESENHO*</th>
                <th className="py-2.5 px-3 border border-slate-300 font-black">COMENTÁRIOS</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step, idx) => {
                return (
                  <tr key={step.id || idx} className={idx % 2 === 0 ? 'bg-slate-50/70 text-slate-900' : 'bg-white text-slate-900'}>
                    <td className="py-2.5 px-3 border border-slate-200 text-center font-mono font-bold">{step.n}</td>
                    <td className="py-2.5 px-3 border border-slate-200 font-black text-sm">
                      {step.ac !== null && step.ac !== 0 ? (
                        step.ac > 0 ? (
                          <span className="text-red-800 font-black">Dir</span>
                        ) : (
                          <span className="text-blue-900 font-black">Esq</span>
                        )
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 border border-slate-200 text-right font-mono font-bold">{step.l !== null ? `${step.l.toFixed(2)} mm` : '-'}</td>
                    <td className="py-2.5 px-3 border border-slate-200 text-right font-mono font-semibold">
                      {step.ap !== null ? `${step.ap.toFixed(1)}°` : '-'}
                    </td>
                    <td className="py-2.5 px-3 border border-slate-200 text-right font-mono font-semibold">
                      {step.ac !== null ? `${step.ac.toFixed(1)}°` : '-'}
                    </td>
                    <td className="py-2.5 px-3 border border-slate-200 text-center font-mono">{step.r !== null ? step.r.toFixed(2) : '1.5'}</td>
                    <td className="py-2.5 px-3 border border-slate-200 font-mono font-black text-blue-900 text-sm">
                      {step.ac !== null && step.ac !== 0 ? `${(180 - Math.abs(step.ac)).toFixed(1)}°` : '-'}
                    </td>
                    <td className="py-2.5 px-3 border border-slate-200 italic text-slate-600 text-xs">{step.comment || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[10px] text-slate-400 mt-2.5 font-sans italic">* Nota: O ângulo de DESENHO representa o ângulo interno residual formado pela dobra (180° - |AC|).</p>
        </div>

        {/* Footer details */}
        <div className="border-t border-slate-300 pt-4 mt-8 text-center text-[10px] text-slate-400">
          <p>Ficha gerada por Wafios CNC Real-Time Simulator. Todos os dados são calculados dinamicamente.</p>
          <p className="mt-0.5">© 2026 Wafios CNC. Sistema de Manufatura de Hastes Metálicas de Precisão.</p>
        </div>
      </div>

    </div>
  );
}
