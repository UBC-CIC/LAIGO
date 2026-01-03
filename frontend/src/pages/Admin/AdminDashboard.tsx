import { Box, Typography } from "@mui/material";
import AdminHeader from "../../components/AdminHeader";

interface UserInfo {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  groups: string[];
}

interface AdminDashboardProps {
  userInfo: UserInfo;
}

const AdminDashboard = ({ userInfo }: AdminDashboardProps) => {
  return (
    <Box sx={{ backgroundColor: 'var(--background)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AdminHeader />
      <Box p={3}>
        <Typography variant="h4" mb={3}>
          Admin Dashboard
        </Typography>

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
          <Typography variant="h6" mb={2}>
            Admin Features:
          </Typography>
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
    </Box>
  );
};

export default AdminDashboard;
