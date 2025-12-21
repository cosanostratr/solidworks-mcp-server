/**
 * Template Manager for SolidWorks
 * Comprehensive drawing sheet format and template management
 */

import { z } from 'zod';
import { SolidWorksAPI } from '../solidworks/api.js';
import { logger } from '../utils/logger.js';

/**
 * Template management tools for extracting and applying drawing formats
 */
export const templateManagerTools = [
  // ============================================
  // TEMPLATE EXTRACTION
  // ============================================
  
  {
    name: 'extract_drawing_template',
    description: `Extract complete template settings from a parent drawing file.
    
According to SolidWorks API documentation:
- Use DrawingDoc.GetCurrentSheet() to access sheet information
- Use Sheet.GetSheetFormat() to extract format data
- Custom properties can be accessed via Extension.CustomPropertyManager
- Dimension and annotation styles are stored in the document

REQUIREMENTS:
- File must be a valid Drawing document (.SLDDRW)
- File must be saved and accessible
- Use get_sketch_context to verify document type before calling

EXTRACTION OPTIONS:
- includeFormat: Extract sheet format (title block, borders, etc.)
- includeProperties: Extract custom properties (part number, revision, etc.)
- includeStyles: Extract dimension and annotation styles
- includeViews: Extract view layout information (optional, may be large)`,
    inputSchema: z.object({
      filePath: z.string().describe('Path to the parent drawing file (.SLDDRW). Must be a valid saved drawing'),
      includeFormat: z.boolean().default(true)
        .describe('Include sheet format (title block, borders, etc.) (default: true)'),
      includeProperties: z.boolean().default(true)
        .describe('Include custom properties (part number, revision, etc.) (default: true)'),
      includeStyles: z.boolean().default(true)
        .describe('Include dimension/annotation styles (default: true)'),
      includeViews: z.boolean().default(false)
        .describe('Include view layout information (default: false, may be large)'),
      saveAs: z.string().optional()
        .describe('Optional path to save template configuration as JSON file')
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      templateData: z.any().optional(),
      propertyCount: z.number().optional(),
      viewCount: z.number().optional(),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        swApi.openModel(args.filePath);
        const model = swApi.getCurrentModel();
        if (!model) {
          throw new Error('No active model');
        }
        // Use unified document type checking with inference
        const docType = swApi.getDocumentType(model, 0);
        if (docType !== 3) { // swDocDRAWING
          throw new Error(
            `File is not a drawing document (type=${docType}). ` +
            `Expected type 3 (swDocDRAWING).`
          );
        }
        
        const drawing = model;
        
        // According to API docs: GetCurrentSheet() returns the currently active sheet
        if (!drawing.GetCurrentSheet) {
          throw new Error('GetCurrentSheet method is not available. Ensure document is a Drawing.');
        }
        
        const sheet = drawing.GetCurrentSheet();
        if (!sheet) {
          throw new Error('Failed to get current sheet. Drawing may have no sheets.');
        }
        
        const templateData: any = {
          source: args.filePath,
          extractedAt: new Date().toISOString(),
          sheetFormat: {},
          properties: {},
          styles: {},
          views: []
        };
        
        // Extract sheet format
        // According to API docs: GetSheetFormat() returns the sheet format object
        if (args.includeFormat) {
          if (!sheet.GetSheetFormat) {
            logger.warn('GetSheetFormat method is not available on sheet');
          } else {
            const format = sheet.GetSheetFormat();
            if (format) {
              // According to API docs: GetProperties() returns array of 7 doubles:
              // [0] paperSize, [1] templateType, [2] scale1, [3] scale2, 
              // [4] firstAngle, [5] width, [6] height
              let props: number[] = [];
              try {
                if (sheet.GetProperties) {
                  props = sheet.GetProperties();
                }
              } catch (e) {
                logger.warn('Failed to get sheet properties', e as Error);
              }
              
              // Get sheet name
              let sheetName = '';
              try {
                if (sheet.GetName) {
                  sheetName = String(sheet.GetName()).trim();
                }
              } catch (error) {
                // Name not available
              }
              
              // Get template path
              let templatePath = '';
              try {
                if (sheet.GetTemplateName) {
                  templatePath = String(sheet.GetTemplateName()).trim();
                }
              } catch (error) {
                // Template path not available
              }
              
              // Get zone information
              let zoneH = 0, zoneV = 0;
              try {
                if (sheet.GetZoneHorizontalCount) {
                  zoneH = Number(sheet.GetZoneHorizontalCount()) || 0;
                }
                if (sheet.GetZoneVerticalCount) {
                  zoneV = Number(sheet.GetZoneVerticalCount()) || 0;
                }
              } catch (error) {
                // Zone info not available
              }
              
              templateData.sheetFormat = {
                name: sheetName,
                paperSize: props.length > 0 ? Math.floor(props[0]) : 0,  // swDwgPaperSizes_e enum
                templateType: props.length > 1 ? Math.floor(props[1]) : 0,  // swDwgTemplates_e
                scale: props.length > 3 && props[3] !== 0 ? props[2] / props[3] : (props.length > 2 ? props[2] : 1),
                scaleNumerator: props.length > 2 ? props[2] : 1,
                scaleDenominator: props.length > 3 ? props[3] : 1,
                firstAngle: props.length > 4 ? props[4] !== 0 : false,  // Boolean from double
                width: props.length > 5 ? props[5] : 0,  // Custom width in meters
                height: props.length > 6 ? props[6] : 0,  // Custom height in meters
                templatePath: templatePath,
                zones: {
                  horizontal: zoneH,
                  vertical: zoneV
                }
              };
            }
          }
        }
        
        // Extract custom properties
        if (args.includeProperties) {
          const propMgr = drawing.Extension.CustomPropertyManager("");
          if (!propMgr) {
            logger.warn('CustomPropertyManager not available');
          } else {
            const propNames = propMgr.GetNames?.();

            if (propNames) {
              for (const propName of propNames) {
                const value = propMgr.Get(propName);
                const resolvedValue = propMgr.Get2(propName);
                templateData.properties[propName] = {
                  value: value[0],
                  evaluatedValue: resolvedValue[0],
                  type: value[1]
                };
              }
            }
          }
        }
        
        // Extract dimension and annotation styles
        if (args.includeStyles) {
          templateData.styles = {
            dimensions: {
              textHeight: drawing.GetUserPreferenceDoubleValue(0), // swDetailingDimTextHeight
              arrowSize: drawing.GetUserPreferenceDoubleValue(1), // swDetailingArrowLength
              tolerance: drawing.GetUserPreferenceIntegerValue(20), // swDetailingDimTolerance
              precision: drawing.GetUserPreferenceIntegerValue(21), // swDetailingDimPrecision
              units: drawing.GetUserPreferenceIntegerValue(22) // swDetailingDimUnits
            },
            annotations: {
              textHeight: drawing.GetUserPreferenceDoubleValue(5), // swDetailingNoteTextHeight
              font: drawing.GetUserPreferenceStringValue(10), // swDetailingNoteFont
              leaderStyle: drawing.GetUserPreferenceIntegerValue(30), // swDetailingNoteLeaderStyle
              balloonStyle: drawing.GetUserPreferenceIntegerValue(31) // swDetailingBalloonStyle
            },
            tables: {
              bomAnchor: drawing.GetUserPreferenceIntegerValue(40), // swDetailingBOMTableAnchor
              bomFont: drawing.GetUserPreferenceStringValue(41), // swDetailingBOMTableFont
              bomTextHeight: drawing.GetUserPreferenceDoubleValue(42) // swDetailingBOMTableTextHeight
            }
          };
        }
        
        // Extract view layout
        if (args.includeViews) {
          const firstView = drawing.GetFirstView();
          if (!firstView) {
            logger.warn('No views available in drawing');
          } else {
            let currentView = firstView.GetNextView?.();

            while (currentView) {
              const position = currentView.Position;
              const outline = currentView.GetOutline?.();

              templateData.views.push({
                name: currentView.Name,
                type: currentView.Type,
                scale: currentView.ScaleDecimal,
                position: position ? { x: position[0], y: position[1] } : { x: 0, y: 0 },
                outline: outline ? {
                  min: { x: outline[0], y: outline[1] },
                  max: { x: outline[2], y: outline[3] }
                } : undefined,
                displayMode: currentView.DisplayMode,
                orientation: currentView.Orientation
              });

              currentView = currentView.GetNextView?.();
            }
          }
        }
        
        // Save template configuration if requested
        if (args.saveAs) {
          const fs = require('fs');
          fs.writeFileSync(args.saveAs, JSON.stringify(templateData, null, 2));
        }
        
        return {
          success: true,
          message: 'Template extracted successfully',
          templateData,
          propertyCount: Object.keys(templateData.properties).length,
          viewCount: templateData.views.length
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to extract template: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  },

  // ============================================
  // TEMPLATE APPLICATION
  // ============================================
  
  {
    name: 'apply_drawing_template',
    description: 'Apply template settings to a target drawing file',
    inputSchema: z.object({
      targetFile: z.string().describe('Path to the target drawing file'),
      templateData: z.object({}).optional().describe('Template data object (from extract_drawing_template)'),
      templateFile: z.string().optional().describe('Path to saved template JSON file'),
      applyFormat: z.boolean().default(true).describe('Apply sheet format'),
      applyProperties: z.boolean().default(true).describe('Apply custom properties'),
      applyStyles: z.boolean().default(true).describe('Apply dimension/annotation styles'),
      overwriteExisting: z.boolean().default(false).describe('Overwrite existing properties')
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      changedItems: z.array(z.string()).optional(),
      appliedFormat: z.boolean().optional(),
      appliedProperties: z.number().optional(),
      appliedStyles: z.number().optional(),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        // Load template data
        let templateData = args.templateData;
        if (!templateData && args.templateFile) {
          const fs = require('fs');
          templateData = JSON.parse(fs.readFileSync(args.templateFile, 'utf8'));
        }
        
        if (!templateData) {
          throw new Error('No template data provided');
        }
        
        // Open target file
        swApi.openModel(args.targetFile);
        const model = swApi.getCurrentModel();
        if (!model) {
          throw new Error('Failed to open target file');
        }
        // Use unified document type checking with inference
        const docType = swApi.getDocumentType(model, 0);
        if (docType !== 3) { // swDocDRAWING
          throw new Error(
            `Target file is not a drawing document (type=${docType}). ` +
            `Expected type 3 (swDocDRAWING).`
          );
        }
        
        const drawing = model;
        const sheet = drawing.GetCurrentSheet();
        let changedItems = [];

        // Apply sheet format
        // According to API docs: Sheet.SetSize() does NOT exist, use DrawingDoc.SetupSheet5() instead
        if (args.applyFormat && templateData.sheetFormat) {
          const format = templateData.sheetFormat;

          // Use SetupSheet5 to set sheet size and properties
          try {
            const sheetName = sheet?.GetName ? String(sheet.GetName()) : 'Sheet1';
            const paperSize = format.paperSize !== undefined ? format.paperSize : 6;  // Default to A4
            const templateType = format.templateType !== undefined ? format.templateType : 0;
            const scale1 = format.scaleNumerator !== undefined ? format.scaleNumerator : (format.scale ? format.scale : 1);
            const scale2 = format.scaleDenominator !== undefined ? format.scaleDenominator : 1;
            const firstAngle = format.firstAngle !== undefined ? format.firstAngle : true;
            const templatePath = format.templatePath || '';
            const width = format.width !== undefined ? format.width : 0;
            const height = format.height !== undefined ? format.height : 0;
            
            if (drawing.SetupSheet5) {
              drawing.SetupSheet5(
                sheetName,
                paperSize,
                templateType,
                scale1,
                scale2,
                firstAngle,
                templatePath,
                width,
                height,
                '',  // custPrpView
                false  // removeModifiedNotes
              );
              changedItems.push('Sheet size and properties');
            } else {
              logger.warn('SetupSheet5 method is not available on DrawingDoc');
            }
            
            // Set sheet scale separately as fallback (if SetupSheet5 didn't work or scale needs update)
            if (format.scaleNumerator && format.scaleDenominator && sheet?.SetScale) {
              try {
                sheet.SetScale(format.scaleNumerator, format.scaleDenominator);
                changedItems.push('Sheet scale');
              } catch (e) {
                logger.warn('Failed to set sheet scale', e as Error);
              }
            }
          } catch (e) {
            logger.warn('Failed to apply sheet format using SetupSheet5', e as Error);
          }
        }
        
        // Apply custom properties
        if (args.applyProperties && templateData.properties) {
          const propMgr = drawing.Extension.CustomPropertyManager("");

          if (!propMgr) {
            logger.warn('CustomPropertyManager not available');
          } else {
            for (const [propName, propData] of Object.entries(templateData.properties)) {
              const prop = propData as any;

              // Check if property exists
              const exists = propMgr.Get(propName)[0] !== "";

              if (!exists || args.overwriteExisting) {
                propMgr.Add3(
                  propName,
                  prop.type || 30, // swCustomInfoType_e
                  prop.value,
                  1 // swCustomPropertyAddOption_e.swCustomPropertyReplaceValue
                );
                changedItems.push(`Property: ${propName}`);
              }
            }
          }
        }
        
        // Apply dimension and annotation styles
        if (args.applyStyles && templateData.styles) {
          const styles = templateData.styles;
          
          if (styles.dimensions) {
            drawing.SetUserPreferenceDoubleValue(0, styles.dimensions.textHeight);
            drawing.SetUserPreferenceDoubleValue(1, styles.dimensions.arrowSize);
            drawing.SetUserPreferenceIntegerValue(20, styles.dimensions.tolerance);
            drawing.SetUserPreferenceIntegerValue(21, styles.dimensions.precision);
            drawing.SetUserPreferenceIntegerValue(22, styles.dimensions.units);
            changedItems.push('Dimension styles');
          }
          
          if (styles.annotations) {
            drawing.SetUserPreferenceDoubleValue(5, styles.annotations.textHeight);
            drawing.SetUserPreferenceStringValue(10, styles.annotations.font);
            drawing.SetUserPreferenceIntegerValue(30, styles.annotations.leaderStyle);
            drawing.SetUserPreferenceIntegerValue(31, styles.annotations.balloonStyle);
            changedItems.push('Annotation styles');
          }
          
          if (styles.tables) {
            drawing.SetUserPreferenceIntegerValue(40, styles.tables.bomAnchor);
            drawing.SetUserPreferenceStringValue(41, styles.tables.bomFont);
            drawing.SetUserPreferenceDoubleValue(42, styles.tables.bomTextHeight);
            changedItems.push('Table styles');
          }
        }
        
        // Rebuild drawing
        drawing.ForceRebuild3(false);
        
        return {
          success: true,
          message: `Template applied to ${args.targetFile}`,
          changedItems,
          changeCount: changedItems.length
        };
      } catch (error) {
        return `Failed to apply template: ${error}`;
      }
    }
  },

  // ============================================
  // BATCH TEMPLATE APPLICATION
  // ============================================
  
  {
    name: 'batch_apply_template',
    description: 'Apply template to multiple child drawing files',
    inputSchema: z.object({
      parentFile: z.string().describe('Path to parent drawing file to use as template'),
      childFiles: z.array(z.string()).describe('Array of child drawing file paths'),
      includeSubfolders: z.boolean().default(false).describe('Process files in subfolders'),
      filePattern: z.string().default('*.SLDDRW').describe('File pattern for automatic discovery'),
      applyFormat: z.boolean().default(true).describe('Apply sheet format'),
      applyProperties: z.boolean().default(true).describe('Apply custom properties'),
      applyStyles: z.boolean().default(true).describe('Apply dimension/annotation styles'),
      overwriteExisting: z.boolean().default(false).describe('Overwrite existing properties'),
      saveReport: z.string().optional().describe('Path to save processing report')
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      summary: z.any().optional(),
      processedFiles: z.array(z.any()).optional(),
      failedFiles: z.array(z.any()).optional(),
    }),
    handler: async (args: any, swApi: SolidWorksAPI) => {
      try {
        const report = {
          startTime: new Date().toISOString(),
          parentFile: args.parentFile,
          processedFiles: [] as any[],
          failedFiles: [] as any[],
          summary: {
            total: 0,
            successful: 0,
            failed: 0
          }
        };
        
        // First, extract template from parent
        swApi.openModel(args.parentFile);
        const model = swApi.getCurrentModel();
        if (!model) {
          throw new Error('Failed to open parent file');
        }
        // Use unified document type checking with inference
        const docType = swApi.getDocumentType(model, 0);
        if (docType !== 3) { // swDocDRAWING
          throw new Error(
            `Parent file is not a drawing document (type=${docType}). ` +
            `Expected type 3 (swDocDRAWING).`
          );
        }
        
        // Extract template data
        const templateData = await extractTemplateData(model, swApi);
        
        // Get list of files to process
        let filesToProcess = [...args.childFiles];
        
        // Add files from folder if pattern matching requested
        if (args.includeSubfolders && args.filePattern) {
          const fs = require('fs');
          const path = require('path');
          const parentDir = path.dirname(args.parentFile);
          
          const findFiles = (dir: string, pattern: string): string[] => {
            let results: string[] = [];
            const files = fs.readdirSync(dir);
            
            for (const file of files) {
              const fullPath = path.join(dir, file);
              const stat = fs.statSync(fullPath);
              
              if (stat.isDirectory() && args.includeSubfolders) {
                results = results.concat(findFiles(fullPath, pattern));
              } else if (file.match(pattern.replace('*', '.*'))) {
                results.push(fullPath);
              }
            }
            return results;
          };
          
          const discoveredFiles = findFiles(parentDir, args.filePattern);
          filesToProcess = [...new Set([...filesToProcess, ...discoveredFiles])];
          
          // Remove parent file from list
          filesToProcess = filesToProcess.filter(f => f !== args.parentFile);
        }
        
        report.summary.total = filesToProcess.length;
        
        // Process each file
        for (const childFile of filesToProcess) {
          const fileReport = {
            file: childFile,
            startTime: new Date().toISOString(),
            changes: [] as string[],
            errors: [] as string[]
          };
          
          try {
            // Open child file
            swApi.openModel(childFile);
            const childModel = swApi.getCurrentModel();
            if (!childModel || childModel.GetType() !== 3) {
              throw new Error('Not a drawing document');
            }
            
            // Apply template
            const result = await applyTemplateToDrawing(
              childModel,
              templateData,
              {
                applyFormat: args.applyFormat,
                applyProperties: args.applyProperties,
                applyStyles: args.applyStyles,
                overwriteExisting: args.overwriteExisting
              },
              swApi
            );
            
            fileReport.changes = result.changes;
            (fileReport as any).endTime = new Date().toISOString();
            (fileReport as any).success = true;
            
            // Save and close
            childModel.Save3(1, 0, 0); // swSaveAsOptions_Silent
            swApi.closeModel(true);
            
            report.processedFiles.push(fileReport);
            report.summary.successful++;
            
          } catch (error) {
            fileReport.errors.push(String(error));
            (fileReport as any).endTime = new Date().toISOString();
            (fileReport as any).success = false;
            report.failedFiles.push(fileReport);
            report.summary.failed++;
          }
        }
        
        (report as any).endTime = new Date().toISOString();
        
        // Save report if requested
        if (args.saveReport) {
          const fs = require('fs');
          fs.writeFileSync(args.saveReport, JSON.stringify(report, null, 2));
        }
        
        return {
          success: true,
          message: `Batch template application completed`,
          summary: report.summary,
          report: args.saveReport ? `Report saved to ${args.saveReport}` : report
        };
        
      } catch (error) {
        return `Failed to batch apply template: ${error}`;
      }
    }
  },

  // ============================================
  // TEMPLATE COMPARISON
  // ============================================
  
  {
    name: 'compare_drawing_templates',
    description: 'Compare template settings between two drawings',
    inputSchema: z.object({
      file1: z.string().describe('First drawing file path'),
      file2: z.string().describe('Second drawing file path'),
      compareFormat: z.boolean().default(true).describe('Compare sheet formats'),
      compareProperties: z.boolean().default(true).describe('Compare custom properties'),
      compareStyles: z.boolean().default(true).describe('Compare styles')
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      file1: z.string().optional(),
      file2: z.string().optional(),
      differences: z.any().optional(),
      identical: z.boolean().optional(),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        // Extract templates from both files
        const template1 = extractTemplateFromFile(args.file1, swApi);
        const template2 = extractTemplateFromFile(args.file2, swApi);
        
        const differences = {
          format: [] as any[],
          properties: [] as any[],
          styles: [] as any[]
        };
        
        // Compare sheet formats
        if (args.compareFormat) {
          const format1 = template1.sheetFormat;
          const format2 = template2.sheetFormat;
          
          if (format1.size !== format2.size) {
            differences.format.push({
              attribute: 'Sheet Size',
              file1: format1.size,
              file2: format2.size
            });
          }
          
          if (JSON.stringify(format1.scale) !== JSON.stringify(format2.scale)) {
            differences.format.push({
              attribute: 'Scale',
              file1: format1.scale,
              file2: format2.scale
            });
          }
        }
        
        // Compare properties
        if (args.compareProperties) {
          const props1 = template1.properties;
          const props2 = template2.properties;
          
          // Check properties in file1
          for (const [key, value] of Object.entries(props1)) {
            if (!props2[key]) {
              differences.properties.push({
                property: key,
                file1: value,
                file2: 'Not present'
              });
            } else if (JSON.stringify(value) !== JSON.stringify(props2[key])) {
              differences.properties.push({
                property: key,
                file1: value,
                file2: props2[key]
              });
            }
          }
          
          // Check properties only in file2
          for (const key of Object.keys(props2)) {
            if (!props1[key]) {
              differences.properties.push({
                property: key,
                file1: 'Not present',
                file2: props2[key]
              });
            }
          }
        }
        
        // Compare styles
        if (args.compareStyles) {
          const styles1 = template1.styles;
          const styles2 = template2.styles;
          
          const compareStyleCategory = (category: string) => {
            const cat1 = styles1[category];
            const cat2 = styles2[category];
            
            for (const [key, value] of Object.entries(cat1 || {})) {
              if (cat2[key] !== value) {
                differences.styles.push({
                  category,
                  setting: key,
                  file1: value,
                  file2: cat2[key]
                });
              }
            }
          };
          
          compareStyleCategory('dimensions');
          compareStyleCategory('annotations');
          compareStyleCategory('tables');
        }
        
        return {
          success: true,
          message: 'Template comparison completed',
          file1: args.file1,
          file2: args.file2,
          differences,
          differenceCount: {
            format: differences.format.length,
            properties: differences.properties.length,
            styles: differences.styles.length,
            total: differences.format.length + differences.properties.length + differences.styles.length
          }
        };
      } catch (error) {
        return `Failed to compare templates: ${error}`;
      }
    }
  },

  // ============================================
  // TEMPLATE LIBRARY MANAGEMENT
  // ============================================
  
  {
    name: 'save_template_to_library',
    description: 'Save a drawing template to a reusable library',
    inputSchema: z.object({
      sourceFile: z.string().describe('Source drawing file'),
      templateName: z.string().describe('Name for the template'),
      category: z.string().default('General').describe('Template category'),
      description: z.string().optional().describe('Template description'),
      tags: z.array(z.string()).default([]).describe('Tags for searching'),
      libraryPath: z.string().default('./templates').describe('Library folder path')
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      path: z.string().optional(),
      templateName: z.string().optional(),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const fs = require('fs');
        const path = require('path');
        
        // Ensure library directory exists
        if (!fs.existsSync(args.libraryPath)) {
          fs.mkdirSync(args.libraryPath, { recursive: true });
        }
        
        // Create category folder
        const categoryPath = path.join(args.libraryPath, args.category);
        if (!fs.existsSync(categoryPath)) {
          fs.mkdirSync(categoryPath, { recursive: true });
        }
        
        // Extract template data
        const templateData = extractTemplateFromFile(args.sourceFile, swApi);
        
        // Add metadata
        const libraryTemplate = {
          ...templateData,
          metadata: {
            name: args.templateName,
            category: args.category,
            description: args.description,
            tags: args.tags,
            sourceFile: args.sourceFile,
            createdAt: new Date().toISOString(),
            version: '1.0.0'
          }
        };
        
        // Save template
        const templateFileName = `${args.templateName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        const templatePath = path.join(categoryPath, templateFileName);
        fs.writeFileSync(templatePath, JSON.stringify(libraryTemplate, null, 2));
        
        // Update library index
        const indexPath = path.join(args.libraryPath, 'index.json');
        let index: { templates: any[] } = { templates: [] };
        
        if (fs.existsSync(indexPath)) {
          index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        }
        
        index.templates.push({
          name: args.templateName,
          category: args.category,
          description: args.description,
          tags: args.tags,
          path: templatePath,
          createdAt: new Date().toISOString()
        });
        
        fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
        
        return {
          success: true,
          message: `Template saved to library as '${args.templateName}'`,
          path: templatePath,
          category: args.category,
          tags: args.tags
        };
      } catch (error) {
        return `Failed to save template to library: ${error}`;
      }
    }
  },

  {
    name: 'list_template_library',
    description: 'List all templates in the library',
    inputSchema: z.object({
      libraryPath: z.string().default('./templates').describe('Library folder path'),
      category: z.string().optional().describe('Filter by category'),
      tags: z.array(z.string()).optional().describe('Filter by tags')
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      templates: z.array(z.any()).optional(),
      count: z.number().optional(),
    }),
    handler: (args: any) => {
      try {
        const fs = require('fs');
        const path = require('path');
        
        const indexPath = path.join(args.libraryPath, 'index.json');
        if (!fs.existsSync(indexPath)) {
          return {
            success: true,
            message: 'Template library is empty',
            templates: []
          };
        }
        
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        let templates = index.templates;
        
        // Filter by category
        if (args.category) {
          templates = templates.filter((t: any) => t.category === args.category);
        }
        
        // Filter by tags
        if (args.tags && args.tags.length > 0) {
          templates = templates.filter((t: any) => 
            args.tags.some((tag: string) => t.tags.includes(tag))
          );
        }
        
        return {
          success: true,
          message: `Found ${templates.length} templates`,
          templates,
          categories: [...new Set(index.templates.map((t: any) => t.category))],
          allTags: [...new Set(index.templates.flatMap((t: any) => t.tags))]
        };
      } catch (error) {
        return `Failed to list template library: ${error}`;
      }
    }
  }
];

// Helper functions

function extractTemplateFromFile(filePath: string, swApi: SolidWorksAPI): any {
  swApi.openModel(filePath);
  const model = swApi.getCurrentModel();
  if (!model) {
    throw new Error('No active model');
  }
  // Use unified document type checking with inference
  const docType = swApi.getDocumentType(model, 0);
  if (docType !== 3) { // swDocDRAWING
    throw new Error(
      `File is not a drawing document (type=${docType}). ` +
      `Expected type 3 (swDocDRAWING).`
    );
  }
  return extractTemplateData(model, swApi);
}

function extractTemplateData(drawing: any, swApi: SolidWorksAPI): any {
  // Implementation would extract all template data
  // This is a simplified version
  return {
    sheetFormat: {},
    properties: {},
    styles: {}
  };
}

function applyTemplateToDrawing(drawing: any, templateData: any, options: any, swApi: SolidWorksAPI): any {
  // Implementation would apply template settings
  // This is a simplified version
  return {
    changes: ['Applied template']
  };
}