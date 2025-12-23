/**
 * Unit tests for Logger utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  logger,
  logInfo,
  logError,
  logWarning,
  logDebug,
  logOperation,
  logResource,
  logAPICall
} from '../../src/utils/logger.js';

describe('Logger Utilities', () => {
  describe('logger instance', () => {
    it('should be defined', () => {
      expect(logger).toBeDefined();
    });

    it('should have info method', () => {
      expect(typeof logger.info).toBe('function');
    });

    it('should have error method', () => {
      expect(typeof logger.error).toBe('function');
    });

    it('should have warn method', () => {
      expect(typeof logger.warn).toBe('function');
    });

    it('should have debug method', () => {
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('logInfo', () => {
    it('should call logger.info', () => {
      expect(() => logInfo('Test message')).not.toThrow();
    });

    it('should accept metadata', () => {
      expect(() => logInfo('Test message', { key: 'value' })).not.toThrow();
    });
  });

  describe('logError', () => {
    it('should handle Error objects', () => {
      const error = new Error('Test error');
      expect(() => logError('Test message', error)).not.toThrow();
    });

    it('should handle non-Error values', () => {
      expect(() => logError('Test message', 'string error')).not.toThrow();
    });

    it('should handle undefined error', () => {
      expect(() => logError('Test message')).not.toThrow();
    });
  });

  describe('logWarning', () => {
    it('should call logger.warn', () => {
      expect(() => logWarning('Test message')).not.toThrow();
    });
  });

  describe('logDebug', () => {
    it('should call logger.debug', () => {
      expect(() => logDebug('Test message')).not.toThrow();
    });
  });

  describe('logOperation', () => {
    it('should log started status', () => {
      expect(() => logOperation('test-op', 'started')).not.toThrow();
    });

    it('should log completed status', () => {
      expect(() => logOperation('test-op', 'completed')).not.toThrow();
    });

    it('should log failed status', () => {
      expect(() => logOperation('test-op', 'failed')).not.toThrow();
    });

    it('should accept metadata', () => {
      expect(() => logOperation('test-op', 'started', { key: 'value' })).not.toThrow();
    });
  });

  describe('logResource', () => {
    it('should log resource operations', () => {
      expect(() => logResource('model', 'created', 'model-123')).not.toThrow();
    });

    it('should accept metadata', () => {
      expect(() => logResource('model', 'created', 'model-123', { key: 'value' })).not.toThrow();
    });
  });

  describe('logAPICall', () => {
    it('should log successful API calls', () => {
      expect(() => logAPICall('GET', '/api/test', 200)).not.toThrow();
    });

    it('should log failed API calls', () => {
      expect(() => logAPICall('GET', '/api/test', 500)).not.toThrow();
    });

    it('should accept duration', () => {
      expect(() => logAPICall('GET', '/api/test', 200, 150)).not.toThrow();
    });
  });
});

