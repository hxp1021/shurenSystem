/**
 * 认证相关工具函数
 *
 * 超级管理员：在云数据库集合 `super_admins` 中维护记录，字段 `phone` 为 11 位数字，
 * 与当前登录用户手机号一致时，即视为超级管理员（见 AuthContext 中 fetchIsSuperAdmin）。
 */

/** 规范化手机号：仅保留数字，去掉 +86 前缀 */
export function normalizePhone(input) {
  if (input == null || input === '') return ''
  let s = String(input).replace(/\D/g, '')
  if (s.length === 13 && s.startsWith('86')) s = s.slice(2)
  return s
}

/** 从 CloudBase 用户对象取手机号（短信登录后常见字段） */
export function getUserPhone(user) {
  if (!user) return ''
  const raw =
    user.phoneNumber ?? user.phone ?? user.phone_number ?? user.mobile ?? ''
  return normalizePhone(raw)
}
