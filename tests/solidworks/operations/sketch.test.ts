/**
 * Unit tests for Sketch Operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SketchOperations } from '../../../src/solidworks/operations/sketch.js';
import { IModelDoc2, ISketchSegment } from '../../../src/solidworks/types/com-types.js';
import { SketchParams, LineParams } from '../../../src/solidworks/types/interfaces.js';

describe('SketchOperations', () => {
  let mockModel: IModelDoc2;
  let mockSketch: any;

  beforeEach(() => {
    mockSketch = {
      Name: 'Sketch1',
      GetName: vi.fn().mockReturnValue('Sketch1'),
    };

    mockModel = {
      SketchManager: {
        InsertSketch: vi.fn().mockReturnValue(true),
        ActiveSketch: mockSketch,
        CreateLine: vi.fn().mockReturnValue({} as ISketchSegment),
        CreateCircleByRadius: vi.fn().mockReturnValue({} as ISketchSegment),
        CreateArc: vi.fn().mockReturnValue({} as ISketchSegment),
        CreateCornerRectangle: vi.fn().mockReturnValue({} as ISketchSegment),
        AddToDB: true,
        DisplayWhenAdded: false,
      },
      Extension: {
        SelectByID2: vi.fn().mockReturnValue(true),
      },
      ClearSelection2: vi.fn(),
      EditRebuild3: vi.fn(),
    } as any;
  });

  describe('createSketch', () => {
    it('should throw error when no model provided', () => {
      expect(() => {
        SketchOperations.createSketch(null, { plane: 'Front' });
      }).toThrow('No active model');
    });

    it('should create sketch on Front plane', () => {
      const params: SketchParams = { plane: 'Front' };
      const result = SketchOperations.createSketch(mockModel, params);
      
      expect(result.success).toBe(true);
      expect(result.sketchId).toBe('Sketch1');
      expect(mockModel.SketchManager.InsertSketch).toHaveBeenCalled();
    });

    it('should create sketch on Top plane', () => {
      const params: SketchParams = { plane: 'Top' };
      const result = SketchOperations.createSketch(mockModel, params);
      
      expect(result.success).toBe(true);
    });

    it('should create sketch on Right plane', () => {
      const params: SketchParams = { plane: 'Right' };
      const result = SketchOperations.createSketch(mockModel, params);
      
      expect(result.success).toBe(true);
    });

    it('should handle custom plane name', () => {
      const params: SketchParams = { plane: 'CustomPlane' };
      const result = SketchOperations.createSketch(mockModel, params);
      
      expect(mockModel.Extension.SelectByID2).toHaveBeenCalled();
    });

    it('should return error if sketch creation fails', () => {
      (mockModel.SketchManager.InsertSketch as any).mockReturnValue(false);
      (mockModel.SketchManager.ActiveSketch as any) = null;
      
      const params: SketchParams = { plane: 'Front' };
      const result = SketchOperations.createSketch(mockModel, params);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('addLine', () => {
    it('should throw error when no model provided', () => {
      expect(() => {
        SketchOperations.addLine(null, { x1: 0, y1: 0, x2: 100, y2: 0 });
      }).toThrow('No active model');
    });

    it('should add line with default parameters', () => {
      const params: LineParams = {};
      const result = SketchOperations.addLine(mockModel, params);
      
      expect(result.success).toBe(true);
      expect(mockModel.SketchManager.CreateLine).toHaveBeenCalled();
    });

    it('should add line with custom coordinates', () => {
      const params: LineParams = {
        x1: 0,
        y1: 0,
        z1: 0,
        x2: 100,
        y2: 50,
        z2: 0,
      };
      const result = SketchOperations.addLine(mockModel, params);
      
      expect(result.success).toBe(true);
      expect(mockModel.SketchManager.CreateLine).toHaveBeenCalledWith(
        0, 0, 0, // Converted from mm to m
        0.1, 0.05, 0
      );
    });

    it('should return error if line creation fails', () => {
      (mockModel.SketchManager.CreateLine as any).mockReturnValue(null);
      
      const params: LineParams = {};
      const result = SketchOperations.addLine(mockModel, params);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('selectStandardPlane', () => {
    it('should return false when no model provided', () => {
      const result = SketchOperations.selectStandardPlane(null, 'Front');
      expect(result).toBe(false);
    });

    it('should select Front plane', () => {
      const result = SketchOperations.selectStandardPlane(mockModel, 'Front');
      expect(mockModel.ClearSelection2).toHaveBeenCalled();
    });

    it('should select Top plane', () => {
      const result = SketchOperations.selectStandardPlane(mockModel, 'Top');
      expect(mockModel.ClearSelection2).toHaveBeenCalled();
    });

    it('should select Right plane', () => {
      const result = SketchOperations.selectStandardPlane(mockModel, 'Right');
      expect(mockModel.ClearSelection2).toHaveBeenCalled();
    });
  });

  describe('getSketchContext', () => {
    it('should return empty context when no model provided', () => {
      const result = SketchOperations.getSketchContext(null);
      
      expect(result.hasModel).toBe(false);
      expect(result.modelName).toBeNull();
      expect(result.activeSketch).toBeNull();
      expect(result.recentSketchFeatures).toEqual([]);
    });

    it('should get sketch context from model', () => {
      const result = SketchOperations.getSketchContext(mockModel);
      
      expect(result.hasModel).toBe(true);
      expect(result.modelName).toBeDefined();
    });
  });

  describe('createSketchEntitiesBatch', () => {
    it('should throw error when no model provided', () => {
      expect(() => {
        SketchOperations.createSketchEntitiesBatch(null, []);
      }).toThrow('No model open');
    });

    it('should create multiple sketch entities', () => {
      const operations = [
        { type: 'line' as const, params: { x1: 0, y1: 0, x2: 100, y2: 0 } },
        { type: 'circle' as const, params: { centerX: 50, centerY: 50, radius: 25 } },
      ];

      const result = SketchOperations.createSketchEntitiesBatch(mockModel, operations);
      
      expect(Array.isArray(result)).toBe(true);
      expect(mockModel.SketchManager.CreateLine).toHaveBeenCalled();
      expect(mockModel.SketchManager.CreateCircleByRadius).toHaveBeenCalled();
    });

    it('should handle rebuild after batch creation', () => {
      const operations = [
        { type: 'line' as const, params: { x1: 0, y1: 0, x2: 100, y2: 0 } },
      ];

      SketchOperations.createSketchEntitiesBatch(mockModel, operations, { rebuildAfter: true });
      
      expect(mockModel.EditRebuild3).toHaveBeenCalled();
    });
  });
});

