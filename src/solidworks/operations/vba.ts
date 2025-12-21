import { ISldWorksApp } from '../types/com-types.js';

/**
 * VBA operations: run macros
 */
export class VBAOperations {
  /**
   * Run a VBA macro
   */
  static runMacro(
    swApp: ISldWorksApp | null,
    macroPath: string,
    moduleName: string,
    procedureName: string,
    args: unknown[] = []
  ): unknown {
    if (!swApp) throw new Error('Not connected to SolidWorks');

    try {
      // Method 1: Try RunMacro2 with all parameters
      const result = swApp.RunMacro2(
        String(macroPath),
        String(moduleName),
        String(procedureName),
        1,  // swRunMacroUnloadAfterRun
        0   // Error code (out parameter)
      );
      return result;
    } catch (e) {
      // If RunMacro2 fails, try RunMacro (older method)
      try {
        const result = swApp.RunMacro(
          String(macroPath),
          String(moduleName),
          String(procedureName)
        );
        return result;
      } catch (e2) {
        throw new Error(`Failed to run macro: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}

