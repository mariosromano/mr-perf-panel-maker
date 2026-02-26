export interface PanelHole {
  x: number;
  y: number;
  d: number;
}

export interface Panel {
  x: number;
  y: number;
  w: number;
  h: number;
  col: number;
  row: number;
  label: string;
  sizeLabel: string;
  holes: PanelHole[];
}

export interface LayoutOption {
  w: AxisSolution;
  h: AxisSolution;
  totalCoverage: number;
  totalPanels: number;
  desc: string;
}

export interface AxisSolution {
  counts: Record<number, number>;
  total: number;
  coverage: number;
  numPanels: number;
}

export interface PanelState {
  // Image
  sourceImage: HTMLImageElement | null;
  grayPixels: Float32Array | null;
  imgWidth: number;
  imgHeight: number;
  brightness: number;
  contrast: number;
  invert: boolean;

  // Wall dimensions (in inches)
  wallW: number;
  wallH: number;
  panelGap: number;

  // Panel layout
  enabledWidths: number[];
  enabledHeights: number[];
  margin: number;

  // Grid settings
  spacingMode: 'spacing' | 'count';
  spacingX: number;
  spacingY: number;
  lockRatio: boolean;
  minSpacing: number;
  gridCols: number;
  gridRows: number;
  gridPattern: 'rect' | 'hex';

  // Hole settings
  standardHoleSizes: number[];
  enabledHoleSizes: number[];
  holeShape: 'circle' | 'square';
  threshold: number;
  gamma: number;

  // Visualization
  panelColor: string;
  bgColor: string;
  backlight: boolean;
  backlightMode: 'solid' | 'gradient';
  backlightColor: string;
  backlightColor2: string;
  backlightGradientAngle: number;
  backlightIntensity: number;
  showLabels: boolean;

  // Computed
  layoutOptions: LayoutOption[];
  selectedLayoutIdx: number;
  colWidths: number[];
  rowHeights: number[];
  panels: Panel[];
  gridInfo: { cols: number; rows: number };
}

export const STANDARD_WIDTHS = [24, 36, 48];
export const STANDARD_HEIGHTS = [48, 60, 72, 96, 120, 144];
export const STANDARD_HOLE_SIZES = [1.5, 1.25, 1.0, 0.75, 0.625, 0.5, 0.25];
export const PRICE_PER_SF = 42;
export const SCALE = 0.1; // 1 inch = 0.1 units in 3D

export type LightingPreset = 'standard' | 'dramatic' | 'sunset' | 'cool' | 'night';

export const DEFAULT_PANEL_STATE: PanelState = {
  sourceImage: null,
  grayPixels: null,
  imgWidth: 0,
  imgHeight: 0,
  brightness: 0,
  contrast: 0,
  invert: false,
  wallW: 240,   // 20 feet in inches
  wallH: 120,   // 10 feet in inches
  panelGap: 0.25,
  enabledWidths: [24, 48],
  enabledHeights: [96, 120, 144],
  margin: 1,
  spacingMode: 'spacing',
  spacingX: 2,
  spacingY: 2,
  lockRatio: true,
  minSpacing: 2,
  gridCols: 46,
  gridRows: 118,
  gridPattern: 'rect',
  standardHoleSizes: [...STANDARD_HOLE_SIZES],
  enabledHoleSizes: [...STANDARD_HOLE_SIZES],
  holeShape: 'circle',
  threshold: 245,
  gamma: 1.0,
  panelColor: '#808080',
  bgColor: '#111111',
  backlight: true,
  backlightMode: 'gradient',
  backlightColor: '#ff69b4',
  backlightColor2: '#4488ff',
  backlightGradientAngle: 0,
  backlightIntensity: 1.0,
  showLabels: true,
  layoutOptions: [],
  selectedLayoutIdx: 0,
  colWidths: [],
  rowHeights: [],
  panels: [],
  gridInfo: { cols: 0, rows: 0 },
};
