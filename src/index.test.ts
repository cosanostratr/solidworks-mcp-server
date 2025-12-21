/**
 * Test suite for SolidWorks MCP Server
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { vbaTools } from './tools/vba/index.js';
import { MacroRecorder } from './macro/recorder.js';

// Mock SolidWorks API
vi.mock('./solidworks/api.js', () => ({
  SolidWorksAPI: vi.fn().mockImplementation(() => ({
    isConnected: vi.fn().mockReturnValue(false),
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(true),
    createSketch: vi.fn().mockResolvedValue({ sketchId: 'test-sketch' }),
    addLine: vi.fn().mockResolvedValue({ lineId: 'test-line' }),
    extrude: vi.fn().mockResolvedValue({ featureId: 'test-extrude' })
  }))
}));

describe('SolidWorks MCP Server', () => {
  describe('Tool Definitions', () => {
    it('should have VBA tools defined', () => {
      expect(vbaTools).toBeDefined();
      expect(vbaTools.length).toBeGreaterThan(0);

      const generateVbaTool = vbaTools.find(t => t.name === 'generate_vba_script');
      expect(generateVbaTool).toBeDefined();
    });
  });

  describe('Macro Recorder', () => {
    let recorder: MacroRecorder;

    beforeAll(() => {
      recorder = new MacroRecorder();
    });

    afterAll(() => {
      recorder.clear();
    });

    it('should start and stop recording', () => {
      const id = recorder.startRecording('TestMacro', 'Test description');
      expect(id).toBeDefined();

      recorder.recordAction('test-action', 'Test Action', { param: 'value' });
      
      const recording = recorder.stopRecording();
      expect(recording).toBeDefined();
      expect(recording!.name).toBe('TestMacro');
      expect(recording!.actions).toHaveLength(1);
    });

    it('should export macro to VBA', () => {
      const id = recorder.startRecording('ExportTest');
      
      recorder.recordAction('create-sketch', 'Create Sketch', { plane: 'Front' });
      recorder.recordAction('add-line', 'Add Line', {
        x1: 0, y1: 0, z1: 0,
        x2: 100, y2: 0, z2: 0
      });
      
      const recording = recorder.stopRecording();
      const vbaCode = recorder.exportToVBA(recording!.id);
      
      expect(vbaCode).toContain('Sub ExportTest()');
      expect(vbaCode).toContain('swModel.CreateSketch "Front"');
      expect(vbaCode).toContain('swModel.CreateLine2');
    });
  });
});