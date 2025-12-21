/**
 * MCP Prompts for SolidWorks
 * Provides reusable workflow templates for common SolidWorks tasks
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { completable } from '@modelcontextprotocol/sdk/server/completable.js';
import { z } from 'zod';

/**
 * Register all Prompts with the MCP server
 */
export function registerAllPrompts(server: McpServer): void {
  // Prompt: Create Part Workflow
  server.registerPrompt(
    'create-part-workflow',
    {
      title: 'Create Part Workflow',
      description: 'Step-by-step guide to create a new SolidWorks part with best practices',
      argsSchema: {
        partName: z.string().describe('Name of the part to create'),
        complexity: z.enum(['simple', 'medium', 'complex']).optional()
          .describe('Complexity level: simple (basic features), medium (multiple features), complex (advanced features)'),
      },
    },
    ({ partName, complexity = 'simple' }) => {
      const steps = complexity === 'simple' 
        ? [
            '1. Create a new part document',
            '2. Select the Front plane',
            '3. Create a base sketch',
            '4. Extrude to create the initial feature',
          ]
        : complexity === 'medium'
        ? [
            '1. Create a new part document',
            '2. Select an appropriate plane (Front, Top, or Right)',
            '3. Create a base sketch with proper constraints',
            '4. Extrude to create the initial feature',
            '5. Add additional features (holes, fillets, chamfers)',
            '6. Apply material properties',
          ]
        : [
            '1. Create a new part document',
            '2. Set up reference geometry (planes, axes, points)',
            '3. Create base sketch with full constraints',
            '4. Extrude with draft or other advanced options',
            '5. Add multiple features (sweeps, lofts, patterns)',
            '6. Apply material properties and configurations',
            '7. Validate geometry and check for errors',
          ];

      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `I want to create a new SolidWorks part named "${partName}" with ${complexity} complexity.

Please guide me through the process using best practices:
${steps.join('\n')}

Let's start by creating the part document and setting up the initial sketch.`,
          },
        }],
      };
    }
  );

  // Prompt: Create Assembly Workflow
  server.registerPrompt(
    'create-assembly-workflow',
    {
      title: 'Create Assembly Workflow',
      description: 'Step-by-step guide to create a new SolidWorks assembly with components and mates',
      argsSchema: {
        assemblyName: z.string().describe('Name of the assembly to create'),
        componentCount: z.string().optional()
          .describe('Expected number of components in the assembly (as string for compatibility)'),
      },
    },
    ({ assemblyName, componentCount }) => {
      const componentText = componentCount 
        ? `The assembly will contain approximately ${componentCount} components.`
        : '';

      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `I want to create a new SolidWorks assembly named "${assemblyName}". ${componentText}

Please guide me through the process:
1. Create a new assembly document
2. Insert the base component (fixed component)
3. Insert additional components
4. Add mates to constrain components:
   - Coincident, Parallel, Perpendicular for geometric relationships
   - Distance, Angle for dimensional relationships
   - Concentric for cylindrical features
5. Verify assembly constraints (avoid over-constraining)
6. Check for interference between components
7. Create assembly configurations if needed

Best practices:
- Fix the first component to avoid floating
- Use minimal mates to fully constrain components
- Avoid redundant mates that can cause performance issues
- Check interference before finalizing the assembly

Let's start!`,
          },
        }],
      };
    }
  );

  // Prompt: Analyze Model
  server.registerPrompt(
    'analyze-model',
    {
      title: 'Analyze Model',
      description: 'Template for analyzing a SolidWorks model with various analysis types',
      argsSchema: {
        analysisType: completable(
          z.enum(['mass', 'interference', 'geometry', 'all']).describe('Type of analysis to perform'),
          (value): ('mass' | 'interference' | 'geometry' | 'all')[] => {
            return (['mass', 'interference', 'geometry', 'all'] as const).filter(t => t.startsWith(value));
          }
        ),
        modelName: z.string().optional()
          .describe('Name of the model to analyze (if not specified, uses current model)'),
      },
    },
    ({ analysisType, modelName }) => {
      const analysisSteps: Record<string, string[]> = {
        mass: [
          '1. Get mass properties (mass, volume, surface area)',
          '2. Calculate center of mass',
          '3. Get moments of inertia',
          '4. Verify material properties are applied',
        ],
        interference: [
          '1. Check for interference between components',
          '2. Identify interfering parts',
          '3. Measure interference volumes',
          '4. Suggest corrections if interference found',
        ],
        geometry: [
          '1. Check geometry for errors',
          '2. Validate faces, edges, and vertices',
          '3. Check for self-intersections',
          '4. Verify feature integrity',
        ],
        all: [
          '1. Perform mass property analysis',
          '2. Check for interference',
          '3. Validate geometry',
          '4. Generate comprehensive report',
        ],
      };

      const steps = analysisSteps[analysisType] || analysisSteps.all;
      const modelText = modelName ? ` on "${modelName}"` : ' on the current model';

      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Please perform ${analysisType} analysis${modelText}.

Steps to follow:
${steps.join('\n')}

Provide:
1. Detailed results with all relevant measurements
2. Any issues or warnings found
3. Recommendations for improvement
4. Best practices for the analyzed model type

Let's begin the analysis.`,
          },
        }],
      };
    }
  );

  // Prompt: Export Workflow
  server.registerPrompt(
    'export-workflow',
    {
      title: 'Export Workflow',
      description: 'Guide for exporting SolidWorks models to various formats with proper settings',
      argsSchema: {
        format: completable(
          z.enum(['STEP', 'IGES', 'STL', 'PDF', 'DXF', 'DWG']).describe('Export format'),
          (value): ('STEP' | 'IGES' | 'STL' | 'PDF' | 'DXF' | 'DWG')[] => {
            return (['STEP', 'IGES', 'STL', 'PDF', 'DXF', 'DWG'] as const).filter(f => f.startsWith(value));
          }
        ),
        outputPath: z.string().optional()
          .describe('Output file path (if not specified, will be generated)'),
      },
    },
    ({ format, outputPath }) => {
      const formatTips: Record<string, string> = {
        STEP: 'STEP format is best for CAD interoperability. Use for exchanging 3D models between different CAD systems.',
        IGES: 'IGES format is an older standard but widely supported. Use for legacy system compatibility.',
        STL: 'STL format is for 3D printing. Ensure proper mesh quality settings for your printer.',
        PDF: 'PDF format is for 2D drawings. Use for documentation and sharing drawings.',
        DXF: 'DXF format is for 2D drawings. Use for AutoCAD compatibility.',
        DWG: 'DWG format is for 2D drawings. Use for AutoCAD native format.',
      };

      const tip = formatTips[format] || 'Ensure proper format settings for your use case.';

      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `I want to export the current SolidWorks model to ${format} format${outputPath ? ` at "${outputPath}"` : ''}.

${tip}

Please guide me through:
1. Verify the model is ready for export (saved, no errors)
2. Set appropriate export options for ${format}:
   ${format === 'STL' ? '- Mesh quality (coarse/fine/custom)\n   - Units (mm/in/m)' : ''}
   ${format === 'STEP' || format === 'IGES' ? '- Version compatibility\n   - Units' : ''}
   ${format === 'PDF' || format === 'DXF' || format === 'DWG' ? '- Drawing sheet selection\n   - Scale settings' : ''}
3. Execute the export
4. Verify the exported file

Best practices:
- Always save the model before exporting
- Check export settings match your requirements
- Verify the exported file opens correctly in the target application
- For batch exports, use configurations if needed

Let's proceed with the export.`,
          },
        }],
      };
    }
  );

  // Prompt: Sketch Workflow
  server.registerPrompt(
    'sketch-workflow',
    {
      title: 'Sketch Workflow',
      description: 'Guide for creating and editing sketches in SolidWorks with best practices',
      argsSchema: {
        plane: z.enum(['Front', 'Top', 'Right']).optional()
          .describe('Reference plane for the sketch (Front, Top, or Right)'),
        sketchType: z.enum(['simple', 'complex']).optional()
          .describe('Sketch complexity: simple (basic geometry) or complex (advanced features)'),
      },
    },
    ({ plane = 'Front', sketchType = 'simple' }) => {
      const sketchGuidance = sketchType === 'simple'
        ? [
            '1. Create sketch on the selected plane',
            '2. Draw basic geometry (lines, circles, rectangles)',
            '3. Add dimensions to fully define the sketch',
            '4. Add constraints (horizontal, vertical, coincident)',
            '5. Exit sketch when fully defined',
          ]
        : [
            '1. Create sketch on the selected plane',
            '2. Draw base geometry with proper relationships',
            '3. Add advanced features (splines, arcs, patterns)',
            '4. Apply geometric constraints systematically',
            '5. Add dimensions to fully define all entities',
            '6. Use construction geometry for reference',
            '7. Verify sketch is fully defined (black entities)',
            '8. Exit sketch and use for feature creation',
          ];

      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `I want to create a ${sketchType} sketch on the ${plane} plane in SolidWorks.

Please guide me through the process using best practices:
${sketchGuidance.join('\n')}

Best practices for sketching:
- Always fully define sketches (all entities should be black, not blue)
- Use geometric constraints before dimensions when possible
- Keep sketches simple - complex features should use multiple sketches
- Use construction geometry for reference lines and points
- Avoid over-constraining (redundant constraints)
- Use parametric dimensions for easy modification
- Name sketches descriptively for better organization

Let's start creating the sketch!`,
          },
        }],
      };
    }
  );
}

