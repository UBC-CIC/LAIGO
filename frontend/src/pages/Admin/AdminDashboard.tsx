import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Button,
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
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AdminHeader from "../../components/AdminHeader";
import AddInstructorDialog from "../../components/AddInstructorDialog";
import InstructorDetailsDialog from "../../components/InstructorDetailsDialog";
import { fetchAuthSession } from "aws-amplify/auth";

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

interface Instructor {
  user_id: string;
  user_email: string;
  first_name: string;
  last_name: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = () => {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedInstructor, setSelectedInstructor] =
    useState<Instructor | null>(null);

  useEffect(() => {
    fetchInstructors();
  }, []);

  const fetchInstructors = async () => {
    setLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (!token) throw new Error("No auth token");

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/instructors`,
        {
          headers: {
            Authorization: token,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch instructors");
      }

      const data = await response.json();
      setInstructors(data);
    } catch (error) {
      console.error("Error fetching instructors:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInstructors = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return instructors.filter(
      (instructor) =>
        instructor.first_name.toLowerCase().includes(query) ||
        instructor.last_name.toLowerCase().includes(query) ||
        instructor.user_email.toLowerCase().includes(query),
    );
  }, [instructors, searchQuery]);

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
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
        >
          <Typography variant="h5">Manage Instructors</Typography>
          <Button
            variant="contained"
            onClick={() => setAddDialogOpen(true)}
            sx={{
              backgroundColor: "#90caf9",
              color: "#000",
              "&:hover": { backgroundColor: "#42a5f5" },
            }}
          >
            ADD INSTRUCTOR
          </Button>
        </Box>

        <TextField
          variant="outlined"
          placeholder="Search by User"
          fullWidth
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{
            mb: 3,
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
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredInstructors
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((instructor) => (
                      <TableRow
                        key={instructor.user_id}
                        hover
                        onClick={() => {
                          setSelectedInstructor(instructor);
                          setDetailsDialogOpen(true);
                        }}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell
                          sx={{
                            color: "var(--text)",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          {instructor.first_name}
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "var(--text)",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          {instructor.last_name}
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "var(--text)",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          {instructor.user_email}
                        </TableCell>
                      </TableRow>
                    ))}
                  {filteredInstructors.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        align="center"
                        sx={{
                          color: "var(--text-secondary)",
                          borderBottom: "none",
                        }}
                      >
                        No instructors found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50]}
              component="div"
              count={filteredInstructors.length}
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

      <AddInstructorDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={() => {
          fetchInstructors();
        }}
      />

      <InstructorDetailsDialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        instructor={selectedInstructor}
      />
    </Box>
  );
};

export default AdminDashboard;
