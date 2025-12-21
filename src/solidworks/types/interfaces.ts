// Parameter interfaces for API operations
export interface SketchParams {
  plane?: string;
}

export interface LineParams {
  x1?: number;
  y1?: number;
  z1?: number;
  x2?: number;
  y2?: number;
  z2?: number;
}

export interface ExtrudeParams {
  depth?: number;
  reverse?: boolean;
  draft?: number;
}

export interface SketchOperation {
  type: 'line' | 'circle' | 'arc' | 'rectangle';
  params: Record<string, number | boolean | undefined>;
}

export interface SketchContext {
  hasModel: boolean;
  modelName: string | null;
  modelType: number;
  activeSketch: { name: string | null } | null;
  recentSketchFeatures: Array<{ name: string; typeName: string }>;
}

export interface MassProperties {
  mass?: number;
  volume?: number;
  surfaceArea?: number;
  centerOfMass?: { x: number; y: number; z: number };
  density?: number;
  momentsOfInertia?: {
    Ixx: number;
    Ixy: number;
    Ixz: number;
    Iyx: number;
    Iyy: number;
    Iyz: number;
    Izx: number;
    Izy: number;
    Izz: number;
  };
}

