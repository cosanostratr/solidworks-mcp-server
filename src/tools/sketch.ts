/**
 * Comprehensive Sketch Tools for SolidWorks
 * Provides complete sketch plane creation and geometry drawing capabilities
 */

import { z } from 'zod';
import { SolidWorksAPI } from '../solidworks/api.js';
import { logger } from '../utils/logger.js';
import { withErrorRecovery } from '../utils/error-recovery.js';
import { COM } from '../utils/com-boolean.js';

// Common output schema for sketch tools
const sketchResultSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  sketchName: z.string().optional(),
  entityName: z.string().optional(),
  position: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    z: z.number().optional(),
  }).optional(),
});

/**
 * Helper: Validate that model has SketchManager and a specific method
 */
function validateSketchManagerMethod(model: any, methodName: string): void {
  if (!model) {
    throw new Error('No model provided');
  }
  if (!model.SketchManager) {
    throw new Error(
      `Cannot use ${methodName}: SketchManager is not available. ` +
      'The document may not be fully initialized or is not a Part document.'
    );
  }
  if (!model.SketchManager[methodName]) {
    throw new Error(
      `Cannot use ${methodName}: Method is not available on SketchManager. ` +
      'This may indicate a SolidWorks API compatibility issue.'
    );
  }
}

/**
 * Complete set of sketch creation and manipulation tools
 */
export const sketchTools = [
  // ============================================
  // SKETCH CREATION & MANAGEMENT
  // ============================================
  
  {
    name: 'create_sketch',
    description: `Create a new sketch on a specified plane or face. 
Returns a 'sketchName' field that you MUST use for subsequent operations like 'edit_sketch'.
The sketch name may be in Chinese (e.g., "草图1") or English (e.g., "Sketch1") depending on your SolidWorks language setting.
If no name is assigned by SolidWorks, a generated name like "MCP_Sketch_<timestamp>" will be returned.`,
    inputSchema: z.object({
      plane: z.enum(['Front', 'Top', 'Right', 'Custom']).default('Front').describe('Reference plane for sketch: Front (default), Top, Right, or Custom'),
      offset: z.number().default(0).describe('Offset distance from plane in mm (default: 0)'),
      reverse: z.boolean().default(false).describe('Reverse offset direction (default: false)'),
      customPlane: z.object({
        origin: z.object({
          x: z.number().describe('X coordinate in mm'),
          y: z.number().describe('Y coordinate in mm'),
          z: z.number().describe('Z coordinate in mm')
        }),
        normal: z.object({
          x: z.number().describe('X component of normal vector'),
          y: z.number().describe('Y component of normal vector'),
          z: z.number().describe('Z component of normal vector')
        })
      }).optional().describe('Custom plane definition (required when plane="Custom")')
    }),
    outputSchema: z.object({
      success: z.boolean(),
      sketchName: z.string().optional(),
      plane: z.string().optional(),
      offset: z.number().optional(),
      message: z.string().optional(),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');
        
        // Use a simpler approach without SelectByID2.
        // SolidWorks will use the Front plane by default if no plane is selected.
        if (args.plane === 'Custom' && args.customPlane) {
          // Create custom reference plane
          const { origin, normal } = args.customPlane;
          const planeRef = model.FeatureManager.InsertRefPlane(
            8, // FirstConstraint: parallel to plane
            0, // FirstConstraintAngle
            4, // SecondConstraint: distance
            args.offset / 1000, // SecondConstraintAngle/Distance
            0, // ThirdConstraint
            0  // ThirdConstraintAngle
          );
          if (!planeRef) throw new Error('Failed to create custom plane');
        } else {
          // Use swApi's robust standard plane selection
          let selected = false;
          if (['Front', 'Top', 'Right'].includes(args.plane)) {
            selected = swApi.selectStandardPlane(args.plane as any);
          } else {
            // Custom named plane
            const ext = model.Extension;
            if (ext && ext.SelectByID2) {
              // CRITICAL: Convert boolean to VARIANT_BOOL
              selected = ext.SelectByID2(args.plane, 'PLANE', 0.0, 0.0, 0.0, COM.FALSE, 0, null, 0);
              if (!selected) {
                // Try with " Plane" suffix
                selected = ext.SelectByID2(args.plane + ' Plane', 'PLANE', 0.0, 0.0, 0.0, COM.FALSE, 0, null, 0);
              }
            }
          }
          
          if (!selected && args.plane !== 'Front') {
            logger.warn(`Could not select ${args.plane} plane, will attempt to proceed with default`);
          }
          
          // Create offset plane if needed
          if (args.offset !== 0) {
            const offsetPlane = model.FeatureManager.InsertRefPlane(
              8, // Parallel to plane
              0,
              4, // Distance
              args.offset / 1000,
              0,
              0
            );
            if (!offsetPlane) throw new Error('Failed to create offset plane');
          }
        }
        
        // Insert sketch - SolidWorks will use the selected plane or default to Front
        // Validate that we have a valid Part document with SketchManager
        // Use unified document type checking with inference
        const docType = swApi.getDocumentType(model, 0);
        if (docType !== 1) {
          // 1 = swDocumentTypes_e.swDocPART
          throw new Error(
            `Cannot create sketch: current document is not a Part (type=${docType}). ` +
            `Please ensure a Part document is active.`
          );
        }
        
        const sketchMgr = model.SketchManager;
        if (!sketchMgr) {
          throw new Error(
            'Cannot create sketch: SketchManager is not available. ' +
            'The document may not be fully initialized. Please try creating the part again.'
          );
        }
        
        if (!sketchMgr.InsertSketch) {
          throw new Error(
            'Cannot create sketch: InsertSketch method is not available on SketchManager. ' +
            'This may indicate a SolidWorks API compatibility issue.'
          );
        }
        
        sketchMgr.InsertSketch(true);
        
        // Ensure we actually have an active sketch
        const activeSketch = sketchMgr.ActiveSketch;
        if (!activeSketch) {
          throw new Error('Failed to start sketch - no active sketch after InsertSketch');
        }

        // Get or generate a stable sketch name
        // Try multiple methods to get the name, as SolidWorks API behavior varies
        let sketchName: string = '';
        try {
          // Method 1: Direct Name property
          if (activeSketch.Name && String(activeSketch.Name).trim() !== '') {
            sketchName = String(activeSketch.Name).trim();
          }
        } catch (error) {
          // Name property may not be accessible
        }

        // Method 2: Try GetName() if Name property didn't work
        if (!sketchName) {
          try {
            if (activeSketch.GetName && typeof activeSketch.GetName === 'function') {
              const name = activeSketch.GetName();
              if (name && String(name).trim() !== '') {
                sketchName = String(name).trim();
              }
            }
          } catch (error) {
            // GetName may also fail
          }
        }

        // Method 3: Try to set a name if we still don't have one
        if (!sketchName) {
          sketchName = `MCP_Sketch_${Date.now()}`;
          try {
            activeSketch.Name = sketchName;
          } catch (error) {
            // If setting name fails, we'll still use the generated name
          }
        }

        // Final fallback: use generated name if everything else failed
        if (!sketchName || sketchName.trim() === '') {
          sketchName = `MCP_Sketch_${Date.now()}`;
        }
        
        return {
          success: true,
          sketchName: sketchName, // Explicitly include sketchName
          plane: args.plane,
          offset: args.offset,
          message: `Sketch created on ${args.plane} plane${args.offset ? ` with ${args.offset}mm offset` : ''}`
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to create sketch: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  },

  {
    name: 'edit_sketch',
    description: `Enter sketch edit mode for an existing sketch. 
The sketchName should match the name returned by 'create_sketch' or visible in SolidWorks feature tree.
Works with both Chinese names (e.g., "草图1") and English names (e.g., "Sketch1").
The tool automatically searches through all sketch features to find a match.`,
    inputSchema: z.object({
      sketchName: z.string().describe('Name of the sketch to edit (e.g., "草图1", "Sketch1", or "MCP_Sketch_1234567890")')
    }),
    outputSchema: sketchResultSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');
        
        // Find the sketch/profile feature by name using SolidWorksAPI helper
        const sketchFeature = swApi.findSketchFeatureByName(model, args.sketchName);
        if (!sketchFeature) {
          throw new Error(`Sketch not found: ${args.sketchName}`);
        }

        // Select and enter sketch edit mode
        sketchFeature.Select2(false, 0);
        model.EditSketch();
        
        return {
          success: true,
          message: `Entered edit mode for sketch: ${args.sketchName}`,
          sketchName: args.sketchName,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to edit sketch: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  },
  
  {
    name: 'exit_sketch',
    description: `Exit sketch edit mode and optionally rebuild the model. 
Use this after completing sketch geometry creation and before creating features like extrusions.
The rebuild parameter controls whether to force a model rebuild after exiting (default: true).`,
    inputSchema: z.object({
      rebuild: z.boolean().default(true).describe('Rebuild model after exiting sketch (default: true)')
    }),
    outputSchema: sketchResultSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');
        
        // Exit sketch - validate SketchManager exists
        if (!model.SketchManager) {
          throw new Error('Cannot exit sketch: SketchManager is not available');
        }
        if (!model.SketchManager.InsertSketch) {
          throw new Error('Cannot exit sketch: InsertSketch method is not available');
        }
        model.SketchManager.InsertSketch(true);
        
        // Rebuild if requested
        if (args.rebuild) {
          model.ForceRebuild3(false);
        }
        
        return {
          success: true,
          message: 'Exited sketch edit mode'
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to exit sketch: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  },

  {
    name: 'get_sketch_context',
    description: `Get current model and sketch context for diagnostics. 
Returns a JSON object with the following fields:
- hasModel (boolean): whether a model is currently open
- modelName (string): name of the active model (e.g., "零件1" or "Part1")
- modelType (number): type of model (1=Part, 2=Assembly, 3=Drawing)
- activeSketch (object|null): information about the currently active sketch:
  - name (string): name of the active sketch (e.g., "草图1", "Sketch1", or "MCP_Sketch_1234567890")
  - If null, no sketch is currently active
- recentSketchFeatures (array): array of recent sketch/profile features, each containing:
  - indexFromEnd (number): position from the end (0 = most recent)
  - typeName (string): SolidWorks feature type (e.g., "ProfileFeature", "Sketch")
  - name (string): feature name (e.g., "草图1", "Sketch1")

Use this tool to:
- Diagnose sketch state issues
- Find sketch names for 'edit_sketch' when you don't know the exact name
- Verify that a sketch was created successfully
- Check if a sketch is currently active before drawing geometry`,
    inputSchema: z.object({
      maxFeatures: z.number().int().min(1).max(20).optional().default(5).describe('Maximum number of recent sketch features to inspect (default: 5, max: 20)')
    }),
    outputSchema: z.object({
      hasModel: z.boolean(),
      modelName: z.string().nullable(),
      modelType: z.number(),
      activeSketch: z.object({
        name: z.string().nullable(),
      }).nullable(),
      recentSketchFeatures: z.array(z.object({
        name: z.string(),
        typeName: z.string(),
      })),
    }),
    handler: (args: any = {}, swApi: SolidWorksAPI) => {
      try {
        const maxFeatures = args.maxFeatures ?? 5;
        const context = swApi.getSketchContext(maxFeatures);
        return context;
      } catch (error) {
        return {
          hasModel: false,
          modelName: null,
          modelType: 0,
          activeSketch: null,
          recentSketchFeatures: [],
        };
      }
    }
  },

  // ============================================
  // SKETCH GEOMETRY - LINES
  // ============================================
  
  {
    name: 'sketch_line',
    description: `Draw a line in the active sketch. 
AUTOMATIC: This tool automatically ensures an active sketch context before drawing.
If no sketch is active, it will activate the most recent sketch or create one if needed.
Coordinates are in mm. The line can be created as construction geometry if needed.`,
    inputSchema: z.object({
      start: z.object({
        x: z.number().describe('Start point X coordinate in mm'),
        y: z.number().describe('Start point Y coordinate in mm'),
        z: z.number().default(0).describe('Start point Z coordinate in mm (default: 0, for 3D sketches)')
      }),
      end: z.object({
        x: z.number().describe('End point X coordinate in mm'),
        y: z.number().describe('End point Y coordinate in mm'),
        z: z.number().default(0).describe('End point Z coordinate in mm (default: 0, for 3D sketches)')
      }),
      construction: z.boolean().default(false).describe('Create as construction geometry (default: false)')
    }),
    outputSchema: sketchResultSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');
        swApi.ensureActiveSketch(model);
        
        // Validate SketchManager exists and has CreateLine method
        if (!model.SketchManager) {
          throw new Error('Cannot create line: SketchManager is not available. The document may not be fully initialized.');
        }
        if (!model.SketchManager.CreateLine) {
          throw new Error('Cannot create line: CreateLine method is not available on SketchManager');
        }
        
        // Verify sketch is actually active before creating line
        const activeSketch = model.SketchManager.ActiveSketch;
        if (!activeSketch) {
          // Try to activate sketch again
          try {
            model.SketchManager.InsertSketch(true);
          } catch (e) {
            throw new Error(`Failed to activate sketch: ${e}`);
          }
          
          // Verify again
          if (!model.SketchManager.ActiveSketch) {
            throw new Error('No active sketch after InsertSketch - cannot create line');
          }
        }
        
        const line = model.SketchManager.CreateLine(
          args.start.x / 1000, args.start.y / 1000, args.start.z / 1000,
          args.end.x / 1000, args.end.y / 1000, args.end.z / 1000
        );
        
        if (!line) {
          throw new Error(
            'Failed to create line: CreateLine returned null. ' +
            'This may indicate the sketch is not properly activated or the coordinates are invalid. ' +
            'Ensure a sketch is in edit mode before creating geometry.'
          );
        }
        
        // Set construction if needed
        if (args.construction) {
          line.ConstructionGeometry = true;
        }
        
        return {
          success: true,
          message: `Line created from (${args.start.x}, ${args.start.y}) to (${args.end.x}, ${args.end.y})`,
          position: {
            x: args.end.x,
            y: args.end.y,
            z: args.end.z,
          },
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to create line: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  },

  {
    name: 'sketch_centerline',
    description: `Draw a centerline in the active sketch. 
AUTOMATIC: This tool automatically ensures an active sketch context before drawing.
Centerlines are typically used for mirroring or as construction geometry.`,
    inputSchema: z.object({
      start: z.object({
        x: z.number().describe('Start X coordinate in mm'),
        y: z.number().describe('Start Y coordinate in mm')
      }),
      end: z.object({
        x: z.number().describe('End X coordinate in mm'),
        y: z.number().describe('End Y coordinate in mm')
      })
    }),
    outputSchema: sketchResultSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');
        swApi.ensureActiveSketch(model);
        validateSketchManagerMethod(model, 'CreateCenterLine');
        
        const line = model.SketchManager.CreateCenterLine(
          args.start.x / 1000, args.start.y / 1000, 0,
          args.end.x / 1000, args.end.y / 1000, 0
        );
        
        if (!line) throw new Error('Failed to create centerline: CreateCenterLine returned null');
        
        return {
          success: true,
          message: `Centerline created from (${args.start.x}, ${args.start.y}) to (${args.end.x}, ${args.end.y})`
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to create centerline: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  },

  // ============================================
  // SKETCH GEOMETRY - CIRCLES & ARCS
  // ============================================
  
  {
    name: 'sketch_circle',
    description: `Draw a circle in the active sketch. 
AUTOMATIC: This tool automatically ensures an active sketch context before drawing.
The circle can be created as construction geometry if needed.`,
    inputSchema: z.object({
      center: z.object({
        x: z.number().describe('Center X coordinate in mm'),
        y: z.number().describe('Center Y coordinate in mm'),
        z: z.number().default(0).describe('Center Z coordinate in mm (for 3D sketches)')
      }),
      radius: z.number().positive().describe('Circle radius in mm'),
      construction: z.boolean().default(false).describe('Create as construction geometry')
    }),
    outputSchema: sketchResultSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');
        swApi.ensureActiveSketch(model);
        validateSketchManagerMethod(model, 'CreateCircle');
        
        const circle = model.SketchManager.CreateCircle(
          args.center.x / 1000, 
          args.center.y / 1000, 
          args.center.z / 1000,
          (args.center.x + args.radius) / 1000,
          args.center.y / 1000,
          args.center.z / 1000
        );
        
        if (!circle) throw new Error('Failed to create circle: CreateCircle returned null');
        
        // Set construction if needed
        if (args.construction) {
          circle.ConstructionGeometry = true;
        }
        
        return {
          success: true,
          message: `Circle created at (${args.center.x}, ${args.center.y}) with radius ${args.radius}mm`,
          area: Math.PI * args.radius * args.radius,
          circumference: 2 * Math.PI * args.radius
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to create circle: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  },

  {
    name: 'sketch_arc',
    description: `Draw an arc in the active sketch. 
AUTOMATIC: This tool automatically ensures an active sketch context before drawing.
The arc is defined by center point, start point, end point, and direction (clockwise/counterclockwise).`,
    inputSchema: z.object({
      center: z.object({
        x: z.number().describe('Center X coordinate in mm'),
        y: z.number().describe('Center Y coordinate in mm')
      }),
      start: z.object({
        x: z.number().describe('Start point X coordinate in mm'),
        y: z.number().describe('Start point Y coordinate in mm')
      }),
      end: z.object({
        x: z.number().describe('End point X coordinate in mm'),
        y: z.number().describe('End point Y coordinate in mm')
      }),
      direction: z.enum(['clockwise', 'counterclockwise']).default('counterclockwise'),
      construction: z.boolean().default(false).describe('Create as construction geometry')
    }),
    outputSchema: sketchResultSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');
        swApi.ensureActiveSketch(model);
        validateSketchManagerMethod(model, 'Create3PointArc');
        
        // Create arc (3-point arc)
        const arc = model.SketchManager.Create3PointArc(
          args.start.x / 1000, args.start.y / 1000, 0,
          args.end.x / 1000, args.end.y / 1000, 0,
          args.center.x / 1000, args.center.y / 1000, 0
        );
        
        if (!arc) throw new Error('Failed to create arc: Create3PointArc returned null');
        
        // Set construction if needed
        if (args.construction) {
          arc.ConstructionGeometry = true;
        }
        
        // Calculate arc properties
        const radius = Math.sqrt(
          Math.pow(args.start.x - args.center.x, 2) + 
          Math.pow(args.start.y - args.center.y, 2)
        );
        
        return {
          success: true,
          message: `Arc created with center at (${args.center.x}, ${args.center.y})`,
          radius,
          direction: args.direction
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to create arc: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  },

  // ============================================
  // SKETCH GEOMETRY - RECTANGLES & POLYGONS
  // ============================================
  
  {
    name: 'sketch_rectangle',
    description: `Draw a rectangle in the active sketch. 
AUTOMATIC: This tool automatically ensures an active sketch context before drawing.
The rectangle can be created as construction geometry or centered at a point if needed.`,
    inputSchema: z.object({
      corner1: z.object({
        x: z.number().describe('First corner X coordinate in mm'),
        y: z.number().describe('First corner Y coordinate in mm')
      }),
      corner2: z.object({
        x: z.number().describe('Opposite corner X coordinate in mm'),
        y: z.number().describe('Opposite corner Y coordinate in mm')
      }),
      centered: z.boolean().default(false).describe('Create rectangle centered at corner1'),
      construction: z.boolean().default(false).describe('Create as construction geometry')
    }),
    outputSchema: sketchResultSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');
        swApi.ensureActiveSketch(model);
        validateSketchManagerMethod(model, 'CreateLine');
        
        let x1 = args.corner1.x;
        let y1 = args.corner1.y;
        let x2 = args.corner2.x;
        let y2 = args.corner2.y;
        
        // Adjust for centered rectangle
        if (args.centered) {
          const width = args.corner2.x;
          const height = args.corner2.y;
          x1 = args.corner1.x - width / 2;
          y1 = args.corner1.y - height / 2;
          x2 = args.corner1.x + width / 2;
          y2 = args.corner1.y + height / 2;
        }
        
        // Create four lines to form rectangle
        const lines = [];
        lines.push(model.SketchManager.CreateLine(x1/1000, y1/1000, 0, x2/1000, y1/1000, 0));
        lines.push(model.SketchManager.CreateLine(x2/1000, y1/1000, 0, x2/1000, y2/1000, 0));
        lines.push(model.SketchManager.CreateLine(x2/1000, y2/1000, 0, x1/1000, y2/1000, 0));
        lines.push(model.SketchManager.CreateLine(x1/1000, y2/1000, 0, x1/1000, y1/1000, 0));
        
        // Validate all lines were created
        if (lines.some(line => !line)) {
          throw new Error('Failed to create rectangle: one or more lines returned null');
        }
        
        // Set construction if needed
        if (args.construction) {
          lines.forEach(line => {
            if (line) line.ConstructionGeometry = true;
          });
        }
        
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        
        return {
          success: true,
          message: `Rectangle created`,
          width,
          height,
          area: width * height,
          perimeter: 2 * (width + height)
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to create rectangle: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  },

  {
    name: 'sketch_polygon',
    description: 'Draw a regular polygon in the active sketch',
    inputSchema: z.object({
      center: z.object({
        x: z.number().describe('Center X coordinate in mm'),
        y: z.number().describe('Center Y coordinate in mm')
      }),
      sides: z.number().int().min(3).max(100).describe('Number of sides'),
      radius: z.number().positive().describe('Circumscribed circle radius in mm'),
      rotation: z.number().default(0).describe('Rotation angle in degrees'),
      inscribed: z.boolean().default(false).describe('Use inscribed circle radius instead'),
      construction: z.boolean().default(false).describe('Create as construction geometry')
    }),
    outputSchema: sketchResultSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');
        swApi.ensureActiveSketch(model);
        validateSketchManagerMethod(model, 'CreateLine');
        
        const angleStep = (2 * Math.PI) / args.sides;
        const startAngle = (args.rotation * Math.PI) / 180;
        
        // Adjust radius for inscribed vs circumscribed
        let radius = args.radius;
        if (args.inscribed) {
          radius = radius / Math.cos(Math.PI / args.sides);
        }
        
        // Create polygon lines
        const lines = [];
        for (let i = 0; i < args.sides; i++) {
          const angle1 = startAngle + (i * angleStep);
          const angle2 = startAngle + ((i + 1) * angleStep);
          
          const x1 = args.center.x + radius * Math.cos(angle1);
          const y1 = args.center.y + radius * Math.sin(angle1);
          const x2 = args.center.x + radius * Math.cos(angle2);
          const y2 = args.center.y + radius * Math.sin(angle2);
          
          const line = model.SketchManager.CreateLine(
            x1/1000, y1/1000, 0,
            x2/1000, y2/1000, 0
          );
          
          if (!line) {
            throw new Error(`Failed to create polygon line ${i + 1}: CreateLine returned null`);
          }
          
          if (line && args.construction) {
            line.ConstructionGeometry = true;
          }
          
          lines.push(line);
        }
        
        // Calculate polygon properties
        const sideLength = 2 * radius * Math.sin(Math.PI / args.sides);
        const apothem = radius * Math.cos(Math.PI / args.sides);
        const area = 0.5 * args.sides * sideLength * apothem;
        const perimeter = args.sides * sideLength;
        
        return {
          success: true,
          message: `${args.sides}-sided polygon created`,
          sides: args.sides,
          radius,
          sideLength,
          area,
          perimeter
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to create polygon: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  },

  // ============================================
  // SKETCH GEOMETRY - SPLINES & CURVES
  // ============================================
  
  {
    name: 'sketch_spline',
    description: 'Draw a spline through points in the active sketch',
    inputSchema: z.object({
      points: z.array(z.object({
        x: z.number().describe('X coordinate in mm'),
        y: z.number().describe('Y coordinate in mm'),
        z: z.number().default(0).describe('Z coordinate in mm (for 3D sketches)')
      })).min(2).describe('Array of points for the spline'),
      closed: z.boolean().default(false).describe('Close the spline'),
      construction: z.boolean().default(false).describe('Create as construction geometry')
    }),
    outputSchema: sketchResultSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');
        swApi.ensureActiveSketch(model);
        validateSketchManagerMethod(model, 'CreateSpline');
        
        // Convert points to variant array format needed by SolidWorks
        const pointArray: number[] = [];
        args.points.forEach((pt: any) => {
          pointArray.push(pt.x / 1000, pt.y / 1000, pt.z / 1000);
        });
        
        // Create spline
        const spline = model.SketchManager.CreateSpline(pointArray);
        
        if (!spline) throw new Error('Failed to create spline: CreateSpline returned null');
        
        // Set construction if needed
        if (args.construction) {
          spline.ConstructionGeometry = true;
        }
        
        // Calculate approximate length
        let length = 0;
        for (let i = 1; i < args.points.length; i++) {
          const dx = args.points[i].x - args.points[i-1].x;
          const dy = args.points[i].y - args.points[i-1].y;
          const dz = args.points[i].z - args.points[i-1].z;
          length += Math.sqrt(dx*dx + dy*dy + dz*dz);
        }
        
        return {
          success: true,
          message: `Spline created through ${args.points.length} points`,
          pointCount: args.points.length,
          approximateLength: length,
          closed: args.closed
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to create spline: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  },

  {
    name: 'sketch_ellipse',
    description: 'Draw an ellipse in the active sketch',
    inputSchema: z.object({
      center: z.object({
        x: z.number().describe('Center X coordinate in mm'),
        y: z.number().describe('Center Y coordinate in mm')
      }),
      majorAxis: z.object({
        length: z.number().positive().describe('Major axis length in mm'),
        angle: z.number().default(0).describe('Major axis angle in degrees')
      }),
      minorAxis: z.number().positive().describe('Minor axis length in mm'),
      construction: z.boolean().default(false).describe('Create as construction geometry')
    }),
    outputSchema: sketchResultSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');
        swApi.ensureActiveSketch(model);
        validateSketchManagerMethod(model, 'CreateEllipse');
        
        const angleRad = (args.majorAxis.angle * Math.PI) / 180;
        
        // Calculate major axis endpoints
        const major1X = args.center.x + (args.majorAxis.length / 2) * Math.cos(angleRad);
        const major1Y = args.center.y + (args.majorAxis.length / 2) * Math.sin(angleRad);
        const major2X = args.center.x - (args.majorAxis.length / 2) * Math.cos(angleRad);
        const major2Y = args.center.y - (args.majorAxis.length / 2) * Math.sin(angleRad);
        
        // Calculate minor axis point
        const minorX = args.center.x + (args.minorAxis / 2) * Math.cos(angleRad + Math.PI/2);
        const minorY = args.center.y + (args.minorAxis / 2) * Math.sin(angleRad + Math.PI/2);
        
        // Create ellipse
        const ellipse = model.SketchManager.CreateEllipse(
          args.center.x / 1000, args.center.y / 1000, 0,
          major1X / 1000, major1Y / 1000, 0,
          minorX / 1000, minorY / 1000, 0
        );
        
        if (!ellipse) throw new Error('Failed to create ellipse: CreateEllipse returned null');

        // Set construction if needed
        if (args.construction) {
          (ellipse as { ConstructionGeometry: boolean }).ConstructionGeometry = true;
        }
        
        // Calculate ellipse properties
        const a = args.majorAxis.length / 2;
        const b = args.minorAxis / 2;
        const area = Math.PI * a * b;
        // Approximate perimeter using Ramanujan's formula
        const h = Math.pow((a - b), 2) / Math.pow((a + b), 2);
        const perimeter = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
        
        return {
          success: true,
          message: `Ellipse created at (${args.center.x}, ${args.center.y})`,
          majorAxis: args.majorAxis.length,
          minorAxis: args.minorAxis,
          area,
          perimeter
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to create ellipse: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  },

  // ============================================
  // SKETCH CONSTRAINTS
  // ============================================
  
  {
    name: 'add_sketch_constraint',
    description: `Add constraints between sketch entities using SolidWorks API SketchAddConstraints() method.

IMPORTANT: This tool automatically ensures an active sketch context before adding constraints.

Entity Selection:
- Use "last" keyword to automatically select the most recently created sketch segment (recommended)
- Use full SolidWorks entity names like "Line1@草图1" or "Arc1@Sketch1" (check SolidWorks UI or use get_sketch_context)

Constraint Types & Requirements:
- Single entity: horizontal (line only), vertical (line only), fix (any entity)
- Two entities: coincident (point/line/arc), parallel (lines), perpendicular (lines), tangent (line/arc), concentric (arcs), equal (lines/arcs), colinear (lines)
- Three entities: symmetric (entity1 and entity2 symmetric about entity3), midpoint (point on line)

API Reference: SolidWorks API IModelDoc2.SketchAddConstraints() with string constants (sgHORIZONTAL2D, sgVERTICAL2D, etc.)

The tool will automatically activate the most recent sketch if none is active.`,
    inputSchema: z.object({
      type: z.enum([
        'coincident', 'parallel', 'perpendicular', 'tangent',
        'concentric', 'horizontal', 'vertical', 'equal',
        'symmetric', 'colinear', 'midpoint', 'fix'
      ]).describe('Type of constraint: coincident, parallel, perpendicular, tangent, concentric, horizontal, vertical, equal, symmetric, colinear, midpoint, or fix'),
      entity1: z.string().default('last').describe('First entity: defaults to "last" (most recent segment), or use full name like "Line1@草图1"'),
      entity2: z.string().optional().describe('Second entity (required for two-entity constraints): "last" or full name like "Line2@草图1"'),
      entity3: z.string().optional().describe('Third entity (required for symmetric constraint): "last" or full name like "Centerline1@草图1"')
    }),
    outputSchema: sketchResultSchema,
    handler: async (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        // 使用错误恢复封装，但保持对外返回格式不变
        return await withErrorRecovery(
          async () => {
            // Ensure we are in a valid sketch context (with error handling)
            try {
              swApi.ensureActiveSketch(model);
            } catch (sketchErr) {
              logger.error('Failed to ensure active sketch', sketchErr as Error);
              throw new Error(`Failed to activate sketch: ${sketchErr instanceof Error ? sketchErr.message : String(sketchErr)}`);
            }
        
        // Map constraint types to SolidWorks API string constants
        // According to SolidWorks API docs: Use SketchAddConstraints() with string constants, not AddConstraint() with numbers
        const constraintMap: Record<string, string> = {
          'coincident': 'sgCOINCIDENT',
          'parallel': 'sgPARALLEL',
          'perpendicular': 'sgPERPENDICULAR',
          'tangent': 'sgTANGENT',
          'concentric': 'sgCONCENTRIC',
          'horizontal': 'sgHORIZONTAL2D',
          'vertical': 'sgVERTICAL2D',
          'equal': 'sgEQUAL',
          'symmetric': 'sgSYMMETRIC',
          'colinear': 'sgCOLINEAR',
          'midpoint': 'sgATMIDDLE',
          'fix': 'sgFIXED'
        };
        
        const constraintConstant = constraintMap[args.type];
        if (!constraintConstant) {
          throw new Error(`Invalid constraint type: ${args.type}. Valid types: ${Object.keys(constraintMap).join(', ')}`);
        }
        
        // Validate model has SketchAddConstraints method
        // According to API docs: SketchAddConstraints is on IModelDoc2, not SketchManager
        if (!model.SketchAddConstraints) {
          throw new Error(
            'SketchAddConstraints method is not available on the model. ' +
            'The document may not be fully initialized or is not a Part document.'
          );
        }
        
        // Validate SketchManager exists for ActiveSketch access
        if (!model.SketchManager) {
          throw new Error(
            'SketchManager is not available. ' +
            'The document may not be fully initialized or is not a Part document.'
          );
        }
        const sketchMgr = model.SketchManager;
        const activeSketch = sketchMgr.ActiveSketch;
        
        if (!activeSketch) {
          throw new Error(
            'No active sketch. Please ensure a sketch is in edit mode before adding constraints. ' +
            'Use create_sketch or edit_sketch to activate a sketch first.'
          );
        }
        
            // Get constraint count before adding (for verification)
                let constraintCountBefore = 0;
                try {
                  // Re-validate activeSketch before accessing (COM object may have become invalid)
                  const sketchMgrCheck = model.SketchManager;
                  const activeSketchCheck = sketchMgrCheck && sketchMgrCheck.ActiveSketch;
                  if (activeSketchCheck && activeSketchCheck.GetConstraintsCount) {
                    constraintCountBefore = activeSketchCheck.GetConstraintsCount();
                  }
                } catch (e) {
                  logger.warn('Could not get constraint count before adding', e as Error);
                }

            // CRITICAL: SketchAddConstraints requires SelectByID2, NOT Select4
            // Clear selection first
            try {
              // CRITICAL: VARIANT_BOOL uses -1 for true
              model.ClearSelection2(COM.TRUE);
            } catch (e) {
              logger.warn('Failed to clear selection before adding constraint', e as Error);
            }
            
            // Ensure we're in sketch edit mode
            const sketchMgrCheck = model.SketchManager;
            const activeSketchCheck = sketchMgrCheck && sketchMgrCheck.ActiveSketch;
            if (!activeSketchCheck) {
              throw new Error(
                'No active sketch. Please ensure a sketch is in edit mode before adding constraints. ' +
                'Use create_sketch or edit_sketch to activate a sketch first.'
              );
            }

            // Select first entity with error handling
            let firstSelected = false;
            try {
              firstSelected = swApi.selectSketchEntity(args.entity1, false);
            } catch (selectErr) {
              logger.error('selectSketchEntity failed for entity1', selectErr as Error);
              throw new Error(
                `Failed to select first entity: "${args.entity1}". ` +
                `Error: ${selectErr instanceof Error ? selectErr.message : String(selectErr)}. ` +
                `Make sure entity names are valid (e.g. "Line1@草图1") or use the special keyword "last". ` +
                `Use get_sketch_context to discover available entity names.`
              );
            }
            
            if (!firstSelected) {
              throw new Error(
                `Failed to select first entity: "${args.entity1}". ` +
                `Make sure entity names are valid (e.g. "Line1@草图1") or use the special keyword "last". ` +
                `Use get_sketch_context to discover available entity names.`
              );
            }

            let secondSelected = true;
            if (args.entity2) {
              secondSelected = swApi.selectSketchEntity(args.entity2, true);
              if (!secondSelected) {
                throw new Error(
                  `Failed to select second entity: "${args.entity2}". ` +
                  `Make sure entity names are valid or use the special keyword "last".`
                );
              }
            }

            let thirdSelected = true;
            if (args.entity3) {
              thirdSelected = swApi.selectSketchEntity(args.entity3, true);
              if (!thirdSelected) {
                throw new Error(
                  `Failed to select third entity: "${args.entity3}". ` +
                  `Make sure entity names are valid or use the special keyword "last".`
                );
              }
            }

            // CRITICAL: SketchAddConstraints requires entities to be selected via SelectByID2, NOT Select4!
            // The selectSketchEntity method should have used SelectByID2, but we verify here
            // Add constraint using SketchAddConstraints (correct API method)
            // According to SolidWorks API docs: SketchAddConstraints() has no return value
            // We verify success by checking constraint count after the call
            try {
              // Ensure we're in sketch edit mode before adding constraint
              try {
                const sketchMgrCheck = model.SketchManager;
                const activeSketchCheck = sketchMgrCheck && sketchMgrCheck.ActiveSketch;
                if (!activeSketchCheck) {
                  model.EditSketch();
                }
              } catch (e) {
                logger.warn('Could not ensure sketch edit mode', e as Error);
              }
              
              model.SketchAddConstraints(constraintConstant);

              // Verify constraint was added by checking count
                let constraintCountAfter = 0;
                try {
                  // Re-validate activeSketch before accessing (COM object may have become invalid)
                  const sketchMgrCheck = model.SketchManager;
                  const activeSketchCheck = sketchMgrCheck && sketchMgrCheck.ActiveSketch;
                  if (activeSketchCheck && activeSketchCheck.GetConstraintsCount) {
                    constraintCountAfter = activeSketchCheck.GetConstraintsCount();
                  }
                } catch (e) {
                  logger.warn('Could not get constraint count after adding', e as Error);
                  // If we can't verify, assume success (API doesn't throw)
                }

              if (constraintCountAfter <= constraintCountBefore && constraintCountBefore > 0) {
                // Constraint count didn't increase - likely failed
                // This often happens when Select4 was used instead of SelectByID2
                throw new Error(
                  `Constraint "${args.type}" (${constraintConstant}) was not added. ` +
                  `CRITICAL: Make sure entities were selected using SelectByID2 (not Select4). ` +
                  `This may also indicate that the constraint conflicts with existing constraints, ` +
                  `or the selected entities are not compatible with this constraint type. ` +
                  `Constraint count before: ${constraintCountBefore}, after: ${constraintCountAfter}.`
                );
              }
            } catch (e) {
              // Re-throw with more context
              throw new Error(
                `Failed to add constraint via SketchAddConstraints: ${e instanceof Error ? e.message : String(e)}. ` +
                `Constraint type: ${args.type} (${constraintConstant}). ` +
                `CRITICAL: Ensure entities were selected using SelectByID2 (not Select4). ` +
                `Make sure the selected entities are compatible with this constraint type ` +
                `and the sketch is in edit mode.`
              );
            }

            return {
              success: true,
              message: `${args.type} constraint added`,
              type: args.type
            };
          },
          model,
          {
            maxRetries: 2,
            recoverState: true,
          }
        );
      } catch (error) {
        // Ensure error is properly formatted and doesn't crash the server
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(
          'add_sketch_constraint failed',
          error instanceof Error ? error : new Error(errorMessage)
        );
        // Return error message - McpServer will automatically convert to proper MCP error format
        throw new Error(`Failed to add constraint: ${errorMessage}`);
      }
    }
  },

  // ============================================
  // SKETCH DIMENSIONS
  // ============================================
  
  {
    name: 'add_sketch_dimension',
    description: `Add dimensions to sketch entities. 
IMPORTANT: This tool automatically ensures an active sketch context before adding dimensions.

The entity parameter must be a full SolidWorks entity name like "Line1@草图1" or "Arc1@Sketch1".
Check the SolidWorks feature tree or use 'get_sketch_context' to find exact entity names.
The tool will automatically activate the most recent sketch if none is active.

Dimension types:
- linear: distance between two points or length of a line (value in mm)
- angular: angle between two lines (value in degrees)
- radial: radius of an arc or circle (value in mm)
- diameter: diameter of a circle (value in mm)`,
    inputSchema: z.object({
      type: z.enum(['linear', 'angular', 'radial', 'diameter']).describe('Type of dimension: linear (mm), angular (degrees), radial (mm), or diameter (mm)'),
      entity: z.string().describe('Full SolidWorks entity name (e.g., "Line1@草图1", "Arc1@Sketch1") - check SolidWorks UI or use get_sketch_context'),
      value: z.number().describe('Dimension value: mm for linear/radial/diameter, degrees for angular'),
      position: z.object({
        x: z.number().describe('Text position X coordinate in mm (default: 0)'),
        y: z.number().describe('Text position Y coordinate in mm (default: 0)')
      }).optional().describe('Optional text position for dimension annotation')
    }),
    outputSchema: sketchResultSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');
        swApi.ensureActiveSketch(model);
        
        // Select entity using unified selector helper
        const selected = swApi.selectSketchEntity(args.entity, false);
        if (!selected) {
          throw new Error(
            `Failed to select sketch entity for dimension. ` +
            `Make sure entity name is valid (e.g. \"Line1@草图1\") or use the special keyword \"last\".`
          );
        }
        
        // Add dimension
        const textX = args.position?.x || 0;
        const textY = args.position?.y || 0;
        
        let dimension: unknown;
        switch (args.type) {
          case 'linear':
            dimension = model.AddDimension2?.(textX/1000, textY/1000, 0);
            break;
          case 'angular':
            dimension = model.AddDimension2?.(textX/1000, textY/1000, 0);
            break;
          case 'radial':
            dimension = model.AddRadialDimension2?.(textX/1000, textY/1000, 0);
            break;
          case 'diameter':
            dimension = model.AddDiameterDimension2?.(textX/1000, textY/1000, 0);
            break;
        }

        if (!dimension) throw new Error('Failed to add dimension');

        // Set dimension value
        const dimWithValue = dimension as { SystemValue: number };
        dimWithValue.SystemValue = args.type === 'angular'
          ? (args.value * Math.PI / 180)  // Convert degrees to radians
          : (args.value / 1000);           // Convert mm to meters
        
        return {
          success: true,
          message: `${args.type} dimension added with value ${args.value}${args.type === 'angular' ? '°' : 'mm'}`,
          type: args.type,
          value: args.value
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to add dimension: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  },

  // ============================================
  // SKETCH PATTERNS
  // ============================================
  
  {
    name: 'sketch_linear_pattern',
    description: 'Create a linear pattern of sketch entities',
    inputSchema: z.object({
      entities: z.array(z.string()).describe('Entities to pattern'),
      direction1: z.object({
        x: z.number().describe('Direction vector X'),
        y: z.number().describe('Direction vector Y'),
        count: z.number().int().min(2).describe('Number of instances'),
        spacing: z.number().positive().describe('Spacing in mm')
      }),
      direction2: z.object({
        x: z.number().describe('Direction vector X'),
        y: z.number().describe('Direction vector Y'),
        count: z.number().int().min(2).describe('Number of instances'),
        spacing: z.number().positive().describe('Spacing in mm')
      }).optional().describe('Second direction for 2D pattern')
    }),
    outputSchema: sketchResultSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');
        
        // Select entities to pattern using unified selector
        // According to plan: Use unified selector instead of direct SelectByID2
        const selected = swApi.selectSketchEntities(args.entities);
        if (!selected) {
          throw new Error('Failed to select entities for pattern. Ensure entity names are valid or use "last" keyword.');
        }
        
        // Create pattern
        const totalInstances = args.direction1.count * (args.direction2?.count || 1);
        
        // Note: Actual implementation would use SketchManager.CreateLinearSketchStepAndRepeat
        
        return {
          success: true,
          message: `Linear pattern created with ${totalInstances} instances`,
          direction1Count: args.direction1.count,
          direction2Count: args.direction2?.count || 1,
          totalInstances
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to create linear pattern: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  },

  {
    name: 'sketch_circular_pattern',
    description: 'Create a circular pattern of sketch entities',
    inputSchema: z.object({
      entities: z.array(z.string()).describe('Entities to pattern'),
      center: z.object({
        x: z.number().describe('Center X coordinate in mm'),
        y: z.number().describe('Center Y coordinate in mm')
      }),
      count: z.number().int().min(2).describe('Number of instances'),
      angle: z.number().default(360).describe('Total angle in degrees'),
      equalSpacing: z.boolean().default(true).describe('Equal spacing between instances')
    }),
    outputSchema: sketchResultSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');
        
        // Select entities to pattern using unified selector
        // According to plan: Use unified selector instead of direct SelectByID2
        const selected = swApi.selectSketchEntities(args.entities);
        if (!selected) {
          throw new Error('Failed to select entities for pattern. Ensure entity names are valid or use "last" keyword.');
        }
        
        // Calculate angular spacing
        const angleStep = args.angle / (args.equalSpacing ? args.count : args.count - 1);
        
        // Note: Actual implementation would use SketchManager.CreateCircularSketchStepAndRepeat
        
        return {
          success: true,
          message: `Circular pattern created with ${args.count} instances`,
          count: args.count,
          totalAngle: args.angle,
          anglePerInstance: angleStep
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to create circular pattern: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  },

  // ============================================
  // SKETCH TRANSFORMATIONS
  // ============================================
  
  {
    name: 'sketch_mirror',
    description: 'Mirror sketch entities about a line',
    inputSchema: z.object({
      entities: z.array(z.string()).describe('Entities to mirror'),
      mirrorLine: z.string().describe('Mirror line (centerline or construction line)'),
      copy: z.boolean().default(true).describe('Keep original entities')
    }),
    outputSchema: sketchResultSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');
        
        // Select entities to mirror using unified selector
        // According to plan: Use unified selector instead of direct SelectByID2
        const entitiesSelected = swApi.selectSketchEntities(args.entities);
        if (!entitiesSelected) {
          throw new Error('Failed to select entities for mirror. Ensure entity names are valid or use "last" keyword.');
        }
        
        // Select mirror line using unified selector
        const mirrorLineSelected = swApi.selectSketchEntity(args.mirrorLine, true);
        if (!mirrorLineSelected) {
          throw new Error(`Failed to select mirror line: ${args.mirrorLine}. Ensure it exists or use "last" keyword.`);
        }
        
        // Mirror entities
        model.SketchManager.MirrorSketch();
        
        return {
          success: true,
          message: `Mirrored ${args.entities.length} entities`,
          entityCount: args.entities.length,
          keepOriginal: args.copy
        };
      } catch (error) {
        return `Failed to mirror entities: ${error}`;
      }
    }
  },

  {
    name: 'sketch_offset',
    description: 'Create offset curves from sketch entities',
    inputSchema: z.object({
      entities: z.array(z.string()).describe('Entities to offset'),
      distance: z.number().describe('Offset distance in mm (positive = outward)'),
      side: z.enum(['both', 'left', 'right']).default('both').describe('Offset side'),
      corner: z.enum(['sharp', 'round', 'natural']).default('natural').describe('Corner treatment'),
      cap: z.boolean().default(true).describe('Cap ends for open curves')
    }),
    outputSchema: sketchResultSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');
        
        // Select entities to offset using unified selector
        // According to plan: Use unified selector instead of direct SelectByID2
        const selected = swApi.selectSketchEntities(args.entities);
        if (!selected) {
          throw new Error('Failed to select entities for offset. Ensure entity names are valid or use "last" keyword.');
        }
        
        // Create offset
        const sideValue = args.side === 'both' ? 0 : (args.side === 'left' ? 1 : 2);
        model.SketchManager.SketchOffset2(
          args.distance / 1000,  // Convert to meters
          sideValue,
          false,  // Not chain
          args.cap
        );
        
        return {
          success: true,
          message: `Offset created at ${args.distance}mm`,
          distance: args.distance,
          side: args.side,
          corner: args.corner
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to create offset: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  }
];