import { IModelDoc2, ISldWorksApp } from '../types/com-types.js';
import * as path from 'path';
import * as fs from 'fs';

// SolidWorks 导出选项常量
const swSaveAsOptions = {
  swSaveAsOptions_Silent: 1,           // 静默保存，不显示对话框
  swSaveAsOptions_Copy: 2,             // 保存副本
  swSaveAsOptions_SaveReferenced: 4,   // 保存引用的文件
  swSaveAsOptions_AvoidRebuildOnSave: 8, // 避免保存时重建
};

// SolidWorks 导出数据类型常量
const swExportDataFileType = {
  swExportPdfData: 1,    // PDF 导出数据
  swExportSTEPData: 2,   // STEP 导出数据 (可能不存在)
  swExportSTLData: 3,    // STL 导出数据 (可能不存在)
};

/**
 * Export operations: export models to various formats
 */
export class ExportOperations {
  /**
   * Export model to specified format
   */
  static exportFile(
    swApp: ISldWorksApp | null,
    model: IModelDoc2 | null,
    filePath: string,
    format: string
  ): void {
    if (!model) throw new Error('No model open');
    
    try {
      // Normalize file path to absolute path
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
      const dir = path.dirname(absolutePath);
      
      // Ensure directory exists
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`  [DEBUG] exportFile: 创建目录: ${dir}`);
        }
      } catch (dirErr: any) {
        console.log(`  [DEBUG] exportFile: 创建目录失败: ${dirErr.message || dirErr}`);
        // Continue anyway
      }
      
      // Ensure the model is saved first (required for some export formats)
      const currentPath = model.GetPathName();
      if (!currentPath || currentPath === '') {
        // Save the model first if it hasn't been saved
        const docType = model.GetType();
        const ext = docType === 1 ? '.SLDPRT' : docType === 2 ? '.SLDASM' : '.SLDDRW';
        // Create a temporary save path in the same directory as export
        const tempName = `temp_${Date.now()}${ext}`;
        const tempPath = path.join(dir, tempName);
        
        try {
          // 使用 Extension.SaveAs3 保存临时文件
          if (model.Extension && model.Extension.SaveAs3) {
            const errorRef = { value: 0 };
            const warningRef = { value: 0 };
            const saveResult = model.Extension.SaveAs3(
              tempPath,
              0,  // version: 当前版本
              swSaveAsOptions.swSaveAsOptions_Silent,
              null,  // exportData
              errorRef,
              warningRef
            );
            if (saveResult) {
              console.log(`  [DEBUG] exportFile: 临时保存模型成功: ${tempPath}`);
            } else {
              console.log(`  [DEBUG] exportFile: 临时保存模型失败 (错误码: ${errorRef.value})，继续尝试导出`);
            }
          } else {
            // 回退到旧的 SaveAs3 方法
            const saveResult = model.SaveAs3(tempPath, 0, swSaveAsOptions.swSaveAsOptions_Silent);
            if (saveResult) {
              console.log(`  [DEBUG] exportFile: 临时保存模型成功: ${tempPath}`);
            } else {
              console.log(`  [DEBUG] exportFile: 临时保存模型失败，继续尝试导出`);
            }
          }
        } catch (saveErr: any) {
          console.log(`  [DEBUG] exportFile: 临时保存模型异常: ${saveErr.message || saveErr}`);
          // Continue anyway - some formats might work without saving
        }
      }
      
      // Rebuild model before export to ensure all features are up to date
      try {
        model.EditRebuild3();
      } catch (rebuildErr) {
        console.log(`  [DEBUG] exportFile: 重建模型失败，继续导出: ${rebuildErr}`);
      }
      
      // Use absolute path for export
      const exportPath = absolutePath;
      
      const ext = format.toLowerCase();
      let success = false;
      let errors = 0;
      let warnings = 0;
      
      switch(ext) {
        case 'step':
        case 'stp':
          try {
            console.log(`  [DEBUG] exportFile: 尝试导出 STEP 格式`);
            console.log(`  [DEBUG] exportFile: 导出路径: ${exportPath}`);
            
            // 方法1: 使用 Extension.SaveAs3 (推荐方法)
            // Extension.SaveAs3(fileName, version, options, exportData, errors, warnings)
            if (model.Extension && model.Extension.SaveAs3) {
              console.log(`  [DEBUG] exportFile: 方法1 - 使用 Extension.SaveAs3`);
              const errorRef = { value: 0 };
              const warningRef = { value: 0 };
              try {
                success = model.Extension.SaveAs3(
                  exportPath,
                  0,  // version: 当前版本
                  swSaveAsOptions.swSaveAsOptions_Silent,  // options: 静默模式
                  null,  // exportData: STEP 不需要特殊数据
                  errorRef,
                  warningRef
                );
                errors = errorRef.value;
                warnings = warningRef.value;
                console.log(`  [DEBUG] exportFile: Extension.SaveAs3 结果: ${success}, 错误码: ${errors}, 警告码: ${warnings}`);
              } catch (ext3Err: any) {
                console.log(`  [DEBUG] exportFile: Extension.SaveAs3 异常: ${ext3Err.message || ext3Err}`);
              }
            }
            
            // 方法2: 如果 Extension.SaveAs3 失败，尝试 Extension.SaveAs
            if (!success && model.Extension && model.Extension.SaveAs) {
              console.log(`  [DEBUG] exportFile: 方法2 - 使用 Extension.SaveAs`);
              const errorRef = { value: 0 };
              const warningRef = { value: 0 };
              try {
                success = model.Extension.SaveAs(
                  exportPath,
                  0,  // version
                  swSaveAsOptions.swSaveAsOptions_Silent,  // options
                  null,  // exportData
                  errorRef,
                  warningRef
                );
                errors = errorRef.value;
                warnings = warningRef.value;
                console.log(`  [DEBUG] exportFile: Extension.SaveAs 结果: ${success}, 错误码: ${errors}, 警告码: ${warnings}`);
              } catch (extErr: any) {
                console.log(`  [DEBUG] exportFile: Extension.SaveAs 异常: ${extErr.message || extErr}`);
              }
            }
            
            // 方法3: 尝试旧的 model.SaveAs3
            if (!success) {
              console.log(`  [DEBUG] exportFile: 方法3 - 使用 model.SaveAs3`);
              try {
                success = model.SaveAs3(exportPath, 0, swSaveAsOptions.swSaveAsOptions_Silent);
                console.log(`  [DEBUG] exportFile: model.SaveAs3 结果: ${success}`);
              } catch (sa3Err: any) {
                console.log(`  [DEBUG] exportFile: model.SaveAs3 异常: ${sa3Err.message || sa3Err}`);
              }
            }
            
            // 检查文件是否已创建（即使返回 false）
            if (!success && fs.existsSync(exportPath)) {
              const stat = fs.statSync(exportPath);
              if (stat.size > 0) {
                console.log(`  [DEBUG] exportFile: 导出返回 false，但文件已创建 (大小: ${stat.size} 字节)`);
                success = true;
              }
            }
          } catch (e: any) {
            console.log(`  [DEBUG] exportFile: STEP 导出异常: ${e.message || e}`);
            throw new Error(`Failed to export to STEP: ${e instanceof Error ? e.message : String(e)}`);
          }
          break;
          
        case 'iges':
        case 'igs':
          try {
            // 方法1: 使用 Extension.SaveAs3
            if (model.Extension && model.Extension.SaveAs3) {
              const errorRef = { value: 0 };
              const warningRef = { value: 0 };
              success = model.Extension.SaveAs3(
                exportPath,
                0,
                swSaveAsOptions.swSaveAsOptions_Silent,
                null,
                errorRef,
                warningRef
              );
              errors = errorRef.value;
              warnings = warningRef.value;
            }
            
            // 方法2: 回退到 Extension.SaveAs
            if (!success && model.Extension && model.Extension.SaveAs) {
              const errorRef = { value: 0 };
              const warningRef = { value: 0 };
              success = model.Extension.SaveAs(exportPath, 0, swSaveAsOptions.swSaveAsOptions_Silent, null, errorRef, warningRef);
              errors = errorRef.value;
              warnings = warningRef.value;
            }
            
            // 方法3: 回退到 model.SaveAs3
            if (!success) {
              success = model.SaveAs3(exportPath, 0, swSaveAsOptions.swSaveAsOptions_Silent);
            }
            
            // 检查文件是否已创建
            if (!success && fs.existsSync(exportPath)) {
              const stat = fs.statSync(exportPath);
              if (stat.size > 0) {
                success = true;
              }
            }
          } catch (e: any) {
            throw new Error(`Failed to export to IGES: ${e instanceof Error ? e.message : String(e)}`);
          }
          break;
          
        case 'stl':
          try {
            console.log(`  [DEBUG] exportFile: 尝试导出 STL 格式`);
            console.log(`  [DEBUG] exportFile: 导出路径: ${exportPath}`);
            
            // 方法1: 使用 Extension.SaveAs3 (推荐方法)
            if (model.Extension && model.Extension.SaveAs3) {
              console.log(`  [DEBUG] exportFile: 方法1 - 使用 Extension.SaveAs3`);
              const errorRef = { value: 0 };
              const warningRef = { value: 0 };
              try {
                success = model.Extension.SaveAs3(
                  exportPath,
                  0,  // version: 当前版本
                  swSaveAsOptions.swSaveAsOptions_Silent,  // options: 静默模式
                  null,  // exportData: STL 基本导出不需要特殊数据
                  errorRef,
                  warningRef
                );
                errors = errorRef.value;
                warnings = warningRef.value;
                console.log(`  [DEBUG] exportFile: Extension.SaveAs3 结果: ${success}, 错误码: ${errors}, 警告码: ${warnings}`);
              } catch (ext3Err: any) {
                console.log(`  [DEBUG] exportFile: Extension.SaveAs3 异常: ${ext3Err.message || ext3Err}`);
              }
            }
            
            // 方法2: 如果 Extension.SaveAs3 失败，尝试 Extension.SaveAs
            if (!success && model.Extension && model.Extension.SaveAs) {
              console.log(`  [DEBUG] exportFile: 方法2 - 使用 Extension.SaveAs`);
              const errorRef = { value: 0 };
              const warningRef = { value: 0 };
              try {
                success = model.Extension.SaveAs(
                  exportPath,
                  0,  // version
                  swSaveAsOptions.swSaveAsOptions_Silent,  // options
                  null,  // exportData
                  errorRef,
                  warningRef
                );
                errors = errorRef.value;
                warnings = warningRef.value;
                console.log(`  [DEBUG] exportFile: Extension.SaveAs 结果: ${success}, 错误码: ${errors}, 警告码: ${warnings}`);
              } catch (extErr: any) {
                console.log(`  [DEBUG] exportFile: Extension.SaveAs 异常: ${extErr.message || extErr}`);
              }
            }
            
            // 方法3: 尝试旧的 model.SaveAs3
            if (!success) {
              console.log(`  [DEBUG] exportFile: 方法3 - 使用 model.SaveAs3`);
              try {
                success = model.SaveAs3(exportPath, 0, swSaveAsOptions.swSaveAsOptions_Silent);
                console.log(`  [DEBUG] exportFile: model.SaveAs3 结果: ${success}`);
              } catch (sa3Err: any) {
                console.log(`  [DEBUG] exportFile: model.SaveAs3 异常: ${sa3Err.message || sa3Err}`);
              }
            }
            
            // 检查文件是否已创建（即使返回 false）
            if (!success && fs.existsSync(exportPath)) {
              const stat = fs.statSync(exportPath);
              if (stat.size > 0) {
                console.log(`  [DEBUG] exportFile: 导出返回 false，但文件已创建 (大小: ${stat.size} 字节)`);
                success = true;
              }
            }
          } catch (e: any) {
            console.log(`  [DEBUG] exportFile: STL 导出异常: ${e.message || e}`);
            throw new Error(`Failed to export to STL: ${e instanceof Error ? e.message : String(e)}`);
          }
          break;
          
        case 'pdf':
          const docType = model.GetType();
          if (docType !== 3) {
            throw new Error('PDF export requires a drawing document');
          }
          try {
            success = model.SaveAs3(exportPath, 0, 2);
            if (!success) {
              success = model.Extension.SaveAs(exportPath, 0, 2, null, errors, warnings);
            }
          } catch (e) {
            throw new Error(`Failed to export to PDF: ${e}`);
          }
          break;
          
        case 'dxf':
        case 'dwg':
          try {
            success = model.SaveAs3(exportPath, 0, 2);
            if (!success) {
              success = model.Extension.SaveAs(exportPath, 0, 2, null, errors, warnings);
            }
          } catch (e) {
            throw new Error(`Failed to export to ${format.toUpperCase()}: ${e}`);
          }
          break;
          
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
      if (!success) {
        throw new Error(`Failed to export to ${format.toUpperCase()}: Export returned false`);
      }
    } catch (error) {
      throw new Error(`Export failed: ${error}`);
    }
  }
}


