import { Box, Typography, Button } from '@mui/material'
import { signOut } from 'aws-amplify/auth'

interface UserInfo {
  userId: string
  email: string
  firstName: string
  lastName: string
  groups: string[]
}

interface StudentDashboardProps {
  userInfo: UserInfo
}

const StudentDashboard = ({ userInfo }: StudentDashboardProps) => {
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
        <Typography variant="h4">Student Dashboard</Typography>
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
        Role: Student
      </Typography>
      
      <Box mt={4}>
        <Typography variant="h6" mb={2}>Student Features:</Typography>
        <ul>
          <li>Access legal aid resources</li>
          <li>Submit legal questions</li>
          <li>View case status</li>
          <li>Schedule appointments</li>
        </ul>
      </Box>
    </Box>
  )
}

export default StudentDashboard