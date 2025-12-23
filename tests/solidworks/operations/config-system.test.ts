/**
 * Unit tests for Config System Operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigSystemOperations } from '../../../src/solidworks/operations/config-system.js';
import { ISldWorksApp, IModelDoc2 } from '../../../src/solidworks/types/com-types.js';

describe('ConfigSystemOperations', () => {
  let mockSwApp: ISldWorksApp;
  let mockModel: IModelDoc2;

  beforeEach(() => {
    mockSwApp = {
      RevisionNumber: '2024.0.0',
      Version: '2024',
      GetUserPreferenceIntegerValue: vi.fn().mockReturnValue(0),
      GetUserPreferenceStringValue: vi.fn().mockReturnValue('C:\\Templates\\Part.prtdot'),
      GetProcessID: vi.fn().mockReturnValue(12345),
      ActiveDoc: null,
      GetActiveDoc: vi.fn().mockReturnValue(null),
      GetDocumentCount: vi.fn().mockReturnValue(0),
    } as any;

    mockModel = {
      GetTitle: vi.fn().mockReturnValue('TestModel'),
      GetPathName: vi.fn().mockReturnValue('C:\\test\\model.SLDPRT'),
      GetType: vi.fn().mockReturnValue(1),
    } as any;
  });

  describe('getConfiguration', () => {
    it('should throw error when not connected', async () => {
      await expect(
        ConfigSystemOperations.getConfiguration(null)
      ).rejects.toThrow('Not connected to SolidWorks');
    });

    it('should get configuration with version', async () => {
      const result = await ConfigSystemOperations.getConfiguration(mockSwApp);
      
      expect(result).toBeDefined();
      expect(result.revisionNumber).toBe('2024.0.0');
      expect(result.units).toBeDefined();
    });

    it('should get units configuration', async () => {
      const result = await ConfigSystemOperations.getConfiguration(mockSwApp);
      
      expect(result.units).toEqual({
        length: 'mm',
        mass: 'g',
        time: 's',
        angle: 'deg',
      });
    });

    it('should get template paths', async () => {
      const result = await ConfigSystemOperations.getConfiguration(mockSwApp);
      
      expect(result.templatePaths).toBeDefined();
    });

    it('should handle missing version property', async () => {
      delete (mockSwApp as any).Version;
      
      const result = await ConfigSystemOperations.getConfiguration(mockSwApp);
      expect(result).toBeDefined();
    });
  });

  describe('getMaterialProperties', () => {
    it('should throw error when not connected', async () => {
      await expect(
        ConfigSystemOperations.getMaterialProperties(null, mockModel, 'Steel')
      ).rejects.toThrow('Not connected to SolidWorks');
    });

    it('should throw error when no model open', async () => {
      await expect(
        ConfigSystemOperations.getMaterialProperties(mockSwApp, null, 'Steel')
      ).rejects.toThrow('No model open');
    });

    it('should get material properties', async () => {
      const result = await ConfigSystemOperations.getMaterialProperties(
        mockSwApp,
        mockModel,
        'Steel'
      );
      
      expect(result).toBeDefined();
      expect(result.name).toBe('Steel');
      expect(result.properties).toBeDefined();
      expect(result.units).toBeDefined();
    });
  });

  describe('getTemplateList', () => {
    it('should throw error when not connected', async () => {
      await expect(
        ConfigSystemOperations.getTemplateList(null, 'part')
      ).rejects.toThrow('Not connected to SolidWorks');
    });

    it('should get template list for part', async () => {
      const result = await ConfigSystemOperations.getTemplateList(mockSwApp, 'part');
      
      expect(result).toBeDefined();
      expect(result.type).toBe('part');
      expect(result.templates).toBeDefined();
      expect(Array.isArray(result.templates)).toBe(true);
    });

    it('should get template list for assembly', async () => {
      const result = await ConfigSystemOperations.getTemplateList(mockSwApp, 'assembly');
      
      expect(result.type).toBe('assembly');
    });

    it('should get template list for drawing', async () => {
      const result = await ConfigSystemOperations.getTemplateList(mockSwApp, 'drawing');
      
      expect(result.type).toBe('drawing');
    });
  });

  describe('getSystemStatus', () => {
    it('should return status with connected false when not connected', async () => {
      const isConnected = () => false;
      const result = await ConfigSystemOperations.getSystemStatus(null, isConnected);
      
      expect(result.connected).toBe(false);
    });

    it('should get system status when connected', async () => {
      const isConnected = () => true;
      const result = await ConfigSystemOperations.getSystemStatus(mockSwApp, isConnected);
      
      expect(result.connected).toBe(true);
      expect(result.version).toBe('2024');
      expect(result.processId).toBe(12345);
    });

    it('should get active document when available', async () => {
      (mockSwApp.ActiveDoc as any) = mockModel;
      const isConnected = () => true;
      
      const result = await ConfigSystemOperations.getSystemStatus(mockSwApp, isConnected);
      
      expect(result.activeDocument).toBeDefined();
      expect(result.activeDocument?.name).toBe('TestModel');
    });

    it('should handle null active document', async () => {
      (mockSwApp.ActiveDoc as any) = null;
      const isConnected = () => true;
      
      const result = await ConfigSystemOperations.getSystemStatus(mockSwApp, isConnected);
      
      expect(result.activeDocument).toBeNull();
    });

    it('should get document count', async () => {
      (mockSwApp.GetDocumentCount as any).mockReturnValue(3);
      const isConnected = () => true;
      
      const result = await ConfigSystemOperations.getSystemStatus(mockSwApp, isConnected);
      
      expect(result.openDocuments).toBe(3);
    });
  });
});

