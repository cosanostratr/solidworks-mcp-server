#!/usr/bin/env node

/**
 * SolidWorks MCP Server
 * Provides SolidWorks automation with macro recording and VBA generation
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import dotenv from 'dotenv';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

// Import logging
import { logInfo, logError, logOperation, logger } from './utils/logger.js';

// Import macro system
import { MacroRecorder } from './macro/index.js';

// Import existing tools
import { drawingTools } from './tools/drawing.js';
import { exportTools } from './tools/export.js';
import { vbaTools } from './tools/vba/index.js';
import { analysisTools } from './tools/analysis.js';
import { sketchTools } from './tools/sketch.js';
import { templateManagerTools } from './tools/template-manager.js';
import { nativeMacroTools } from './tools/native-macro.js';
import { diagnosticTools } from './tools/diagnostics.js';
import { macroSecurityTools } from './tools/macro-security.js';
import { createMacroRecordingTools } from './tools/macro-recording.js';

// Import API
import { SolidWorksAPI } from './solidworks/api.js';

// Import tool utilities
import { createToolResult } from './tools/types.js';
import { getToolTitle } from './tools/title-map.js';

// Import Resources and Prompts
import { registerAllResources } from './resources/index.js';
import { registerAllPrompts } from './prompts/index.js';

dotenv.config();

// Configuration schema
const ConfigSchema = z.object({
  solidworksPath: z.string().optional(),
  enableMacroRecording: z.boolean().default(true),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

class SolidWorksMCPServer {
  private server: McpServer;
  private api: SolidWorksAPI;
  private macroRecorder: MacroRecorder;
  private config: z.infer<typeof ConfigSchema>;

  constructor() {
    // Parse configuration
    this.config = ConfigSchema.parse({
      solidworksPath: process.env.SOLIDWORKS_PATH,
      enableMacroRecording: process.env.ENABLE_MACRO_RECORDING !== 'false',
      logLevel: process.env.LOG_LEVEL || 'info'
    });

    // Initialize components
    this.api = new SolidWorksAPI();
    this.macroRecorder = new MacroRecorder();

    // Create MCP server using high-level API
    this.server = new McpServer({
      name: 'solidworks-mcp-server',
      version: packageJson.version
    });

    this.registerAllTools();
    this.registerAllResources();
    this.registerAllPrompts();
    this.setupMacroHandlers();
  }

  /**
   * Register all tools with McpServer
   * Uses high-level API for automatic validation and error handling
   */
  private registerAllTools(): void {
    // Combine all tools
    const allTools = [
      ...drawingTools,
      ...sketchTools,
      ...exportTools,
      ...vbaTools,
      ...analysisTools,
      ...templateManagerTools,
      ...nativeMacroTools,
      ...diagnosticTools,
      ...macroSecurityTools,
      ...createMacroRecordingTools(this.macroRecorder)
    ];

    // Register each tool with McpServer
    for (const tool of allTools) {
      // Extract shape from ZodObject if needed
      let inputSchema: any = tool.inputSchema;
      if (tool.inputSchema instanceof z.ZodObject) {
        inputSchema = tool.inputSchema.shape;
      }
      
      // Extract shape from outputSchema if it's a ZodObject
      // Use type assertion since not all tools have outputSchema yet
      const toolWithOutput = tool as typeof tool & { outputSchema?: z.ZodTypeAny };
      let outputSchema: any = toolWithOutput.outputSchema;
      if (outputSchema instanceof z.ZodObject) {
        outputSchema = outputSchema.shape;
      } else if (!outputSchema) {
        outputSchema = z.any(); // Use z.any() as fallback if not defined
      }
      
      this.server.registerTool(
        tool.name,
        {
          title: getToolTitle(tool.name),
          description: tool.description,
          inputSchema,
          outputSchema
        },
        async (args: any) => {
          // Log operation start
          logOperation(tool.name, 'started', args);
          
          try {
            // Record action if recording
            if (this.config.enableMacroRecording && this.macroRecorder) {
              try {
                this.macroRecorder.recordAction(tool.name, tool.description, args);
              } catch (error) {
                // Recording not in progress, ignore
                logger.debug('Macro recording not active', { reason: 'no active recording' });
              }
            }
            
            // Ensure SolidWorks connection
            if (!this.api.isConnected()) {
              await this.api.connect();
            }
            
            // Execute tool handler
            const result = await tool.handler(args, this.api);
            
            // Log operation completion
            logOperation(tool.name, 'completed', { result });
            
            // Return with structured content if available
            return createToolResult(result);
          } catch (error) {
            // Log operation failure
            logOperation(tool.name, 'failed', { error });
            
            // Log error details
            const errorMessage = error instanceof Error ? error.message : String(error);
            logError(`Tool "${tool.name}" execution failed`, error instanceof Error ? error : new Error(errorMessage));
            
            // Re-throw error - McpServer will automatically convert to proper MCP error format
            throw error;
          }
        }
      );
    }
  }

  /**
   * Register all Resources with McpServer
   */
  private registerAllResources(): void {
    registerAllResources(this.server, this.api);
  }

  /**
   * Register all Prompts with McpServer
   */
  private registerAllPrompts(): void {
    registerAllPrompts(this.server);
  }

  /**
   * Setup macro action handlers
   */
  private setupMacroHandlers(): void {
    // Register handlers for different action types
    this.macroRecorder.registerActionHandler('create-sketch', async (action) => {
      return await this.api.createSketch(action.parameters);
    });

    this.macroRecorder.registerActionHandler('add-line', async (action) => {
      return await this.api.addLine(action.parameters);
    });

    this.macroRecorder.registerActionHandler('extrude', async (action) => {
      return await this.api.extrude(action.parameters);
    });

    // Add more handlers as needed
  }

  /**
   * Initialize and start the server
   */
  async start(): Promise<void> {
    try {
      // Start server with stdio transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logInfo('SolidWorks MCP Server started', {
        version: packageJson.version,
        features: {
          macroRecording: this.config.enableMacroRecording
        }
      });

      // Handle shutdown
      process.on('SIGINT', async () => {
        logInfo('Shutting down server...');
        await this.shutdown();
        process.exit(0);
      });

    } catch (error) {
      logError('Failed to start server', error);
      throw error;
    }
  }

  /**
   * Shutdown the server
   */
  async shutdown(): Promise<void> {
    logInfo('Starting server shutdown...');
    
    // Clear macro recorder
    this.macroRecorder.clear();
    
    // Disconnect from SolidWorks
    if (this.api.isConnected()) {
      await this.api.disconnect();
    }
    
    logInfo('Server shutdown complete');
  }
}

// Main entry point
async function main() {
  try {
    const server = new SolidWorksMCPServer();
    await server.start();
  } catch (error) {
    logError('Fatal error', error);
    process.exit(1);
  }
}

// Always run main when this file is executed
main().catch((error) => {
  // Don't use console.error in MCP servers - it interferes with JSON-RPC
  logError('Failed to start SolidWorks MCP Server', error);
  process.exit(1);
});

export { SolidWorksMCPServer };