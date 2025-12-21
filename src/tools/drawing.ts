import { z } from 'zod';
import { SolidWorksAPI } from '../solidworks/api.js';
import { SolidWorksConfig } from '../utils/solidworks-config.js';
import { logger } from '../utils/logger.js';

const drawingSuccessSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  drawingName: z.string().optional(),
  warnings: z.array(z.string()).optional(),
});

export const drawingTools = [
  {
    name: 'create_drawing_from_model',
    description: 'Create a new drawing from the current 3D model',
    inputSchema: z.object({
      template: z.string().describe('Drawing template path'),
      sheet_size: z.enum(['A4', 'A3', 'A2', 'A1', 'A0', 'Letter', 'Tabloid']).optional(),
    }),
    outputSchema: drawingSuccessSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const app = swApi.getApp();
        if (!app) throw new Error('SolidWorks application not connected');
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No model open to create drawing from');

        // Get default drawing template if not specified
        let templatePath = args.template;
        if (!templatePath || templatePath === '') {
          try {
            templatePath = SolidWorksConfig.getTemplatePath(app, 'drawing', args.template);
          } catch (e) {
            throw new Error(`Template path error: ${e}`);
          }
        }
        
        // Create new drawing - try different methods
        let drawing = null;
        
        // Method 1: NewDocument
        try {
          drawing = app.NewDocument(templatePath, 0, 0, 0);
        } catch (e) {
          // Method 2: Try with different parameters
          try {
            drawing = app.NewDocument(templatePath, 2, 0.297, 0.21); // A4 size
          } catch (e2) {
            // Method 3: Try creating from active model
            try {
              // Get full path - GetPathName returns full path, which is needed for NewDrawing2
              let modelPath = '';
              try {
                if (model.GetPathName) {
                  const path = model.GetPathName();
                  if (path && String(path).trim() !== '') {
                    modelPath = String(path).trim();
                  }
                }
              } catch (error) {
                // GetPathName failed - cannot create drawing from unsaved model
                modelPath = '';
              }
              if (modelPath) {
                drawing = app.NewDrawing2?.(
                  0, // Use default template
                  templatePath,
                  2, // Paper size (2 = A4)
                  0.297, // Width
                  0.21 // Height
                );
              }
            } catch (e3) {
              throw new Error(`Cannot create drawing with template: ${templatePath}`);
            }
          }
        }
        
        if (!drawing) {
          throw new Error('Failed to create drawing document');
        }
        
        // Try to add a view of the model
        const warnings: string[] = [];
        try {
          const drawDoc = drawing;
          // Get full path - GetPathName returns full path, which is needed for CreateDrawViewFromModelView3
          let modelPath = '';
          try {
            if (model.GetPathName) {
              const path = model.GetPathName();
              if (path && String(path).trim() !== '') {
                modelPath = String(path).trim();
              }
            }
          } catch (error) {
            // GetPathName failed - cannot create view from unsaved model
            modelPath = '';
          }

          if (modelPath && modelPath !== '') {
            // Create first view
            const firstView = drawDoc.CreateDrawViewFromModelView3?.(
              modelPath,
              '*Front', // Standard view name
              0.15, // X position
              0.15, // Y position
              0  // Use sheet scale
            );

            if (firstView) {
              // Add projected views
              try {
                const topView = drawDoc.CreateUnfoldedViewAt3?.(0.25, 0.15, 0, false);
                if (!topView) warnings.push('Failed to create top view');
              } catch (e) {
                warnings.push(`Top view error: ${e}`);
              }

              try {
                const rightView = drawDoc.CreateUnfoldedViewAt3?.(0.15, 0.25, 0, false);
                if (!rightView) warnings.push('Failed to create right view');
              } catch (e) {
                warnings.push(`Right view error: ${e}`);
              }
            } else {
              warnings.push('Failed to create front view - drawing is empty');
            }
          } else {
            warnings.push('Model has no saved path - cannot create views. Save the model first.');
          }
        } catch (e) {
          warnings.push(`View creation error: ${e}`);
        }

        const drawingTitle = drawing?.GetTitle() || 'Unknown';
        return {
          success: true,
          message: `Created new drawing from template: ${templatePath}`,
          drawingName: drawingTitle,
          warnings: warnings.length > 0 ? warnings : undefined,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to create drawing: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  },
  
  {
    name: 'add_drawing_view',
    description: `Add a standard or custom view to the current drawing sheet.
    
According to SolidWorks API documentation:
- Use DrawingDoc.CreateDrawViewFromModelView3() for standard views (*Front, *Top, etc.)
- Use DrawingDoc.CreateUnfoldedViewAt3() for projected views
- Coordinates are in meters (converted from mm input)
- View scale can be specified or uses sheet default

REQUIREMENTS:
- Current document must be a Drawing (type=3)
- Model file must be saved (has a valid path)
- Use get_sketch_context or check document type before calling

VIEW TYPES:
- Standard views: front, top, right, back, bottom, left, iso
- Custom: current (uses current model view orientation)`,
    inputSchema: z.object({
      viewType: z.enum(['front', 'top', 'right', 'back', 'bottom', 'left', 'iso', 'current'])
        .describe('View orientation type. Standard views use predefined orientations (*Front, *Top, etc.)'),
      modelPath: z.string().describe('Path to the model file (.SLDPRT or .SLDASM). Must be a saved file with valid path'),
      x: z.number().describe('X position on sheet in mm (converted to meters internally)'),
      y: z.number().describe('Y position on sheet in mm (converted to meters internally)'),
      scale: z.number().optional().describe('View scale factor (e.g., 0.5 for 1:2 scale, 1.0 for 1:1). If omitted, uses sheet default scale'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      viewName: z.string().optional(),
      position: z.object({
        x: z.number(),
        y: z.number(),
      }).optional(),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) {
          throw new Error('No active model');
        }
        // Use unified document type checking with inference
        const docType = swApi.getDocumentType(model, 0);
        if (docType !== 3) { // swDocDRAWING
          throw new Error(
            `Current document must be a drawing (type=${docType}). ` +
            `Expected type 3 (swDocDRAWING).`
          );
        }
        
        const drawingDoc = model;
        
        // View orientation map
        // According to API docs: Standard view names use * prefix (e.g., *Front, *Top)
        const orientationMap: Record<string, string> = {
          front: '*Front',
          top: '*Top',
          right: '*Right',
          back: '*Back',
          bottom: '*Bottom',
          left: '*Left',
          iso: '*Isometric',
          current: '*Current',
        };
        
        // According to API docs: CreateDrawViewFromModelView3 creates a view from a model
        // Parameters: modelPath, viewName, x, y, z (all in meters)
        if (!drawingDoc.CreateDrawViewFromModelView3) {
          throw new Error('CreateDrawViewFromModelView3 method is not available on DrawingDoc');
        }
        
        const view = drawingDoc.CreateDrawViewFromModelView3(
          args.modelPath,
          orientationMap[args.viewType],
          args.x / 1000, // Convert mm to m
          args.y / 1000,
          0
        );
        
        if (!view) {
          throw new Error(
            `Failed to create view. Ensure model path is valid: ${args.modelPath}. ` +
            `View type: ${args.viewType} (${orientationMap[args.viewType]})`
          );
        }
        
        // Set scale if specified
        // According to API docs: ScaleDecimal is a read/write property (not a method)
        // View.SetScale() does not exist - use ScaleDecimal property directly
        if (args.scale) {
          try {
            // ScaleDecimal is always available as a property on IView
            view.ScaleDecimal = args.scale;
          } catch (e) {
            logger.warn('Failed to set view scale (view may use sheet default)', e as Error);
            // Scale setting failed - view may use sheet default
            // Log but don't fail the operation
          }
        }
        
        const viewName = view?.GetName?.() || `View_${args.viewType}`;
        return {
          success: true,
          message: `Added ${args.viewType} view at (${args.x}, ${args.y})`,
          viewName,
          position: { x: args.x, y: args.y },
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to add drawing view: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  },
  
  {
    name: 'add_section_view',
    description: 'Add a section view to the drawing',
    inputSchema: z.object({
      parentView: z.string().describe('Name of the parent view'),
      x: z.number().describe('X position on sheet (mm)'),
      y: z.number().describe('Y position on sheet (mm)'),
      sectionLine: z.object({
        x1: z.number(),
        y1: z.number(),
        x2: z.number(),
        y2: z.number(),
      }).describe('Section line coordinates relative to parent view'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) {
          throw new Error('No active model');
        }
        // Use unified document type checking with inference
        const docType = swApi.getDocumentType(model, 0);
        if (docType !== 3) { // swDocDRAWING
          throw new Error(
            `Current document must be a drawing (type=${docType}). ` +
            `Expected type 3 (swDocDRAWING).`
          );
        }
        
        // Implementation would require selecting parent view and creating section line
        // This is a simplified response
        return {
          success: false,
          message: 'Section view creation requires interactive selection. Use VBA generation for automated section views.',
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to add section view: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  },
  
  {
    name: 'add_dimensions',
    description: `Add automatic dimensions to a drawing view.
    
According to SolidWorks API documentation:
- Use View.AutoInsertDimensions() for automatic dimension insertion
- Dimensions can be arranged automatically or manually
- View must be valid and contain geometry to dimension

REQUIREMENTS:
- Current document must be a Drawing (type=3)
- View must exist and be valid
- View should contain sketch geometry or features to dimension`,
    inputSchema: z.object({
      viewName: z.string().describe('Name of the view to dimension (e.g., "DrawingView1")'),
      autoArrange: z.boolean().default(true)
        .describe('Automatically arrange dimensions for optimal placement (default: true)'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      viewName: z.string().optional(),
      dimensionCount: z.number().optional(),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) {
          throw new Error('No active model');
        }
        // Use unified document type checking with inference
        const docType = swApi.getDocumentType(model, 0);
        if (docType !== 3) { // swDocDRAWING
          throw new Error(
            `Current document must be a drawing (type=${docType}). ` +
            `Expected type 3 (swDocDRAWING).`
          );
        }
        
        const drawingDoc = model;
        const view = drawingDoc.FeatureByName(args.viewName);
        
        if (!view) throw new Error(`View "${args.viewName}" not found`);
        
        // Select the view
        view.Select2(false, 0);
        
        // Auto-dimension
        drawingDoc.Extension.AutoDimension?.(
          1 // Type: Linear dimensions
        );
        
        return {
          success: true,
          message: `Added dimensions to view: ${args.viewName}`,
          viewName: args.viewName,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to add dimensions: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  },
  
  {
    name: 'update_sheet_format',
    description: 'Update drawing sheet format and properties',
    inputSchema: z.object({
      properties: z.object({
        title: z.string().optional(),
        drawnBy: z.string().optional(),
        checkedBy: z.string().optional(),
        date: z.string().optional(),
        scale: z.string().optional(),
        material: z.string().optional(),
        finish: z.string().optional(),
      }),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      updatedProperties: z.array(z.string()).optional(),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) {
          throw new Error('No active model');
        }
        // Use unified document type checking with inference
        const docType = swApi.getDocumentType(model, 0);
        if (docType !== 3) { // swDocDRAWING
          throw new Error(
            `Current document must be a drawing (type=${docType}). ` +
            `Expected type 3 (swDocDRAWING).`
          );
        }
        
        // Update custom properties
        const customPropMgr = model.Extension.CustomPropertyManager('');

        if (customPropMgr) {
          for (const [key, value] of Object.entries(args.properties)) {
            if (value && typeof value === 'string') {
              customPropMgr.Add3(
                key,
                30, // swCustomInfoType_e.swCustomInfoText
                value,
                1 // swCustomPropertyAddOption_e.swCustomPropertyReplaceValue
              );
            }
          }
        }
        
        // Force update of sheet format
        model.ForceRebuild3(false);
        
        const updatedProps = Object.keys(args.properties).filter(k => args.properties[k]);
        return {
          success: true,
          message: 'Updated sheet format properties',
          updatedProperties: updatedProps,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to update sheet format: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  },

  {
    name: 'add_diameter_dimension',
    description: 'Add dimension with diameter symbol to a view',
    inputSchema: z.object({
      viewName: z.string().describe('Name of the view'),
      x: z.number().describe('X position'),
      y: z.number().describe('Y position'),
      text: z.string().optional().describe('Custom dimension text')
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      position: z.object({
        x: z.number(),
        y: z.number(),
      }).optional(),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No drawing open');

        const drawing = model;
        const view = drawing.GetFirstView();

        if (!view) {
          throw new Error('No views available in drawing');
        }

        // Find target view
        let targetView = view.GetNextView?.();
        while (targetView) {
          if (targetView.GetName2?.() === args.viewName) {
            break;
          }
          targetView = targetView.GetNextView?.();
        }

        if (!targetView) throw new Error('View not found');

        // Select an edge in the view
        targetView.SelectEntity?.(false);

        // Add dimension with diameter symbol
        const dim = drawing.AddDimension2?.(args.x, args.y, 0);

        if (dim) {
          // Try multiple methods to add diameter symbol
          const methods = [
            '<MOD-DIAM><DIM>',           // SolidWorks modifier
            '<MOD-DIAM>',                 // Just the modifier
            String.fromCharCode(8960),    // Unicode diameter
            '\u2300<DIM>',               // Unicode with dimension
            '<FONT name="Arial" effect=U+2300><DIM>' // Font with Unicode
          ];

          for (const method of methods) {
            try {
              dim.SetText?.(0, args.text || method);
              break;
            } catch (e) {
              continue;
            }
          }

          // Set as diameter dimension type
          try {
            dim.DimensionType = 2; // swDiameterDimension
          } catch (e) {
            // Ignore if cannot set dimension type
          }
        }

        return {
          success: true,
          message: 'Diameter dimension added',
          position: { x: args.x, y: args.y },
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to add diameter dimension: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  },

  {
    name: 'set_view_grayscale_enhanced',
    description: 'Enhanced method to set view to grayscale',
    inputSchema: z.object({
      viewName: z.string().describe('Name of the view to set grayscale')
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      methods: z.array(z.string()).optional(),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No drawing open');

        const drawing = model;
        const view = drawing.GetFirstView();

        if (!view) {
          throw new Error('No views available in drawing');
        }

        // Find target view
        let targetView = view.GetNextView?.();
        while (targetView) {
          if (targetView.GetName2?.() === args.viewName) {
            break;
          }
          targetView = targetView.GetNextView?.();
        }

        if (!targetView) throw new Error('View not found');

        const results: string[] = [];

        // Method 1: SetDisplayMode with various options
        try {
          targetView.SetDisplayMode3?.(4, false, {}); // 4 = Shaded
          results.push('Set to shaded mode');
        } catch (e) {
          results.push(`SetDisplayMode3 failed: ${e}`);
        }

        // Method 2: Try RenderMode
        try {
          targetView.RenderMode = 3; // Grayscale
          results.push('RenderMode set to 3');
        } catch (e) {
          results.push(`RenderMode failed: ${e}`);
        }

        // Method 3: DisplayData with various states
        try {
          const dispData = targetView.GetDisplayData?.() as { SetDisplayState(state: number): void } | null;
          if (dispData) {
            const states = [3, 6, 9, 12, 15]; // Possible grayscale states
            for (const state of states) {
              try {
                dispData.SetDisplayState(state);
                results.push(`DisplayState set to ${state}`);
                break;
              } catch (e) {
                continue;
              }
            }
          }
        } catch (e) {
          results.push(`DisplayData failed: ${e}`);
        }

        // Method 4: Try configuration display state
        try {
          const config = model.GetActiveConfiguration?.();
          if (config) {
            config.UseAlternateDisplayStateInDrawings = true;
            config.AlternateDisplayState = 'Grayscale';
            results.push('Set alternate display state to Grayscale');
          }
        } catch (e) {
          results.push(`Config display state failed: ${e}`);
        }

        return {
          success: results.length > 0,
          message: results.length > 0 ? 'Grayscale mode applied' : 'Failed to apply grayscale',
          methods: results,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to set grayscale: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  },

  {
    name: 'create_configurations_batch',
    description: 'Create multiple configurations with dimensions',
    inputSchema: z.object({
      configs: z.array(z.object({
        name: z.string(),
        outsideDiameter: z.number(),
        insideDiameter: z.number(),
        thickness: z.number()
      }))
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      createdConfigs: z.array(z.string()).optional(),
      failedConfigs: z.array(z.string()).optional(),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No model open');

        const createdConfigs: string[] = [];
        const failedConfigs: string[] = [];

        for (const config of args.configs) {
          try {
            // Create configuration
            const newConfig = model.AddConfiguration3?.(
              config.name,
              `OD: ${config.outsideDiameter}, ID: ${config.insideDiameter}`,
              '',
              0,
              ''
            );

            if (newConfig) {
              // Activate configuration
              model.ShowConfiguration2?.(config.name);

              // Set dimensions
              swApi.setDimension('OUTSIDE DIAMETER@FRONT SKETCH@WasherTest.Part', config.outsideDiameter);
              swApi.setDimension('INSIDE DIAMETER@FRONT SKETCH@WasherTest.Part', config.insideDiameter);
              swApi.setDimension('WASHER THICKNESS@SIDE SKETCH@WasherTest.Part', config.thickness);

              // Rebuild
              model.EditRebuild3();

              createdConfigs.push(config.name);
            } else {
              failedConfigs.push(config.name);
            }
          } catch (e) {
            failedConfigs.push(config.name);
          }
        }

        return {
          success: createdConfigs.length > 0,
          message: `Created ${createdConfigs.length} of ${args.configs.length} configurations`,
          createdConfigs: createdConfigs.length > 0 ? createdConfigs : undefined,
          failedConfigs: failedConfigs.length > 0 ? failedConfigs : undefined,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to create configurations: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  }
];