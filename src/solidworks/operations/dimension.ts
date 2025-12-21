import { logger } from '../../utils/logger.js';
import { IModelDoc2 } from '../types/com-types.js';
import { COM } from '../../utils/com-boolean.js';
import { PerformanceLimits } from '../../shared/constants/solidworks-constants.js';
import { ModelHelpers } from '../helpers/model.js';

/**
 * Dimension operations: get and set dimensions
 */
export class DimensionOperations {
  /**
   * Get dimension value by name
   */
  static getDimension(
    swApp: any,
    model: IModelDoc2 | null,
    name: string
  ): number {
    if (!model) {
      model = ModelHelpers.ensureCurrentModel(swApp, model);
      if (!model) throw new Error('No model open');
    }
    
    let dimension: any = null;
    const normalizedName = name.trim();

    // Method 1: Try Parameter method
    try {
      dimension = model.Parameter(normalizedName);
    } catch (e) {}
    
    // Method 2: Try GetParameter
    if (!dimension) {
      try {
        if (model.GetParameter) {
          dimension = model.GetParameter(normalizedName);
        }
      } catch (e) {}
    }
    
    // Method 3: Try Extension.GetParameter
    if (!dimension) {
      try {
        const ext = model.Extension;
        if (ext && ext.GetParameter) {
          dimension = ext.GetParameter(normalizedName);
        }
      } catch (e) {}
    }
    
    // Method 4: Search feature by name and then its dimensions
    if (!dimension && normalizedName.includes('@')) {
      const parts = normalizedName.split('@');
      const dimName = parts[0];
      const featName = parts[1];
      
      try {
        const feat = ModelHelpers.findSketchFeatureByName(model, featName) || 
                     model.FeatureByName(featName);
        
        if (feat && feat.GetFirstDisplayDimension) {
          let dispDim = feat.GetFirstDisplayDimension();
          let iterations = 0;
          while (dispDim && iterations < PerformanceLimits.MAX_DIMENSION_ITERATIONS) {
            iterations++;
            const dim = dispDim.GetDimension2 ? dispDim.GetDimension2(0) : null;
            if (dim) {
              const fullName = dim.FullName || dim.Name;
              if (fullName === normalizedName || dim.Name === dimName) {
                dimension = dim;
                break;
              }
            }
            dispDim = feat.GetNextDisplayDimension?.(dispDim) ?? null;
          }
          if (iterations >= PerformanceLimits.MAX_DIMENSION_ITERATIONS) {
            logger.warn(`Dimension iteration limit reached while searching for: ${normalizedName}`);
          }
        }
      } catch (e) {}
    }

    // Method 5: Try SelectByID and get from SelectionManager
    if (!dimension) {
      try {
        const ok = model.Extension.SelectByID2(normalizedName, "DIMENSION", 0.0, 0.0, 0.0, false, 0, null, 0);
        if (ok) {
          const selMgr = model.SelectionManager;
          if (selMgr && selMgr.GetSelectedObjectCount2(-1) > 0) {
            dimension = selMgr.GetSelectedObject6(1, -1);
          }
          model.ClearSelection2(COM.TRUE);
        }
      } catch (e) {}
    }
    
    if (!dimension) {
      throw new Error(`Dimension "${normalizedName}" not found. Ensure the sketch/feature name is correct and the dimension exists.`);
    }
    
    // Get the value - try different properties
    let value = 0;
    try {
      if (dimension.SystemValue !== undefined) {
        value = dimension.SystemValue * 1000; // Convert m to mm
      } else if (dimension.Value !== undefined) {
        value = dimension.Value * 1000;
      } else if (dimension.GetSystemValue) {
        value = dimension.GetSystemValue() * 1000;
      } else {
        const val = dimension.GetSystemValue ? dimension.GetSystemValue() : dimension.Value;
        if (typeof val === 'number') value = val * 1000;
        else throw new Error('Cannot read dimension value');
      }
    } catch (e) {
      throw new Error(`Cannot read value of dimension "${normalizedName}"`);
    }
    
    return value;
  }
  
  /**
   * Set dimension value by name
   */
  static setDimension(
    swApp: any,
    model: IModelDoc2 | null,
    name: string,
    value: number
  ): void {
    if (!model) {
      model = ModelHelpers.ensureCurrentModel(swApp, model);
      if (!model) throw new Error('No model open');
    }

    let dimension: any = null;
    const normalizedName = name.trim();

    // Method 1: Try Parameter method
    try {
      dimension = model.Parameter(normalizedName);
    } catch (e) {}
    
    // Method 2: Try GetParameter
    if (!dimension) {
      try {
        if (model.GetParameter) {
          dimension = model.GetParameter(normalizedName);
        }
      } catch (e) {}
    }
    
    // Method 3: Try Extension.GetParameter
    if (!dimension) {
      try {
        const ext = model.Extension;
        if (ext && ext.GetParameter) {
          dimension = ext.GetParameter(normalizedName);
        }
      } catch (e) {}
    }
    
    // Method 4: Search feature and its dimensions
    if (!dimension && normalizedName.includes('@')) {
      const parts = normalizedName.split('@');
      const dimName = parts[0];
      const featName = parts[1];
      
      try {
        const feat = ModelHelpers.findSketchFeatureByName(model, featName) || 
                     model.FeatureByName(featName);
        
        if (feat && feat.GetFirstDisplayDimension) {
          let dispDim = feat.GetFirstDisplayDimension();
          let iterations = 0;
          while (dispDim && iterations < PerformanceLimits.MAX_DIMENSION_ITERATIONS) {
            iterations++;
            const dim = dispDim.GetDimension2 ? dispDim.GetDimension2(0) : null;
            if (dim) {
              const fullName = dim.FullName || dim.Name;
              if (fullName === normalizedName || dim.Name === dimName) {
                dimension = dim;
                break;
              }
            }
            dispDim = feat.GetNextDisplayDimension?.(dispDim) ?? null;
          }
          if (iterations >= PerformanceLimits.MAX_DIMENSION_ITERATIONS) {
            logger.warn(`Dimension iteration limit reached while searching for: ${normalizedName}`);
          }
        }
      } catch (e) {}
    }

    // Method 5: Try SelectByID and get dimension
    if (!dimension) {
      try {
        const ok = model.Extension.SelectByID2(normalizedName, "DIMENSION", 0.0, 0.0, 0.0, false, 0, null, 0);
        if (ok) {
          const selMgr = model.SelectionManager;
          if (selMgr && selMgr.GetSelectedObjectCount2(-1) > 0) {
            dimension = selMgr.GetSelectedObject6(1, -1);
          }
        }
      } catch (e) {}
    }
    
    if (!dimension) {
      throw new Error(`Dimension "${normalizedName}" not found. Try format like "D1@Sketch1" or "D1@Boss-Extrude1"`);
    }
    
    // Set the value - try different methods
    const newValue = value / 1000; // Convert mm to m
    let success = false;
    
    try {
      if (dimension.SystemValue !== undefined) {
        dimension.SystemValue = newValue;
        success = true;
      } else if (dimension.Value !== undefined) {
        dimension.Value = newValue;
        success = true;
      } else if (dimension.SetSystemValue) {
        success = dimension.SetSystemValue(newValue);
      } else if (dimension.SetValue) {
        success = dimension.SetValue(newValue);
      }
    } catch (e) {
      // Try equation manager
      try {
        const eqMgr = model.GetEquationMgr();
        if (eqMgr) {
          const count = eqMgr.GetCount();
          for (let i = 0; i < count; i++) {
            const eq = eqMgr.Equation[i];
            if (eq && eq.includes(normalizedName)) {
              eqMgr.Equation[i] = `"${normalizedName}" = ${value}`;
              success = true;
              break;
            }
          }
        }
      } catch (e2) {}
    }
    
    // Clear selection if we used it
    try {
      model.ClearSelection2(true);
    } catch (e) {}
    
    if (!success) {
      throw new Error(`Failed to set dimension "${normalizedName}" to ${value}mm`);
    }
    
    model.EditRebuild3();
  }
}

