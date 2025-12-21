/**
 * Sketch-related helper functions
 * These are extracted from SolidWorksAPI to reduce file size and improve maintainability
 */

import { IModelDoc2, ISketch, ISketchSegment, IFeature } from '../types/com-types.js';
import { logger } from '../../utils/logger.js';
import { traverseFeatures } from '../../utils/feature-utils.js';

/**
 * Find the most recent sketch in a model
 */
export function findMostRecentSketch(model: IModelDoc2 | null): IFeature | null {
  if (!model) return null;
  try {
    let lastSketch: any = null;

    // Traverse features and track the last sketch found
    traverseFeatures(model, ({ feature, typeName }) => {
      if (typeName === 'ProfileFeature' || typeName.includes('Sketch')) {
        lastSketch = feature;
      }
      return false; // Continue until end to find the last one
    });

    return lastSketch;
  } catch (e) {
    return null;
  }
}

/**
 * Get segments from a sketch
 */
export function getSegmentsFromSketch(sketch: ISketch | null, mode: 'last' | 'first'): ISketchSegment | null {
  if (!sketch) {
    return null;
  }

  try {
    // Check if GetSketchSegments method exists
    if (!sketch.GetSketchSegments || typeof sketch.GetSketchSegments !== 'function') {
      logger.warn('GetSketchSegments method not available on sketch object');
      return null;
    }

    // Get count as a hint
    let count = 0;
    try {
      if (sketch.GetSketchSegmentCount && typeof sketch.GetSketchSegmentCount === 'function') {
        const countResult = sketch.GetSketchSegmentCount();
        if (countResult !== null && countResult !== undefined) {
          count = Number(countResult);
        }
      }
    } catch (e) {
      logger.warn('GetSketchSegmentCount() failed', e as Error);
    }

    // Get segments array
    let segmentsRaw: any = null;
    try {
      segmentsRaw = sketch.GetSketchSegments();
    } catch (e) {
      logger.warn('GetSketchSegments() direct call failed', e as Error);
      return null;
    }

    // CRITICAL: SolidWorks returns null for empty sketch
    if (segmentsRaw === null || segmentsRaw === undefined) {
      return null;
    }

    // Convert to array
    let segments: any[] = [];

    try {
      // Method 1: Use valueOf()
      if (segmentsRaw.valueOf && typeof segmentsRaw.valueOf === 'function') {
        const value = segmentsRaw.valueOf();
        if (Array.isArray(value)) {
          segments = value;
        } else if (value && typeof value.length === 'number' && value.length > 0) {
          for (let i = 0; i < value.length; i++) {
            if (value[i]) segments.push(value[i]);
          }
        }
      }
      // Method 2: Already an array
      else if (Array.isArray(segmentsRaw)) {
        segments = segmentsRaw;
      }
      // Method 3: Direct array access
      else if (segmentsRaw && typeof segmentsRaw.length === 'number' && segmentsRaw.length > 0 && segmentsRaw.length < 1000) {
        const maxLen = Math.min(segmentsRaw.length, 100);
        for (let i = 0; i < maxLen; i++) {
          try {
            if (segmentsRaw[i]) {
              segments.push(segmentsRaw[i]);
            }
          } catch (itemErr) {
            break;
          }
        }
      }
      // Method 4: Use count if available
      else if (count > 0 && count < 1000) {
        for (let i = 0; i < count; i++) {
          try {
            if (segmentsRaw[i]) {
              segments.push(segmentsRaw[i]);
            }
          } catch (e) {
            break;
          }
        }
      }
    } catch (conversionErr) {
      logger.error('Failed to convert segments collection', conversionErr as Error);
      return null;
    }

    if (segments.length === 0) {
      // Fallback: Single object
      try {
        if (segmentsRaw && typeof segmentsRaw.Select4 === 'function') {
          return segmentsRaw;
        }
      } catch (e) {
        // Select4 check failed
      }
      logger.warn(`No segments found in GetSketchSegments result`);
      return null;
    }

    const targetSeg = mode === 'first' ? segments[0] : segments[segments.length - 1];
    if (!targetSeg) {
      return null;
    }

    logger.info(`Found ${segments.length} sketch segments, returning ${mode === 'first' ? 'first' : 'last'} one`);
    return targetSeg;
  } catch (e) {
    logger.error('getSegmentsFromSketch failed with error', e as Error);
    return null;
  }
}

/**
 * Get recent sketch segment from model
 */
export function getRecentSketchSegment(model: IModelDoc2 | null, mode: 'last' | 'first' = 'last'): ISketchSegment | null {
  if (!model) {
    return null;
  }

  try {
    const sketchMgr = model.SketchManager;
    if (!sketchMgr) {
      return null;
    }

    // Get active sketch
    let activeSketch: ISketch | null = null;
    try {
      activeSketch = sketchMgr.ActiveSketch;
    } catch (e) {
      logger.warn('Failed to get ActiveSketch', e as Error);
      return null;
    }

    if (!activeSketch) {
      // Try to activate the most recent sketch
      try {
        const recentSketch = findMostRecentSketch(model);
        if (recentSketch) {
          try {
            recentSketch.Select2(false, 0);
          } catch (selectErr) {
            logger.warn('Select2 failed in getRecentSketchSegment', selectErr as Error);
            return null;
          }

          try {
            model.EditSketch();
          } catch (editErr) {
            logger.warn('EditSketch failed in getRecentSketchSegment', editErr as Error);
            return null;
          }

          try {
            const newActiveSketch = sketchMgr.ActiveSketch;
            if (newActiveSketch) {
              return getSegmentsFromSketch(newActiveSketch, mode);
            }
          } catch (e) {
            logger.warn('Failed to get new ActiveSketch after EditSketch', e as Error);
          }
        }
      } catch (e) {
        logger.warn('Failed to activate sketch for getRecentSketchSegment', e as Error);
      }
      return null;
    }

    return getSegmentsFromSketch(activeSketch, mode);
  } catch (e) {
    logger.warn('getRecentSketchSegment failed', e as Error);
    return null;
  }
}

/**
 * Get segment name and sketch name from a segment
 */
export function getSegmentAndSketchNames(
  model: IModelDoc2 | null,
  seg: any
): { segmentName: string; sketchName: string } {
  if (!model) return { segmentName: '', sketchName: '' };

  let segmentName = '';
  let sketchName = '';

  try {
    // Get segment name
    if (seg.GetName && typeof seg.GetName === 'function') {
      segmentName = seg.GetName();
    } else if (seg.Name) {
      segmentName = String(seg.Name);
    }

    // Get sketch name
    const sketchMgr = model.SketchManager;
    const activeSketch = sketchMgr && sketchMgr.ActiveSketch;
    if (activeSketch) {
      try {
        if (seg.GetSketch && typeof seg.GetSketch === 'function') {
          const segSketch = seg.GetSketch();
          if (segSketch) {
            const sketchFeat = traverseFeatures(model, ({ feature, typeName }) => {
              if ((typeName === 'ProfileFeature' || typeName.includes('Sketch')) && feature.GetSpecificFeature2) {
                try {
                  const featSketch = feature.GetSpecificFeature2();
                  if (featSketch === segSketch || featSketch === activeSketch) {
                    return true;
                  }
                } catch (e) {}
              }
              return false;
            });

            if (sketchFeat) {
              sketchName = sketchFeat.Name || (sketchFeat.GetName ? sketchFeat.GetName() : '');
            }
          }
        }

        // Fallback: use active sketch name
        if (!sketchName && activeSketch.Name) {
          sketchName = String(activeSketch.Name);
        } else if (!sketchName && activeSketch.GetName && typeof activeSketch.GetName === 'function') {
          sketchName = activeSketch.GetName();
        }
      } catch (e) {
        logger.warn('Failed to get sketch name', e as Error);
      }
    }
  } catch (e) {
    logger.warn('Failed to get segment/sketch name', e as Error);
  }

  return { segmentName, sketchName };
}
