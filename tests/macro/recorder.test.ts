/**
 * Unit tests for Macro Recorder
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MacroRecorder } from '../../src/macro/recorder.js';
import { setupBeforeTest, teardownAfterTest, getSolidWorksAPI } from '../helpers/solidworks-setup.js';

describe('Macro Recorder', () => {
  let recorder: MacroRecorder;

  beforeEach(async () => {
    await setupBeforeTest();
    recorder = new MacroRecorder();
  });

  afterEach(async () => {
    recorder.clear();
    await teardownAfterTest();
  });

  describe('startRecording', () => {
    it('should start a new recording', () => {
      const id = recorder.startRecording('TestMacro', 'Test description');
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should throw if recording already in progress', () => {
      recorder.startRecording('TestMacro1');
      expect(() => recorder.startRecording('TestMacro2')).toThrow('A recording is already in progress');
    });
  });

  describe('stopRecording', () => {
    it('should stop and return recording', () => {
      const id = recorder.startRecording('TestMacro');
      recorder.recordAction('test-action', 'Test Action', { param: 'value' });
      
      const recording = recorder.stopRecording();
      expect(recording).not.toBeNull();
      expect(recording!.name).toBe('TestMacro');
      expect(recording!.actions).toHaveLength(1);
    });

    it('should return null if no recording in progress', () => {
      const recording = recorder.stopRecording();
      expect(recording).toBeNull();
    });
  });

  describe('recordAction', () => {
    it('should record an action', () => {
      recorder.startRecording('TestMacro');
      recorder.recordAction('test-action', 'Test Action', { param: 'value' });
      
      const recording = recorder.stopRecording();
      expect(recording!.actions).toHaveLength(1);
      expect(recording!.actions[0].type).toBe('test-action');
      expect(recording!.actions[0].name).toBe('Test Action');
      expect(recording!.actions[0].parameters).toEqual({ param: 'value' });
    });

    it('should throw if no recording in progress', () => {
      expect(() => recorder.recordAction('test', 'Test', {})).toThrow('No recording in progress');
    });
  });

  describe('getRecording', () => {
    it('should return recording by ID', () => {
      const id = recorder.startRecording('TestMacro');
      recorder.stopRecording();
      
      const recording = recorder.getRecording(id);
      expect(recording).not.toBeUndefined();
      expect(recording!.name).toBe('TestMacro');
    });

    it('should return undefined for non-existent ID', () => {
      expect(recorder.getRecording('non-existent')).toBeUndefined();
    });
  });

  describe('getAllRecordings', () => {
    it('should return all recordings', () => {
      recorder.startRecording('Macro1');
      recorder.stopRecording();
      recorder.startRecording('Macro2');
      recorder.stopRecording();
      
      const recordings = recorder.getAllRecordings();
      expect(recordings.length).toBe(2);
    });

    it('should return empty array when no recordings', () => {
      expect(recorder.getAllRecordings()).toEqual([]);
    });
  });

  describe('deleteRecording', () => {
    it('should delete a recording', () => {
      const id = recorder.startRecording('TestMacro');
      recorder.stopRecording();
      
      expect(recorder.deleteRecording(id)).toBe(true);
      expect(recorder.getRecording(id)).toBeUndefined();
    });

    it('should return false for non-existent ID', () => {
      expect(recorder.deleteRecording('non-existent')).toBe(false);
    });
  });

  describe('registerActionHandler', () => {
    it('should register an action handler', () => {
      const handler = async (action: any) => 'result';
      recorder.registerActionHandler('test-action', handler);
      // Handler is registered, no exception thrown
      expect(true).toBe(true);
    });
  });

  describe('executeMacro', () => {
    it('should execute a macro', async () => {
      const id = recorder.startRecording('TestMacro');
      recorder.recordAction('test-action', 'Test Action', {});
      recorder.stopRecording();
      
      recorder.registerActionHandler('test-action', async () => 'result');
      
      const execution = await recorder.executeMacro(id);
      expect(execution.status).toBe('completed');
      expect(execution.result).toBeDefined();
    });

    it('should throw for non-existent macro', async () => {
      await expect(recorder.executeMacro('non-existent')).rejects.toThrow();
    });

    it('should handle execution errors', async () => {
      const id = recorder.startRecording('TestMacro');
      recorder.recordAction('test-action', 'Test Action', {});
      recorder.stopRecording();
      
      recorder.registerActionHandler('test-action', async () => {
        throw new Error('Handler error');
      });
      
      const execution = await recorder.executeMacro(id);
      expect(execution.status).toBe('failed');
      expect(execution.error).toBeDefined();
    });
  });

  describe('exportToVBA', () => {
    it('should export recording to VBA', () => {
      const id = recorder.startRecording('ExportTest');
      recorder.recordAction('create-sketch', 'Create Sketch', { plane: 'Front' });
      recorder.recordAction('add-line', 'Add Line', {
        x1: 0, y1: 0, z1: 0,
        x2: 100, y2: 0, z2: 0
      });
      recorder.stopRecording();
      
      const vbaCode = recorder.exportToVBA(id);
      expect(vbaCode).toContain('Sub ExportTest');
      expect(vbaCode).toContain('End Sub');
    });

    it('should throw for non-existent macro', () => {
      expect(() => recorder.exportToVBA('non-existent')).toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all recordings and executions', () => {
      recorder.startRecording('TestMacro');
      recorder.stopRecording();
      
      recorder.clear();
      
      expect(recorder.getAllRecordings()).toEqual([]);
    });
  });
});

