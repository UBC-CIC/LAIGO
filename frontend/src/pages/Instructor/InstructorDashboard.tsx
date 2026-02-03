import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Grid as Grid,
  Container,
  CircularProgress,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import InstructorHeader from "../../components/InstructorHeader";
import CaseCard from "../../components/CaseCard";
import CaseDeleteConfirmationDialog from "../../components/Case/CaseDeleteConfirmationDialog";

interface UserInfo {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  groups: string[];
}

interface InstructorDashboardProps {
  userInfo: UserInfo;
}

import { fetchAuthSession } from "aws-amplify/auth";

// Define Case interface
interface Case {
  case_id: string;
  case_hash?: string;
  case_title: string;
  status: string;
  jurisdiction: string[];
  last_updated: string;
  first_name?: string;
  last_name?: string;
}

const InstructorDashboard = ({ userInfo }: InstructorDashboardProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [myCases, setMyCases] = useState<Case[]>([]);
  const [allStudentCases, setAllStudentCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<
    "success" | "error" | "info" | "warning"
  >("info");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<Case | null>(null);

  const showSnackbar = (
    message: string,
    severity: "success" | "error" | "info" | "warning" = "info",
  ) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // Fetch data
  useEffect(() => {
    const fetchInstructorData = async () => {
      setLoading(true);
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();

        if (!token) throw new Error("No auth token");

        const headers = {
          Authorization: token,
          "Content-Type": "application/json",
        };

        // 1. Fetch My Cases (created by instructor)
        const myCasesResp = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/student/get_cases`,
          { headers },
        );

        if (myCasesResp.ok) {
          const myCasesData = await myCasesResp.json();
          setMyCases(Array.isArray(myCasesData) ? myCasesData : []);
        } else {
          // If 404, it might just mean no cases created
          if (myCasesResp.status !== 404) {
            console.error("Failed to fetch my cases");
          }
          setMyCases([]);
        }

        // 3. Fetch all student cases (view_students)
        const allCasesResp = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/instructor/view_students`,
          { headers },
        );

        if (allCasesResp.ok) {
          const allCasesData = await allCasesResp.json();
          setAllStudentCases(Array.isArray(allCasesData) ? allCasesData : []);
        } else {
          // 404 might mean no students assigned
          console.error("Failed to fetch student cases (or none assigned)");
          setAllStudentCases([]);
        }
      } catch (err) {
        console.error("Error fetching dashboard data", err);
        showSnackbar("Failed to load dashboard data", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchInstructorData();
  }, [userInfo.userId]);

  // Handlers
  const handleDeleteCase = (caseId: string) => {
    const caseItem =
      myCases.find((c) => c.case_id === caseId) ||
      allStudentCases.find((c) => c.case_id === caseId);
    if (caseItem) {
      setCaseToDelete(caseItem);
      setDeleteDialogOpen(true);
    }
  };

  const confirmDelete = async () => {
    if (!caseToDelete) return;

    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (!token) throw new Error("No auth token");

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/instructor/delete_case?case_id=${caseToDelete.case_id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: token,
          },
        },
      );

      if (response.ok) {
        showSnackbar("Case deleted successfully", "success");
        // Update both lists
        setMyCases((prev) =>
          prev.filter((c) => c.case_id !== caseToDelete.case_id),
        );
        setAllStudentCases((prev) =>
          prev.filter((c) => c.case_id !== caseToDelete.case_id),
        );
        setDeleteDialogOpen(false);
        setCaseToDelete(null);
      } else {
        const data = await response.json();
        showSnackbar(data.error || "Failed to delete case", "error");
      }
    } catch (err) {
      console.error("Error deleting case", err);
      showSnackbar("Failed to delete case", "error");
    }
  };

  const handleArchiveCase = async (caseId: string) => {
    // Stub
    console.log("Archive case", caseId);
    showSnackbar(
      "Archive not implemented for instructor view yet (mock data)",
      "info",
    );
  };

  // Search Filtering
  const filterCases = useMemo(() => {
    return (cases: Case[]) => {
      const q = query.trim().toLowerCase();
      if (!q) return cases;
      return cases.filter((c) => {
        const jurisdiction = Array.isArray(c.jurisdiction)
          ? c.jurisdiction.join(", ")
          : "";

        return (
          (c.case_title || "").toLowerCase().includes(q) ||
          jurisdiction.toLowerCase().includes(q) ||
          (c.status || "").toLowerCase().includes(q) ||
          (c.case_id || "").toLowerCase().includes(q) ||
          (c.first_name || "").toLowerCase().includes(q) ||
          (c.last_name || "").toLowerCase().includes(q)
        );
      });
    };
  }, [query]);

  // Derived filtered lists
  const visibleMyCases = useMemo(
    () => filterCases(myCases),
    [filterCases, myCases],
  );

  const visibleAllStudentCases = useMemo(() => {
    return filterCases(allStudentCases);
  }, [filterCases, allStudentCases]);

  // Apply Status Filter to visibleAllStudentCases
  const visibleFilteredAllStudentCases = useMemo(() => {
    if (statusFilter === "All") return visibleAllStudentCases;
    return visibleAllStudentCases.filter((c) => {
      // Database values: 'in_progress', 'submitted', 'reviewed'
      const s = (c.status || "").toLowerCase();

      if (statusFilter === "Sent to Review") return s === "submitted";
      if (statusFilter === "Reviewed") return s === "reviewed";
      if (statusFilter === "In Progress") return s === "in_progress";

      return s === statusFilter.toLowerCase();
    });
  }, [visibleAllStudentCases, statusFilter]);

  // --- Dynamic Stats Calculation ---
  const stats = useMemo(() => {
    // 1. Associates Assigned (Unique Students)
    const uniqueStudents = new Set();

    allStudentCases.forEach((c) => {
      if (c.first_name && c.last_name) {
        uniqueStudents.add(`${c.first_name}|${c.last_name}`);
      }
    });

    return {
      associatesAssigned: uniqueStudents.size,
    };
  }, [allStudentCases]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setQuery(""); // Clear search on tab switch
  };

  return (
    <Box
      sx={{
        backgroundColor: "var(--background)",
        minHeight: "100vh",
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <InstructorHeader />

      <Container maxWidth="lg" sx={{ mt: 8, mb: 4, flexGrow: 1 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" sx={{ mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            {/* Tabs for Section Selection */}
            <Box
              sx={{
                borderBottom: 1,
                borderColor: "divider",
                mb: 3,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                textColor="inherit"
                indicatorColor="primary"
                sx={{
                  "& .MuiTab-root": {
                    textTransform: "none",
                    fontFamily: "Outfit",
                    fontSize: "1rem",
                    fontWeight: 500,
                    marginRight: 2,
                  },
                  "& .Mui-selected": {
                    color: "var(--primary)",
                  },
                }}
              >
                <Tab
                  label={`My Cases (${myCases.length})`}
                  id="tab-0"
                  aria-controls="tabpanel-0"
                />
                <Tab
                  label={`All Student Cases (${visibleAllStudentCases.length})`}
                  id="tab-1"
                  aria-controls="tabpanel-1"
                />
              </Tabs>

              {/* Search Bar aligned with Tabs */}
              <Box sx={{ mb: 1, minWidth: "250px" }}>
                <TextField
                  variant="outlined"
                  size="small"
                  placeholder="Search..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon
                          sx={{ color: "var(--text-secondary)", fontSize: 20 }}
                        />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    backgroundColor: "var(--background)",
                    "& .MuiOutlinedInput-root": {
                      color: "var(--text)",
                      "& fieldset": { borderColor: "var(--border)" },
                    },
                  }}
                />
              </Box>
            </Box>

            {/* Tab Panel 0: My Cases (formerly Pending Reviews) */}
            {activeTab === 0 && (
              <Box role="tabpanel" hidden={activeTab !== 0}>
                <Grid container spacing={3}>
                  {visibleMyCases.length === 0 ? (
                    <Grid size={{ xs: 12 }}>
                      <Typography sx={{ color: "var(--text-secondary)" }}>
                        No cases created by you found.
                      </Typography>
                    </Grid>
                  ) : (
                    visibleMyCases.map((caseItem, index) => (
                      <Grid
                        size={{ xs: 12, sm: 6, md: 4 }}
                        key={`my-case-${index}`}
                      >
                        <CaseCard
                          caseId={caseItem.case_id}
                          caseHash={caseItem.case_hash}
                          title={caseItem.case_title}
                          status={caseItem.status}
                          jurisdiction={caseItem.jurisdiction?.join(", ")}
                          dateAdded={`Student: ${caseItem.first_name || "Me"} ${
                            caseItem.last_name || ""
                          } • ${new Date(
                            caseItem.last_updated,
                          ).toLocaleDateString()}`}
                          onDelete={handleDeleteCase}
                          onArchive={handleArchiveCase}
                          onClick={(id) => navigate(`/case/${id}/overview`)}
                        />
                      </Grid>
                    ))
                  )}
                </Grid>
              </Box>
            )}

            {/* Tab Panel 1: All Student Cases */}
            {activeTab === 1 && (
              <Box role="tabpanel" hidden={activeTab !== 1}>
                {/* Stats & Filter Bar within Tab 1 */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 3,
                    flexWrap: "wrap",
                    gap: 2,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      gap: 3,
                      color: "var(--text-secondary)",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="body2" sx={{ fontFamily: "Outfit" }}>
                      <Box
                        component="span"
                        sx={{ fontWeight: "bold", color: "var(--text)" }}
                      >
                        {stats.associatesAssigned}
                      </Box>{" "}
                      Associates Assigned
                    </Typography>
                  </Box>

                  <FormControl
                    size="small"
                    sx={{
                      minWidth: 150,
                      "& .MuiOutlinedInput-root": {
                        color: "var(--text)",
                        "& fieldset": { borderColor: "var(--border)" },
                        "&:hover fieldset": {
                          borderColor: "var(--text-secondary)",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "var(--primary)",
                        },
                        "& .MuiSvgIcon-root": { color: "var(--text)" },
                      },
                      "& .MuiInputLabel-root": {
                        color: "var(--text-secondary)",
                      },
                    }}
                  >
                    <InputLabel id="status-filter-label">Status</InputLabel>
                    <Select
                      labelId="status-filter-label"
                      value={statusFilter}
                      label="Status"
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <MenuItem value="All">All Statuses</MenuItem>
                      <MenuItem value="Sent to Review">Pending Review</MenuItem>
                      <MenuItem value="Reviewed">Reviewed</MenuItem>
                      <MenuItem value="In Progress">In Progress</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <Grid container spacing={3}>
                  {visibleFilteredAllStudentCases.length === 0 ? (
                    <Grid size={{ xs: 12 }}>
                      <Typography sx={{ color: "var(--text-secondary)" }}>
                        No student cases found matching current filters.
                      </Typography>
                    </Grid>
                  ) : (
                    visibleFilteredAllStudentCases.map((caseItem, index) => (
                      <Grid
                        size={{ xs: 12, sm: 6, md: 4 }}
                        key={`student-case-${index}`}
                      >
                        <CaseCard
                          caseId={caseItem.case_id}
                          caseHash={caseItem.case_hash}
                          title={caseItem.case_title}
                          status={caseItem.status}
                          jurisdiction={caseItem.jurisdiction?.join(", ")}
                          dateAdded={`Student: ${caseItem.first_name || ""} ${
                            caseItem.last_name || ""
                          } • ${new Date(
                            caseItem.last_updated,
                          ).toLocaleDateString()}`}
                          onDelete={handleDeleteCase}
                          onArchive={handleArchiveCase}
                          onClick={(id) => navigate(`/case/${id}/overview`)}
                        />
                      </Grid>
                    ))
                  )}
                </Grid>
              </Box>
            )}
          </Box>
        )}
      </Container>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

      <CaseDeleteConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        caseTitle={caseToDelete?.case_title || ""}
      />
    </Box>
  );
};

export default InstructorDashboard;
