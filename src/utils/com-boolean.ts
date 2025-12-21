/**
 * COM Boolean (VARIANT_BOOL) 类型转换工具
 * 
 * 关键发现：COM 的 VARIANT_BOOL 使用 -1 表示 true，而非 1！
 * 这是最常被忽视的问题，会导致 API 调用失败或行为异常。
 * 
 * @module utils/com-boolean
 */

/**
 * VARIANT_BOOL 常量
 * COM 标准：-1 = VARIANT_TRUE, 0 = VARIANT_FALSE
 */
export const COM_BOOL = {
  /** VARIANT_TRUE: -1 (0xFFFF) */
  TRUE: -1,
  /** VARIANT_FALSE: 0 */
  FALSE: 0,
} as const;

/**
 * 将 JavaScript boolean 转换为 COM VARIANT_BOOL 值
 * 
 * @param value - JavaScript boolean 值
 * @returns COM VARIANT_BOOL 值：true -> -1, false -> 0
 * 
 * @example
 * ```typescript
 * const append = toVariantBool(true);  // 返回 -1
 * swExt.SelectByID2("Line1", "SKETCHSEGMENT", 0, 0, 0, append, 0, null, 0);
 * ```
 */
export function toVariantBool(value: boolean): number {
  return value ? COM_BOOL.TRUE : COM_BOOL.FALSE;
}

/**
 * 将 COM VARIANT_BOOL 值转换为 JavaScript boolean
 * 
 * @param value - COM VARIANT_BOOL 值（-1 或 0）
 * @returns JavaScript boolean：-1 -> true, 其他 -> false
 * 
 * @example
 * ```typescript
 * const result = swExt.SelectByID2(...);
 * const success = fromVariantBool(result);  // -1 -> true, 0 -> false
 * ```
 */
export function fromVariantBool(value: number | boolean | null | undefined): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === null || value === undefined) {
    return false;
  }
  // COM VARIANT_BOOL: -1 = true, 0 = false
  // JavaScript 会将 -1 视为 truthy，但为了明确性，我们显式检查
  return value === COM_BOOL.TRUE || value !== 0;
}

/**
 * 检查值是否为 VARIANT_TRUE
 * 
 * @param value - 要检查的值
 * @returns 如果值为 -1 则返回 true
 */
export function isVariantTrue(value: number | boolean | null | undefined): boolean {
  return value === COM_BOOL.TRUE;
}

/**
 * 检查值是否为 VARIANT_FALSE
 * 
 * @param value - 要检查的值
 * @returns 如果值为 0 则返回 true
 */
export function isVariantFalse(value: number | boolean | null | undefined): boolean {
  return value === COM_BOOL.FALSE || value === 0;
}

/**
 * COM Boolean 工具对象
 * 提供便捷的常量和转换方法
 */
export const COM = {
  /** VARIANT_TRUE: -1 */
  TRUE: COM_BOOL.TRUE,
  /** VARIANT_FALSE: 0 */
  FALSE: COM_BOOL.FALSE,
  /** 转换为 VARIANT_BOOL */
  bool: toVariantBool,
  /** 从 VARIANT_BOOL 转换 */
  fromBool: fromVariantBool,
  /** 检查是否为 TRUE */
  isTrue: isVariantTrue,
  /** 检查是否为 FALSE */
  isFalse: isVariantFalse,
} as const;

