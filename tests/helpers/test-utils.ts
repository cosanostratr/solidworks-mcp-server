/**
 * General Test Utilities
 * Provides common utility functions for tests
 */

import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique test file name
 */
export function generateTestFileName(extension: string = 'SLDPRT'): string {
  return `test_${uuidv4()}.${extension}`;
}

/**
 * Get the path to a test fixture file
 */
export function getFixturePath(filename: string): string {
  return join(process.cwd(), 'tests', 'fixtures', filename);
}

/**
 * Get the path to a temporary test file
 */
export function getTempPath(filename: string): string {
  return join(process.cwd(), 'tests', 'temp', filename);
}

/**
 * Wait for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < maxRetries - 1) {
        await wait(delay * Math.pow(2, i));
      }
    }
  }
  
  throw lastError || new Error('Retry failed');
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const fs = await import('fs/promises');
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a file if it exists
 */
export async function removeFileIfExists(filePath: string): Promise<void> {
  try {
    const fs = await import('fs/promises');
    await fs.unlink(filePath);
  } catch (error) {
    // File doesn't exist or can't be removed, that's okay
  }
}

/**
 * Create a directory if it doesn't exist
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    const fs = await import('fs/promises');
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Directory might already exist, that's okay
  }
}

/**
 * Get a random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get a random float between min and max
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Assert that a value is not null or undefined
 */
export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Value is null or undefined');
  }
}

