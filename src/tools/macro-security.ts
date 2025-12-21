import { z } from 'zod';
import { SolidWorksAPI } from '../solidworks/api.js';

const securityResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  level: z.string().optional(),
  requiresRestart: z.boolean().optional(),
});

export const macroSecurityTools = [
  {
    name: 'macro_set_security',
    description: 'Attempt to set macro security level',
    inputSchema: z.object({
      level: z.enum(['low', 'medium', 'high']).describe('Security level to set'),
    }),
    outputSchema: securityResultSchema,
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const swApp = swApi.getApp();
        if (!swApp) {
          throw new Error('Not connected to SolidWorks');
        }
        
        const levels: Record<string, number> = { 'low': 0, 'medium': 1, 'high': 2 };
        const targetLevel = levels[args.level as string];
        
        // Try to set the macro security level
        // 77 = swUserPreferenceIntegerValue_e.swMacroSecurityLevel
        try {
          (swApp as any).SetUserPreferenceIntegerValue(77, targetLevel);

          // Verify the change
          const newLevel = (swApp as any).GetUserPreferenceIntegerValue(77);
          const levelNames = ['Low', 'Medium', 'High'];
          
          return {
            success: true,
            message: `Macro security set to: ${levelNames[newLevel]}`,
            level: levelNames[newLevel],
            requiresRestart: true,
          };
        } catch (e) {
          return {
            success: false,
            message: `Could not change security level: ${e instanceof Error ? e.message : String(e)}. You may need to change it manually in SolidWorks.`,
            requiresRestart: false,
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `Failed to set security: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  },
  
  {
    name: 'macro_get_security_info',
    description: 'Get detailed macro security information',
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      securityLevel: z.string().optional(),
      vbaEnabled: z.boolean().optional(),
      instructions: z.array(z.string()).optional(),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const swApp = swApi.getApp();
        if (!swApp) {
          throw new Error('Not connected to SolidWorks');
        }
        
        const info: string[] = [];
        
        // Get current security level
        try {
          const level = (swApp as any).GetUserPreferenceIntegerValue(77);
          const levels = ['Low (All macros run)', 'Medium (Prompt for macros)', 'High (Macros disabled)'];
          info.push(`Current Security Level: ${levels[level] || 'Unknown'}`);
        } catch (e) {
          info.push(`Could not read security level: ${e}`);
        }

        // Check if VBA is enabled
        try {
          // 197 = swUserPreferenceToggle_e.swMacroEnable
          const vbaEnabled = (swApp as any).GetUserPreferenceToggle(197);
          info.push(`VBA Macros Enabled: ${vbaEnabled ? 'Yes' : 'No'}`);
        } catch (e) {
          info.push(`Could not check VBA status: ${e}`);
        }

        // Try to enable VBA if disabled
        try {
          (swApp as any).SetUserPreferenceToggle(197, true);
          info.push('Attempted to enable VBA macros');
        } catch (e) {
          info.push(`Could not enable VBA: ${e}`);
        }
        
        const instructions = [
          '1. Tools → Add-Ins → Check "SolidWorks API SDK"',
          '2. Tools → Macro → Security (if available)',
          '3. Or Tools → Options → System Options',
          '4. Look for "Enable VBA macros" checkbox',
          '5. Set "Macro security" to Low or Medium',
        ];
        
        return {
          success: true,
          message: 'Security information retrieved',
          securityLevel: info[0]?.replace('Current Security Level: ', ''),
          vbaEnabled: info[1]?.includes('Yes'),
          instructions,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to get security info: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  },
];