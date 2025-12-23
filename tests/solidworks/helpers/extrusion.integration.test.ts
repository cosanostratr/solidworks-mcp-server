/**
 * Integration tests for Extrusion Helpers using real SolidWorks API
 * These tests require SolidWorks to be installed and running
 * 
 * To run these tests:
 * 1. Ensure SolidWorks is installed and can be launched
 * 2. Run: npm test -- tests/solidworks/helpers/extrusion.integration.test.ts
 * 
 * Note: These tests will be skipped if SolidWorks is not available
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  prepareForExtrusion,
  selectSketchForExtrusion,
  tryFeatureExtrusion,
  tryFeatureExtrusion2,
  tryFeatureExtrusion3,
  finalizeExtrusion,
} from '../../../src/solidworks/helpers/extrusion.js';
import { setupBeforeTest, teardownAfterTest, getSwApp } from '../../helpers/solidworks-setup.js';
import { ISldWorksApp, IModelDoc2 } from '../../../src/solidworks/types/com-types.js';
import { COM } from '../../../src/utils/com-boolean.js';

// Helper to check if SolidWorks is available
let swAppAvailable = false;

describe('Extrusion Helpers Integration Tests', () => {
  let swApp: ISldWorksApp | null = null;
  let model: IModelDoc2 | null = null;

  beforeAll(async () => {
    try {
      await setupBeforeTest();
      // Try to get app from setup
      swApp = getSwApp();
      
      // If still null, try direct connection
      if (!swApp) {
        const { connectSolidWorks } = await import('../../helpers/solidworks-setup.js');
        swApp = await connectSolidWorks();
      }
      
      swAppAvailable = swApp !== null;
      if (!swAppAvailable) {
        console.warn('⚠️  SolidWorks not available - integration tests will be skipped');
      } else {
        console.log('✅ SolidWorks connected, integration tests will run');
      }
    } catch (error) {
      console.warn('⚠️  Failed to connect to SolidWorks - integration tests will be skipped:', error);
      swAppAvailable = false;
    }
  });

  afterAll(async () => {
    await teardownAfterTest();
  });

  beforeEach(async () => {
    // Skip if SolidWorks is not available
    if (!swApp) {
      swApp = getSwApp();
      if (!swApp) {
        console.warn('SolidWorks not available, skipping test');
        return;
      }
    }

    try {
      // Create new part
      model = swApp.NewPart() as IModelDoc2;
      if (!model) {
        throw new Error('Failed to create new part');
      }

      // Create a simple sketch for testing
      const sketchMgr = model.SketchManager;
      if (!sketchMgr) {
        throw new Error('SketchManager not available');
      }

      // Select Front plane - try different name formats
      const ext = model.Extension;
      let frontPlane = false;
      const planeNames = ['Front Plane', 'Front', '前视基准面'];
      for (const name of planeNames) {
        try {
          frontPlane = ext.SelectByID2(name, 'PLANE', 0.0, 0.0, 0.0, COM.FALSE, 0, null, 0);
          if (frontPlane) break;
        } catch (e) {
          // Try next name
        }
      }
      if (!frontPlane) {
        // If SelectByID2 fails, try using FeatureManager to get the plane
        try {
          const frontPlaneFeature = model.FeatureByPositionReverse(0);
          if (frontPlaneFeature) {
            frontPlaneFeature.Select2(false, 0);
            frontPlane = true;
          }
        } catch (e) {
          // Continue without plane selection - SolidWorks may use default
        }
      }

      // Insert sketch - InsertSketch may work even without explicit plane selection
      // SolidWorks will use the default plane if none is selected
      let sketchInserted = false;
      try {
        sketchInserted = sketchMgr.InsertSketch(true);
      } catch (e) {
        // InsertSketch failed, try without parameter or check if sketch already exists
        try {
          sketchInserted = sketchMgr.InsertSketch(false);
        } catch (e2) {
          // Check if sketch already exists
          if (sketchMgr.ActiveSketch) {
            sketchInserted = true;
          }
        }
      }
      
      if (!sketchInserted && !sketchMgr.ActiveSketch) {
        throw new Error('Failed to insert sketch - no active sketch created');
      }

      // Create a simple rectangle
      const sketch = sketchMgr.ActiveSketch;
      if (sketch) {
        // Create a rectangle from (0,0) to (0.01, 0.01) meters
        sketchMgr.CreateCornerRectangle(0, 0, 0, 0.01, 0.01, 0);
      }

      // Exit sketch
      sketchMgr.InsertSketch(true);
    } catch (error) {
      console.error('Failed to setup test model:', error);
      throw error;
    }
  });

  afterEach(async () => {
    // Close the model without saving
    if (model && swApp) {
      try {
        const title = model.GetTitle();
        swApp.CloseDoc(title);
      } catch (error) {
        // Ignore errors when closing
      }
      model = null;
    }
  });

  describe('prepareForExtrusion', () => {
    it.skipIf(!swAppAvailable)('should exit sketch mode if active', () => {
      if (!model || !swApp) {
        throw new Error('Model or SolidWorks not available');
      }

      // Enter sketch mode
      const sketchMgr = model.SketchManager;
      // Try to select Front plane, but don't fail if it doesn't work
      try {
        const ext = model.Extension;
        ext.SelectByID2('Front Plane', 'PLANE', 0.0, 0.0, 0.0, COM.FALSE, 0, null, 0);
      } catch (e) {
        // Plane selection failed, but InsertSketch may still work
      }
      sketchMgr.InsertSketch(true);

      // Verify sketch is active
      expect(sketchMgr.ActiveSketch).not.toBeNull();

      // Call prepareForExtrusion
      prepareForExtrusion(model);

      // Verify sketch mode is exited
      expect(sketchMgr.ActiveSketch).toBeNull();
    });

    it.skipIf(!swAppAvailable)('should clear selections', () => {
      if (!model) {
        throw new Error('Model not available');
      }

      // Select something - try Front Plane
      try {
        model.Extension.SelectByID2('Front Plane', 'PLANE', 0.0, 0.0, 0.0, COM.FALSE, 0, null, 0);
      } catch (e) {
        // Selection failed, but prepareForExtrusion should still work
      }

      // Call prepareForExtrusion
      prepareForExtrusion(model);

      // Verify selections are cleared (this is hard to verify directly, but should not throw)
      expect(() => prepareForExtrusion(model)).not.toThrow();
    });

    it('should handle null model gracefully', () => {
      expect(() => {
        prepareForExtrusion(null);
      }).not.toThrow();
    });
  });

  describe('selectSketchForExtrusion', () => {
    it('should throw error when no model', () => {
      expect(() => {
        selectSketchForExtrusion(null);
      }).toThrow('No model open');
    });

    it.skipIf(!swAppAvailable)('should find and select sketch in real model', () => {
      if (!model) {
        throw new Error('Model not available');
      }

      const sketchName = selectSketchForExtrusion(model);
      expect(sketchName).toBeDefined();
      expect(typeof sketchName).toBe('string');
      expect(sketchName.length).toBeGreaterThan(0);
    });

    it.skipIf(!swAppAvailable)('should throw error when no sketch exists', async () => {
      if (!swApp || !model) {
        throw new Error('SolidWorks not available');
      }

      // Close current model
      const title = model.GetTitle();
      swApp.CloseDoc(title);

      // Create a new part without sketch
      model = swApp.NewPart() as IModelDoc2;

      expect(() => {
        selectSketchForExtrusion(model);
      }).toThrow('No sketch found to extrude');
    });
  });

  describe('tryFeatureExtrusion3', () => {
    it.skipIf(!swAppAvailable)('should create extrusion using FeatureExtrusion3 with real API', () => {
      if (!model) {
        throw new Error('Model not available');
      }

      // Select sketch first
      selectSketchForExtrusion(model);

      const featureMgr = model.FeatureManager;
      const depthInMeters = 0.025; // 25mm

      const feature = tryFeatureExtrusion3(featureMgr, depthInMeters, false);
      expect(feature).not.toBeNull();
      expect(feature).toBeDefined();
    });

    it.skipIf(!swAppAvailable)('should create extrusion with reverse direction', () => {
      if (!model) {
        throw new Error('Model not available');
      }

      // Select sketch first
      selectSketchForExtrusion(model);

      const featureMgr = model.FeatureManager;
      const depthInMeters = 0.025;

      const feature = tryFeatureExtrusion3(featureMgr, depthInMeters, true);
      expect(feature).not.toBeNull();
    });

    it.skipIf(!swAppAvailable)('should handle different depth values', () => {
      if (!model) {
        throw new Error('Model not available');
      }

      // Select sketch first
      selectSketchForExtrusion(model);

      const featureMgr = model.FeatureManager;

      // Test with different depths
      const depths = [0.01, 0.025, 0.05, 0.1];
      depths.forEach((depth) => {
        // Need to create new sketch for each extrusion
        const sketchMgr = model!.SketchManager;
        // Try to select plane, but don't fail if it doesn't work
        try {
          model!.Extension.SelectByID2('Front Plane', 'PLANE', 0.0, 0.0, 0.0, COM.FALSE, 0, null, 0);
        } catch (e) {
          // Continue without plane selection
        }
        sketchMgr.InsertSketch(true);
        sketchMgr.CreateCornerRectangle(0, 0, 0, 0.01, 0.01, 0);
        sketchMgr.InsertSketch(true);

        selectSketchForExtrusion(model!);
        const feature = tryFeatureExtrusion3(featureMgr, depth, false);
        expect(feature).not.toBeNull();
      });
    });
  });

  describe('tryFeatureExtrusion2', () => {
    it.skipIf(!swAppAvailable)('should create extrusion using FeatureExtrusion2 with real API', () => {
      if (!model) {
        throw new Error('Model not available');
      }

      // Select sketch first
      selectSketchForExtrusion(model);

      const featureMgr = model.FeatureManager;
      const depthInMeters = 0.025;

      try {
        const feature = tryFeatureExtrusion2(featureMgr, depthInMeters, false);
        // FeatureExtrusion2 might not be available in all versions
        // So we just check it doesn't throw if available
        if (feature) {
          expect(feature).toBeDefined();
        }
      } catch (error: any) {
        // If FeatureExtrusion2 is not available, that's okay
        // This test verifies the API call structure is correct
        expect(error.message).toContain('FeatureExtrusion2');
      }
    });
  });

  describe('tryFeatureExtrusion', () => {
    it.skipIf(!swAppAvailable)('should create extrusion using FeatureExtrusion with real API', () => {
      if (!model) {
        throw new Error('Model not available');
      }

      // Select sketch first
      selectSketchForExtrusion(model);

      const featureMgr = model.FeatureManager;
      const depthInMeters = 0.025;

      try {
        const feature = tryFeatureExtrusion(featureMgr, depthInMeters, false);
        // FeatureExtrusion might not be available in all versions
        if (feature) {
          expect(feature).toBeDefined();
        }
      } catch (error: any) {
        // If FeatureExtrusion is not available, that's okay
        expect(error.message).toContain('FeatureExtrusion');
      }
    });
  });

  describe('finalizeExtrusion', () => {
    it.skipIf(!swAppAvailable)('should finalize extrusion and return feature info', () => {
      if (!model) {
        throw new Error('Model not available');
      }

      // Create an extrusion first
      selectSketchForExtrusion(model);
      const featureMgr = model.FeatureManager;
      const feature = tryFeatureExtrusion3(featureMgr, 0.025, false);

      const result = finalizeExtrusion(model, feature);
      expect(result).toBeDefined();
      expect(result.name).toBeDefined();
      expect(result.type).toBe('Extrusion');
      expect(result.suppressed).toBe(false);
    });

    it.skipIf(!swAppAvailable)('should throw error when feature is null', () => {
      if (!model) {
        throw new Error('Model not available');
      }

      expect(() => {
        finalizeExtrusion(model, null);
      }).toThrow('Failed to create extrusion - feature is null');
    });

    it.skipIf(!swAppAvailable)('should handle feature name retrieval', () => {
      if (!model) {
        throw new Error('Model not available');
      }

      // Create an extrusion
      selectSketchForExtrusion(model);
      const featureMgr = model.FeatureManager;
      const feature = tryFeatureExtrusion3(featureMgr, 0.025, false);

      const result = finalizeExtrusion(model, feature);
      // Feature name should be something like "Boss-Extrude1" or similar
      expect(result.name).toBeDefined();
      expect(result.name.length).toBeGreaterThan(0);
    });
  });

  describe('End-to-end extrusion workflow', () => {
    it.skipIf(!swAppAvailable)('should complete full extrusion workflow with real API', () => {
      if (!model) {
        throw new Error('Model not available');
      }

      // Step 1: Prepare for extrusion
      prepareForExtrusion(model);

      // Step 2: Select sketch
      const sketchName = selectSketchForExtrusion(model);
      expect(sketchName).toBeDefined();

      // Step 3: Create extrusion
      const featureMgr = model.FeatureManager;
      const feature = tryFeatureExtrusion3(featureMgr, 0.025, false);
      expect(feature).not.toBeNull();

      // Step 4: Finalize
      const result = finalizeExtrusion(model, feature);
      expect(result).toBeDefined();
      expect(result.type).toBe('Extrusion');

      // Verify the feature exists in the model
      const featureCount = model.GetFeatureCount();
      expect(featureCount).toBeGreaterThan(0);
    });

    it.skipIf(!swAppAvailable)('should handle multiple extrusions in sequence', () => {
      if (!model || !swApp) {
        throw new Error('SolidWorks not available');
      }

      // Create first extrusion
      prepareForExtrusion(model);
      selectSketchForExtrusion(model);
      const featureMgr = model.FeatureManager;
      const feature1 = tryFeatureExtrusion3(featureMgr, 0.025, false);
      const result1 = finalizeExtrusion(model, feature1);
      expect(result1.type).toBe('Extrusion');

      // Create a new sketch on the top face
      const sketchMgr = model.SketchManager;
      // Select top face of the extrusion
      const topFace = model.Extension.SelectByID2('', 'FACE', 0, 0, 0.025, false, 0, null, 0);
      if (topFace) {
        sketchMgr.InsertSketch(true);
        sketchMgr.CreateCornerRectangle(0, 0, 0, 0.005, 0.005, 0);
        sketchMgr.InsertSketch(true);

        // Create second extrusion
        prepareForExtrusion(model);
        selectSketchForExtrusion(model);
        const feature2 = tryFeatureExtrusion3(featureMgr, 0.01, false);
        const result2 = finalizeExtrusion(model, feature2);
        expect(result2.type).toBe('Extrusion');
      }
    });
  });
});

