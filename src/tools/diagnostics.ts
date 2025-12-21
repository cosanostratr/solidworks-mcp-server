import { z } from 'zod';
import { SolidWorksAPI } from '../solidworks/api.js';

const diagnosticResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  steps: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
});

export const diagnosticTools = [
  {
    name: 'diagnose_macro_execution',
    description: 'Diagnose macro execution issues with detailed logging',
    inputSchema: z.object({
      macroPath: z.string().describe('Full path to the macro file (.swp or .swb)'),
      moduleName: z.string().default('Module1').describe('Module name containing the procedure'),
      procedureName: z.string().describe('Procedure name to execute'),
    }),
    outputSchema: diagnosticResultSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      const results: string[] = [];
      
      try {
        // Step 1: Check SolidWorks connection
        results.push('Step 1: Checking SolidWorks connection...');
        const swApp = swApi.getApp();
        if (!swApp) {
          results.push('  ❌ ERROR: Not connected to SolidWorks');
          return results.join('\n');
        }
        results.push('  ✅ Connected to SolidWorks');
        
        // Step 2: Check if file exists (using SolidWorks API)
        results.push(`Step 2: Checking if macro file exists: ${args.macroPath}`);
        try {
          // Try to use FileSystemObject through SolidWorks
          const fso = (swApp as any).GetFileSystemObject();
          if (fso && fso.FileExists(args.macroPath)) {
            results.push('  ✅ File exists (verified via FileSystemObject)');
          } else {
            results.push('  ⚠️ File not found via FileSystemObject');
          }
        } catch (e) {
          results.push(`  ⚠️ Could not verify file existence: ${e}`);
        }

        // Step 3: Check macro security settings
        results.push('Step 3: Checking macro security settings...');
        try {
          const secLevel = (swApp as any).GetUserPreferenceIntegerValue(77);
          const secLevels = ['Low (Macros enabled)', 'Medium (Prompt for macros)', 'High (Macros disabled)'];
          results.push(`  Security Level: ${secLevels[secLevel] || 'Unknown'}`);
          if (secLevel === 2) {
            results.push('  ⚠️ WARNING: High security may block macro execution!');
          }
        } catch (e) {
          results.push(`  ⚠️ Could not check security level: ${e}`);
        }
        
        // Step 4: Try different RunMacro methods
        results.push('Step 4: Testing macro execution methods...');
        
        // Method 1: RunMacro2 with all parameters
        try {
          results.push('  Testing RunMacro2 (full parameters)...');
          const result = swApp.RunMacro2(
            args.macroPath,
            args.moduleName,
            args.procedureName,
            0, // swRunMacroDefault
            0  // error parameter
          );
          results.push(`    Result: ${result}`);
          if (result) {
            results.push('    ✅ SUCCESS: Macro executed!');
            return results.join('\n');
          }
        } catch (e) {
          results.push(`    ❌ Failed: ${e}`);
        }
        
        // Method 2: RunMacro2 without error parameter
        try {
          results.push('  Testing RunMacro2 (no error param)...');
          const result = swApp.RunMacro2(
            args.macroPath,
            args.moduleName,
            args.procedureName,
            2 // swRunMacroOption_Synchronously
          );
          results.push(`    Result: ${result}`);
          if (result) {
            results.push('    ✅ SUCCESS: Macro executed!');
            return results.join('\n');
          }
        } catch (e) {
          results.push(`    ❌ Failed: ${e}`);
        }
        
        // Method 3: Legacy RunMacro
        try {
          results.push('  Testing RunMacro (legacy)...');
          const result = swApp.RunMacro(
            args.macroPath,
            args.moduleName,
            args.procedureName
          );
          results.push(`    Result: ${result}`);
          if (result) {
            results.push('    ✅ SUCCESS: Macro executed!');
            return results.join('\n');
          }
        } catch (e) {
          results.push(`    ❌ Failed: ${e}`);
        }
        
        // Step 5: Alternative approach - try to open VBA editor
        results.push('Step 5: Attempting to open VBA editor...');
        try {
          (swApp as any).RunCommand(52); // swCommands_VbaEditMacro
          results.push('  ✅ VBA Editor command sent');
        } catch (e) {
          results.push(`  ❌ Could not open VBA editor: ${e}`);
        }
        
        results.push('\n📊 DIAGNOSIS COMPLETE');
        const recommendations = [
          '1. Macro file format issue (.swp vs .swb)',
          '2. Module/Procedure names don\'t match',
          '3. Macro security blocking execution',
          '4. VBA subsystem not initialized',
          '5. Macro contains errors',
        ];
        
        return {
          success: false,
          message: 'All macro execution methods failed',
          steps: results,
          recommendations,
        };
        
      } catch (error) {
        return {
          success: false,
          message: `Critical error: ${error instanceof Error ? error.message : String(error)}`,
          steps: results,
        };
      }
    },
  },
];