/**
 * Tool type definitions for MCP Server
 * Unified interface for all tools
 */

import { z } from 'zod';
import { SolidWorksAPI } from '../solidworks/api.js';

/**
 * Tool definition interface
 * Compatible with both old Server API and new McpServer API
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any> | z.ZodTypeAny; // Can be ZodObject or raw shape
  outputSchema?: z.ZodObject<any> | z.ZodTypeAny; // Optional for backward compatibility, but recommended
  handler: (args: any, swApi: SolidWorksAPI) => Promise<any> | any;
}

/**
 * Helper to create a tool result with structured content
 */
export function createToolResult(
  data: any,
  error?: string
): { content: Array<{ type: 'text'; text: string }>; structuredContent?: any } {
  if (error) {
    return {
      content: [{ type: 'text', text: error }]
    };
  }

  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const structuredContent = typeof data === 'object' && data !== null && !Array.isArray(data) 
    ? data 
    : undefined;

  return {
    content: [{ type: 'text', text }],
    ...(structuredContent && { structuredContent })
  };
}

