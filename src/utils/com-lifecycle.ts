/**
 * COM Object Lifecycle Management Utilities
 * Provides utilities for managing COM object references and preventing memory leaks
 */

import { logger } from './logger.js';

/**
 * Check if a COM object is still valid
 */
export function isCOMObjectValid(obj: any): boolean {
  if (!obj) return false;
  
  try {
    // Try to access a basic property or method
    // Most COM objects have at least toString or a Name property
    if (typeof obj.toString === 'function') {
      obj.toString();
    } else if (obj.Name !== undefined) {
      const _ = obj.Name;
    } else if (typeof obj.GetTypeName2 === 'function') {
      obj.GetTypeName2();
    } else {
      // If we can't find a safe property, assume it's valid
      // (some objects might not expose standard properties)
      return true;
    }
    return true;
  } catch (e) {
    // Object access failed - likely invalid
    return false;
  }
}

/**
 * Safe COM object reference wrapper
 * Tracks object validity and provides safe access with explicit release
 */
export class SafeCOMRef<T> {
  private ref: T | null;
  private isReleased: boolean = false;

  constructor(obj: T) {
    if (!obj) {
      throw new Error('Cannot create SafeCOMRef with null/undefined object');
    }
    this.ref = obj;
  }

  /**
   * Get the COM object reference
   * Throws if object is released or invalid
   */
  get(): T {
    if (this.isReleased) {
      throw new Error('COM object already released');
    }
    if (!this.ref) {
      throw new Error('COM object is null');
    }
    return this.ref;
  }

  /**
   * Release the COM object and clean up resources
   * Safe to call multiple times (idempotent)
   */
  release(): void {
    if (this.isReleased) return;

    try {
      // Try to call Release() method if it exists (some winax objects have it)
      if (this.ref && typeof (this.ref as any).Release === 'function') {
        (this.ref as any).Release();
      }
    } catch (error) {
      logger.warn('Error releasing COM object:', error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.ref = null;
      this.isReleased = true;
    }
  }

  /**
   * Check if the reference is still valid (not released and ref exists)
   */
  isValid(): boolean {
    return !this.isReleased && this.ref !== null;
  }

  /**
   * Check if the reference is still valid (alias for backward compatibility)
   */
  check(): boolean {
    return this.isValid();
  }

  /**
   * Invalidate the reference (deprecated - use release() instead)
   * @deprecated Use release() for proper cleanup
   */
  invalidate(): void {
    this.release();
  }

  /**
   * Get the reference if valid, null otherwise
   */
  getIfValid(): T | null {
    if (this.isValid()) {
      return this.ref;
    }
    return null;
  }
}

/**
 * RAII-style wrapper for COM objects
 * Automatically manages object lifecycle with proper cleanup
 */
export function withCOMObject<T, R>(
  obj: T,
  callback: (obj: T) => R | Promise<R>
): Promise<R> {
  const safe = new SafeCOMRef(obj);

  try {
    return Promise.resolve(callback(safe.get()));
  } catch (error) {
    logger.warn('COM object operation failed', error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    // Properly release the COM object to prevent memory leaks
    safe.release();
  }
}

/**
 * Clear Variant objects (if using winax Variant)
 * According to research: Variant objects should be cleared to prevent memory leaks
 */
export function clearVariant(variant: any): void {
  if (!variant) return;
  
  try {
    // Check if it's a winax Variant object
    if (typeof variant.clear === 'function') {
      variant.clear();
    }
  } catch (e) {
    logger.warn('Failed to clear Variant object', e as Error);
  }
}

/**
 * Batch clear multiple Variant objects
 */
export function clearVariants(variants: any[]): void {
  variants.forEach(v => clearVariant(v));
}

/**
 * Memory management recommendations for long-running services
 */
export interface MemoryManagementConfig {
  /** Enable periodic garbage collection (requires --expose-gc) */
  enablePeriodicGC?: boolean;
  /** GC interval in milliseconds */
  gcIntervalMs?: number;
  /** Maximum operations before suggesting SolidWorks restart */
  maxOperationsBeforeRestart?: number;
}

/**
 * Memory management helper for long-running services
 */
export class MemoryManager {
  private operationCount: number = 0;
  private config: MemoryManagementConfig;
  private gcInterval?: NodeJS.Timeout;
  
  constructor(config: MemoryManagementConfig = {}) {
    this.config = {
      enablePeriodicGC: config.enablePeriodicGC ?? false,
      gcIntervalMs: config.gcIntervalMs ?? 60000, // 1 minute
      maxOperationsBeforeRestart: config.maxOperationsBeforeRestart ?? 1000
    };
    
    if (this.config.enablePeriodicGC && global.gc) {
      this.gcInterval = setInterval(() => {
        global.gc!();
        logger.debug('Periodic garbage collection executed');
      }, this.config.gcIntervalMs);
    }
  }
  
  /**
   * Increment operation counter
   * Returns true if restart is recommended
   */
  recordOperation(): boolean {
    this.operationCount++;
    
    if (this.operationCount >= (this.config.maxOperationsBeforeRestart ?? 1000)) {
      logger.warn(
        `Operation count reached ${this.operationCount}. ` +
        `Consider restarting SolidWorks connection to prevent memory issues.`
      );
      return true;
    }
    
    return false;
  }
  
  /**
   * Reset operation counter
   */
  reset(): void {
    this.operationCount = 0;
  }
  
  /**
   * Get current operation count
   */
  getOperationCount(): number {
    return this.operationCount;
  }
  
  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = undefined;
    }
  }
}

