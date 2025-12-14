import { useAuthenticator } from '@aws-amplify/ui-react'

// Component to display user info and sign out button
export function UserProfile() {
  const { user, signOut } = useAuthenticator()

  return (
    <div className="user-profile">
      <p>Welcome, {user?.signInDetails?.loginId}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )
}