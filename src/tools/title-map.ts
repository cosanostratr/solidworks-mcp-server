/**
 * Tool title mapping for friendly display names
 * Maps tool names to human-readable titles
 */

export const toolTitleMap: Record<string, string> = {
  // Sketch tools
  'create_sketch': 'Create Sketch',
  'edit_sketch': 'Edit Sketch',
  'exit_sketch': 'Exit Sketch',
  'get_sketch_context': 'Get Sketch Context',
  'sketch_line': 'Draw Line',
  'sketch_centerline': 'Draw Centerline',
  'sketch_circle': 'Draw Circle',
  'sketch_arc': 'Draw Arc',
  'sketch_rectangle': 'Draw Rectangle',
  'sketch_polygon': 'Draw Polygon',
  'sketch_spline': 'Draw Spline',
  'sketch_ellipse': 'Draw Ellipse',
  'add_sketch_constraint': 'Add Sketch Constraint',
  'add_sketch_dimension': 'Add Sketch Dimension',
  'sketch_linear_pattern': 'Create Linear Pattern',
  'sketch_circular_pattern': 'Create Circular Pattern',
  'sketch_mirror': 'Mirror Sketch Entities',
  'sketch_offset': 'Offset Sketch Entities',

  // Drawing tools
  'create_drawing_from_model': 'Create Drawing from Model',
  'add_drawing_view': 'Add Drawing View',
  'add_section_view': 'Add Section View',
  'add_dimensions': 'Add Dimensions',
  'update_sheet_format': 'Update Sheet Format',
  'add_diameter_dimension': 'Add Diameter Dimension',
  'set_view_grayscale_enhanced': 'Set View Grayscale',
  'create_configurations_batch': 'Create Configurations Batch',

  // Export tools
  'export_file': 'Export File',
  'batch_export': 'Batch Export',
  'export_with_options': 'Export with Options',
  'capture_screenshot': 'Capture Screenshot',

  // Analysis tools
  'get_mass_properties': 'Get Mass Properties',
  'check_interference': 'Check Interference',
  'measure_distance': 'Measure Distance',
  'analyze_draft': 'Analyze Draft',
  'check_geometry': 'Check Geometry',
  'get_bounding_box': 'Get Bounding Box',
  'estimate_volume': 'Estimate Volume',

  // VBA tools
  'generate_vba_script': 'Generate VBA Script',
  'create_feature_vba': 'Create Feature VBA',
  'create_batch_vba': 'Create Batch VBA',
  'run_vba_macro': 'Run VBA Macro',
  'create_drawing_vba': 'Create Drawing VBA',
  'vba_create_reference_geometry': 'VBA: Create Reference Geometry',
  'vba_create_part_features': 'VBA: Create Part Features',
  'vba_create_assembly_mates': 'VBA: Create Assembly Mates',
  'vba_export_drawing': 'VBA: Export Drawing',
  'vba_batch_process_files': 'VBA: Batch Process Files',
  'vba_update_custom_properties': 'VBA: Update Custom Properties',

  // Template manager tools
  'extract_drawing_template': 'Extract Drawing Template',
  'apply_drawing_template': 'Apply Drawing Template',
  'list_available_templates': 'List Available Templates',
  'create_template_from_drawing': 'Create Template from Drawing',

  // Native macro tools
  'run_native_macro': 'Run Native Macro',
  'record_native_macro': 'Record Native Macro',
  'stop_macro_recording': 'Stop Macro Recording',

  // Diagnostic tools
  'get_system_info': 'Get System Info',
  'check_solidworks_connection': 'Check SolidWorks Connection',
  'get_active_document_info': 'Get Active Document Info',
  'list_open_documents': 'List Open Documents',
  'validate_model_integrity': 'Validate Model Integrity',

  // Macro security tools
  'check_macro_security': 'Check Macro Security',
  'set_macro_security_level': 'Set Macro Security Level',
  'validate_macro_signature': 'Validate Macro Signature',

  // Macro recording tools
  'macro_start_recording': 'Start Macro Recording',
  'macro_stop_recording': 'Stop Macro Recording',
  'macro_export_vba': 'Export Macro as VBA',
  'macro_get_status': 'Get Macro Recording Status',
};

/**
 * Get friendly title for a tool name
 * Falls back to the tool name if no mapping exists
 */
export function getToolTitle(toolName: string): string {
  return toolTitleMap[toolName] || toolName;
}

