/**
 * Unit tests for Sketch Helpers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  findMostRecentSketch,
  getSegmentsFromSketch,
  getRecentSketchSegment,
  getSegmentAndSketchNames,
} from '../../../src/solidworks/helpers/sketch.js';
import {
  selectLastSketchSegment,
  selectByHeuristicMatch,
  selectByID2Fallback,
} from '../../../src/solidworks/helpers/selection.js';
import { IModelDoc2, ISketch, ISketchSegment, IFeature } from '../../../src/solidworks/types/com-types.js';
import * as featureUtils from '../../../src/utils/feature-utils.js';

vi.mock('../../../src/utils/feature-utils.js', () => ({
  traverseFeatures: vi.fn(),
}));

describe('Sketch Helpers', () => {
  let mockModel: IModelDoc2;
  let mockSketch: ISketch;
  let mockSegment: ISketchSegment;

  beforeEach(() => {
    mockSegment = {
      GetType: vi.fn().mockReturnValue(1),
    } as any;

    mockSketch = {
      GetSketchSegments: vi.fn().mockReturnValue([mockSegment]),
      GetSketchSegmentCount: vi.fn().mockReturnValue(1),
    } as any;

    mockModel = {
      FeatureManager: {
        GetFeatures: vi.fn().mockReturnValue([]),
      },
      Extension: {
        SelectByID2: vi.fn().mockReturnValue(true),
      },
      SketchManager: {
        ActiveSketch: mockSketch,
      },
    } as any;
  });

  describe('findMostRecentSketch', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return null when no model', () => {
      const result = findMostRecentSketch(null);
      expect(result).toBeNull();
    });

    it('should find most recent sketch', () => {
      const mockFeature = { Name: 'Sketch1' };
      vi.mocked(featureUtils.traverseFeatures).mockImplementation((model, callback) => {
        callback({ feature: mockFeature, name: 'Sketch1', typeName: 'ProfileFeature' });
        return null;
      });

      const result = findMostRecentSketch(mockModel);
      expect(result).toBe(mockFeature);
    });

    it('should handle traverseFeatures errors', () => {
      vi.mocked(featureUtils.traverseFeatures).mockImplementation(() => {
        throw new Error('traverseFeatures failed');
      });

      const result = findMostRecentSketch(mockModel);
      expect(result).toBeNull();
    });

    it('should find sketch with Sketch in typeName', () => {
      const mockFeature = { Name: 'Sketch1' };
      vi.mocked(featureUtils.traverseFeatures).mockImplementation((model, callback) => {
        callback({ feature: mockFeature, name: 'Sketch1', typeName: 'SketchFeature' });
        return null;
      });

      const result = findMostRecentSketch(mockModel);
      expect(result).toBe(mockFeature);
    });
  });

  describe('getSegmentsFromSketch', () => {
    it('should return null when no sketch', () => {
      const result = getSegmentsFromSketch(null, 'last');
      expect(result).toBeNull();
    });

    it('should get last segment', () => {
      const result = getSegmentsFromSketch(mockSketch, 'last');
      expect(result).toBeDefined();
    });

    it('should get first segment', () => {
      const result = getSegmentsFromSketch(mockSketch, 'first');
      expect(result).toBeDefined();
    });

    it('should handle null segments', () => {
      (mockSketch.GetSketchSegments as any).mockReturnValue(null);
      const result = getSegmentsFromSketch(mockSketch, 'last');
      expect(result).toBeNull();
    });

    it('should handle missing GetSketchSegments method', () => {
      delete (mockSketch as any).GetSketchSegments;
      const result = getSegmentsFromSketch(mockSketch, 'last');
      expect(result).toBeNull();
    });

    it('should handle GetSketchSegmentCount failure', () => {
      (mockSketch.GetSketchSegmentCount as any).mockImplementation(() => {
        throw new Error('GetSketchSegmentCount failed');
      });
      const result = getSegmentsFromSketch(mockSketch, 'last');
      expect(result).toBeDefined();
    });

    it('should handle segments array conversion via valueOf', () => {
      const mockSegments = {
        valueOf: vi.fn().mockReturnValue([mockSegment, mockSegment]),
      };
      (mockSketch.GetSketchSegments as any).mockReturnValue(mockSegments);
      const result = getSegmentsFromSketch(mockSketch, 'last');
      expect(result).toBeDefined();
    });

    it('should handle segments array conversion via length property', () => {
      const mockSegments = {
        length: 2,
        0: mockSegment,
        1: mockSegment,
      };
      (mockSketch.GetSketchSegments as any).mockReturnValue(mockSegments);
      const result = getSegmentsFromSketch(mockSketch, 'last');
      expect(result).toBeDefined();
    });

    it('should handle segments array conversion via count', () => {
      const mockSegments = {};
      (mockSketch.GetSketchSegments as any).mockReturnValue(mockSegments);
      (mockSketch.GetSketchSegmentCount as any).mockReturnValue(2);
      Object.defineProperty(mockSegments, '0', { value: mockSegment, enumerable: true });
      Object.defineProperty(mockSegments, '1', { value: mockSegment, enumerable: true });
      const result = getSegmentsFromSketch(mockSketch, 'last');
      expect(result).toBeDefined();
    });

    it('should handle empty segments array', () => {
      const mockSegments = {
        Select4: vi.fn(),
      };
      (mockSketch.GetSketchSegments as any).mockReturnValue(mockSegments);
      const result = getSegmentsFromSketch(mockSketch, 'last');
      expect(result).toBeDefined();
    });

    it('should handle GetSketchSegments failure', () => {
      (mockSketch.GetSketchSegments as any).mockImplementation(() => {
        throw new Error('GetSketchSegments failed');
      });
      const result = getSegmentsFromSketch(mockSketch, 'last');
      expect(result).toBeNull();
    });

    it('should handle conversion errors', () => {
      const mockSegments = {
        valueOf: vi.fn().mockImplementation(() => {
          throw new Error('valueOf failed');
        }),
      };
      (mockSketch.GetSketchSegments as any).mockReturnValue(mockSegments);
      const result = getSegmentsFromSketch(mockSketch, 'last');
      expect(result).toBeNull();
    });
  });

  describe('selectLastSketchSegment', () => {
    it('should select last sketch segment', () => {
      const result = selectLastSketchSegment(mockModel, false);
      expect(result).toBe(true);
    });

    it('should handle append mode', () => {
      const result = selectLastSketchSegment(mockModel, true);
      expect(result).toBe(true);
    });

    it('should return false when no active sketch', () => {
      (mockModel.SketchManager as any).ActiveSketch = null;
      const result = selectLastSketchSegment(mockModel, false);
      expect(result).toBe(false);
    });
  });

  describe('selectByHeuristicMatch', () => {
    it('should match by name', () => {
      const result = selectByHeuristicMatch(mockModel, 'Sketch1', false);
      expect(result).toBeDefined();
    });

    it('should handle append mode', () => {
      const result = selectByHeuristicMatch(mockModel, 'Sketch1', true);
      expect(result).toBeDefined();
    });
  });

  describe('selectByID2Fallback', () => {
    it('should select by ID2', () => {
      const result = selectByID2Fallback(mockModel, 'Sketch1', false);
      expect(result).toBe(true);
      expect(mockModel.Extension.SelectByID2).toHaveBeenCalled();
    });

    it('should handle append mode', () => {
      const result = selectByID2Fallback(mockModel, 'Sketch1', true);
      expect(result).toBe(true);
    });

    it('should return false when SelectByID2 fails', () => {
      (mockModel.Extension.SelectByID2 as any).mockReturnValue(false);
      const result = selectByID2Fallback(mockModel, 'Sketch1', false);
      expect(result).toBe(false);
    });
  });

  describe('getRecentSketchSegment', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return null when no model', () => {
      const result = getRecentSketchSegment(null, 'last');
      expect(result).toBeNull();
    });

    it('should return null when no SketchManager', () => {
      delete (mockModel as any).SketchManager;
      const result = getRecentSketchSegment(mockModel, 'last');
      expect(result).toBeNull();
    });

    it('should get segment from active sketch', () => {
      const result = getRecentSketchSegment(mockModel, 'last');
      expect(result).toBeDefined();
    });

    it('should activate recent sketch when no active sketch', () => {
      (mockModel.SketchManager.ActiveSketch as any) = null;
      const mockFeature = {
        Select2: vi.fn().mockReturnValue(true),
      };
      vi.mocked(featureUtils.traverseFeatures).mockReturnValue(mockFeature);
      (mockModel.EditSketch as any) = vi.fn();
      (mockModel.SketchManager.ActiveSketch as any) = mockSketch;

      const result = getRecentSketchSegment(mockModel, 'last');
      expect(result).toBeDefined();
    });

    it('should handle Select2 failure when activating sketch', () => {
      (mockModel.SketchManager.ActiveSketch as any) = null;
      const mockFeature = {
        Select2: vi.fn().mockImplementation(() => {
          throw new Error('Select2 failed');
        }),
      };
      vi.mocked(featureUtils.traverseFeatures).mockReturnValue(mockFeature);

      const result = getRecentSketchSegment(mockModel, 'last');
      expect(result).toBeNull();
    });

    it('should handle EditSketch failure', () => {
      (mockModel.SketchManager.ActiveSketch as any) = null;
      const mockFeature = {
        Select2: vi.fn().mockReturnValue(true),
      };
      vi.mocked(featureUtils.traverseFeatures).mockReturnValue(mockFeature);
      (mockModel.EditSketch as any) = vi.fn().mockImplementation(() => {
        throw new Error('EditSketch failed');
      });

      const result = getRecentSketchSegment(mockModel, 'last');
      expect(result).toBeNull();
    });

    it('should handle ActiveSketch access errors', () => {
      (mockModel.SketchManager as any).ActiveSketch = null;
      Object.defineProperty(mockModel.SketchManager, 'ActiveSketch', {
        get: () => {
          throw new Error('ActiveSketch failed');
        },
      });

      const result = getRecentSketchSegment(mockModel, 'last');
      expect(result).toBeNull();
    });
  });

  describe('getSegmentAndSketchNames', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return empty strings when no model', () => {
      const result = getSegmentAndSketchNames(null, mockSegment);
      expect(result).toEqual({ segmentName: '', sketchName: '' });
    });

    it('should get segment name from GetName', () => {
      const segment = {
        GetName: vi.fn().mockReturnValue('Line1'),
      };
      const result = getSegmentAndSketchNames(mockModel, segment);
      expect(result.segmentName).toBe('Line1');
    });

    it('should get segment name from Name property', () => {
      const segment = {
        Name: 'Line1',
      };
      const result = getSegmentAndSketchNames(mockModel, segment);
      expect(result.segmentName).toBe('Line1');
    });

    it('should get sketch name from active sketch', () => {
      const segment = {
        GetName: vi.fn().mockReturnValue('Line1'),
      };
      (mockModel.SketchManager.ActiveSketch as any).Name = 'Sketch1';
      const result = getSegmentAndSketchNames(mockModel, segment);
      expect(result.sketchName).toBe('Sketch1');
    });

    it('should get sketch name from GetSketch', () => {
      const segment = {
        GetName: vi.fn().mockReturnValue('Line1'),
        GetSketch: vi.fn().mockReturnValue(mockSketch),
      };
      const mockFeature = {
        Name: 'Sketch1',
        GetSpecificFeature2: vi.fn().mockReturnValue(mockSketch),
      };
      vi.mocked(featureUtils.traverseFeatures).mockReturnValue(mockFeature);
      (mockModel.SketchManager.ActiveSketch as any).Name = 'Sketch1';

      const result = getSegmentAndSketchNames(mockModel, segment);
      expect(result.sketchName).toBe('Sketch1');
    });

    it('should handle errors gracefully', () => {
      const segment = {
        GetName: vi.fn().mockImplementation(() => {
          throw new Error('GetName failed');
        }),
      };
      const result = getSegmentAndSketchNames(mockModel, segment);
      expect(result.segmentName).toBe('');
    });
  });
});

