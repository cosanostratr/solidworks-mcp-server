/**
 * MCP Resources for SolidWorks
 * Exposes read-only data like configuration, materials, templates, and system status
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SolidWorksAPI } from '../solidworks/api.js';
import { logger } from '../utils/logger.js';

/**
 * Register all Resources with the MCP server
 */
export function registerAllResources(server: McpServer, swApi: SolidWorksAPI): void {
  // Static resource: SolidWorks configuration
  server.registerResource(
    'sw-config',
    'solidworks://config',
    {
      title: 'SolidWorks Configuration',
      description: 'Current SolidWorks application configuration including version, units, precision, and template paths',
      mimeType: 'application/json',
    },
    async (uri) => {
      try {
        const config = await swApi.getConfiguration();
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(config, null, 2),
          }],
        };
      } catch (error) {
        logger.error('Failed to get SolidWorks configuration', error);
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({
              error: 'Failed to retrieve configuration',
              message: error instanceof Error ? error.message : String(error),
            }, null, 2),
          }],
        };
      }
    }
  );

  // Dynamic resource template: Material properties
  server.registerResource(
    'material',
    new ResourceTemplate('solidworks://materials/{materialName}', {
      list: undefined, // Could be enhanced to list available materials
    }),
    {
      title: 'Material Properties',
      description: 'Get properties for a specific material from the SolidWorks material database',
      mimeType: 'application/json',
    },
    async (uri, { materialName }) => {
      const materialNameStr = Array.isArray(materialName) ? materialName[0] : materialName;
      try {
        if (!materialNameStr || typeof materialNameStr !== 'string') {
          throw new Error('Material name is required');
        }
        const properties = await swApi.getMaterialProperties(materialNameStr);
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(properties, null, 2),
          }],
        };
      } catch (error) {
        logger.error(`Failed to get material properties for ${materialNameStr || 'unknown'}`, error);
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({
              error: 'Failed to retrieve material properties',
              materialName: materialNameStr,
              message: error instanceof Error ? error.message : String(error),
            }, null, 2),
          }],
        };
      }
    }
  );

  // Dynamic resource template: Template list
  server.registerResource(
    'templates',
    new ResourceTemplate('solidworks://templates/{type}', {
      list: undefined, // Could be enhanced to list available template types
    }),
    {
      title: 'Template List',
      description: 'Get list of available templates for a document type (part, assembly, or drawing)',
      mimeType: 'application/json',
    },
    async (uri, { type }) => {
      try {
        const typeStr = Array.isArray(type) ? type[0] : type;
        if (!typeStr || typeof typeStr !== 'string' || !['part', 'assembly', 'drawing'].includes(typeStr)) {
          throw new Error('Template type must be one of: part, assembly, drawing');
        }
        const templates = await swApi.getTemplateList(typeStr as 'part' | 'assembly' | 'drawing');
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(templates, null, 2),
          }],
        };
      } catch (error) {
        logger.error(`Failed to get template list for ${type}`, error);
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({
              error: 'Failed to retrieve template list',
              type,
              message: error instanceof Error ? error.message : String(error),
            }, null, 2),
          }],
        };
      }
    }
  );

  // Static resource: System status
  server.registerResource(
    'sw-system',
    'solidworks://system',
    {
      title: 'SolidWorks System Status',
      description: 'Current SolidWorks system status including connection state, version, active document, and open documents',
      mimeType: 'application/json',
    },
    async (uri) => {
      try {
        const status = await swApi.getSystemStatus();
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(status, null, 2),
          }],
        };
      } catch (error) {
        logger.error('Failed to get system status', error);
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({
              error: 'Failed to retrieve system status',
              message: error instanceof Error ? error.message : String(error),
            }, null, 2),
          }],
        };
      }
    }
  );
}

