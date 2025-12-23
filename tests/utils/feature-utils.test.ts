/**
 * Unit tests for Feature Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getFeatureName,
  getFeatureTypeName,
  getFeatureInfo,
  isSketchLikeFeature,
  findFeatureByName
} from '../../src/utils/feature-utils.js';

describe('Feature Utilities', () => {
  describe('getFeatureName', () => {
    it('should return empty string for null', () => {
      expect(getFeatureName(null)).toBe('');
    });

    it('should return Name property', () => {
      const feature = { Name: 'TestFeature' };
      expect(getFeatureName(feature)).toBe('TestFeature');
    });

    it('should call GetName() if available', () => {
      const feature = { GetName: () => 'TestFeature' };
      expect(getFeatureName(feature)).toBe('TestFeature');
    });

    it('should return empty string on error', () => {
      const feature = {
        Name: {
          toString: () => {
            throw new Error('Access failed');
          }
        }
      };
      expect(getFeatureName(feature)).toBe('');
    });
  });

  describe('getFeatureTypeName', () => {
    it('should return empty string for null', () => {
      expect(getFeatureTypeName(null)).toBe('');
    });

    it('should call GetTypeName2() if available', () => {
      const feature = { GetTypeName2: () => 'Extrude' };
      expect(getFeatureTypeName(feature)).toBe('Extrude');
    });

    it('should return empty string if method not available', () => {
      const feature = {};
      expect(getFeatureTypeName(feature)).toBe('');
    });
  });

  describe('getFeatureInfo', () => {
    it('should return feature info', () => {
      const feature = {
        Name: 'TestFeature',
        GetTypeName2: () => 'Extrude'
      };
      const info = getFeatureInfo(feature);
      expect(info.feature).toBe(feature);
      expect(info.name).toBe('TestFeature');
      expect(info.typeName).toBe('Extrude');
    });
  });

  describe('isSketchLikeFeature', () => {
    it('should detect sketch in type name', () => {
      expect(isSketchLikeFeature('Feature1', 'Sketch')).toBe(true);
    });

    it('should detect sketch in name', () => {
      expect(isSketchLikeFeature('Sketch1', 'Feature')).toBe(true);
    });

    it('should detect 草图 in name', () => {
      expect(isSketchLikeFeature('草图1', 'Feature')).toBe(true);
    });

    it('should return false for non-sketch features', () => {
      expect(isSketchLikeFeature('Extrude1', 'Extrude')).toBe(false);
    });
  });

  describe('findFeatureByName', () => {
    it('should return null for null model', () => {
      expect(findFeatureByName(null, 'Test')).toBeNull();
    });

    it('should find feature by name', () => {
      const feature1 = { Name: 'Feature1', GetNextFeature: () => null };
      const feature2 = { Name: 'Feature2', GetNextFeature: () => null };
      const model = {
        FirstFeature: () => feature1
      };
      feature1.GetNextFeature = () => feature2;
      
      const found = findFeatureByName(model, 'Feature2');
      expect(found).toBe(feature2);
    });

    it('should return null if not found', () => {
      const feature1 = { Name: 'Feature1', GetNextFeature: () => null };
      const model = {
        FirstFeature: () => feature1
      };
      
      const found = findFeatureByName(model, 'NotFound');
      expect(found).toBeNull();
    });
  });
});

