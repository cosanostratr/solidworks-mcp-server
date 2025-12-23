# 集成测试

此目录包含需要真实 SolidWorks 环境的端到端集成测试。

## 测试文件

### `mcp-tools-comprehensive.test.ts`
MCP 工具综合测试，验证所有核心功能：
- 连接 SolidWorks
- 创建零件
- 草图操作（创建、绘制实体）
- 拉伸特征
- 切除拉伸
- 文件导出（STEP、STL）

### `motor-bracket.test.ts`
小型减速电机支架零件测试，演示真实零件建模流程：
- 底板拉伸
- 侧板拉伸
- 安装孔切除
- 电机孔及定位孔切除

## 运行方式

```bash
# 运行综合测试
npx tsx tests/integration/mcp-tools-comprehensive.test.ts

# 运行电机支架测试
npx tsx tests/integration/motor-bracket.test.ts
```

## 前置条件

1. SolidWorks 已安装并可正常启动
2. 项目依赖已安装 (`npm install`)
3. 项目已编译 (`npm run build`)

## 注意事项

- 这些测试会创建真实的 SolidWorks 文档
- 测试完成后文档会保持打开状态，方便查看结果
- 导出的文件会保存到系统临时目录

## 测试输出

测试会在控制台输出详细的执行日志，包括：
- 每个步骤的执行状态
- 创建的特征名称
- 导出的文件路径
- 错误信息（如有）

