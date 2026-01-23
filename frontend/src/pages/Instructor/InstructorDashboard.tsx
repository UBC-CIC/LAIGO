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

// Define Case interface
interface Case {
  id: string;
  case_hash?: string;
  title: string;
  status: string;
  jurisdiction: string;
  dateAdded: string;
}

// Mock Stats Data
const mockStats = {
  associatesAssigned: 4,
  pendingReviews: 3,
  completedReviews: 12,
};

// Mock Cases replicating the screenshot/requirements
const mockPendingCases: Case[] = [
  {
    id: "89H%2Lx",
    title: "Federal Civil Law: Tenancy Dispute Leads to Assault",
    status: "In Progress",
    jurisdiction: "Federal",
    dateAdded: "November 19th, 2025",
  },
  {
    id: "89H%2Lx2",
    title: "Federal Civil Law: Tenancy Dispute Leads to Assault",
    status: "In Progress",
    jurisdiction: "Federal",
    dateAdded: "November 19th, 2025",
  },
  {
    id: "89H%2Lx3",
    title: "Federal Civil Law: Tenancy Dispute Leads to Assault",
    status: "In Progress",
    jurisdiction: "Federal",
    dateAdded: "November 19th, 2025",
  },
  {
    id: "89H%2Lx4",
    title: "Federal Civil Law: Tenancy Dispute Leads to Assault",
    status: "In Progress",
    jurisdiction: "Federal",
    dateAdded: "November 19th, 2025",
  },
  {
    id: "89H%2Lx5",
    title: "Federal Civil Law: Tenancy Dispute Leads to Assault",
    status: "In Progress",
    jurisdiction: "Federal",
    dateAdded: "November 19th, 2025",
  },
];

// Reusing same mock data structure for completed reviews for now, usually would be different status
const mockCompletedReviews: Case[] = [];

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
  const [pendingCases, setPendingCases] = useState<Case[]>(mockPendingCases);
  const [completedCases, setCompletedCases] =
    useState<Case[]>(mockCompletedReviews);
  const [loading, setLoading] = useState<boolean>(true); // Simulate loading

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

  // Simulate fetch (mock for now)
  useEffect(() => {
    const fetchInstructorData = async () => {
      setLoading(true);
      // Simulate delay
      await new Promise((r) => setTimeout(r, 800));

      // Use mock data
      setPendingCases(mockPendingCases);
      setCompletedCases(mockCompletedReviews);
      setLoading(false);
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
        return (
          (c.title || "").toLowerCase().includes(q) ||
          (c.jurisdiction || "").toLowerCase().includes(q) ||
          (c.status || "").toLowerCase().includes(q) ||
          (c.id || "").toLowerCase().includes(q)
        );
      });
    };
  }, [query]);

  const visiblePending = useMemo(
    () => filterCases(pendingCases),
    [filterCases, pendingCases],
  );
  const visibleCompleted = useMemo(
    () => filterCases(completedCases),
    [filterCases, completedCases],
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
                        caseId={caseItem.id}
                        caseHash={caseItem.case_hash} // mock might not have this, be careful
                        title={caseItem.title}
                        status={caseItem.status}
                        jurisdiction={caseItem.jurisdiction}
                        dateAdded={caseItem.dateAdded}
                        onDelete={handleDeleteCase}
                        onArchive={handleArchiveCase}
                        onClick={(id) => navigate(`/case/${id}/overview`)}
                      />
                    </Grid>
                  ))
                )}
              </Grid>
            </Box>

            {/* Completed Reviews (Header only if we want to show it even when empty, or hide? 
                    The screenshot shows 'Completed Reviews' header. I'll show it.) */}
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="h5"
                fontWeight="bold"
                gutterBottom
                sx={{ mb: 3 }}
              >
                Completed Reviews
              </Typography>
              <Grid container spacing={3}>
                {visibleCompleted.length === 0 ? (
                  // Placeholder text if empty, or just empty?
                  // The screenshot shows the header but no cards visible below it (cut off?).
                  // I'll show a message.
                  <Grid size={{ xs: 12 }}>
                    <Typography sx={{ color: "var(--text-secondary)" }}>
                      No completed reviews found.
                    </Typography>
                  </Grid>
                ) : (
                  visibleCompleted.map((caseItem, index) => (
                    <Grid
                      size={{ xs: 12, sm: 6, md: 4 }}
                      key={`completed-${index}`}
                    >
                      <CaseCard
                        caseId={caseItem.id}
                        caseHash={caseItem.case_hash}
                        title={caseItem.title}
                        status={caseItem.status}
                        jurisdiction={caseItem.jurisdiction}
                        dateAdded={caseItem.dateAdded}
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
