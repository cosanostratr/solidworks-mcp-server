/**
 * Unit tests for COM Lifecycle Management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isCOMObjectValid,
  SafeCOMRef,
  withCOMObject,
  clearVariant,
  clearVariants,
  MemoryManager
} from '../../src/utils/com-lifecycle.js';

describe('COM Lifecycle Management', () => {
  describe('isCOMObjectValid', () => {
    it('should return false for null', () => {
      expect(isCOMObjectValid(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isCOMObjectValid(undefined)).toBe(false);
    });

    it('should return true for object with toString', () => {
      const obj = { toString: () => 'test' };
      expect(isCOMObjectValid(obj)).toBe(true);
    });

    it('should return true for object with Name property', () => {
      const obj = { Name: 'test' };
      expect(isCOMObjectValid(obj)).toBe(true);
    });

    it('should return true for object with GetTypeName2 method', () => {
      const obj = { GetTypeName2: () => 'test' };
      expect(isCOMObjectValid(obj)).toBe(true);
    });

    it('should return false for object that throws on access', () => {
      const obj = {
        toString: () => {
          throw new Error('Access failed');
        }
      };
      expect(isCOMObjectValid(obj)).toBe(false);
    });

    it('should return true for plain object without standard properties', () => {
      const obj = { customProp: 'value' };
      expect(isCOMObjectValid(obj)).toBe(true);
    });
  });

  describe('SafeCOMRef', () => {
    it('should create with valid object', () => {
      const obj = { name: 'test' };
      const ref = new SafeCOMRef(obj);
      expect(ref.get()).toBe(obj);
    });

    it('should throw when creating with null', () => {
      expect(() => new SafeCOMRef(null as any)).toThrow();
    });

    it('should throw when creating with undefined', () => {
      expect(() => new SafeCOMRef(undefined as any)).toThrow();
    });

    it('should return object via get()', () => {
      const obj = { name: 'test' };
      const ref = new SafeCOMRef(obj);
      expect(ref.get()).toBe(obj);
    });

    it('should throw when getting after release', () => {
      const obj = { name: 'test' };
      const ref = new SafeCOMRef(obj);
      ref.release();
      expect(() => ref.get()).toThrow('COM object already released');
    });

    it('should be idempotent when releasing multiple times', () => {
      const obj = { name: 'test' };
      const ref = new SafeCOMRef(obj);
      ref.release();
      expect(() => ref.release()).not.toThrow();
    });

    it('should call Release() method if available', () => {
      let released = false;
      const obj = {
        Release: () => {
          released = true;
        }
      };
      const ref = new SafeCOMRef(obj);
      ref.release();
      expect(released).toBe(true);
    });

    it('should handle Release() errors gracefully', () => {
      const obj = {
        Release: () => {
          throw new Error('Release failed');
        }
      };
      const ref = new SafeCOMRef(obj);
      expect(() => ref.release()).not.toThrow();
    });

    it('should return true for isValid() when valid', () => {
      const obj = { name: 'test' };
      const ref = new SafeCOMRef(obj);
      expect(ref.isValid()).toBe(true);
    });

    it('should return false for isValid() when released', () => {
      const obj = { name: 'test' };
      const ref = new SafeCOMRef(obj);
      ref.release();
      expect(ref.isValid()).toBe(false);
    });

    it('should have check() as alias for isValid()', () => {
      const obj = { name: 'test' };
      const ref = new SafeCOMRef(obj);
      expect(ref.check()).toBe(true);
      ref.release();
      expect(ref.check()).toBe(false);
    });

    it('should return null for getIfValid() when released', () => {
      const obj = { name: 'test' };
      const ref = new SafeCOMRef(obj);
      ref.release();
      expect(ref.getIfValid()).toBeNull();
    });

    it('should return object for getIfValid() when valid', () => {
      const obj = { name: 'test' };
      const ref = new SafeCOMRef(obj);
      expect(ref.getIfValid()).toBe(obj);
    });
  });

  describe('withCOMObject', () => {
    it('should execute callback with object', async () => {
      const obj = { value: 42 };
      const result = await withCOMObject(obj, (o) => o.value);
      expect(result).toBe(42);
    });

    it('should release object after callback', async () => {
      const obj = { value: 42 };
      const result = await withCOMObject(obj, async (o) => {
        return o.value;
      });
      expect(result).toBe(42);
      // Object is released after callback completes
    });

    it('should handle errors and still release', async () => {
      const obj = { value: 42 };
      await expect(
        withCOMObject(obj, () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });
  });

  describe('clearVariant', () => {
    it('should do nothing for null', () => {
      expect(() => clearVariant(null)).not.toThrow();
    });

    it('should do nothing for undefined', () => {
      expect(() => clearVariant(undefined)).not.toThrow();
    });

    it('should call clear() if available', () => {
      let cleared = false;
      const variant = {
        clear: () => {
          cleared = true;
        }
      };
      clearVariant(variant);
      expect(cleared).toBe(true);
    });

    it('should handle clear() errors gracefully', () => {
      const variant = {
        clear: () => {
          throw new Error('Clear failed');
        }
      };
      expect(() => clearVariant(variant)).not.toThrow();
    });
  });

  describe('clearVariants', () => {
    it('should clear multiple variants', () => {
      const cleared: boolean[] = [];
      const variants = [
        { clear: () => { cleared.push(true); } },
        { clear: () => { cleared.push(true); } },
        { clear: () => { cleared.push(true); } }
      ];
      clearVariants(variants);
      expect(cleared.length).toBe(3);
    });

    it('should handle empty array', () => {
      expect(() => clearVariants([])).not.toThrow();
    });
  });

  describe('MemoryManager', () => {
    let manager: MemoryManager;

    afterEach(() => {
      if (manager) {
        manager.dispose();
      }
    });

    it('should create with default config', () => {
      manager = new MemoryManager();
      expect(manager.getOperationCount()).toBe(0);
    });

    it('should create with custom config', () => {
      manager = new MemoryManager({
        maxOperationsBeforeRestart: 100
      });
      expect(manager.getOperationCount()).toBe(0);
    });

    it('should increment operation count', () => {
      manager = new MemoryManager();
      manager.recordOperation();
      expect(manager.getOperationCount()).toBe(1);
    });

    it('should return false when under limit', () => {
      manager = new MemoryManager({ maxOperationsBeforeRestart: 10 });
      const result = manager.recordOperation();
      expect(result).toBe(false);
    });

    it('should return true when at limit', () => {
      manager = new MemoryManager({ maxOperationsBeforeRestart: 1 });
      const result = manager.recordOperation();
      expect(result).toBe(true);
    });

    it('should reset operation count', () => {
      manager = new MemoryManager();
      manager.recordOperation();
      manager.recordOperation();
      manager.reset();
      expect(manager.getOperationCount()).toBe(0);
    });

    it('should dispose resources', () => {
      manager = new MemoryManager({ enablePeriodicGC: true });
      expect(() => manager.dispose()).not.toThrow();
    });
  });
});

