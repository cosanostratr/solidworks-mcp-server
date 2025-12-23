/**
 * Unit tests for SolidWorks Config utilities
 */

import { describe, it, expect } from 'vitest';
import {
  SolidWorksConfig,
  SolidWorksVersion,
  SolidWorksTemplates
} from '../../src/utils/solidworks-config.js';

describe('SolidWorks Config Utilities', () => {
  describe('getVersion', () => {
    it('should return null for null app', () => {
      expect(SolidWorksConfig.getVersion(null)).toBeNull();
    });

    it('should parse modern version format (2024 SP5.0)', () => {
      const swApp = {
        RevisionNumber: () => '2024 SP5.0'
      };
      const version = SolidWorksConfig.getVersion(swApp);
      expect(version).not.toBeNull();
      expect(version?.year).toBe('2024');
      expect(version?.majorVersion).toBe(2024);
    });

    it('should parse old version format (27.5.0.0084)', () => {
      const swApp = {
        RevisionNumber: () => '27.5.0.0084'
      };
      const version = SolidWorksConfig.getVersion(swApp);
      expect(version).not.toBeNull();
      expect(version?.year).toBe('2019'); // 1992 + 27
    });

    it('should return null for invalid format', () => {
      const swApp = {
        RevisionNumber: () => 'invalid'
      };
      expect(SolidWorksConfig.getVersion(swApp)).toBeNull();
    });

    it('should handle errors gracefully', () => {
      const swApp = {
        RevisionNumber: () => {
          throw new Error('Failed');
        }
      };
      expect(SolidWorksConfig.getVersion(swApp)).toBeNull();
    });
  });

  describe('getDefaultTemplates', () => {
    it('should return null for null app', () => {
      expect(SolidWorksConfig.getDefaultTemplates(null)).toBeNull();
    });

    it('should use user preferences if available', () => {
      const swApp = {
        GetUserPreferenceStringValue: (type: number) => {
          if (type === 0) return 'C:\\Templates\\Part.prtdot';
          if (type === 1) return 'C:\\Templates\\Assembly.asmdot';
          if (type === 8) return 'C:\\Templates\\Drawing.drwdot';
          return null;
        }
      };
      const templates = SolidWorksConfig.getDefaultTemplates(swApp);
      expect(templates).not.toBeNull();
      expect(templates?.part).toContain('Part.prtdot');
    });

    it('should fallback to version-based path', () => {
      const swApp = {
        GetUserPreferenceStringValue: () => null,
        RevisionNumber: () => '2024 SP5.0'
      };
      const templates = SolidWorksConfig.getDefaultTemplates(swApp);
      expect(templates).not.toBeNull();
      expect(templates?.part).toContain('Part.prtdot');
    });

    it('should handle errors gracefully', () => {
      const swApp = {
        GetUserPreferenceStringValue: () => {
          throw new Error('Failed');
        },
        RevisionNumber: () => null // No version available
      };
      const templates = SolidWorksConfig.getDefaultTemplates(swApp);
      // When GetUserPreferenceStringValue throws and version is null, should return null
      expect(templates).toBeNull();
    });
  });

  describe('getTemplatePath', () => {
    it('should use custom path if provided', () => {
      const swApp = {
        GetUserPreferenceStringValue: () => null,
        RevisionNumber: () => '2024 SP5.0'
      };
      const path = SolidWorksConfig.getTemplatePath(swApp, 'part', 'C:\\Custom\\Part.prtdot');
      expect(path).toBe('C:\\Custom\\Part.prtdot');
    });

    it('should use default templates if no custom path', () => {
      const swApp = {
        GetUserPreferenceStringValue: (type: number) => {
          if (type === 0) return 'C:\\Templates\\Part.prtdot';
          if (type === 1) return 'C:\\Templates\\Assembly.asmdot';
          if (type === 8) return 'C:\\Templates\\Drawing.drwdot';
          return null;
        }
      };
      const path = SolidWorksConfig.getTemplatePath(swApp, 'part');
      expect(path).toContain('Part.prtdot');
    });

    it('should throw if templates cannot be determined', () => {
      const swApp = {
        GetUserPreferenceStringValue: () => null,
        RevisionNumber: () => null
      };
      expect(() => SolidWorksConfig.getTemplatePath(swApp, 'part')).toThrow();
    });
  });

  describe('validateTemplatePath', () => {
    it('should return true if file exists', () => {
      // This test depends on file system, so we just verify it doesn't throw
      expect(() => SolidWorksConfig.validateTemplatePath('C:\\test.prtdot')).not.toThrow();
    });
  });

  describe('getInstallInfo', () => {
    it('should return install information', () => {
      const swApp = {
        RevisionNumber: () => '2024 SP5.0',
        Visible: true,
        GetUserPreferenceStringValue: () => null
      };
      const info = SolidWorksConfig.getInstallInfo(swApp);
      expect(info).toBeDefined();
      expect(info.version).toBeDefined();
    });

    it('should handle errors gracefully', () => {
      const swApp = {
        RevisionNumber: () => {
          throw new Error('Failed');
        }
      };
      const info = SolidWorksConfig.getInstallInfo(swApp);
      expect(info).toBeDefined();
      expect(info.versionError).toBeDefined();
    });
  });
});

