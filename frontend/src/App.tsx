import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react'
import { Amplify } from 'aws-amplify'
import { UserProfile } from './components/UserProfile'
import '@aws-amplify/ui-react/styles.css'
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
      allowGuestAccess: true,
    },
  },
}

// Configure Amplify
Amplify.configure(amplifyConfig)

// Auth wrapper component
function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuthenticator()
  return user ? <>{children}</> : null
}

function App() {
  return (
    <Authenticator>
      <div className="app">
        <h1>LAIGO Application</h1>
        
        <AuthWrapper>
          <UserProfile />
          
          <div className="main-content">
            <h2>Welcome to your authenticated app!</h2>
            <p>You are now signed in and can access protected content.</p>
          </div>
        </AuthWrapper>
      </div>
    </Authenticator>
  )
}

export default App
