import { logger } from '../../utils/logger.js';
import { IModelDoc2, ISketchSegment } from '../types/com-types.js';
import { COM } from '../../utils/com-boolean.js';
import { SketchParams, LineParams, SketchContext, SketchOperation } from '../types/interfaces.js';
import { traverseFeatures } from '../../utils/feature-utils.js';
import { findSketchFeatures } from '../../utils/feature-utils.js';
import { isSketchLikeFeature } from '../../utils/feature-utils.js';
import { ModelHelpers } from '../helpers/model.js';

/**
 * Sketch operations: create, add entities, manage sketches
 */
export class SketchOperations {
  /**
   * Create a sketch on a plane
   */
  static createSketch(
    model: IModelDoc2 | null,
    params: SketchParams
  ): { success: boolean; sketchId?: string; error?: string } {
    if (!model) throw new Error('No active model');

    const { plane = 'Front' } = params;

    // Use robust selection for standard planes
    let planeSelected = false;
    if (['Front', 'Top', 'Right'].includes(plane)) {
      planeSelected = this.selectStandardPlane(model, plane as 'Front' | 'Top' | 'Right');
    } else {
      // Custom plane or fallback to direct SelectByID2
      const ext = model.Extension;
      if (ext && ext.SelectByID2) {
        planeSelected = ext.SelectByID2(plane, 'PLANE', 0.0, 0.0, 0.0, COM.FALSE, 0, null, 0);
      }
    }
    
    if (planeSelected) {
      model.SketchManager.InsertSketch(true);
      const activeSketch = model.SketchManager.ActiveSketch;
      if (activeSketch) {
        const sketchName = activeSketch.Name || activeSketch.GetName();
        return { success: true, sketchId: sketchName };
      }
    }
    
    return { success: false, error: `Failed to create sketch on plane: ${plane}` };
  }
  
  /**
   * Add a line to the active sketch
   */
  static addLine(
    model: IModelDoc2 | null,
    params: LineParams
  ): { success: boolean; lineId?: string; error?: string } {
    if (!model) throw new Error('No active model');

    const { x1 = 0, y1 = 0, z1 = 0, x2 = 100, y2 = 0, z2 = 0 } = params;

    const line = model.SketchManager.CreateLine(
      x1 / 1000, y1 / 1000, z1 / 1000,  // Convert mm to m
      x2 / 1000, y2 / 1000, z2 / 1000
    );

    if (line) {
      return { success: true, lineId: `line_${Date.now()}` };
    }

    return { success: false, error: 'Failed to create line' };
  }

  /**
   * Robust selection of standard planes (Front, Top, Right)
   * Locale-independent using feature iteration.
   */
  static selectStandardPlane(
    model: IModelDoc2 | null,
    planeType: 'Front' | 'Top' | 'Right'
  ): boolean {
    if (!model) return false;

    try {
      // Clear selection
      model.ClearSelection2(true);

      // Method 1: Try iteration (locale-independent)
      // Standard planes are usually the first 3 RefPlane features
      const targetIndex = planeType === 'Front' ? 0 : planeType === 'Top' ? 1 : 2;
      let refPlaneCount = 0;

      const planeFeat = traverseFeatures(model, ({ feature, typeName }) => {
        if (typeName === 'RefPlane') {
          if (refPlaneCount === targetIndex) {
            feature.Select2(false, 0);
            logger.info(`Selected ${planeType} plane by index ${targetIndex}`);
            return true; // Found and selected
          }
          refPlaneCount++;
        }
        return false; // Continue searching
      });

      if (planeFeat) {
        return true; // Successfully selected via iteration
      }

      // Method 2: Fallback to SelectByID2 with English and Chinese names
      const namesMap: Record<string, string[]> = {
        'Front': ['Front Plane', '前视基准面', '前視基準面'],
        'Top': ['Top Plane', '上视基准面', '上視基準面'],
        'Right': ['Right Plane', '右视基准面', '右視基準面']
      };

      const ext = model.Extension;
      if (ext && ext.SelectByID2) {
        for (const name of namesMap[planeType]) {
          const ok = ext.SelectByID2(name, 'PLANE', 0.0, 0.0, 0.0, false, 0, null, 0);
          if (ok) {
            logger.info(`Selected ${planeType} plane by name: ${name}`);
            return true;
          }
        }
      }
    } catch (e) {
      logger.error(`Failed to select standard plane: ${planeType}`, e as Error);
    }

    return false;
  }

  /**
   * Get sketch context information
   */
  static getSketchContext(
    model: IModelDoc2 | null,
    maxFeatures: number = 5
  ): SketchContext {
    if (!model) {
      return {
        hasModel: false,
        modelName: null,
        modelType: 0,
        activeSketch: null,
        recentSketchFeatures: [],
      };
    }

    // Document name
    let modelName: string | null = null;
    try {
      if (model.GetTitle) {
        modelName = model.GetTitle();
      } else if (model.GetPathName) {
        modelName = model.GetPathName();
      }
    } catch (error) {
      logger.debug('Failed to get model name/path', error as Error);
      modelName = null;
    }

    const modelType = ModelHelpers.getDocumentType(model, 0);

    // Active sketch
    let activeSketchInfo: { name: string | null } | null = null;
    try {
      const sketchMgr = model.SketchManager;
      const activeSketch = sketchMgr && sketchMgr.ActiveSketch;
      if (activeSketch) {
        let sketchName = '';
        try {
          sketchName =
            (activeSketch.Name && String(activeSketch.Name).trim()) ||
            (activeSketch.GetName && String(activeSketch.GetName()).trim()) ||
            '';
        } catch (error) {
          logger.debug('Failed to get active sketch name', error as Error);
          sketchName = '';
        }
        activeSketchInfo = {
          name: sketchName || null,
        };
      }
    } catch (error) {
      logger.debug('Failed to get active sketch info', error as Error);
      activeSketchInfo = null;
    }

    // Recent sketch/profile features
    const recentSketchFeatures: Array<{ name: string; typeName: string }> = [];
    try {
      const sketchFeatureInfos = findSketchFeatures(model, maxFeatures);
      recentSketchFeatures.push(...sketchFeatureInfos.map(({ name, typeName }) => ({
        name,
        typeName,
      })));
    } catch (e) {
      logger.warn('getSketchContext failed while traversing features', e as Error);
    }

    return {
      hasModel: true,
      modelName,
      modelType,
      activeSketch: activeSketchInfo,
      recentSketchFeatures,
    };
  }

  /**
   * Create multiple sketch entities in batch mode for better performance.
   */
  static createSketchEntitiesBatch(
    model: IModelDoc2 | null,
    operations: SketchOperation[],
    options?: {
      displayWhenAdded?: boolean;
      rebuildAfter?: boolean;
    }
  ): ISketchSegment[] {
    if (!model) {
      throw new Error('No model open');
    }

    const sketchMgr = model.SketchManager;
    if (!sketchMgr) {
      throw new Error('SketchManager is not available');
    }

    // Ensure active sketch
    ModelHelpers.ensureActiveSketch(model);

    // Save original settings
    const originalAddToDB = sketchMgr.AddToDB;
    const originalDisplayWhenAdded = sketchMgr.DisplayWhenAdded;

    const results: ISketchSegment[] = [];

    try {
      // Enable batch mode
      if (sketchMgr.AddToDB !== undefined) {
        sketchMgr.AddToDB = true;
      }
      if (sketchMgr.DisplayWhenAdded !== undefined) {
        sketchMgr.DisplayWhenAdded = options?.displayWhenAdded ?? false;
      }

      for (const op of operations) {
        try {
          let entity: ISketchSegment | null = null;

          switch (op.type) {
            case 'line':
              if (sketchMgr.CreateLine) {
                const x1 = typeof op.params.x1 === 'number' ? op.params.x1 : 0;
                const y1 = typeof op.params.y1 === 'number' ? op.params.y1 : 0;
                const z1 = typeof op.params.z1 === 'number' ? op.params.z1 : 0;
                const x2 = typeof op.params.x2 === 'number' ? op.params.x2 : 0;
                const y2 = typeof op.params.y2 === 'number' ? op.params.y2 : 0;
                const z2 = typeof op.params.z2 === 'number' ? op.params.z2 : 0;
                entity = sketchMgr.CreateLine(x1 / 1000, y1 / 1000, z1 / 1000, x2 / 1000, y2 / 1000, z2 / 1000) as ISketchSegment;
              }
              break;
            case 'circle':
              if (sketchMgr.CreateCircleByRadius) {
                const centerX = typeof op.params.centerX === 'number' ? op.params.centerX : 0;
                const centerY = typeof op.params.centerY === 'number' ? op.params.centerY : 0;
                const centerZ = typeof op.params.centerZ === 'number' ? op.params.centerZ : 0;
                const radius = typeof op.params.radius === 'number' ? op.params.radius : 0;
                entity = sketchMgr.CreateCircleByRadius(centerX / 1000, centerY / 1000, centerZ / 1000, radius / 1000) as ISketchSegment;
              }
              break;
            case 'arc':
              if (sketchMgr.CreateArc) {
                const centerX = typeof op.params.centerX === 'number' ? op.params.centerX : 0;
                const centerY = typeof op.params.centerY === 'number' ? op.params.centerY : 0;
                const centerZ = typeof op.params.centerZ === 'number' ? op.params.centerZ : 0;
                const startX = typeof op.params.startX === 'number' ? op.params.startX : 0;
                const startY = typeof op.params.startY === 'number' ? op.params.startY : 0;
                const startZ = typeof op.params.startZ === 'number' ? op.params.startZ : 0;
                const endX = typeof op.params.endX === 'number' ? op.params.endX : 0;
                const endY = typeof op.params.endY === 'number' ? op.params.endY : 0;
                const endZ = typeof op.params.endZ === 'number' ? op.params.endZ : 0;
                const direction = typeof op.params.direction === 'number' ? op.params.direction : (op.params.direction ? 1 : 0);
                entity = sketchMgr.CreateArc(
                  centerX / 1000, centerY / 1000, centerZ / 1000,
                  startX / 1000, startY / 1000, startZ / 1000,
                  endX / 1000, endY / 1000, endZ / 1000,
                  direction
                ) as ISketchSegment;
              }
              break;
            case 'rectangle':
              if (sketchMgr.CreateCornerRectangle) {
                const x1 = typeof op.params.x1 === 'number' ? op.params.x1 : 0;
                const y1 = typeof op.params.y1 === 'number' ? op.params.y1 : 0;
                const z1 = typeof op.params.z1 === 'number' ? op.params.z1 : 0;
                const x2 = typeof op.params.x2 === 'number' ? op.params.x2 : 0;
                const y2 = typeof op.params.y2 === 'number' ? op.params.y2 : 0;
                const z2 = typeof op.params.z2 === 'number' ? op.params.z2 : 0;
                entity = sketchMgr.CreateCornerRectangle(x1 / 1000, y1 / 1000, z1 / 1000, x2 / 1000, y2 / 1000, z2 / 1000) as ISketchSegment;
              }
              break;
          }

          if (entity) {
            results.push(entity);
          }
        } catch (e) {
          logger.warn(`Failed to create ${op.type} in batch`, e as Error);
        }
      }
    } finally {
      // Restore original settings
      if (sketchMgr.AddToDB !== undefined) {
        sketchMgr.AddToDB = originalAddToDB;
      }
      if (sketchMgr.DisplayWhenAdded !== undefined) {
        sketchMgr.DisplayWhenAdded = originalDisplayWhenAdded;
      }

      // Rebuild if needed
      if (options?.rebuildAfter !== false && model.EditRebuild3) {
        try {
          model.EditRebuild3();
        } catch (e) {
          logger.warn('Failed to rebuild after batch sketch creation', e as Error);
        }
      }
    }

    return results;
  }
}

