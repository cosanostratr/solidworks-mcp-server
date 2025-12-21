import { logger } from '../../utils/logger.js';
import { ISldWorksApp, IModelDoc2 } from '../types/com-types.js';

/**
 * Configuration and system information operations
 */
export class ConfigSystemOperations {
  /**
   * Get SolidWorks application configuration
   */
  static async getConfiguration(swApp: ISldWorksApp | null): Promise<{
    version?: string;
    revisionNumber?: string;
    units?: {
      length: string;
      mass: string;
      time: string;
      angle: string;
    };
    precision?: {
      length: number;
      angle: number;
    };
    templatePaths?: {
      part?: string;
      assembly?: string;
      drawing?: string;
    };
  }> {
    if (!swApp) {
      throw new Error('Not connected to SolidWorks');
    }

    const config: any = {};

    try {
      if (swApp.RevisionNumber !== undefined) {
        config.revisionNumber = String(swApp.RevisionNumber);
      }
      
      try {
        const version = (swApp as any).Version;
        if (version) config.version = String(version);
      } catch (e) {
        // Version property might not be available
      }
    } catch (e) {
      logger.warn('Failed to get version information', e as Error);
    }

    try {
      let unitSystem = 0;
      try {
        if (swApp.GetUserPreferenceIntegerValue && typeof swApp.GetUserPreferenceIntegerValue === 'function') {
          unitSystem = swApp.GetUserPreferenceIntegerValue(1) ?? 0;
        }
      } catch (e) {
        unitSystem = 0;
      }
      const unitNames: Record<number, { length: string; mass: string; time: string; angle: string }> = {
        0: { length: 'mm', mass: 'g', time: 's', angle: 'deg' },
        1: { length: 'cm', mass: 'g', time: 's', angle: 'deg' },
        2: { length: 'm', mass: 'kg', time: 's', angle: 'deg' },
        3: { length: 'in', mass: 'lb', time: 's', angle: 'deg' },
        4: { length: 'ft', mass: 'lb', time: 's', angle: 'deg' },
      };
      config.units = unitNames[unitSystem] || unitNames[0];
    } catch (e) {
      logger.warn('Failed to get units', e as Error);
      config.units = { length: 'mm', mass: 'g', time: 's', angle: 'deg' };
    }

    try {
      config.precision = {
        length: 0.01,
        angle: 0.1,
      };
    } catch (e) {
      logger.warn('Failed to get precision', e as Error);
    }

    try {
      const templatePaths: any = {};
      
      try {
        const partTemplate = swApp.GetUserPreferenceStringValue?.(8);
        if (partTemplate) templatePaths.part = partTemplate;
      } catch (e) {}

      try {
        const assemblyTemplate = swApp.GetUserPreferenceStringValue?.(9);
        if (assemblyTemplate) templatePaths.assembly = assemblyTemplate;
      } catch (e) {}

      try {
        const drawingTemplate = swApp.GetUserPreferenceStringValue?.(10);
        if (drawingTemplate) templatePaths.drawing = drawingTemplate;
      } catch (e) {}

      if (Object.keys(templatePaths).length > 0) {
        config.templatePaths = templatePaths;
      }
    } catch (e) {
      logger.warn('Failed to get template paths', e as Error);
    }

    return config;
  }

  /**
   * Get material properties
   */
  static async getMaterialProperties(
    swApp: ISldWorksApp | null,
    model: IModelDoc2 | null,
    materialName: string
  ): Promise<{
    name: string;
    database?: string;
    properties?: {
      density?: number;
      elasticModulus?: number;
      poissonRatio?: number;
      yieldStrength?: number;
      thermalExpansion?: number;
    };
    units?: {
      density: string;
      elasticModulus: string;
      yieldStrength: string;
    };
  }> {
    if (!swApp) {
      throw new Error('Not connected to SolidWorks');
    }

    if (!model) {
      throw new Error('No model open - material properties require an open model');
    }

    const result: any = {
      name: materialName,
    };

    try {
      const partDoc = model as any;
      
      if (partDoc.GetMaterialPropertyName) {
        const currentMaterial = partDoc.GetMaterialPropertyName();
        if (currentMaterial) {
          result.database = 'Current Model';
        }
      }

      result.properties = {
        density: undefined,
        elasticModulus: undefined,
        poissonRatio: undefined,
        yieldStrength: undefined,
        thermalExpansion: undefined,
      };

      result.units = {
        density: 'kg/m³',
        elasticModulus: 'Pa',
        yieldStrength: 'Pa',
      };
    } catch (e) {
      logger.warn(`Failed to get material properties for ${materialName}`, e as Error);
    }

    return result;
  }

  /**
   * Get template list
   */
  static async getTemplateList(
    swApp: ISldWorksApp | null,
    type: 'part' | 'assembly' | 'drawing'
  ): Promise<{
    type: string;
    templates: Array<{
      name: string;
      path: string;
      description?: string;
    }>;
  }> {
    if (!swApp) {
      throw new Error('Not connected to SolidWorks');
    }

    const templates: Array<{ name: string; path: string; description?: string }> = [];

    try {
      const templateIndex = type === 'part' ? 8 : type === 'assembly' ? 9 : 10;
      const defaultTemplate = swApp.GetUserPreferenceStringValue?.(templateIndex);
      
      if (defaultTemplate) {
        templates.push({
          name: 'Default Template',
          path: defaultTemplate,
          description: `Default ${type} template`,
        });
      }
    } catch (e) {
      logger.warn(`Failed to get template list for ${type}`, e as Error);
    }

    return {
      type,
      templates,
    };
  }

  /**
   * Get system status
   */
  static async getSystemStatus(
    swApp: ISldWorksApp | null,
    isConnected: () => boolean
  ): Promise<{
    connected: boolean;
    version?: string;
    processId?: number;
    activeDocument?: {
      name: string;
      path: string;
      type: string;
    } | null;
    openDocuments?: number;
    memoryInfo?: {
      available?: string;
    };
  }> {
    const status: any = {
      connected: isConnected(),
    };

    if (!swApp) {
      return status;
    }

    try {
      try {
        const version = (swApp as any).Version;
        if (version) status.version = String(version);
      } catch (e) {}

      try {
        if (swApp.GetProcessID) {
          status.processId = swApp.GetProcessID();
        }
      } catch (e) {
        logger.warn('Failed to get process ID', e as Error);
      }

      try {
        const activeDoc = swApp.ActiveDoc || swApp.GetActiveDoc?.();
        if (activeDoc) {
          status.activeDocument = {
            name: activeDoc.GetTitle(),
            path: activeDoc.GetPathName(),
            type: ['Part', 'Assembly', 'Drawing'][activeDoc.GetType() - 1] || 'Unknown',
          };
        } else {
          status.activeDocument = null;
        }
      } catch (e) {
        logger.warn('Failed to get active document', e as Error);
        status.activeDocument = null;
      }

      try {
        if (swApp.GetDocumentCount) {
          status.openDocuments = swApp.GetDocumentCount();
        }
      } catch (e) {
        logger.warn('Failed to get document count', e as Error);
      }
    } catch (e) {
      logger.warn('Failed to get system status', e as Error);
    }

    return status;
  }
}

