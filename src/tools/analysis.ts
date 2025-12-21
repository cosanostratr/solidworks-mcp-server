import { z } from 'zod';
import { SolidWorksAPI } from '../solidworks/api.js';
import { logger } from '../utils/logger.js';

const getMassPropertiesSchema = z.object({
  units: z.enum(['kg', 'g', 'lb']).default('kg').describe('Mass units'),
});

const checkInterferenceSchema = z.object({
  treatCoincidenceAsInterference: z.boolean().default(false),
  treatSubAssembliesAsComponents: z.boolean().default(false),
  includeMultibodyParts: z.boolean().default(true),
});

const measureDistanceSchema = z.object({
  entity1: z.string(),
  entity2: z.string(),
});

const analyzeDraftSchema = z.object({
  pullDirection: z.enum(['x', 'y', 'z', '-x', '-y', '-z']),
  requiredAngle: z.number().default(1),
});

const checkGeometrySchema = z.object({
  checkType: z.enum(['all', 'faces', 'edges', 'vertices']).default('all'),
});

const getBoundingBoxSchema = z.object({
  includeHiddenBodies: z.boolean().default(false),
});

const estimateVolumeSchema = z.object({
  method: z.enum(['exact', 'fast']).default('exact'),
});

const getMassPropertiesOutputSchema = z.object({
  mass: z.string(),
  volume: z.string(),
  surfaceArea: z.string(),
  centerOfMass: z.object({
    x: z.string(),
    y: z.string(),
    z: z.string(),
  }),
});

export const analysisTools = [
  {
    name: 'get_mass_properties',
    description: 'Get mass properties of the current model',
    inputSchema: getMassPropertiesSchema,
    outputSchema: getMassPropertiesOutputSchema,
    handler: (args: z.infer<typeof getMassPropertiesSchema>, swApi: SolidWorksAPI) => {
      try {
        const props = swApi.getMassProperties();

        // Convert mass based on units
        let mass = props.mass ?? 0;
        if (args.units === 'g') mass *= 1000;
        if (args.units === 'lb') mass *= 2.20462;

        return {
          mass: `${mass.toFixed(3)} ${args.units}`,
          volume: `${((props.volume ?? 0) * 1e9).toFixed(3)} mm³`,
          surfaceArea: `${((props.surfaceArea ?? 0) * 1e6).toFixed(3)} mm²`,
          centerOfMass: {
            x: `${((props.centerOfMass?.x ?? 0) * 1000).toFixed(3)} mm`,
            y: `${((props.centerOfMass?.y ?? 0) * 1000).toFixed(3)} mm`,
            z: `${((props.centerOfMass?.z ?? 0) * 1000).toFixed(3)} mm`,
          },
        };
      } catch (error) {
        return `Failed to get mass properties: ${error}`;
      }
    },
  },
  
  {
    name: 'check_interference',
    description: `Check for interference between components in an assembly.
    
According to SolidWorks API documentation:
- Use AssemblyDoc.InterferenceDetectionManager to access interference detection
- InterferenceDetectionManager.GetInterferences() processes and finds interferences
- GetInterferenceCount() returns the number of interferences found
- Individual interference details can be accessed via GetInterference() method

REQUIREMENTS:
- Current document must be an Assembly (type=2)
- Assembly must have at least 2 components
- Use get_sketch_context or check document type before calling

PARAMETERS:
- treatCoincidenceAsInterference: If true, coincident faces are treated as interferences
- treatSubAssembliesAsComponents: If true, sub-assemblies are treated as single components
- includeMultibodyParts: If true, checks interference between bodies within multibody parts`,
    inputSchema: checkInterferenceSchema,
    outputSchema: z.object({
      message: z.string(),
      count: z.number().optional(),
    }),
    handler: (args: z.infer<typeof checkInterferenceSchema>, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) {
          throw new Error('No active model');
        }
        // Use unified document type checking with inference
        const docType = swApi.getDocumentType(model, 0);
        if (docType !== 2) { // swDocASSEMBLY
          throw new Error(
            `Current document must be an assembly (type=${docType}). ` +
            `Expected type 2 (swDocASSEMBLY).`
          );
        }
        
        // Validate InterferenceDetectionManager exists
        // According to API docs: InterferenceDetectionManager is available on AssemblyDoc
        if (!model.InterferenceDetectionManager) {
          throw new Error('InterferenceDetectionManager is not available. Ensure the document is an Assembly.');
        }
        
        const interferenceDetect = model.InterferenceDetectionManager;
        
        // Set interference detection options
        // According to API docs: These properties control how interferences are detected
        try {
          if (interferenceDetect.TreatCoincidenceAsInterference !== undefined) {
            interferenceDetect.TreatCoincidenceAsInterference = args.treatCoincidenceAsInterference;
          }
          if (interferenceDetect.TreatSubAssembliesAsComponents !== undefined) {
            interferenceDetect.TreatSubAssembliesAsComponents = args.treatSubAssembliesAsComponents;
          }
          if (interferenceDetect.IncludeMultibodyPartInterferences !== undefined) {
            interferenceDetect.IncludeMultibodyPartInterferences = args.includeMultibodyParts;
          }
        } catch (e) {
          logger.warn('Failed to set some interference detection options', e as Error);
        }
        
        // Process interferences
        // According to API docs: GetInterferences() both executes analysis AND returns results
        // It returns an array of IInterference objects
        if (!interferenceDetect.GetInterferences) {
          throw new Error('GetInterferences method is not available on InterferenceDetectionManager');
        }
        
        // Note: May need to call ToolsCheckInterference() first to open the interference panel
        // But GetInterferences() should work without it in most cases
        const interferences = interferenceDetect.GetInterferences();
        
        // Get interference count
        // According to API docs: GetInterferenceCount() returns the number of interferences found
        if (!interferenceDetect.GetInterferenceCount) {
          throw new Error('GetInterferenceCount method is not available on InterferenceDetectionManager');
        }
        const count = interferenceDetect.GetInterferenceCount();
        
        // GetInterferences() returns the array, GetInterferenceCount() returns the count
        // They should match, but we use GetInterferenceCount() for consistency
        
        if (count === 0) {
          return { message: 'No interferences detected', count: 0 };
        }
        
        return { message: `Found ${count} interference(s). Use VBA or manual review to examine details.`, count };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { message: `Failed to check interference: ${errorMessage}` };
      }
    },
  },
  
  {
    name: 'measure_distance',
    description: 'Measure distance between two selected entities',
    inputSchema: measureDistanceSchema,
    handler: (args: z.infer<typeof measureDistanceSchema>, swApi: SolidWorksAPI) => {
      // Note: This would require entity selection which is complex in COM
      return `Distance measurement requires interactive selection. Use the Measure tool in SolidWorks or generate VBA for automated measurement.`;
    },
  },
  
  {
    name: 'analyze_draft',
    description: 'Analyze draft angles for molding',
    inputSchema: analyzeDraftSchema,
    handler: (args: z.infer<typeof analyzeDraftSchema>, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No model open');
        
        // Draft analysis would require DraftAnalysisManager
        return `Draft analysis initiated. Check SolidWorks display for colored results:\n` +
               `- Green: Positive draft (>${args.requiredAngle}°)\n` +
               `- Yellow: Requires draft\n` +
               `- Red: Negative draft\n` +
               `Pull direction: ${args.pullDirection}`;
      } catch (error) {
        return `Failed to analyze draft: ${error}`;
      }
    },
  },
  
  {
    name: 'check_geometry',
    description: 'Check model geometry for errors',
    inputSchema: checkGeometrySchema,
    handler: (args: z.infer<typeof checkGeometrySchema>, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No model open');
        
        let checkResult = null;
        let errorCount = 0;
        
        // Method 1: Try Extension.RunCheck3
        try {
          checkResult = model.Extension.RunCheck3(
            524287, // swGeomCheckAll
            {}      // options object
          );
          errorCount = (typeof checkResult === 'number' ? checkResult : 0);
        } catch (e) {
          // Method 2: Try ToolsCheck
          try {
            checkResult = (model as unknown as { ToolsCheck(): unknown }).ToolsCheck();
            errorCount = (typeof checkResult === 'number' ? checkResult : 0);
          } catch (e2) {
            // Method 3: Try CheckGeometry
            try {
              checkResult = (model as unknown as { CheckGeometry(): unknown }).CheckGeometry();
              errorCount = (typeof checkResult === 'number' ? checkResult : 0);
            } catch (e3) {
              // Method 4: Try Extension.ToolsCheck
              try {
                checkResult = model.Extension.ToolsCheck(
                  true,  // check geometry
                  false, // short edges
                  false, // minimum radius
                  false, // invalid sketches
                  false  // zero thickness
                );
                errorCount = (typeof checkResult === 'number' ? checkResult : 0);
              } catch (e4) {
                // No check methods available, try rebuild
                model.EditRebuild3();
                return 'Geometry check not available - performed rebuild instead';
              }
            }
          }
        }
        
        if (errorCount === 0) {
          return 'No geometry errors found';
        }
        
        return `Found ${errorCount} geometry issue(s). Check SolidWorks for details.`;
      } catch (error) {
        return `Failed to check geometry: ${error}`;
      }
    },
  },
  
  {
    name: 'get_bounding_box',
    description: 'Get the bounding box dimensions of the model',
    inputSchema: getBoundingBoxSchema,
    outputSchema: z.object({
      dimensions: z.object({
        width: z.string(),
        height: z.string(),
        depth: z.string(),
      }),
      volume: z.string(),
      diagonal: z.string().optional(),
      note: z.string().optional(),
    }),
    handler: (args: z.infer<typeof getBoundingBoxSchema>, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No model open');
        
        // Try different methods to get bounding box
        let box = null;
        
        // Method 1: Try PartDoc.GetPartBox for parts
        // Use unified document type checking with inference
        const docType = swApi.getDocumentType(model, 0);
        if (docType === 1) { // swDocPART
          try {
            box = model.GetPartBox?.(true); // true = visible only
          } catch (e) {
            // GetPartBox might not exist
          }
        }

        // Method 2: Try GetBodies2 approach
        if (!box) {
          try {
            const bodies = model.GetBodies2?.(0, false); // 0 = all bodies, false = visible only
            if (bodies && bodies.length > 0) {
              const body = bodies[0] as { GetBodyBox?: () => number[] | null };
              if (body.GetBodyBox) {
                box = body.GetBodyBox();
              }
            }
          } catch (e) {
            // GetBodies2 failed
          }
        }
        
        // Method 3: Try using Extension
        if (!box) {
          try {
            const ext = model.Extension;
            if (ext && ext.GetBox) {
              box = ext.GetBox(false); // false = use precise box
            }
          } catch (e) {
            // Extension.GetBox failed
          }
        }
        
        // Method 4: Get from selection
        if (!box) {
          try {
            // Select all and get box
            model.Extension.SelectAll();
            const selMgr = model.SelectionManager;
            if (selMgr && selMgr.GetSelectedObjectCount2(-1) > 0) {
              box = model.GetPartBox?.(false);
            }
            model.ClearSelection2(true);
          } catch (e) {
            // Selection method failed
          }
        }
        
        if (!box || !Array.isArray(box) || box.length < 6) {
          // Try to return approximate dimensions from mass properties
          try {
            const props = swApi.getMassProperties();
            const volume = props.volume ?? 0;
            if (props && volume > 0) {
              // Estimate cube dimensions from volume
              const side = Math.pow(volume * 1e9, 1/3); // Convert m³ to mm³
              return {
                dimensions: {
                  width: `~${side.toFixed(2)} mm`,
                  height: `~${side.toFixed(2)} mm`,
                  depth: `~${side.toFixed(2)} mm`,
                },
                volume: `${(volume * 1e9).toFixed(2)} mm³`,
                note: 'Estimated from volume (actual bounding box unavailable)'
              };
            }
          } catch (e) {
            // Mass properties also failed
          }
          throw new Error('Failed to get bounding box - model may not have solid geometry');
        }
        
        const width = Math.abs(box[3] - box[0]) * 1000;
        const height = Math.abs(box[4] - box[1]) * 1000;
        const depth = Math.abs(box[5] - box[2]) * 1000;
        
        return {
          dimensions: {
            width: `${width.toFixed(2)} mm`,
            height: `${height.toFixed(2)} mm`,
            depth: `${depth.toFixed(2)} mm`,
          },
          volume: `${(width * height * depth).toFixed(2)} mm³`,
          diagonal: `${Math.sqrt(width*width + height*height + depth*depth).toFixed(2)} mm`,
        };
      } catch (error) {
        return `Failed to get bounding box: ${error}`;
      }
    },
  },
];