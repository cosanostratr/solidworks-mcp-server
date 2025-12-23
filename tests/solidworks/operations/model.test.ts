/**
 * Unit tests for Model Operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelOperations } from '../../../src/solidworks/operations/model.js';
import { ISldWorksApp, IModelDoc2 } from '../../../src/solidworks/types/com-types.js';

describe('ModelOperations', () => {
  let mockSwApp: ISldWorksApp;
  let mockModel: IModelDoc2;

  beforeEach(() => {
    mockModel = {
      GetTitle: vi.fn().mockReturnValue('TestModel'),
      GetPathName: vi.fn().mockReturnValue('C:\\test\\model.SLDPRT'),
      GetType: vi.fn().mockReturnValue(1),
      Save: vi.fn().mockReturnValue(true),
      SaveAs3: vi.fn().mockReturnValue(true),
    } as any;

    mockSwApp = {
      OpenDoc6: vi.fn().mockReturnValue(mockModel),
      OpenDoc5: vi.fn().mockReturnValue(mockModel),
      NewDocument: vi.fn().mockReturnValue(mockModel),
      NewPart: vi.fn().mockReturnValue(mockModel),
      GetUserPreferenceStringValue: vi.fn().mockReturnValue('template.prtdot'),
      CloseDoc: vi.fn().mockReturnValue(true),
      ActivateDoc: vi.fn().mockReturnValue(true),
      ActivateDoc2: vi.fn().mockReturnValue(true),
    } as any;
  });

  describe('openModel', () => {
    it('should throw error when not connected', () => {
      expect(() => {
        ModelOperations.openModel(null, 'C:\\test\\model.SLDPRT');
      }).toThrow('Not connected to SolidWorks');
    });

    it('should open part file', () => {
      const result = ModelOperations.openModel(mockSwApp, 'C:\\test\\model.SLDPRT');
      
      expect(result).toBeDefined();
      expect(result.info).toBeDefined();
      expect(mockSwApp.OpenDoc6).toHaveBeenCalled();
    });

    it('should open assembly file', () => {
      const result = ModelOperations.openModel(mockSwApp, 'C:\\test\\model.SLDASM');
      
      expect(mockSwApp.OpenDoc6).toHaveBeenCalled();
    });

    it('should open drawing file', () => {
      const result = ModelOperations.openModel(mockSwApp, 'C:\\test\\model.SLDDRW');
      
      expect(mockSwApp.OpenDoc6).toHaveBeenCalled();
    });

    it('should fallback to OpenDoc5 if OpenDoc6 fails', () => {
      (mockSwApp.OpenDoc6 as any).mockImplementation(() => {
        throw new Error('OpenDoc6 failed');
      });

      const result = ModelOperations.openModel(mockSwApp, 'C:\\test\\model.SLDPRT');
      
      expect(mockSwApp.OpenDoc5).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('closeModel', () => {
    it('should close model without saving', () => {
      ModelOperations.closeModel(mockSwApp, mockModel, false);
      
      expect(mockSwApp.CloseDoc).toHaveBeenCalled();
    });

    it('should save model before closing', () => {
      ModelOperations.closeModel(mockSwApp, mockModel, true);
      
      expect(mockModel.Save).toHaveBeenCalled();
      expect(mockSwApp.CloseDoc).toHaveBeenCalled();
    });

    it('should handle null model gracefully', () => {
      expect(() => {
        ModelOperations.closeModel(mockSwApp, null, false);
      }).not.toThrow();
    });
  });

  describe('createPart', () => {
    it('should throw error when not connected', () => {
      expect(() => {
        ModelOperations.createPart(null);
      }).toThrow('Not connected to SolidWorks');
    });

    it('should create new part', () => {
      const result = ModelOperations.createPart(mockSwApp);
      
      expect(result).toBeDefined();
      expect(result.info).toBeDefined();
      // createPart uses NewPart() first, then falls back to NewDocument
      expect(mockSwApp.NewPart).toHaveBeenCalled();
    });

    it('should fallback to alternative template path', () => {
      (mockSwApp.NewDocument as any).mockImplementation((template: string) => {
        if (template.includes('Part')) {
          throw new Error('Template not found');
        }
        return mockModel;
      });

      const result = ModelOperations.createPart(mockSwApp);
      expect(result).toBeDefined();
    });
  });

  describe('createPart', () => {
    it('should use NewPart method first', () => {
      (mockSwApp.NewPart as any) = vi.fn().mockReturnValue(mockModel);
      
      const result = ModelOperations.createPart(mockSwApp);
      
      expect(mockSwApp.NewPart).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should fallback to NewDocument if NewPart fails', () => {
      (mockSwApp.NewPart as any) = vi.fn().mockReturnValue(null);
      (mockSwApp.GetUserPreferenceStringValue as any) = vi.fn().mockReturnValue('template.prtdot');
      (mockSwApp.NewDocument as any).mockReturnValue(mockModel);
      
      const result = ModelOperations.createPart(mockSwApp);
      
      expect(mockSwApp.NewDocument).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});

