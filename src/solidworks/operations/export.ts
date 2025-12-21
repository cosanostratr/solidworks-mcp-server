import { IModelDoc2, ISldWorksApp } from '../types/com-types.js';

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
      // Ensure the model is saved first
      const currentPath = model.GetPathName();
      if (!currentPath || currentPath === '') {
        // Save the model first if it hasn't been saved
        const docType = model.GetType();
        const ext = docType === 1 ? '.SLDPRT' : docType === 2 ? '.SLDASM' : '.SLDDRW';
        const tempPath = filePath.replace(/\.[^.]+$/, ext);
        model.SaveAs3(tempPath, 0, 1);
      }
      
      const ext = format.toLowerCase();
      let success = false;
      let errors = 0;
      let warnings = 0;
      
      // Try different export methods based on format
      switch(ext) {
        case 'step':
        case 'stp':
          try {
            success = model.SaveAs3(filePath, 0, 2);
            if (!success) {
              success = model.Extension.SaveAs(filePath, 0, 2, null, errors, warnings);
            }
          } catch (e) {
            try {
              const exportData = swApp?.GetExportFileData(1) as any;
              if (exportData && typeof exportData.SetStep203 === 'function') {
                exportData.SetStep203(true);
                success = model.Extension.SaveAs(filePath, 0, 2, exportData, errors, warnings);
              }
            } catch (e2) {
              throw new Error(`Failed to export to STEP: ${e2}`);
            }
          }
          break;
          
        case 'iges':
        case 'igs':
          try {
            success = model.SaveAs3(filePath, 0, 2);
            if (!success) {
              success = model.Extension.SaveAs(filePath, 0, 2, null, errors, warnings);
            }
          } catch (e) {
            throw new Error(`Failed to export to IGES: ${e}`);
          }
          break;
          
        case 'stl':
          try {
            success = model.SaveAs3(filePath, 0, 2);
            if (!success) {
              try {
                success = model.SaveAs4(filePath, 0, 2, errors, warnings);
              } catch (e2) {
                success = model.Extension.SaveAs(filePath, 0, 2, null, errors, warnings);
              }
            }
          } catch (e) {
            throw new Error(`Failed to export to STL: ${e}`);
          }
          break;
          
        case 'pdf':
          const docType = model.GetType();
          if (docType !== 3) {
            throw new Error('PDF export requires a drawing document');
          }
          try {
            success = model.SaveAs3(filePath, 0, 2);
            if (!success) {
              success = model.Extension.SaveAs(filePath, 0, 2, null, errors, warnings);
            }
          } catch (e) {
            throw new Error(`Failed to export to PDF: ${e}`);
          }
          break;
          
        case 'dxf':
        case 'dwg':
          try {
            success = model.SaveAs3(filePath, 0, 2);
            if (!success) {
              success = model.Extension.SaveAs(filePath, 0, 2, null, errors, warnings);
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

