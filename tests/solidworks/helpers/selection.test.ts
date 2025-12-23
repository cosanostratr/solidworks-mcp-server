/**
 * Unit tests for Selection Helpers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  selectLastSketchSegment,
  selectSegmentByID2,
  selectByHeuristicMatch,
  selectByID2Fallback,
} from '../../../src/solidworks/helpers/selection.js';
import { IModelDoc2 } from '../../../src/solidworks/types/com-types.js';
import * as sketchHelpers from '../../../src/solidworks/helpers/sketch.js';

vi.mock('../../../src/solidworks/helpers/sketch.js', () => ({
  getRecentSketchSegment: vi.fn(),
  getSegmentAndSketchNames: vi.fn(),
}));

describe('Selection Helpers', () => {
  let mockModel: IModelDoc2;

  beforeEach(() => {
    mockModel = {
      SketchManager: {
        ActiveSketch: {
          GetSketchSegments: vi.fn().mockReturnValue([]),
        },
      },
      Extension: {
        SelectByID2: vi.fn().mockReturnValue(true),
      },
      ClearSelection2: vi.fn(),
    } as any;
  });

  describe('selectLastSketchSegment', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return false when no model provided', () => {
      const result = selectLastSketchSegment(null, false);
      expect(result).toBe(false);
    });

    it('should select last sketch segment', () => {
      const mockSegment = {
        GetName: vi.fn().mockReturnValue('Line1'),
      };
      vi.mocked(sketchHelpers.getRecentSketchSegment).mockReturnValue(mockSegment);
      vi.mocked(sketchHelpers.getSegmentAndSketchNames).mockReturnValue({
        segmentName: 'Line1',
        sketchName: 'Sketch1',
      });

      const result = selectLastSketchSegment(mockModel, false);
      expect(result).toBe(true);
    });

    it('should return false when no segment found', () => {
      vi.mocked(sketchHelpers.getRecentSketchSegment).mockReturnValue(null);

      const result = selectLastSketchSegment(mockModel, false);
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      vi.mocked(sketchHelpers.getRecentSketchSegment).mockImplementation(() => {
        throw new Error('getRecentSketchSegment failed');
      });

      const result = selectLastSketchSegment(mockModel, false);
      expect(result).toBe(false);
    });
  });

  describe('selectSegmentByID2', () => {
    it('should return false when no model provided', () => {
      const result = selectSegmentByID2(null, 'Line1', 'Sketch1', false);
      expect(result).toBe(false);
    });

    it('should select segment when sketch is active', () => {
      const result = selectSegmentByID2(mockModel, 'Line1', 'Sketch1', false);
      expect(mockModel.Extension.SelectByID2).toHaveBeenCalled();
    });

    it('should use EXTSKETCHSEGMENT type when sketch is not active', () => {
      (mockModel.SketchManager.ActiveSketch as any) = null;
      
      const result = selectSegmentByID2(mockModel, 'Line1', 'Sketch1', false);
      expect(mockModel.Extension.SelectByID2).toHaveBeenCalledWith(
        'Line1@Sketch1',
        'EXTSKETCHSEGMENT',
        0.0,
        0.0,
        0.0,
        expect.anything(),
        0,
        null,
        0
      );
    });

    it('should return false if SelectByID2 fails', () => {
      (mockModel.Extension.SelectByID2 as any).mockReturnValue(false);
      
      const result = selectSegmentByID2(mockModel, 'Line1', 'Sketch1', false);
      expect(result).toBe(false);
    });

    it('should return false when Extension is not available', () => {
      delete (mockModel as any).Extension;
      const result = selectSegmentByID2(mockModel, 'Line1', 'Sketch1', false);
      expect(result).toBe(false);
    });

    it('should handle SelectByID2 errors', () => {
      (mockModel.Extension.SelectByID2 as any).mockImplementation(() => {
        throw new Error('SelectByID2 failed');
      });
      
      const result = selectSegmentByID2(mockModel, 'Line1', 'Sketch1', false);
      expect(result).toBe(false);
    });

    it('should use SKETCHSEGMENT type when sketch is active', () => {
      const result = selectSegmentByID2(mockModel, 'Line1', 'Sketch1', false);
      expect(mockModel.Extension.SelectByID2).toHaveBeenCalledWith(
        'Line1',
        'SKETCHSEGMENT',
        0.0,
        0.0,
        0.0,
        expect.anything(),
        0,
        null,
        0
      );
    });
  });

  describe('selectByHeuristicMatch', () => {
    it('should return false when no model provided', () => {
      const result = selectByHeuristicMatch(null, 'Line1', false);
      expect(result).toBe(false);
    });

    it('should return false for non-matching pattern', () => {
      const result = selectByHeuristicMatch(mockModel, 'Invalid', false);
      expect(result).toBe(false);
    });

    it('should select segment by index for Line pattern', () => {
      const mockSegments = [
        { Select4: vi.fn().mockReturnValue(true) },
        { Select4: vi.fn().mockReturnValue(true) },
      ];
      (mockModel.SketchManager.ActiveSketch.GetSketchSegments as any).mockReturnValue(mockSegments);

      const result = selectByHeuristicMatch(mockModel, 'Line2', false);
      expect(result).toBe(true);
    });

    it('should handle Arc pattern', () => {
      const mockSegments = [
        { Select4: vi.fn().mockReturnValue(true) },
        { Select4: vi.fn().mockReturnValue(true) },
      ];
      (mockModel.SketchManager.ActiveSketch.GetSketchSegments as any).mockReturnValue(mockSegments);

      const result = selectByHeuristicMatch(mockModel, 'Arc1', false);
      expect(result).toBe(true);
    });

    it('should handle Circle pattern', () => {
      const mockSegments = [
        { Select4: vi.fn().mockReturnValue(true) },
      ];
      (mockModel.SketchManager.ActiveSketch.GetSketchSegments as any).mockReturnValue(mockSegments);

      const result = selectByHeuristicMatch(mockModel, 'Circle1', false);
      expect(result).toBe(true);
    });

    it('should handle segments array conversion', () => {
      const mockSegments = {
        length: 2,
        0: { Select4: vi.fn().mockReturnValue(true) },
        1: { Select4: vi.fn().mockReturnValue(true) },
      };
      (mockModel.SketchManager.ActiveSketch.GetSketchSegments as any).mockReturnValue(mockSegments);

      const result = selectByHeuristicMatch(mockModel, 'Line2', false);
      expect(result).toBe(true);
    });

    it('should handle segments with Count property', () => {
      const mockSegments = {
        Count: 2,
        Item: vi.fn((i: number) => ({ Select4: vi.fn().mockReturnValue(true) })),
      };
      (mockModel.SketchManager.ActiveSketch.GetSketchSegments as any).mockReturnValue(mockSegments);

      const result = selectByHeuristicMatch(mockModel, 'Line2', false);
      expect(result).toBe(true);
    });

    it('should return false when no active sketch', () => {
      (mockModel.SketchManager.ActiveSketch as any) = null;
      const result = selectByHeuristicMatch(mockModel, 'Line1', false);
      expect(result).toBe(false);
    });

    it('should return false when index is out of range', () => {
      const mockSegments = [
        { Select4: vi.fn().mockReturnValue(true) },
      ];
      (mockModel.SketchManager.ActiveSketch.GetSketchSegments as any).mockReturnValue(mockSegments);

      const result = selectByHeuristicMatch(mockModel, 'Line10', false);
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      (mockModel.SketchManager.ActiveSketch.GetSketchSegments as any).mockImplementation(() => {
        throw new Error('GetSketchSegments failed');
      });

      const result = selectByHeuristicMatch(mockModel, 'Line1', false);
      expect(result).toBe(false);
    });
  });

  describe('selectByID2Fallback', () => {
    it('should return false when no model provided', () => {
      const result = selectByID2Fallback(null, 'Line1', false);
      expect(result).toBe(false);
    });

    it('should try multiple types when sketch is active', () => {
      const result = selectByID2Fallback(mockModel, 'Line1', false);
      expect(mockModel.Extension.SelectByID2).toHaveBeenCalled();
    });

    it('should try multiple types when sketch is not active', () => {
      (mockModel.SketchManager.ActiveSketch as any) = null;
      
      const result = selectByID2Fallback(mockModel, 'Line1', false);
      expect(mockModel.Extension.SelectByID2).toHaveBeenCalled();
    });

    it('should return false if all attempts fail', () => {
      (mockModel.Extension.SelectByID2 as any).mockReturnValue(false);
      
      const result = selectByID2Fallback(mockModel, 'NonExistent', false);
      expect(result).toBe(false);
    });

    it('should return false when Extension is not available', () => {
      delete (mockModel as any).Extension;
      const result = selectByID2Fallback(mockModel, 'Line1', false);
      expect(result).toBe(false);
    });

    it('should handle name variations with @', () => {
      const result = selectByID2Fallback(mockModel, 'Line1@Sketch1', false);
      expect(mockModel.Extension.SelectByID2).toHaveBeenCalled();
    });

    it('should handle type mismatch error', () => {
      const error = new Error('Type mismatch');
      (error as any).errno = -2147352571;
      (mockModel.Extension.SelectByID2 as any).mockImplementation(() => {
        throw error;
      });
      (mockModel.Extension.SelectByID2 as any).mockReturnValueOnce(false).mockReturnValueOnce(true);

      const result = selectByID2Fallback(mockModel, 'Line1', false);
      expect(mockModel.Extension.SelectByID2).toHaveBeenCalled();
    });

    it('should handle errors gracefully', () => {
      (mockModel.Extension.SelectByID2 as any).mockImplementation(() => {
        throw new Error('SelectByID2 failed');
      });

      const result = selectByID2Fallback(mockModel, 'Line1', false);
      expect(result).toBe(false);
    });
  });
});

