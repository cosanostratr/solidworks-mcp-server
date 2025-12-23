/**
 * Integration tests for Connection Manager
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { ConnectionManager } from '../../../src/solidworks/operations/connection.js';
import { setupBeforeTest, teardownAfterTest } from '../../helpers/solidworks-setup.js';

describe('Connection Manager Integration', () => {
  let connectionMgr: ConnectionManager;

  beforeAll(async () => {
    await setupBeforeTest();
  });

  afterAll(async () => {
    await teardownAfterTest();
  });

  beforeEach(() => {
    connectionMgr = new ConnectionManager();
  });

  afterEach(() => {
    if (connectionMgr.isConnected()) {
      connectionMgr.disconnect();
    }
  });

  it('should connect to SolidWorks', () => {
    connectionMgr.connect();
    expect(connectionMgr.isConnected()).toBe(true);
  });

  it('should get SolidWorks application', () => {
    connectionMgr.connect();
    const app = connectionMgr.getApp();
    expect(app).not.toBeNull();
  });

  it('should disconnect from SolidWorks', () => {
    connectionMgr.connect();
    connectionMgr.disconnect();
    expect(connectionMgr.isConnected()).toBe(false);
  });

  it('should set app manually', () => {
    connectionMgr.connect();
    const app = connectionMgr.getApp();
    connectionMgr.setApp(null);
    expect(connectionMgr.isConnected()).toBe(false);
    
    if (app) {
      connectionMgr.setApp(app);
      expect(connectionMgr.isConnected()).toBe(true);
    }
  });
});

