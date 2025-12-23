/**
 * Integration tests for SolidWorks MCP Server
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SolidWorksMCPServer } from '../src/index.js';
import { setupBeforeTest, teardownAfterTest } from './helpers/solidworks-setup.js';

// Use a single server instance for all tests in this file to avoid tool registration conflicts
let serverInstance: SolidWorksMCPServer | null = null;

describe('SolidWorks MCP Server', () => {
  beforeAll(async () => {
    try {
      await setupBeforeTest();
    } catch (error) {
      // SolidWorks may not be available in test environment
      // Skip connection-dependent tests if SolidWorks is not available
      console.warn('SolidWorks connection failed, some tests may be skipped:', error);
    }
  });

  afterAll(async () => {
    try {
      await teardownAfterTest();
    } catch (error) {
      // Ignore teardown errors
    }
    serverInstance = null;
  });

  beforeEach(() => {
    // Create a single server instance for all tests
    if (!serverInstance) {
      serverInstance = new SolidWorksMCPServer();
    }
  });

  it('should create server instance', () => {
    expect(serverInstance).toBeDefined();
  });

  it('should have server property', () => {
    // Access private property for testing
    expect((serverInstance as any).server).toBeDefined();
  });

  it('should have api property', () => {
    expect((serverInstance as any).api).toBeDefined();
  });

  it('should have macroRecorder property', () => {
    expect((serverInstance as any).macroRecorder).toBeDefined();
  });
});

