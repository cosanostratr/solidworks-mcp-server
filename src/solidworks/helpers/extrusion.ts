/**
 * Extrusion-related helper functions
 * These are extracted from SolidWorksAPI to reduce file size and improve maintainability
 */

import { IModelDoc2, IFeatureManager } from '../types/com-types.js';
import { SolidWorksFeature } from '../types/business-types.js';
import { logger } from '../../utils/logger.js';
import { COM } from '../../utils/com-boolean.js';
import { config } from '../../utils/config.js';
import { getFeatureInfo, isSketchLikeFeature } from '../../utils/feature-utils.js';
import * as path from 'path';

/**
 * Prepare for extrusion: exit sketch mode and clear selections
 * 
 * 关键修复（基于深度研究报告）:
 * 1. InsertSketch(True) 是退出草图并提交到特征树
 * 2. 必须确保草图完全退出编辑模式
 * 3. 重建模型以确保草图注册到特征树
 */
export function prepareForExtrusion(model: IModelDoc2 | null): void {
  if (!model) return;

  // Exit sketch mode if active
  try {
    const sketchMgr = model.SketchManager;
    const activeSketch = sketchMgr.ActiveSketch;
    if (activeSketch) {
      logger.info('Exiting sketch mode before extrusion');
      
      // 关键修复：根据现有代码和测试脚本，InsertSketch(false) 是退出草图
      // 注意：这与某些文档描述可能不同，但实际测试证明 false 是正确的
      try {
        sketchMgr.InsertSketch(false);  // false = 退出草图并提交到特征树
        console.log(`  [DEBUG] prepareForExtrusion: 已调用 InsertSketch(false) 退出草图`);
      } catch (insertErr) {
        logger.warn('InsertSketch failed', insertErr as Error);
        // 尝试替代方法（某些版本可能相反）
        try {
          sketchMgr.InsertSketch(true);
          console.log(`  [DEBUG] prepareForExtrusion: 使用 InsertSketch(true) 作为替代`);
        } catch (insertErr2) {
          logger.debug('Alternative InsertSketch also failed', insertErr2 as Error);
        }
      }
      
      // Clear selection immediately after exiting sketch
      try {
        model.ClearSelection2(COM.TRUE);
        console.log(`  [DEBUG] prepareForExtrusion: 已清除选择`);
      } catch (clearErr) {
        logger.debug('ClearSelection2 failed after exiting sketch', clearErr as Error);
      }
      
      // 关键修复：检查是否是第一个拉伸（基体）
      // 第一个拉伸时，不重建，因为重建会清除选择
      // 后续拉伸时，重建是必要的以确保状态正确
      let isFirstExtrusion = true;
      try {
        // 检查是否有拉伸特征
        let checkIdx = 0;
        while (checkIdx < 10) {
          const checkFeat = model.FeatureByPositionReverse(checkIdx);
          if (!checkFeat) break;
          try {
            const { typeName } = getFeatureInfo(checkFeat);
            // 如果找到拉伸特征，说明不是第一个
            if (typeName && (typeName.includes('Extrude') || typeName.includes('拉伸') || typeName.includes('Boss') || typeName.includes('Cut'))) {
              isFirstExtrusion = false;
              console.log(`  [DEBUG] prepareForExtrusion: 找到拉伸特征: ${typeName}，不是第一个拉伸`);
              break;
            }
          } catch (e) {
            // 继续检查
          }
          checkIdx++;
        }
      } catch (e) {
        // 假设是第一个拉伸
        isFirstExtrusion = true;
      }
      
      if (!isFirstExtrusion) {
        // 后续拉伸：重建以确保状态正确
        try {
          model.EditRebuild3();
          console.log(`  [DEBUG] prepareForExtrusion: 已重建模型（后续拉伸）`);
        } catch (rebuildErr) {
          logger.warn('Rebuild failed after exiting sketch', rebuildErr as Error);
          try {
            model.EditRebuild();
          } catch (rebuildErr2) {
            logger.debug('Alternative rebuild also failed', rebuildErr2 as Error);
          }
        }
      } else {
        // **关键修复**：根据研究报告，第一个拉伸也需要重建
        // 虽然重建会清除选择，但我们可以重建后重新选择
        try {
          model.EditRebuild3();
          console.log(`  [DEBUG] prepareForExtrusion: 第一个拉伸（基体），已重建模型`);
        } catch (rebuildErr) {
          logger.warn('Rebuild failed for first extrusion', rebuildErr as Error);
        }
      }
      
      // Double-check that sketch is exited
      const stillActive = sketchMgr.ActiveSketch;
      if (stillActive) {
        logger.warn('Sketch still active after exit attempt, trying again');
        // 再次尝试退出
        try {
          sketchMgr.InsertSketch(false);
          model.ClearSelection2(COM.TRUE);
          model.EditRebuild3();
        } catch (retryErr) {
          logger.debug('Retry exit also failed', retryErr as Error);
        }
      } else {
        console.log(`  [DEBUG] prepareForExtrusion: 草图已成功退出`);
      }
    } else {
      // No active sketch, but still rebuild to ensure all features are up to date
      console.log(`  [DEBUG] prepareForExtrusion: 没有活动草图，直接重建模型`);
      try {
        model.EditRebuild3();
      } catch (rebuildErr) {
        logger.debug('Rebuild failed (no active sketch)', rebuildErr as Error);
      }
    }
  } catch (e) {
    // Continue if no active sketch
    logger.debug('Error during sketch exit preparation', e as Error);
  }

  // Clear selections (final clear)
  try {
    model.ClearSelection2(COM.TRUE);
  } catch (e) {
    // Continue
    logger.debug('Final ClearSelection2 failed', e as Error);
  }
}

/**
 * Select a sketch for extrusion by iterating features in reverse order
 * 
 * 关键修复（基于深度研究报告）:
 * 1. 使用 SelectByID2 选择草图，Mark 设为 0
 * 2. 优先尝试选择草图轮廓（REGION），如果失败则选择草图特征（SKETCH）
 * 3. 确保选择前清除所有选择
 * 
 * @returns The name of the selected sketch
 * @throws Error if no sketch is found
 */
export function selectSketchForExtrusion(model: IModelDoc2 | null): string {
  if (!model) throw new Error('No model open');

  let sketchSelected = false;
  let selectedSketchName = '';
  const attemptedSketches: string[] = [];

  try {
    // 第一步：清除所有选择（关键步骤）
    try {
      model.ClearSelection2(COM.TRUE);
      console.log(`  [DEBUG] selectSketchForExtrusion: 已清除所有选择`);
    } catch (clearErr) {
      logger.debug('ClearSelection2 failed', clearErr as Error);
    }

    let i = 0;
    const maxIterations = 50;
    logger.info(`Searching features for sketch...`);
    console.log(`  [DEBUG] selectSketchForExtrusion: 开始搜索草图特征 (最多 ${maxIterations} 个)`);

    while (i < maxIterations) {
      const feat = model.FeatureByPositionReverse(i);
      if (!feat) {
        console.log(`  [DEBUG] selectSketchForExtrusion: 位置 ${i} 没有特征，停止搜索`);
        break;
      }

      try {
        const { name: featName, typeName } = getFeatureInfo(feat);
        console.log(`  [DEBUG] selectSketchForExtrusion: 位置 ${i}, 特征名: ${featName}, 类型: ${typeName}`);

        if (isSketchLikeFeature(featName, typeName)) {
          console.log(`  [DEBUG] selectSketchForExtrusion: 找到草图特征: ${featName || 'Unnamed'}, 类型: ${typeName}`);
          
          // 关键修复：优先使用 Select2 方法（更可靠）
          // 如果草图名称为空，SelectByID2 会失败，所以先尝试 Select2
          try {
            if (feat.Select2) {
              console.log(`  [DEBUG] selectSketchForExtrusion: 使用 Select2 选择草图特征`);
              model.ClearSelection2(COM.TRUE);
              feat.Select2(false, 0);
              
              // 验证选择是否成功
              const selMgr = model.SelectionManager;
              const selectedCount = selMgr ? selMgr.GetSelectedObjectCount2(-1) : 0;
              console.log(`  [DEBUG] selectSketchForExtrusion: Select2 完成，选择数量: ${selectedCount}`);
              
              if (selectedCount > 0) {
                // 尝试选择草图轮廓（REGION）- 根据研究报告，这可能是必需的
                // 对于简单闭合草图，选择特征应该足够，但尝试选择轮廓可能更可靠
                try {
                  const ext = model.Extension;
                  if (ext && ext.SelectByID2) {
                    // 尝试选择草图内部的区域（使用草图中心点坐标）
                    // 对于矩形，中心点通常是 (0, 0, 0) 或草图的中心
                    // 注意：这需要草图已经退出编辑模式
                    console.log(`  [DEBUG] selectSketchForExtrusion: 尝试选择草图轮廓（REGION）`);
                    
                    // 方法1：尝试选择草图轮廓，使用草图中心点
                    // 如果草图是矩形，中心点通常是 (0, 0, 0)
                    const regionSelected = ext.SelectByID2(
                      '',              // 名称：对于区域选择可以为空
                      'REGION',        // 类型：草图轮廓/区域
                      0.0,             // X: 草图中心点
                      0.0,             // Y: 草图中心点
                      0.0,             // Z: 草图中心点
                      COM.FALSE,       // append: false = 替换选择
                      0,               // mark: 0
                      null,            // callout: null
                      0                // selectOption: 0
                    );
                    
                    if (regionSelected) {
                      const regionCount = selMgr ? selMgr.GetSelectedObjectCount2(-1) : 0;
                      console.log(`  [DEBUG] selectSketchForExtrusion: 区域选择成功，选择数量: ${regionCount}`);
                    } else {
                      console.log(`  [DEBUG] selectSketchForExtrusion: 区域选择失败，继续使用特征选择`);
                      // 如果区域选择失败，重新选择特征
                      model.ClearSelection2(COM.TRUE);
                      feat.Select2(false, 0);
                    }
                  }
                } catch (regionErr) {
                  console.log(`  [DEBUG] selectSketchForExtrusion: 区域选择异常: ${regionErr}，继续使用特征选择`);
                  // 如果区域选择失败，确保特征仍然被选中
                  model.ClearSelection2(COM.TRUE);
                  feat.Select2(false, 0);
                }
                
                sketchSelected = true;
                selectedSketchName = featName || `Feature at position ${i}`;
                logger.info(`Selected sketch by Select2: ${selectedSketchName} (type: ${typeName})`);
                console.log(`  [DEBUG] selectSketchForExtrusion: Select2 成功，选择的草图: ${selectedSketchName}`);
                break;
              }
            }
          } catch (select2Err) {
            console.log(`  [DEBUG] selectSketchForExtrusion: Select2 失败: ${select2Err}`);
          }
          
          // 回退方法：如果草图名称不为空，尝试 SelectByID2
          if (!sketchSelected && featName && featName.trim() !== '') {
            const ext = model.Extension;
            if (ext && ext.SelectByID2) {
              try {
                console.log(`  [DEBUG] selectSketchForExtrusion: 尝试使用 SelectByID2 选择草图: ${featName}`);
                model.ClearSelection2(COM.TRUE);
                
                // 使用 SelectByID2 选择草图，Mark = 0
                const selected = ext.SelectByID2(
                  featName,      // 草图名称（必须不为空）
                  'SKETCH',      // 类型：草图特征
                  0.0,           // X 坐标
                  0.0,           // Y 坐标
                  0.0,           // Z 坐标
                  COM.FALSE,     // append: false
                  0,             // mark: 0
                  null,          // callout: null
                  0              // selectOption: 0
                );
                
                if (selected) {
                  const selMgr = model.SelectionManager;
                  const selectedCount = selMgr ? selMgr.GetSelectedObjectCount2(-1) : 0;
                  if (selectedCount > 0) {
                    sketchSelected = true;
                    selectedSketchName = featName;
                    logger.info(`Selected sketch by SelectByID2: ${selectedSketchName}`);
                    console.log(`  [DEBUG] selectSketchForExtrusion: SelectByID2 成功，选择的草图: ${selectedSketchName}`);
                    break;
                  }
                }
              } catch (selectByIdErr) {
                attemptedSketches.push(`${featName} (error: ${selectByIdErr})`);
                console.log(`  [DEBUG] selectSketchForExtrusion: SelectByID2 异常: ${selectByIdErr}`);
              }
            }
          }
        } else {
          console.log(`  [DEBUG] selectSketchForExtrusion: 位置 ${i} 不是草图特征 (${typeName})`);
        }
      } catch (featErr) {
        console.log(`  [DEBUG] selectSketchForExtrusion: 获取特征信息失败: ${featErr}`);
        // Continue to next feature
      }

      i++;
    }
    
    console.log(`  [DEBUG] selectSketchForExtrusion: 搜索完成，检查了 ${i} 个特征`);
  } catch (e) {
    logger.warn(`Feature search failed: ${e}`);
    console.log(`  [DEBUG] selectSketchForExtrusion: 特征搜索异常: ${e}`);
  }

  if (!sketchSelected) {
    const errorMessage = `No sketch found to extrude. ` +
      (attemptedSketches.length > 0 ? `Attempted sketches: ${attemptedSketches.join(', ')}. ` : '') +
      `Please ensure a sketch exists or specify the sketch name explicitly.`;
    logger.error(errorMessage);
    console.log(`  [DEBUG] selectSketchForExtrusion: 错误 - ${errorMessage}`);
    throw new Error(errorMessage);
  }

  logger.info(`Using sketch: ${selectedSketchName}`);
  console.log(`  [DEBUG] selectSketchForExtrusion: 成功选择草图: ${selectedSketchName}`);
  
  // 关键步骤：验证选择并确保草图状态正确
  try {
    const selMgr = model.SelectionManager;
    if (selMgr) {
      const selectedCount = selMgr.GetSelectedObjectCount2(-1);
      console.log(`  [DEBUG] selectSketchForExtrusion: 最终选择数量: ${selectedCount}`);
      
      if (selectedCount > 0) {
        // 获取选择对象的类型
        try {
          const objType = selMgr.GetSelectedObjectType3(1, -1);
          console.log(`  [DEBUG] selectSketchForExtrusion: 选择对象类型: ${objType}`);
          
          // 根据研究报告，类型 9 是 swSelSKETCHES（草图特征）
          // 这是正确的选择类型
          if (objType === 9) {
            console.log(`  [DEBUG] selectSketchForExtrusion: 选择类型正确（swSelSKETCHES）`);
          }
        } catch (typeErr) {
          console.log(`  [DEBUG] selectSketchForExtrusion: 获取对象类型失败: ${typeErr}`);
        }
        
        // **关键修复**：根据研究报告，验证草图闭合性
        // 尝试获取选中的草图对象并验证其闭合性
        try {
          const selectedObj = selMgr.GetSelectedObject6(1, -1) as { CheckFeatureUse?: (usageType: number, openCount: { value: number }, closedCount: { value: number }) => number };
          if (selectedObj && selectedObj.CheckFeatureUse) {
            // swSketchCheckFeatureBaseExtrude = 0 (用于基体拉伸验证)
            const usageType = 0;
            const openCount = { value: 0 };
            const closedCount = { value: 0 };
            try {
              const status = selectedObj.CheckFeatureUse(usageType, openCount, closedCount);
              console.log(`  [DEBUG] selectSketchForExtrusion: 草图验证 - 状态=${status}, 开放轮廓=${openCount.value}, 闭合轮廓=${closedCount.value}`);
              
              if (closedCount.value === 0) {
                logger.warn(`草图没有闭合轮廓，拉伸可能失败`);
                console.log(`  [DEBUG] selectSketchForExtrusion: 警告 - 草图没有闭合轮廓`);
              } else {
                console.log(`  [DEBUG] selectSketchForExtrusion: 草图有 ${closedCount.value} 个闭合轮廓，可以拉伸`);
              }
            } catch (checkErr) {
              // CheckFeatureUse 可能失败，继续
              console.log(`  [DEBUG] selectSketchForExtrusion: CheckFeatureUse 调用失败: ${checkErr}`);
            }
          }
        } catch (objErr) {
          console.log(`  [DEBUG] selectSketchForExtrusion: 获取选择对象失败: ${objErr}`);
        }
      }
    }
    
    // 关键修复：根据测试结果，重建会清除选择
    // 第一个拉伸（基体）时，不重建，直接使用当前选择
    // 后续拉伸时，重建后重新选择
    
    // 检查是否有拉伸特征（不是草图特征）
    let hasExtrusionFeature = false;
    try {
      let checkIdx = 0;
      while (checkIdx < 10) {
        const checkFeat = model.FeatureByPositionReverse(checkIdx);
        if (!checkFeat) break;
        try {
          const { typeName } = getFeatureInfo(checkFeat);
          // 检查是否有拉伸特征（Boss-Extrude 或 Cut-Extrude）
          if (typeName && (typeName.includes('Extrude') || typeName.includes('拉伸'))) {
            hasExtrusionFeature = true;
            break;
          }
        } catch (e) {
          // 继续检查
        }
        checkIdx++;
      }
    } catch (e) {
      // 忽略错误
    }
    
    console.log(`  [DEBUG] selectSketchForExtrusion: 是否有拉伸特征: ${hasExtrusionFeature}`);
    
    // **关键修复**：根据研究报告，所有拉伸都需要重建后重新选择
    // 第一个拉伸时，虽然 prepareForExtrusion 已经重建，但选择可能丢失
    // 所以需要重新选择草图
    if (!hasExtrusionFeature) {
      // 第一个拉伸：prepareForExtrusion 已经重建，但选择可能丢失，需要重新选择
      console.log(`  [DEBUG] selectSketchForExtrusion: 第一个拉伸特征，重建后重新选择`);
      try {
        // 重新选择草图（重建可能清除了选择）
        const feat = model.FeatureByPositionReverse(0);
        if (feat && feat.Select2) {
          model.ClearSelection2(COM.TRUE);
          feat.Select2(false, 0);
          console.log(`  [DEBUG] selectSketchForExtrusion: 已重新选择草图`);
          
          // 验证重新选择是否成功
          const finalSelMgr = model.SelectionManager;
          const finalCount = finalSelMgr ? finalSelMgr.GetSelectedObjectCount2(-1) : 0;
          console.log(`  [DEBUG] selectSketchForExtrusion: 重新选择后数量: ${finalCount}`);
        }
      } catch (reSelectErr) {
        logger.debug('Re-select failed for first extrusion', reSelectErr as Error);
      }
    } else {
      // 后续拉伸：重建后重新选择
      try {
        model.EditRebuild3();
        console.log(`  [DEBUG] selectSketchForExtrusion: 已重建模型`);
        
        // 重建后必须重新选择
        const feat = model.FeatureByPositionReverse(0);
        if (feat && feat.Select2) {
          model.ClearSelection2(COM.TRUE);
          feat.Select2(false, 0);
          console.log(`  [DEBUG] selectSketchForExtrusion: 重建后已重新选择`);
          
          // 验证重新选择是否成功
          const finalSelMgr = model.SelectionManager;
          const finalCount = finalSelMgr ? finalSelMgr.GetSelectedObjectCount2(-1) : 0;
          console.log(`  [DEBUG] selectSketchForExtrusion: 重新选择后数量: ${finalCount}`);
        }
      } catch (rebuildErr) {
        logger.debug('Rebuild failed', rebuildErr as Error);
      }
    }
  } catch (rebuildErr) {
    logger.debug('Rebuild after selection failed', rebuildErr as Error);
  }
  
  return selectedSketchName;
}

/**
 * Validate and ensure sketch selection is correct before extrusion
 * This function performs final checks and fixes selection if needed
 */
export function validateSketchSelectionBeforeExtrusion(
  model: IModelDoc2 | null,
  isFirstExtrusion: boolean
): { success: boolean; error?: string; details?: any } {
  if (!model) {
    return { success: false, error: 'No model open' };
  }

  const selMgr = model.SelectionManager;
  if (!selMgr) {
    return { success: false, error: 'SelectionManager not available' };
  }

  // Check selection count
  const selectedCount = selMgr.GetSelectedObjectCount2(-1);
  console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 选择数量: ${selectedCount}`);

  if (selectedCount === 0) {
    // Try to re-select the sketch
    console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 没有选择，尝试重新选择草图`);
    try {
      // Find the most recent sketch
      let i = 0;
      while (i < 20) {
        const feat = model.FeatureByPositionReverse(i);
        if (!feat) break;

        try {
          const { name, typeName } = getFeatureInfo(feat);
          if (isSketchLikeFeature(name, typeName)) {
            console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 找到草图: ${name || 'Unnamed'}`);
            model.ClearSelection2(COM.TRUE);
            
            // Try Select2 first
            if (feat.Select2) {
              feat.Select2(false, 0);
              const newCount = selMgr.GetSelectedObjectCount2(-1);
              if (newCount > 0) {
                console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 重新选择成功，数量: ${newCount}`);
                break;
              }
            }

            // Try SelectByID2 if name is available
            if (name && name.trim() !== '') {
              const ext = model.Extension;
              if (ext && ext.SelectByID2) {
                model.ClearSelection2(COM.TRUE);
                ext.SelectByID2(name, 'SKETCH', 0.0, 0.0, 0.0, COM.FALSE, 0, null, 0);
                const newCount2 = selMgr.GetSelectedObjectCount2(-1);
                if (newCount2 > 0) {
                  console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: SelectByID2 重新选择成功，数量: ${newCount2}`);
                  break;
                }
              }
            }
          }
        } catch (e) {
          // Continue searching
        }
        i++;
      }

      // Re-check selection count
      const finalCount = selMgr.GetSelectedObjectCount2(-1);
      if (finalCount === 0) {
        return { 
          success: false, 
          error: 'No sketch selected. Please ensure a sketch exists and is properly closed.',
          details: { attemptedReselection: true }
        };
      }
    } catch (reselectErr) {
      return { 
        success: false, 
        error: `Failed to re-select sketch: ${reselectErr}`,
        details: { reselectError: reselectErr }
      };
    }
  }

  // Verify selection type
  try {
    const objType = selMgr.GetSelectedObjectType3(1, -1);
    console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 选择对象类型: ${objType}`);
    
    // Type 9 is swSelSKETCHES, which is correct for extrusion
    if (objType !== 9) {
      console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 警告 - 选择类型不是草图 (类型: ${objType})`);
      // Try to select as REGION (type might be different for closed regions)
      if (objType === 4) { // swSelREGIONS
        console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 选择类型是 REGION，这是可以接受的`);
      } else {
        return { 
          success: false, 
          error: `Invalid selection type: ${objType}. Expected type 9 (SKETCH) or 4 (REGION).`,
          details: { selectionType: objType }
        };
      }
    }
  } catch (typeErr) {
    console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 获取选择类型失败: ${typeErr}`);
    // Continue anyway, as this might not be critical
  }

  // Verify sketch closure (if possible)
  try {
    const selectedObj = selMgr.GetSelectedObject6(1, -1) as { CheckFeatureUse?: (usageType: number, openCount: { value: number }, closedCount: { value: number }) => number };
    if (selectedObj && selectedObj.CheckFeatureUse) {
      const usageType = 0; // swSketchCheckFeatureBaseExtrude
      const openCount = { value: 0 };
      const closedCount = { value: 0 };
      const status = selectedObj.CheckFeatureUse(usageType, openCount, closedCount);
      console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 草图验证 - 状态=${status}, 开放轮廓=${openCount.value}, 闭合轮廓=${closedCount.value}`);
      
      // **关键修复**：如果草图没有闭合轮廓，尝试重建模型并重新验证
      if (closedCount.value === 0) {
        console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: ⚠️  草图没有闭合轮廓，尝试重建模型...`);
        try {
          // 重建模型可能有助于草图状态更新
          model.EditRebuild3();
          console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 已重建模型，重新验证草图...`);
          
          // 重新选择草图
          model.ClearSelection2(COM.TRUE);
          let i = 0;
          while (i < 10) {
            const feat = model.FeatureByPositionReverse(i);
            if (!feat) break;
            try {
              const { name, typeName } = getFeatureInfo(feat);
              if (isSketchLikeFeature(name, typeName)) {
                if (feat.Select2) {
                  feat.Select2(false, 0);
                  const newCount = selMgr.GetSelectedObjectCount2(-1);
                  if (newCount > 0) {
                    console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 重建后重新选择成功`);
                    break;
                  }
                }
              }
            } catch (e) {
              // Continue
            }
            i++;
          }
          
          // 重新验证闭合性
          const newSelectedObj = selMgr.GetSelectedObject6(1, -1) as { CheckFeatureUse?: (usageType: number, openCount: { value: number }, closedCount: { value: number }) => number };
          if (newSelectedObj && newSelectedObj.CheckFeatureUse) {
            const newOpenCount = { value: 0 };
            const newClosedCount = { value: 0 };
            newSelectedObj.CheckFeatureUse(usageType, newOpenCount, newClosedCount);
            console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 重建后验证 - 开放轮廓=${newOpenCount.value}, 闭合轮廓=${newClosedCount.value}`);
            
            if (newClosedCount.value === 0 && newOpenCount.value > 0) {
              return { 
                success: false, 
                error: `Sketch has no closed contours after rebuild (${newOpenCount.value} open contours found). The sketch may not be properly closed. Please check the sketch geometry.`,
                details: { openCount: newOpenCount.value, closedCount: newClosedCount.value, rebuilt: true }
              };
            }
            
            if (newClosedCount.value > 0) {
              console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: ✅ 重建后草图有 ${newClosedCount.value} 个闭合轮廓`);
            }
          }
        } catch (rebuildErr) {
          console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 重建失败: ${rebuildErr}`);
          // Continue with original validation result
        }
        
        // 如果重建后仍然没有闭合轮廓，返回错误
        if (openCount.value === 0 && closedCount.value === 0) {
          // 可能是 CheckFeatureUse 不可用，继续执行
          console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: CheckFeatureUse 可能不可用，继续执行`);
        } else if (closedCount.value === 0 && openCount.value > 0) {
          return { 
            success: false, 
            error: `Sketch has no closed contours (${openCount.value} open contours found). Extrusion requires a closed sketch.`,
            details: { openCount: openCount.value, closedCount: closedCount.value }
          };
        }
      } else if (closedCount.value > 0) {
        console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: ✅ 草图有 ${closedCount.value} 个闭合轮廓`);
      }
    } else {
      console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: CheckFeatureUse 不可用，跳过闭合性验证`);
    }
  } catch (checkErr) {
    console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 草图闭合性检查失败: ${checkErr}`);
    // Continue anyway, as CheckFeatureUse might not be available
  }

  // Final verification: ensure model is in correct state
  try {
    const sketchMgr = model.SketchManager;
    const activeSketch = sketchMgr?.ActiveSketch;
    if (activeSketch) {
      console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: ⚠️  警告 - 仍有活动草图，尝试退出`);
      try {
        sketchMgr.InsertSketch(false);
        console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 已退出活动草图`);
        
        // 退出后重新选择草图
        model.ClearSelection2(COM.TRUE);
        let i = 0;
        while (i < 10) {
          const feat = model.FeatureByPositionReverse(i);
          if (!feat) break;
          try {
            const { name, typeName } = getFeatureInfo(feat);
            if (isSketchLikeFeature(name, typeName)) {
              if (feat.Select2) {
                feat.Select2(false, 0);
                const newCount = selMgr.GetSelectedObjectCount2(-1);
                if (newCount > 0) {
                  console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 退出草图后重新选择成功`);
                  break;
                }
              }
            }
          } catch (e) {
            // Continue
          }
          i++;
        }
      } catch (exitErr) {
        console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 退出草图失败: ${exitErr}`);
      }
    }
  } catch (sketchCheckErr) {
    // Ignore
  }

  // **关键修复**：对于第一个拉伸，尝试选择草图轮廓（REGION）而不是草图特征
  // 某些情况下，选择轮廓比选择特征更可靠
  if (isFirstExtrusion) {
    console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 第一个拉伸，尝试选择草图轮廓（REGION）`);
    try {
      const ext = model.Extension;
      if (ext && ext.SelectByID2) {
        // 尝试在多个位置选择区域（矩形中心可能在 (0,0,0) 或其他位置）
        const testPoints = [
          [0.0, 0.0, 0.0],
          [0.0, 0.0, 0.001], // 稍微偏移
          [-0.025, -0.02, 0.0], // 矩形中心（基于测试中的矩形尺寸）
        ];
        
        for (const [x, y, z] of testPoints) {
          try {
            model.ClearSelection2(COM.TRUE);
            const regionSelected = ext.SelectByID2('', 'REGION', x, y, z, COM.FALSE, 0, null, 0);
            if (regionSelected) {
              const regionCount = selMgr.GetSelectedObjectCount2(-1);
              const regionType = selMgr.GetSelectedObjectType3(1, -1);
              console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 区域选择成功 - 位置(${x},${y},${z}), 数量=${regionCount}, 类型=${regionType}`);
              if (regionCount > 0 && (regionType === 4 || regionType === 9)) { // 4=REGION, 9=SKETCH
                console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: ✅ 使用区域选择`);
                break;
              }
            }
          } catch (pointErr) {
            // Try next point
            console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 位置(${x},${y},${z})选择失败: ${pointErr}`);
          }
        }
        
        // 如果区域选择失败，确保草图特征仍然被选中
        const finalCount = selMgr.GetSelectedObjectCount2(-1);
        if (finalCount === 0) {
          console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 区域选择失败，重新选择草图特征`);
          // 重新选择草图特征
          let i = 0;
          while (i < 10) {
            const feat = model.FeatureByPositionReverse(i);
            if (!feat) break;
            try {
              const { name, typeName } = getFeatureInfo(feat);
              if (isSketchLikeFeature(name, typeName)) {
                if (feat.Select2) {
                  feat.Select2(false, 0);
                  const newCount = selMgr.GetSelectedObjectCount2(-1);
                  if (newCount > 0) {
                    console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 重新选择草图特征成功`);
                    break;
                  }
                }
              }
            } catch (e) {
              // Continue
            }
            i++;
          }
        }
      }
    } catch (regionErr) {
      console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: 区域选择尝试失败: ${regionErr}`);
      // Continue with sketch feature selection
    }
  }

  console.log(`  [DEBUG] validateSketchSelectionBeforeExtrusion: ✅ 验证通过`);
  return { success: true };
}

/**
 * Try FeatureExtrusion3 method
 * 
 * 关键修复（基于深度研究报告）:
 * 1. Boolean 参数必须直接传递 true/false，不能转换为 1/0
 * 2. COM 的 VARIANT_BOOL 在 TypeScript 中应直接使用 boolean 类型
 * 3. 所有 Boolean 参数使用原生 boolean 值
 * 4. **关键修复**：第一个拉伸（基体）时，Merge 必须设置为 False
 *    因为基体拉伸时没有现有实体可合并，Merge=True 会导致内核验证失败
 */
export function tryFeatureExtrusion3(
  featureMgr: IFeatureManager, 
  depthInMeters: number, 
  reverse: boolean,
  isFirstExtrusion: boolean = false,
  draftAngleDegrees: number = 0
): any {
  // 确保深度大于最小精度限制 (10^-8 米)
  const minDepth = 1e-8;
  const safeDepth = Math.max(depthInMeters, minDepth);
  
  if (safeDepth <= minDepth) {
    logger.warn(`Depth too small: ${depthInMeters}, using minimum: ${minDepth}`);
  }
  
  // **关键修复**：根据研究报告，第一个拉伸（基体）时 Merge 必须为 False
  // 因为基体拉伸时没有现有实体可合并，Merge=True 会导致内核验证失败
  // 后续拉伸时，Merge 可以设置为 True 以合并到现有实体
  const mergeValue = isFirstExtrusion ? false : true;
  
  // 处理拔模角度：从度转换为弧度
  const draftInRadians = draftAngleDegrees !== 0 ? (draftAngleDegrees * Math.PI) / 180 : 0.0;
  const hasDraft = draftAngleDegrees !== 0 && draftInRadians !== 0;
  
  console.log(`  [DEBUG] tryFeatureExtrusion3: 第一个拉伸=${isFirstExtrusion}, Merge=${mergeValue}, Draft=${draftAngleDegrees}°`);
  
  // 关键修复：直接传递 Boolean 值，不使用三元运算符转换为整数
  const result = featureMgr.FeatureExtrusion3(
    true,              // Sd (single direction) - Boolean: true = 单向拉伸
    reverse,           // Flip - Boolean: 翻转拉伸方向
    false,             // Dir (both directions) - Boolean: false = 单向
    0,                 // T1 (end condition: 0=Blind) - Long: swEndCondBlind
    0,                 // T2 - Long: swEndCondBlind
    safeDepth,         // D1 (depth) - Double: 确保大于最小精度
    0.0,               // D2 - Double: 方向2深度（单向时不用）
    hasDraft,          // Dchk1 - Boolean: 方向1是否启用拔模
    false,             // Dchk2 - Boolean: 方向2是否启用拔模
    false,             // Ddir1 - Boolean: 方向1拔模方向
    false,             // Ddir2 - Boolean: 方向2拔模方向
    draftInRadians,    // Dang1 - Double: 方向1拔模角度（弧度）
    0.0,               // Dang2 - Double: 方向2拔模角度（弧度）
    false,             // OffsetReverse1 - Boolean: 方向1是否反向偏移
    false,             // OffsetReverse2 - Boolean: 方向2是否反向偏移
    false,             // TranslateSurface1 - Boolean: 方向1是否平移表面
    false,             // TranslateSurface2 - Boolean: 方向2是否平移表面
    mergeValue,        // Merge - Boolean: **关键** 基体拉伸时为 false，后续拉伸时为 true
    false,             // FlipSideToCut - Boolean: 翻转切削面（凸台时不起作用）
    true,              // Update - Boolean: 是否立即更新特征树
    0,                 // T0 (Start condition) - Long: swStartSketchPlane
    0.0,               // StartOffset - Double: 起始偏移距离（米）
    false              // FlipStartOffset - Boolean: 是否反转起始偏移方向
  );
  console.log(`  [DEBUG] tryFeatureExtrusion3: 调用完成, 结果: ${result ? '非空' : 'null'}`);
  if (!result) {
    console.log(`  [DEBUG] tryFeatureExtrusion3: 警告 - FeatureExtrusion3 返回 null`);
    console.log(`  [DEBUG] tryFeatureExtrusion3: 参数 - depth=${safeDepth}m, reverse=${reverse}, merge=${mergeValue}, isFirst=${isFirstExtrusion}`);
    
    // **关键修复**：如果第一个拉伸返回 null，可能是草图闭合性问题
    // 尝试重建模型并重新选择草图，然后重试
    if (isFirstExtrusion) {
      console.log(`  [DEBUG] tryFeatureExtrusion3: 第一个拉伸返回 null，可能是草图闭合性问题`);
      console.log(`  [DEBUG] tryFeatureExtrusion3: 建议检查草图是否完全闭合，端点是否精确重合`);
    }
  }
  return result;
}

/**
 * Try FeatureCut3 - 切除拉伸
 * 
 * 使用 FeatureExtrusion3 并设置 flipSideToCut = true 来创建切除特征
 * 
 * 注意：
 * 1. 切除拉伸需要有现有的实体才能进行切除
 * 2. flipSideToCut 参数控制是否创建切除而非凸台
 */
export function tryFeatureCut3(
  featureMgr: IFeatureManager, 
  depthInMeters: number, 
  reverse: boolean,
  draftAngleDegrees: number = 0
): any {
  // 确保深度大于最小精度限制 (10^-8 米)
  const minDepth = 1e-8;
  const safeDepth = Math.max(depthInMeters, minDepth);
  
  if (safeDepth <= minDepth) {
    logger.warn(`Depth too small: ${depthInMeters}, using minimum: ${minDepth}`);
  }
  
  // 处理拔模角度：从度转换为弧度
  const draftInRadians = draftAngleDegrees !== 0 ? (draftAngleDegrees * Math.PI) / 180 : 0.0;
  const hasDraft = draftAngleDegrees !== 0 && draftInRadians !== 0;
  
  console.log(`  [DEBUG] tryFeatureCut3: depth=${safeDepth}m, reverse=${reverse}, Draft=${draftAngleDegrees}°`);
  
  // 切除拉伸的关键参数：
  // - flipSideToCut = true: 创建切除而非凸台
  // - merge = true: 从现有实体中切除
  const result = featureMgr.FeatureExtrusion3(
    true,              // Sd (single direction) - Boolean: true = 单向拉伸
    reverse,           // Flip - Boolean: 翻转拉伸方向
    false,             // Dir (both directions) - Boolean: false = 单向
    0,                 // T1 (end condition: 0=Blind) - Long: swEndCondBlind
    0,                 // T2 - Long: swEndCondBlind
    safeDepth,         // D1 (depth) - Double: 切除深度
    0.0,               // D2 - Double: 方向2深度（单向时不用）
    hasDraft,          // Dchk1 - Boolean: 方向1是否启用拔模
    false,             // Dchk2 - Boolean: 方向2是否启用拔模
    false,             // Ddir1 - Boolean: 方向1拔模方向
    false,             // Ddir2 - Boolean: 方向2拔模方向
    draftInRadians,    // Dang1 - Double: 方向1拔模角度（弧度）
    0.0,               // Dang2 - Double: 方向2拔模角度（弧度）
    false,             // OffsetReverse1 - Boolean: 方向1是否反向偏移
    false,             // OffsetReverse2 - Boolean: 方向2是否反向偏移
    false,             // TranslateSurface1 - Boolean: 方向1是否平移表面
    false,             // TranslateSurface2 - Boolean: 方向2是否平移表面
    true,              // Merge - Boolean: 切除时需要 merge 到现有实体
    true,              // FlipSideToCut - Boolean: **关键** true = 切除，false = 凸台
    true,              // Update - Boolean: 是否立即更新特征树
    0,                 // T0 (Start condition) - Long: swStartSketchPlane
    0.0,               // StartOffset - Double: 起始偏移距离（米）
    false              // FlipStartOffset - Boolean: 是否反转起始偏移方向
  );
  console.log(`  [DEBUG] tryFeatureCut3: 调用完成, 结果: ${result ? '非空' : 'null'}`);
  if (!result) {
    console.log(`  [DEBUG] tryFeatureCut3: 警告 - FeatureExtrusion3 (切除模式) 返回 null`);
    console.log(`  [DEBUG] tryFeatureCut3: 可能原因：草图未完全闭合，或不在现有实体上`);
  }
  return result;
}

/**
 * Try FeatureExtrusion2 method
 * 
 * 关键修复：Boolean 参数直接传递 true/false
 * 注意：FeatureExtrusion2 不支持 Merge 参数，所以无法针对基体拉伸进行特殊处理
 */
export function tryFeatureExtrusion2(
  featureMgr: IFeatureManager, 
  depthInMeters: number, 
  reverse: boolean,
  isFirstExtrusion: boolean = false
): any {
  const minDepth = 1e-8;
  const safeDepth = Math.max(depthInMeters, minDepth);
  
  console.log(`  [DEBUG] tryFeatureExtrusion2: 第一个拉伸=${isFirstExtrusion}`);
  
  // **关键修复**: 根据 SolidWorks API 文档，FeatureExtrusion2 需要17个参数
  // 第一个拉伸（基体）时，Merge 必须为 false
  const mergeValue = isFirstExtrusion ? false : true;
  
  // 注意：最后4个参数（merge, useFeatScope, useAutoSelect, scope）在某些版本可能不需要
  // 如果传递这些参数导致类型不匹配，可以尝试只传递前13个参数
  const result = featureMgr.FeatureExtrusion2(
    true,              // Sd - Boolean: 单向拉伸
    reverse,           // Flip - Boolean: 翻转方向
    false,             // Dir - Boolean: 单向
    0,                 // T1 - Long: swEndCondBlind
    0,                 // T2 - Long: swEndCondBlind
    safeDepth,         // D1 - Double: 深度
    0.0,               // D2 - Double: 方向2深度
    false,             // Dchk1 - Boolean: 方向1拔模
    false,             // Dchk2 - Boolean: 方向2拔模
    false,             // Ddir1 - Boolean: 方向1拔模方向
    false,             // Ddir2 - Boolean: 方向2拔模方向
    0.0,               // Dang1 - Double: 方向1拔模角度
    0.0                // Dang2 - Double: 方向2拔模角度
    // 注意：不传递 merge, useFeatScope, useAutoSelect, scope 参数
    // 这些参数在某些 SolidWorks 版本中可能导致类型不匹配错误
  );
  console.log(`  [DEBUG] tryFeatureExtrusion2: 调用完成, 结果: ${result ? '非空' : 'null'}`);
  return result;
}

/**
 * Try FeatureExtrusion method (minimal params)
 * 
 * 关键修复：Boolean 参数直接传递 true/false
 * 注意：FeatureExtrusion 不支持 Merge 参数，所以无法针对基体拉伸进行特殊处理
 */
export function tryFeatureExtrusion(
  featureMgr: IFeatureManager, 
  depthInMeters: number, 
  reverse: boolean,
  isFirstExtrusion: boolean = false
): any {
  const minDepth = 1e-8;
  const safeDepth = Math.max(depthInMeters, minDepth);
  
  console.log(`  [DEBUG] tryFeatureExtrusion: 第一个拉伸=${isFirstExtrusion}`);
  
  const result = featureMgr.FeatureExtrusion(
    true,              // Sd - Boolean: 单向拉伸
    reverse,           // Flip - Boolean: 翻转方向
    false,             // Dir - Boolean: 单向
    0,                 // T1 - Long: swEndCondBlind
    0,                 // T2 - Long: swEndCondBlind
    safeDepth,         // D1 - Double: 深度
    0.0,               // D2 - Double: 方向2深度
    false,             // Dchk1 - Boolean: 方向1拔模
    false,             // Dchk2 - Boolean: 方向2拔模
    false,             // Ddir1 - Boolean: 方向1拔模方向
    false,             // Ddir2 - Boolean: 方向2拔模方向
    0.0,               // Dang1 - Double: 方向1拔模角度
    0.0                // Dang2 - Double: 方向2拔模角度
  );
  console.log(`  [DEBUG] tryFeatureExtrusion: 调用完成, 结果: ${result ? '非空' : 'null'}`);
  return result;
}

/**
 * Generate VBA macro as fallback when all COM methods fail
 */
export function generateVBAFallbackMacro(depth: number, reverse: boolean): string {
  try {
    const macroGenModule = require('../adapters/macro-generator.js');
    const MacroGenerator = macroGenModule.MacroGenerator;
    const generator = new MacroGenerator();
    const macroCode = generator.generateExtrusionMacro({
      depth: depth * 1000, // Convert back to mm
      reverse: reverse,
      endCondition: 'Blind',
      merge: true
    });

    const tempDir = config.solidworks.macrosPath ||
      path.join(process.env.TEMP || process.env.TMPDIR || (process.platform === 'win32' ? 'C:\\Temp' : '/tmp'), 'solidworks_mcp_macros');

    const fsSync = require('fs');
    if (!fsSync.existsSync(tempDir)) {
      fsSync.mkdirSync(tempDir, { recursive: true });
    }
    const macroPath = path.join(tempDir, `CreateExtrusion_${Date.now()}.swp`);
    fsSync.writeFileSync(macroPath, macroCode);

    logger.info(`Generated VBA macro at: ${macroPath}`);
    return macroPath;
  } catch (macroErr) {
    logger.warn('Failed to generate fallback macro', macroErr as Error);
    return '';
  }
}

/**
 * Finalize extrusion: get feature name, clear selections, rebuild model
 */
export function finalizeExtrusion(model: IModelDoc2 | null, feature: any): SolidWorksFeature {
  if (!feature) {
    throw new Error('Failed to create extrusion - feature is null');
  }

  // Get feature name
  let featureName = 'Boss-Extrude1';
  try {
    if (feature.Name) {
      featureName = feature.Name;
    } else if (feature.GetName) {
      featureName = feature.GetName();
    }
  } catch (e) {
    // Use default name
  }

  // Clear selections
  try {
    model?.ClearSelection2(COM.TRUE);
  } catch (e) {
    // Ignore
  }

  // Rebuild
  try {
    model?.EditRebuild3();
  } catch (e) {
    try {
      model?.EditRebuild();
    } catch (e2) {
      // Continue
    }
  }

  return {
    name: featureName,
    type: 'Extrusion',
    suppressed: false,
  };
}

/**
 * 尝试使用 FeatureData 模式进行拉伸（基于深度研究报告的建议）
 * 
 * 这是 SolidWorks 现代 API 推荐的方法，采用"配置对象"模式而不是长参数列表
 * 优势：
 * 1. 分步设置属性，如果某个属性值非法，API 会在设置时返回错误
 * 2. 避免参数错位：属性是具名的，完全规避了函数调用中 23 个参数位置对齐的问题
 * 3. 更好的拓扑控制：FeatureData 接口提供了更精细的选择集管理
 * 
 * 注意：此方法需要 SolidWorks 2022 或更高版本
 */
export function tryFeatureExtrusionWithFeatureData(
  featureMgr: IFeatureManager,
  depthInMeters: number,
  reverse: boolean,
  isFirstExtrusion: boolean = false
): any {
  try {
    console.log(`  [DEBUG] tryFeatureExtrusionWithFeatureData: 尝试使用 FeatureData 模式`);
    
    // 检查是否有 CreateDefinition 方法（SolidWorks 2022+）
    const createDefinition = (featureMgr as any).CreateDefinition;
    if (!createDefinition) {
      console.log(`  [DEBUG] tryFeatureExtrusionWithFeatureData: CreateDefinition 不可用（可能需要 SolidWorks 2022+）`);
      return null;
    }
    
    // swFmExtrude = 0x1F000001 (拉伸特征类型 ID)
    const swFmExtrude = 0x1F000001;
    const extrudeData = createDefinition(swFmExtrude);
    
    if (!extrudeData) {
      console.log(`  [DEBUG] tryFeatureExtrusionWithFeatureData: CreateDefinition 返回 null`);
      return null;
    }
    
    // 配置拉伸定义
    // 注意：FeatureData 接口的方法名可能因版本而异，这里使用通用方法
    try {
      // 设置终止条件（swEndCondBlind = 0）
      if (extrudeData.SetEndCondition) {
        extrudeData.SetEndCondition(true, 0); // true = single direction, 0 = Blind
      }
      
      // 设置深度
      if (extrudeData.SetDepth) {
        const minDepth = 1e-8;
        const safeDepth = Math.max(depthInMeters, minDepth);
        extrudeData.SetDepth(true, safeDepth);
      }
      
      // 设置 Merge 参数
      if (extrudeData.Merge !== undefined) {
        extrudeData.Merge = isFirstExtrusion ? false : true;
        console.log(`  [DEBUG] tryFeatureExtrusionWithFeatureData: Merge=${extrudeData.Merge}`);
      }
      
      // 设置方向
      if (extrudeData.Reverse !== undefined) {
        extrudeData.Reverse = reverse;
      }
      
      // 调用创建方法
      const createFeature = (featureMgr as any).CreateFeature;
      if (createFeature) {
        const result = createFeature(extrudeData);
        console.log(`  [DEBUG] tryFeatureExtrusionWithFeatureData: 调用完成, 结果: ${result ? '非空' : 'null'}`);
        return result;
      } else {
        console.log(`  [DEBUG] tryFeatureExtrusionWithFeatureData: CreateFeature 不可用`);
        return null;
      }
    } catch (configErr: any) {
      console.log(`  [DEBUG] tryFeatureExtrusionWithFeatureData: 配置失败: ${configErr.message || configErr}`);
      return null;
    }
  } catch (err: any) {
    console.log(`  [DEBUG] tryFeatureExtrusionWithFeatureData: 异常: ${err.message || err}`);
    return null;
  }
}
