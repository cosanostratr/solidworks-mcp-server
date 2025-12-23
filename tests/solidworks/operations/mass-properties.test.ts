/**
 * Unit tests for Mass Properties Operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MassPropertiesOperations } from '../../../src/solidworks/operations/mass-properties.js';
import { IModelDoc2 } from '../../../src/solidworks/types/com-types.js';

describe('MassPropertiesOperations', () => {
  let mockModel: IModelDoc2;

  beforeEach(() => {
    mockModel = {
      GetType: vi.fn().mockReturnValue(1), // swDocPART
      Extension: {
        CreateMassProperty: vi.fn().mockReturnValue({
          Mass: 1.5,
          Volume: 0.0002,
          SurfaceArea: 0.01,
          CenterOfMass: [0.1, 0.2, 0.3],
          Density: 7850,
          MomentOfInertia: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          Update: vi.fn().mockReturnValue(true),
        }),
      },
    } as any;
  });

  describe('getMassProperties', () => {
    it('should throw error when no model is provided', () => {
      expect(() => {
        MassPropertiesOperations.getMassProperties(null);
      }).toThrow('No model open');
    });

    it('should throw error for drawing document', () => {
      (mockModel.GetType as any).mockReturnValue(3); // Drawing
      
      expect(() => {
        MassPropertiesOperations.getMassProperties(mockModel);
      }).toThrow('Mass properties only available for parts and assemblies');
    });

    it('should get mass properties for part', () => {
      const result = MassPropertiesOperations.getMassProperties(mockModel);

      expect(result).toBeDefined();
      expect(result.mass).toBe(1.5);
      expect(result.volume).toBe(0.0002);
      expect(result.surfaceArea).toBe(0.01);
      expect(result.centerOfMass).toEqual({
        x: 100, // Converted from meters to mm
        y: 200,
        z: 300,
      });
      expect(result.density).toBe(7850);
    });

    it('should get mass properties for assembly', () => {
      (mockModel.GetType as any).mockReturnValue(2); // Assembly
      
      const result = MassPropertiesOperations.getMassProperties(mockModel);
      expect(result).toBeDefined();
    });

    it('should handle missing mass property values', () => {
      const mockMassProps = {
        Update: vi.fn().mockReturnValue(true),
      };
      (mockModel.Extension.CreateMassProperty as any).mockReturnValue(mockMassProps);

      const result = MassPropertiesOperations.getMassProperties(mockModel);
      
      expect(result.mass).toBe(0);
      expect(result.volume).toBe(0);
      expect(result.surfaceArea).toBe(0);
    });

    it('should handle missing center of mass', () => {
      const mockMassProps = {
        Mass: 1.5,
        Volume: 0.0002,
        SurfaceArea: 0.01,
        Update: vi.fn().mockReturnValue(true),
      };
      (mockModel.Extension.CreateMassProperty as any).mockReturnValue(mockMassProps);

      const result = MassPropertiesOperations.getMassProperties(mockModel);
      
      expect(result.centerOfMass).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should handle CreateMassProperty2 fallback', () => {
      (mockModel.Extension.CreateMassProperty as any).mockImplementation(() => {
        throw new Error('CreateMassProperty failed');
      });
      (mockModel.Extension.CreateMassProperty2 as any) = vi.fn().mockReturnValue({
        Mass: 2.0,
        Volume: 0.0003,
        Update: vi.fn().mockReturnValue(true),
      });

      const result = MassPropertiesOperations.getMassProperties(mockModel);
      expect(result.mass).toBe(2.0);
    });

    it('should handle GetMassProperties fallback', () => {
      (mockModel.Extension.CreateMassProperty as any).mockImplementation(() => {
        throw new Error('CreateMassProperty failed');
      });
      // CreateMassProperty2 should also fail
      (mockModel.Extension.CreateMassProperty2 as any) = vi.fn().mockImplementation(() => {
        throw new Error('CreateMassProperty2 failed');
      });
      // GetMassProperties should return a valid mass property object
      const mockMassProps = {
        Mass: 3.0,
        Volume: 0.0004,
        SurfaceArea: 0.01,
        CenterOfMass: [0, 0, 0],
        Density: 7850,
        Update: vi.fn().mockReturnValue(true),
      };
      (mockModel.GetMassProperties as any) = vi.fn().mockReturnValue(mockMassProps);

      const result = MassPropertiesOperations.getMassProperties(mockModel);
      expect(result.mass).toBe(3.0);
      expect(mockModel.GetMassProperties).toHaveBeenCalled();
    });
  });
});

