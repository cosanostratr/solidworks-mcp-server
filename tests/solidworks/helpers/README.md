# Extrusion Helpers 测试说明

## 测试文件

### 1. `extrusion.test.ts` - 单元测试（Mock测试）
- **用途**: 使用mock数据测试函数逻辑
- **优点**: 运行快速，不依赖外部环境
- **缺点**: 无法验证真实API调用是否正确
- **运行**: `npm test -- tests/solidworks/helpers/extrusion.test.ts`

### 2. `extrusion.integration.test.ts` - 集成测试（真实API测试）
- **用途**: 使用真实的SolidWorks API进行测试
- **优点**: 可以验证API调用是否正确，发现实际API问题
- **缺点**: 需要SolidWorks安装并运行
- **运行**: `npm test -- tests/solidworks/helpers/extrusion.integration.test.ts`

## 运行集成测试

### 前置条件
1. 确保SolidWorks已安装
2. 确保SolidWorks可以正常启动（不需要手动打开，测试会自动连接）

### 运行方式

```bash
# 运行所有集成测试
npm run test:integration

# 运行特定的集成测试文件
npm test -- tests/solidworks/helpers/extrusion.integration.test.ts

# 只运行单元测试（不运行集成测试）
npm run test:unit
```

### 测试行为

- **SolidWorks可用时**: 所有测试会正常执行，使用真实的SolidWorks API
- **SolidWorks不可用时**: 测试会优雅地跳过，不会失败

## 测试覆盖

### 单元测试覆盖
- ✅ 函数逻辑测试
- ✅ 错误处理测试
- ✅ 边界条件测试
- ✅ Mock数据验证

### 集成测试覆盖
- ✅ 真实API调用验证
- ✅ 实际SolidWorks操作
- ✅ 端到端工作流测试
- ✅ 多个操作序列测试

## 为什么需要两种测试？

1. **单元测试（Mock）**: 
   - 快速反馈
   - 测试函数逻辑
   - CI/CD中快速运行
   - 不依赖外部环境

2. **集成测试（真实API）**:
   - 验证API调用正确性
   - 发现API版本差异问题
   - 验证实际工作流
   - 确保代码在实际环境中工作

## 最佳实践

1. **开发时**: 先写单元测试，快速迭代
2. **提交前**: 运行集成测试，确保真实API调用正确
3. **CI/CD**: 可以只运行单元测试，集成测试作为可选步骤
4. **本地验证**: 定期运行集成测试，确保API兼容性

## 注意事项

- 集成测试会创建真实的SolidWorks文档，测试结束后会自动清理
- 如果SolidWorks正在使用中，测试可能会受到影响
- 集成测试运行时间较长，因为需要启动和操作SolidWorks

