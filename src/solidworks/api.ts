// Type imports
import {
  SolidWorksModel,
  SolidWorksFeature,
  ISldWorksApp,
  IModelDoc2,
  ISketchSegment,
  SketchParams,
  LineParams,
  ExtrudeParams,
  SketchContext,
  SketchOperation,
} from './types/index.js';

// Helper imports
import {
  selectLastSketchSegment,
  selectByHeuristicMatch,
  selectByID2Fallback,
  prepareForExtrusion,
  selectSketchForExtrusion,
  tryFeatureExtrusion3,
  tryFeatureExtrusion2,
  tryFeatureExtrusion,
  generateVBAFallbackMacro,
  finalizeExtrusion,
  ModelHelpers,
} from './helpers/index.js';

// Operation imports
import {
  ConnectionManager,
  ModelOperations,
  SketchOperations,
  DimensionOperations,
  ExportOperations,
  VBAOperations,
  MassPropertiesOperations,
  ConfigSystemOperations,
} from './operations/index.js';

import { logger } from '../utils/logger.js';

/**
 * Main SolidWorks API class - integrates all operation modules
 * This is a facade that delegates to specialized operation classes
 */
export class SolidWorksAPI {
  private connectionMgr: ConnectionManager;
  private currentModel: IModelDoc2 | null;
  
  constructor() {
    this.connectionMgr = new ConnectionManager();
    this.currentModel = null;
  }
  
  // Connection management
  connect(): void {
    this.connectionMgr.connect();
  }
  
  disconnect(): void {
    if (this.currentModel) {
      this.currentModel = null;
    }
    this.connectionMgr.disconnect();
  }
  
  isConnected(): boolean {
    return this.connectionMgr.isConnected();
  }

  // Model operations
  openModel(filePath: string): SolidWorksModel {
    const { model, info } = ModelOperations.openModel(
      this.connectionMgr.getApp(),
      filePath
    );
    this.currentModel = model;
    return info;
  }
  
  closeModel(save: boolean = false): void {
    ModelOperations.closeModel(
      this.connectionMgr.getApp(),
      this.currentModel,
      save
    );
    this.currentModel = null;
  }
  
  createPart(): SolidWorksModel {
    const { model, info } = ModelOperations.createPart(
      this.connectionMgr.getApp()
    );
    this.currentModel = model;
    return info;
  }
  
  // Sketch operations
  createSketch(params: SketchParams): { success: boolean; sketchId?: string; error?: string } {
    this.ensureCurrentModel();
    return SketchOperations.createSketch(this.currentModel, params);
  }
  
  addLine(params: LineParams): { success: boolean; lineId?: string; error?: string } {
    if (!this.currentModel) throw new Error('No active model');
    return SketchOperations.addLine(this.currentModel, params);
  }

  createSketchEntitiesBatch(
    operations: SketchOperation[],
    options?: {
      displayWhenAdded?: boolean;
      rebuildAfter?: boolean;
    }
  ): ISketchSegment[] {
    if (!this.currentModel) throw new Error('No active model');
    return SketchOperations.createSketchEntitiesBatch(this.currentModel, operations, options);
  }

  // Feature operations
  createExtrude(
    depth: number,
    draft: number = 0,
    reverse: boolean = false
  ): SolidWorksFeature {
    if (!this.currentModel) throw new Error('No model open');

    try {
      const featureMgr = this.currentModel.FeatureManager;
      if (!featureMgr) {
        throw new Error('Cannot access FeatureManager');
      }

      prepareForExtrusion(this.currentModel);
      selectSketchForExtrusion(this.currentModel);

      const depthInMeters = depth / 1000;
      let feature = null;

      try {
        feature = tryFeatureExtrusion3(featureMgr, depthInMeters, reverse);
        logger.info('FeatureExtrusion3 succeeded');
      } catch (e) {
        logger.warn(`FeatureExtrusion3 failed: ${e}`);
        try {
          feature = tryFeatureExtrusion2(featureMgr, depthInMeters, reverse);
          logger.info('FeatureExtrusion2 succeeded');
        } catch (e2) {
          logger.warn(`FeatureExtrusion2 failed: ${e2}`);
          try {
            feature = tryFeatureExtrusion(featureMgr, depthInMeters, reverse);
            logger.info('FeatureExtrusion succeeded');
          } catch (e3) {
            logger.error(`All extrusion methods failed: ${e3}`);
            const macroPath = generateVBAFallbackMacro(depth, reverse);
            const errorMsg = macroPath
              ? `Extrusion failed due to COM interface limitations. A VBA macro has been generated at: ${macroPath}. Please run it manually in SolidWorks, or use the 'create_feature_vba' tool to generate a macro.`
              : `Extrusion failed due to COM interface limitations. Please use the 'create_feature_vba' tool to generate a VBA macro, or create one manually in SolidWorks.`;
            throw new Error(errorMsg);
          }
        }
      }

      return finalizeExtrusion(this.currentModel, feature);
    } catch (error) {
      throw new Error(`Extrusion failed: ${error}`);
    }
  }

  extrude(params: ExtrudeParams): { success: boolean; featureId?: string; error?: string } {
    if (!this.currentModel) throw new Error('No active model');
    
    const { depth = 25, reverse = false, draft = 0 } = params;
    
    const feature = this.createExtrude(depth, draft, reverse);
    
    if (feature) {
      return { success: true, featureId: feature.name };
    }
    
    return { success: false, error: 'Failed to create extrusion' };
  }

  // Public helper methods (delegated to ModelHelpers)
  public ensureActiveSketch(model: IModelDoc2 | null): void {
    ModelHelpers.ensureActiveSketch(model);
  }

  public getDocumentType(model: IModelDoc2 | null, fallback: number = 0): number {
    return ModelHelpers.getDocumentType(model, fallback);
  }

  public findSketchFeatureByName(model: IModelDoc2 | null, name: string) {
    return ModelHelpers.findSketchFeatureByName(model, name);
  }

  public getSketchContext(maxFeatures: number = 5): SketchContext {
    const model = this.getCurrentModel();
    return SketchOperations.getSketchContext(model, maxFeatures);
  }
  
  public selectStandardPlane(planeType: 'Front' | 'Top' | 'Right'): boolean {
    if (!this.currentModel) return false;
    return SketchOperations.selectStandardPlane(this.currentModel, planeType);
  }

  // Dimension operations
  getDimension(name: string): number {
    this.ensureCurrentModel();
    return DimensionOperations.getDimension(
      this.connectionMgr.getApp(),
      this.currentModel,
      name
    );
  }
  
  setDimension(name: string, value: number): void {
    this.ensureCurrentModel();
    DimensionOperations.setDimension(
      this.connectionMgr.getApp(),
      this.currentModel,
      name,
      value
    );
  }
  
  // Export operations
  exportFile(filePath: string, format: string): void {
    if (!this.currentModel) throw new Error('No model open');
    ExportOperations.exportFile(
      this.connectionMgr.getApp(),
      this.currentModel,
      filePath,
      format
    );
  }
  
  // VBA operations
  runMacro(macroPath: string, moduleName: string, procedureName: string, args: unknown[] = []): unknown {
    return VBAOperations.runMacro(
      this.connectionMgr.getApp(),
      macroPath,
      moduleName,
      procedureName,
      args
    );
  }
  
  // Mass properties
  getMassProperties() {
    if (!this.currentModel) throw new Error('No model open');
    return MassPropertiesOperations.getMassProperties(this.currentModel);
  }
  
  // Selection operations
  public selectSketchEntity(spec: string, append: boolean = false): boolean {
    if (!this.currentModel) {
      this.ensureCurrentModel();
      if (!this.currentModel) throw new Error('No model open');
    }

    if (!spec) return false;

    if (spec === 'last') {
      return selectLastSketchSegment(this.currentModel, append);
    }

    if (['Front', 'Top', 'Right'].includes(spec)) {
      return this.selectStandardPlane(spec as any);
    }

    if (selectByHeuristicMatch(this.currentModel, spec, append)) {
      return true;
    }

    return selectByID2Fallback(this.currentModel, spec, append);
  }

  public selectSketchEntities(spec: string | string[]): boolean {
    if (!this.currentModel) {
      throw new Error('No model open');
    }

    const names = Array.isArray(spec) ? spec : [spec];
    try {
      this.currentModel.ClearSelection2(true);
    } catch (e) {
      logger.warn('ClearSelection2 failed in selectSketchEntities', e as Error);
    }

    let ok = true;
    names.forEach((name, idx) => {
      if (!name) return;
      const appended = idx > 0;
      const selected = this.selectSketchEntity(name, appended);
      if (!selected) {
        ok = false;
      }
    });

    return ok;
  }
  
  // Helper methods
  getApp(): ISldWorksApp | null {
    return this.connectionMgr.getApp();
  }

  getCurrentModel(): IModelDoc2 | null {
    this.ensureCurrentModel();
    return this.currentModel;
  }

  // Configuration and system operations
  async getConfiguration() {
    return ConfigSystemOperations.getConfiguration(this.connectionMgr.getApp());
  }

  async getMaterialProperties(materialName: string) {
    return ConfigSystemOperations.getMaterialProperties(
      this.connectionMgr.getApp(),
      this.currentModel,
      materialName
    );
  }

  async getTemplateList(type: 'part' | 'assembly' | 'drawing') {
    return ConfigSystemOperations.getTemplateList(
      this.connectionMgr.getApp(),
      type
    );
  }

  async getSystemStatus() {
    return ConfigSystemOperations.getSystemStatus(
      this.connectionMgr.getApp(),
      () => this.isConnected()
    );
  }

  // Private helper
  private ensureCurrentModel(): void {
    this.currentModel = ModelHelpers.ensureCurrentModel(
      this.connectionMgr.getApp(),
      this.currentModel
    );
  }
}

// Re-export interfaces for convenience
export type { SketchContext } from './types/index.js';
