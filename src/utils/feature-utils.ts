/**
 * Utility functions for working with SolidWorks features
 * These functions help eliminate code duplication in feature traversal and manipulation
 */

import { logger } from './logger.js';
import { PerformanceLimits } from '../shared/constants/solidworks-constants.js';

/**
 * Feature information extracted from a SolidWorks feature
 */
export interface FeatureInfo {
  feature: any;
  name: string;
  typeName: string;
}

/**
 * Safely get the name of a feature
 */
export function getFeatureName(feature: any): string {
  if (!feature) return '';

  try {
    return feature.Name || (feature.GetName ? feature.GetName() : '') || '';
  } catch (error) {
    logger.debug('Failed to get feature name', error as Error);
    return '';
  }
}

/**
 * Safely get the type name of a feature
 */
export function getFeatureTypeName(feature: any): string {
  if (!feature) return '';

  try {
    return feature.GetTypeName2 ? feature.GetTypeName2() : '';
  } catch (error) {
    logger.debug('Failed to get feature type name', error as Error);
    return '';
  }
}

/**
 * Get complete feature information (name + type name)
 */
export function getFeatureInfo(feature: any): FeatureInfo {
  return {
    feature,
    name: getFeatureName(feature),
    typeName: getFeatureTypeName(feature),
  };
}

/**
 * Check if a feature is sketch-like based on its name or type
 */
export function isSketchLikeFeature(name: string, typeName: string): boolean {
  const lowerType = String(typeName).toLowerCase();
  const lowerName = String(name).toLowerCase();

  return (
    lowerType.includes('sketch') ||
    lowerType.includes('profile') ||
    lowerName.includes('sketch') ||
    lowerName.includes('草图')
  );
}

/**
 * Traverse all features in a model with a callback function
 * Returns the first feature where callback returns true, or null if none found
 *
 * @param model - The SolidWorks model to traverse
 * @param callback - Function called for each feature. Return true to stop iteration and return that feature.
 * @param maxIterations - Maximum number of features to iterate (default: PerformanceLimits.MAX_FEATURE_ITERATIONS)
 * @returns The feature where callback returned true, or null
 */
export function traverseFeatures(
  model: any,
  callback: (featureInfo: FeatureInfo) => boolean | void,
  maxIterations: number = PerformanceLimits.MAX_FEATURE_ITERATIONS
): any | null {
  if (!model) return null;

  try {
    let feat = model.FirstFeature ? model.FirstFeature() : null;
    let iterations = 0;

    while (feat && iterations < maxIterations) {
      iterations++;

      const featureInfo = getFeatureInfo(feat);
      const result = callback(featureInfo);

      if (result === true) {
        return feat;
      }

      feat = feat.GetNextFeature ? feat.GetNextFeature() : null;
    }

    if (iterations >= maxIterations) {
      logger.warn(`Feature iteration limit (${maxIterations}) reached during traversal`);
    }

    return null;
  } catch (error) {
    logger.error('Error during feature traversal', error as Error);
    return null;
  }
}

/**
 * Find a feature by name
 *
 * @param model - The SolidWorks model to search
 * @param featureName - The name of the feature to find
 * @returns The feature if found, or null
 */
export function findFeatureByName(model: any, featureName: string): any | null {
  return traverseFeatures(model, ({ name }) => {
    return name === featureName;
  });
}

/**
 * Find the first feature matching a predicate
 *
 * @param model - The SolidWorks model to search
 * @param predicate - Function that returns true for the desired feature
 * @returns The first matching feature, or null
 */
export function findFeature(
  model: any,
  predicate: (featureInfo: FeatureInfo) => boolean
): any | null {
  return traverseFeatures(model, (featureInfo) => {
    return predicate(featureInfo);
  });
}

/**
 * Collect all features matching a predicate (up to maxResults)
 *
 * @param model - The SolidWorks model to search
 * @param predicate - Function that returns true for features to collect
 * @param maxResults - Maximum number of results to collect (default: 500)
 * @returns Array of matching features
 */
export function collectFeatures(
  model: any,
  predicate: (featureInfo: FeatureInfo) => boolean,
  maxResults: number = 500
): FeatureInfo[] {
  const results: FeatureInfo[] = [];

  traverseFeatures(
    model,
    (featureInfo) => {
      if (predicate(featureInfo)) {
        results.push(featureInfo);
        if (results.length >= maxResults) {
          return true; // Stop iteration
        }
      }
      return false;
    },
    maxResults
  );

  return results;
}

/**
 * Find all sketch-like features in a model
 *
 * @param model - The SolidWorks model to search
 * @param maxResults - Maximum number of sketches to find (default: 500)
 * @returns Array of sketch feature information
 */
export function findSketchFeatures(
  model: any,
  maxResults: number = 500
): FeatureInfo[] {
  return collectFeatures(
    model,
    ({ name, typeName }) => isSketchLikeFeature(name, typeName),
    maxResults
  );
}

/**
 * Get feature parameters as a map
 * This is useful for extracting dimension/parameter values from features
 *
 * @param feature - The SolidWorks feature
 * @returns Map of parameter names to values
 */
export function getFeatureParameters(feature: any): Map<string, any> {
  const params = new Map<string, any>();

  if (!feature) return params;

  try {
    // Try to get feature data
    const featureData = feature.GetDefinition ? feature.GetDefinition() : null;
    if (!featureData) return params;

    // Access pattern varies by feature type
    // This is a simplified version - real implementation would need feature-specific logic
    if (featureData.GetParameterCount) {
      const count = featureData.GetParameterCount();
      for (let i = 0; i < count; i++) {
        try {
          const paramName = featureData.GetParameterName ? featureData.GetParameterName(i) : null;
          const paramValue = featureData.GetParameter ? featureData.GetParameter(i) : null;
          if (paramName) {
            params.set(paramName, paramValue);
          }
        } catch (error) {
          logger.debug(`Failed to get parameter ${i}`, error as Error);
        }
      }
    }
  } catch (error) {
    logger.debug('Failed to get feature parameters', error as Error);
  }

  return params;
}
