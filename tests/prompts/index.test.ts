/**
 * Unit tests for Prompts module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllPrompts } from '../../src/prompts/index.js';

describe('Prompts Module', () => {
  let server: McpServer;

  beforeEach(() => {
    // Create a mock MCP server
    server = {
      registerPrompt: (name: string, options: any, handler: any) => {
        // Mock implementation
      },
    } as any;
  });

  describe('registerAllPrompts', () => {
    it('should register all prompts without errors', () => {
      expect(() => {
        registerAllPrompts(server);
      }).not.toThrow();
    });

    it('should register create-part-workflow prompt', () => {
      const registeredPrompts: string[] = [];
      const mockServer = {
        registerPrompt: (name: string, options: any, handler: any) => {
          registeredPrompts.push(name);
        },
      } as any;

      registerAllPrompts(mockServer);
      expect(registeredPrompts).toContain('create-part-workflow');
    });

    it('should register create-assembly-workflow prompt', () => {
      const registeredPrompts: string[] = [];
      const mockServer = {
        registerPrompt: (name: string, options: any, handler: any) => {
          registeredPrompts.push(name);
        },
      } as any;

      registerAllPrompts(mockServer);
      expect(registeredPrompts).toContain('create-assembly-workflow');
    });

    it('should register analyze-model prompt', () => {
      const registeredPrompts: string[] = [];
      const mockServer = {
        registerPrompt: (name: string, options: any, handler: any) => {
          registeredPrompts.push(name);
        },
      } as any;

      registerAllPrompts(mockServer);
      expect(registeredPrompts).toContain('analyze-model');
    });

    it('should register export-workflow prompt', () => {
      const registeredPrompts: string[] = [];
      const mockServer = {
        registerPrompt: (name: string, options: any, handler: any) => {
          registeredPrompts.push(name);
        },
      } as any;

      registerAllPrompts(mockServer);
      expect(registeredPrompts).toContain('export-workflow');
    });

    it('should register sketch-workflow prompt', () => {
      const registeredPrompts: string[] = [];
      const mockServer = {
        registerPrompt: (name: string, options: any, handler: any) => {
          registeredPrompts.push(name);
        },
      } as any;

      registerAllPrompts(mockServer);
      expect(registeredPrompts).toContain('sketch-workflow');
    });

    it('should register all 5 prompts', () => {
      const registeredPrompts: string[] = [];
      const mockServer = {
        registerPrompt: (name: string, options: any, handler: any) => {
          registeredPrompts.push(name);
        },
      } as any;

      registerAllPrompts(mockServer);
      expect(registeredPrompts.length).toBe(5);
    });
  });

  describe('prompt handlers', () => {
    it('should handle create-part-workflow with simple complexity', () => {
      let capturedHandler: any = null;
      const mockServer = {
        registerPrompt: (name: string, options: any, handler: any) => {
          if (name === 'create-part-workflow') {
            capturedHandler = handler;
          }
        },
      } as any;

      registerAllPrompts(mockServer);
      
      const result = capturedHandler({ partName: 'TestPart', complexity: 'simple' });
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages[0].content.text).toContain('TestPart');
      expect(result.messages[0].content.text).toContain('simple');
    });

    it('should handle create-part-workflow with medium complexity', () => {
      let capturedHandler: any = null;
      const mockServer = {
        registerPrompt: (name: string, options: any, handler: any) => {
          if (name === 'create-part-workflow') {
            capturedHandler = handler;
          }
        },
      } as any;

      registerAllPrompts(mockServer);
      
      const result = capturedHandler({ partName: 'TestPart', complexity: 'medium' });
      expect(result.messages[0].content.text).toContain('medium');
    });

    it('should handle create-part-workflow with complex complexity', () => {
      let capturedHandler: any = null;
      const mockServer = {
        registerPrompt: (name: string, options: any, handler: any) => {
          if (name === 'create-part-workflow') {
            capturedHandler = handler;
          }
        },
      } as any;

      registerAllPrompts(mockServer);
      
      const result = capturedHandler({ partName: 'TestPart', complexity: 'complex' });
      expect(result.messages[0].content.text).toContain('complex');
    });

    it('should handle create-assembly-workflow', () => {
      let capturedHandler: any = null;
      const mockServer = {
        registerPrompt: (name: string, options: any, handler: any) => {
          if (name === 'create-assembly-workflow') {
            capturedHandler = handler;
          }
        },
      } as any;

      registerAllPrompts(mockServer);
      
      const result = capturedHandler({ assemblyName: 'TestAssembly', componentCount: '5' });
      expect(result.messages[0].content.text).toContain('TestAssembly');
      expect(result.messages[0].content.text).toContain('5');
    });

    it('should handle analyze-model prompt', () => {
      let capturedHandler: any = null;
      const mockServer = {
        registerPrompt: (name: string, options: any, handler: any) => {
          if (name === 'analyze-model') {
            capturedHandler = handler;
          }
        },
      } as any;

      registerAllPrompts(mockServer);
      
      const result = capturedHandler({ analysisType: 'mass', modelName: 'TestModel' });
      expect(result.messages[0].content.text).toContain('mass');
      expect(result.messages[0].content.text).toContain('TestModel');
    });

    it('should handle export-workflow prompt', () => {
      let capturedHandler: any = null;
      const mockServer = {
        registerPrompt: (name: string, options: any, handler: any) => {
          if (name === 'export-workflow') {
            capturedHandler = handler;
          }
        },
      } as any;

      registerAllPrompts(mockServer);
      
      const result = capturedHandler({ format: 'STEP', outputPath: '/path/to/output.step' });
      expect(result.messages[0].content.text).toContain('STEP');
      expect(result.messages[0].content.text).toContain('/path/to/output.step');
    });

    it('should handle sketch-workflow prompt', () => {
      let capturedHandler: any = null;
      const mockServer = {
        registerPrompt: (name: string, options: any, handler: any) => {
          if (name === 'sketch-workflow') {
            capturedHandler = handler;
          }
        },
      } as any;

      registerAllPrompts(mockServer);
      
      const result = capturedHandler({ plane: 'Front', sketchType: 'simple' });
      expect(result.messages[0].content.text).toContain('Front');
      expect(result.messages[0].content.text).toContain('simple');
    });
  });
});

