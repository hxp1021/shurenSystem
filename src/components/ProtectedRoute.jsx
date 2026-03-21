import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * 需要登录的页面
 * @param {Object} props
 * @param {boolean} props.requireSuperAdmin - 是否必须为超级管理员
 * @param {boolean} props.requireProfessor - 是否必须为教授
 */
export const ProtectedRoute = ({
  children,
  requireSuperAdmin = false,
  requireProfessor = false,
}) => {
  const { user, isSuperAdmin, currentProfessor, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />
  }

  if (requireProfessor && !currentProfessor) {
    return (
      <div className="container mx-auto py-16 text-center">
        <p className="text-error">您还不是教授，请用管理员登记的手机号注册，或联系管理员在「添加教授」中录入您的手机号</p>
        <a href="/#/login" className="btn btn-primary mt-4">去注册</a>
      </div>
    )
  }

  return children
}
