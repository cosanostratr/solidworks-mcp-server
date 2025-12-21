import { IModelDoc2, IMassProperty } from '../types/com-types.js';
import { MassProperties } from '../types/interfaces.js';

/**
 * Mass properties operations
 */
export class MassPropertiesOperations {
  /**
   * Get mass properties of the model
   */
  static getMassProperties(model: IModelDoc2 | null): MassProperties {
    if (!model) throw new Error('No model open');

    // Check document type - mass properties only work for parts and assemblies
    const docType = model.GetType();
    if (docType !== 1 && docType !== 2) {
      throw new Error('Mass properties only available for parts and assemblies');
    }

    try {
      // Get the modeler extension
      const modeler = model.Extension;
      if (!modeler) {
        throw new Error('Cannot access model extension');
      }

      // Create mass property object
      let massProps: IMassProperty | null = null;

      try {
        massProps = modeler.CreateMassProperty();
      } catch (e) {
        try {
          massProps = modeler.CreateMassProperty2?.() ?? null;
        } catch (e2) {
          massProps = model.GetMassProperties();
        }
      }

      if (!massProps) {
        throw new Error('Failed to create mass property object');
      }

      // Update mass properties if method exists
      try {
        if (massProps.Update) {
          const success = massProps.Update();
          if (!success) {
            if (massProps.Recalculate) {
              massProps.Recalculate();
            }
          }
        }
      } catch (e) {
        // Update might not be needed
      }

      // Get the values with error handling
      const result: MassProperties = {};

      try {
        result.mass = massProps?.Mass ?? 0;
      } catch (e) {
        result.mass = 0;
      }

      try {
        result.volume = massProps?.Volume ?? 0;
      } catch (e) {
        result.volume = 0;
      }

      try {
        result.surfaceArea = massProps?.SurfaceArea ?? 0;
      } catch (e) {
        result.surfaceArea = 0;
      }

      try {
        const com = massProps?.CenterOfMass;
        if (com && Array.isArray(com) && com.length >= 3) {
          result.centerOfMass = {
            x: com[0] * 1000, // Convert to mm
            y: com[1] * 1000,
            z: com[2] * 1000,
          };
        } else {
          result.centerOfMass = { x: 0, y: 0, z: 0 };
        }
      } catch (e) {
        result.centerOfMass = { x: 0, y: 0, z: 0 };
      }

      try {
        result.density = massProps?.Density ?? 0;
      } catch (e) {
        result.density = 0;
      }

      try {
        const moi = massProps?.MomentOfInertia;
        if (moi && Array.isArray(moi) && moi.length >= 9) {
          result.momentsOfInertia = {
            Ixx: moi[0],
            Ixy: moi[1],
            Ixz: moi[2],
            Iyx: moi[3],
            Iyy: moi[4],
            Iyz: moi[5],
            Izx: moi[6],
            Izy: moi[7],
            Izz: moi[8]
          };
        }
      } catch (e) {
        // Moments of inertia might not be available
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to get mass properties: ${error}`);
    }
  }
}

