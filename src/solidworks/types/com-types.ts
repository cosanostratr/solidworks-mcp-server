/**
 * TypeScript definitions for SolidWorks COM interfaces
 *
 * These interfaces provide type safety for COM object interactions
 * through winax, preventing runtime errors and improving IDE support.
 */

// ============================================
// Core SolidWorks Application Interface
// ============================================

export interface ISldWorksApp {
  Visible: boolean;
  ActiveDoc: IModelDoc2 | null;
  FrameState: number;

  // Document operations
  OpenDoc6(
    fileName: string,
    type: number,
    options: number,
    configuration: string,
    errors: { value: number } | number,
    warnings: { value: number } | number
  ): IModelDoc2 | null;

  OpenDoc5(
    fileName: string,
    type: number,
    options: number,
    errors: { value: number } | number,
    warnings: { value: number } | number
  ): IModelDoc2 | null;

  CloseDoc(fileName: string): boolean;
  NewDocument(templateName: string, paperSize: number, width: number, height: number): IModelDoc2 | null;
  NewPart(): IModelDoc2 | null;
  NewAssembly(): IModelDoc2 | null;
  NewDrawing(paperSize: number, width: number, height: number): IModelDoc2 | null;
  NewDrawing2?(useDefaultTemplate: number, template: string, paperSize: number, width: number, height: number): IModelDoc2 | null;
  ActivateDoc2(docName: string, useUserPreferences: boolean, errors: { value: number } | number): boolean;
  GetActiveDoc(): IModelDoc2 | null;
  GetDocuments(): IModelDoc2[];
  GetProcessID(): number;

  // Macro operations
  RunMacro2(
    macroPath: string,
    moduleName: string,
    procedureName: string,
    options: number,
    error?: { value: number } | number
  ): unknown;

  RunMacro(
    macroPath: string,
    moduleName: string,
    procedureName: string
  ): unknown;

  RecordMacro?(macroPath: string): unknown;
  StopMacroRecording?(): unknown;
  PauseMacroRecording?(): unknown;
  ResumeMacroRecording?(): unknown;
  EditMacro?(macroPath: string): unknown;
  GetAddInObject?(progId: string): unknown;

  // Utility methods
  GetDocumentCount(): number;
  GetOpenDocumentName(index: number): string;
  SendMsgToUser(message: string): number;
  SetUserPreferenceToggle(preference: number, value: boolean): boolean;
  GetUserPreferenceToggle(preference: number): boolean;
  GetUserPreferenceStringValue(preference: number): string;
  GetExportFileData(version: number): unknown;

  // Index signature for dynamic property/method access
  [key: string]: unknown;
}

// ============================================
// Model Document Interface
// ============================================

export interface IModelDoc2 {
  // Properties
  GetType(): number;
  GetPathName(): string;
  GetTitle(): string;

  // Managers
  Extension: IModelDocExtension;
  SelectionManager: ISelectionMgr;
  FeatureManager: IFeatureManager;
  SketchManager: ISketchManager;

  // Document operations
  Save3(options: number, errors: { value: number } | number, warnings: { value: number } | number): boolean;
  Save(): boolean;
  SaveAs3(fileName: string, version: number, options: number): boolean;
  SaveAs4(fileName: string, version: number, options: number, errors: { value: number } | number, warnings: { value: number } | number): boolean;
  EditRebuild3(): boolean;
  EditRebuild(): boolean;
  ForceRebuild3(topLevelOnly: boolean): boolean;
  ForceRebuild?(): boolean;
  Rebuild?(option: number): boolean;

  // Selection operations
  ClearSelection2(markAll: boolean | number): number; // VARIANT_BOOL: -1 for true, 0 for false

  // Sketch operations
  InsertSketch2(insertOnPlane: boolean): ISketch | null;
  SketchAddConstraints(constraintType: string): number;
  EditSketch(): void;

  // Feature operations
  FeatureByPositionReverse(position: number): IFeature | null;
  FirstFeature(): IFeature | null;
  FeatureByName(name: string): IFeature | null;
  GetFeatureCount(): number;

  // Dimension operations
  Parameter(name: string): IParameter | null;
  GetParameter(name: string): IParameter | null;

  // Equation manager
  GetEquationMgr(): IEquationMgr | null;

  // Mass properties
  GetMassProperties(): IMassProperty | null;
  GetMassProperties2?(options: number): IMassProperty | null;

  // View operations
  GetFirstView(): IView | null;
  GetCurrentSheet(): ISheet | null;
  SetupSheet5(name: string, paperSize: number, templateIn: number, scale1: number, scale2: number, firstAngle: boolean, templatePath: string, width: number, height: number, propertyViewName: string, useCustomPropertyView: boolean): boolean;

  // User preferences
  GetUserPreferenceIntegerValue(preference: number): number;
  GetUserPreferenceStringValue(preference: number): string;
  GetUserPreferenceDoubleValue(preference: number): number;
  SetUserPreferenceIntegerValue(preference: number, value: number): boolean;
  SetUserPreferenceStringValue(preference: number, value: string): boolean;
  SetUserPreferenceDoubleValue(preference: number, value: number): boolean;

  // Assembly-specific properties
  InterferenceDetectionManager?: IInterferenceDetectionManager;
  ToolsCheck?: unknown;

  // Part-specific methods
  GetPartBox?(includeRefGeometry: boolean): number[] | null;
  GetBodies2?(bodyType: number, visibleOnly: boolean): unknown[] | null;

  // Dimension methods
  AddDimension2?(x: number, y: number, z: number): IDimension | null;
  AddRadialDimension2?(x: number, y: number, z: number): unknown;
  AddDiameterDimension2?(x: number, y: number, z: number): unknown;

  // Configuration methods
  GetActiveConfiguration?(): IConfiguration | null;
  AddConfiguration3?(name: string, description: string, alternateName: string, options: number, parentName: string): IConfiguration | null;
  ShowConfiguration2?(name: string): boolean;

  // Export methods
  SaveBMP?(filename: string, width: number, height: number): boolean;
  ViewZoomtofit2?(): boolean;

  // Drawing-specific methods
  CreateDrawViewFromModelView3?(modelPath: string, viewName: string, x: number, y: number, z: number): IView | null;
  CreateUnfoldedViewAt3?(x: number, y: number, z: number, suppressTopView: boolean): IView | null;
  AddDimension2?(x: number, y: number, z: number): IDimension | null;

  // Index signature for dynamic property/method access
  [key: string]: unknown;
}

// ============================================
// Model Document Extension Interface
// ============================================

export interface IModelDocExtension {
  SelectByID2(
    name: string,
    type: string,
    x: number,
    y: number,
    z: number,
    append: boolean | number, // VARIANT_BOOL: -1 for true, 0 for false
    mark: number,
    callout: unknown,
    selectOption: number
  ): boolean;

  SelectByRay(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    selType: number,
    append: boolean,
    mark: number
  ): boolean;

  SaveAs(
    fileName: string,
    version: number,
    options: number,
    customInfo: unknown,
    errors: { value: number } | number,
    warnings: { value: number } | number
  ): boolean;

  SaveAs2?(
    fileName: string,
    version: number,
    options: number,
    customInfo: unknown,
    errors: { value: number } | number,
    warnings: { value: number } | number,
    notes: unknown
  ): boolean;

  SaveAs3(
    fileName: string,
    version: number,
    options: number,
    customInfo: unknown,
    errors: { value: number } | number,
    warnings: { value: number } | number
  ): boolean;

  GetParameter(name: string): IParameter | null;
  CreateMassProperty(): IMassProperty | null;
  CreateMassProperty2?(): IMassProperty | null;
  CustomPropertyManager(configName: string): ICustomPropertyManager | null;
  RunCheck3(checkType: number, options: unknown): unknown;
  ToolsCheck(checkGeometry: boolean, shortEdges: boolean, minimumRadius: boolean, invalidSketches: boolean, zeroThickness: boolean): unknown;
  GetBox(includeRefGeometry: boolean): number[] | null;
  SetUserPreferenceInteger?(preference: number, option: number, value: number): boolean;
  AutoDimension?(type: number): boolean;
  SelectAll(): boolean;
}

// ============================================
// Selection Manager Interface
// ============================================

export interface ISelectionMgr {
  GetSelectedObjectCount(): number;
  GetSelectedObjectCount2(mark: number): number;
  GetSelectedObject6(index: number, mark: number): unknown;
  GetSelectedObjectType3(index: number, mark: number): number;
  DeSelect2(index: number, mark: number): boolean;
  SuspendSelectionList(): boolean;
  ResumeSelectionList(): boolean;
}

// ============================================
// Interference Detection Manager Interface
// ============================================

export interface IInterferenceDetectionManager {
  TreatCoincidenceAsInterference?: boolean;
  TreatSubAssembliesAsComponents?: boolean;
  IncludeMultibodyPartInterferences?: boolean;
  GetInterferences?(): unknown[];
  GetInterferenceCount?(): number;
}

// ============================================
// Sheet and Drawing Interfaces
// ============================================

export interface ISheet {
  GetSheetFormat?(): ISheetFormat | null;
  GetProperties?(): number[];
  GetName?(): string;
  GetTemplateName?(): string;
  GetZoneHorizontalCount?(): number;
  GetZoneVerticalCount?(): number;
  SetScale?(numerator: number, denominator: number): boolean;
}

export interface ISheetFormat {
  GetName?(): string;
  GetProperties?(): number[];
}

export interface IView {
  GetName?(): string;
  GetName2?(): string;
  GetNextView?(): IView | null;
  GetOutline?(): number[] | null;
  GetDisplayData?(): unknown;
  SelectEntity?(append: boolean): boolean;
  SetDisplayMode3?(mode: number, updateFeature: boolean, options: unknown): boolean;
  Position?: number[];
  Name?: string;
  Type?: number;
  ScaleDecimal?: number;
  DisplayMode?: number;
  RenderMode?: number;
  Orientation?: number;
}

export interface IDimension {
  Name?: string;
  FullName?: string;
  DimensionType?: number;
  SystemValue?: number;

  SetText?(option: number, text: string): void;
  GetSystemValue?(): number;
  SetSystemValue?(value: number): boolean;
}

export interface IConfiguration {
  Name?: string;
  UseAlternateDisplayStateInDrawings?: boolean;
  AlternateDisplayState?: string;
}

export interface ICustomPropertyManager {
  Get(propertyName: string): [string, number]; // Returns [value, type]
  Get2(propertyName: string): [string]; // Returns [resolvedValue]
  Get3(propertyName: string, outValue: { value: string }, outResolvedValue: { value: string }): boolean;
  Set(propertyName: string, value: string): boolean;
  Add(propertyName: string, type: number, value: string): number;
  Add3(propertyName: string, type: number, value: string, option: number): number;
  Delete(propertyName: string): boolean;
  GetNames?(): string[] | null;
  Count?(): number;
}

// ============================================
// Feature Manager Interface
// ============================================

export interface IFeatureManager {
  // Extrusion operations
  FeatureExtrusion(
    sd: boolean | number,
    flip: boolean | number,
    dir: boolean | number,
    t1: number,
    t2: number,
    d1: number,
    d2: number,
    dchk1?: boolean | number,
    dchk2?: boolean | number,
    ddir1?: boolean | number,
    ddir2?: boolean | number,
    dang1?: number,
    dang2?: number
  ): IFeature | null;

  FeatureExtrusion2(
    sd: boolean | number,
    flip: boolean | number,
    dir: boolean | number,
    t1: number,
    t2: number,
    d1: number,
    d2: number,
    dchk1?: boolean | number,
    dchk2?: boolean | number,
    ddir1?: boolean | number,
    ddir2?: boolean | number,
    dang1?: number,
    dang2?: number,
    offsetReverse1?: boolean | number,
    offsetReverse2?: boolean | number,
    translateSurface1?: boolean | number,
    translateSurface2?: boolean | number
  ): IFeature | null;

  FeatureExtrusion3(
    sd: boolean | number,
    flip: boolean | number,
    dir: boolean | number,
    t1: number,
    t2: number,
    d1: number,
    d2: number,
    dchk1: boolean | number,
    dchk2: boolean | number,
    ddir1: boolean | number,
    ddir2: boolean | number,
    dang1: number,
    dang2: number,
    offsetReverse1: boolean | number,
    offsetReverse2: boolean | number,
    translateSurface1: boolean | number,
    translateSurface2: boolean | number,
    merge: boolean | number,
    flipSideToCut: boolean | number,
    update: boolean | number,
    startCondition: number,
    flipStartOffset: number,
    useFeatScope?: boolean | number, // Optional parameters
    assembly?: boolean | number,
    scope?: number,
    autoSelectComponents?: boolean | number,
    propagateFeatureToParts?: boolean | number
  ): IFeature | null;

  // Revolve operations
  FeatureRevolve(
    sd: boolean,
    flip: boolean,
    angle: number,
    setDirection: boolean,
    dir: number,
    t1: number,
    t2: number,
    setOpposite: boolean,
    merge: boolean,
    useFeatScope: boolean
  ): IFeature | null;

  FeatureRevolve2(
    sd: boolean | number,          // VARIANT_BOOL
    flip: boolean | number,        // VARIANT_BOOL
    angle: number,
    setDirection: boolean | number, // VARIANT_BOOL
    dir: number,
    t1: number,
    t2: number,
    setOpposite: boolean | number, // VARIANT_BOOL
    merge: boolean | number,       // VARIANT_BOOL
    useFeatScope: boolean | number, // VARIANT_BOOL
    useAutoSelect: boolean | number, // VARIANT_BOOL
    solidEndCap: boolean | number  // VARIANT_BOOL
  ): IFeature | null;

  // Pattern operations
  FeatureLinearPattern4(
    nX: number,
    nY: number,
    xSpacing: number,
    ySpacing: number,
    xOffset: number,
    yOffset: number,
    geometryPattern: boolean,
    dirType1: number,
    dirType2: number,
    seed: any,
    skippedItems: any,
    reverse1: boolean,
    reverse2: boolean,
    patternType: number,
    propagateVisualProperty: boolean,
    nSeedCount: number,
    filletType: number,
    featScope: boolean,
    autoSelect: boolean
  ): IFeature | null;

  FeatureCircularPattern2(
    n: number,
    spacing: number,
    nSkippedFirstInstances: number,
    axis: any,
    reversePattern: boolean,
    merge: boolean,
    propagateVisualProperty: boolean
  ): IFeature | null;

  // Fillet and chamfer operations
  InsertFeatureFillet(radius: number, type: number): IFeature | null;
  InsertChamfer(distance: number, angle: number): IFeature | null;

  // Loft/blend operations
  InsertProtrusionBlend2(
    connectorType: number,
    isTangent: boolean | number,      // VARIANT_BOOL
    isTangentToFace: boolean | number, // VARIANT_BOOL
    optimize: boolean | number,        // VARIANT_BOOL
    startTangent: unknown,
    endTangent: unknown
  ): IFeature | null;

  // Reference plane operations
  InsertRefPlane(
    firstConstraint: number,
    firstConstraintAngle: number,
    secondConstraint: number,
    secondConstraintAngleOrDistance: number,
    thirdConstraint: number,
    thirdConstraintAngle: number
  ): IFeature | null;
}

// ============================================
// Sketch Manager Interface
// ============================================

export interface ISketchManager {
  InsertSketch(preSelect: boolean): ISketch | null;
  CreateLine(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): ISketchSegment | null;
  CreateCenterLine(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): ISketchSegment | null;
  CreateCircle(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): ISketchSegment | null;
  CreateCircleByRadius(x: number, y: number, z: number, radius: number): ISketchSegment | null;
  CreateArc(x: number, y: number, z: number, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, dir: number): ISketchSegment | null;
  Create3PointArc(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, x3: number, y3: number, z3: number): ISketchSegment | null;
  CreateCornerRectangle(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): unknown;
  CreateCenterRectangle(x: number, y: number, z: number, x1: number, y1: number, z1: number): unknown;
  CreateEllipse(x: number, y: number, z: number, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): unknown;
  CreatePolygon(x: number, y: number, z: number, x1: number, y1: number, z1: number, numSides: number, inscribed: boolean): unknown;
  CreateSpline(points: unknown): ISketchSegment | null;

  MirrorSketch(): unknown;
  SketchOffset2(
    offset: number,
    chain: boolean | number,
    cap: boolean,
    baseConstruction?: boolean,
    addDimension?: boolean,
    bidirectional?: boolean,
    makeBaseConstruction?: boolean
  ): unknown;

  AddToDB?: boolean;
  DisplayWhenAdded?: boolean;
  ActiveSketch: ISketch | null;
}

// ============================================
// Sketch Interface
// ============================================

export interface ISketch {
  Name?: string;
  GetName(): string;
  SetName(name: string): void;
  GetSketchSegments(): unknown; // Returns COM collection
  GetSketchSegmentCount?(): number;
  GetSketchPoints2(): unknown;   // Returns COM collection
  Select2(append: boolean | number, mark: number): boolean; // VARIANT_BOOL: -1 for true, 0 for false
  Select4(append: boolean | number, data: unknown): boolean; // VARIANT_BOOL: -1 for true, 0 for false
  GetFeature(): IFeature | null;
  GetConstraintsCount?(): number;
}

// ============================================
// Sketch Segment Interface
// ============================================

export interface ISketchSegment {
  // Properties
  Name?: string;
  ConstructionGeometry: boolean;

  // Methods
  GetType(): number;
  GetName(): string;
  GetLength(): number;
  GetStartPoint2(): ISketchPoint | null;
  GetEndPoint2(): ISketchPoint | null;
  GetSketch?(): ISketch | null;
  Select4(append: boolean | number, data: unknown): boolean; // VARIANT_BOOL: -1 for true, 0 for false
}

// ============================================
// Sketch Point Interface
// ============================================

export interface ISketchPoint {
  X: number;
  Y: number;
  Z: number;
  Select4(append: boolean, data: any): boolean;
}

// ============================================
// Feature Interface
// ============================================

export interface IFeature {
  Name: string;
  GetName(): string;
  GetTypeName(): string;
  GetTypeName2(): string;
  IsSuppressed(): boolean;
  GetNextFeature(): IFeature | null;
  GetSpecificFeature2(): unknown;
  Select2(append: boolean | number, mark: number): boolean; // VARIANT_BOOL: -1 for true, 0 for false
  SetSuppression2(state: number, configOptions: number, configNames: string[]): number;

  // Display dimension methods
  GetFirstDisplayDimension?(): IDisplayDimension | null;
  GetNextDisplayDimension?(current: IDisplayDimension): IDisplayDimension | null;

  // Additional feature methods
  Update?(): boolean;
  Recalculate?(): boolean;
}

// ============================================
// Display Dimension Interface
// ============================================

export interface IDisplayDimension {
  GetName?(): string;
  GetSystemValue?(): number;
  SetSystemValue?(value: number): boolean;
  GetNameForSelection?(): string;
  GetDimension2?(mark: number): IDimension | null;
}

// ============================================
// Mass Property Interface
// ============================================

export interface IMassProperty {
  Mass?: number;
  Volume?: number;
  SurfaceArea?: number;
  CenterOfMass?: number[];
  Density?: number;
  MomentOfInertia?: number[];

  // Methods
  Update?(): boolean;
  Recalculate?(): boolean;
  SetStep203?(value: boolean): void;
}

// ============================================
// Parameter Interface
// ============================================

export interface IParameter {
  GetName(): string;
  GetValue(): number;
  SetValue(value: number): boolean;
  GetSystemValue(): number;
  SetSystemValue(value: number): boolean;
  SystemValue: number; // Property accessor
}

// ============================================
// Equation Manager Interface
// ============================================

export interface IEquationMgr {
  GetCount(): number;
  Equation: string[];
  Add3(equation: string, isSuppressed: boolean, configuration: string): number;
  Delete(index: number): boolean;
  SetEquationAndConfigurationOption(
    index: number,
    equation: string,
    configurationOption: number,
    configurationNames: string[]
  ): boolean;
}

// ============================================
// SolidWorks Enumerations
// ============================================

export enum swDocumentTypes_e {
  swDocNONE = 0,
  swDocPART = 1,
  swDocASSEMBLY = 2,
  swDocDRAWING = 3
}

export enum swSelectType_e {
  swSelNOTHING = 0,
  swSelEDGES = 1,
  swSelFACES = 2,
  swSelVERTICES = 3,
  swSelSKETCHSEGMENTS = 4,
  swSelEXTSKETCHSEGMENTS = 5,
  swSelSKETCHPOINTS = 6,
  swSelEXTSKETCHPOINTS = 7,
  swSelDATUMPLANES = 8,
  swSelDATUMAXES = 9,
  swSelORIGINS = 10,
  swSelDATUMPOINTS = 11,
  swSelCOMPONENTS = 20,
  swSelBODYFEATURES = 23,
  swSelDIMENSIONS = 29,
  swSelSKETCHES = 31
}

export enum swEndConditions_e {
  swEndCondBlind = 0,
  swEndCondThroughAll = 1,
  swEndCondUpToNext = 2,
  swEndCondUpToVertex = 3,
  swEndCondUpToSurface = 4,
  swEndCondOffsetFromSurface = 5,
  swEndCondUpToBody = 6,
  swEndCondMidPlane = 7
}

export enum swFeatureNameID_e {
  swFmExtrusion = 1,
  swFmCut = 2,
  swFmRevolve = 3,
  swFmRevolveCut = 4,
  swFmSweep = 5,
  swFmSweepCut = 6,
  swFmLoft = 7,
  swFmLoftCut = 8,
  swFmFillet = 9,
  swFmChamfer = 10,
  swFmHole = 11,
  swFmPattern = 12,
  swFmShell = 13
}

export enum swOpenDocOptions_e {
  swOpenDocOptions_Silent = 1,
  swOpenDocOptions_ReadOnly = 2,
  swOpenDocOptions_RapidDraft = 4,
  swOpenDocOptions_DontLoadHiddenComponents = 8,
  swOpenDocOptions_LoadExternalReferencesInMemory = 16,
  swOpenDocOptions_ViewOnly = 32,
  swOpenDocOptions_LoadLightweight = 128
}

// ============================================
// Type Guards
// ============================================

export function isValidCOMObject<T>(obj: T | null | undefined): obj is T {
  return obj !== null && obj !== undefined;
}

export function assertCOMObject<T>(obj: T | null | undefined, errorMessage: string): asserts obj is T {
  if (!isValidCOMObject(obj)) {
    throw new Error(errorMessage);
  }
}
