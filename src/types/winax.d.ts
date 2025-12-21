/**
 * Type declarations for winax module
 *
 * winax provides COM automation support for Node.js on Windows.
 * These declarations allow TypeScript to work with winax without errors.
 */

declare module 'winax' {
  /**
   * Creates a new COM object instance
   */
  export class Object {
    constructor(progId: string);
    [key: string]: any;
  }

  /**
   * Alternative function-style COM object creation
   */
  export function Object(progId: string): any;

  /**
   * Release a COM object reference
   */
  export function release(obj: any): void;

  /**
   * Get variant type
   */
  export function Variant(value: any, type?: number): any;
}
