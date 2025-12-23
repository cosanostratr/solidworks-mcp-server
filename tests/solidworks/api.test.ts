/**
 * Unit tests for SolidWorks API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SolidWorksAPI } from '../../src/solidworks/api.js';
import { ConnectionManager } from '../../src/solidworks/operations/connection.js';
import { ISldWorksApp, IModelDoc2 } from '../../src/solidworks/types/com-types.js';

// Mock the connection manager
vi.mock('../../src/solidworks/operations/connection.js', () => ({
  ConnectionManager: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    getApp: vi.fn().mockReturnValue(null),
  })),
}));

describe('SolidWorksAPI', () => {
  let api: SolidWorksAPI;
  let mockSwApp: ISldWorksApp;
  let mockModel: IModelDoc2;
  let mockConnectionMgr: any;

  beforeEach(() => {
    mockModel = {
      GetTitle: vi.fn().mockReturnValue('TestModel'),
      GetPathName: vi.fn().mockReturnValue('C:\\test\\model.SLDPRT'),
      GetType: vi.fn().mockReturnValue(1),
      FeatureManager: {
        FeatureExtrusion3: vi.fn(),
      },
      SketchManager: {
        ActiveSketch: null,
      },
      ClearSelection2: vi.fn(),
    } as any;

    mockSwApp = {
      OpenDoc6: vi.fn().mockReturnValue(mockModel),
      NewPart: vi.fn().mockReturnValue(mockModel),
      CloseDoc: vi.fn(),
    } as any;

    mockConnectionMgr = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
      getApp: vi.fn().mockReturnValue(mockSwApp),
    };

    // Mock ConnectionManager constructor
    (ConnectionManager as any).mockImplementation(() => mockConnectionMgr);

    api = new SolidWorksAPI();
  });

  describe('constructor', () => {
    it('should initialize connection manager and current model', () => {
      expect(api).toBeDefined();
      expect(ConnectionManager).toHaveBeenCalled();
    });
  });

  describe('connect', () => {
    it('should call connection manager connect', () => {
      api.connect();
      expect(mockConnectionMgr.connect).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect and clear current model', () => {
      (api as any).currentModel = mockModel;
      api.disconnect();
      expect(mockConnectionMgr.disconnect).toHaveBeenCalled();
      expect((api as any).currentModel).toBeNull();
    });
  });

  describe('isConnected', () => {
    it('should return connection status', () => {
      mockConnectionMgr.isConnected.mockReturnValue(true);
      expect(api.isConnected()).toBe(true);
      
      mockConnectionMgr.isConnected.mockReturnValue(false);
      expect(api.isConnected()).toBe(false);
    });
  });

  describe('openModel', () => {
    it('should open model and set as current', () => {
      const result = api.openModel('C:\\test\\model.SLDPRT');
      expect(result).toBeDefined();
      expect(result.name).toBe('TestModel');
      expect((api as any).currentModel).toBe(mockModel);
    });

    it('should throw error when not connected', () => {
      mockConnectionMgr.getApp.mockReturnValue(null);
      expect(() => {
        api.openModel('C:\\test\\model.SLDPRT');
      }).toThrow('Not connected to SolidWorks');
    });
  });

  describe('closeModel', () => {
    it('should close model without saving', () => {
      (api as any).currentModel = mockModel;
      api.closeModel(false);
      expect((api as any).currentModel).toBeNull();
    });

    it('should close model with saving', () => {
      (api as any).currentModel = mockModel;
      (mockModel as any).Save3 = vi.fn();
      api.closeModel(true);
      expect((api as any).currentModel).toBeNull();
    });
  });

  describe('createPart', () => {
    it('should create new part', () => {
      const result = api.createPart();
      expect(result).toBeDefined();
      expect(result.type).toBe('Part');
      expect((api as any).currentModel).toBe(mockModel);
    });

    it('should throw error when not connected', () => {
      mockConnectionMgr.getApp.mockReturnValue(null);
      expect(() => {
        api.createPart();
      }).toThrow('Not connected to SolidWorks');
    });
  });

  describe('getApp', () => {
    it('should return app from connection manager', () => {
      const app = api.getApp();
      expect(app).toBe(mockSwApp);
    });
  });

  describe('getCurrentModel', () => {
    it('should return current model', () => {
      (api as any).currentModel = mockModel;
      const model = api.getCurrentModel();
      expect(model).toBe(mockModel);
    });

    it('should ensure current model is synced', () => {
      (api as any).currentModel = null;
      mockConnectionMgr.getApp.mockReturnValue(mockSwApp);
      (mockSwApp as any).ActiveDoc = mockModel;
      const model = api.getCurrentModel();
      expect(model).toBe(mockModel);
    });
  });

  describe('ensureActiveSketch', () => {
    it('should delegate to ModelHelpers', () => {
      const mockSketch = { Name: 'Sketch1' };
      (mockModel.SketchManager as any).ActiveSketch = mockSketch;
      expect(() => {
        api.ensureActiveSketch(mockModel);
      }).not.toThrow();
    });
  });

  describe('getDocumentType', () => {
    it('should return document type', () => {
      const type = api.getDocumentType(mockModel, 0);
      expect(type).toBe(1);
    });
  });

  describe('findSketchFeatureByName', () => {
    it('should find sketch feature by name', () => {
      const result = api.findSketchFeatureByName(mockModel, 'Sketch1');
      expect(result).toBeDefined();
    });
  });

  describe('createExtrude', () => {
    beforeEach(() => {
      (api as any).currentModel = mockModel;
      const mockFeature = {
        Name: 'Extrude1',
        GetName: vi.fn().mockReturnValue('Extrude1'),
      };
      (mockModel.FeatureManager as any) = {
        FeatureExtrusion3: vi.fn().mockReturnValue(mockFeature),
        FeatureExtrusion2: vi.fn().mockReturnValue(mockFeature),
        FeatureExtrusion: vi.fn().mockReturnValue(mockFeature),
      };
      (mockModel.ClearSelection2 as any) = vi.fn();
      (mockModel.EditRebuild3 as any) = vi.fn();
      (mockModel.EditRebuild as any) = vi.fn();
      (mockModel.FeatureByPositionReverse as any) = vi.fn().mockReturnValue({
        Name: 'Sketch1',
        Select2: vi.fn().mockReturnValue(true),
      });
      (mockModel.Extension as any) = {
        SelectByID2: vi.fn().mockReturnValue(true),
      };
      (mockModel.SketchManager as any) = {
        ActiveSketch: null,
        InsertSketch: vi.fn(),
      };
    });

    it('should throw error when no model open', () => {
      (api as any).currentModel = null;
      expect(() => {
        api.createExtrude(25);
      }).toThrow('No model open');
    });

    it('should throw error when FeatureManager not available', () => {
      delete (mockModel as any).FeatureManager;
      expect(() => {
        api.createExtrude(25);
      }).toThrow('Cannot access FeatureManager');
    });
  });

  describe('extrude', () => {
    beforeEach(() => {
      (api as any).currentModel = mockModel;
      vi.spyOn(api, 'createExtrude').mockReturnValue({
        name: 'Extrude1',
        type: 'Extrusion',
        suppressed: false,
      });
    });

    it('should create extrusion with default params', () => {
      const result = api.extrude({});
      expect(result.success).toBe(true);
      expect(result.featureId).toBe('Extrude1');
    });

    it('should create extrusion with custom params', () => {
      const result = api.extrude({ depth: 50, reverse: true, draft: 5 });
      expect(result.success).toBe(true);
    });

    it('should throw error when no model', () => {
      (api as any).currentModel = null;
      expect(() => {
        api.extrude({});
      }).toThrow('No active model');
    });
  });

  describe('createSketch', () => {
    beforeEach(() => {
      (api as any).currentModel = mockModel;
    });

    it('should create sketch', () => {
      const result = api.createSketch({ plane: 'Front' });
      expect(result).toBeDefined();
    });
  });

  describe('addLine', () => {
    beforeEach(() => {
      (api as any).currentModel = mockModel;
      (mockModel.SketchManager as any) = {
        CreateLine: vi.fn().mockReturnValue({ Name: 'Line1' }),
      };
    });

    it('should add line', () => {
      const result = api.addLine({ start: [0, 0], end: [10, 10] });
      expect(result).toBeDefined();
    });

    it('should throw error when no model', () => {
      (api as any).currentModel = null;
      expect(() => {
        api.addLine({ start: [0, 0], end: [10, 10] });
      }).toThrow('No active model');
    });
  });

  describe('selectSketchEntity', () => {
    beforeEach(() => {
      (api as any).currentModel = mockModel;
      (mockModel.Extension as any) = {
        SelectByID2: vi.fn().mockReturnValue(true),
      };
      (mockModel.SketchManager as any) = {
        ActiveSketch: {
          GetSketchSegments: vi.fn().mockReturnValue([{ Name: 'Line1' }]),
          GetSketchSegmentCount: vi.fn().mockReturnValue(1),
        },
      };
    });

    it('should select last sketch segment', () => {
      const result = api.selectSketchEntity('last', false);
      expect(result).toBe(true);
    });

    it('should select standard plane', () => {
      vi.spyOn(api, 'selectStandardPlane').mockReturnValue(true);
      const result = api.selectSketchEntity('Front', false);
      expect(result).toBe(true);
    });

    it('should return false when spec is empty', () => {
      const result = api.selectSketchEntity('', false);
      expect(result).toBe(false);
    });

    it('should throw error when no model', () => {
      (api as any).currentModel = null;
      mockConnectionMgr.getApp.mockReturnValue(null);
      expect(() => {
        api.selectSketchEntity('last', false);
      }).toThrow('No model open');
    });
  });

  describe('selectSketchEntities', () => {
    beforeEach(() => {
      (api as any).currentModel = mockModel;
      (mockModel.ClearSelection2 as any) = vi.fn();
      vi.spyOn(api, 'selectSketchEntity').mockReturnValue(true);
    });

    it('should select multiple entities', () => {
      const result = api.selectSketchEntities(['Line1', 'Line2']);
      expect(result).toBe(true);
      expect(api.selectSketchEntity).toHaveBeenCalledTimes(2);
    });

    it('should select single entity from string', () => {
      const result = api.selectSketchEntities('Line1');
      expect(result).toBe(true);
    });

    it('should handle empty names', () => {
      const result = api.selectSketchEntities(['Line1', '', 'Line2']);
      expect(api.selectSketchEntity).toHaveBeenCalledTimes(2);
    });

    it('should throw error when no model', () => {
      (api as any).currentModel = null;
      expect(() => {
        api.selectSketchEntities('Line1');
      }).toThrow('No model open');
    });
  });

  describe('getSketchContext', () => {
    beforeEach(() => {
      (api as any).currentModel = mockModel;
    });

    it('should get sketch context', () => {
      const result = api.getSketchContext();
      expect(result).toBeDefined();
    });
  });

  describe('selectStandardPlane', () => {
    beforeEach(() => {
      (api as any).currentModel = mockModel;
    });

    it('should select front plane', () => {
      const result = api.selectStandardPlane('Front');
      expect(result).toBeDefined();
    });

    it('should return false when no model', () => {
      (api as any).currentModel = null;
      const result = api.selectStandardPlane('Front');
      expect(result).toBe(false);
    });
  });

  describe('getDimension', () => {
    beforeEach(() => {
      (api as any).currentModel = mockModel;
      const mockDimension = {
        SystemValue: 0.025,
      };
      (mockModel.Parameter as any) = vi.fn().mockReturnValue(mockDimension);
    });

    it('should get dimension', () => {
      const result = api.getDimension('D1@Sketch1');
      expect(result).toBe(25);
    });
  });

  describe('setDimension', () => {
    beforeEach(() => {
      (api as any).currentModel = mockModel;
      const mockDimension = {
        SystemValue: 0.025,
      };
      (mockModel.Parameter as any) = vi.fn().mockReturnValue(mockDimension);
      (mockModel.EditRebuild3 as any) = vi.fn();
    });

    it('should set dimension', () => {
      expect(() => {
        api.setDimension('D1@Sketch1', 50);
      }).not.toThrow();
    });
  });

  describe('exportFile', () => {
    beforeEach(() => {
      (api as any).currentModel = mockModel;
      (mockModel.SaveAs3 as any) = vi.fn().mockReturnValue(true);
    });

    it('should export file', () => {
      expect(() => {
        api.exportFile('output.step', 'step');
      }).not.toThrow();
    });

    it('should throw error when no model', () => {
      (api as any).currentModel = null;
      expect(() => {
        api.exportFile('output.step', 'step');
      }).toThrow('No model open');
    });
  });

  describe('runMacro', () => {
    beforeEach(() => {
      (mockSwApp.RunMacro2 as any) = vi.fn().mockReturnValue(true);
    });

    it('should run macro', () => {
      expect(() => {
        api.runMacro('macro.swp', 'Module1', 'Main', []);
      }).not.toThrow();
    });
  });

  describe('getMassProperties', () => {
    beforeEach(() => {
      (api as any).currentModel = mockModel;
      const mockMassProps = {
        Mass: 1.0,
        Volume: 1000,
        CenterOfMassX: 0,
        CenterOfMassY: 0,
        CenterOfMassZ: 0,
      };
      (mockModel.Extension as any) = {
        CreateMassProperty: vi.fn().mockReturnValue(mockMassProps),
      };
      (mockModel.GetMassProperties2 as any) = vi.fn().mockReturnValue(mockMassProps);
    });

    it('should get mass properties', () => {
      expect(() => {
        api.getMassProperties();
      }).not.toThrow();
    });

    it('should throw error when no model', () => {
      (api as any).currentModel = null;
      expect(() => {
        api.getMassProperties();
      }).toThrow('No model open');
    });
  });

  describe('getConfiguration', () => {
    it('should get configuration', async () => {
      const result = await api.getConfiguration();
      expect(result).toBeDefined();
    });
  });

  describe('getMaterialProperties', () => {
    beforeEach(() => {
      (api as any).currentModel = mockModel;
    });

    it('should get material properties', async () => {
      const result = await api.getMaterialProperties('Steel');
      expect(result).toBeDefined();
    });
  });

  describe('getTemplateList', () => {
    it('should get template list', async () => {
      const result = await api.getTemplateList('part');
      expect(result).toBeDefined();
    });
  });

  describe('getSystemStatus', () => {
    it('should get system status', async () => {
      const result = await api.getSystemStatus();
      expect(result).toBeDefined();
    });
  });
});

