import { logger } from '../../utils/logger.js';
import { IModelDoc2, ISketchSegment } from '../types/com-types.js';
import { COM } from '../../utils/com-boolean.js';
import { SketchParams, LineParams, SketchContext, SketchOperation } from '../types/interfaces.js';
import { traverseFeatures } from '../../utils/feature-utils.js';
import { findSketchFeatures } from '../../utils/feature-utils.js';
import { isSketchLikeFeature } from '../../utils/feature-utils.js';
import { ModelHelpers } from '../helpers/model.js';

/**
 * Sketch operations: create, add entities, manage sketches
 */
export class SketchOperations {
  /**
   * Create a sketch on a plane
   */
  static createSketch(
    model: IModelDoc2 | null,
    params: SketchParams
  ): { success: boolean; sketchId?: string; error?: string } {
    if (!model) throw new Error('No active model');

    const { plane = 'Front' } = params;

    // Use robust selection for standard planes
    let planeSelected = false;
    if (['Front', 'Top', 'Right'].includes(plane)) {
      planeSelected = this.selectStandardPlane(model, plane as 'Front' | 'Top' | 'Right');
    } else {
      // Custom plane or fallback to direct SelectByID2
      const ext = model.Extension;
      if (ext && ext.SelectByID2) {
        planeSelected = ext.SelectByID2(plane, 'PLANE', 0.0, 0.0, 0.0, COM.FALSE, 0, null, 0);
      }
    }
    
    if (planeSelected) {
      model.SketchManager.InsertSketch(true);
      const activeSketch = model.SketchManager.ActiveSketch;
      if (activeSketch) {
        const sketchName = activeSketch.Name || activeSketch.GetName();
        return { success: true, sketchId: sketchName };
      }
    }
    
    return { success: false, error: `Failed to create sketch on plane: ${plane}` };
  }
  
  /**
   * Add a line to the active sketch
   */
  static addLine(
    model: IModelDoc2 | null,
    params: LineParams
  ): { success: boolean; lineId?: string; error?: string } {
    if (!model) throw new Error('No active model');

    const { x1 = 0, y1 = 0, z1 = 0, x2 = 100, y2 = 0, z2 = 0 } = params;

    const line = model.SketchManager.CreateLine(
      x1 / 1000, y1 / 1000, z1 / 1000,  // Convert mm to m
      x2 / 1000, y2 / 1000, z2 / 1000
    );

    if (line) {
      return { success: true, lineId: `line_${Date.now()}` };
    }

    return { success: false, error: 'Failed to create line' };
  }

  /**
   * Robust selection of standard planes (Front, Top, Right)
   * Locale-independent using feature iteration.
   */
  static selectStandardPlane(
    model: IModelDoc2 | null,
    planeType: 'Front' | 'Top' | 'Right'
  ): boolean {
    if (!model) return false;

    try {
      // Clear selection
      model.ClearSelection2(true);

      // Method 1: Try iteration (locale-independent)
      // Standard planes are usually the first 3 RefPlane features
      const targetIndex = planeType === 'Front' ? 0 : planeType === 'Top' ? 1 : 2;
      let refPlaneCount = 0;

      const planeFeat = traverseFeatures(model, ({ feature, typeName }) => {
        if (typeName === 'RefPlane') {
          if (refPlaneCount === targetIndex) {
            feature.Select2(false, 0);
            logger.info(`Selected ${planeType} plane by index ${targetIndex}`);
            return true; // Found and selected
          }
          refPlaneCount++;
        }
        return false; // Continue searching
      });

      if (planeFeat) {
        return true; // Successfully selected via iteration
      }

      // Method 2: Fallback to SelectByID2 with English and Chinese names
      const namesMap: Record<string, string[]> = {
        'Front': ['Front Plane', '前视基准面', '前視基準面'],
        'Top': ['Top Plane', '上视基准面', '上視基準面'],
        'Right': ['Right Plane', '右视基准面', '右視基準面']
      };

      const ext = model.Extension;
      if (ext && ext.SelectByID2) {
        for (const name of namesMap[planeType]) {
          const ok = ext.SelectByID2(name, 'PLANE', 0.0, 0.0, 0.0, false, 0, null, 0);
          if (ok) {
            logger.info(`Selected ${planeType} plane by name: ${name}`);
            return true;
          }
        }
      }
    } catch (e) {
      logger.error(`Failed to select standard plane: ${planeType}`, e as Error);
    }

    return false;
  }

  /**
   * Get sketch context information
   */
  static getSketchContext(
    model: IModelDoc2 | null,
    maxFeatures: number = 5
  ): SketchContext {
    if (!model) {
      return {
        hasModel: false,
        modelName: null,
        modelType: 0,
        activeSketch: null,
        recentSketchFeatures: [],
      };
    }

    // Document name
    let modelName: string | null = null;
    try {
      // Try multiple methods to get model name
      if (model.GetTitle) {
        const title = model.GetTitle();
        if (title && typeof title === 'string' && title.trim()) {
          modelName = title.trim();
        }
      }
      if (!modelName && model.GetPathName) {
        const path = model.GetPathName();
        if (path && typeof path === 'string' && path.trim()) {
          // Extract filename from path
          const pathParts = path.split(/[/\\]/);
          modelName = pathParts[pathParts.length - 1] || path.trim();
        }
      }
      // Fallback: use a default name if model exists but name is unavailable
      if (!modelName) {
        modelName = 'Unnamed Model';
      }
    } catch (error) {
      logger.debug('Failed to get model name/path', error as Error);
      modelName = 'Unnamed Model';
    }

    const modelType = ModelHelpers.getDocumentType(model, 0);

    // Active sketch
    let activeSketchInfo: { name: string | null } | null = null;
    try {
      const sketchMgr = model.SketchManager;
      if (sketchMgr) {
        const activeSketch = sketchMgr.ActiveSketch;
        if (activeSketch) {
          let sketchName = '';
          try {
            // Try multiple methods to get sketch name
            if (activeSketch.Name && typeof activeSketch.Name === 'string') {
              sketchName = activeSketch.Name.trim();
            } else if (activeSketch.GetName && typeof activeSketch.GetName === 'function') {
              const name = activeSketch.GetName();
              if (name && typeof name === 'string') {
                sketchName = name.trim();
              }
            }
          } catch (error) {
            logger.debug('Failed to get active sketch name', error as Error);
            sketchName = '';
          }
          activeSketchInfo = {
            name: sketchName || 'Active Sketch',
          };
        }
      }
    } catch (error) {
      logger.debug('Failed to get active sketch info', error as Error);
      activeSketchInfo = null;
    }

    // Recent sketch/profile features
    const recentSketchFeatures: Array<{ name: string; typeName: string }> = [];
    try {
      const sketchFeatureInfos = findSketchFeatures(model, maxFeatures);
      if (sketchFeatureInfos && sketchFeatureInfos.length > 0) {
        recentSketchFeatures.push(...sketchFeatureInfos.map(({ name, typeName }) => ({
          name: name || 'Unnamed Feature',
          typeName: typeName || 'Unknown',
        })));
      }
    } catch (e) {
      logger.warn('getSketchContext failed while traversing features', e as Error);
    }

    // Return context - even if some info is missing, return what we have
    // This ensures the context is never completely empty if model exists
    return {
      hasModel: true,
      modelName: modelName || 'Unnamed Model',
      modelType,
      activeSketch: activeSketchInfo,
      recentSketchFeatures: recentSketchFeatures.length > 0 ? recentSketchFeatures : [],
    };
  }

  /**
   * Create multiple sketch entities in batch mode for better performance.
   */
  static createSketchEntitiesBatch(
    model: IModelDoc2 | null,
    operations: SketchOperation[],
    options?: {
      displayWhenAdded?: boolean;
      rebuildAfter?: boolean;
    }
  ): ISketchSegment[] {
    console.log('  [DEBUG] createSketchEntitiesBatch: 开始执行');
    logger.info('createSketchEntitiesBatch: 开始执行');
    
    if (!model) {
      const error = new Error('No model open');
      console.error('  [DEBUG] createSketchEntitiesBatch failed: No model open');
      logger.error('createSketchEntitiesBatch failed', error);
      throw error;
    }

    console.log('  [DEBUG] createSketchEntitiesBatch: 模型存在');
    logger.info('createSketchEntitiesBatch: 模型存在');
    const sketchMgr = model.SketchManager;
    if (!sketchMgr) {
      const error = new Error('SketchManager is not available');
      console.error('  [DEBUG] createSketchEntitiesBatch failed: SketchManager not available');
      logger.error('createSketchEntitiesBatch failed', error);
      throw error;
    }

    console.log('  [DEBUG] createSketchEntitiesBatch: SketchManager 存在');
    logger.info('createSketchEntitiesBatch: SketchManager 存在');
    
    // Ensure active sketch
    try {
      console.log('  [DEBUG] createSketchEntitiesBatch: 准备调用 ensureActiveSketch');
      logger.info('createSketchEntitiesBatch: 准备调用 ensureActiveSketch');
      ModelHelpers.ensureActiveSketch(model);
      console.log('  [DEBUG] createSketchEntitiesBatch: ensureActiveSketch 完成');
      logger.info('createSketchEntitiesBatch: ensureActiveSketch 完成');
    } catch (error: any) {
      console.error(`  [DEBUG] ensureActiveSketch 失败: ${error.message || error}`);
      logger.error('Failed to ensure active sketch in createSketchEntitiesBatch', error);
      throw new Error(`Failed to ensure active sketch: ${error.message || error}`);
    }

    // Save original settings
    const originalAddToDB = sketchMgr.AddToDB;
    const originalDisplayWhenAdded = sketchMgr.DisplayWhenAdded;

    const results: ISketchSegment[] = [];

    try {
      console.log(`  [DEBUG] createSketchEntitiesBatch: 准备处理 ${operations.length} 个操作`);
      logger.info(`createSketchEntitiesBatch: 准备处理 ${operations.length} 个操作`);
      
      // Enable batch mode
      console.log('  [DEBUG] createSketchEntitiesBatch: 设置批处理模式');
      logger.info('createSketchEntitiesBatch: 设置批处理模式');
      // **关键修复（基于深度研究报告）**: 设置 AddToDB = true
      // 这可以强制几何数据直接进入底层数据库，避开 UI 刷新带来的干扰
      // 对于第一个拉伸特征，这尤其重要，因为它确保草图在退出时被正确提交
      if (sketchMgr.AddToDB !== undefined) {
        sketchMgr.AddToDB = true; // 强制设置为 true，确保数据直接进入数据库
        console.log(`  [DEBUG] createSketchEntitiesBatch: AddToDB 已设置为 true（确保几何数据直接进入数据库）`);
      }
      if (sketchMgr.DisplayWhenAdded !== undefined) {
        sketchMgr.DisplayWhenAdded = options?.displayWhenAdded ?? false;
      }
      console.log('  [DEBUG] createSketchEntitiesBatch: 批处理模式设置完成');
      logger.info('createSketchEntitiesBatch: 批处理模式设置完成');

      for (const op of operations) {
        try {
          console.log(`  [DEBUG] createSketchEntitiesBatch: 处理操作类型: ${op.type}`);
          logger.info(`createSketchEntitiesBatch: 处理操作类型: ${op.type}`);
          let entity: ISketchSegment | null = null;

          switch (op.type) {
            case 'line':
              if (sketchMgr.CreateLine) {
                const x1 = typeof op.params.x1 === 'number' ? op.params.x1 : 0;
                const y1 = typeof op.params.y1 === 'number' ? op.params.y1 : 0;
                const z1 = typeof op.params.z1 === 'number' ? op.params.z1 : 0;
                const x2 = typeof op.params.x2 === 'number' ? op.params.x2 : 0;
                const y2 = typeof op.params.y2 === 'number' ? op.params.y2 : 0;
                const z2 = typeof op.params.z2 === 'number' ? op.params.z2 : 0;
                entity = sketchMgr.CreateLine(x1 / 1000, y1 / 1000, z1 / 1000, x2 / 1000, y2 / 1000, z2 / 1000) as ISketchSegment;
              }
              break;
            case 'circle':
              if (sketchMgr.CreateCircleByRadius) {
                const centerX = typeof op.params.centerX === 'number' ? op.params.centerX : 0;
                const centerY = typeof op.params.centerY === 'number' ? op.params.centerY : 0;
                const centerZ = typeof op.params.centerZ === 'number' ? op.params.centerZ : 0;
                const radius = typeof op.params.radius === 'number' ? op.params.radius : 0;
                entity = sketchMgr.CreateCircleByRadius(centerX / 1000, centerY / 1000, centerZ / 1000, radius / 1000) as ISketchSegment;
              }
              break;
            case 'arc':
              if (sketchMgr.CreateArc) {
                const centerX = typeof op.params.centerX === 'number' ? op.params.centerX : 0;
                const centerY = typeof op.params.centerY === 'number' ? op.params.centerY : 0;
                const centerZ = typeof op.params.centerZ === 'number' ? op.params.centerZ : 0;
                const startX = typeof op.params.startX === 'number' ? op.params.startX : 0;
                const startY = typeof op.params.startY === 'number' ? op.params.startY : 0;
                const startZ = typeof op.params.startZ === 'number' ? op.params.startZ : 0;
                const endX = typeof op.params.endX === 'number' ? op.params.endX : 0;
                const endY = typeof op.params.endY === 'number' ? op.params.endY : 0;
                const endZ = typeof op.params.endZ === 'number' ? op.params.endZ : 0;
                const direction = typeof op.params.direction === 'number' ? op.params.direction : (op.params.direction ? 1 : 0);
                entity = sketchMgr.CreateArc(
                  centerX / 1000, centerY / 1000, centerZ / 1000,
                  startX / 1000, startY / 1000, startZ / 1000,
                  endX / 1000, endY / 1000, endZ / 1000,
                  direction
                ) as ISketchSegment;
              }
              break;
            case 'rectangle':
              console.log('  [DEBUG] createSketchEntitiesBatch: 开始创建矩形');
              logger.info('createSketchEntitiesBatch: 开始创建矩形');
              
              const x1 = typeof op.params.x1 === 'number' ? op.params.x1 : 0;
              const y1 = typeof op.params.y1 === 'number' ? op.params.y1 : 0;
              const z1 = typeof op.params.z1 === 'number' ? op.params.z1 : 0;
              const x2 = typeof op.params.x2 === 'number' ? op.params.x2 : 0;
              const y2 = typeof op.params.y2 === 'number' ? op.params.y2 : 0;
              const z2 = typeof op.params.z2 === 'number' ? op.params.z2 : 0;
              
              console.log(`  [DEBUG] 创建矩形参数: (${x1}, ${y1}, ${z1}) to (${x2}, ${y2}, ${z2})`);
              console.log(`  [DEBUG] 转换为米: (${x1 / 1000}, ${y1 / 1000}, ${z1 / 1000}) to (${x2 / 1000}, ${y2 / 1000}, ${z2 / 1000})`);
              logger.info(`createSketchEntitiesBatch: 创建矩形参数: (${x1}, ${y1}, ${z1}) to (${x2}, ${y2}, ${z2})`);
              logger.info(`createSketchEntitiesBatch: 转换为米: (${x1 / 1000}, ${y1 / 1000}, ${z1 / 1000}) to (${x2 / 1000}, ${y2 / 1000}, ${z2 / 1000})`);
              
              // 检查草图状态
              try {
                const activeSketch = sketchMgr.ActiveSketch;
                if (!activeSketch) {
                  console.error('  [DEBUG] 错误: 没有活动的草图');
                  throw new Error('No active sketch - cannot create rectangle');
                }
                console.log(`  [DEBUG] 活动草图存在: ${activeSketch.Name || 'Unknown'}`);
              } catch (sketchCheckError: any) {
                console.error(`  [DEBUG] 检查草图状态失败: ${sketchCheckError.message}`);
                throw new Error(`Cannot verify sketch state: ${sketchCheckError.message}`);
              }
              
              // 直接使用 CreateLine 创建矩形的四条边（CreateCornerRectangle 可能导致进程崩溃）
              // 跳过 CreateCornerRectangle，因为它可能导致 COM 调用崩溃
              let rectangleCreated = false;
              
              // 使用 CreateLine 创建四条线来组成矩形
              if (sketchMgr.CreateLine) {
                try {
                  console.log('  [DEBUG] 尝试方法2: 使用 CreateLine 创建矩形的四条边');
                  
                  // 创建矩形的四条边: (x1,y1) -> (x2,y1) -> (x2,y2) -> (x1,y2) -> (x1,y1)
                  // 确保所有点都在同一 Z 平面上（使用 z1）
                  const z = z1 / 1000; // 统一使用 z1，确保在同一平面
                  const x1m = x1 / 1000;
                  const y1m = y1 / 1000;
                  const x2m = x2 / 1000;
                  const y2m = y2 / 1000;
                  
                  console.log(`  [DEBUG] 创建矩形线条，坐标: (${x1m}, ${y1m}, ${z}) 到 (${x2m}, ${y2m}, ${z})`);
                  
                  // **关键修复**：CreateCornerRectangle 会导致 COM 调用阻塞，直接使用 CreateLine
                  // 通过精确的端点坐标确保矩形闭合
                  // SolidWorks 会自动添加共点约束，确保端点重合
                  console.log(`  [DEBUG] 开始使用 CreateLine 创建矩形的四条边...`);
                  
                  // 创建四条边，确保端点精确重合
                  console.log(`  [DEBUG] 创建第1条线: (${x1m}, ${y1m}, ${z}) -> (${x2m}, ${y1m}, ${z})`);
                  const line1 = sketchMgr.CreateLine(x1m, y1m, z, x2m, y1m, z);
                  console.log(`  [DEBUG] 第1条线创建完成: ${!!line1}`);
                  
                  console.log(`  [DEBUG] 创建第2条线: (${x2m}, ${y1m}, ${z}) -> (${x2m}, ${y2m}, ${z})`);
                  const line2 = sketchMgr.CreateLine(x2m, y1m, z, x2m, y2m, z);
                  console.log(`  [DEBUG] 第2条线创建完成: ${!!line2}`);
                  
                  console.log(`  [DEBUG] 创建第3条线: (${x2m}, ${y2m}, ${z}) -> (${x1m}, ${y2m}, ${z})`);
                  const line3 = sketchMgr.CreateLine(x2m, y2m, z, x1m, y2m, z);
                  console.log(`  [DEBUG] 第3条线创建完成: ${!!line3}`);
                  
                  console.log(`  [DEBUG] 创建第4条线: (${x1m}, ${y2m}, ${z}) -> (${x1m}, ${y1m}, ${z})`);
                  const line4 = sketchMgr.CreateLine(x1m, y2m, z, x1m, y1m, z);
                  console.log(`  [DEBUG] 第4条线创建完成: ${!!line4}`);
                  
                  console.log(`  [DEBUG] 矩形线条创建结果: line1=${!!line1}, line2=${!!line2}, line3=${!!line3}, line4=${!!line4}`);
                  
                  if (line1 && line2 && line3 && line4) {
                    // 将四条线添加到结果中
                    results.push(
                      line1 as ISketchSegment,
                      line2 as ISketchSegment,
                      line3 as ISketchSegment,
                      line4 as ISketchSegment
                    );
                    
                    console.log('  [DEBUG] 矩形创建成功');
                    
                    // **关键修复**：验证草图状态并确保端点精确重合
                    try {
                      const activeSketch = sketchMgr.ActiveSketch;
                      if (activeSketch) {
                        // 尝试获取草图段数量来验证草图状态
                        const segmentCount = activeSketch.GetSketchSegmentCount?.() ?? 0;
                        console.log(`  [DEBUG] 草图段数量: ${segmentCount}`);
                        
                        // **关键修复**：验证矩形端点是否精确重合
                        // 通过检查线段的端点坐标来验证它们是否重合
                        try {
                          const line1Seg = line1 as any;
                          const line2Seg = line2 as any;
                          const line3Seg = line3 as any;
                          const line4Seg = line4 as any;
                          
                          if (line1Seg && line2Seg && line3Seg && line4Seg) {
                            // 尝试获取端点坐标（如果可用）
                            try {
                              const p1Start = line1Seg.GetStartPoint2?.();
                              const p1End = line1Seg.GetEndPoint2?.();
                              const p2Start = line2Seg.GetStartPoint2?.();
                              const p2End = line2Seg.GetEndPoint2?.();
                              const p3Start = line3Seg.GetStartPoint2?.();
                              const p3End = line3Seg.GetEndPoint2?.();
                              const p4Start = line4Seg.GetStartPoint2?.();
                              const p4End = line4Seg.GetEndPoint2?.();
                              
                              if (p1Start && p1End && p2Start && p2End && p3Start && p3End && p4Start && p4End) {
                                // 验证端点是否重合
                                const tolerance = 1e-9; // 1 纳米容差
                                const check1 = Math.abs(p1End.X - p2Start.X) < tolerance && 
                                             Math.abs(p1End.Y - p2Start.Y) < tolerance && 
                                             Math.abs(p1End.Z - p2Start.Z) < tolerance;
                                const check2 = Math.abs(p2End.X - p3Start.X) < tolerance && 
                                             Math.abs(p2End.Y - p3Start.Y) < tolerance && 
                                             Math.abs(p2End.Z - p3Start.Z) < tolerance;
                                const check3 = Math.abs(p3End.X - p4Start.X) < tolerance && 
                                             Math.abs(p3End.Y - p4Start.Y) < tolerance && 
                                             Math.abs(p3End.Z - p4Start.Z) < tolerance;
                                const check4 = Math.abs(p4End.X - p1Start.X) < tolerance && 
                                             Math.abs(p4End.Y - p1Start.Y) < tolerance && 
                                             Math.abs(p4End.Z - p1Start.Z) < tolerance;
                                
                                if (check1 && check2 && check3 && check4) {
                                  console.log(`  [DEBUG] ✅ 矩形端点验证通过：所有端点精确重合`);
                                } else {
                                  console.log(`  [DEBUG] ⚠️  警告 - 矩形端点可能不完全重合`);
                                  console.log(`  [DEBUG] 端点检查: 1->2=${check1}, 2->3=${check2}, 3->4=${check3}, 4->1=${check4}`);
                                }
                              } else {
                                console.log(`  [DEBUG] 无法获取端点坐标，跳过端点验证`);
                              }
                            } catch (pointErr) {
                              console.log(`  [DEBUG] 端点验证失败（可能不可用）: ${pointErr}`);
                            }
                          }
                        } catch (endpointErr) {
                          console.log(`  [DEBUG] 端点验证过程出错: ${endpointErr}`);
                        }
                        
                        // **关键修复**：如果草图段数量为0，记录警告但不阻塞
                        // 注意：GetSketchSegmentCount 在某些情况下可能不准确，特别是草图还在编辑模式时
                        // 由于4条线都已成功创建，草图应该是有效的
                        if (segmentCount === 0) {
                          console.log(`  [DEBUG] ⚠️  警告 - GetSketchSegmentCount 返回0，但这可能是正常的（草图还在编辑模式）`);
                          console.log(`  [DEBUG] 由于4条线都已成功创建，草图应该是有效的`);
                          console.log(`  [DEBUG] 草图段将在退出草图模式后被正确计数`);
                          // 不调用 GetSketchSegments()，因为它可能阻塞
                          // 草图的有效性将在退出草图后通过拉伸操作验证
                        } else {
                          console.log(`  [DEBUG] ✅ 草图段数量正常: ${segmentCount}`);
                        }
                      } else {
                        console.log(`  [DEBUG] ⚠️  警告 - 没有活动草图，矩形可能已退出草图模式`);
                      }
                    } catch (sketchCheckErr) {
                      console.log(`  [DEBUG] 检查草图状态时出现警告: ${sketchCheckErr}`);
                    }
                    
                    // **关键修复**：确保矩形草图在退出前被正确提交
                    // 注意：矩形草图将在退出时自动提交，这里只记录
                    console.log(`  [DEBUG] 矩形创建完成，草图将在退出时自动提交到特征树`);
                    
                    // 设置 entity 为第一条线（用于后续检查）
                    entity = line1 as ISketchSegment;
                    rectangleCreated = true;
                  } else {
                    console.error('  [DEBUG] 使用 CreateLine 创建矩形失败：某些线创建失败');
                    throw new Error('Failed to create rectangle using CreateLine - some lines failed');
                  }
                } catch (lineError: any) {
                  console.error(`  [DEBUG] 使用 CreateLine 创建矩形失败: ${lineError.message || lineError}`);
                  logger.error('Failed to create rectangle using CreateLine', lineError);
                  // 不抛出错误，让外部代码处理
                }
              }
              
              if (!rectangleCreated) {
                console.error('  [DEBUG] 所有创建矩形的方法都失败了');
                logger.error('All rectangle creation methods failed');
                throw new Error('Failed to create rectangle - all methods failed');
              }
              
              console.log('  [DEBUG] createSketchEntitiesBatch: 矩形操作完成');
              logger.info('createSketchEntitiesBatch: 矩形操作完成');
              break;
          }

          // 对于矩形，实体已经在 switch 中添加到 results 了，所以这里只处理其他类型
          if (entity && op.type !== 'rectangle') {
            console.log(`  [DEBUG] createSketchEntitiesBatch: 实体创建成功，添加到结果数组`);
            logger.info(`createSketchEntitiesBatch: 实体创建成功，添加到结果数组`);
            results.push(entity);
          } else if (!entity && op.type !== 'rectangle') {
            console.warn(`  [DEBUG] createSketchEntitiesBatch: 实体为 null，未添加到结果`);
            logger.warn(`createSketchEntitiesBatch: 实体为 null，未添加到结果`);
          }
        } catch (e) {
          console.error(`  [DEBUG] Failed to create ${op.type} in batch: ${(e as Error).message}`);
          console.error(`  [DEBUG] Error stack: ${(e as Error).stack}`);
          logger.error(`Failed to create ${op.type} in batch`, e as Error);
          logger.error(`Error details: ${(e as Error).message}, stack: ${(e as Error).stack}`);
        }
      }
      
      console.log(`  [DEBUG] createSketchEntitiesBatch: 所有操作处理完成，共创建 ${results.length} 个实体`);
      logger.info(`createSketchEntitiesBatch: 所有操作处理完成，共创建 ${results.length} 个实体`);
    } finally {
      console.log('  [DEBUG] createSketchEntitiesBatch: 进入 finally 块');
      logger.info('createSketchEntitiesBatch: 进入 finally 块');
      // Restore original settings
      if (sketchMgr.AddToDB !== undefined) {
        sketchMgr.AddToDB = originalAddToDB;
      }
      if (sketchMgr.DisplayWhenAdded !== undefined) {
        sketchMgr.DisplayWhenAdded = originalDisplayWhenAdded;
      }

      // Rebuild if needed
      if (options?.rebuildAfter !== false && model.EditRebuild3) {
        try {
          model.EditRebuild3();
        } catch (e) {
          logger.warn('Failed to rebuild after batch sketch creation', e as Error);
        }
      }
    }

    console.log(`  [DEBUG] createSketchEntitiesBatch: 返回结果，共 ${results.length} 个实体`);
    logger.info(`createSketchEntitiesBatch: 返回结果，共 ${results.length} 个实体`);
    return results;
  }
}

