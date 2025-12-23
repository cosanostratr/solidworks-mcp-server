/**
 * Unit tests for COM Boolean utilities
 */

import { describe, it, expect } from 'vitest';
import {
  COM_BOOL,
  toVariantBool,
  fromVariantBool,
  isVariantTrue,
  isVariantFalse,
  COM
} from '../../src/utils/com-boolean.js';

describe('COM Boolean Utilities', () => {
  describe('COM_BOOL constants', () => {
    it('should have TRUE as -1', () => {
      expect(COM_BOOL.TRUE).toBe(-1);
    });

    it('should have FALSE as 0', () => {
      expect(COM_BOOL.FALSE).toBe(0);
    });
  });

  describe('toVariantBool', () => {
    it('should convert true to -1', () => {
      expect(toVariantBool(true)).toBe(-1);
    });

    it('should convert false to 0', () => {
      expect(toVariantBool(false)).toBe(0);
    });
  });

  describe('fromVariantBool', () => {
    it('should convert -1 to true', () => {
      expect(fromVariantBool(-1)).toBe(true);
    });

    it('should convert 0 to false', () => {
      expect(fromVariantBool(0)).toBe(false);
    });

    it('should return boolean values as-is', () => {
      expect(fromVariantBool(true)).toBe(true);
      expect(fromVariantBool(false)).toBe(false);
    });

    it('should convert null to false', () => {
      expect(fromVariantBool(null)).toBe(false);
    });

    it('should convert undefined to false', () => {
      expect(fromVariantBool(undefined)).toBe(false);
    });

    it('should convert non-zero numbers to true', () => {
      expect(fromVariantBool(1)).toBe(true);
      expect(fromVariantBool(42)).toBe(true);
      expect(fromVariantBool(-2)).toBe(true);
    });
  });

  describe('isVariantTrue', () => {
    it('should return true only for -1', () => {
      expect(isVariantTrue(-1)).toBe(true);
      expect(isVariantTrue(0)).toBe(false);
      expect(isVariantTrue(1)).toBe(false);
      expect(isVariantTrue(true)).toBe(false);
      expect(isVariantTrue(false)).toBe(false);
      expect(isVariantTrue(null)).toBe(false);
      expect(isVariantTrue(undefined)).toBe(false);
    });
  });

  describe('isVariantFalse', () => {
    it('should return true for 0', () => {
      expect(isVariantFalse(0)).toBe(true);
    });

    it('should return false for -1', () => {
      expect(isVariantFalse(-1)).toBe(false);
    });

    it('should return false for other values', () => {
      expect(isVariantFalse(1)).toBe(false);
      expect(isVariantFalse(true)).toBe(false);
      expect(isVariantFalse(false)).toBe(false);
    });
  });

  describe('COM object', () => {
    it('should have TRUE constant', () => {
      expect(COM.TRUE).toBe(-1);
    });

    it('should have FALSE constant', () => {
      expect(COM.FALSE).toBe(0);
    });

    it('should have bool function', () => {
      expect(COM.bool(true)).toBe(-1);
      expect(COM.bool(false)).toBe(0);
    });

    it('should have fromBool function', () => {
      expect(COM.fromBool(-1)).toBe(true);
      expect(COM.fromBool(0)).toBe(false);
    });

    it('should have isTrue function', () => {
      expect(COM.isTrue(-1)).toBe(true);
      expect(COM.isTrue(0)).toBe(false);
    });

    it('should have isFalse function', () => {
      expect(COM.isFalse(0)).toBe(true);
      expect(COM.isFalse(-1)).toBe(false);
    });
  });
});

