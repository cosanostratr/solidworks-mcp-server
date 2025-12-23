/**
 * SolidWorks Test Setup and Teardown Utilities
 * Provides functions to connect, disconnect, and manage SolidWorks instances for testing
 */

import winax from 'winax';
import { ISldWorksApp, IModelDoc2 } from '../../src/solidworks/types/com-types.js';
import { ConnectionManager } from '../../src/solidworks/operations/connection.js';
import { SolidWorksAPI } from '../../src/solidworks/api.js';

let globalSwApp: ISldWorksApp | null = null;
let globalSwApi: SolidWorksAPI | null = null;

/**
 * Connect to SolidWorks application
 * Reuses existing instance if available
 */
export async function connectSolidWorks(): Promise<ISldWorksApp> {
  if (globalSwApp) {
    try {
      // Verify the connection is still valid
      const version = (globalSwApp as any).RevisionNumber();
      if (version) {
        return globalSwApp;
      }
    } catch (error) {
      // Connection is invalid, reset it
      globalSwApp = null;
    }
  }

  try {
    // Try to get existing instance first
    globalSwApp = new winax.Object('SldWorks.Application') as ISldWorksApp;
    globalSwApp.Visible = true;
    return globalSwApp;
  } catch (error) {
    throw new Error(`Failed to connect to SolidWorks: ${error}`);
  }
}

/**
 * Get or create a SolidWorksAPI instance
 */
export function getSolidWorksAPI(): SolidWorksAPI {
  if (!globalSwApi) {
    globalSwApi = new SolidWorksAPI();
  }
  return globalSwApi;
}

/**
 * Ensure SolidWorks is connected
 */
export async function ensureSolidWorksConnected(): Promise<void> {
  const api = getSolidWorksAPI();
  if (!api.isConnected()) {
    api.connect();
  }
}

/**
 * Disconnect from SolidWorks (but don't close the application)
 */
export function disconnectSolidWorks(): void {
  if (globalSwApi) {
    try {
      globalSwApi.disconnect();
    } catch (error) {
      // Ignore disconnect errors
    }
  }
  globalSwApp = null;
  globalSwApi = null;
}

/**
 * Close all open documents without saving
 */
export async function closeAllDocuments(): Promise<void> {
  if (!globalSwApp) {
    return;
  }

  try {
    const docCount = globalSwApp.GetDocumentCount();
    for (let i = docCount - 1; i >= 0; i--) {
      const doc = globalSwApp.GetDocuments()[i] as IModelDoc2;
      if (doc) {
        try {
          globalSwApp.CloseDoc(doc.GetTitle()); // Close without saving
        } catch (error) {
          // Ignore errors when closing documents
        }
      }
    }
  } catch (error) {
    // Ignore errors
  }
}

/**
 * Clean up test environment
 */
export async function cleanupTestEnvironment(): Promise<void> {
  try {
    await closeAllDocuments();
  } catch (error) {
    // Ignore cleanup errors
  }
  
  // Don't disconnect completely to avoid slow reconnection
  // Just close documents
}

/**
 * Setup before each test
 */
export async function setupBeforeTest(): Promise<void> {
  await ensureSolidWorksConnected();
  await closeAllDocuments();
}

/**
 * Teardown after each test
 */
export async function teardownAfterTest(): Promise<void> {
  await cleanupTestEnvironment();
}

/**
 * Get the SolidWorks application instance
 */
export function getSwApp(): ISldWorksApp | null {
  return globalSwApp;
}

