import { logger } from '../../utils/logger.js';
import { ISldWorksApp, IModelDoc2 } from '../types/com-types.js';
import { SolidWorksModel } from '../types/business-types.js';
import { ModelHelpers } from '../helpers/model.js';

/**
 * Model operations: open, close, create
 */
export class ModelOperations {
  /**
   * Open a model file
   */
  static openModel(
    swApp: ISldWorksApp | null,
    filePath: string
  ): { model: IModelDoc2; info: SolidWorksModel } {
    if (!swApp) throw new Error('Not connected to SolidWorks');
    
    const errors = { value: 0 };
    const warnings = { value: 0 };
    
    // Determine file type from extension
    const ext = filePath.toLowerCase().split('.').pop();
    let docType = 1; // swDocPART
    if (ext === 'sldasm') docType = 2; // swDocASSEMBLY
    if (ext === 'slddrw') docType = 3; // swDocDRAWING
    
    // Ensure all parameters are correct types
    const filePathStr = String(filePath);
    const docTypeNum = Number(docType);
    const options = 1; // swOpenDocOptions_Silent
    const configName = String('');
    const errorsRef = errors || { value: 0 };
    const warningsRef = warnings || { value: 0 };
    
    let currentModel: IModelDoc2 | null = null;
    try {
      currentModel = swApp.OpenDoc6(
        filePathStr,
        docTypeNum,
        options,
        configName,
        errorsRef,
        warningsRef
      );
    } catch (e) {
      // If OpenDoc6 fails, try OpenDoc5 (older method without config)
      try {
        currentModel = swApp.OpenDoc5(
          filePathStr,
          docTypeNum,
          options,
          errorsRef,
          warningsRef
        );
      } catch (e2) {
        throw new Error(`Failed to open model: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    
    if (!currentModel) {
      throw new Error(`Failed to open model: ${filePath}`);
    }
    
    // Ensure the opened model is set as active
    try {
      swApp.ActivateDoc2(currentModel.GetTitle(), false, errors);
    } catch (e) {
      // ActivateDoc2 might fail but model is still open
    }
    
    if (!currentModel) {
      throw new Error(`Failed to open model: ${filePath}`);
    }
    
    return {
      model: currentModel,
      info: {
        path: filePath,
        name: currentModel.GetTitle(),
        type: (['Part', 'Assembly', 'Drawing'][docType - 1] as 'Part' | 'Assembly' | 'Drawing'),
        isActive: true,
      },
    };
  }
  
  /**
   * Close a model
   */
  static closeModel(
    swApp: ISldWorksApp | null,
    model: IModelDoc2 | null,
    save: boolean = false
  ): void {
    if (!model) return;
    
    let modelTitle = '';
    try {
      // Safely get the title
      if (model.GetTitle) {
        modelTitle = model.GetTitle();
      } else if (model.GetPathName) {
        modelTitle = model.GetPathName();
      }
    } catch (e) {
      // If we can't get the title, continue anyway
      modelTitle = 'Unknown';
    }
    
    if (save) {
      try {
        model.Save3(1, 0, 0); // swSaveAsOptions_Silent
      } catch (e) {
        // Save might fail if document is new and has no path
        try {
          // Try Save instead
          model.Save();
        } catch (e2) {
          // Continue even if save fails
        }
      }
    }
    
    // Close using app method if title is available
    if (modelTitle && modelTitle !== 'Unknown' && swApp) {
      try {
        swApp.CloseDoc(modelTitle);
      } catch (e) {
        // Fallback: just clear the reference
      }
    }
  }
  
  /**
   * Create a new part document
   */
  static createPart(swApp: ISldWorksApp | null): { model: IModelDoc2; info: SolidWorksModel } {
    if (!swApp) throw new Error('Not connected to SolidWorks');
    
    // Create new part document - use NewPart() which works better
    let currentModel = swApp.NewPart();
    
    if (!currentModel) {
      // Fallback to NewDocument if NewPart fails
      const template = swApp.GetUserPreferenceStringValue(8) || '';
      if (template) {
        currentModel = swApp.NewDocument(template, 0, 0, 0);
      } else {
        throw new Error('Failed to create new part - no template available');
      }
    }
    
    if (!currentModel) {
      throw new Error('Failed to create new part');
    }
    
    return {
      model: currentModel,
      info: {
        path: '',
        name: currentModel.GetTitle() ?? 'Untitled',
        type: 'Part',
        isActive: true,
      },
    };
  }
}

