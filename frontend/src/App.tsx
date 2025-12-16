import { useEffect, useState } from 'react'
import { Amplify } from 'aws-amplify'
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth'
import Login from './pages/Login'
import StudentDashboard from './components/StudentDashboard'
import InstructorDashboard from './components/InstructorDashboard'
import AdminDashboard from './components/AdminDashboard'
import { CircularProgress, Box } from '@mui/material'
import './App.css'

// Amplify configuration
const amplifyConfig = {
  API: {
    REST: {
      MyApi: {
        endpoint: import.meta.env.VITE_API_ENDPOINT,
      },
    },
  },
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
      identityPoolId: import.meta.env.VITE_IDENTITY_POOL_ID,
      loginWith: {
        email: true,
      },
      signUpVerificationMethod: 'code' as const,
      userAttributes: {
        email: {
          required: true,
        },
      },
      allowGuestAccess: false,
    },
  },
}

// Configure Amplify
Amplify.configure(amplifyConfig)

interface UserInfo {
  userId: string
  email: string
  firstName: string
  lastName: string
  groups: string[]
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuthState()
  }, [])

  const checkAuthState = async () => {
    try {
      const user = await getCurrentUser()
      const session = await fetchAuthSession()
      
      if (user && session.tokens?.idToken) {
        const idToken = session.tokens.idToken
        const payload = idToken.payload
        
        const userInfo: UserInfo = {
          userId: payload.sub as string,
          email: payload.email as string,
          firstName: payload.given_name as string || '',
          lastName: payload.family_name as string || '',
          groups: payload['cognito:groups'] as string[] || ['student']
        }
        
        setUserInfo(userInfo)
        setIsAuthenticated(true)
      }
    } catch (error) {
      console.log('User not authenticated:', error)
      setIsAuthenticated(false)
      setUserInfo(null)
    } finally {
      setLoading(false)
    }
  }

  const getUserRole = (groups: string[]): string => {
    if (groups.includes('admin')) return 'admin'
    if (groups.includes('instructor')) return 'instructor'
    return 'student'
  }

  const renderDashboard = () => {
    if (!userInfo) return null
    
    const role = getUserRole(userInfo.groups)
    
    switch (role) {
      case 'admin':
        return <AdminDashboard userInfo={userInfo} />
      case 'instructor':
        return <InstructorDashboard userInfo={userInfo} />
      case 'student':
      default:
        return <StudentDashboard userInfo={userInfo} />
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    )
  }

  if (!isAuthenticated) {
    return <Login />
  }

  return (
    <div className="app">
      {renderDashboard()}
    </div>
  )
}

export default App
