/**
 * Unit tests for Extrusion Helpers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  prepareForExtrusion,
  selectSketchForExtrusion,
  tryFeatureExtrusion,
  tryFeatureExtrusion2,
  tryFeatureExtrusion3,
  generateVBAFallbackMacro,
  finalizeExtrusion,
} from '../../../src/solidworks/helpers/extrusion.js';
import { IModelDoc2, IFeatureManager, IFeature } from '../../../src/solidworks/types/com-types.js';
import * as featureUtils from '../../../src/utils/feature-utils.js';

vi.mock('../../../src/utils/feature-utils.js', () => ({
  getFeatureInfo: vi.fn(),
  isSketchLikeFeature: vi.fn(),
}));

describe('Extrusion Helpers', () => {
  let mockModel: IModelDoc2;
  let mockFeatureMgr: IFeatureManager;
  let mockFeature: IFeature;

  beforeEach(() => {
    mockFeature = {
      Name: 'Extrude1',
      GetName: vi.fn().mockReturnValue('Extrude1'),
      Select2: vi.fn().mockReturnValue(true),
    } as any;

    mockFeatureMgr = {
      FeatureExtrusion3: vi.fn().mockReturnValue(mockFeature),
      FeatureExtrusion2: vi.fn().mockReturnValue(mockFeature),
      FeatureExtrusion: vi.fn().mockReturnValue(mockFeature),
    } as any;

    mockModel = {
      SketchManager: {
        ActiveSketch: null,
        InsertSketch: vi.fn(),
      },
      ClearSelection2: vi.fn(),
      FeatureByPositionReverse: vi.fn(),
      Extension: {
        SelectByID2: vi.fn().mockReturnValue(true),
      },
      FeatureManager: mockFeatureMgr,
    } as any;
  });

  describe('prepareForExtrusion', () => {
    it('should exit sketch mode if active', () => {
      const mockSketch = { Name: 'Sketch1' };
      (mockModel.SketchManager as any).ActiveSketch = mockSketch;
      
      prepareForExtrusion(mockModel);
      expect(mockModel.SketchManager.InsertSketch).toHaveBeenCalled();
    });

    it('should clear selections', () => {
      prepareForExtrusion(mockModel);
      expect(mockModel.ClearSelection2).toHaveBeenCalled();
    });

    it('should handle null model gracefully', () => {
      expect(() => {
        prepareForExtrusion(null);
      }).not.toThrow();
    });

    it('should handle sketch manager errors', () => {
      (mockModel.SketchManager as any).ActiveSketch = null;
      (mockModel.SketchManager.InsertSketch as any).mockImplementation(() => {
        throw new Error('InsertSketch failed');
      });
      
      expect(() => {
        prepareForExtrusion(mockModel);
      }).not.toThrow();
    });

    it('should handle ClearSelection2 errors', () => {
      (mockModel.ClearSelection2 as any).mockImplementation(() => {
        throw new Error('ClearSelection2 failed');
      });
      
      expect(() => {
        prepareForExtrusion(mockModel);
      }).not.toThrow();
    });
  });

  describe('selectSketchForExtrusion', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should throw error when no model', () => {
      expect(() => {
        selectSketchForExtrusion(null);
      }).toThrow('No model open');
    });

    it('should select sketch by position using Select2', () => {
      const mockSketchFeature = {
        Name: 'Sketch1',
        GetName: vi.fn().mockReturnValue('Sketch1'),
        Select2: vi.fn().mockReturnValue(true),
      };
      (mockModel.FeatureByPositionReverse as any) = vi.fn()
        .mockReturnValueOnce(mockSketchFeature)
        .mockReturnValueOnce(null);
      
      vi.mocked(featureUtils.getFeatureInfo).mockReturnValue({ 
        name: 'Sketch1', 
        typeName: 'ProfileFeature',
        feature: mockSketchFeature
      });
      vi.mocked(featureUtils.isSketchLikeFeature).mockReturnValue(true);

      const result = selectSketchForExtrusion(mockModel);
      expect(result).toBe('Sketch1');
    });

    it('should use SelectByID2 fallback when Select2 fails', () => {
      const mockSketchFeature = {
        Name: 'Sketch1',
        GetName: vi.fn().mockReturnValue('Sketch1'),
        Select2: vi.fn().mockImplementation(() => {
          throw new Error('Select2 failed');
        }),
      };
      (mockModel.FeatureByPositionReverse as any) = vi.fn()
        .mockReturnValueOnce(mockSketchFeature)
        .mockReturnValueOnce(null);
      
      vi.mocked(featureUtils.getFeatureInfo).mockReturnValue({ 
        name: 'Sketch1', 
        typeName: 'ProfileFeature',
        feature: mockSketchFeature
      });
      vi.mocked(featureUtils.isSketchLikeFeature).mockReturnValue(true);
      (mockModel.Extension.SelectByID2 as any).mockReturnValue(true);

      const result = selectSketchForExtrusion(mockModel);
      expect(result).toBe('Sketch1');
      expect(mockModel.Extension.SelectByID2).toHaveBeenCalled();
    });

    it('should throw error when no sketch found', () => {
      (mockModel.FeatureByPositionReverse as any) = vi.fn()
        .mockReturnValue(null);
      
      vi.mocked(featureUtils.getFeatureInfo).mockReturnValue({ 
        name: 'Feature1', 
        typeName: 'BossExtrude',
        feature: {}
      });
      vi.mocked(featureUtils.isSketchLikeFeature).mockReturnValue(false);

      expect(() => {
        selectSketchForExtrusion(mockModel);
      }).toThrow('No sketch found to extrude');
    });

    it('should handle feature search errors gracefully', () => {
      (mockModel.FeatureByPositionReverse as any) = vi.fn().mockImplementation(() => {
        throw new Error('FeatureByPositionReverse failed');
      });

      expect(() => {
        selectSketchForExtrusion(mockModel);
      }).toThrow('No sketch found to extrude');
    });

    it('should handle attempted sketches in error message', () => {
      const mockSketchFeature = {
        Name: 'Sketch1',
        GetName: vi.fn().mockReturnValue('Sketch1'),
        Select2: vi.fn().mockImplementation(() => {
          throw new Error('Select2 failed');
        }),
      };
      (mockModel.FeatureByPositionReverse as any) = vi.fn()
        .mockReturnValueOnce(mockSketchFeature)
        .mockReturnValueOnce(null);
      
      vi.mocked(featureUtils.getFeatureInfo).mockReturnValue({ 
        name: 'Sketch1', 
        typeName: 'ProfileFeature',
        feature: mockSketchFeature
      });
      vi.mocked(featureUtils.isSketchLikeFeature).mockReturnValue(true);
      (mockModel.Extension.SelectByID2 as any).mockImplementation(() => {
        throw new Error('SelectByID2 failed');
      });

      expect(() => {
        selectSketchForExtrusion(mockModel);
      }).toThrow('No sketch found to extrude');
    });

    it('should handle feature where Select2 throws error and SelectByID2 succeeds', () => {
      const mockSketchFeature = {
        Name: 'Sketch1',
        GetName: vi.fn().mockReturnValue('Sketch1'),
        // Select2 exists but throws an error, triggering the catch block which tries SelectByID2
        Select2: vi.fn().mockImplementation(() => {
          throw new Error('Select2 failed');
        }),
      };
      
      (mockModel.FeatureByPositionReverse as any) = vi.fn()
        .mockReturnValueOnce(mockSketchFeature)
        .mockReturnValueOnce(null);
      
      vi.mocked(featureUtils.getFeatureInfo).mockReturnValue({ 
        name: 'Sketch1', 
        typeName: 'ProfileFeature',
        feature: mockSketchFeature
      });
      vi.mocked(featureUtils.isSketchLikeFeature).mockReturnValue(true);
      // Mock Extension and SelectByID2 to return true
      (mockModel.Extension as any).SelectByID2 = vi.fn().mockReturnValue(true);

      const result = selectSketchForExtrusion(mockModel);
      expect(result).toBe('Sketch1');
      expect(mockModel.Extension.SelectByID2).toHaveBeenCalled();
    });

    it('should handle feature without name', () => {
      const mockSketchFeature = {
        Select2: vi.fn().mockReturnValue(true),
      };
      (mockModel.FeatureByPositionReverse as any) = vi.fn()
        .mockReturnValueOnce(mockSketchFeature)
        .mockReturnValueOnce(null);
      
      vi.mocked(featureUtils.getFeatureInfo).mockReturnValue({ 
        name: '', 
        typeName: 'ProfileFeature',
        feature: mockSketchFeature
      });
      vi.mocked(featureUtils.isSketchLikeFeature).mockReturnValue(true);

      const result = selectSketchForExtrusion(mockModel);
      expect(result).toContain('Feature at position');
    });

    it('should handle feature info errors', () => {
      const mockSketchFeature = {};
      (mockModel.FeatureByPositionReverse as any) = vi.fn()
        .mockReturnValueOnce(mockSketchFeature)
        .mockReturnValueOnce(null);
      
      vi.mocked(featureUtils.getFeatureInfo).mockImplementation(() => {
        throw new Error('getFeatureInfo failed');
      });

      expect(() => {
        selectSketchForExtrusion(mockModel);
      }).toThrow('No sketch found to extrude');
    });

    it('should stop at maxIterations limit', () => {
      const mockSketchFeature = {
        Name: 'Sketch1',
        Select2: vi.fn().mockReturnValue(true),
      };
      
      // Create 50 features that are not sketches, then one sketch at position 50
      const features = Array(50).fill(null).map(() => ({
        Name: 'Feature',
        Select2: vi.fn(),
      }));
      features.push(mockSketchFeature);
      
      (mockModel.FeatureByPositionReverse as any) = vi.fn((index: number) => {
        return features[index] || null;
      });
      
      vi.mocked(featureUtils.getFeatureInfo).mockImplementation((feat: any) => {
        if (feat === mockSketchFeature) {
          return { name: 'Sketch1', typeName: 'ProfileFeature', feature: feat };
        }
        return { name: 'Feature', typeName: 'BossExtrude', feature: feat };
      });
      vi.mocked(featureUtils.isSketchLikeFeature).mockImplementation((name: string, typeName: string) => {
        return name === 'Sketch1' && typeName === 'ProfileFeature';
      });

      const result = selectSketchForExtrusion(mockModel);
      expect(result).toBe('Sketch1');
    });

    it('should select first sketch found when multiple sketches exist', () => {
      const mockSketch1 = {
        Name: 'Sketch1',
        Select2: vi.fn().mockReturnValue(true),
      };
      const mockSketch2 = {
        Name: 'Sketch2',
        Select2: vi.fn().mockReturnValue(true),
      };
      
      (mockModel.FeatureByPositionReverse as any) = vi.fn()
        .mockReturnValueOnce(mockSketch1)
        .mockReturnValueOnce(null);
      
      vi.mocked(featureUtils.getFeatureInfo).mockReturnValue({ 
        name: 'Sketch1', 
        typeName: 'ProfileFeature',
        feature: mockSketch1
      });
      vi.mocked(featureUtils.isSketchLikeFeature).mockReturnValue(true);

      const result = selectSketchForExtrusion(mockModel);
      expect(result).toBe('Sketch1');
      expect(mockSketch1.Select2).toHaveBeenCalled();
      expect(mockSketch2.Select2).not.toHaveBeenCalled();
    });

    it('should handle Extension being null', () => {
      const mockSketchFeature = {
        Name: 'Sketch1',
        Select2: vi.fn().mockImplementation(() => {
          throw new Error('Select2 failed');
        }),
      };
      (mockModel.FeatureByPositionReverse as any) = vi.fn()
        .mockReturnValueOnce(mockSketchFeature)
        .mockReturnValueOnce(null);
      
      vi.mocked(featureUtils.getFeatureInfo).mockReturnValue({ 
        name: 'Sketch1', 
        typeName: 'ProfileFeature',
        feature: mockSketchFeature
      });
      vi.mocked(featureUtils.isSketchLikeFeature).mockReturnValue(true);
      (mockModel.Extension as any) = null;

      expect(() => {
        selectSketchForExtrusion(mockModel);
      }).toThrow('No sketch found to extrude');
    });

    it('should handle SelectByID2 returning false', () => {
      const mockSketchFeature = {
        Name: 'Sketch1',
        Select2: vi.fn().mockImplementation(() => {
          throw new Error('Select2 failed');
        }),
      };
      (mockModel.FeatureByPositionReverse as any) = vi.fn()
        .mockReturnValueOnce(mockSketchFeature)
        .mockReturnValueOnce(null);
      
      vi.mocked(featureUtils.getFeatureInfo).mockReturnValue({ 
        name: 'Sketch1', 
        typeName: 'ProfileFeature',
        feature: mockSketchFeature
      });
      vi.mocked(featureUtils.isSketchLikeFeature).mockReturnValue(true);
      (mockModel.Extension.SelectByID2 as any).mockReturnValue(false);

      expect(() => {
        selectSketchForExtrusion(mockModel);
      }).toThrow('No sketch found to extrude');
    });
  });

  describe('tryFeatureExtrusion3', () => {
    it('should create extrusion using FeatureExtrusion3', () => {
      const feature = tryFeatureExtrusion3(mockFeatureMgr, 0.025, false);
      expect(feature).toBe(mockFeature);
      expect(mockFeatureMgr.FeatureExtrusion3).toHaveBeenCalled();
    });

    it('should handle reverse direction', () => {
      const feature = tryFeatureExtrusion3(mockFeatureMgr, 0.025, true);
      expect(feature).toBe(mockFeature);
      expect(mockFeatureMgr.FeatureExtrusion3).toHaveBeenCalled();
      const callArgs = vi.mocked(mockFeatureMgr.FeatureExtrusion3).mock.calls[0];
      expect(callArgs[1]).toBe(1); // Flip should be 1 when reverse is true
    });

    it('should pass correct depth parameter', () => {
      const depth = 0.05;
      tryFeatureExtrusion3(mockFeatureMgr, depth, false);
      const callArgs = vi.mocked(mockFeatureMgr.FeatureExtrusion3).mock.calls[0];
      expect(callArgs[5]).toBe(depth); // D1 should be the depth
    });

    it('should handle zero depth', () => {
      const feature = tryFeatureExtrusion3(mockFeatureMgr, 0, false);
      expect(feature).toBe(mockFeature);
    });

    it('should handle large depth values', () => {
      const feature = tryFeatureExtrusion3(mockFeatureMgr, 1.0, false);
      expect(feature).toBe(mockFeature);
    });

    it('should throw error when FeatureExtrusion3 fails', () => {
      (mockFeatureMgr.FeatureExtrusion3 as any).mockImplementation(() => {
        throw new Error('FeatureExtrusion3 failed');
      });
      
      expect(() => {
        tryFeatureExtrusion3(mockFeatureMgr, 0.025, false);
      }).toThrow('FeatureExtrusion3 failed');
    });
  });

  describe('tryFeatureExtrusion2', () => {
    it('should create extrusion using FeatureExtrusion2', () => {
      const feature = tryFeatureExtrusion2(mockFeatureMgr, 0.025, false);
      expect(feature).toBe(mockFeature);
      expect(mockFeatureMgr.FeatureExtrusion2).toHaveBeenCalled();
    });

    it('should handle reverse direction', () => {
      const feature = tryFeatureExtrusion2(mockFeatureMgr, 0.025, true);
      expect(feature).toBe(mockFeature);
      expect(mockFeatureMgr.FeatureExtrusion2).toHaveBeenCalled();
      const callArgs = vi.mocked(mockFeatureMgr.FeatureExtrusion2).mock.calls[0];
      expect(callArgs[1]).toBe(1); // Flip should be 1 when reverse is true
    });

    it('should pass correct depth parameter', () => {
      const depth = 0.05;
      tryFeatureExtrusion2(mockFeatureMgr, depth, false);
      const callArgs = vi.mocked(mockFeatureMgr.FeatureExtrusion2).mock.calls[0];
      expect(callArgs[5]).toBe(depth); // D1 should be the depth
    });

    it('should throw error when FeatureExtrusion2 fails', () => {
      (mockFeatureMgr.FeatureExtrusion2 as any).mockImplementation(() => {
        throw new Error('FeatureExtrusion2 failed');
      });
      
      expect(() => {
        tryFeatureExtrusion2(mockFeatureMgr, 0.025, false);
      }).toThrow('FeatureExtrusion2 failed');
    });
  });

  describe('tryFeatureExtrusion', () => {
    it('should create extrusion using FeatureExtrusion', () => {
      const feature = tryFeatureExtrusion(mockFeatureMgr, 0.025, false);
      expect(feature).toBe(mockFeature);
      expect(mockFeatureMgr.FeatureExtrusion).toHaveBeenCalled();
    });

    it('should handle reverse direction', () => {
      const feature = tryFeatureExtrusion(mockFeatureMgr, 0.025, true);
      expect(feature).toBe(mockFeature);
      expect(mockFeatureMgr.FeatureExtrusion).toHaveBeenCalled();
      const callArgs = vi.mocked(mockFeatureMgr.FeatureExtrusion).mock.calls[0];
      expect(callArgs[1]).toBe(1); // Flip should be 1 when reverse is true
    });

    it('should pass correct depth parameter', () => {
      const depth = 0.05;
      tryFeatureExtrusion(mockFeatureMgr, depth, false);
      const callArgs = vi.mocked(mockFeatureMgr.FeatureExtrusion).mock.calls[0];
      expect(callArgs[6]).toBe(depth); // D1 should be the depth
    });

    it('should throw error when FeatureExtrusion fails', () => {
      (mockFeatureMgr.FeatureExtrusion as any).mockImplementation(() => {
        throw new Error('FeatureExtrusion failed');
      });
      
      expect(() => {
        tryFeatureExtrusion(mockFeatureMgr, 0.025, false);
      }).toThrow('FeatureExtrusion failed');
    });
  });

  describe('generateVBAFallbackMacro', () => {
    it('should generate VBA macro file', () => {
      const macroPath = generateVBAFallbackMacro(25, false);
      expect(macroPath).toBeDefined();
      expect(typeof macroPath).toBe('string');
    });

    it('should handle reverse direction', () => {
      const macroPath = generateVBAFallbackMacro(25, true);
      expect(macroPath).toBeDefined();
    });

    it('should handle different depth values', () => {
      const macroPath1 = generateVBAFallbackMacro(10, false);
      const macroPath2 = generateVBAFallbackMacro(100, false);
      expect(macroPath1).toBeDefined();
      expect(macroPath2).toBeDefined();
    });

    it('should handle zero depth', () => {
      const macroPath = generateVBAFallbackMacro(0, false);
      expect(macroPath).toBeDefined();
    });

    it('should handle negative depth', () => {
      const macroPath = generateVBAFallbackMacro(-10, false);
      expect(macroPath).toBeDefined();
    });

    it('should generate unique file paths for different calls', () => {
      const macroPath1 = generateVBAFallbackMacro(25, false);
      // Wait a bit to ensure different timestamp
      const macroPath2 = generateVBAFallbackMacro(25, false);
      expect(macroPath1).toBeDefined();
      expect(macroPath2).toBeDefined();
      // Paths should be different due to timestamp
      expect(macroPath1).not.toBe(macroPath2);
    });
  });

  describe('finalizeExtrusion', () => {
    it('should return feature info', () => {
      const result = finalizeExtrusion(mockModel, mockFeature);
      expect(result).toBeDefined();
      expect(result.name).toBe('Extrude1');
    });

    it('should throw error when feature is null', () => {
      expect(() => {
        finalizeExtrusion(mockModel, null);
      }).toThrow('Failed to create extrusion - feature is null');
    });

    it('should use GetName when Name is not available', () => {
      const featureWithoutName = {
        GetName: vi.fn().mockReturnValue('Extrude2'),
      };
      const result = finalizeExtrusion(mockModel, featureWithoutName);
      expect(result.name).toBe('Extrude2');
    });

    it('should use default name when both Name and GetName fail', () => {
      const featureWithoutName = {};
      (mockModel.EditRebuild3 as any) = vi.fn();
      const result = finalizeExtrusion(mockModel, featureWithoutName);
      expect(result.name).toBe('Boss-Extrude1');
    });

    it('should handle EditRebuild3', () => {
      (mockModel.EditRebuild3 as any) = vi.fn();
      const result = finalizeExtrusion(mockModel, mockFeature);
      expect(mockModel.EditRebuild3).toHaveBeenCalled();
    });

    it('should fallback to EditRebuild when EditRebuild3 fails', () => {
      (mockModel.EditRebuild3 as any) = vi.fn().mockImplementation(() => {
        throw new Error('EditRebuild3 failed');
      });
      (mockModel.EditRebuild as any) = vi.fn();
      const result = finalizeExtrusion(mockModel, mockFeature);
      expect(mockModel.EditRebuild).toHaveBeenCalled();
    });

    it('should handle null model gracefully', () => {
      const result = finalizeExtrusion(null, mockFeature);
      expect(result.name).toBe('Extrude1');
    });

    it('should return correct feature structure', () => {
      const result = finalizeExtrusion(mockModel, mockFeature);
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('suppressed');
      expect(result.type).toBe('Extrusion');
      expect(result.suppressed).toBe(false);
    });

    it('should handle ClearSelection2 errors gracefully', () => {
      (mockModel.ClearSelection2 as any).mockImplementation(() => {
        throw new Error('ClearSelection2 failed');
      });
      
      const result = finalizeExtrusion(mockModel, mockFeature);
      expect(result.name).toBe('Extrude1');
    });

    it('should handle both EditRebuild3 and EditRebuild failing', () => {
      (mockModel.EditRebuild3 as any) = vi.fn().mockImplementation(() => {
        throw new Error('EditRebuild3 failed');
      });
      (mockModel.EditRebuild as any) = vi.fn().mockImplementation(() => {
        throw new Error('EditRebuild failed');
      });
      
      const result = finalizeExtrusion(mockModel, mockFeature);
      expect(result.name).toBe('Extrude1');
    });

    it('should handle GetName throwing error', () => {
      const featureWithFailingGetName = {
        GetName: vi.fn().mockImplementation(() => {
          throw new Error('GetName failed');
        }),
      };
      
      const result = finalizeExtrusion(mockModel, featureWithFailingGetName);
      expect(result.name).toBe('Boss-Extrude1');
    });

    it('should handle feature without Select2 method', () => {
      const featureWithoutSelect2 = {
        Name: 'Extrude3',
      };
      
      const result = finalizeExtrusion(mockModel, featureWithoutSelect2);
      expect(result.name).toBe('Extrude3');
    });
  });
});

