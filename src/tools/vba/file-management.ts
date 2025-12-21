import { z } from 'zod';
import { SolidWorksAPI } from '../../solidworks/api.js';

// Common output schema for VBA tools
const vbaResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  vbaCode: z.string().optional(),
  linesOfCode: z.number().optional(),
});

/**
 * VBA Generation for File Management Operations
 * Comprehensive file operations and batch processing
 */

export const fileManagementVBATools = [
  {
    name: 'vba_batch_operations',
    description: 'Generate VBA for batch file operations',
    inputSchema: z.object({
      operation: z.enum([
        'open_all', 'save_all', 'export_all', 'convert_format',
        'update_references', 'pack_and_go', 'rename_files'
      ]),
      sourcePath: z.string().describe('Source folder path'),
      destinationPath: z.string().optional().describe('Destination folder path'),
      fileFilter: z.string().optional().describe('File filter (e.g., "*.sldprt")'),
      exportFormat: z.enum(['step', 'iges', 'stl', 'pdf', 'dwg', 'parasolid']).optional(),
      includeSubfolders: z.boolean().optional().default(false),
      options: z.record(z.any()).optional()
    }),
    outputSchema: vbaResultSchema,
    handler: (args: any) => {
      const operations: Record<string, string> = {
        open_all: `
Sub BatchOpenFiles()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim fso As Object
    Dim folder As Object
    Dim file As Object
    Dim filePath As String
    Dim errors As Long, warnings As Long
    Dim processedCount As Integer
    
    Set swApp = Application.SldWorks
    Set fso = CreateObject("Scripting.FileSystemObject")
    Set folder = fso.GetFolder("${args.sourcePath}")
    
    processedCount = 0
    
    ' Process each file
    For Each file In folder.Files
        If file.Name Like "${args.fileFilter || '*.sld*'}" Then
            filePath = file.Path
            
            ' Open file
            Set swModel = swApp.OpenDoc6( _
                filePath, _
                GetDocumentType(filePath), _
                swOpenDocOptions_e.swOpenDocOptions_Silent, _
                "", errors, warnings)
            
            If Not swModel Is Nothing Then
                processedCount = processedCount + 1
                Debug.Print "Opened: " & file.Name
            End If
        End If
    Next file
    
    ${args.includeSubfolders ? `
    ' Process subfolders
    Dim subfolder As Object
    For Each subfolder In folder.SubFolders
        ' Recursive call for subfolders
        ' Add recursive processing logic here
    Next subfolder` : ''}
    
    MsgBox "Batch open complete. Processed " & processedCount & " files"
End Sub

Function GetDocumentType(filePath As String) As Integer
    Dim ext As String
    ext = LCase(Right(filePath, 6))
    
    If InStr(ext, "sldprt") > 0 Then
        GetDocumentType = swDocumentTypes_e.swDocPART
    ElseIf InStr(ext, "sldasm") > 0 Then
        GetDocumentType = swDocumentTypes_e.swDocASSEMBLY
    ElseIf InStr(ext, "slddrw") > 0 Then
        GetDocumentType = swDocumentTypes_e.swDocDRAWING
    Else
        GetDocumentType = swDocumentTypes_e.swDocNONE
    End If
End Function`,
        export_all: `
Sub BatchExportFiles()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim fso As Object
    Dim folder As Object
    Dim file As Object
    Dim filePath As String
    Dim exportPath As String
    Dim errors As Long, warnings As Long
    Dim exportCount As Integer
    
    Set swApp = Application.SldWorks
    Set fso = CreateObject("Scripting.FileSystemObject")
    Set folder = fso.GetFolder("${args.sourcePath}")
    
    ' Create destination folder if needed
    If Not fso.FolderExists("${args.destinationPath || args.sourcePath + '\\Exported'}") Then
        fso.CreateFolder("${args.destinationPath || args.sourcePath + '\\Exported'}")
    End If
    
    exportCount = 0
    
    For Each file In folder.Files
        If file.Name Like "${args.fileFilter || '*.sld*'}" Then
            filePath = file.Path
            
            ' Open file
            Set swModel = swApp.OpenDoc6( _
                filePath, GetDocumentType(filePath), _
                swOpenDocOptions_e.swOpenDocOptions_Silent, _
                "", errors, warnings)
            
            If Not swModel Is Nothing Then
                ' Generate export path
                exportPath = "${args.destinationPath || args.sourcePath + '\\Exported'}\\" & _
                    fso.GetBaseName(file.Name) & ".${args.exportFormat || 'step'}"
                
                ' Export based on format
                ${args.exportFormat === 'step' ? `
                swModel.Extension.SaveAs3 exportPath, 0, _
                    swSaveAsOptions_e.swSaveAsOptions_Silent, _
                    Nothing, Nothing, errors, warnings` : ''}
                ${args.exportFormat === 'stl' ? `
                swModel.Extension.SaveAs3 exportPath, 0, _
                    swSaveAsOptions_e.swSaveAsOptions_Silent, _
                    Nothing, Nothing, errors, warnings` : ''}
                ${args.exportFormat === 'pdf' ? `
                Dim swExportPDFData As SldWorks.ExportPdfData
                Set swExportPDFData = swApp.GetExportFileData(swExportDataFileType_e.swExportPdfData)
                swModel.Extension.SaveAs3 exportPath, 0, _
                    swSaveAsOptions_e.swSaveAsOptions_Silent, _
                    swExportPDFData, Nothing, errors, warnings` : ''}
                
                exportCount = exportCount + 1
                Debug.Print "Exported: " & exportPath
                
                ' Close file
                swApp.CloseDoc swModel.GetPathName
            End If
        End If
    Next file
    
    MsgBox "Batch export complete. Exported " & exportCount & " files"
End Sub`,
        pack_and_go: `
Sub BatchPackAndGo()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swPackAndGo As SldWorks.PackAndGo
    Dim fso As Object
    Dim folder As Object
    Dim file As Object
    Dim filePath As String
    Dim errors As Long, warnings As Long
    Dim packCount As Integer
    
    Set swApp = Application.SldWorks
    Set fso = CreateObject("Scripting.FileSystemObject")
    Set folder = fso.GetFolder("${args.sourcePath}")
    
    packCount = 0
    
    For Each file In folder.Files
        If file.Name Like "${args.fileFilter || '*.sldasm'}" Then
            filePath = file.Path
            
            ' Open assembly
            Set swModel = swApp.OpenDoc6( _
                filePath, swDocumentTypes_e.swDocASSEMBLY, _
                swOpenDocOptions_e.swOpenDocOptions_Silent, _
                "", errors, warnings)
            
            If Not swModel Is Nothing Then
                ' Get Pack and Go
                Set swPackAndGo = swModel.Extension.GetPackAndGo
                
                ' Configure Pack and Go
                swPackAndGo.IncludeDrawings = ${args.options?.includeDrawings ? 'True' : 'False'}
                swPackAndGo.IncludeSimulationResults = ${args.options?.includeSimulation ? 'True' : 'False'}
                swPackAndGo.IncludeToolboxComponents = ${args.options?.includeToolbox ? 'True' : 'False'}
                swPackAndGo.FlattenToSingleFolder = ${args.options?.flattenFolders ? 'True' : 'False'}
                
                ' Set destination
                Dim destFolder As String
                destFolder = "${args.destinationPath || args.sourcePath + '\\PackAndGo'}\\" & _
                    fso.GetBaseName(file.Name)
                
                If Not fso.FolderExists(destFolder) Then
                    fso.CreateFolder(destFolder)
                End If
                
                swPackAndGo.SetSaveToName True, destFolder
                
                ' Execute Pack and Go
                Dim pgStatus As Long
                pgStatus = swModel.Extension.SavePackAndGo(swPackAndGo)
                
                If pgStatus = 0 Then
                    packCount = packCount + 1
                    Debug.Print "Packed: " & file.Name & " to " & destFolder
                End If
                
                swApp.CloseDoc swModel.GetPathName
            End If
        End If
    Next file
    
    MsgBox "Pack and Go complete. Processed " & packCount & " assemblies"
End Sub`
      };

      const vbaCode = operations[args.operation] || operations.open_all;
      return {
        success: true,
        message: 'Batch operations VBA code generated successfully',
        vbaCode,
        linesOfCode: vbaCode.split('\n').length,
      };
    }
  },

  {
    name: 'vba_custom_properties',
    description: 'Generate VBA for managing custom properties',
    inputSchema: z.object({
      operation: z.enum(['add', 'modify', 'delete', 'copy', 'export', 'import']),
      properties: z.array(z.object({
        name: z.string(),
        value: z.string(),
        type: z.enum(['text', 'date', 'number', 'yesno']).optional(),
        configuration: z.string().optional()
      })).optional(),
      sourcePath: z.string().optional(),
      templatePath: z.string().optional(),
      exportFormat: z.enum(['excel', 'csv', 'xml']).optional()
    }),
    outputSchema: vbaResultSchema,
    handler: (args: any) => {
      const vbaCode = `
Sub ManageCustomProperties_${args.operation}()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swCustPropMgr As SldWorks.CustomPropertyManager
    Dim propType As Long
    Dim propValue As String
    Dim evalValue As String
    Dim bRet As Boolean
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then
        MsgBox "No active document"
        Exit Sub
    End If
    
    ${args.operation === 'add' || args.operation === 'modify' ? `
    ' Add/Modify properties
    ${args.properties ? args.properties.map((prop: any) => `
    ' Get property manager for configuration
    Set swCustPropMgr = swModel.Extension.CustomPropertyManager("${prop.configuration || ''}")
    
    ' Determine property type
    ${prop.type === 'date' ? 'propType = swCustomInfoType_e.swCustomInfoDate' :
      prop.type === 'number' ? 'propType = swCustomInfoType_e.swCustomInfoNumber' :
      prop.type === 'yesno' ? 'propType = swCustomInfoType_e.swCustomInfoYesOrNo' :
      'propType = swCustomInfoType_e.swCustomInfoText'}
    
    ' Add or modify property
    bRet = swCustPropMgr.Add3( _
        "${prop.name}", _
        propType, _
        "${prop.value}", _
        swCustomPropertyAddOption_e.swCustomPropertyReplaceValue)
    
    If bRet Then
        Debug.Print "${args.operation === 'add' ? 'Added' : 'Modified'} property: ${prop.name} = ${prop.value}"
    End If`).join('\n    ') : ''}
    
    MsgBox "Properties ${args.operation === 'add' ? 'added' : 'modified'} successfully"` : ''}
    
    ${args.operation === 'delete' ? `
    ' Delete properties
    Set swCustPropMgr = swModel.Extension.CustomPropertyManager("")
    
    ${args.properties ? args.properties.map((prop: any) => `
    bRet = swCustPropMgr.Delete2("${prop.name}")
    If bRet Then
        Debug.Print "Deleted property: ${prop.name}"
    End If`).join('\n    ') : ''}
    
    MsgBox "Properties deleted"` : ''}
    
    ${args.operation === 'export' ? `
    ' Export properties to Excel
    Dim xlApp As Object
    Dim xlBook As Object
    Dim xlSheet As Object
    Dim propNames As Variant
    Dim i As Integer
    
    Set xlApp = CreateObject("Excel.Application")
    Set xlBook = xlApp.Workbooks.Add
    Set xlSheet = xlBook.Sheets(1)
    xlApp.Visible = True
    
    ' Headers
    xlSheet.Cells(1, 1).Value = "Property Name"
    xlSheet.Cells(1, 2).Value = "Value"
    xlSheet.Cells(1, 3).Value = "Evaluated Value"
    xlSheet.Cells(1, 4).Value = "Type"
    
    ' Get all properties
    Set swCustPropMgr = swModel.Extension.CustomPropertyManager("")
    propNames = swCustPropMgr.GetNames
    
    If Not IsEmpty(propNames) Then
        For i = 0 To UBound(propNames)
            swCustPropMgr.Get4 propNames(i), False, propValue, evalValue
            
            xlSheet.Cells(i + 2, 1).Value = propNames(i)
            xlSheet.Cells(i + 2, 2).Value = propValue
            xlSheet.Cells(i + 2, 3).Value = evalValue
            xlSheet.Cells(i + 2, 4).Value = swCustPropMgr.GetType2(propNames(i))
        Next i
    End If
    
    xlSheet.Columns.AutoFit
    
    ${args.sourcePath ? `
    xlBook.SaveAs "${args.sourcePath}"
    MsgBox "Properties exported to: ${args.sourcePath}"` : ''}` : ''}
    
    ${args.operation === 'copy' ? `
    ' Copy properties from another file
    Dim swSourceModel As SldWorks.ModelDoc2
    Dim swSourceCustPropMgr As SldWorks.CustomPropertyManager
    Dim errors As Long, warnings As Long
    
    ' Open source file
    Set swSourceModel = swApp.OpenDoc6( _
        "${args.sourcePath}", _
        GetDocumentType("${args.sourcePath}"), _
        swOpenDocOptions_e.swOpenDocOptions_Silent, _
        "", errors, warnings)
    
    If Not swSourceModel Is Nothing Then
        Set swSourceCustPropMgr = swSourceModel.Extension.CustomPropertyManager("")
        Set swCustPropMgr = swModel.Extension.CustomPropertyManager("")
        
        propNames = swSourceCustPropMgr.GetNames
        
        If Not IsEmpty(propNames) Then
            For i = 0 To UBound(propNames)
                swSourceCustPropMgr.Get4 propNames(i), False, propValue, evalValue
                propType = swSourceCustPropMgr.GetType2(propNames(i))
                
                swCustPropMgr.Add3 propNames(i), propType, propValue, _
                    swCustomPropertyAddOption_e.swCustomPropertyReplaceValue
                    
                Debug.Print "Copied property: " & propNames(i)
            Next i
        End If
        
        swApp.CloseDoc swSourceModel.GetPathName
        MsgBox "Properties copied from source file"
    End If` : ''}
End Sub`;
      return {
        success: true,
        message: 'Custom properties VBA code generated successfully',
        vbaCode,
        linesOfCode: vbaCode.split('\n').length,
      };
    }
  }
];