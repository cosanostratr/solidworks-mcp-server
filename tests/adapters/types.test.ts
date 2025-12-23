/**
 * Unit tests for Adapter Types
 */

import { describe, it, expect } from 'vitest';
import {
  ModelSchema,
  FeatureSchema,
  SketchSchema
} from '../../src/adapters/types.js';

describe('Adapter Types', () => {
  describe('ModelSchema', () => {
    it('should validate correct model', () => {
      const model = {
        path: 'C:\\test.sldprt',
        name: 'test',
        type: 'Part' as const,
        isActive: true
      };
      expect(() => ModelSchema.parse(model)).not.toThrow();
    });

    it('should reject invalid type', () => {
      const model = {
        path: 'C:\\test.sldprt',
        name: 'test',
        type: 'Invalid',
        isActive: true
      };
      expect(() => ModelSchema.parse(model)).toThrow();
    });
  });

  describe('FeatureSchema', () => {
    it('should validate correct feature', () => {
      const feature = {
        id: 'feature-1',
        name: 'Extrude1',
        type: 'Extrude',
        suppressed: false,
        parameters: { depth: 10 }
      };
      expect(() => FeatureSchema.parse(feature)).not.toThrow();
    });
  });

  describe('SketchSchema', () => {
    it('should validate correct sketch', () => {
      const sketch = {
        id: 'sketch-1',
        name: 'Sketch1',
        plane: 'Front',
        entities: []
      };
      expect(() => SketchSchema.parse(sketch)).not.toThrow();
    });
  });
});

