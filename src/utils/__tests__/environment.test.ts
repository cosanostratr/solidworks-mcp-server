/**
 * Unit tests for Environment Configuration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadEnvironment,
  isCI,
  isTest,
  validateEnvironment,
  getSolidWorksVersion,
  resetEnvironment
} from '../environment.js';

describe('Environment Configuration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    resetEnvironment();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    resetEnvironment();
  });

  describe('loadEnvironment', () => {
    it('should load default configuration', () => {
      const env = loadEnvironment();

      expect(env.solidworks.version).toBe('2024');
      expect(env.logging.level).toBe('info');
      expect(env.features.macroRecording).toBe(true);
    });

    it('should parse SOLIDWORKS_VERSION', () => {
      process.env.SOLIDWORKS_VERSION = '2023';
      resetEnvironment();

      const env = loadEnvironment();

      expect(env.solidworks.version).toBe('2023');
    });

    it('should parse feature flags', () => {
      process.env.ENABLE_MACRO_RECORDING = 'false';
      resetEnvironment();

      const env = loadEnvironment();

      expect(env.features.macroRecording).toBe(false);
    });

    it('should parse logging configuration', () => {
      process.env.LOG_LEVEL = 'debug';
      process.env.LOG_FILE = './test.log';
      resetEnvironment();

      const env = loadEnvironment();

      expect(env.logging.level).toBe('debug');
      expect(env.logging.file).toBe('./test.log');
    });

    it('should parse performance settings', () => {
      process.env.ENABLE_CONNECTION_POOL = 'true';
      process.env.CONNECTION_POOL_MAX_SIZE = '10';
      process.env.ENABLE_CIRCUIT_BREAKER = 'true';
      process.env.CIRCUIT_BREAKER_THRESHOLD = '3';
      resetEnvironment();

      const env = loadEnvironment();

      expect(env.performance.enableConnectionPool).toBe(true);
      expect(env.performance.connectionPoolMaxSize).toBe(10);
      expect(env.performance.enableCircuitBreaker).toBe(true);
      expect(env.performance.circuitBreakerThreshold).toBe(3);
    });
  });

  describe('isCI', () => {
    it('should detect GitHub Actions', () => {
      process.env.GITHUB_ACTIONS = 'true';

      expect(isCI()).toBe(true);
    });

    it('should detect generic CI flag', () => {
      process.env.CI = 'true';

      expect(isCI()).toBe(true);
    });

    it('should return false when not in CI', () => {
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;

      expect(isCI()).toBe(false);
    });
  });

  describe('isTest', () => {
    it('should detect test environment from NODE_ENV', () => {
      process.env.NODE_ENV = 'test';

      expect(isTest()).toBe(true);
    });

    it('should detect Vitest', () => {
      process.env.VITEST = 'true';

      expect(isTest()).toBe(true);
    });

    it('should return false when not in test', () => {
      delete process.env.NODE_ENV;
      delete process.env.VITEST;
      delete process.env.JEST_WORKER_ID;

      expect(isTest()).toBe(false);
    });
  });

  describe('validateEnvironment', () => {
    it('should validate correct configuration', () => {
      const env = loadEnvironment();

      const result = validateEnvironment(env);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid version', () => {
      process.env.SOLIDWORKS_VERSION = '2015';
      resetEnvironment();

      const env = loadEnvironment();
      const result = validateEnvironment(env);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid SolidWorks version'))).toBe(true);
    });

  });

  describe('getSolidWorksVersion', () => {
    it('should return configured version', () => {
      process.env.SOLIDWORKS_VERSION = '2023';
      resetEnvironment();

      const env = loadEnvironment();
      const version = getSolidWorksVersion(env);

      expect(version).toBe('2023');
    });
  });
});
