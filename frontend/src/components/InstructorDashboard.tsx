import { Box, Typography, Button } from '@mui/material'
import { signOut } from 'aws-amplify/auth'

interface UserInfo {
  userId: string
  email: string
  firstName: string
  lastName: string
  groups: string[]
}

interface InstructorDashboardProps {
  userInfo: UserInfo
}

const InstructorDashboard = ({ userInfo }: InstructorDashboardProps) => {
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
        <Typography variant="h4">Instructor Dashboard</Typography>
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
        Role: Instructor
      </Typography>
      
      <Box mt={4}>
        <Typography variant="h6" mb={2}>Instructor Features:</Typography>
        <ul>
          <li>Manage student cases</li>
          <li>Review legal submissions</li>
          <li>Provide guidance and feedback</li>
          <li>Access instructor resources</li>
          <li>View student progress</li>
        </ul>
      </Box>
    </Box>
  )
}

export default InstructorDashboard