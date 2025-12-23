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
  validateSketchSelectionBeforeExtrusion,
  tryFeatureExtrusion3,
  tryFeatureExtrusion2,
  tryFeatureExtrusion,
  tryFeatureExtrusionWithFeatureData,
  tryFeatureCut3,
  generateVBAFallbackMacro,
  finalizeExtrusion,
  ModelHelpers,
} from './helpers/index.js';
import { getFeatureInfo } from '../utils/feature-utils.js';
import { COM } from '../utils/com-boolean.js';

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

    const model = this.currentModel;
    const featureMgr = model.FeatureManager;
    if (!featureMgr) {
      throw new Error('Cannot access FeatureManager');
    }

    // 1. 准备拉伸：退出草图模式
    prepareForExtrusion(model);

    // 2. 选择草图
    selectSketchForExtrusion(model);

    // 3. 检查是否是第一个拉伸（基体）
    let isFirstExtrusion = true;
    try {
      let checkIdx = 0;
      while (checkIdx < 10) {
        const checkFeat = model.FeatureByPositionReverse(checkIdx);
        if (!checkFeat) break;
        try {
          const { typeName } = getFeatureInfo(checkFeat);
          if (typeName && (typeName.includes('Extrude') || typeName.includes('拉伸'))) {
            isFirstExtrusion = false;
            break;
          }
        } catch (e) {
          // Continue
        }
        checkIdx++;
      }
    } catch (e) {
      // Assume first extrusion
    }

    // 4. 验证草图选择
    const validation = validateSketchSelectionBeforeExtrusion(model, isFirstExtrusion);
    if (!validation.success) {
      throw new Error(validation.error || 'Sketch validation failed');
    }

    // 5. 转换参数
    const depthInMeters = depth / 1000;

    // 6. 尝试使用 helper 函数创建拉伸（按优先级顺序）
    let feature: any = null;
    let lastError: Error | null = null;

    // 方法1: 尝试 FeatureExtrusion3（最完整的方法）
    try {
      feature = tryFeatureExtrusion3(featureMgr, depthInMeters, reverse, isFirstExtrusion, draft);
      if (feature) {
        console.log(`  [DEBUG] createExtrude: FeatureExtrusion3 成功`);
        return finalizeExtrusion(model, feature);
      }
    } catch (err: any) {
      lastError = err;
      console.log(`  [DEBUG] createExtrude: FeatureExtrusion3 失败: ${err.message || err}`);
    }

    // 方法2: 尝试 FeatureExtrusion2（如果 FeatureExtrusion3 失败）
    if (!feature) {
      try {
        feature = tryFeatureExtrusion2(featureMgr, depthInMeters, reverse, isFirstExtrusion);
        if (feature) {
          console.log(`  [DEBUG] createExtrude: FeatureExtrusion2 成功`);
          return finalizeExtrusion(model, feature);
        }
      } catch (err: any) {
        lastError = err;
        console.log(`  [DEBUG] createExtrude: FeatureExtrusion2 失败: ${err.message || err}`);
      }
    }

    // 方法3: 尝试 FeatureExtrusion（最基础的方法）
    if (!feature) {
      try {
        feature = tryFeatureExtrusion(featureMgr, depthInMeters, reverse, isFirstExtrusion);
        if (feature) {
          console.log(`  [DEBUG] createExtrude: FeatureExtrusion 成功`);
          return finalizeExtrusion(model, feature);
        }
      } catch (err: any) {
        lastError = err;
        console.log(`  [DEBUG] createExtrude: FeatureExtrusion 失败: ${err.message || err}`);
      }
    }

    // 方法4: 尝试 FeatureData 模式（如果可用）
    if (!feature) {
      try {
        feature = tryFeatureExtrusionWithFeatureData(featureMgr, depthInMeters, reverse, isFirstExtrusion);
        if (feature) {
          console.log(`  [DEBUG] createExtrude: FeatureExtrusionWithFeatureData 成功`);
          return finalizeExtrusion(model, feature);
        }
      } catch (err: any) {
        lastError = err;
        console.log(`  [DEBUG] createExtrude: FeatureExtrusionWithFeatureData 失败: ${err.message || err}`);
      }
    }

    // 所有方法都失败
    const errorMessage = lastError 
      ? `All extrusion methods failed. Last error: ${lastError.message}`
      : 'All extrusion methods returned null';
    throw new Error(errorMessage);
  }

  extrude(params: ExtrudeParams): { success: boolean; featureId?: string; error?: string } {
    if (!this.currentModel) {
      return { success: false, error: 'No active model' };
    }
    
    const { depth = 25, reverse = false, draft = 0 } = params;
    
    try {
      const feature = this.createExtrude(depth, draft, reverse);
      
      if (feature) {
        return { success: true, featureId: feature.name };
      }
      
      return { success: false, error: 'Failed to create extrusion - feature is null' };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Extrusion failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 创建切除拉伸（从现有实体中移除材料）
   */
  createExtrudeCut(
    depth: number,
    draft: number = 0,
    reverse: boolean = false
  ): SolidWorksFeature {
    if (!this.currentModel) throw new Error('No model open');

    const model = this.currentModel;
    const featureMgr = model.FeatureManager;
    if (!featureMgr) {
      throw new Error('Cannot access FeatureManager');
    }

    // 1. 准备拉伸：退出草图模式
    prepareForExtrusion(model);

    // 2. 选择草图
    selectSketchForExtrusion(model);

    // 3. 验证草图选择（切除拉伸不是第一个拉伸）
    const validation = validateSketchSelectionBeforeExtrusion(model, false);
    if (!validation.success) {
      throw new Error(validation.error || 'Sketch validation failed');
    }

    // 4. 转换参数
    const depthInMeters = depth / 1000;

    // 5. 尝试创建切除拉伸
    let feature: any = null;
    let lastError: Error | null = null;

    // 使用 tryFeatureCut3
    try {
      feature = tryFeatureCut3(featureMgr, depthInMeters, reverse, draft);
      if (feature) {
        console.log(`  [DEBUG] createExtrudeCut: tryFeatureCut3 成功`);
        return finalizeExtrusion(model, feature);
      }
    } catch (err: any) {
      lastError = err;
      console.log(`  [DEBUG] createExtrudeCut: tryFeatureCut3 失败: ${err.message || err}`);
    }

    // 所有方法都失败
    const errorMessage = lastError 
      ? `Cut extrusion failed. Last error: ${lastError.message}`
      : 'Cut extrusion returned null - ensure sketch is on existing body';
    throw new Error(errorMessage);
  }

  /**
   * 切除拉伸的简化接口
   */
  extrudeCut(params: ExtrudeParams): { success: boolean; featureId?: string; error?: string } {
    if (!this.currentModel) {
      return { success: false, error: 'No active model' };
    }
    
    const { depth = 25, reverse = false, draft = 0 } = params;
    
    try {
      const feature = this.createExtrudeCut(depth, draft, reverse);
      
      if (feature) {
        return { success: true, featureId: feature.name };
      }
      
      return { success: false, error: 'Failed to create cut extrusion - feature is null' };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Cut extrusion failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
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
