/**
 * Error Recovery Utilities
 * Provides error classification, retry mechanisms, and state recovery for SolidWorks API operations
 */

import { logger } from './logger.js';

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  RECOVERABLE = 'recoverable', // Can be retried
  STATE_ERROR = 'state_error', // Requires state recovery
  PERMANENT = 'permanent' // Cannot be recovered
}

/**
 * COM Error interface
 */
export interface COMError extends Error {
  code?: number;
  hresult?: number;
  source?: string;
}

/**
 * Common COM/RPC error codes
 */
export const COMErrorCodes = {
  /** The message filter indicated that the application is busy */
  RPC_E_CALL_REJECTED: 0x80010001,
  /** The callee (server [not server application]) is not available and disappeared */
  RPC_E_DISCONNECTED: 0x80010108,
  /** Call was rejected by callee */
  RPC_E_SERVERCALL_RETRYLATER: 0x8001010A,
  /** The server threw an exception */
  RPC_E_SERVERFAULT: 0x80010105,
  /** A call was made to a COM object that was created on a different thread */
  RPC_E_WRONGTHREAD: 0x8001010E,
  /** The RPC server is unavailable */
  RPC_E_SERVER_UNAVAILABLE: 0x800706BA,
  /** The RPC server is too busy to complete this operation */
  RPC_E_SERVER_TOO_BUSY: 0x80010108,
  /** Catastrophic failure */
  E_FAIL: 0x80004005,
  /** Invalid argument */
  E_INVALIDARG: 0x80070057,
  /** Access denied */
  E_ACCESSDENIED: 0x80070005,
  /** Not implemented */
  E_NOTIMPL: 0x80004001,
  /** Out of memory */
  E_OUTOFMEMORY: 0x8007000E,
} as const;

/**
 * Type guard to check if an error is a COM error with error code
 */
export function isCOMError(error: unknown): error is COMError {
  return (
    error instanceof Error &&
    ('code' in error || 'hresult' in error)
  );
}

/**
 * Check if a COM error is recoverable (can be retried)
 */
export function isRecoverableCOMError(error: unknown): boolean {
  if (!isCOMError(error)) {
    return false;
  }

  const code = error.code || error.hresult;
  if (!code) {
    return false;
  }

  // These error codes indicate temporary conditions that may resolve with retry
  const recoverableCodes: number[] = [
    COMErrorCodes.RPC_E_CALL_REJECTED,
    COMErrorCodes.RPC_E_SERVERCALL_RETRYLATER,
    COMErrorCodes.RPC_E_SERVER_UNAVAILABLE,
    COMErrorCodes.RPC_E_SERVER_TOO_BUSY,
  ];

  return recoverableCodes.includes(code as number);
}

/**
 * Retry a COM operation with exponential backoff
 */
export async function recoverFromCOMError<T>(
  operation: () => T | Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const { maxRetries = 3, retryDelay = 1000, operationName = 'Operation' } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await Promise.resolve(operation());
    } catch (error) {
      lastError = error as Error;

      // Check if this is a recoverable COM error
      if (!isRecoverableCOMError(error)) {
        // Not recoverable, throw immediately
        throw error;
      }

      // This is the last attempt, throw the error
      if (attempt >= maxRetries - 1) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = retryDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 200; // Add up to 200ms jitter
      const totalDelay = delay + jitter;

      logger.warn(
        `${operationName} failed with recoverable COM error, ` +
        `retrying in ${Math.round(totalDelay)}ms (attempt ${attempt + 1}/${maxRetries})`,
        error as Error
      );

      await sleep(totalDelay);
    }
  }

  throw lastError || new Error('Unknown error in COM recovery');
}

/**
 * Check if an error is recoverable (can be retried)
 */
export function isRecoverableError(error: unknown): boolean {
  const message = String(error);
  
  // COM/RPC errors that are typically temporary
  const recoverablePatterns = [
    /RPC_E_CALL_REJECTED/i,
    /temporarily unavailable/i,
    /busy/i,
    /timeout/i,
    /connection/i,
    /COM object.*not available/i,
    /No active model/i,
    /No model open/i,
    /get active/i
  ];
  
  return recoverablePatterns.some(pattern => pattern.test(message));
}

/**
 * Check if an error requires state recovery
 */
export function isStateError(error: unknown): boolean {
  const message = String(error);
  
  const stateErrorPatterns = [
    /no active sketch/i,
    /sketch.*not.*edit/i,
    /selection.*failed/i,
    /not.*selected/i,
    /invalid.*state/i
  ];
  
  return stateErrorPatterns.some(pattern => pattern.test(message));
}

/**
 * Classify an error into a category
 */
export function classifyError(error: unknown): ErrorCategory {
  if (isStateError(error)) {
    return ErrorCategory.STATE_ERROR;
  }
  if (isRecoverableError(error)) {
    return ErrorCategory.RECOVERABLE;
  }
  return ErrorCategory.PERMANENT;
}

/**
 * Retry an operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => T | Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 100,
  options?: {
    onRetry?: (attempt: number, error: unknown) => void;
    shouldRetry?: (error: unknown) => boolean;
  }
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await Promise.resolve(operation());
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      const shouldRetry = options?.shouldRetry 
        ? options.shouldRetry(error)
        : isRecoverableError(error);
      
      if (!shouldRetry || attempt >= maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
      
      if (options?.onRetry) {
        options.onRetry(attempt, error);
      } else {
        logger.warn(
          `Operation failed, retrying (attempt ${attempt}/${maxRetries}) after ${delayMs}ms`,
          error instanceof Error ? error : new Error(String(error))
        );
      }
      
      await sleep(delayMs);
    }
  }
  
  throw lastError;
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Recover sketch state after an error
 */
export function recoverSketchState(model: any): void {
  if (!model) return;
  
  try {
    // 1. Clear all selections
    try {
      model.ClearSelection2(true);
    } catch (e) {
      logger.warn('Failed to clear selection during state recovery', e as Error);
    }
    
    // 2. If sketch is in an invalid state, try to exit
    try {
      const sketchMgr = model.SketchManager;
      if (sketchMgr && sketchMgr.ActiveSketch) {
        // Try to exit sketch mode
        sketchMgr.InsertSketch(true);
      }
    } catch (e) {
      logger.warn('Failed to exit sketch during state recovery', e as Error);
    }
    
    // 3. Rebuild model to ensure consistency
    try {
      if (model.EditRebuild3) {
        model.EditRebuild3();
      }
    } catch (e) {
      logger.warn('Failed to rebuild model during state recovery', e as Error);
    }
  } catch (e) {
    logger.error('State recovery failed', e as Error);
  }
}

/**
 * Wrap an operation with error recovery
 */
export async function withErrorRecovery<T>(
  operation: () => T | Promise<T>,
  model?: any,
  options?: {
    maxRetries?: number;
    recoverState?: boolean;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const recoverState = options?.recoverState ?? true;
  
  try {
    return await withRetry(operation, maxRetries, 100, {
      shouldRetry: (error) => {
        const category = classifyError(error);
        return category === ErrorCategory.RECOVERABLE || category === ErrorCategory.STATE_ERROR;
      },
      onRetry: (attempt, error) => {
        const category = classifyError(error);
        if (category === ErrorCategory.STATE_ERROR && recoverState && model) {
          logger.info(`Attempting state recovery (attempt ${attempt})`);
          recoverSketchState(model);
        }
        logger.warn(
          `Operation failed, retrying (attempt ${attempt}/${maxRetries})`,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    });
  } catch (error) {
    const category = classifyError(error);
    
    // Final state recovery attempt
    if (category === ErrorCategory.STATE_ERROR && recoverState && model) {
      logger.info('Final state recovery attempt');
      recoverSketchState(model);
    }
    
    throw error;
  }
}

