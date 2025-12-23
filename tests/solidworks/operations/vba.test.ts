/**
 * Unit tests for VBA Operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VBAOperations } from '../../../src/solidworks/operations/vba.js';
import { ISldWorksApp } from '../../../src/solidworks/types/com-types.js';

describe('VBAOperations', () => {
  let mockSwApp: ISldWorksApp;

  beforeEach(() => {
    mockSwApp = {
      RunMacro2: vi.fn().mockReturnValue(true),
      RunMacro: vi.fn().mockReturnValue(true),
    } as any;
  });

  describe('runMacro', () => {
    it('should throw error when not connected to SolidWorks', () => {
      expect(() => {
        VBAOperations.runMacro(null, 'macro.swp', 'Module1', 'Main', []);
      }).toThrow('Not connected to SolidWorks');
    });

    it('should run macro using RunMacro2', () => {
      const result = VBAOperations.runMacro(
        mockSwApp,
        'C:\\macros\\test.swp',
        'Module1',
        'Main',
        []
      );

      expect(mockSwApp.RunMacro2).toHaveBeenCalledWith(
        'C:\\macros\\test.swp',
        'Module1',
        'Main',
        1, // swRunMacroUnloadAfterRun
        0  // Error code
      );
      expect(result).toBe(true);
    });

    it('should fallback to RunMacro if RunMacro2 fails', () => {
      (mockSwApp.RunMacro2 as any).mockImplementation(() => {
        throw new Error('RunMacro2 failed');
      });

      const result = VBAOperations.runMacro(
        mockSwApp,
        'C:\\macros\\test.swp',
        'Module1',
        'Main',
        []
      );

      expect(mockSwApp.RunMacro).toHaveBeenCalledWith(
        'C:\\macros\\test.swp',
        'Module1',
        'Main'
      );
      expect(result).toBe(true);
    });

    it('should throw error if both methods fail', () => {
      (mockSwApp.RunMacro2 as any).mockImplementation(() => {
        throw new Error('RunMacro2 failed');
      });
      (mockSwApp.RunMacro as any).mockImplementation(() => {
        throw new Error('RunMacro failed');
      });

      expect(() => {
        VBAOperations.runMacro(mockSwApp, 'macro.swp', 'Module1', 'Main', []);
      }).toThrow('Failed to run macro');
    });

    it('should convert parameters to strings', () => {
      VBAOperations.runMacro(
        mockSwApp,
        'macro.swp' as any,
        'Module1' as any,
        'Main' as any,
        []
      );

      expect(mockSwApp.RunMacro2).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        1,
        0
      );
    });
  });
});

