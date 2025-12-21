/**
 * Selection-related helper functions
 * These are extracted from SolidWorksAPI to reduce file size and improve maintainability
 */

import { IModelDoc2 } from '../types/com-types.js';
import { logger } from '../../utils/logger.js';
import { toVariantBool } from '../../utils/com-boolean.js';
import { getRecentSketchSegment, getSegmentAndSketchNames } from './sketch.js';

/**
 * Select the "last" sketch segment
 */
export function selectLastSketchSegment(model: IModelDoc2 | null, append: boolean): boolean {
  if (!model) return false;

  try {
    const seg = getRecentSketchSegment(model, 'last');
    if (!seg) {
      logger.warn('Keyword "last" used but no recent sketch segment found');
      return false;
    }

    // Get segment and sketch names
    const { segmentName, sketchName } = getSegmentAndSketchNames(model, seg);

    // Use SelectByID2 with correct type
    return selectSegmentByID2(model, segmentName, sketchName, append);
  } catch (e) {
    logger.error('Failed to select last sketch segment', e as Error);
    return false;
  }
}

/**
 * Select segment using SelectByID2
 */
export function selectSegmentByID2(
  model: IModelDoc2 | null,
  segmentName: string,
  sketchName: string,
  append: boolean
): boolean {
  if (!model) return false;

  try {
    const ext = model.Extension;
    const sketchMgr = model.SketchManager;
    const activeSketch = sketchMgr && sketchMgr.ActiveSketch;

    if (!ext || !ext.SelectByID2) {
      return false;
    }

    // Determine if sketch is active
    const isSketchActive = activeSketch !== null && activeSketch !== undefined;

    let entityName = segmentName;
    let entityType = 'SKETCHSEGMENT';

    // If sketch is not active, use full name
    if (!isSketchActive && sketchName) {
      entityName = `${segmentName}@${sketchName}`;
      entityType = 'EXTSKETCHSEGMENT';
    }

    const appendBool = toVariantBool(append);
    const ok = ext.SelectByID2(
      entityName,
      entityType,
      0.0, 0.0, 0.0,
      appendBool,
      0,
      null,
      0
    );

    if (ok) {
      logger.info(`Selected last sketch segment via SelectByID2: ${entityName} (type: ${entityType})`);
      return true;
    } else {
      logger.warn(`SelectByID2 returned false for: ${entityName} (type: ${entityType})`);
    }
  } catch (selectByIdErr) {
    logger.warn('SelectByID2 failed for last segment', selectByIdErr as Error);
  }

  return false;
}

/**
 * Select sketch segment by heuristic matching (Line1, Arc2, etc.)
 */
export function selectByHeuristicMatch(model: IModelDoc2 | null, spec: string, append: boolean): boolean {
  if (!model) return false;

  try {
    const segmentMatch = /^(Line|Arc|Circle|直线|弧|圆|矩形|Point|点)(\d+)(@.*)?$/i.exec(spec);
    if (!segmentMatch) return false;

    const index = parseInt(segmentMatch[2], 10) - 1; // 1-based to 0-based

    const sketchMgr = model.SketchManager;
    const activeSketch = sketchMgr && sketchMgr.ActiveSketch;

    if (activeSketch && activeSketch.GetSketchSegments) {
      const segmentsRaw = activeSketch.GetSketchSegments() as any;
      if (segmentsRaw) {
        let segments: any[] = [];

        // Convert to array
        if (Array.isArray(segmentsRaw)) {
          segments = segmentsRaw;
        } else if (typeof segmentsRaw.length === 'number') {
          segments = Array.from(segmentsRaw);
        } else if (typeof segmentsRaw.Count !== 'undefined') {
          const count = segmentsRaw.Count;
          for (let i = 0; i < count; i++) {
            const item = segmentsRaw.Item ? segmentsRaw.Item(i) : segmentsRaw[i];
            if (item) segments.push(item);
          }
        }

        if (segments.length > index && index >= 0) {
          const seg = segments[index];
          if (seg && seg.Select4 && typeof seg.Select4 === 'function') {
            const appendBool = toVariantBool(append);
            const ok = !!seg.Select4(appendBool, null);
            if (ok) {
              logger.info(`Selected sketch segment index ${index} for "${spec}" via Select4`);
              return ok;
            }
          }
        }
      }
    }
  } catch (e) {
    logger.warn(`Heuristic segment selection failed for "${spec}"`, e as Error);
  }

  return false;
}

/**
 * Fallback selection using SelectByID2 with multiple type attempts
 */
export function selectByID2Fallback(model: IModelDoc2 | null, spec: string, append: boolean): boolean {
  if (!model) return false;

  try {
    const ext = model.Extension;
    if (!ext || !ext.SelectByID2) {
      return false;
    }

    // Prepare name variations
    const nameVariations = [spec];
    if (spec.includes('@')) {
      nameVariations.push(spec.split('@')[0]);
    }

    // Prepare types to try
    const sketchMgr = model.SketchManager;
    const activeSketch = sketchMgr && sketchMgr.ActiveSketch;

    const types = activeSketch
      ? ['SKETCHSEGMENT', 'EXTSKETCHSEGMENT', 'BODYFEATURE', 'COMPONENT', 'FACE', 'EDGE', 'PLANE']
      : ['EXTSKETCHSEGMENT', 'BODYFEATURE', 'COMPONENT', 'FACE', 'EDGE', 'PLANE'];

    for (const name of nameVariations) {
      for (const type of types) {
        try {
          const appendBool = toVariantBool(append);
          const ok = ext.SelectByID2(name, type, 0.0, 0.0, 0.0, appendBool, 0, null, 0);
          if (ok) {
            logger.info(`Selected "${name}" as ${type}`);
            return true;
          }
        } catch (e: any) {
          // Handle type mismatch error
          if (e.errno === -2147352571) {
            try {
              const appendBool = toVariantBool(append);
              const ok2 = ext.SelectByID2(name, type, 0, 0, 0, appendBool, 0, undefined, 0);
              if (ok2) return true;
            } catch (e2) {}
          }
        }
      }
    }

    return false;
  } catch (e) {
    logger.warn(`SelectByID2 failed for entity "${spec}"`, e as Error);
    return false;
  }
}
