import { useAuthenticator } from '@aws-amplify/ui-react'
import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth'
import { useEffect, useState } from 'react'

type UserRole = 'admin' | 'instructor' | 'student'

// Custom hook for auth state, user attributes, and role management
export function useAuth() {
  const { user, signOut } = useAuthenticator()
  const [userAttributes, setUserAttributes] = useState<Record<string, any> | null>(null)
  const [userGroups, setUserGroups] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          // Fetch user attributes (email, etc.)
          const attributes = await fetchUserAttributes()
          setUserAttributes(attributes)

          // Fetch user groups from JWT token
          const session = await fetchAuthSession()
          const groups = session.tokens?.accessToken?.payload['cognito:groups'] as string[] || []
          setUserGroups(groups)
        } catch (error) {
          console.error('Error fetching user data:', error)
        }
      }
      setLoading(false)
    }

    fetchUserData()
  }, [user])

  // Helper functions for role checking
  const hasRole = (role: UserRole): boolean => userGroups.includes(role)
  const isAdmin = (): boolean => hasRole('admin')
  const isInstructor = (): boolean => hasRole('instructor')
  const isStudent = (): boolean => hasRole('student')
  const getPrimaryRole = (): UserRole => {
    if (isAdmin()) return 'admin'
    if (isInstructor()) return 'instructor'
    return 'student'
  }

  return {
    user,
    userAttributes,
    userGroups,
    signOut,
    loading,
    isAuthenticated: !!user,
    // Role helpers
    hasRole,
    isAdmin,
    isInstructor,
    isStudent,
    getPrimaryRole,
  }
}