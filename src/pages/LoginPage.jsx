import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { normalizePhone } from '../config/auth'

const LoginPage = () => {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  /** 最近一次「获取验证码」返回，登录时必须带上 */
  const [verificationInfo, setVerificationInfo] = useState(null)
  const { sendSmsCode, loginWithSms } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const handleSendCode = async () => {
    setError('')
    const p = normalizePhone(phone)
    if (p.length !== 11) {
      setError('请输入正确的 11 位手机号')
      return
    }
    setSending(true)
    try {
      const info = await sendSmsCode(phone)
      setVerificationInfo({
        verification_id: info.verification_id,
        is_user: info.is_user,
      })
      setCountdown(60)
    } catch (err) {
      setVerificationInfo(null)
      setError(err?.message || '发送失败，请确认控制台已开启短信验证码登录')
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (isSignUp) {
      if (!name?.trim()) {
        setError('请填写姓名')
        return
      }
    } else {
      if (verificationInfo?.is_user === false) {
        setError('该手机号未注册，请先进行教授注册')
        return
      }
    }
    setLoading(true)
    try {
      const { isSuperAdmin, isProfessor } = await loginWithSms(
        phone,
        code,
        verificationInfo,
        isSignUp ? name : undefined
      )
      const target = isSuperAdmin ? '/superAdmin' : isProfessor ? '/professor' : redirect
      navigate(target, { replace: true })
    } catch (err) {
      setError(err?.message || (isSignUp ? '注册失败' : '登录失败，请检查验证码'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title justify-center text-2xl">
            {isSignUp ? '教授注册' : '短信验证码登录'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="form-control">
                <label className="label"><span className="label-text">姓名</span></label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="您的姓名"
                />
              </div>
            )}
            <div className="form-control">
              <label className="label"><span className="label-text">手机号</span></label>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                className="input input-bordered"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value)
                  setVerificationInfo(null)
                }}
                placeholder="11 位手机号"
                maxLength={13}
                required
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">验证码</span></label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  className="input input-bordered flex-1"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="短信验证码"
                  required
                />
                <button
                  type="button"
                  className="btn btn-outline whitespace-nowrap shrink-0"
                  disabled={sending || countdown > 0}
                  onClick={handleSendCode}
                >
                  {sending ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : countdown > 0 ? (
                    `${countdown}s`
                  ) : (
                    '获取验证码'
                  )}
                </button>
              </div>
            </div>
            {error && (
              <div className="alert alert-error py-2">
                <span>{error}</span>
              </div>
            )}
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  处理中...
                </>
              ) : (
                isSignUp ? '注册' : '登录'
              )}
            </button>
          </form>
          <div className="divider">或</div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError('')
              setVerificationInfo(null)
            }}
          >
            {isSignUp ? '已有账号？去登录' : '没有账号？去注册（教授）'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
