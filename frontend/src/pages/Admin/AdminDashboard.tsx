import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  Container,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import AdminHeader from "../../components/AdminHeader";
import UserManagementDialog from "../../components/Admin/UserManagementDialog";
import { fetchAuthSession } from "aws-amplify/auth";
import { useRoleLabels } from "../../contexts/RoleLabelsContext";

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

interface User {
  user_id: string;
  user_email: string;
  first_name: string;
  last_name: string;
  roles: string[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = () => {
  const { singular } = useRoleLabels();
  const [users, setUsers] = useState<User[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [userManagementDialogOpen, setUserManagementDialogOpen] =
    useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [page, rowsPerPage, searchQuery, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (!token) throw new Error("No auth token");

      const params = new URLSearchParams({
        page: page.toString(),
        limit: rowsPerPage.toString(),
      });
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      if (roleFilter !== "all") params.append("role", roleFilter);

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/users?${params.toString()}`,
        {
          headers: {
            Authorization: token,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data.users || []);
      setTotalCount(data.totalCount || 0);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (
    _event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number,
  ) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getPrimaryRole = (roles: string[]) => {
    if (!roles || roles.length === 0) return "student";
    if (roles.includes("admin")) return "admin";
    if (roles.includes("instructor")) return "instructor";
    return roles[0];
  };

  return (
    <Box
      sx={{
        backgroundColor: "var(--background)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        color: "var(--text)",
      }}
    >
      <AdminHeader />
      <Container maxWidth="lg" sx={{ mt: 4, flexGrow: 1 }}>
        <Box mb={3}>
          <Typography variant="h5">Manage Users</Typography>
        </Box>

        <Box display="flex" gap={2} mb={3}>
          <TextField
            variant="outlined"
            placeholder="Search by First Name, Last Name, or Email"
            fullWidth
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            sx={{
              backgroundColor: "var(--background)",
              "& .MuiOutlinedInput-root": {
                color: "var(--text)",
                "& fieldset": { borderColor: "var(--border)" },
                "&:hover fieldset": { borderColor: "var(--text-secondary)" },
                "&.Mui-focused fieldset": { borderColor: "var(--primary)" },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "var(--text-secondary)" }} />
                </InputAdornment>
              ),
            }}
          />
          <FormControl sx={{ minWidth: 200 }} variant="outlined">
            <InputLabel
              id="role-filter-label"
              sx={{ color: "var(--text-secondary)" }}
            >
              Role
            </InputLabel>
            <Select
              labelId="role-filter-label"
              value={roleFilter}
              label="Role"
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(0);
              }}
              sx={{
                color: "var(--text)",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "var(--border)",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "var(--text-secondary)",
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "var(--primary)",
                },
                "& .MuiSvgIcon-root": { color: "var(--text-secondary)" },
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    backgroundColor: "var(--background)",
                    border: "1px solid var(--border)",
                    "& .MuiMenuItem-root": {
                      color: "var(--text)",
                      "&:hover": { backgroundColor: "var(--border)" },
                      "&.Mui-selected": {
                        backgroundColor: "var(--primary)",
                        color: "#000",
                        "&:hover": { backgroundColor: "var(--primary)" },
                      },
                    },
                  },
                },
              }}
            >
              <MenuItem value="all">All Roles</MenuItem>
              <MenuItem value="admin">{singular("admin")}</MenuItem>
              <MenuItem value="instructor">{singular("instructor")}</MenuItem>
              <MenuItem value="student">{singular("student")}</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" mt={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Paper
            sx={{
              backgroundColor: "transparent",
              border: "1px solid var(--border)",
              boxShadow: "none",
            }}
          >
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        color: "var(--text)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      First Name
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "var(--text)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      Last Name
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "var(--text)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      Email
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "var(--text)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      Role
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color: "var(--text)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => {
                    return (
                      <TableRow
                        key={user.user_id}
                        hover
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest("button")) return;

                          setSelectedUser(user);
                          setUserManagementDialogOpen(true);
                        }}
                        sx={{
                          cursor: "pointer",
                        }}
                      >
                        <TableCell
                          sx={{
                            color: "var(--text)",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          {user.first_name}
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "var(--text)",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          {user.last_name}
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "var(--text)",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          {user.user_email}
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "var(--text)",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          {singular(getPrimaryRole(user.roles))}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          <Tooltip title="Edit Role">
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUser(user);
                                setUserManagementDialogOpen(true);
                              }}
                              sx={{
                                color: "var(--text-secondary)",
                                "&:hover": { color: "var(--primary)" },
                              }}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        align="center"
                        sx={{
                          color: "var(--text-secondary)",
                          borderBottom: "none",
                          py: 4,
                        }}
                      >
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50]}
              component="div"
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{
                color: "var(--text)",
                borderTop: "1px solid var(--border)",
                ".MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows":
                  {
                    marginBottom: 0,
                  },
                ".MuiTablePagination-actions": {
                  color: "var(--text)",
                },
              }}
            />
          </Paper>
        )}
      </Container>

      <UserManagementDialog
        open={userManagementDialogOpen}
        onClose={() => {
          setUserManagementDialogOpen(false);
          setSelectedUser(null);
        }}
        onSuccess={() => {
          fetchUsers();
        }}
        user={selectedUser}
      />
    </Box>
  );
};

export default AdminDashboard;
