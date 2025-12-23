/**
 * Unit tests for Error Recovery utilities
 */

import { describe, it, expect, vi } from 'vitest';
import {
  ErrorCategory,
  COMError,
  COMErrorCodes,
  isCOMError,
  isRecoverableCOMError,
  isRecoverableError,
  isStateError,
  classifyError,
  recoverSketchState
} from '../../src/utils/error-recovery.js';

describe('Error Recovery Utilities', () => {
  describe('COMErrorCodes', () => {
    it('should have all expected error codes', () => {
      expect(COMErrorCodes.RPC_E_CALL_REJECTED).toBe(0x80010001);
      expect(COMErrorCodes.RPC_E_DISCONNECTED).toBe(0x80010108);
      expect(COMErrorCodes.RPC_E_SERVERCALL_RETRYLATER).toBe(0x8001010A);
      expect(COMErrorCodes.E_FAIL).toBe(0x80004005);
      expect(COMErrorCodes.E_INVALIDARG).toBe(0x80070057);
    });
  });

  describe('isCOMError', () => {
    it('should return true for error with code', () => {
      const error: COMError = new Error('Test') as COMError;
      error.code = 0x80010001;
      expect(isCOMError(error)).toBe(true);
    });

    it('should return true for error with hresult', () => {
      const error: COMError = new Error('Test') as COMError;
      error.hresult = 0x80010001;
      expect(isCOMError(error)).toBe(true);
    });

    it('should return false for plain Error', () => {
      expect(isCOMError(new Error('Test'))).toBe(false);
    });

    it('should return false for non-Error', () => {
      expect(isCOMError('string')).toBe(false);
      expect(isCOMError(null)).toBe(false);
      expect(isCOMError(undefined)).toBe(false);
    });
  });

  describe('isRecoverableCOMError', () => {
    it('should return true for recoverable codes', () => {
      const error: COMError = new Error('Test') as COMError;
      error.code = COMErrorCodes.RPC_E_CALL_REJECTED;
      expect(isRecoverableCOMError(error)).toBe(true);
    });

    it('should return false for non-recoverable codes', () => {
      const error: COMError = new Error('Test') as COMError;
      error.code = COMErrorCodes.E_FAIL;
      expect(isRecoverableCOMError(error)).toBe(false);
    });

    it('should return false for non-COM errors', () => {
      expect(isRecoverableCOMError(new Error('Test'))).toBe(false);
    });
  });

  describe('isRecoverableError', () => {
    it('should detect RPC_E_CALL_REJECTED in message', () => {
      expect(isRecoverableError('RPC_E_CALL_REJECTED')).toBe(true);
    });

    it('should detect temporarily unavailable', () => {
      expect(isRecoverableError('temporarily unavailable')).toBe(true);
    });

    it('should detect busy', () => {
      expect(isRecoverableError('busy')).toBe(true);
    });

    it('should detect timeout', () => {
      expect(isRecoverableError('timeout')).toBe(true);
    });

    it('should return false for non-recoverable errors', () => {
      expect(isRecoverableError('permanent failure')).toBe(false);
    });
  });

  describe('isStateError', () => {
    it('should detect no active sketch', () => {
      expect(isStateError('no active sketch')).toBe(true);
    });

    it('should detect sketch not edit', () => {
      expect(isStateError('sketch not edit')).toBe(true);
    });

    it('should detect selection failed', () => {
      expect(isStateError('selection failed')).toBe(true);
    });

    it('should return false for non-state errors', () => {
      expect(isStateError('other error')).toBe(false);
    });
  });

  describe('classifyError', () => {
    it('should classify state errors', () => {
      expect(classifyError('no active sketch')).toBe(ErrorCategory.STATE_ERROR);
    });

    it('should classify recoverable errors', () => {
      expect(classifyError('temporarily unavailable')).toBe(ErrorCategory.RECOVERABLE);
    });

    it('should classify permanent errors', () => {
      expect(classifyError('permanent failure')).toBe(ErrorCategory.PERMANENT);
    });
  });

  describe('recoverSketchState', () => {
    it('should handle null model', () => {
      expect(() => recoverSketchState(null)).not.toThrow();
    });

    it('should handle model without methods', () => {
      const model = {};
      expect(() => recoverSketchState(model)).not.toThrow();
    });

    it('should handle model with ClearSelection2', () => {
      let cleared = false;
      const model = {
        ClearSelection2: () => {
          cleared = true;
        }
      };
      recoverSketchState(model);
      expect(cleared).toBe(true);
    });

    it('should handle ClearSelection2 errors', () => {
      const model = {
        ClearSelection2: () => {
          throw new Error('Clear failed');
        }
      };
      expect(() => recoverSketchState(model)).not.toThrow();
    });

    it('should handle sketch exit', () => {
      let sketchExited = false;
      const model = {
        ClearSelection2: vi.fn(),
        SketchManager: {
          ActiveSketch: {},
        },
        EditRebuild3: vi.fn(),
      };
      (model.SketchManager as any).InsertSketch = vi.fn(() => {
        sketchExited = true;
      });
      recoverSketchState(model);
      expect(sketchExited).toBe(true);
    });

    it('should handle EditRebuild3', () => {
      const rebuildCalled = vi.fn();
      const model = {
        ClearSelection2: vi.fn(),
        SketchManager: {
          ActiveSketch: null,
        },
        EditRebuild3: rebuildCalled,
      };
      recoverSketchState(model);
      expect(rebuildCalled).toHaveBeenCalled();
    });
  });

  describe('recoverFromCOMError', () => {
    it('should retry on recoverable errors', async () => {
      const { recoverFromCOMError } = await import('../../src/utils/error-recovery.js');
      let attempts = 0;
      const operation = () => {
        attempts++;
        if (attempts < 2) {
          const error: any = new Error('RPC_E_CALL_REJECTED');
          error.code = 0x80010001;
          throw error;
        }
        return 'success';
      };

      const result = await recoverFromCOMError(operation, { maxRetries: 3 });
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should throw immediately on non-recoverable errors', async () => {
      const { recoverFromCOMError } = await import('../../src/utils/error-recovery.js');
      const operation = () => {
        throw new Error('Permanent error');
      };

      await expect(recoverFromCOMError(operation)).rejects.toThrow('Permanent error');
    });

    it('should throw after max retries', async () => {
      const { recoverFromCOMError } = await import('../../src/utils/error-recovery.js');
      const error: any = new Error('RPC_E_CALL_REJECTED');
      error.code = 0x80010001;
      const operation = () => {
        throw error;
      };

      await expect(recoverFromCOMError(operation, { maxRetries: 2 })).rejects.toThrow();
    });
  });

  describe('withRetry', () => {
    it('should retry on recoverable errors', async () => {
      const { withRetry } = await import('../../src/utils/error-recovery.js');
      let attempts = 0;
      const operation = () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('temporarily unavailable');
        }
        return 'success';
      };

      const result = await withRetry(operation, 3);
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should use custom shouldRetry', async () => {
      const { withRetry } = await import('../../src/utils/error-recovery.js');
      let attempts = 0;
      const operation = () => {
        attempts++;
        throw new Error('Custom error');
      };

      await expect(
        withRetry(operation, 3, 10, {
          shouldRetry: () => attempts < 2,
        })
      ).rejects.toThrow();
      expect(attempts).toBe(2);
    });

    it('should call onRetry callback', async () => {
      const { withRetry } = await import('../../src/utils/error-recovery.js');
      const onRetry = vi.fn();
      const operation = () => {
        throw new Error('temporarily unavailable');
      };

      await expect(withRetry(operation, 2, 10, { onRetry })).rejects.toThrow();
      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('withErrorRecovery', () => {
    it('should recover state on state errors', async () => {
      const { withErrorRecovery } = await import('../../src/utils/error-recovery.js');
      let attempts = 0;
      const model = {
        ClearSelection2: vi.fn(),
        SketchManager: { ActiveSketch: null },
        EditRebuild3: vi.fn(),
      };
      const operation = () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('no active sketch');
        }
        return 'success';
      };

      const result = await withErrorRecovery(operation, model, { maxRetries: 3 });
      expect(result).toBe('success');
      expect(model.ClearSelection2).toHaveBeenCalled();
    });

    it('should not recover state when disabled', async () => {
      const { withErrorRecovery } = await import('../../src/utils/error-recovery.js');
      const model = {
        ClearSelection2: vi.fn(),
      };
      const operation = () => {
        throw new Error('no active sketch');
      };

      await expect(
        withErrorRecovery(operation, model, { recoverState: false })
      ).rejects.toThrow();
    });
  });
});

