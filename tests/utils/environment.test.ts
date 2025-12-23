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
} from '../../src/utils/environment.js';

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

    it('should parse state settings', () => {
      process.env.STATE_FILE = './custom-state.json';
      process.env.STATE_AUTO_SAVE_INTERVAL = '30000';
      resetEnvironment();

      const env = loadEnvironment();

      expect(env.state.file).toBe('./custom-state.json');
      expect(env.state.autoSaveInterval).toBe(30000);
    });

    it('should parse template settings', () => {
      process.env.TEMPLATE_PART = './templates/part.prtdot';
      process.env.TEMPLATE_ASSEMBLY = './templates/assembly.asmdot';
      process.env.TEMPLATE_DRAWING = './templates/drawing.drwdot';
      resetEnvironment();

      const env = loadEnvironment();

      expect(env.templates.part).toBe('./templates/part.prtdot');
      expect(env.templates.assembly).toBe('./templates/assembly.asmdot');
      expect(env.templates.drawing).toBe('./templates/drawing.drwdot');
    });

    it('should parse dev mode settings', () => {
      process.env.DEV_MODE = 'true';
      process.env.DEV_PORT = '8080';
      resetEnvironment();

      const env = loadEnvironment();

      expect(env.dev.mode).toBe(true);
      expect(env.dev.port).toBe(8080);
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

    it('should detect GitLab CI', () => {
      process.env.GITLAB_CI = 'true';

      expect(isCI()).toBe(true);
    });

    it('should detect Jenkins', () => {
      process.env.JENKINS_HOME = '/var/jenkins';

      expect(isCI()).toBe(true);
    });

    it('should detect Travis CI', () => {
      process.env.TRAVIS = 'true';

      expect(isCI()).toBe(true);
    });

    it('should detect CircleCI', () => {
      process.env.CIRCLECI = 'true';

      expect(isCI()).toBe(true);
    });

    it('should return false when not in CI', () => {
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;
      delete process.env.GITLAB_CI;
      delete process.env.JENKINS_HOME;
      delete process.env.TRAVIS;
      delete process.env.CIRCLECI;

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

    it('should detect Jest', () => {
      process.env.JEST_WORKER_ID = '1';

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

    it('should reject invalid version (too old)', () => {
      process.env.SOLIDWORKS_VERSION = '2015';
      resetEnvironment();

      const env = loadEnvironment();
      const result = validateEnvironment(env);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid SolidWorks version'))).toBe(true);
    });

    it('should reject invalid version (too new)', () => {
      process.env.SOLIDWORKS_VERSION = '2035';
      resetEnvironment();

      const env = loadEnvironment();
      const result = validateEnvironment(env);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid SolidWorks version'))).toBe(true);
    });

    it('should accept valid versions', () => {
      for (const version of ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2030']) {
        process.env.SOLIDWORKS_VERSION = version;
        resetEnvironment();

        const env = loadEnvironment();
        const result = validateEnvironment(env);

        expect(result.valid).toBe(true);
      }
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

    it('should return default version when not configured', () => {
      delete process.env.SOLIDWORKS_VERSION;
      resetEnvironment();

      const env = loadEnvironment();
      const version = getSolidWorksVersion(env);

      expect(version).toBe('2024');
    });
  });

  describe('getEnvironment', () => {
    it('should return cached environment', async () => {
      const { getEnvironment } = await import('../../src/utils/environment.js');
      
      const env1 = getEnvironment();
      const env2 = getEnvironment();

      expect(env1).toBe(env2); // Should be the same instance
    });

    it('should reload after reset', async () => {
      const { getEnvironment, resetEnvironment } = await import('../../src/utils/environment.js');
      
      const env1 = getEnvironment();
      resetEnvironment();
      const env2 = getEnvironment();

      expect(env1).not.toBe(env2); // Should be different instances
    });
  });
});

