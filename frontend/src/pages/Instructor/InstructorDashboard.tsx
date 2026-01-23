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
  Paper,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import InstructorHeader from "../../components/InstructorHeader";
import CaseCard from "../../components/CaseCard";

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

// Mock Stats Data (still mock for now as backend endpoint isn't ready for stats)
const mockStats = {
  associatesAssigned: 4,
  pendingReviews: 3,
  completedReviews: 12,
};

const StatCard = ({ title, value }: { title: string; value: number }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 2,
      backgroundColor: "transparent",
      borderColor: "var(--border)",
      color: "var(--text)",
      height: "100%",
    }}
  >
    <Typography variant="body2" sx={{ color: "var(--text-secondary)", mb: 1 }}>
      {title}
    </Typography>
    <Typography variant="h4" fontWeight="bold">
      {value}
    </Typography>
  </Paper>
);

const InstructorDashboard = ({ userInfo }: InstructorDashboardProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  // pendingCases = cases returned from /instructor/cases_to_review
  const [pendingCases, setPendingCases] = useState<Case[]>([]);
  // allStudentCases = cases returned from /instructor/view_students
  const [allStudentCases, setAllStudentCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<
    "success" | "error" | "info" | "warning"
  >("info");

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

        // 1. Fetch cases pending review
        const pendingResp = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/instructor/cases_to_review?cognito_id=${userInfo.userId}`,
          { headers },
        );

        if (pendingResp.ok) {
          const pendingData = await pendingResp.json();
          setPendingCases(Array.isArray(pendingData) ? pendingData : []);
        } else {
          console.error("Failed to fetch pending cases");
          setPendingCases([]);
        }

        // 2. Fetch all student cases (view_students)
        const allCasesResp = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/instructor/view_students?cognito_id=${userInfo.userId}`,
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

  // Handlers (stubbed for now since we are using mocks)
  const handleDeleteCase = async (caseId: string) => {
    // Stub
    console.log("Delete case", caseId);
    showSnackbar(
      "Delete not implemented for instructor view yet (mock data)",
      "info",
    );
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

  const visiblePending = useMemo(
    () => filterCases(pendingCases),
    [filterCases, pendingCases],
  );

  // Reuse the 'completed' section to show ALL student cases for now, as requested ("view cases returned from this endpoint")
  const visibleAllStudentCases = useMemo(
    () => filterCases(allStudentCases),
    [filterCases, allStudentCases],
  );

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
        {/* Stats Section */}
        <Box sx={{ mb: 6 }}>
          <Grid container spacing={4} justifyContent="center">
            <Grid size={{ xs: 12, sm: 4, md: 3 }}>
              <StatCard
                title="Associates Assigned"
                value={mockStats.associatesAssigned}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4, md: 3 }}>
              <StatCard
                title="Pending Reviews"
                value={mockStats.pendingReviews}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4, md: 3 }}>
              <StatCard
                title="Completed Reviews"
                value={mockStats.completedReviews}
              />
            </Grid>
          </Grid>
        </Box>

        {/* Search Bar - only show if there are cases logic or just always show */}
        <Box sx={{ display: "flex", justifyContent: "center", mb: 6 }}>
          <TextField
            variant="outlined"
            placeholder="Search for a case"
            fullWidth
            sx={{
              backgroundColor: "var(--background)",
              borderRadius: "4px",
              maxWidth: "100%",
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" sx={{ mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Pending Cases */}
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="h5"
                fontWeight="bold"
                gutterBottom
                sx={{ mb: 3 }}
              >
                Pending Cases
              </Typography>

              <Grid container spacing={3}>
                {visiblePending.length === 0 ? (
                  <Grid size={{ xs: 12 }}>
                    <Typography sx={{ color: "var(--text-secondary)" }}>
                      No pending cases found.
                    </Typography>
                  </Grid>
                ) : (
                  visiblePending.map((caseItem, index) => (
                    <Grid
                      size={{ xs: 12, sm: 6, md: 4 }}
                      key={`pending-${index}`}
                    >
                      <CaseCard
                        caseId={caseItem.case_id}
                        caseHash={caseItem.case_hash}
                        title={caseItem.case_title}
                        status={caseItem.status}
                        jurisdiction={caseItem.jurisdiction?.join(", ")}
                        // Add student name to date or as subtitle if supported, for now appending to date area or title
                        // Actually, CaseCard prop structure is fixed. Let's pass student name in title or Date for visibility
                        dateAdded={`Student: ${caseItem.first_name || ""} ${caseItem.last_name || ""} • ${new Date(caseItem.last_updated).toLocaleDateString()}`}
                        onDelete={handleDeleteCase}
                        onArchive={handleArchiveCase}
                        onClick={(id) => navigate(`/case/${id}/overview`)}
                      />
                    </Grid>
                  ))
                )}
              </Grid>
            </Box>

            {/* All Student Cases */}
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="h5"
                fontWeight="bold"
                gutterBottom
                sx={{ mb: 3 }}
              >
                All Student Cases
              </Typography>
              <Grid container spacing={3}>
                {visibleAllStudentCases.length === 0 ? (
                  <Grid size={{ xs: 12 }}>
                    <Typography sx={{ color: "var(--text-secondary)" }}>
                      No student cases found.
                    </Typography>
                  </Grid>
                ) : (
                  visibleAllStudentCases.map((caseItem, index) => (
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
                        dateAdded={`Student: ${caseItem.first_name || ""} ${caseItem.last_name || ""} • ${new Date(caseItem.last_updated).toLocaleDateString()}`}
                        onDelete={handleDeleteCase}
                        onArchive={handleArchiveCase}
                        onClick={(id) => navigate(`/case/${id}/overview`)}
                      />
                    </Grid>
                  ))
                )}
              </Grid>
            </Box>
          </>
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
    </Box>
  );
};

export default InstructorDashboard;
