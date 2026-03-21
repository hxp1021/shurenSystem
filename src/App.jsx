import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SuperAdmin from './pages/SuperAdmin'
import ProfessorPage from './pages/ProfessorPage'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="flex flex-col min-h-screen">
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/superAdmin"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <SuperAdmin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/professor"
                element={
                  <ProtectedRoute requireProfessor>
                    <ProfessorPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
