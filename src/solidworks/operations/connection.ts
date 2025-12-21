import winax from 'winax';
import { logger } from '../utils/logger.js';
import { ISldWorksApp } from '../types/com-types.js';

/**
 * Connection management for SolidWorks API
 * Handles connecting and disconnecting from SolidWorks application
 */
export class ConnectionManager {
  private swApp: ISldWorksApp | null = null;

  connect(): void {
    try {
      // Create or get running instance of SolidWorks
      this.swApp = new winax.Object('SldWorks.Application') as ISldWorksApp;
      this.swApp.Visible = true;
      logger.info('Connected to SolidWorks');
    } catch (error) {
      // Try alternative connection method
      try {
        this.swApp = winax.Object('SldWorks.Application') as ISldWorksApp;
        this.swApp.Visible = true;
        logger.info('Connected to SolidWorks (alternative method)');
      } catch (error2) {
        logger.error('Failed to connect to SolidWorks', error2);
        throw new Error(`Failed to connect to SolidWorks: ${error2}`);
      }
    }
  }

  disconnect(): void {
    if (this.swApp) {
      // Don't close SolidWorks, just disconnect
      this.swApp = null;
    }
  }

  isConnected(): boolean {
    return this.swApp !== null;
  }

  getApp(): ISldWorksApp | null {
    return this.swApp;
  }

  setApp(app: ISldWorksApp | null): void {
    this.swApp = app;
  }
}

