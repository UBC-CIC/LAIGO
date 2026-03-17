import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Snackbar,
  Alert,
  Switch,
  Stack,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import RefreshIcon from "@mui/icons-material/Refresh";
import AdminHeader from "../../components/AdminHeader";
import { fetchAuthSession } from "aws-amplify/auth";

interface WhitelistEntry {
  email: string;
  canonical_role: string;
  uploaded_label: string;
}

interface InvalidRow {
  row: number;
  email: string;
  label: string;
  reason: string;
}

const AdminWhitelist = () => {
  const [signupMode, setSignupMode] = useState<"public" | "whitelist">("public");
  const [modeLoading, setModeLoading] = useState(true);
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "warning";
  }>({ open: false, message: "", severity: "success" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getToken = async () => {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) throw new Error("No auth token");
    return token;
  };

  // ── Signup Mode ───────────────────────────────────────────────────────────

  const fetchSignupMode = useCallback(async () => {
    setModeLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/signup_mode`,
        { headers: { Authorization: token } },
      );
      const data = await res.json();
      setSignupMode(data.mode === "whitelist" ? "whitelist" : "public");
    } catch (err) {
      console.error("Failed to load signup mode:", err);
    } finally {
      setModeLoading(false);
    }
  }, []);

  const handleModeToggle = async () => {
    const newMode = signupMode === "public" ? "whitelist" : "public";
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/signup_mode`,
        {
          method: "PUT",
          headers: { Authorization: token, "Content-Type": "application/json" },
          body: JSON.stringify({ mode: newMode }),
        },
      );
      if (!res.ok) throw new Error("Failed to update signup mode");
      setSignupMode(newMode);
      setSnackbar({
        open: true,
        message: `Signup mode switched to ${newMode}`,
        severity: "success",
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : "Failed to update mode",
        severity: "error",
      });
    }
  };

  // ── Whitelist Entries ─────────────────────────────────────────────────────

  const fetchWhitelist = useCallback(async () => {
    setListLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/whitelist`,
        { headers: { Authorization: token } },
      );
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err) {
      console.error("Failed to load whitelist:", err);
    } finally {
      setListLoading(false);
    }
  }, []);

  const handleDeleteEntry = async (email: string) => {
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/whitelist?email=${encodeURIComponent(email)}`,
        { method: "DELETE", headers: { Authorization: token } },
      );
      if (!res.ok) throw new Error("Failed to delete entry");
      setEntries((prev) => prev.filter((e) => e.email !== email));
      setSnackbar({ open: true, message: "Entry removed", severity: "success" });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : "Failed to delete",
        severity: "error",
      });
    }
  };

  // ── CSV Upload ────────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!file.name.endsWith(".csv")) {
      setSnackbar({ open: true, message: "Please upload a .csv file", severity: "error" });
      return;
    }

    const csvText = await file.text();
    setUploading(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/whitelist/upload`,
        {
          method: "POST",
          headers: { Authorization: token, "Content-Type": "application/json" },
          body: JSON.stringify({ csv: csvText }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      const { processed, invalid, invalidRows } = data as {
        processed: number;
        invalid: number;
        invalidRows: InvalidRow[];
      };

      if (invalid > 0) {
        const reasons = invalidRows
          .slice(0, 3)
          .map((r: InvalidRow) => `Row ${r.row}: ${r.email} (${r.reason})`)
          .join("; ");
        setSnackbar({
          open: true,
          message: `Uploaded ${processed} entries. ${invalid} rows skipped: ${reasons}${invalid > 3 ? "…" : ""}`,
          severity: "warning",
        });
      } else {
        setSnackbar({
          open: true,
          message: `Successfully uploaded ${processed} entries`,
          severity: "success",
        });
      }
      await fetchWhitelist();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : "Upload failed",
        severity: "error",
      });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    fetchSignupMode();
    fetchWhitelist();
  }, [fetchSignupMode, fetchWhitelist]);

  const roleColor = (role: string) => {
    switch (role) {
      case "admin": return { bg: "rgba(239,83,80,0.15)", fg: "#ef6c00" };
      case "instructor": return { bg: "rgba(66,165,245,0.15)", fg: "#42a5f5" };
      default: return { bg: "rgba(102,187,106,0.15)", fg: "#66bb6a" };
    }
  };

  return (
    <Box
      sx={{
        backgroundColor: "var(--background)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AdminHeader />
      <Box
        sx={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          p: 4,
          overflow: "auto",
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: "1200px",
            display: "flex",
            flexDirection: "column",
            gap: 3,
            border: "1px solid var(--border)",
            borderRadius: 2,
            p: 4,
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: "bold", color: "var(--text)" }}>
            Signup Access Control
          </Typography>

          {/* ── Mode Toggle Panel ─────────────────────────────────────────── */}
          <Paper
            elevation={0}
            sx={{
              backgroundColor: "var(--paper)",
              border: "1px solid var(--border)",
              borderRadius: 2,
              p: 3,
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: "bold", color: "var(--text)", mb: 0.5 }}>
                  Signup Mode
                </Typography>
                <Typography variant="body2" sx={{ color: "var(--text-secondary)", maxWidth: 500 }}>
                  {signupMode === "public"
                    ? "Public mode: any user with an allowed email domain can sign up and will be assigned the Student role."
                    : "Whitelist mode: only emails listed in the whitelist below can sign up, and each is assigned the role from the CSV."}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                {modeLoading ? (
                  <CircularProgress size={24} sx={{ color: "var(--primary)" }} />
                ) : (
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" sx={{ color: "var(--text-secondary)" }}>
                      Public
                    </Typography>
                    <Switch
                      checked={signupMode === "whitelist"}
                      onChange={handleModeToggle}
                      sx={{
                        "& .MuiSwitch-thumb": { backgroundColor: "var(--primary)" },
                        "& .MuiSwitch-track": { backgroundColor: "var(--border)" },
                      }}
                    />
                    <Typography variant="body2" sx={{ color: "var(--text-secondary)" }}>
                      Whitelist
                    </Typography>
                    <Chip
                      label={signupMode === "whitelist" ? "Whitelist Active" : "Public"}
                      size="small"
                      sx={{
                        backgroundColor: signupMode === "whitelist" ? "rgba(66,165,245,0.15)" : "rgba(102,187,106,0.15)",
                        color: signupMode === "whitelist" ? "#42a5f5" : "#66bb6a",
                        fontWeight: 600,
                        border: "none",
                      }}
                    />
                  </Stack>
                )}
              </Box>
            </Box>
          </Paper>

          {/* ── Whitelist Table Panel ─────────────────────────────────────── */}
          <Paper
            elevation={0}
            sx={{
              backgroundColor: "var(--paper)",
              border: "1px solid var(--border)",
              borderRadius: 2,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Panel Header */}
            <Box
              sx={{
                p: 2,
                backgroundColor: "var(--header)",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: "bold", color: "var(--text)" }}>
                  Email Whitelist
                </Typography>
                <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block" }}>
                  CSV format: <code>email,role</code> — role must match a configured role label or canonical name (student / instructor / admin).
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Tooltip title="Refresh whitelist">
                  <IconButton
                    size="small"
                    onClick={fetchWhitelist}
                    sx={{ color: "var(--text-secondary)" }}
                  >
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                <Button
                  variant="contained"
                  size="small"
                  startIcon={uploading ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : <UploadFileIcon />}
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    backgroundColor: "var(--primary)",
                    color: "var(--text)",
                    textTransform: "none",
                    fontWeight: "bold",
                    "&:hover": { backgroundColor: "var(--primary)", opacity: 0.9 },
                  }}
                >
                  {uploading ? "Uploading…" : "Upload CSV"}
                </Button>
              </Box>
            </Box>

            {/* Table */}
            <TableContainer sx={{ maxHeight: 480 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {["Email", "Role Label", "Canonical Role", "Actions"].map((h) => (
                      <TableCell
                        key={h}
                        align={h === "Actions" ? "right" : "left"}
                        sx={{
                          backgroundColor: "var(--header)",
                          color: "var(--text-secondary)",
                          borderBottom: "1px solid var(--border)",
                          fontWeight: 600,
                        }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {listLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ color: "var(--text-secondary)", py: 5 }}>
                        <CircularProgress size={24} sx={{ color: "var(--primary)" }} />
                      </TableCell>
                    </TableRow>
                  ) : entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ color: "var(--text-secondary)", py: 5 }}>
                        No entries in the whitelist. Upload a CSV to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry) => {
                      const { bg, fg } = roleColor(entry.canonical_role);
                      return (
                        <TableRow
                          key={entry.email}
                          hover
                          sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                        >
                          <TableCell sx={{ color: "var(--text)", fontFamily: "monospace", fontSize: "0.85rem" }}>
                            {entry.email}
                          </TableCell>
                          <TableCell sx={{ color: "var(--text-secondary)" }}>
                            {entry.uploaded_label || "—"}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={entry.canonical_role}
                              size="small"
                              sx={{ backgroundColor: bg, color: fg, fontWeight: 600, border: "none" }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Remove from whitelist">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteEntry(entry.email)}
                                sx={{ color: "var(--text-secondary)", "&:hover": { color: "#ef5350" } }}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Footer */}
            {entries.length > 0 && (
              <Box sx={{ p: 1.5, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
                <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
                  {entries.length} {entries.length === 1 ? "entry" : "entries"}
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminWhitelist;
