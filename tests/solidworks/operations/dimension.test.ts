/**
 * Unit tests for Dimension Operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DimensionOperations } from '../../../src/solidworks/operations/dimension.js';
import { IModelDoc2, ISldWorksApp } from '../../../src/solidworks/types/com-types.js';

describe('DimensionOperations', () => {
  let mockSwApp: ISldWorksApp;
  let mockModel: IModelDoc2;

  beforeEach(() => {
    mockSwApp = {} as ISldWorksApp;
    mockModel = {
      Parameter: vi.fn(),
      GetParameter: vi.fn(),
      Extension: {
        GetParameter: vi.fn(),
        SelectByID2: vi.fn(),
      },
      SelectionManager: {
        GetSelectedObjectCount2: vi.fn().mockReturnValue(0),
        GetSelectedObject6: vi.fn(),
      },
      ClearSelection2: vi.fn(),
      EditRebuild3: vi.fn(),
      FeatureByName: vi.fn(),
    } as any;
  });

  describe('getDimension', () => {
    it('should throw error when no model is provided', () => {
      expect(() => {
        DimensionOperations.getDimension(mockSwApp, null, 'D1@Sketch1');
      }).toThrow('No model open');
    });

    it('should get dimension using Parameter method', () => {
      const mockDimension = {
        SystemValue: 0.025, // 25mm in meters
      };
      (mockModel.Parameter as any).mockReturnValue(mockDimension);

      const result = DimensionOperations.getDimension(mockSwApp, mockModel, 'D1@Sketch1');
      expect(result).toBe(25); // Should convert from meters to mm
      expect(mockModel.Parameter).toHaveBeenCalledWith('D1@Sketch1');
    });

    it('should get dimension using GetParameter method', () => {
      const mockDimension = {
        Value: 0.05,
      };
      (mockModel.GetParameter as any).mockReturnValue(mockDimension);
      (mockModel.Parameter as any).mockReturnValue(null);

      const result = DimensionOperations.getDimension(mockSwApp, mockModel, 'D1@Sketch1');
      expect(result).toBe(50);
    });

    it('should get dimension using Extension.GetParameter', () => {
      const mockDimension = {
        GetSystemValue: () => 0.1,
      };
      (mockModel.Extension.GetParameter as any).mockReturnValue(mockDimension);
      (mockModel.Parameter as any).mockReturnValue(null);
      (mockModel.GetParameter as any).mockReturnValue(null);

      const result = DimensionOperations.getDimension(mockSwApp, mockModel, 'D1@Sketch1');
      expect(result).toBe(100);
    });

    it('should throw error when dimension not found', () => {
      (mockModel.Parameter as any).mockReturnValue(null);
      (mockModel.GetParameter as any).mockReturnValue(null);
      (mockModel.Extension.GetParameter as any).mockReturnValue(null);
      (mockModel.Extension.SelectByID2 as any).mockReturnValue(false);

      expect(() => {
        DimensionOperations.getDimension(mockSwApp, mockModel, 'NonExistent');
      }).toThrow('Dimension "NonExistent" not found');
    });
  });

  describe('setDimension', () => {
    it('should throw error when no model is provided', () => {
      expect(() => {
        DimensionOperations.setDimension(mockSwApp, null, 'D1@Sketch1', 50);
      }).toThrow('No model open');
    });

    it('should set dimension using SystemValue property', () => {
      const mockDimension = {
        SystemValue: 0.025,
      };
      (mockModel.Parameter as any).mockReturnValue(mockDimension);

      DimensionOperations.setDimension(mockSwApp, mockModel, 'D1@Sketch1', 50);
      expect(mockDimension.SystemValue).toBe(0.05); // 50mm in meters
      expect(mockModel.EditRebuild3).toHaveBeenCalled();
    });

    it('should set dimension using Value property', () => {
      const mockDimension = {
        Value: 0.025,
      };
      (mockModel.Parameter as any).mockReturnValue(mockDimension);
      delete (mockDimension as any).SystemValue;

      DimensionOperations.setDimension(mockSwApp, mockModel, 'D1@Sketch1', 50);
      expect(mockDimension.Value).toBe(0.05);
    });

    it('should set dimension using SetSystemValue method', () => {
      const mockDimension = {
        SetSystemValue: vi.fn().mockReturnValue(true),
      };
      (mockModel.Parameter as any).mockReturnValue(mockDimension);

      DimensionOperations.setDimension(mockSwApp, mockModel, 'D1@Sketch1', 50);
      expect(mockDimension.SetSystemValue).toHaveBeenCalledWith(0.05);
    });

    it('should throw error when dimension not found', () => {
      (mockModel.Parameter as any).mockReturnValue(null);
      (mockModel.GetParameter as any).mockReturnValue(null);
      (mockModel.Extension.GetParameter as any).mockReturnValue(null);
      (mockModel.Extension.SelectByID2 as any).mockReturnValue(false);

      expect(() => {
        DimensionOperations.setDimension(mockSwApp, mockModel, 'NonExistent', 50);
      }).toThrow('Dimension "NonExistent" not found');
    });

    it('should get dimension using feature search', () => {
      const mockFeature = {
        GetFirstDisplayDimension: vi.fn().mockReturnValue({
          GetDimension2: vi.fn().mockReturnValue({
            FullName: 'D1@Sketch1',
            SystemValue: 0.025,
          }),
        }),
      };
      (mockModel.Parameter as any).mockReturnValue(null);
      (mockModel.GetParameter as any).mockReturnValue(null);
      (mockModel.Extension.GetParameter as any).mockReturnValue(null);
      (mockModel.FeatureByName as any) = vi.fn().mockReturnValue(mockFeature);

      const result = DimensionOperations.getDimension(mockSwApp, mockModel, 'D1@Sketch1');
      expect(result).toBe(25);
    });

    it('should get dimension using SelectByID2', () => {
      const mockDimension = {
        SystemValue: 0.03,
      };
      (mockModel.Parameter as any).mockReturnValue(null);
      (mockModel.GetParameter as any).mockReturnValue(null);
      (mockModel.Extension.GetParameter as any).mockReturnValue(null);
      (mockModel.Extension.SelectByID2 as any).mockReturnValue(true);
      (mockModel.SelectionManager.GetSelectedObjectCount2 as any).mockReturnValue(1);
      (mockModel.SelectionManager.GetSelectedObject6 as any).mockReturnValue(mockDimension);

      const result = DimensionOperations.getDimension(mockSwApp, mockModel, 'D1');
      expect(result).toBe(30);
    });

    it('should set dimension using SetValue method', () => {
      const mockDimension = {
        SetValue: vi.fn().mockReturnValue(true),
      };
      (mockModel.Parameter as any).mockReturnValue(mockDimension);
      delete (mockDimension as any).SystemValue;
      delete (mockDimension as any).Value;
      delete (mockDimension as any).SetSystemValue;

      DimensionOperations.setDimension(mockSwApp, mockModel, 'D1@Sketch1', 50);
      expect(mockDimension.SetValue).toHaveBeenCalledWith(0.05);
    });


    it('should handle dimension value reading errors', () => {
      const mockDimension = {};
      (mockModel.Parameter as any).mockReturnValue(mockDimension);

      expect(() => {
        DimensionOperations.getDimension(mockSwApp, mockModel, 'D1@Sketch1');
      }).toThrow('Cannot read value of dimension');
    });

    it('should handle dimension setting errors', () => {
      const mockDimension = {};
      (mockModel.Parameter as any).mockReturnValue(mockDimension);
      (mockModel.GetEquationMgr as any) = vi.fn().mockReturnValue(null);

      expect(() => {
        DimensionOperations.setDimension(mockSwApp, mockModel, 'D1@Sketch1', 50);
      }).toThrow('Failed to set dimension');
    });
  });
});

