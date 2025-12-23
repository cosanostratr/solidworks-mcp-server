/**
 * Unit tests for SolidWorks Constants
 */

import { describe, it, expect } from 'vitest';
import {
  SwDocumentType,
  DocumentExtensions,
  SwSaveAsOptions,
  SwFeatureType,
  SwEndCondition,
  SwConstants,
  PerformanceLimits
} from '../../../src/shared/constants/solidworks-constants.js';

describe('SolidWorks Constants', () => {
  describe('SwDocumentType', () => {
    it('should have correct enum values', () => {
      expect(SwDocumentType.None).toBe(0);
      expect(SwDocumentType.Part).toBe(1);
      expect(SwDocumentType.Assembly).toBe(2);
      expect(SwDocumentType.Drawing).toBe(3);
    });
  });

  describe('DocumentExtensions', () => {
    it('should have part extensions', () => {
      expect(DocumentExtensions.Part).toContain('.sldprt');
    });

    it('should have assembly extensions', () => {
      expect(DocumentExtensions.Assembly).toContain('.sldasm');
    });

    it('should have drawing extensions', () => {
      expect(DocumentExtensions.Drawing).toContain('.slddrw');
    });
  });

  describe('SwSaveAsOptions', () => {
    it('should have correct enum values', () => {
      expect(SwSaveAsOptions.Silent).toBe(1);
      expect(SwSaveAsOptions.Copy).toBe(2);
    });
  });

  describe('SwFeatureType', () => {
    it('should have correct enum values', () => {
      expect(SwFeatureType.ExtrudeFeature).toBe(1);
      expect(SwFeatureType.RevolveFeature).toBe(2);
    });
  });

  describe('SwEndCondition', () => {
    it('should have correct enum values', () => {
      expect(SwEndCondition.Blind).toBe(0);
      expect(SwEndCondition.ThroughAll).toBe(1);
    });
  });

  describe('SwConstants', () => {
    it('should be defined', () => {
      expect(SwConstants).toBeDefined();
    });
  });

  describe('PerformanceLimits', () => {
    it('should have MAX_FEATURE_ITERATIONS', () => {
      expect(PerformanceLimits.MAX_FEATURE_ITERATIONS).toBeGreaterThan(0);
    });
  });
});

