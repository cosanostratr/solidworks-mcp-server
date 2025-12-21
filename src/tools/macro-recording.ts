/**
 * Macro Recording Tools
 * Tools for recording and managing macro operations
 */

import { z } from 'zod';
import { MacroRecorder } from '../macro/index.js';
import { SolidWorksAPI } from '../solidworks/api.js';

/**
 * Create macro recording tools
 * Note: These tools require access to MacroRecorder instance
 * They are registered separately in index.ts with proper context binding
 */
export function createMacroRecordingTools(macroRecorder: MacroRecorder) {
  return [
    {
      name: 'macro_start_recording',
      description: 'Start recording a new macro',
      inputSchema: z.object({
        name: z.string(),
        description: z.string().optional()
      }),
      outputSchema: z.object({
        macroId: z.string(),
        status: z.string()
      }),
      handler: (args: any, swApi: SolidWorksAPI) => {
        const id = macroRecorder.startRecording(args.name, args.description);
        return { macroId: id, status: 'recording' };
      }
    },
    {
      name: 'macro_stop_recording',
      description: 'Stop the current macro recording',
      inputSchema: z.object({}),
      outputSchema: z.object({
        id: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        actions: z.array(z.any()).optional(),
        error: z.string().optional()
      }),
      handler: (args: any, swApi: SolidWorksAPI) => {
        const recording = macroRecorder.stopRecording();
        return recording || { error: 'No recording in progress' };
      }
    },
    {
      name: 'macro_export_vba',
      description: 'Export a recorded macro to VBA code',
      inputSchema: z.object({
        macroId: z.string()
      }),
      outputSchema: z.object({
        code: z.string()
      }),
      handler: (args: any, swApi: SolidWorksAPI) => {
        const vbaCode = macroRecorder.exportToVBA(args.macroId);
        return { code: vbaCode };
      }
    }
  ];
}

