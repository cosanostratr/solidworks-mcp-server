import { logger } from '../../utils/logger.js';
import { ISldWorksApp, IModelDoc2, IFeature } from '../types/com-types.js';
import {
  traverseFeatures,
  isSketchLikeFeature,
} from '../../utils/feature-utils.js';
import { findSketchFeatures } from '../../utils/feature-utils.js';

/**
 * Helper methods for model management and operations
 */
export class ModelHelpers {
  /**
   * Ensure there is an active sketch on the given model.
   * - If ActiveSketch exists, return directly
   * - Otherwise try to find sketch feature and enter edit mode
   * - If still fails, throw clear error
   */
  static ensureActiveSketch(model: IModelDoc2 | null): void {
    if (!model) {
      throw new Error('No model provided to ensureActiveSketch');
    }

    const sketchMgr = model.SketchManager;
    if (!sketchMgr) {
      throw new Error(
        'SketchManager is not available. The document may not be fully initialized or is not a Part document.'
      );
    }

    // Check if active sketch already exists
    try {
      if (sketchMgr.ActiveSketch) {
        return;
      }
    } catch (error) {
      logger.debug('ActiveSketch check failed, will attempt to activate sketch', error as Error);
    }

    // Try to find recent sketch feature and enter edit mode
    try {
      const sketchFeature = traverseFeatures(model, ({ feature, name, typeName }) => {
        if (isSketchLikeFeature(name, typeName)) {
          try {
            if (feature.Select2) {
              feature.Select2(false, 0);
            }
            if (model.EditSketch) {
              model.EditSketch();
            }
            if (sketchMgr.ActiveSketch) {
              return true; // Stop iteration, sketch activated
            }
          } catch (error) {
            logger.debug('Failed to select/edit sketch feature, trying next', error as Error);
          }
        }
        return false; // Continue iteration
      });

      if (!sketchFeature) {
        logger.debug('No sketch feature found or activated');
      }
    } catch (e) {
      logger.warn('Failed to activate sketch via feature traversal', e as Error);
    }

    // Finally try to insert new sketch directly
    try {
      if (sketchMgr.InsertSketch) {
        sketchMgr.InsertSketch(true);
        if (sketchMgr.ActiveSketch) {
          return;
        }
      }
    } catch (e) {
      logger.warn('InsertSketch failed in ensureActiveSketch', e as Error);
    }

    throw new Error('No sketch available to activate. Please create a sketch first.');
  }

  /**
   * Unified helper: get document type with fallback.
   * - Prefer model.GetType() if available
   * - Otherwise return provided fallback (default 0)
   */
  static getDocumentType(model: IModelDoc2 | null, fallback: number = 0): number {
    if (!model) return fallback;
    try {
      if (typeof model.GetType === 'function') {
        const t = model.GetType();
        if (typeof t === 'number') {
          return t;
        }
      }
    } catch (error) {
      logger.debug('Failed to get document type, using fallback', error as Error);
    }
    return fallback;
  }

  /**
   * Find a sketch feature by name on the given model.
   * Returns matching feature object, or null if not found.
   */
  static findSketchFeatureByName(model: IModelDoc2 | null, name: string): IFeature | null {
    if (!model || !name) return null;

    const normalizedName = String(name).trim();
    if (!normalizedName) return null;

    try {
      // Use utility function to find sketch feature by name
      return traverseFeatures(model, ({ feature, name: featName, typeName }) => {
        if (featName.trim() === normalizedName) {
          // Verify it's a sketch/profile feature
          const isSketch = typeName && (
            typeName.toLowerCase().includes('sketch') ||
            typeName.toLowerCase().includes('profile')
          );
          if (isSketch || !typeName) { // If we can't determine type, assume it's valid
            return true; // Found match
          }
        }
        return false; // Continue searching
      });
    } catch (e) {
      logger.warn('findSketchFeatureByName failed', e as Error);
      return null;
    }
  }

  /**
   * Helper to safely get model title
   */
  static getModelTitle(model: IModelDoc2 | null): string {
    if (!model) return 'None';
    try {
      if (model.GetTitle) {
        try {
          return model.GetTitle();
        } catch (e) {
          // GetTitle failed, try GetPathName as fallback
          if (model.GetPathName) {
            try {
              const pathStr = model.GetPathName();
              if (pathStr && pathStr.trim()) {
                return pathStr.split('\\').pop() ?? 'Untitled';
              }
            } catch (e2) {
              // GetPathName also failed
            }
          }
        }
      }
      if (model.GetPathName) {
        try {
          const pathStr = model.GetPathName();
          if (pathStr && pathStr.trim()) {
            return pathStr.split('\\').pop() ?? 'Untitled';
          }
        } catch (e) {
          // GetPathName failed
        }
      }
    } catch (e) {
      // Ignore
    }
    return 'Unknown';
  }

  /**
   * Ensure current model is synced with active document
   */
  static ensureCurrentModel(
    swApp: ISldWorksApp | null,
    currentModel: IModelDoc2 | null
  ): IModelDoc2 | null {
    if (!swApp) return currentModel;
    
    // Always try to sync with the active document
    try {
      // Robust retrieval of active document
      let activeDoc = null;
      try {
        activeDoc = swApp.ActiveDoc;
      } catch (e) {
        // Fallback to GetActiveDoc method
        try {
          if (swApp.GetActiveDoc) {
            activeDoc = swApp.GetActiveDoc();
          }
        } catch (e2) {
          // Both failed
        }
      }

      if (activeDoc) {
        // Check if the active doc has changed
        if (!currentModel || currentModel !== activeDoc) {
          logger.info(`Synced with active document: ${this.getModelTitle(activeDoc)}`);
          return activeDoc;
        }
        return currentModel;
      } else if (!currentModel) {
        // No active doc and no current model - try to get any open doc
        try {
          const docCount = swApp.GetDocumentCount();
          if (docCount > 0) {
            // Get the first document
            const docs = swApp.GetDocuments();
            if (docs && docs.length > 0) {
              logger.info(`Fallback to first document: ${this.getModelTitle(docs[0])}`);
              return docs[0];
            }
          }
        } catch (e2) {
          // GetDocumentCount might not be available
        }
      }
    } catch (e) {
      // ActiveDoc might throw if no documents are open or SW is busy
      logger.warn('Failed to sync current model with ActiveDoc', e as Error);
    }
    
    return currentModel;
  }
}

