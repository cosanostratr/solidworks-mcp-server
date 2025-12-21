/**
 * Type definitions for SolidWorks adapter pattern
 * Enhanced with comprehensive operation support and robust error handling
 */

import { z } from 'zod';
import { SolidWorksModel, SolidWorksFeature } from '../solidworks/types/business-types.js';

/**
 * Base interface for all SolidWorks adapters
 */
export interface ISolidWorksAdapter {
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  healthCheck(): Promise<AdapterHealth>;
  
  // Command execution
  execute<T>(command: { name: string; parameters: Record<string, any> }): Promise<{ success: boolean; data?: T; error?: string }>;
  executeRaw(method: string, args: any[]): Promise<any>;
  
  // Model operations
  openModel(filePath: string): Promise<SolidWorksModel>;
  closeModel(save?: boolean): Promise<void>;
  createPart(): Promise<SolidWorksModel>;
  createAssembly(): Promise<SolidWorksModel>;
  createDrawing(): Promise<SolidWorksModel>;
  
  // Feature operations with parameter workarounds
  createExtrusion(params: ExtrusionParameters): Promise<SolidWorksFeature>;
  createRevolve(params: RevolveParameters): Promise<SolidWorksFeature>;
  createSweep(params: SweepParameters): Promise<SolidWorksFeature>;
  createLoft(params: LoftParameters): Promise<SolidWorksFeature>;
  
  // Sketch operations
  createSketch(plane: string): Promise<string>;
  addLine(x1: number, y1: number, x2: number, y2: number): Promise<void>;
  addCircle(centerX: number, centerY: number, radius: number): Promise<void>;
  addRectangle(x1: number, y1: number, x2: number, y2: number): Promise<void>;
  exitSketch(): Promise<void>;
  
  // Analysis operations
  getMassProperties(): Promise<MassProperties>;
  
  // Export operations
  exportFile(filePath: string, format: string): Promise<void>;
  
  // Dimension operations
  getDimension(name: string): Promise<number>;
  setDimension(name: string, value: number): Promise<void>;
}

/**
 * Adapter health status
 */
export interface AdapterHealth {
  healthy: boolean;
  lastCheck: Date;
  errorCount: number;
  successCount: number;
  averageResponseTime: number;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  metrics?: {
    directCOMCalls?: number;
    macroFallbacks?: number;
    successRate?: number;
  };
}


/**
 * Schema definitions for common SolidWorks types
 */
export const ModelSchema = z.object({
  path: z.string(),
  name: z.string(),
  type: z.enum(['Part', 'Assembly', 'Drawing']),
  isActive: z.boolean(),
  configurations: z.array(z.string()).optional(),
});

export const FeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  suppressed: z.boolean(),
  parameters: z.record(z.any()),
});

export const SketchSchema = z.object({
  id: z.string(),
  name: z.string(),
  plane: z.string(),
  entities: z.array(z.object({
    type: z.string(),
    id: z.string(),
    coordinates: z.array(z.number()),
  })),
});

export type Model = z.infer<typeof ModelSchema>;
export type Feature = z.infer<typeof FeatureSchema>;
export type Sketch = z.infer<typeof SketchSchema>;

/**
 * Parameter types for feature operations
 */
export interface ExtrusionParameters {
  depth: number;
  reverse?: boolean;
  bothDirections?: boolean;
  depth2?: number;  // Added for second direction depth
  draft?: number;
  draftOutward?: boolean;
  draftWhileExtruding?: boolean;
  offsetDistance?: number;
  offsetReverse?: boolean;
  translateSurface?: boolean;
  merge?: boolean;
  flipSideToCut?: boolean;
  startCondition?: number;
  endCondition?: number | string;  // Can be number or string like "Blind"
  thinFeature?: boolean;
  thinThickness?: number;
  thinType?: string;  // Added for thin feature type
  capEnds?: boolean;  // Added for capping ends
  capThickness?: number;  // Added for cap thickness
}

export interface RevolveParameters {
  angle: number;
  axis?: string;
  direction?: number | string;  // Can be number or string like "Reverse", "Both"
  merge?: boolean;
  thinFeature?: boolean;
  thinThickness?: number;
}

export interface SweepParameters {
  profileSketch: string;
  pathSketch: string;
  twistAngle?: number;
  merge?: boolean;
  thinFeature?: boolean;
  thinThickness?: number;
}

export interface LoftParameters {
  profiles: string[];
  guides?: string[];  // Alias for guideCurves
  guideCurves?: string[];
  centerCurve?: string;
  closed?: boolean;  // Alias for close
  close?: boolean;
  startTangency?: string;
  endTangency?: string;
  merge?: boolean;
  thinFeature?: boolean;
  thinThickness?: number;
}

export interface MassProperties {
  mass: number;
  volume: number;
  surfaceArea: number;
  centerOfMass: { x: number; y: number; z: number };
  density?: number;
  momentsOfInertia?: {
    Ixx: number;
    Iyy: number;
    Izz: number;
    Ixy: number;
    Iyz: number;
    Ixz: number;
  };
}

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  type: 'winax' | 'macro-fallback' | 'hybrid' | 'winax-enhanced';
  enableCircuitBreaker?: boolean;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  enableConnectionPool?: boolean;
  poolSize?: number;
  enableMetrics?: boolean;
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  macroPath?: string;
}