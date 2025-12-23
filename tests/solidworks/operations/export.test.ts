/**
 * Unit tests for Export Operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportOperations } from '../../../src/solidworks/operations/export.js';
import { IModelDoc2, ISldWorksApp } from '../../../src/solidworks/types/com-types.js';

describe('ExportOperations', () => {
  let mockSwApp: ISldWorksApp;
  let mockModel: IModelDoc2;

  beforeEach(() => {
    mockSwApp = {} as ISldWorksApp;
    mockModel = {
      GetPathName: vi.fn().mockReturnValue('C:\\test\\model.SLDPRT'),
      GetType: vi.fn().mockReturnValue(1), // swDocPART
      SaveAs3: vi.fn().mockReturnValue(true),
      SaveAs4: vi.fn().mockReturnValue(true),
      Extension: {
        SaveAs: vi.fn().mockReturnValue(true),
      },
    } as any;
  });

  describe('exportFile', () => {
    it('should throw error when no model is provided', () => {
      expect(() => {
        ExportOperations.exportFile(mockSwApp, null, 'output.step', 'step');
      }).toThrow('No model open');
    });

    it('should export to STEP format', () => {
      ExportOperations.exportFile(mockSwApp, mockModel, 'output.step', 'step');
      expect(mockModel.SaveAs3).toHaveBeenCalled();
    });

    it('should export to IGES format', () => {
      ExportOperations.exportFile(mockSwApp, mockModel, 'output.iges', 'iges');
      expect(mockModel.SaveAs3).toHaveBeenCalled();
    });

    it('should export to STL format', () => {
      ExportOperations.exportFile(mockSwApp, mockModel, 'output.stl', 'stl');
      expect(mockModel.SaveAs3).toHaveBeenCalled();
    });

    it('should throw error for PDF export on non-drawing document', () => {
      (mockModel.GetType as any).mockReturnValue(1); // Part, not drawing
      
      expect(() => {
        ExportOperations.exportFile(mockSwApp, mockModel, 'output.pdf', 'pdf');
      }).toThrow('PDF export requires a drawing document');
    });

    it('should export PDF for drawing document', () => {
      (mockModel.GetType as any).mockReturnValue(3); // Drawing
      
      ExportOperations.exportFile(mockSwApp, mockModel, 'output.pdf', 'pdf');
      expect(mockModel.SaveAs3).toHaveBeenCalled();
    });

    it('should export to DXF format', () => {
      ExportOperations.exportFile(mockSwApp, mockModel, 'output.dxf', 'dxf');
      expect(mockModel.SaveAs3).toHaveBeenCalled();
    });

    it('should export to DWG format', () => {
      ExportOperations.exportFile(mockSwApp, mockModel, 'output.dwg', 'dwg');
      expect(mockModel.SaveAs3).toHaveBeenCalled();
    });

    it('should throw error for unsupported format', () => {
      expect(() => {
        ExportOperations.exportFile(mockSwApp, mockModel, 'output.xyz', 'xyz');
      }).toThrow('Unsupported export format: xyz');
    });

    it('should save model first if not saved', () => {
      (mockModel.GetPathName as any).mockReturnValue('');
      
      ExportOperations.exportFile(mockSwApp, mockModel, 'output.step', 'step');
      expect(mockModel.SaveAs3).toHaveBeenCalled();
    });

    it('should use Extension.SaveAs fallback for STEP', () => {
      (mockModel.SaveAs3 as any).mockReturnValue(false);
      ExportOperations.exportFile(mockSwApp, mockModel, 'output.step', 'step');
      expect(mockModel.Extension.SaveAs).toHaveBeenCalled();
    });

    it('should use GetExportFileData for STEP when SaveAs fails', () => {
      const mockExportData = {
        SetStep203: vi.fn(),
      };
      (mockModel.SaveAs3 as any).mockImplementation(() => {
        throw new Error('SaveAs3 failed');
      });
      (mockModel.Extension.SaveAs as any).mockImplementation(() => {
        throw new Error('Extension.SaveAs failed');
      });
      (mockSwApp.GetExportFileData as any) = vi.fn().mockReturnValue(mockExportData);
      (mockModel.Extension.SaveAs as any).mockReturnValue(true);

      ExportOperations.exportFile(mockSwApp, mockModel, 'output.step', 'step');
      expect(mockSwApp.GetExportFileData).toHaveBeenCalled();
    });

    it('should use SaveAs4 fallback for STL', () => {
      (mockModel.SaveAs3 as any).mockReturnValue(false);
      ExportOperations.exportFile(mockSwApp, mockModel, 'output.stl', 'stl');
      expect(mockModel.SaveAs4).toHaveBeenCalled();
    });

    it('should throw error when export fails', () => {
      (mockModel.SaveAs3 as any).mockReturnValue(false);
      (mockModel.Extension.SaveAs as any).mockReturnValue(false);
      
      expect(() => {
        ExportOperations.exportFile(mockSwApp, mockModel, 'output.step', 'step');
      }).toThrow('Failed to export to STEP');
    });

    it('should handle export errors gracefully', () => {
      (mockModel.SaveAs3 as any).mockImplementation(() => {
        throw new Error('Export failed');
      });
      (mockModel.Extension.SaveAs as any).mockImplementation(() => {
        throw new Error('Extension.SaveAs failed');
      });
      (mockSwApp.GetExportFileData as any) = vi.fn().mockReturnValue(null);

      expect(() => {
        ExportOperations.exportFile(mockSwApp, mockModel, 'output.step', 'step');
      }).toThrow('Failed to export to STEP');
    });
  });
});

