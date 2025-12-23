/**
 * MCP Tools 综合集成测试
 * 
 * 此测试验证所有核心 MCP 工具是否能正常工作：
 * - 连接 SolidWorks
 * - 创建零件
 * - 创建草图
 * - 绘制草图实体
 * - 拉伸特征
 * - 切除拉伸
 * - 导出文件
 * 
 * 运行方式：npx tsx tests/integration/mcp-tools-comprehensive.test.ts
 */

import { SolidWorksAPI } from '../../src/solidworks/api.js';

// 测试结果追踪
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void> | void): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`  ✅ ${name}`);
  } catch (error: any) {
    results.push({ 
      name, 
      passed: false, 
      error: error.message || String(error),
      duration: Date.now() - start 
    });
    console.log(`  ❌ ${name}: ${error.message || error}`);
  }
}

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       MCP Tools 综合集成测试                                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const api = new SolidWorksAPI();

  // ============================================
  // 1. 连接测试
  // ============================================
  console.log('📡 1. 连接测试');
  
  await runTest('connect - 连接到 SolidWorks', () => {
    api.connect();
    if (!api.isConnected()) throw new Error('连接失败');
  });

  await runTest('getApp - 获取应用实例', () => {
    const app = api.getApp();
    if (!app) throw new Error('无法获取应用实例');
    // RevisionNumber 是属性，不是方法
    const version = app.RevisionNumber;
    console.log(`    版本: ${version || 'N/A'}`);
  });
  console.log('');

  // ============================================
  // 2. 零件创建测试
  // ============================================
  console.log('📦 2. 零件创建测试');
  
  await runTest('create_part - 创建新零件', () => {
    const model = api.createPart();
    if (!model) throw new Error('创建零件失败');
  });
  console.log('');

  // ============================================
  // 3. 草图测试
  // ============================================
  console.log('✏️ 3. 草图测试');
  
  await runTest('create_sketch - 在 Top 平面创建草图', () => {
    const result = api.createSketch({ plane: 'Top' });
    if (!result.success) throw new Error(result.error || '创建草图失败');
  });

  await runTest('create_sketch_entities_batch - 批量创建草图实体', () => {
    api.createSketchEntitiesBatch([
      { type: 'line', params: { x1: 0, y1: 0, x2: 50, y2: 0 } },
      { type: 'line', params: { x1: 50, y1: 0, x2: 50, y2: 30 } },
      { type: 'line', params: { x1: 50, y1: 30, x2: 0, y2: 30 } },
      { type: 'line', params: { x1: 0, y1: 30, x2: 0, y2: 0 } },
    ]);
  });
  console.log('');

  // ============================================
  // 4. 拉伸测试
  // ============================================
  console.log('🔨 4. 拉伸测试');
  
  await runTest('extrude - 基础拉伸 (25mm)', () => {
    // 确保草图已关闭
    const model = api.getCurrentModel();
    if (model?.SketchManager) {
      model.SketchManager.InsertSketch(false);
    }
    model?.ClearSelection2?.(true);
    
    const result = api.extrude({ depth: 25 });
    if (!result.success) throw new Error(result.error || '拉伸失败');
    console.log(`    特征: ${result.featureId}`);
  });

  // 创建第二个拉伸（测试合并）
  await runTest('extrude - 附加拉伸 (15mm)', () => {
    const result = api.createSketch({ plane: 'Top' });
    if (!result.success) throw new Error('创建草图失败');
    
    // 在不同位置创建矩形
    api.createSketchEntitiesBatch([
      { type: 'line', params: { x1: 60, y1: 0, x2: 90, y2: 0 } },
      { type: 'line', params: { x1: 90, y1: 0, x2: 90, y2: 20 } },
      { type: 'line', params: { x1: 90, y1: 20, x2: 60, y2: 20 } },
      { type: 'line', params: { x1: 60, y1: 20, x2: 60, y2: 0 } },
    ]);
    
    const model = api.getCurrentModel();
    model?.SketchManager?.InsertSketch(false);
    model?.ClearSelection2?.(true);
    
    const extrudeResult = api.extrude({ depth: 15 });
    if (!extrudeResult.success) throw new Error(extrudeResult.error || '附加拉伸失败');
  });

  // 带拔模的拉伸
  await runTest('extrude_with_draft - 带拔模拉伸 (20mm, 5°)', () => {
    const result = api.createSketch({ plane: 'Top' });
    if (!result.success) throw new Error('创建草图失败');
    
    api.createSketchEntitiesBatch([
      { type: 'line', params: { x1: 100, y1: 0, x2: 130, y2: 0 } },
      { type: 'line', params: { x1: 130, y1: 0, x2: 130, y2: 20 } },
      { type: 'line', params: { x1: 130, y1: 20, x2: 100, y2: 20 } },
      { type: 'line', params: { x1: 100, y1: 20, x2: 100, y2: 0 } },
    ]);
    
    const model = api.getCurrentModel();
    model?.SketchManager?.InsertSketch(false);
    model?.ClearSelection2?.(true);
    
    const extrudeResult = api.extrude({ depth: 20, draft: 5 });
    if (!extrudeResult.success) throw new Error(extrudeResult.error || '拔模拉伸失败');
  });
  console.log('');

  // ============================================
  // 5. 切除拉伸测试
  // ============================================
  console.log('🕳️ 5. 切除拉伸测试');
  
  await runTest('extrude_cut - 切除圆孔', () => {
    const result = api.createSketch({ plane: 'Top' });
    if (!result.success) throw new Error('创建草图失败');
    
    // 在第一个矩形中心创建圆
    api.createSketchEntitiesBatch([
      { type: 'circle', params: { centerX: 25, centerY: 15, radius: 5 } },
    ]);
    
    const model = api.getCurrentModel();
    model?.SketchManager?.InsertSketch(false);
    model?.ClearSelection2?.(true);
    
    const cutResult = api.extrudeCut({ depth: 30, reverse: true });
    if (!cutResult.success) throw new Error(cutResult.error || '切除失败');
    console.log(`    特征: ${cutResult.featureId}`);
  });

  await runTest('extrude_cut - 切除矩形槽', () => {
    const result = api.createSketch({ plane: 'Top' });
    if (!result.success) throw new Error('创建草图失败');
    
    // 创建矩形槽
    api.createSketchEntitiesBatch([
      { type: 'line', params: { x1: 10, y1: 5, x2: 40, y2: 5 } },
      { type: 'line', params: { x1: 40, y1: 5, x2: 40, y2: 10 } },
      { type: 'line', params: { x1: 40, y1: 10, x2: 10, y2: 10 } },
      { type: 'line', params: { x1: 10, y1: 10, x2: 10, y2: 5 } },
    ]);
    
    const model = api.getCurrentModel();
    model?.SketchManager?.InsertSketch(false);
    model?.ClearSelection2?.(true);
    
    const cutResult = api.extrudeCut({ depth: 10, reverse: true });
    if (!cutResult.success) throw new Error(cutResult.error || '矩形槽切除失败');
  });
  console.log('');

  // ============================================
  // 6. 导出测试
  // ============================================
  console.log('📤 6. 导出测试');
  
  const tempDir = process.env.TEMP || 'C:\\Temp';
  const timestamp = Date.now();
  
  await runTest('export_step - 导出 STEP 文件', () => {
    const stepPath = `${tempDir}\\mcp-test-${timestamp}.step`;
    try {
      api.exportFile(stepPath, 'step');
      console.log(`    路径: ${stepPath}`);
    } catch (e: any) {
      throw new Error(`STEP 导出失败: ${e.message}`);
    }
  });

  await runTest('export_stl - 导出 STL 文件', () => {
    const stlPath = `${tempDir}\\mcp-test-${timestamp}.stl`;
    try {
      api.exportFile(stlPath, 'stl');
      console.log(`    路径: ${stlPath}`);
    } catch (e: any) {
      throw new Error(`STL 导出失败: ${e.message}`);
    }
  });
  console.log('');

  // ============================================
  // 7. 清理
  // ============================================
  console.log('🧹 7. 清理');
  
  await runTest('close_document - 关闭文档', () => {
    api.closeModel(false);
  });

  await runTest('disconnect - 断开连接', () => {
    api.disconnect();
  });
  console.log('');

  // ============================================
  // 测试结果汇总
  // ============================================
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                      测试结果汇总                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`  总计: ${total} | 通过: ${passed} | 失败: ${failed}`);
  console.log('');
  
  if (failed > 0) {
    console.log('  失败的测试:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`    ❌ ${r.name}`);
      console.log(`       ${r.error}`);
    });
    console.log('');
  }
  
  if (failed === 0) {
    console.log('  🎉 所有测试通过！');
  } else {
    console.log(`  ⚠️ ${failed} 个测试失败`);
    process.exit(1);
  }
}

main().catch(console.error);
