/**
 * 超级管理员手机号列表（11 位数字，与短信登录账号一致）
 * 使用这些手机号登录的用户将拥有 SuperAdmin 权限
 */
export const SUPERADMIN_PHONES = ['15575947551'] // 改为你的管理员手机号

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
