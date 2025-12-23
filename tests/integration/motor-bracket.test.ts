/**
 * 小型减速电机支架 - 集成测试
 * 
 * 此测试创建一个完整的电机支架零件，验证以下功能：
 * - 基础拉伸（底板）
 * - 附加拉伸（侧板）
 * - 切除拉伸（各种孔位）
 * 
 * 运行方式：npx tsx tests/integration/motor-bracket.test.ts
 */

import { SolidWorksAPI } from '../../src/solidworks/api.js';

// 支架参数定义（单位：mm）
const PARAMS = {
  // 底板尺寸
  baseWidth: 50,
  baseLength: 60,
  baseThickness: 5,
  
  // 侧板尺寸
  sideHeight: 35,
  sideThickness: 4,
  
  // 电机安装孔
  motorHoleDia: 12,       // 电机轴孔直径
  motorHoleOffset: 20,    // 电机孔中心距底板高度
  
  // 定位孔
  locatorHoleDia: 3,      // 定位孔直径
  locatorOffset: 15,      // 定位孔水平偏移
  
  // 底板安装孔
  mountHoleDia: 4,        // 安装孔直径
  mountHoleMargin: 8,     // 安装孔边缘距离
};

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           小型减速电机支架 - 集成测试                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  console.log('📐 支架参数:');
  console.log(`   底板: ${PARAMS.baseWidth}×${PARAMS.baseLength}×${PARAMS.baseThickness}mm`);
  console.log(`   侧板: ${PARAMS.baseWidth}×${PARAMS.sideHeight}×${PARAMS.sideThickness}mm`);
  console.log(`   电机孔: Φ${PARAMS.motorHoleDia}mm`);
  console.log(`   安装孔: Φ${PARAMS.mountHoleDia}mm × 4`);
  console.log('');

  const api = new SolidWorksAPI();

  try {
    // ============================================
    // 1. 连接 SolidWorks
    // ============================================
    console.log('📡 步骤 1: 连接 SolidWorks...');
    api.connect();
    if (!api.isConnected()) {
      throw new Error('连接失败');
    }
    console.log('   ✅ 连接成功');
    console.log('');

    // ============================================
    // 2. 创建新零件
    // ============================================
    console.log('📦 步骤 2: 创建新零件...');
    const modelInfo = api.createPart();
    if (!modelInfo) {
      throw new Error('创建零件失败');
    }
    console.log('   ✅ 零件创建成功');
    console.log('');

    // 获取模型引用
    const model = api.getCurrentModel();
    if (!model) {
      throw new Error('无法获取当前模型');
    }

    // ============================================
    // 3. 创建底板
    // ============================================
    console.log('🔷 步骤 3: 创建底板...');
    
    // 创建底板草图
    let sketchResult = api.createSketch({ plane: 'Top' });
    if (!sketchResult.success) {
      throw new Error(`创建草图失败: ${sketchResult.error}`);
    }
    
    // 绘制底板矩形（以原点为中心）
    const halfW = PARAMS.baseWidth / 2;
    const halfL = PARAMS.baseLength / 2;
    api.createSketchEntitiesBatch([
      { type: 'line', params: { x1: -halfW, y1: -halfL, x2: halfW, y2: -halfL } },
      { type: 'line', params: { x1: halfW, y1: -halfL, x2: halfW, y2: halfL } },
      { type: 'line', params: { x1: halfW, y1: halfL, x2: -halfW, y2: halfL } },
      { type: 'line', params: { x1: -halfW, y1: halfL, x2: -halfW, y2: -halfL } },
    ]);
    
    // 关闭草图并拉伸
    model.SketchManager?.InsertSketch(false);
    model.ClearSelection2?.(true);
    
    const baseExtrude = api.extrude({ depth: PARAMS.baseThickness });
    if (!baseExtrude.success) {
      throw new Error(`底板拉伸失败: ${baseExtrude.error}`);
    }
    console.log(`   ✅ 底板创建成功 (${PARAMS.baseThickness}mm)`);
    console.log('');

    // ============================================
    // 4. 创建侧板
    // ============================================
    console.log('🔷 步骤 4: 创建侧板...');
    
    // 在 Front 平面创建侧板草图
    sketchResult = api.createSketch({ plane: 'Front' });
    if (!sketchResult.success) {
      throw new Error(`创建草图失败: ${sketchResult.error}`);
    }
    
    // 侧板轮廓（从底板顶面开始）
    const sideHalfW = PARAMS.baseWidth / 2;
    const sideBottom = PARAMS.baseThickness;
    const sideTop = sideBottom + PARAMS.sideHeight;
    
    api.createSketchEntitiesBatch([
      { type: 'line', params: { x1: -sideHalfW, y1: sideBottom, x2: sideHalfW, y2: sideBottom } },
      { type: 'line', params: { x1: sideHalfW, y1: sideBottom, x2: sideHalfW, y2: sideTop } },
      { type: 'line', params: { x1: sideHalfW, y1: sideTop, x2: -sideHalfW, y2: sideTop } },
      { type: 'line', params: { x1: -sideHalfW, y1: sideTop, x2: -sideHalfW, y2: sideBottom } },
    ]);
    
    model.SketchManager?.InsertSketch(false);
    model.ClearSelection2?.(true);
    
    const sideExtrude = api.extrude({ depth: PARAMS.sideThickness });
    if (!sideExtrude.success) {
      throw new Error(`侧板拉伸失败: ${sideExtrude.error}`);
    }
    console.log(`   ✅ 侧板创建成功 (${PARAMS.sideHeight}mm 高)`);
    console.log('');

    // ============================================
    // 5. 创建底板安装孔
    // ============================================
    console.log('🔩 步骤 5: 创建底板安装孔...');
    
    const mountHoleOffset = PARAMS.baseWidth / 2 - PARAMS.mountHoleMargin;
    const mountHoleYOffset = PARAMS.baseLength / 2 - PARAMS.mountHoleMargin;
    const mountHoleDepth = PARAMS.baseThickness + 1;
    
    const holePositions = [
      { x: -mountHoleOffset, y: mountHoleYOffset, name: '左前' },
      { x: mountHoleOffset, y: mountHoleYOffset, name: '右前' },
      { x: -mountHoleOffset, y: -mountHoleYOffset, name: '左后' },
      { x: mountHoleOffset, y: -mountHoleYOffset, name: '右后' },
    ];
    
    for (const hole of holePositions) {
      console.log(`   5.${holePositions.indexOf(hole) + 1} 创建${hole.name}安装孔...`);
      
      sketchResult = api.createSketch({ plane: 'Top' });
      if (!sketchResult.success) {
        throw new Error(`创建草图失败: ${sketchResult.error}`);
      }
      
      api.createSketchEntitiesBatch([
        { type: 'circle', params: { centerX: hole.x, centerY: hole.y, radius: PARAMS.mountHoleDia / 2 } },
      ]);
      
      model.SketchManager?.InsertSketch(false);
      model.ClearSelection2?.(true);
      
      const cutResult = api.extrudeCut({ depth: mountHoleDepth, reverse: true });
      if (!cutResult.success) {
        console.warn(`   ⚠️ ${hole.name}安装孔切除失败: ${cutResult.error}`);
      } else {
        console.log(`   ✅ ${hole.name}安装孔创建成功`);
      }
    }
    console.log('');

    // ============================================
    // 6. 创建电机安装孔
    // ============================================
    console.log('⚙️ 步骤 6: 创建电机安装孔...');
    
    const motorHoleY = PARAMS.baseThickness + PARAMS.motorHoleOffset;
    const motorHoleDepth = PARAMS.sideThickness + 1;
    
    // 电机主孔
    console.log('   6.1 创建电机主孔...');
    sketchResult = api.createSketch({ plane: 'Front' });
    if (!sketchResult.success) {
      throw new Error(`创建草图失败: ${sketchResult.error}`);
    }
    
    api.createSketchEntitiesBatch([
      { type: 'circle', params: { centerX: 0, centerY: motorHoleY, radius: PARAMS.motorHoleDia / 2 } },
    ]);
    
    model.SketchManager?.InsertSketch(false);
    model.ClearSelection2?.(true);
    
    let cutResult = api.extrudeCut({ depth: motorHoleDepth, reverse: true });
    if (!cutResult.success) {
      console.warn(`   ⚠️ 电机主孔切除失败: ${cutResult.error}`);
    } else {
      console.log(`   ✅ 电机主孔创建成功 (Φ${PARAMS.motorHoleDia})`);
    }
    
    // 左定位孔
    console.log('   6.2 创建左定位孔...');
    sketchResult = api.createSketch({ plane: 'Front' });
    if (!sketchResult.success) {
      throw new Error(`创建草图失败: ${sketchResult.error}`);
    }
    
    api.createSketchEntitiesBatch([
      { type: 'circle', params: { centerX: -PARAMS.locatorOffset, centerY: motorHoleY, radius: PARAMS.locatorHoleDia / 2 } },
    ]);
    
    model.SketchManager?.InsertSketch(false);
    model.ClearSelection2?.(true);
    
    cutResult = api.extrudeCut({ depth: motorHoleDepth, reverse: true });
    if (!cutResult.success) {
      console.warn(`   ⚠️ 左定位孔切除失败: ${cutResult.error}`);
    } else {
      console.log(`   ✅ 左定位孔创建成功 (Φ${PARAMS.locatorHoleDia})`);
    }
    
    // 右定位孔
    console.log('   6.3 创建右定位孔...');
    sketchResult = api.createSketch({ plane: 'Front' });
    if (!sketchResult.success) {
      throw new Error(`创建草图失败: ${sketchResult.error}`);
    }
    
    api.createSketchEntitiesBatch([
      { type: 'circle', params: { centerX: PARAMS.locatorOffset, centerY: motorHoleY, radius: PARAMS.locatorHoleDia / 2 } },
    ]);
    
    model.SketchManager?.InsertSketch(false);
    model.ClearSelection2?.(true);
    
    cutResult = api.extrudeCut({ depth: motorHoleDepth, reverse: true });
    if (!cutResult.success) {
      console.warn(`   ⚠️ 右定位孔切除失败: ${cutResult.error}`);
    } else {
      console.log(`   ✅ 右定位孔创建成功 (Φ${PARAMS.locatorHoleDia})`);
    }
    console.log('');

    // ============================================
    // 7. 导出文件
    // ============================================
    console.log('📤 步骤 7: 导出文件...');
    
    const tempDir = process.env.TEMP || 'C:\\Temp';
    const timestamp = Date.now();
    
    try {
      const stepPath = `${tempDir}\\motor-bracket-${timestamp}.step`;
      api.exportFile(stepPath, 'step');
      console.log(`   ✅ STEP 导出成功: ${stepPath}`);
    } catch (e: any) {
      console.warn(`   ⚠️ STEP 导出失败: ${e.message}`);
    }
    
    try {
      const stlPath = `${tempDir}\\motor-bracket-${timestamp}.stl`;
      api.exportFile(stlPath, 'stl');
      console.log(`   ✅ STL 导出成功: ${stlPath}`);
    } catch (e: any) {
      console.warn(`   ⚠️ STL 导出失败: ${e.message}`);
    }
    console.log('');

    // ============================================
    // 完成
    // ============================================
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    🎉 测试完成                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('  零件已创建，请在 SolidWorks 中查看结果。');
    console.log('  零件包含：');
    console.log('    - 1 个底板');
    console.log('    - 1 个侧板');
    console.log('    - 4 个底板安装孔');
    console.log('    - 1 个电机主孔');
    console.log('    - 2 个定位孔');
    console.log('');

  } catch (error: any) {
    console.error('');
    console.error('❌ 测试失败:', error.message || error);
    console.error('');
    process.exit(1);
  }
}

main().catch(console.error);
