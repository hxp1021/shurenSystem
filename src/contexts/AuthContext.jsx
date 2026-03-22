import React, { createContext, useContext, useState, useEffect } from 'react'
import cloudbase from '../utils/cloudbase'
import { getUserPhone, normalizePhone } from '../config/auth'

const AuthContext = createContext(null)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

async function fetchProfessorByPhone(phoneNorm) {
  if (!phoneNorm) return null
  const db = cloudbase.app.database()
  const res = await db.collection('professors').where({ phone: phoneNorm }).get()
  if (res.data?.length > 0) return res.data[0]
  return null
}

/** 查询 super_admins 集合，phone 与当前登录手机号一致则为超级管理员 */
async function fetchIsSuperAdmin(phoneNorm) {
  if (!phoneNorm) return false
  try {
    const db = cloudbase.app.database()
    const res = await db.collection('super_admins').where({ phone: phoneNorm }).get()
    return (res.data?.length ?? 0) > 0
  } catch (err) {
    console.error('查询 super_admins 失败', err)
    return false
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [currentProfessor, setCurrentProfessor] = useState(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  /**
   * 根据登录用户同步 isSuperAdmin、currentProfessor
   * 两者可并存：同一人可既是超级管理员又是教授
   */
  const refreshRoles = async (loginUser) => {
    const phone = getUserPhone(loginUser)
    if (!phone) {
      setIsSuperAdmin(false)
      setCurrentProfessor(null)
      return { isSuperAdmin: false, isProfessor: false }
    }
    const superAdmin = await fetchIsSuperAdmin(phone)
    setIsSuperAdmin(superAdmin)

    const prof = await fetchProfessorByPhone(phone)
    setCurrentProfessor(prof)

    return { isSuperAdmin: superAdmin, isProfessor: !!prof }
  }

  useEffect(() => {
    const init = async () => {
      try {
        const auth = cloudbase.app.auth()
        const loginState = await auth.getLoginState()
        if (loginState?.user) {
          setUser(loginState.user)
          await refreshRoles(loginState.user)
        } else {
          setUser(null)
          setIsSuperAdmin(false)
          setCurrentProfessor(null)
        }
      } catch (err) {
        console.error('Auth init error', err)
        setUser(null)
        setIsSuperAdmin(false)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  /**
   * 发送短信验证码（控制台需开启「短信验证码」登录）
   * 返回 verification_id / is_user，提交登录时必须一并传入
   */
  const sendSmsCode = async (phoneInput) => {
    const phone = normalizePhone(phoneInput)
    if (phone.length !== 11) {
      throw new Error('请输入正确的 11 位手机号')
    }
    const auth = cloudbase.app.auth()
    const res = await auth.getVerification({
      phone_number: `+86 ${phone}`,
    })
    return {
      verification_id: res.verification_id,
      is_user: res.is_user,
    }
  }

  /**
   * 手机号 + 短信验证码登录（与注册共用同一接口：新用户会自动注册）
   * @param professorName 仅在「教授注册」时传入，用于写入 professors 集合
   */
  const loginWithSms = async (phoneInput, phoneCode, verificationInfo, professorName) => {
    const phone = normalizePhone(phoneInput)
    if (phone.length !== 11) throw new Error('请输入正确的手机号')
    if (!phoneCode?.trim()) throw new Error('请输入验证码')
    if (!verificationInfo?.verification_id) {
      throw new Error('请先点击「获取验证码」')
    }
    const auth = cloudbase.app.auth()
    await auth.signInWithSms({
      verificationInfo: {
        verification_id: verificationInfo.verification_id,
        is_user: verificationInfo.is_user,
      },
      verificationCode: phoneCode.trim(),
      phoneNum: phone,
    })
    const loginState = await auth.getLoginState()
    setUser(loginState.user)

    const phoneNorm = getUserPhone(loginState.user)
    const superAdmin = await fetchIsSuperAdmin(phoneNorm)

    const displayName = professorName?.trim()
    if (displayName) {
      try {
        await loginState.user.updateUserBasicInfo({ username: displayName })
      } catch (e) {
        console.warn('更新 CloudBase 用户名称失败', e)
      }
    }
    if (!superAdmin && displayName) {
      const db = cloudbase.app.database()
      const exist = await db.collection('professors').where({ phone: phoneNorm }).get()
      if (!exist.data?.length) {
        await db.collection('professors').add({
          name: displayName,
          phone: phoneNorm,
        })
      }
    }

    const roles = await refreshRoles(loginState.user)
    return {
      loginState,
      isSuperAdmin: roles.isSuperAdmin,
      isProfessor: roles.isProfessor,
    }
  }

  const logout = async () => {
    const auth = cloudbase.app.auth()
    await auth.signOut()
    setUser(null)
    setCurrentProfessor(null)
    setIsSuperAdmin(false)
  }

  const value = {
    user,
    isSuperAdmin,
    currentProfessor,
    loading,
    sendSmsCode,
    loginWithSms,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
