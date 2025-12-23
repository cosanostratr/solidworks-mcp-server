/**
 * Unit tests for Resources module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SolidWorksAPI } from '../../src/solidworks/api.js';
import { registerAllResources } from '../../src/resources/index.js';

describe('Resources Module', () => {
  let server: McpServer;
  let swApi: SolidWorksAPI;

  beforeEach(() => {
    server = {
      registerResource: vi.fn(),
    } as any;
    
    swApi = {
      getConfiguration: vi.fn().mockResolvedValue({
        version: '2024',
        units: { length: 'mm', mass: 'g', time: 's', angle: 'deg' },
      }),
      getMaterialProperties: vi.fn().mockResolvedValue({
        name: 'Steel',
        properties: { density: 7850 },
      }),
      getTemplateList: vi.fn().mockResolvedValue({
        type: 'part',
        templates: [{ name: 'Default Template', path: '/path/to/template' }],
      }),
      getSystemStatus: vi.fn().mockResolvedValue({
        connected: true,
        version: '2024',
      }),
    } as any;
  });

  describe('registerAllResources', () => {
    it('should register all resources without errors', () => {
      expect(() => {
        registerAllResources(server, swApi);
      }).not.toThrow();
    });

    it('should register sw-config resource', () => {
      registerAllResources(server, swApi);
      expect(server.registerResource).toHaveBeenCalledWith(
        'sw-config',
        'solidworks://config',
        expect.objectContaining({
          title: 'SolidWorks Configuration',
        }),
        expect.any(Function)
      );
    });

    it('should register material resource', () => {
      registerAllResources(server, swApi);
      expect(server.registerResource).toHaveBeenCalledWith(
        'material',
        expect.anything(),
        expect.objectContaining({
          title: 'Material Properties',
        }),
        expect.any(Function)
      );
    });

    it('should register templates resource', () => {
      registerAllResources(server, swApi);
      expect(server.registerResource).toHaveBeenCalledWith(
        'templates',
        expect.anything(),
        expect.objectContaining({
          title: 'Template List',
        }),
        expect.any(Function)
      );
    });

    it('should register sw-system resource', () => {
      registerAllResources(server, swApi);
      expect(server.registerResource).toHaveBeenCalledWith(
        'sw-system',
        'solidworks://system',
        expect.objectContaining({
          title: 'SolidWorks System Status',
        }),
        expect.any(Function)
      );
    });

    it('should register all 4 resources', () => {
      registerAllResources(server, swApi);
      expect(server.registerResource).toHaveBeenCalledTimes(4);
    });
  });

  describe('resource handlers', () => {
    it('should handle sw-config resource request', async () => {
      let handler: any = null;
      const mockServer = {
        registerResource: (name: string, uri: any, options: any, h: any) => {
          if (name === 'sw-config') {
            handler = h;
          }
        },
      } as any;

      registerAllResources(mockServer, swApi);

      const uri = { href: 'solidworks://config' };
      const result = await handler(uri);

      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);
      expect(result.contents[0].mimeType).toBe('application/json');
    });

    it('should handle material resource request', async () => {
      let handler: any = null;
      const mockServer = {
        registerResource: (name: string, uri: any, options: any, h: any) => {
          if (name === 'material') {
            handler = h;
          }
        },
      } as any;

      registerAllResources(mockServer, swApi);

      const uri = { href: 'solidworks://materials/Steel' };
      const params = { materialName: 'Steel' };
      const result = await handler(uri, params);

      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);
      expect(result.contents[0].mimeType).toBe('application/json');
    });

    it('should handle templates resource request', async () => {
      let handler: any = null;
      const mockServer = {
        registerResource: (name: string, uri: any, options: any, h: any) => {
          if (name === 'templates') {
            handler = h;
          }
        },
      } as any;

      registerAllResources(mockServer, swApi);

      const uri = { href: 'solidworks://templates/part' };
      const params = { type: 'part' };
      const result = await handler(uri, params);

      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);
      expect(result.contents[0].mimeType).toBe('application/json');
    });

    it('should handle sw-system resource request', async () => {
      let handler: any = null;
      const mockServer = {
        registerResource: (name: string, uri: any, options: any, h: any) => {
          if (name === 'sw-system') {
            handler = h;
          }
        },
      } as any;

      registerAllResources(mockServer, swApi);

      const uri = { href: 'solidworks://system' };
      const result = await handler(uri);

      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);
      expect(result.contents[0].mimeType).toBe('application/json');
    });

    it('should handle errors gracefully in sw-config handler', async () => {
      const errorSwApi = {
        getConfiguration: vi.fn().mockRejectedValue(new Error('Connection failed')),
      } as any;

      let handler: any = null;
      const mockServer = {
        registerResource: (name: string, uri: any, options: any, h: any) => {
          if (name === 'sw-config') {
            handler = h;
          }
        },
      } as any;

      registerAllResources(mockServer, errorSwApi);

      const uri = { href: 'solidworks://config' };
      const result = await handler(uri);

      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();
      const content = JSON.parse(result.contents[0].text);
      expect(content.error).toBeDefined();
    });

    it('should handle errors gracefully in material handler', async () => {
      const errorSwApi = {
        getMaterialProperties: vi.fn().mockRejectedValue(new Error('Material not found')),
      } as any;

      let handler: any = null;
      const mockServer = {
        registerResource: (name: string, uri: any, options: any, h: any) => {
          if (name === 'material') {
            handler = h;
          }
        },
      } as any;

      registerAllResources(mockServer, errorSwApi);

      const uri = { href: 'solidworks://materials/InvalidMaterial' };
      const params = { materialName: 'InvalidMaterial' };
      const result = await handler(uri, params);

      expect(result).toBeDefined();
      expect(result.contents).toBeDefined();
      const content = JSON.parse(result.contents[0].text);
      expect(content.error).toBeDefined();
    });
  });
});

