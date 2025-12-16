import { Box, Typography, Button } from '@mui/material'
import { signOut } from 'aws-amplify/auth'

interface UserInfo {
  userId: string
  email: string
  firstName: string
  lastName: string
  groups: string[]
}

interface AdminDashboardProps {
  userInfo: UserInfo
}

const AdminDashboard = ({ userInfo }: AdminDashboardProps) => {
  const handleSignOut = async () => {
    try {
      await signOut()
      window.location.reload()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Admin Dashboard</Typography>
        <Button variant="outlined" onClick={handleSignOut}>
          Sign Out
        </Button>
      </Box>
      
      <Typography variant="h6" mb={2}>
        Welcome, {userInfo.firstName} {userInfo.lastName}!
      </Typography>
      
      <Typography variant="body1" mb={2}>
        Email: {userInfo.email}
      </Typography>
      
      <Typography variant="body1" mb={2}>
        Role: Administrator
      </Typography>
      
      <Box mt={4}>
        <Typography variant="h6" mb={2}>Admin Features:</Typography>
        <ul>
          <li>User management</li>
          <li>System configuration</li>
          <li>Analytics and reporting</li>
          <li>Manage instructors and students</li>
          <li>System monitoring</li>
          <li>Access all features</li>
        </ul>
      </Box>
    </Box>
  )
}

export default AdminDashboard