/**
 * Test Model Utilities
 * Provides functions to create, open, and manage test models
 */

import { SolidWorksAPI } from '../../src/solidworks/api.js';
import { IModelDoc2 } from '../../src/solidworks/types/com-types.js';
import { getSwApp } from './solidworks-setup.js';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a temporary part file path
 */
export function getTempPartPath(name?: string): string {
  const fileName = name || `test_part_${uuidv4()}.SLDPRT`;
  return join(process.cwd(), 'tests', 'temp', fileName);
}

/**
 * Create a temporary assembly file path
 */
export function getTempAssemblyPath(name?: string): string {
  const fileName = name || `test_assembly_${uuidv4()}.SLDASM`;
  return join(process.cwd(), 'tests', 'temp', fileName);
}

/**
 * Create a temporary drawing file path
 */
export function getTempDrawingPath(name?: string): string {
  const fileName = name || `test_drawing_${uuidv4()}.SLDDRW`;
  return join(process.cwd(), 'tests', 'temp', fileName);
}

/**
 * Create a new part for testing
 */
export async function createTestPart(api: SolidWorksAPI): Promise<IModelDoc2 | null> {
  const modelInfo = api.createPart();
  return api.getCurrentModel();
}

/**
 * Open a model file for testing
 */
export async function openTestModel(api: SolidWorksAPI, filePath: string): Promise<IModelDoc2 | null> {
  api.openModel(filePath);
  return api.getCurrentModel();
}

/**
 * Close and optionally delete a test model
 */
export async function closeTestModel(
  api: SolidWorksAPI,
  save: boolean = false,
  deleteFile: boolean = false
): Promise<void> {
  const model = api.getCurrentModel();
  if (model) {
    const filePath = model.GetPathName();
    api.closeModel(save);
    
    if (deleteFile && filePath) {
      try {
        const fs = await import('fs/promises');
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore file deletion errors
      }
    }
  }
}

/**
 * Create a simple test part with a sketch
 */
export async function createPartWithSketch(api: SolidWorksAPI): Promise<{
  model: IModelDoc2 | null;
  sketchName: string;
}> {
  const model = await createTestPart(api);
  
  // Create a sketch on the Front plane
  const sketchResult = api.createSketch({ plane: 'Front' });
  
  if (!sketchResult.success || !sketchResult.sketchName) {
    throw new Error('Failed to create sketch');
  }
  
  return {
    model,
    sketchName: sketchResult.sketchName
  };
}

/**
 * Create a test part with a simple extrusion
 */
export async function createPartWithExtrusion(api: SolidWorksAPI): Promise<{
  model: IModelDoc2 | null;
  sketchName: string;
  featureId: string;
}> {
  const { model, sketchName } = await createPartWithSketch(api);
  
  // Add a simple rectangle
  const line1 = api.addLine({ x1: 0, y1: 0, z1: 0, x2: 100, y2: 0, z2: 0 });
  const line2 = api.addLine({ x1: 100, y1: 0, z1: 0, x2: 100, y2: 100, z2: 0 });
  const line3 = api.addLine({ x1: 100, y1: 100, z1: 0, x2: 0, y2: 100, z2: 0 });
  const line4 = api.addLine({ x1: 0, y1: 100, z1: 0, x2: 0, y2: 0, z2: 0 });
  
  // Exit sketch
  const currentModel = api.getCurrentModel();
  if (currentModel) {
    currentModel.SketchManager.InsertSketch(true);
  }
  
  // Create extrusion
  const extrudeResult = api.extrude({ depth: 25 });
  
  if (!extrudeResult.success || !extrudeResult.featureId) {
    throw new Error('Failed to create extrusion');
  }
  
  return {
    model,
    sketchName,
    featureId: extrudeResult.featureId
  };
}

/**
 * Clean up all temporary test files
 */
export async function cleanupTempFiles(): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const tempDir = path.join(process.cwd(), 'tests', 'temp');
    
    try {
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        if (file !== '.gitkeep') {
          try {
            await fs.unlink(path.join(tempDir, file));
          } catch (error) {
            // Ignore individual file deletion errors
          }
        }
      }
    } catch (error) {
      // Directory might not exist, that's okay
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

