import React, { useState, useEffect, useCallback, useRef } from "react";
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

const PAGE_SIZE = 12;

const AdvocateDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [cases, setCases] = useState<Case[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
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

  const fetchCases = useCallback(
    async (pageNum: number, append: boolean) => {
      setLoading(true);
      try {
        const session = await fetchAuthSession();
        await fetchUserAttributes();
        const token = session.tokens?.idToken?.toString();
        const cognito_id = session.tokens?.idToken?.payload?.sub;

        if (!token || !cognito_id) {
          setCases([]);
          setTotalCount(0);
          return;
        }

        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: PAGE_SIZE.toString(),
        });
        if (query.trim()) params.append("search", query.trim());
        if (statusFilter !== "All") {
          const mapped =
            statusFilter === "In Progress"
              ? "in_progress"
              : statusFilter === "Sent to Review"
                ? "submitted"
                : statusFilter.toLowerCase();
          params.append("status", mapped);
        }

        const resp = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/student/get_cases?${params.toString()}`,
          {
            method: "GET",
            headers: { Authorization: token, "Content-Type": "application/json" },
          },
        );

        if (!resp.ok) {
          if (!append) {
            setCases([]);
            setTotalCount(0);
          }
          return;
        }

        const data = await resp.json();
        const casesArray: RawCase[] = Array.isArray(data.cases) ? data.cases : [];

        const normalized: Case[] = casesArray.map((c) => ({
          id: c.case_id,
          hash: c.case_hash,
          title: c.case_title || "Untitled Case",
          status: c.status ?? "",
          jurisdiction: Array.isArray(c.jurisdiction)
            ? c.jurisdiction.join(", ")
            : (c.jurisdiction as string) || "",
          dateAdded: c.last_updated
            ? new Date(c.last_updated).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : "",
        }));

        if (append) {
          setCases((prev) => [...prev, ...normalized]);
        } else {
          setCases(normalized);
        }
        setTotalCount(data.totalCount || 0);
      } catch (error) {
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    },
    [query, statusFilter],
  );

  // Reset and fetch page 0 when filters change
  useEffect(() => {
    setPage(0);
    const delay = setTimeout(() => {
      fetchCases(0, false);
    }, 300);
    return () => clearTimeout(delay);
  }, [fetchCases]);

  // Fetch next page when page increments beyond 0
  useEffect(() => {
    if (page === 0) return;
    fetchCases(page, true);
  }, [page, fetchCases]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && cases.length < totalCount) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, cases.length, totalCount]);

  const handleArchiveCase = async (caseId: string) => {
    try {
      const targetCase = cases.find((c) => c.id === caseId);
      if (!targetCase) throw new Error("Case not found");

      const isArchived = (targetCase.status || "").toLowerCase() === "archived";
      const endpoint = isArchived ? "student/unarchive_case" : "student/archive_case";

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

      showSnackbar(
        isArchived ? "Case unarchived successfully" : "Case archived successfully",
        "success",
      );
      // Re-fetch from scratch to keep data consistent
      setPage(0);
      fetchCases(0, false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to update case archive status";
      showSnackbar(msg, "error");
    }
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
      <AdvocateHeader />

      <Container maxWidth="lg" sx={{ mt: 8, mb: 4, flexGrow: 1 }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{ fontWeight: "bold", mb: 4 }}
        >
          View All Cases
        </Typography>

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

        {initialLoad ? (
          <Box display="flex" justifyContent="center" sx={{ mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Grid container spacing={3}>
              {cases.length === 0 && !loading ? (
                <Grid size={{ xs: 12 }}>
                  <Typography
                    align="center"
                    sx={{ color: "var(--text-secondary)", mt: 2 }}
                  >
                    No cases found
                  </Typography>
                </Grid>
              ) : (
                cases.map((caseItem, index) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={`case-${caseItem.id}-${index}`}>
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
            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} style={{ height: 1 }} />
            {loading && (
              <Box display="flex" justifyContent="center" sx={{ mt: 3, mb: 2 }}>
                <CircularProgress size={28} />
              </Box>
            )}
          </>
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
