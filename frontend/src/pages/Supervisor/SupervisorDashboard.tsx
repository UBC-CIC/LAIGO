import { useState, useEffect, useCallback, useRef } from "react";
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
import SupervisorHeader from "../../components/SupervisorHeader";
import CaseCard from "../../components/CaseCard";
import CaseDeleteConfirmationDialog from "../../components/Case/CaseDeleteConfirmationDialog";
import { useRoleLabels } from "../../contexts/RoleLabelsContext";

interface UserInfo {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  groups: string[];
}

interface SupervisorDashboardProps {
  userInfo: UserInfo;
}

import { fetchAuthSession } from "aws-amplify/auth";

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

const PAGE_SIZE = 12;

const SupervisorDashboard = ({ userInfo: _userInfo }: SupervisorDashboardProps) => {
  const navigate = useNavigate();
  const { plural } = useRoleLabels();
  const [activeTab, setActiveTab] = useState(0);

  // Per-tab search & filter
  const [myQuery, setMyQuery] = useState("");
  const [myStatusFilter, setMyStatusFilter] = useState("All");
  const [allQuery, setAllQuery] = useState("");
  const [allStatusFilter, setAllStatusFilter] = useState("All");

  // My Cases state
  const [myCases, setMyCases] = useState<Case[]>([]);
  const [myTotalCount, setMyTotalCount] = useState(0);
  const [myPage, setMyPage] = useState(0);
  const [myLoading, setMyLoading] = useState(false);
  const [myInitialLoad, setMyInitialLoad] = useState(true);
  const mySentinelRef = useRef<HTMLDivElement | null>(null);

  // All Student Cases state
  const [allStudentCases, setAllStudentCases] = useState<Case[]>([]);
  const [allTotalCount, setAllTotalCount] = useState(0);
  const [allPage, setAllPage] = useState(0);
  const [allLoading, setAllLoading] = useState(false);
  const [allInitialLoad, setAllInitialLoad] = useState(true);
  const allSentinelRef = useRef<HTMLDivElement | null>(null);
  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
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

  const mapStatusToBackend = (filter: string): string | null => {
    if (filter === "All") return null;
    if (filter === "Sent to Review") return "submitted";
    if (filter === "In Progress") return "in_progress";
    return filter.toLowerCase();
  };

  // Fetch My Cases
  const fetchMyCases = useCallback(
    async (pageNum: number, append: boolean) => {
      setMyLoading(true);
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (!token) throw new Error("No auth token");

        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: PAGE_SIZE.toString(),
        });
        if (myQuery.trim()) params.append("search", myQuery.trim());
        const status = mapStatusToBackend(myStatusFilter);
        if (status) params.append("status", status);

        const resp = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/student/get_cases?${params.toString()}`,
          { headers: { Authorization: token, "Content-Type": "application/json" } },
        );

        if (resp.ok) {
          const data = await resp.json();
          const fetched = Array.isArray(data.cases) ? data.cases : [];
          if (append) {
            setMyCases((prev) => [...prev, ...fetched]);
          } else {
            setMyCases(fetched);
          }
          setMyTotalCount(data.totalCount || 0);
        } else {
          if (!append) {
            setMyCases([]);
            setMyTotalCount(0);
          }
        }
      } catch (err) {
        console.error("Error fetching my cases", err);
        if (!append) {
          setMyCases([]);
          setMyTotalCount(0);
        }
      } finally {
        setMyLoading(false);
        setMyInitialLoad(false);
      }
    },
    [myQuery, myStatusFilter],
  );

  // Fetch All Student Cases
  const fetchAllStudentCases = useCallback(
    async (pageNum: number, append: boolean) => {
      setAllLoading(true);
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (!token) throw new Error("No auth token");

        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: PAGE_SIZE.toString(),
        });
        if (allQuery.trim()) params.append("search", allQuery.trim());
        const status = mapStatusToBackend(allStatusFilter);
        if (status) params.append("status", status);

        const resp = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/instructor/view_students?${params.toString()}`,
          { headers: { Authorization: token, "Content-Type": "application/json" } },
        );

        if (resp.ok) {
          const data = await resp.json();
          const fetched = Array.isArray(data.cases) ? data.cases : [];
          if (append) {
            setAllStudentCases((prev) => [...prev, ...fetched]);
          } else {
            setAllStudentCases(fetched);
          }
          setAllTotalCount(data.totalCount || 0);
        } else {
          if (!append) {
            setAllStudentCases([]);
            setAllTotalCount(0);
          }
        }
      } catch (err) {
        console.error("Error fetching student cases", err);
        if (!append) {
          setAllStudentCases([]);
          setAllTotalCount(0);
        }
      } finally {
        setAllLoading(false);
        setAllInitialLoad(false);
      }
    },
    [allQuery, allStatusFilter],
  );

  // Reset + fetch page 0 for My Cases when filters change
  useEffect(() => {
    setMyPage(0);
    const delay = setTimeout(() => fetchMyCases(0, false), 300);
    return () => clearTimeout(delay);
  }, [fetchMyCases]);

  // Load next page for My Cases
  useEffect(() => {
    if (myPage === 0) return;
    fetchMyCases(myPage, true);
  }, [myPage, fetchMyCases]);

  // Reset + fetch page 0 for All Student Cases when filters change
  useEffect(() => {
    setAllPage(0);
    const delay = setTimeout(() => fetchAllStudentCases(0, false), 300);
    return () => clearTimeout(delay);
  }, [fetchAllStudentCases]);

  // Load next page for All Student Cases
  useEffect(() => {
    if (allPage === 0) return;
    fetchAllStudentCases(allPage, true);
  }, [allPage, fetchAllStudentCases]);

  // IntersectionObserver for My Cases sentinel
  useEffect(() => {
    const sentinel = mySentinelRef.current;
    if (!sentinel || activeTab !== 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !myLoading && myCases.length < myTotalCount) {
          setMyPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [myLoading, myCases.length, myTotalCount, activeTab]);

  // IntersectionObserver for All Student Cases sentinel
  useEffect(() => {
    const sentinel = allSentinelRef.current;
    if (!sentinel || activeTab !== 1) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !allLoading && allStudentCases.length < allTotalCount) {
          setAllPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [allLoading, allStudentCases.length, allTotalCount, activeTab]);

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
        { method: "DELETE", headers: { Authorization: token } },
      );

      if (response.ok) {
        showSnackbar("Case deleted successfully", "success");
        setDeleteDialogOpen(false);
        setCaseToDelete(null);
        // Re-fetch both from scratch
        setMyPage(0);
        fetchMyCases(0, false);
        setAllPage(0);
        fetchAllStudentCases(0, false);
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
    try {
      const targetCase =
        myCases.find((c) => c.case_id === caseId) ||
        allStudentCases.find((c) => c.case_id === caseId);
      if (!targetCase) {
        showSnackbar("Case not found", "error");
        return;
      }

      const isArchived = (targetCase.status || "").toLowerCase() === "archived";
      const endpoint = isArchived ? "instructor/unarchive_case" : "instructor/archive_case";

      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No auth token");

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/${endpoint}?case_id=${caseId}`,
        { method: "PUT", headers: { Authorization: token, "Content-Type": "application/json" } },
      );

      if (response.ok) {
        showSnackbar(
          isArchived ? "Case unarchived successfully" : "Case archived successfully",
          "success",
        );
        setMyPage(0);
        fetchMyCases(0, false);
        setAllPage(0);
        fetchAllStudentCases(0, false);
      } else {
        const data = await response.json();
        showSnackbar(data.error || "Failed to update case archive status", "error");
      }
    } catch (err) {
      console.error("Error archiving case", err);
      showSnackbar("Failed to update case archive status", "error");
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const currentQuery = activeTab === 0 ? myQuery : allQuery;
  const currentStatusFilter = activeTab === 0 ? myStatusFilter : allStatusFilter;

  const handleQueryChange = (value: string) => {
    if (activeTab === 0) setMyQuery(value);
    else setAllQuery(value);
  };

  const handleStatusFilterChange = (value: string) => {
    if (activeTab === 0) setMyStatusFilter(value);
    else setAllStatusFilter(value);
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
      <SupervisorHeader />

      <Container maxWidth="lg" sx={{ mt: 8, mb: 4, flexGrow: 1 }}>
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
              "& .Mui-selected": { color: "var(--primary)" },
            }}
          >
            <Tab label={`My Cases (${myTotalCount})`} id="tab-0" aria-controls="tabpanel-0" />
            <Tab
              label={`All ${plural("student")} Cases (${allTotalCount})`}
              id="tab-1"
              aria-controls="tabpanel-1"
            />
          </Tabs>

          <Box sx={{ mb: 1, display: "flex", gap: 2, alignItems: "center" }}>
            <TextField
              variant="outlined"
              size="small"
              placeholder="Search..."
              value={currentQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "var(--text-secondary)", fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                minWidth: "250px",
                backgroundColor: "var(--background)",
                "& .MuiOutlinedInput-root": {
                  color: "var(--text)",
                  "& fieldset": { borderColor: "var(--border)" },
                  "&:hover fieldset": { borderColor: "var(--text-secondary)" },
                  "&.Mui-focused fieldset": { borderColor: "var(--primary)" },
                },
              }}
            />

            <FormControl
              size="small"
              sx={{
                minWidth: 150,
                "& .MuiOutlinedInput-root": {
                  color: "var(--text)",
                  backgroundColor: "var(--background)",
                  "& fieldset": { borderColor: "var(--border)" },
                  "&:hover fieldset": { borderColor: "var(--text-secondary)" },
                  "&.Mui-focused fieldset": { borderColor: "var(--primary)" },
                  "& .MuiSelect-select": { textAlign: "left" },
                  "& .MuiSvgIcon-root": { color: "var(--text)" },
                },
                "& .MuiInputLabel-root": { color: "var(--text-secondary)" },
              }}
            >
              <InputLabel id="status-filter-label">Status</InputLabel>
              <Select
                labelId="status-filter-label"
                value={currentStatusFilter}
                label="Status"
                onChange={(e) => handleStatusFilterChange(e.target.value)}
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
                <MenuItem value="All">All Statuses</MenuItem>
                <MenuItem value="Sent to Review">Pending Review</MenuItem>
                <MenuItem value="Reviewed">Reviewed</MenuItem>
                <MenuItem value="In Progress">In Progress</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        {/* Tab 0: My Cases */}
        {activeTab === 0 && (
          <Box role="tabpanel">
            {myInitialLoad ? (
              <Box display="flex" justifyContent="center" sx={{ mt: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <Grid container spacing={3}>
                  {myCases.length === 0 && !myLoading ? (
                    <Grid size={{ xs: 12 }}>
                      <Typography sx={{ color: "var(--text-secondary)" }}>
                        No cases created by you found.
                      </Typography>
                    </Grid>
                  ) : (
                    myCases.map((caseItem, index) => (
                      <Grid size={{ xs: 12, sm: 6, md: 4 }} key={`my-case-${caseItem.case_id}-${index}`}>
                        <CaseCard
                          caseId={caseItem.case_id}
                          caseHash={caseItem.case_hash}
                          title={caseItem.case_title}
                          status={caseItem.status}
                          jurisdiction={caseItem.jurisdiction?.join(", ")}
                          dateAdded={new Date(caseItem.last_updated).toLocaleDateString()}
                          onDelete={handleDeleteCase}
                          onArchive={handleArchiveCase}
                          archiveLabel={
                            caseItem.status?.toLowerCase() === "archived" ? "Unarchive" : "Archive"
                          }
                          onClick={(id) => navigate(`/case/${id}/overview`)}
                        />
                      </Grid>
                    ))
                  )}
                </Grid>
                <div ref={mySentinelRef} style={{ height: 1 }} />
                {myLoading && (
                  <Box display="flex" justifyContent="center" sx={{ mt: 3, mb: 2 }}>
                    <CircularProgress size={28} />
                  </Box>
                )}
              </>
            )}
          </Box>
        )}

        {/* Tab 1: All Student Cases */}
        {activeTab === 1 && (
          <Box role="tabpanel">
            {allInitialLoad ? (
              <Box display="flex" justifyContent="center" sx={{ mt: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <Grid container spacing={3}>
                  {allStudentCases.length === 0 && !allLoading ? (
                    <Grid size={{ xs: 12 }}>
                      <Typography sx={{ color: "var(--text-secondary)" }}>
                        No {plural("student").toLowerCase()} cases found matching current filters.
                      </Typography>
                    </Grid>
                  ) : (
                    allStudentCases.map((caseItem, index) => (
                      <Grid
                        size={{ xs: 12, sm: 6, md: 4 }}
                        key={`student-case-${caseItem.case_id}-${index}`}
                      >
                        <CaseCard
                          caseId={caseItem.case_id}
                          caseHash={caseItem.case_hash}
                          title={caseItem.case_title}
                          status={caseItem.status}
                          jurisdiction={caseItem.jurisdiction?.join(", ")}
                          dateAdded={new Date(caseItem.last_updated).toLocaleDateString()}
                          advocateName={`${caseItem.first_name || ""} ${caseItem.last_name || ""}`}
                          onDelete={handleDeleteCase}
                          onArchive={handleArchiveCase}
                          archiveLabel={
                            caseItem.status?.toLowerCase() === "archived" ? "Unarchive" : "Archive"
                          }
                          onClick={(id) => navigate(`/case/${id}/overview`)}
                        />
                      </Grid>
                    ))
                  )}
                </Grid>
                <div ref={allSentinelRef} style={{ height: 1 }} />
                {allLoading && (
                  <Box display="flex" justifyContent="center" sx={{ mt: 3, mb: 2 }}>
                    <CircularProgress size={28} />
                  </Box>
                )}
              </>
            )}
          </Box>
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

      <CaseDeleteConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        caseTitle={caseToDelete?.case_title || ""}
      />
    </Box>
  );
};

export default SupervisorDashboard;
