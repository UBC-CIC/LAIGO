import React, { useState, useMemo, useEffect } from "react";
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { fetchAuthSession, fetchUserAttributes } from "aws-amplify/auth";
import SearchIcon from "@mui/icons-material/Search";
import AdvocateHeader from "../../components/AdvocateHeader";
import CaseCard from "../../components/CaseCard";

// Define types
interface Case {
  id: string;
  hash: string;
  title: string;
  status: string;
  jurisdiction: string;
  dateAdded: string;
}

interface RawCase {
  case_id: string;
  case_hash: string;
  case_title?: string;
  status: string;
  jurisdiction: string[] | string;
  last_updated?: string;
  [key: string]: unknown;
}

const AdvocateDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [cases, setCases] = useState<Case[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Snackbar for in-app notifications
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

  // Fetch recent cases for the logged-in user using Amplify session token
  useEffect(() => {
    const fetchCases = async () => {
      setLoading(true);
      try {
        const session = await fetchAuthSession();
        // ensure user attributes are available (keeps parity with older code)
        await fetchUserAttributes();

        const token = session.tokens?.idToken?.toString();
        const cognito_id = session.tokens?.idToken?.payload?.sub;

        if (!token || !cognito_id) {
          console.warn("No token or user id available from session");
          setCases([]);
          setLoading(false);
          return;
        }

        const url = `${import.meta.env.VITE_API_ENDPOINT}/student/get_cases`;

        const resp = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        });

        if (resp.status === 404) {
          // No cases — normalize to empty and bubble up to catch for logging
          setCases([]);
          throw new Error("No cases found");
        }

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Failed to fetch cases: ${resp.status} ${errText}`);
        }

        const data = await resp.json();

        // Normalize API response to an array of cases
        let casesArray: RawCase[] = [];
        if (Array.isArray(data)) {
          casesArray = data;
        } else if (data && Array.isArray(data.cases)) {
          casesArray = data.cases;
        } else if (data && typeof data === "object") {
          casesArray = (data.cases as RawCase[]) || [];
        }

        const normalized: Case[] = casesArray.map((c) => {
          const id = c.case_id;
          const hash = c.case_hash;
          const title = c.case_title || "Untitled Case";
          const status = c.status ?? "";
          const jurisdiction = Array.isArray(c.jurisdiction)
            ? c.jurisdiction.join(", ")
            : (c.jurisdiction as string) || "";
          const dateAdded = c.last_updated
            ? new Date(c.last_updated).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : "";

          return { id, hash, title, status, jurisdiction, dateAdded };
        });

        setCases(normalized);
      } catch (error) {
        console.error("Error fetching cases:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  // Archive/unarchive handler
  const handleArchiveCase = async (caseId: string) => {
    try {
      setLoading(true);

      const targetCase = (cases || []).find((c) => c.id === caseId);
      if (!targetCase) {
        throw new Error("Case not found");
      }

      const isArchived = (targetCase.status || "").toLowerCase() === "archived";
      const endpoint = isArchived
        ? "student/unarchive_case"
        : "student/archive_case";
      const nextStatus = isArchived ? "in_progress" : "archived";

      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No auth token");

      const resp = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/${endpoint}?case_id=${caseId}`,
        {
          method: "PUT",
          headers: { Authorization: token, "Content-Type": "application/json" },
        },
      );

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to update case status: ${resp.status} ${text}`);
      }

      // Update UI: toggle case status
      setCases((prev) =>
        prev
          ? prev.map((c) =>
              c.id === caseId ? { ...c, status: nextStatus } : c,
            )
          : prev,
      );
      showSnackbar(
        isArchived ? "Case unarchived successfully" : "Case archived successfully",
        "success",
      );
    } catch (err) {
      console.error("Archive failed", err);
      const msg =
        err instanceof Error ? err.message : "Failed to update case archive status";
      showSnackbar(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  // Using fetched data (or empty list) for search/filtering
  const filteredCases = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = cases || [];

    // Filter by query
    if (q) {
      result = result.filter((c) => {
        return (
          (c.title || "").toLowerCase().includes(q) ||
          (c.jurisdiction || "").toLowerCase().includes(q) ||
          (c.status || "").toLowerCase().includes(q) ||
          (c.id || "").toLowerCase().includes(q)
        );
      });
    }

    // Filter by status
    if (statusFilter !== "All") {
      result = result.filter((c) => {
        const s = (c.status || "").toLowerCase();
        if (statusFilter === "In Progress") return s === "in_progress";
        if (statusFilter === "Sent to Review") return s === "submitted";
        if (statusFilter === "Reviewed") return s === "reviewed";
        if (statusFilter === "Archived") return s === "archived";
        return s === statusFilter.toLowerCase();
      });
    }

    return result;
  }, [query, cases, statusFilter]);

  return (
    <Box
      sx={{
        backgroundColor: "var(--background)", // Deep dark background
        minHeight: "100vh",
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AdvocateHeader />

      <Container maxWidth="lg" sx={{ mt: 8, mb: 4, flexGrow: 1 }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{ fontWeight: "bold", mb: 4 }}
        >
          View All Cases
        </Typography>

        {/* Search Bar & Filter */}
        <Box sx={{ display: "flex", justifyContent: "center", mb: 6, gap: 2 }}>
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
                "& fieldset": {
                  borderColor: "var(--border)",
                },
                "&:hover fieldset": {
                  borderColor: "var(--text-secondary)",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "var(--primary)",
                },
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

          <FormControl
            sx={{
              minWidth: 200,
              "& .MuiOutlinedInput-root": {
                color: "var(--text)",
                backgroundColor: "var(--background)",
                "& fieldset": { borderColor: "var(--border)" },
                "&:hover fieldset": { borderColor: "var(--text-secondary)" },
                "&.Mui-focused fieldset": { borderColor: "var(--primary)" },
              },
              "& .MuiInputLabel-root": { color: "var(--text-secondary)" },
              "& .MuiSelect-icon": { color: "var(--text-secondary)" },
              "& .MuiSelect-select": { textAlign: "left" },
            }}
          >
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select
              labelId="status-filter-label"
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
              MenuProps={{
                PaperProps: {
                  sx: {
                    backgroundColor: "var(--background)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                  },
                },
              }}
            >
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="In Progress">In Progress</MenuItem>
              <MenuItem value="Sent to Review">Sent to Review</MenuItem>
              <MenuItem value="Reviewed">Reviewed</MenuItem>
              <MenuItem value="Archived">Archived</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Cases Grid */}
        {loading ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            width="100%"
            sx={{ mt: 4 }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {filteredCases.length === 0 ? (
              <Grid size={{ xs: 12 }}>
                <Typography
                  align="center"
                  sx={{ color: "var(--text-secondary)", mt: 2 }}
                >
                  No cases found
                </Typography>
              </Grid>
            ) : (
              filteredCases.map((caseItem, index) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                  <CaseCard
                    caseId={caseItem.id}
                    caseHash={caseItem.hash}
                    title={caseItem.title}
                    status={caseItem.status}
                    jurisdiction={caseItem.jurisdiction}
                    dateAdded={caseItem.dateAdded}
                    onArchive={handleArchiveCase}
                    archiveLabel={
                      caseItem.status?.toLowerCase() === "archived"
                        ? "Unarchive"
                        : "Archive"
                    }
                    onClick={(id) => navigate(`/case/${id}/overview`)}
                  />
                </Grid>
              ))
            )}
          </Grid>
        )}
      </Container>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={8000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
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

export default AdvocateDashboard;
