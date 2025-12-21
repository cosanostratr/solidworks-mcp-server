/**
 * Extrusion-related helper functions
 * These are extracted from SolidWorksAPI to reduce file size and improve maintainability
 */

import { IModelDoc2, IFeatureManager } from '../types/com-types.js';
import { SolidWorksFeature } from '../types/business-types.js';
import { logger } from '../../utils/logger.js';
import { COM } from '../../utils/com-boolean.js';
import { config } from '../../utils/config.js';
import { getFeatureInfo, isSketchLikeFeature } from '../../utils/feature-utils.js';
import * as path from 'path';

/**
 * Prepare for extrusion: exit sketch mode and clear selections
 */
export function prepareForExtrusion(model: IModelDoc2 | null): void {
  if (!model) return;

  // Exit sketch mode if active
  try {
    const sketchMgr = model.SketchManager;
    const activeSketch = sketchMgr.ActiveSketch;
    if (activeSketch) {
      sketchMgr.InsertSketch(true);
    }
  } catch (e) {
    // Continue if no active sketch
  }

  // Clear selections
  try {
    model.ClearSelection2(COM.TRUE);
  } catch (e) {
    // Continue
  }
}

/**
 * Select a sketch for extrusion by iterating features in reverse order
 * @returns The name of the selected sketch
 * @throws Error if no sketch is found
 */
export function selectSketchForExtrusion(model: IModelDoc2 | null): string {
  if (!model) throw new Error('No model open');

  let sketchSelected = false;
  let selectedSketchName = '';
  const attemptedSketches: string[] = [];

  try {
    let i = 0;
    const maxIterations = 50;
    logger.info(`Searching features for sketch...`);

    while (i < maxIterations) {
      const feat = model.FeatureByPositionReverse(i);
      if (!feat) break;

      try {
        const { name: featName, typeName } = getFeatureInfo(feat);

        if (isSketchLikeFeature(featName, typeName)) {
          // Try Select2 first
          try {
            if (feat.Select2) {
              feat.Select2(false, 0);
              sketchSelected = true;
              selectedSketchName = featName || `Feature at position ${i}`;
              logger.info(`Selected sketch by position: ${selectedSketchName} (type: ${typeName})`);
              break;
            }
          } catch (selectErr) {
            // Try SelectByID2 as fallback
            if (featName) {
              try {
                const ext = model.Extension;
                if (ext && ext.SelectByID2) {
                  const selected = ext.SelectByID2(featName, 'SKETCH', 0.0, 0.0, 0.0, COM.FALSE, 0, null, 0);
                  if (selected) {
                    sketchSelected = true;
                    selectedSketchName = featName;
                    logger.info(`Selected sketch by name: ${selectedSketchName}`);
                    break;
                  }
                }
              } catch (selectByIdErr) {
                attemptedSketches.push(`${featName} (error: ${selectByIdErr})`);
              }
            }
          }
        }
      } catch (featErr) {
        // Continue to next feature
      }

      i++;
    }
  } catch (e) {
    logger.warn(`Feature search failed: ${e}`);
  }

  if (!sketchSelected) {
    const errorMessage = `No sketch found to extrude. ` +
      (attemptedSketches.length > 0 ? `Attempted sketches: ${attemptedSketches.join(', ')}. ` : '') +
      `Please ensure a sketch exists or specify the sketch name explicitly.`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  logger.info(`Using sketch: ${selectedSketchName}`);
  return selectedSketchName;
}

/**
 * Try FeatureExtrusion3 method
 */
export function tryFeatureExtrusion3(featureMgr: IFeatureManager, depthInMeters: number, reverse: boolean): any {
  return featureMgr.FeatureExtrusion3(
    true,              // Sd (single direction) - Boolean
    reverse ? 1 : 0,   // Flip - convert boolean to int
    false ? 1 : 0,     // Dir (both directions) - Boolean to int
    0,                 // T1 (end condition: 0=Blind) - Long
    0,                 // T2 - Long
    depthInMeters,     // D1 (depth) - Double
    0.0,               // D2 - Double
    false ? 1 : 0,     // Dchk1 - Boolean to int
    false ? 1 : 0,     // Dchk2 - Boolean to int
    false ? 1 : 0,     // Ddir1 - Boolean to int
    false ? 1 : 0,     // Ddir2 - Boolean to int
    0.0,               // Dang1 - Double
    0.0,               // Dang2 - Double
    false ? 1 : 0,     // OffsetReverse1 - Boolean to int
    false ? 1 : 0,     // OffsetReverse2 - Boolean to int
    false ? 1 : 0,     // TranslateSurface1 - Boolean to int
    false ? 1 : 0,     // TranslateSurface2 - Boolean to int
    true ? 1 : 0,      // Merge - Boolean to int
    false ? 1 : 0,     // FlipSideToCut - Boolean to int
    true ? 1 : 0,      // Update - Boolean to int
    0,                 // Start condition - Long
    0,                 // Flip start offset - Long
    false ? 1 : 0      // Use feature scope - Boolean to int
  );
}

/**
 * Try FeatureExtrusion2 method
 */
export function tryFeatureExtrusion2(featureMgr: IFeatureManager, depthInMeters: number, reverse: boolean): any {
  return featureMgr.FeatureExtrusion2(
    true ? 1 : 0,      // Sd
    reverse ? 1 : 0,   // Flip
    false ? 1 : 0,     // Dir
    0,                 // T1
    0,                 // T2
    depthInMeters,     // D1
    0.0,               // D2
    false ? 1 : 0,     // Dchk1
    false ? 1 : 0,     // Dchk2
    false ? 1 : 0,     // Ddir1
    false ? 1 : 0,     // Ddir2
    0.0,               // Dang1
    0.0                // Dang2
  );
}

/**
 * Try FeatureExtrusion method (minimal params)
 */
export function tryFeatureExtrusion(featureMgr: IFeatureManager, depthInMeters: number, reverse: boolean): any {
  return featureMgr.FeatureExtrusion(
    true ? 1 : 0,      // Sd
    reverse ? 1 : 0,   // Flip
    false ? 1 : 0,     // Dir
    0,                 // T1
    0,                 // T2
    depthInMeters,     // D1
    0.0                // D2
  );
}

/**
 * Generate VBA macro as fallback when all COM methods fail
 */
export function generateVBAFallbackMacro(depth: number, reverse: boolean): string {
  try {
    const macroGenModule = require('../adapters/macro-generator.js');
    const MacroGenerator = macroGenModule.MacroGenerator;
    const generator = new MacroGenerator();
    const macroCode = generator.generateExtrusionMacro({
      depth: depth * 1000, // Convert back to mm
      reverse: reverse,
      endCondition: 'Blind',
      merge: true
    });

    const tempDir = config.solidworks.macrosPath ||
      path.join(process.env.TEMP || process.env.TMPDIR || (process.platform === 'win32' ? 'C:\\Temp' : '/tmp'), 'solidworks_mcp_macros');

    const fsSync = require('fs');
    if (!fsSync.existsSync(tempDir)) {
      fsSync.mkdirSync(tempDir, { recursive: true });
    }
    const macroPath = path.join(tempDir, `CreateExtrusion_${Date.now()}.swp`);
    fsSync.writeFileSync(macroPath, macroCode);

    logger.info(`Generated VBA macro at: ${macroPath}`);
    return macroPath;
  } catch (macroErr) {
    logger.warn('Failed to generate fallback macro', macroErr as Error);
    return '';
  }
}

/**
 * Finalize extrusion: get feature name, clear selections, rebuild model
 */
export function finalizeExtrusion(model: IModelDoc2 | null, feature: any): SolidWorksFeature {
  if (!feature) {
    throw new Error('Failed to create extrusion - feature is null');
  }

  // Get feature name
  let featureName = 'Boss-Extrude1';
  try {
    if (feature.Name) {
      featureName = feature.Name;
    } else if (feature.GetName) {
      featureName = feature.GetName();
    }
  } catch (e) {
    // Use default name
  }

  // Clear selections
  try {
    model?.ClearSelection2(COM.TRUE);
  } catch (e) {
    // Ignore
  }

  // Rebuild
  try {
    model?.EditRebuild3();
  } catch (e) {
    try {
      model?.EditRebuild();
    } catch (e2) {
      // Continue
    }
  }

  return {
    name: featureName,
    type: 'Extrusion',
    suppressed: false,
  };
}
