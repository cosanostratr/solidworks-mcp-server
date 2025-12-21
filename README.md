# SolidWorks MCP Server - Intelligent COM Bridge with Dynamic Fallback

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-green?logo=anthropic)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Windows](https://img.shields.io/badge/Windows-10%2F11-blue?logo=windows)](https://www.microsoft.com/windows)
[![SolidWorks](https://img.shields.io/badge/SolidWorks-2024-red)](https://www.solidworks.com/)

**The Most Intelligent Node.js-based SolidWorks Automation Solution**

🚀 **87 Tools** | 📦 **4 Resources** | 💡 **5 Prompts** | 🧠 **Intelligent COM Bridge** | ⚡ **Dynamic Fallback** | 🎯 **100% Feature Coverage**

</div>

> **🎉 New Release v1.0.0** - This is a complete redesign of the SolidWorks MCP Server with intelligent COM bridge architecture, comprehensive tool coverage, and production-ready features.

## 🔥 Breaking the COM Barrier

**Problem Solved:** Node.js COM bridges fail when calling SolidWorks methods with 13+ parameters. This affects critical features like extrusions, sweeps, and lofts.

**Our Solution:** Intelligent adapter architecture that automatically routes operations:
- **Simple operations (≤12 params)** → Direct COM (fast)
- **Complex operations (13+ params)** → Dynamic VBA macro generation (reliable)
- **Failed operations** → Automatic fallback with circuit breaker pattern

## 🎯 Quick Start

### Prerequisites
- Windows 10/11
- SolidWorks 2024 (licensed)
- Node.js 20+
- Claude Desktop or any MCP-compatible client

### Installation

```bash
# Clone the repository
git clone git@github.com:jianzhichun/solidworks-mcp-server.git
cd solidworks-mcp-server

# Install dependencies (compiles winax for your system)
npm install

# Build TypeScript
npm run build
```

### Configure Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "solidworks": {
      "command": "node",
      "args": ["C:/path/to/solidworks-mcp-server/dist/index.js"],
      "env": {
        "SOLIDWORKS_PATH": "C:\\Program Files\\SOLIDWORKS Corp\\SOLIDWORKS",
        "ADAPTER_TYPE": "winax-enhanced"
      }
    }
  }
}
```

---

## 📋 Complete Tool Reference

### 🎨 Sketch Tools

| Tool Name | Input Parameters | Output | Description | Use Case | Workflow |
|-----------|------------------|--------|-------------|----------|----------|
| `create_sketch` | `plane` (Front/Top/Right/Custom), `offset` (number, default: 0), `reverse` (boolean, default: false), `customPlane` (optional object) | `success`, `sketchName`, `plane`, `offset`, `message` | Create a new sketch on a specified plane or face | Initialize sketch for feature creation | 1. Select plane/face<br>2. Create sketch<br>3. Return sketch name |
| `edit_sketch` | `sketchName` | `success`, `sketchName`, `message` | Enter sketch edit mode for an existing sketch | Modify existing sketch geometry | 1. Find sketch by name<br>2. Activate sketch<br>3. Return status |
| `exit_sketch` | `rebuild` (boolean) | `success`, `message` | Exit sketch edit mode and optionally rebuild | Complete sketch editing | 1. Exit sketch<br>2. Optionally rebuild model |
| `get_sketch_context` | `maxFeatures` (optional, default: 5) | `hasModel`, `modelName`, `modelType`, `activeSketch`, `recentSketchFeatures` | Get current model and sketch context for diagnostics | Debug sketch operations | 1. Get active model<br>2. Get active sketch<br>3. Return context |
| `sketch_line` | `start` ({x, y, z}), `end` ({x, y, z}), `construction` (boolean, default: false) | `success`, `message`, `position` | Draw a line in the active sketch | Add line geometry | 1. Validate sketch active<br>2. Create line from points<br>3. Return entity info |
| `sketch_centerline` | `start` ({x, y}), `end` ({x, y}) | `success`, `message` | Draw a centerline in the active sketch | Add construction centerline | 1. Validate sketch active<br>2. Create centerline<br>3. Return entity info |
| `sketch_circle` | `center` ({x, y, z}), `radius` (number), `construction` (boolean, default: false) | `success`, `message` | Draw a circle in the active sketch | Add circle geometry | 1. Validate sketch active<br>2. Create circle by radius<br>3. Return entity info |
| `sketch_arc` | `center` ({x, y}), `start` ({x, y}), `end` ({x, y}), `direction` (clockwise/counterclockwise, default: counterclockwise), `construction` (boolean, default: false) | `success`, `message` | Draw an arc in the active sketch | Add arc geometry | 1. Validate sketch active<br>2. Create arc by 3 points<br>3. Return entity info |
| `sketch_rectangle` | `corner1` ({x, y}), `corner2` ({x, y}), `centered` (boolean, default: false), `construction` (boolean, default: false) | `success`, `message` | Draw a rectangle in the active sketch | Add rectangle geometry | 1. Validate sketch active<br>2. Create corner rectangle<br>3. Return entity info |
| `sketch_polygon` | `center` ({x, y}), `sides` (number, 3-100), `radius` (number), `rotation` (number, default: 0), `inscribed` (boolean, default: false), `construction` (boolean, default: false) | `success`, `message` | Draw a regular polygon in the active sketch | Add polygon geometry | 1. Validate sketch active<br>2. Create polygon<br>3. Return entity info |
| `sketch_spline` | `points` (array of {x, y, z}), `closed` (boolean, default: false), `construction` (boolean, default: false) | `success`, `message` | Draw a spline through points in the active sketch | Add spline geometry | 1. Validate sketch active<br>2. Create spline from points<br>3. Return entity info |
| `sketch_ellipse` | `center` ({x, y}), `majorAxis` ({length, angle}), `minorAxis` (number), `construction` (boolean, default: false) | `success`, `message` | Draw an ellipse in the active sketch | Add ellipse geometry | 1. Validate sketch active<br>2. Create ellipse<br>3. Return entity info |
| `add_sketch_constraint` | `type` (coincident/parallel/perpendicular/tangent/concentric/horizontal/vertical/equal/symmetric/colinear/midpoint/fix), `entity1` (string, default: 'last'), `entity2` (optional), `entity3` (optional) | `success`, `message` | Add constraints between sketch entities | Constrain sketch geometry | 1. Validate entities exist<br>2. Apply constraint<br>3. Return status |
| `add_sketch_dimension` | `type` (linear/angular/radial/diameter), `entity` (string), `value` (number), `position` (optional {x, y}) | `success`, `message`, `type`, `value` | Add dimensions to sketch entities | Dimension sketch geometry | 1. Validate entity exists<br>2. Add dimension<br>3. Return dimension info |
| `sketch_linear_pattern` | `entities` (array), `direction1` ({x, y, count, spacing}), `direction2` (optional {x, y, count, spacing}) | `success`, `message` | Create a linear pattern of sketch entities | Pattern sketch geometry | 1. Select entities<br>2. Define pattern direction<br>3. Create pattern |
| `sketch_circular_pattern` | `entities` (array), `center` ({x, y}), `count` (number), `angle` (number, default: 360), `equalSpacing` (boolean, default: true) | `success`, `message` | Create a circular pattern of sketch entities | Pattern sketch geometry circularly | 1. Select entities<br>2. Define center point<br>3. Create pattern |
| `sketch_mirror` | `entities` (array), `mirrorLine` (string), `copy` (boolean, default: true) | `success`, `message` | Mirror sketch entities about a line | Mirror sketch geometry | 1. Select entities<br>2. Select mirror line<br>3. Create mirror |
| `sketch_offset` | `entities` (array), `distance` (number), `side` (both/left/right, default: both), `corner` (sharp/round/natural, default: natural), `cap` (boolean, default: true) | `success`, `message` | Create offset curves from sketch entities | Offset sketch geometry | 1. Select entities<br>2. Define offset distance<br>3. Create offset |

### 📐 Drawing Tools

| Tool Name | Input Parameters | Output | Description | Use Case | Workflow |
|-----------|------------------|--------|-------------|----------|----------|
| `create_drawing_from_model` | `template` (string, path), `sheet_size` (optional: A4/A3/A2/A1/A0/Letter/Tabloid) | `success`, `message`, `drawingName`, `warnings` | Create a new drawing from the current 3D model | Generate 2D drawing from 3D model | 1. Get active model<br>2. Create drawing document<br>3. Add base view<br>4. Return drawing info |
| `add_drawing_view` | `viewType` (front/top/right/back/bottom/left/iso/current), `modelPath` (string), `x` (number, mm), `y` (number, mm), `scale` (optional number) | `success`, `message`, `viewName`, `position` | Add a standard or custom view to the current drawing sheet | Add model views to drawing | 1. Get model path<br>2. Create view on sheet<br>3. Position view<br>4. Return view info |
| `add_section_view` | `parentView` (string), `x` (number, mm), `y` (number, mm), `sectionLine` ({x1, y1, x2, y2}) | `success`, `message` | Add a section view to the drawing | Create section cut view | 1. Define section line<br>2. Create section view<br>3. Position view |
| `add_dimensions` | `viewName` (string), `autoArrange` (boolean, default: true) | `success`, `message`, `viewName`, `dimensionCount` | Add automatic dimensions to a drawing view | Dimension drawing views | 1. Select view<br>2. Auto-dimension entities<br>3. Return dimension count |
| `update_sheet_format` | `properties` ({title, drawnBy, checkedBy, date, scale, material, finish}) | `success`, `message`, `updatedProperties` | Update drawing sheet format and properties | Modify sheet format | 1. Get current sheet<br>2. Update format<br>3. Update properties |
| `add_diameter_dimension` | `viewName` (string), `x` (number), `y` (number), `text` (optional string) | `success`, `message`, `position` | Add dimension with diameter symbol to a view | Add diameter dimension | 1. Select circular entity<br>2. Add dimension<br>3. Apply diameter symbol |
| `set_view_grayscale_enhanced` | `viewName` (string) | `success`, `message`, `methods` | Enhanced method to set view to grayscale | Convert view to grayscale | 1. Get view<br>2. Set display mode<br>3. Apply grayscale |
| `create_configurations_batch` | `configs` (array of {name, outsideDiameter, insideDiameter, thickness}) | `success`, `message`, `createdConfigs`, `failedConfigs` | Create multiple configurations with dimensions | Batch create configurations | 1. Iterate configurations<br>2. Set dimensions<br>3. Create config |

### 📤 Export Tools

| Tool Name | Input Parameters | Output | Description | Use Case | Workflow |
|-----------|------------------|--------|-------------|----------|----------|
| `export_file` | `outputPath` (string), `format` (optional: step/iges/stl/pdf/dxf/dwg) | `success`, `message`, `outputPath`, `format` | Export the current model to various formats | Export model to different formats | 1. Get active model<br>2. Determine format<br>3. Execute export<br>4. Verify file |
| `batch_export` | `format` (step/iges/stl/pdf/dxf/dwg), `outputDir` (string), `configurations` (optional array), `prefix` (optional string) | `success`, `message`, `exportedFiles`, `count` | Export multiple configurations or files to a format | Batch export operations | 1. Get configurations<br>2. Iterate each config<br>3. Export with naming<br>4. Return list |
| `export_with_options` | `outputPath` (string), `format` (stl/step/iges), `options` ({units, binary, version, quality}) | `success`, `message`, `outputPath`, `format` | Export with specific format options | Advanced export with options | 1. Set export options<br>2. Execute export<br>3. Return result |
| `capture_screenshot` | `outputPath`, `width`, `height` | `success`, `outputPath` | Capture a screenshot of the current model view | Capture model image | 1. Get active view<br>2. Capture image<br>3. Save to file |

### 🔬 Analysis Tools

| Tool Name | Input Parameters | Output | Description | Use Case | Workflow |
|-----------|------------------|--------|-------------|----------|----------|
| `get_mass_properties` | `units` (kg/g/lb, default: kg) | `mass`, `volume`, `surfaceArea`, `centerOfMass` | Get mass properties of the current model | Calculate mass, volume, center of mass | 1. Get model<br>2. Calculate properties<br>3. Convert units<br>4. Return values |
| `check_interference` | `treatCoincidenceAsInterference` (boolean, default: false), `treatSubAssembliesAsComponents` (boolean, default: false), `includeMultibodyParts` (boolean, default: true) | `message`, `count` | Check for interference between components in an assembly | Detect component interference | 1. Get assembly<br>2. Run interference check<br>3. Return results |
| `measure_distance` | `entity1` (string), `entity2` (string) | Returns string message | Measure distance between two selected entities | Measure entity distance | 1. Select entities<br>2. Calculate distance<br>3. Return value |
| `analyze_draft` | `pullDirection` (x/y/z/-x/-y/-z), `requiredAngle` (number, default: 1) | Returns string message | Analyze draft angles on model faces | Check draft angles | 1. Get model<br>2. Analyze faces<br>3. Return draft info |
| `check_geometry` | `checkType` (all/faces/edges/vertices, default: all) | Returns string message | Check geometry for errors and validation | Validate model geometry | 1. Get model<br>2. Check geometry<br>3. Return issues |
| `get_bounding_box` | `includeHiddenBodies` (boolean, default: false) | `dimensions`, `volume`, `diagonal`, `note` | Get model bounding box dimensions | Get model extents | 1. Get model<br>2. Calculate bounds<br>3. Return box |

### 🔧 Template Manager Tools

| Tool Name | Input Parameters | Output | Description | Use Case | Workflow |
|-----------|------------------|--------|-------------|----------|----------|
| `extract_drawing_template` | `filePath` (string), `includeFormat` (boolean, default: true), `includeProperties` (boolean, default: true), `includeStyles` (boolean, default: true), `includeViews` (boolean, default: false), `saveAs` (optional string) | `success`, `message`, `templateData`, `propertyCount`, `viewCount` | Extract complete template settings from a parent drawing file | Extract drawing template | 1. Open parent drawing<br>2. Extract format<br>3. Extract properties<br>4. Extract styles<br>5. Save template |
| `apply_drawing_template` | `targetFile` (string), `templateData` (optional object), `templateFile` (optional string), `applyFormat` (boolean, default: true), `applyProperties` (boolean, default: true), `applyStyles` (boolean, default: true), `overwriteExisting` (boolean, default: false) | `success`, `message`, `changedItems`, `appliedFormat`, `appliedProperties`, `appliedStyles` | Apply template settings to a target drawing file | Apply template to drawing | 1. Open target drawing<br>2. Load template<br>3. Apply format<br>4. Apply properties<br>5. Apply styles |
| `batch_apply_template` | `parentFile` (string), `childFiles` (array), `includeSubfolders` (boolean, default: false), `filePattern` (string, default: '*.SLDDRW'), `applyFormat` (boolean, default: true), `applyProperties` (boolean, default: true), `applyStyles` (boolean, default: true), `overwriteExisting` (boolean, default: false), `saveReport` (optional string) | `success`, `message`, `summary`, `processedFiles`, `failedFiles` | Apply template to multiple child drawing files | Batch apply template | 1. Get file list<br>2. Iterate files<br>3. Apply template<br>4. Return results |
| `compare_drawing_templates` | `file1` (string), `file2` (string), `compareFormat` (boolean, default: true), `compareProperties` (boolean, default: true), `compareStyles` (boolean, default: true) | `success`, `message`, `file1`, `file2`, `differences`, `identical` | Compare template settings between two drawings | Compare templates | 1. Load both templates<br>2. Compare settings<br>3. Return differences |
| `save_template_to_library` | `sourceFile` (string), `templateName` (string), `category` (string, default: 'General'), `description` (optional string), `tags` (array, default: []), `libraryPath` (string, default: './templates') | `success`, `message`, `path`, `templateName` | Save a drawing template to a reusable library | Save template library | 1. Extract template<br>2. Save to library<br>3. Add metadata |
| `list_template_library` | `libraryPath` (string, default: './templates'), `category` (optional string), `tags` (optional array) | `success`, `message`, `templates`, `count`, `categories`, `allTags` | List all templates in the library | List template library | 1. Load library index<br>2. Filter by category/tags<br>3. Return templates |
| `list_template_library` | `category` (optional) | `templates` (array) | List all templates in the library | List available templates | 1. Scan library directory<br>2. Load metadata<br>3. Return list |

### 🎬 Native Macro Tools

| Tool Name | Input Parameters | Output | Description | Use Case | Workflow |
|-----------|------------------|--------|-------------|----------|----------|
| `start_native_macro_recording` | `macroPath` (string), `pauseRecording` (boolean, default: false), `recordViewCommands` (boolean, default: false), `recordFeatureManager` (boolean, default: true), `recordSelections` (boolean, default: true) | `success`, `message`, `macroPath`, `status`, `options` | Start recording a macro using SolidWorks native VBA recorder | Start macro recording | 1. Set macro path<br>2. Configure options<br>3. Start recording<br>4. Return status |
| `stop_native_macro_recording` | `openInEditor` (boolean, default: false), `runMacro` (boolean, default: false) | `success`, `message`, `macroPath`, `openedInEditor`, `executed` | Stop the current native macro recording and save | Stop macro recording | 1. Stop recording<br>2. Save macro file<br>3. Return path |
| `pause_resume_macro_recording` | `action` (pause/resume) | `success`, `message`, `status` | Pause or resume the current macro recording | Control recording state | 1. Check recording state<br>2. Pause/resume<br>3. Return status |
| `run_macro` | `macroPath` (string), `moduleName` (string, default: 'main'), `procedureName` (string, default: 'main'), `arguments` (optional array), `unloadAfterRun` (boolean, default: true) | `success`, `message`, `macroPath`, `module`, `procedure`, `hadArguments` | Run a SolidWorks macro file | Execute macro | 1. Load macro file<br>2. Execute procedure<br>3. Return result |
| `edit_macro` | `macroPath` (string) | `success`, `message`, `macroPath` | Open a macro in the SolidWorks VBA editor | Edit macro | 1. Check file exists<br>2. Open in editor<br>3. Return status |
| `create_initialized_macro` | `macroPath` (string), `macroName` (string), `description` (optional string), `includeErrorHandling` (boolean, default: true), `includeComments` (boolean, default: true), `template` (basic/part/assembly/drawing, default: basic) | `success`, `message`, `macroPath`, `macroName`, `template`, `linesOfCode` | Create a new macro with proper SolidWorks VBA initialization | Create macro template | 1. Create macro file<br>2. Initialize VBA project<br>3. Add template code<br>4. Save macro |
| `convert_text_to_native_macro` | `vbaCode` (string), `outputPath` (string), `macroName` (string), `addInitialization` (boolean, default: true), `addReferences` (boolean, default: true) | `success`, `message`, `outputPath`, `macroName`, `linesOfCode`, `referencesAdded`, `initializationAdded` | Convert plain text VBA code to a properly initialized SolidWorks macro | Convert text to macro | 1. Create initialized macro<br>2. Add references<br>3. Insert code<br>4. Save macro |
| `batch_run_macros` | `macros` (array of {path, module, procedure, arguments}), `stopOnError` (boolean, default: false) | `success`, `message`, `results`, `executed`, `failed` | Run multiple macros in sequence | Batch execute macros | 1. Load macro list<br>2. Execute each macro<br>3. Return results |
| `edit_macro` | `macroPath` | `success`, `message` | Open a macro in the SolidWorks VBA editor | Edit macro code | 1. Open VBA editor<br>2. Load macro<br>3. Return status |
| `create_initialized_macro` | `macroPath`, `description` | `success`, `macroPath` | Create a new macro with proper SolidWorks VBA initialization | Create new macro | 1. Create macro file<br>2. Add initialization code<br>3. Return path |
| `convert_text_to_native_macro` | `vbaCode`, `macroPath` | `success`, `macroPath` | Convert plain text VBA code to a properly initialized SolidWorks macro | Convert text to macro | 1. Parse VBA code<br>2. Add initialization<br>3. Save macro |
| `batch_run_macros` | `macros` (array) | `success`, `results` | Run multiple macros in sequence | Batch execute macros | 1. Load macro list<br>2. Execute sequentially<br>3. Return results |

### 🔍 Diagnostic Tools

| Tool Name | Input Parameters | Output | Description | Use Case | Workflow |
|-----------|------------------|--------|-------------|----------|----------|
| `diagnose_macro_execution` | `macroPath` (string), `moduleName` (string, default: 'Module1'), `procedureName` (string) | `success`, `message`, `steps`, `recommendations` | Diagnose macro execution issues with detailed logging | Troubleshoot macro problems | 1. Check SolidWorks connection<br>2. Verify file exists<br>3. Check security settings<br>4. Test execution methods<br>5. Return diagnosis |

### 🔒 Macro Security Tools

| Tool Name | Input Parameters | Output | Description | Use Case | Workflow |
|-----------|------------------|--------|-------------|----------|----------|
| `macro_set_security` | `level` (low/medium/high) | `success`, `message`, `level`, `requiresRestart` | Attempt to set macro security level | Configure macro security | 1. Get SolidWorks app<br>2. Set security level<br>3. Verify change<br>4. Return status |
| `macro_get_security_info` | None (empty object) | `success`, `message`, `securityLevel`, `vbaEnabled`, `instructions` | Get detailed macro security information | Check security settings | 1. Get security level<br>2. Check VBA enabled<br>3. Return info |

### 📝 Macro Recording Tools

| Tool Name | Input Parameters | Output | Description | Use Case | Workflow |
|-----------|------------------|--------|-------------|----------|----------|
| `macro_start_recording` | `name` (string), `description` (optional string) | `macroId`, `status` | Start recording a new macro | Begin macro recording session | 1. Initialize recorder<br>2. Start session<br>3. Return macro ID |
| `macro_stop_recording` | None (empty object) | `id`, `name`, `description`, `actions` | Stop the current macro recording | End recording session | 1. Stop recording<br>2. Return recorded actions |
| `macro_export_vba` | `macroId` (string) | `code` | Export a recorded macro to VBA code | Convert recording to VBA | 1. Get recorded actions<br>2. Generate VBA<br>3. Return code |

### 💻 VBA Generation Tools

#### Base VBA Tools

| Tool Name | Input Parameters | Output | Description | Use Case | Workflow |
|-----------|------------------|--------|-------------|----------|----------|
| `generate_vba_script` | `template` (string), `parameters` (object), `outputPath` (optional string) | `success`, `message`, `vbaCode`, `outputPath`, `linesOfCode` | Generate a VBA script from a template with parameters | Generate VBA from template | 1. Load template<br>2. Compile with Handlebars<br>3. Fill parameters<br>4. Return code |
| `create_feature_vba` | `featureType` (extrude/revolve/sweep/loft/hole/fillet/chamfer), `parameters` ({depth, angle, radius, count}) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA code to create a specific feature | Generate feature VBA | 1. Select feature type<br>2. Generate code<br>3. Return VBA |
| `create_batch_vba` | `operation` (export/update_property/rebuild/print), `filePattern` (string), `outputFormat` (optional string), `propertyName` (optional string), `propertyValue` (optional string) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for batch processing multiple files | Generate batch VBA | 1. Define operation<br>2. Generate batch code<br>3. Return VBA |
| `run_vba_macro` | `macroPath` (string), `moduleName` (string, default: 'Module1'), `procedureName` (string), `arguments` (optional array) | `success`, `message`, `result` | Execute a VBA macro in SolidWorks | Run macro | 1. Load macro file<br>2. Execute procedure<br>3. Return result |
| `create_drawing_vba` | `modelPath` (string), `template` (string), `views` (array of front/top/right/iso/section/detail), `sheet_size` (A4/A3/A2/A1/A0/Letter/Tabloid) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA to create drawings from 3D models | Generate drawing VBA | 1. Load template<br>2. Generate drawing code<br>3. Return VBA |

#### Part Modeling VBA Tools

| Tool Name | Input Parameters | Output | Description | Use Case | Workflow |
|-----------|------------------|--------|-------------|----------|----------|
| `vba_create_reference_geometry` | Generate VBA for creating reference geometry (planes, axes, points) | Create reference geometry VBA | 1. Select geometry type<br>2. Generate code<br>3. Return VBA | `geometryType` (plane/axis/point/coordinate_system), `parameters` (object) | `success`, `message`, `vbaCode`, `linesOfCode` |
| `vba_advanced_features` | Generate VBA for advanced features (sweep, loft, boundary) | Generate advanced feature VBA | 1. Select feature type<br>2. Generate code<br>3. Return VBA | `featureType` (sweep/loft/boundary), `parameters` (object) | `success`, `message`, `vbaCode`, `linesOfCode` |
| `vba_pattern_features` | `patternType` (linear/circular/curve), `parameters` (object) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for pattern features | Generate pattern VBA | 1. Select pattern type<br>2. Generate code<br>3. Return VBA |
| `vba_sheet_metal` | `operation` (string), `parameters` (object) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for sheet metal operations | Generate sheet metal VBA | 1. Select operation<br>2. Generate code<br>3. Return VBA |
| `vba_surface_modeling` | `operation` (string), `parameters` (object) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for surface modeling operations | Generate surface VBA | 1. Select operation<br>2. Generate code<br>3. Return VBA |

#### Assembly VBA Tools

| Tool Name | Input Parameters | Output | Description | Use Case | Workflow |
|-----------|------------------|--------|-------------|----------|----------|
| `vba_assembly_mates` | `mates` (array), `components` (array) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for creating assembly mates | Generate mate VBA | 1. Define mate types<br>2. Generate code<br>3. Return VBA |
| `vba_assembly_components` | `components` (array), `positions` (array) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for inserting and managing components | Generate component VBA | 1. Define components<br>2. Generate code<br>3. Return VBA |
| `vba_assembly_analysis` | `analysisType` (interference/clearance/collision/mass_properties), `components` (array) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for assembly analysis | Generate analysis VBA | 1. Select analysis type<br>2. Generate code<br>3. Return VBA |
| `vba_assembly_configurations` | `configurations` (array), `options` (object) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for managing assembly configurations | Generate config VBA | 1. Define configurations<br>2. Generate code<br>3. Return VBA |

#### Drawing VBA Tools

| Tool Name | Input Parameters | Output | Description | Use Case | Workflow |
|-----------|------------------|--------|-------------|----------|----------|
| `vba_create_drawing_views` | `views` (array), `modelPath` (string) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for creating drawing views | Generate view VBA | 1. Define views<br>2. Generate code<br>3. Return VBA |
| `vba_drawing_dimensions` | `dimensions` (array), `viewName` (string) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for adding dimensions to drawings | Generate dimension VBA | 1. Define dimensions<br>2. Generate code<br>3. Return VBA |
| `vba_drawing_annotations` | `annotations` (array), `viewName` (string) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for adding annotations to drawings | Generate annotation VBA | 1. Define annotations<br>2. Generate code<br>3. Return VBA |
| `vba_drawing_tables` | `tableType` (string), `data` (array/object), `position` (object) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for creating tables in drawings | Generate table VBA | 1. Define table<br>2. Generate code<br>3. Return VBA |
| `vba_drawing_sheet_format` | `formatPath` (string), `properties` (object) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for managing drawing sheets and formats | Generate sheet format VBA | 1. Define format<br>2. Generate code<br>3. Return VBA |

#### File Management VBA Tools

| Tool Name | Input Parameters | Output | Description | Use Case | Workflow |
|-----------|------------------|--------|-------------|----------|----------|
| `vba_batch_operations` | `operation` (string), `filePattern` (string), `options` (object) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for batch file operations | Generate batch VBA | 1. Define operation<br>2. Generate code<br>3. Return VBA |
| `vba_custom_properties` | `operation` (add/modify/delete/export), `properties` (array/object) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for managing custom properties | Generate property VBA | 1. Define properties<br>2. Generate code<br>3. Return VBA |

#### Advanced VBA Tools

| Tool Name | Input Parameters | Output | Description | Use Case | Workflow |
|-----------|------------------|--------|-------------|----------|----------|
| `vba_configurations` | `operation` (create/derive/suppress_features/set_properties), `parameters` (object) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for managing configurations | Generate config VBA | 1. Define config operation<br>2. Generate code<br>3. Return VBA |
| `vba_equations` | `equations` (array), `operation` (string) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for managing equations and global variables | Generate equation VBA | 1. Define equations<br>2. Generate code<br>3. Return VBA |
| `vba_simulation_setup` | `studyType` (string), `parameters` (object) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for setting up simulation studies | Generate simulation VBA | 1. Define study type<br>2. Generate code<br>3. Return VBA |
| `vba_api_automation` | `automationType` (string), `parameters` (object) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA for advanced API automation and event handling | Generate automation VBA | 1. Define automation<br>2. Generate code<br>3. Return VBA |
| `vba_error_handling` | `errorHandlingType` (string), `parameters` (object) | `success`, `message`, `vbaCode`, `linesOfCode` | Generate VBA with comprehensive error handling and logging | Generate error handling VBA | 1. Define error handling<br>2. Generate code<br>3. Return VBA |

---

## 💡 Prompts Reference

Prompts provide reusable workflow templates for common SolidWorks tasks. Each prompt guides you through a step-by-step process with best practices.

| Prompt Name | Input Parameters | Description | Use Case | Workflow Steps | Prompt Description |
|-------------|------------------|-------------|----------|----------------|-------------------|
| `create-part-workflow` | `partName` (string), `complexity` (optional: simple/medium/complex, default: simple) | Guides through part creation with complexity-based steps. **Simple**: basic features (4 steps). **Medium**: multiple features with constraints (6 steps). **Complex**: advanced features with reference geometry, configurations, and validation (7 steps). | Step-by-step guide to create a new SolidWorks part with best practices | Create new parts | 1. Create new part document<br>2. Select plane<br>3. Create base sketch<br>4. Extrude initial feature<br>5. Add additional features<br>6. Apply material properties |
| `create-assembly-workflow` | `assemblyName` (string), `componentCount` (optional string) | Guides through assembly creation with best practices: fix first component, use minimal mates, avoid redundant constraints, check interference before finalizing. Includes mate types and verification steps. | Step-by-step guide to create a new SolidWorks assembly with components and mates | Create assemblies | 1. Create new assembly document<br>2. Insert base component (fixed)<br>3. Insert additional components<br>4. Add mates (coincident, parallel, perpendicular, distance, angle, concentric)<br>5. Verify constraints<br>6. Check interference<br>7. Create configurations if needed |
| `analyze-model` | `analysisType` (mass/interference/geometry/all), `modelName` (optional string) | Provides analysis workflow: **Mass properties** (mass, volume, center of mass, moments of inertia, material verification). **Interference detection** (identify interfering parts, measure volumes, suggest corrections). **Geometry validation** (check errors, validate faces/edges/vertices, check self-intersections, verify feature integrity). **All**: comprehensive report combining all analyses. | Template for analyzing a SolidWorks model with various analysis types | Analyze models | 1. Perform mass property analysis<br>2. Check for interference<br>3. Validate geometry<br>4. Generate comprehensive report |
| `export-workflow` | `format` (STEP/IGES/STL/PDF/DXF/DWG), `outputPath` (optional string) | Guides through export process with format-specific tips: **STEP/IGES** for CAD interoperability (version compatibility, units). **STL** for 3D printing (mesh quality: coarse/fine/custom, units). **PDF/DXF/DWG** for 2D drawings (sheet selection, scale settings). Best practices: save before export, verify settings, check exported file, use configurations for batch exports. | Guide for exporting SolidWorks models to various formats with proper settings | Export models | 1. Verify model is ready<br>2. Set export options (format-specific)<br>3. Execute export<br>4. Verify exported file |
| `sketch-workflow` | `plane` (optional: Front/Top/Right, default: Front), `sketchType` (optional: simple/complex, default: simple) | Guides through sketching with best practices: always fully define sketches (black entities), use geometric constraints before dimensions, keep sketches simple, use construction geometry, avoid over-constraining, use parametric dimensions, name sketches descriptively. **Simple**: basic geometry (5 steps). **Complex**: advanced features with patterns (8 steps). | Guide for creating and editing sketches in SolidWorks with best practices | Create/edit sketches | 1. Create sketch on plane<br>2. Draw geometry<br>3. Add constraints<br>4. Add dimensions<br>5. Verify fully defined<br>6. Exit sketch |

---

## 📦 Resources Reference

Resources provide read-only access to SolidWorks configuration, materials, templates, and system status.

| Resource Name | URI Pattern | Access Method | Description | Use Case | Data Structure |
|---------------|-------------|---------------|-------------|----------|----------------|
| `sw-config` | `solidworks://config` | **Static resource** - Returns current SolidWorks configuration including version, units, precision settings, and template paths. No parameters required. | Current SolidWorks application configuration | Get system configuration | JSON: `{version, units, precision, templatePaths, ...}` |
| `material` | `solidworks://materials/{materialName}` | **Dynamic resource template** - Requires `materialName` parameter (string). Returns material properties from SolidWorks material database: density, elastic modulus, Poisson's ratio, yield strength, and other mechanical properties. | Material properties from SolidWorks database | Get material properties | JSON: `{name, density, modulus, poissonRatio, yieldStrength, ...}` |
| `templates` | `solidworks://templates/{type}` | **Dynamic resource template** - Requires `type` parameter (string, must be one of: `part`, `assembly`, `drawing`). Returns list of available templates for the specified document type with names, paths, and descriptions. | List of available templates for document type | Get template list | JSON: `{type, templates: [{name, path, description}]}` |
| `sw-system` | `solidworks://system` | **Static resource** - Returns current system status including connection state, SolidWorks version, active document information, and list of open documents. No parameters required. | Current SolidWorks system status | Get system status | JSON: `{connected, version, activeDocument, openDocuments, ...}` |

---

## 🏗️ Architecture

### Intelligent Adapter Architecture

```
┌─────────────────────────────────────────┐
│         MCP Protocol Layer              │
├─────────────────────────────────────────┤
│    Feature Complexity Analyzer          │ ← Intelligent Routing
├─────────────────────────────────────────┤
│      Adapter Abstraction Layer          │
├─────────────┬───────────────┬───────────┤
│  WinAx       │   Edge.js     │  PowerShell│
│  Adapter     │   Adapter     │   Bridge   │
├──────────────┴───────────────┴───────────┤
│       Dynamic VBA Macro Generator        │ ← Fallback System
├─────────────────────────────────────────┤
│         SolidWorks COM API              │
└─────────────────────────────────────────┘
```

### Code Structure

```
src/
├── solidworks/          # Core SolidWorks API
│   ├── api.ts          # Main API class
│   ├── types/          # Type definitions
│   ├── operations/     # Operation classes
│   └── helpers/        # Helper functions
├── tools/              # MCP Tools
│   ├── sketch.ts       # Sketch tools
│   ├── drawing.ts      # Drawing tools
│   ├── export.ts        # Export tools
│   ├── analysis.ts     # Analysis tools
│   ├── vba/            # VBA generation tools
│   ├── template-manager.ts  # Template management
│   ├── native-macro.ts  # Native macro recording
│   ├── diagnostics.ts  # Diagnostic tools
│   └── macro-security.ts  # Security tools
├── prompts/            # MCP Prompts
│   └── index.ts        # Workflow templates
├── resources/          # MCP Resources
│   └── index.ts        # Read-only data access
└── utils/              # Utilities
    ├── logger.ts       # Logging
    ├── config.ts       # Configuration
    └── error-recovery.ts  # Error handling
```

---

## 📊 Statistics

- **Total Tools**: 83
- **Total Prompts**: 5
- **Total Resources**: 4
- **VBA Templates**: 9
- **Supported Formats**: STEP, IGES, STL, PDF, DXF, DWG
- **SolidWorks Versions**: 2024

---

## 🚀 Usage Examples

### Simple Operations (Direct COM - Fast)

```javascript
// Simple extrusion - uses direct COM
await solidworks.create_extrusion({
  depth: 50
});

// Simple revolve - uses direct COM  
await solidworks.create_revolve({
  angle: 270
});
```

### Complex Operations (Automatic Macro Fallback)

```javascript
// Complex extrusion - automatically uses macro
await solidworks.create_extrusion_advanced({
  depth: 50,
  bothDirections: true,
  depth2: 30,
  draft: 5,
  thinFeature: true,
  thinThickness: 2
});
```

### Using Prompts

```javascript
// Use create-part-workflow prompt
await solidworks.prompt('create-part-workflow', {
  partName: 'MyPart',
  complexity: 'medium'
});

// Use analyze-model prompt
await solidworks.prompt('analyze-model', {
  analysisType: 'all',
  modelName: 'CurrentModel'
});
```

### Accessing Resources

```javascript
// Get SolidWorks configuration
const config = await solidworks.getResource('solidworks://config');

// Get material properties
const material = await solidworks.getResource('solidworks://materials/Steel');

// Get template list
const templates = await solidworks.getResource('solidworks://templates/part');

// Get system status
const status = await solidworks.getResource('solidworks://system');
```

---

## 🛡️ Reliability Features

### Circuit Breaker Pattern
Prevents cascading failures when operations fail repeatedly:
- Monitors failure rates
- Opens circuit after threshold
- Auto-recovery with half-open state

### Connection Pooling
Manages multiple SolidWorks connections efficiently:
- Concurrent operation support
- Resource management
- Automatic cleanup

### Intelligent Fallback
Every operation has a fallback strategy:
- Primary: Direct COM call
- Fallback: VBA macro generation
- Emergency: Error recovery with suggestions

---

## 🧪 Testing

### Quick Start

```bash
# Install dependencies
npm install

# Run unit tests (no SolidWorks required)
USE_MOCK_SOLIDWORKS=true npm test

# Run in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Testing Without SolidWorks

Perfect for CI/CD and development without SolidWorks installed:

```bash
# Set environment variable
export USE_MOCK_SOLIDWORKS=true

# Run tests
npm test
```

### Testing With SolidWorks

```bash
# Ensure SolidWorks is running
# Run tests with real COM connection
npm test
```

---

## 🤝 Contributing

We welcome contributions! Key areas:
- Additional feature implementations
- Performance optimizations
- Edge.js adapter completion (.NET runtime)
- PowerShell bridge implementation
- Additional CAD format support

### Development Process

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

### Pull Request Process

1. Update the README.md with details of changes to the interface
2. Update the CHANGELOG section in README.md with a note describing your changes
3. The PR will be merged once you have the sign-off of at least one maintainer

Any contributions you make will be under the MIT Software License.

---

## 📈 Roadmap

- [x] Intelligent adapter architecture
- [x] Feature complexity analyzer
- [x] Dynamic VBA macro generation
- [x] Circuit breaker pattern
- [x] Connection pooling
- [x] Code refactoring and modularization (Dec 2025)
- [ ] Edge.js adapter (pending .NET setup)
- [ ] PowerShell bridge
- [ ] Cloud deployment support
- [ ] Real-time collaboration
- [ ] AI-powered design suggestions

---

## 📝 Changelog

### [1.0.0] - 2025-12-21

#### Created
- **Initial Release** - New project created with intelligent COM bridge architecture

---

## 🐛 Troubleshooting

### COM Registration Issues
```powershell
# Re-register SolidWorks COM
regsvr32 "C:\Program Files\SOLIDWORKS Corp\SOLIDWORKS\sldworks.tlb"
```

### Build Issues
```bash
# Clean rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Enable Debug Logging
```javascript
// Set in environment
ENABLE_LOGGING=true
LOG_LEVEL=debug
```

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file

---

## 🙏 Acknowledgments

- SolidWorks API Team for comprehensive documentation
- winax contributors for COM bridge
- Anthropic for MCP protocol specification
- Community contributors and testers

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/jianzhichun/solidworks-mcp-server/issues)

---

<div align="center">
Built with ❤️ for the CAD automation community

**Making SolidWorks automation accessible to everyone**
</div>
