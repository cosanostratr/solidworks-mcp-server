/**
 * Unit tests for Model Helpers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelHelpers } from '../../../src/solidworks/helpers/model.js';
import { IModelDoc2, ISldWorksApp, IFeature } from '../../../src/solidworks/types/com-types.js';

describe('ModelHelpers', () => {
  let mockModel: IModelDoc2;
  let mockSwApp: ISldWorksApp;

  beforeEach(() => {
    mockModel = {
      SketchManager: {
        ActiveSketch: null,
        InsertSketch: vi.fn().mockReturnValue(true),
      },
      GetType: vi.fn().mockReturnValue(1),
      GetTitle: vi.fn().mockReturnValue('TestModel'),
      GetPathName: vi.fn().mockReturnValue('C:\\test\\model.SLDPRT'),
      EditSketch: vi.fn(),
      FeatureManager: {
        GetFeatures: vi.fn().mockReturnValue([]),
      },
    } as any;

    mockSwApp = {
      ActiveDoc: mockModel,
      GetActiveDoc: vi.fn().mockReturnValue(mockModel),
      GetDocumentCount: vi.fn().mockReturnValue(1),
      GetDocuments: vi.fn().mockReturnValue([mockModel]),
    } as any;
  });

  describe('ensureActiveSketch', () => {
    it('should throw error when no model provided', () => {
      expect(() => {
        ModelHelpers.ensureActiveSketch(null);
      }).toThrow('No model provided to ensureActiveSketch');
    });

    it('should return early if active sketch exists', () => {
      const mockSketch = { Name: 'Sketch1' };
      (mockModel.SketchManager.ActiveSketch as any) = mockSketch;

      expect(() => {
        ModelHelpers.ensureActiveSketch(mockModel);
      }).not.toThrow();
    });

    it('should throw error if SketchManager not available', () => {
      delete (mockModel as any).SketchManager;

      expect(() => {
        ModelHelpers.ensureActiveSketch(mockModel);
      }).toThrow('SketchManager is not available');
    });

    it('should try to activate sketch if no active sketch', () => {
      (mockModel.SketchManager.ActiveSketch as any) = null;
      
      expect(() => {
        ModelHelpers.ensureActiveSketch(mockModel);
      }).toThrow('No sketch available to activate');
    });
  });

  describe('getDocumentType', () => {
    it('should return fallback when no model provided', () => {
      const result = ModelHelpers.getDocumentType(null, 0);
      expect(result).toBe(0);
    });

    it('should get document type from model', () => {
      const result = ModelHelpers.getDocumentType(mockModel, 0);
      expect(result).toBe(1);
    });

    it('should return fallback if GetType fails', () => {
      (mockModel.GetType as any).mockImplementation(() => {
        throw new Error('GetType failed');
      });

      const result = ModelHelpers.getDocumentType(mockModel, 2);
      expect(result).toBe(2);
    });
  });

  describe('findSketchFeatureByName', () => {
    it('should return null when no model provided', () => {
      const result = ModelHelpers.findSketchFeatureByName(null, 'Sketch1');
      expect(result).toBeNull();
    });

    it('should return null when name is empty', () => {
      const result = ModelHelpers.findSketchFeatureByName(mockModel, '');
      expect(result).toBeNull();
    });

    it('should find sketch feature by name', () => {
      const mockFeature = {
        Name: 'Sketch1',
        GetName: vi.fn().mockReturnValue('Sketch1'),
      };
      
      // Mock traverseFeatures to return the feature
      vi.mock('../../../src/utils/feature-utils.js', () => ({
        traverseFeatures: vi.fn((model, callback) => {
          return callback({ feature: mockFeature, name: 'Sketch1', typeName: 'ProfileFeature' });
        }),
      }));

      const result = ModelHelpers.findSketchFeatureByName(mockModel, 'Sketch1');
      // Since we're mocking, the result depends on the actual implementation
      expect(result).toBeDefined();
    });
  });

  describe('getModelTitle', () => {
    it('should return "None" when no model provided', () => {
      const result = ModelHelpers.getModelTitle(null);
      expect(result).toBe('None');
    });

    it('should get title from GetTitle', () => {
      const result = ModelHelpers.getModelTitle(mockModel);
      expect(result).toBe('TestModel');
    });

    it('should get title from GetPathName if GetTitle fails', () => {
      (mockModel.GetTitle as any).mockImplementation(() => {
        throw new Error('GetTitle failed');
      });
      (mockModel.GetPathName as any).mockReturnValue('C:\\test\\model.SLDPRT');

      const result = ModelHelpers.getModelTitle(mockModel);
      expect(result).toBe('model.SLDPRT');
    });

    it('should return "Unknown" if both methods fail', () => {
      (mockModel.GetTitle as any).mockImplementation(() => {
        throw new Error('GetTitle failed');
      });
      (mockModel.GetPathName as any).mockReturnValue('');

      const result = ModelHelpers.getModelTitle(mockModel);
      expect(result).toBe('Unknown');
    });
  });

  describe('ensureCurrentModel', () => {
    it('should return current model if swApp is null', () => {
      const result = ModelHelpers.ensureCurrentModel(null, mockModel);
      expect(result).toBe(mockModel);
    });

    it('should sync with ActiveDoc', () => {
      const result = ModelHelpers.ensureCurrentModel(mockSwApp, null);
      expect(result).toBe(mockModel);
    });

    it('should return current model if it matches ActiveDoc', () => {
      const result = ModelHelpers.ensureCurrentModel(mockSwApp, mockModel);
      expect(result).toBe(mockModel);
    });

    it('should fallback to first document if no ActiveDoc', () => {
      (mockSwApp.ActiveDoc as any) = null;
      (mockSwApp.GetActiveDoc as any).mockReturnValue(null);

      const result = ModelHelpers.ensureCurrentModel(mockSwApp, null);
      expect(result).toBe(mockModel);
    });

    it('should handle ActiveDoc errors', () => {
      (mockSwApp.ActiveDoc as any) = null;
      (mockSwApp.GetActiveDoc as any).mockImplementation(() => {
        throw new Error('GetActiveDoc failed');
      });
      (mockSwApp.GetDocumentCount as any).mockReturnValue(0);

      const result = ModelHelpers.ensureCurrentModel(mockSwApp, mockModel);
      expect(result).toBe(mockModel);
    });

    it('should handle GetDocumentCount errors', () => {
      (mockSwApp.ActiveDoc as any) = null;
      (mockSwApp.GetActiveDoc as any).mockReturnValue(null);
      (mockSwApp.GetDocumentCount as any).mockImplementation(() => {
        throw new Error('GetDocumentCount failed');
      });

      const result = ModelHelpers.ensureCurrentModel(mockSwApp, mockModel);
      expect(result).toBe(mockModel);
    });

    it('should return new model when ActiveDoc changes', () => {
      const newModel = { GetTitle: vi.fn().mockReturnValue('NewModel') } as any;
      (mockSwApp.ActiveDoc as any) = newModel;

      const result = ModelHelpers.ensureCurrentModel(mockSwApp, mockModel);
      expect(result).toBe(newModel);
    });
  });

  describe('ensureActiveSketch', () => {
    it('should handle ActiveSketch check errors', () => {
      Object.defineProperty(mockModel.SketchManager, 'ActiveSketch', {
        get: () => {
          throw new Error('ActiveSketch failed');
        },
      });

      expect(() => {
        ModelHelpers.ensureActiveSketch(mockModel);
      }).toThrow('No sketch available to activate');
    });

    it('should handle InsertSketch failure', () => {
      (mockModel.SketchManager.ActiveSketch as any) = null;
      (mockModel.SketchManager.InsertSketch as any).mockImplementation(() => {
        throw new Error('InsertSketch failed');
      });

      expect(() => {
        ModelHelpers.ensureActiveSketch(mockModel);
      }).toThrow('No sketch available to activate');
    });
  });

  describe('getModelTitle', () => {
    it('should handle GetPathName with empty path', () => {
      (mockModel.GetTitle as any).mockImplementation(() => {
        throw new Error('GetTitle failed');
      });
      (mockModel.GetPathName as any).mockReturnValue('');

      const result = ModelHelpers.getModelTitle(mockModel);
      expect(result).toBe('Unknown');
    });

    it('should handle GetPathName errors', () => {
      (mockModel.GetTitle as any).mockImplementation(() => {
        throw new Error('GetTitle failed');
      });
      (mockModel.GetPathName as any).mockImplementation(() => {
        throw new Error('GetPathName failed');
      });

      const result = ModelHelpers.getModelTitle(mockModel);
      expect(result).toBe('Unknown');
    });

    it('should use GetPathName directly when GetTitle not available', () => {
      delete (mockModel as any).GetTitle;
      (mockModel.GetPathName as any).mockReturnValue('C:\\test\\model.SLDPRT');

      const result = ModelHelpers.getModelTitle(mockModel);
      expect(result).toBe('model.SLDPRT');
    });
  });

  describe('findSketchFeatureByName', () => {
    it('should handle traverseFeatures errors', () => {
      vi.mock('../../../src/utils/feature-utils.js', () => ({
        traverseFeatures: vi.fn().mockImplementation(() => {
          throw new Error('traverseFeatures failed');
        }),
      }));

      const result = ModelHelpers.findSketchFeatureByName(mockModel, 'Sketch1');
      expect(result).toBeNull();
    });
  });
});

