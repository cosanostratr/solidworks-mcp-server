/**
 * VBA Tools Index
 * Consolidated export of all VBA-related tools
 */

import { vbaTools as baseVBATools } from './base.js';
import { partModelingVBATools } from './part.js';
import { drawingVBATools } from './drawing.js';
import { assemblyVBATools } from './assembly.js';
import { advancedVBATools } from './advanced.js';
import { fileManagementVBATools } from './file-management.js';

/**
 * Complete set of VBA tools combining all categories
 */
export const vbaTools = [
  ...baseVBATools,
  ...partModelingVBATools,
  ...drawingVBATools,
  ...assemblyVBATools,
  ...advancedVBATools,
  ...fileManagementVBATools
];

// Re-export individual tool sets for granular access
export { baseVBATools, partModelingVBATools, drawingVBATools, assemblyVBATools, advancedVBATools, fileManagementVBATools };
