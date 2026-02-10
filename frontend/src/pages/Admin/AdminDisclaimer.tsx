import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
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
} from "@mui/material";
import DeleteConfirmationDialog from "../../components/Admin/DeleteConfirmationDialog";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InputIcon from "@mui/icons-material/Input";
import AdminHeader from "../../components/AdminHeader";
import { fetchAuthSession } from "aws-amplify/auth";

interface DisclaimerVersion {
  disclaimer_id: string;
  version_number: number;
  version_name: string;
  disclaimer_text: string;
  author_id: string;
  author_name?: string;
  time_created: string;
  last_updated: string;
  is_active: boolean;
}

const DRAFT_ID = "new_draft";

const AdminDisclaimer = () => {
  const [allDisclaimers, setAllDisclaimers] = useState<DisclaimerVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [editorContent, setEditorContent] = useState<string>("");
  const [versionName, setVersionName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DisclaimerVersion | null>(
    null,
  );

  // API Functions
  const fetchDisclaimers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No auth token");

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/disclaimer`,
        { headers: { Authorization: token } },
      );
      if (!response.ok) throw new Error("Failed to fetch disclaimers");
      const data = await response.json();
      setAllDisclaimers(data);
    } catch (err) {
      console.error("Error fetching disclaimers:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load disclaimers",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createDisclaimer = async (disclaimerData: {
    disclaimer_text: string;
    version_name?: string;
  }) => {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) throw new Error("No auth token");

    const response = await fetch(
      `${import.meta.env.VITE_API_ENDPOINT}/admin/disclaimer`,
      {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify(disclaimerData),
      },
    );
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to create disclaimer");
    }
    return response.json();
  };

  const activateDisclaimer = async (disclaimer_id: string) => {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) throw new Error("No auth token");

    const response = await fetch(
      `${import.meta.env.VITE_API_ENDPOINT}/admin/disclaimer/activate`,
      {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({ disclaimer_id }),
      },
    );
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to activate disclaimer");
    }
    return response.json();
  };

  const deleteDisclaimerVersion = async (disclaimer_id: string) => {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) throw new Error("No auth token");

    const response = await fetch(
      `${import.meta.env.VITE_API_ENDPOINT}/admin/disclaimer?disclaimer_id=${disclaimer_id}`,
      {
        method: "DELETE",
        headers: { Authorization: token },
      },
    );
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to delete disclaimer");
    }
    return response.json();
  };

  const updateDisclaimerVersion = async (updateData: {
    disclaimer_id: string;
    disclaimer_text?: string;
    version_name?: string;
  }) => {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) throw new Error("No auth token");

    const response = await fetch(
      `${import.meta.env.VITE_API_ENDPOINT}/admin/disclaimer`,
      {
        method: "PUT",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      },
    );
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to update disclaimer");
    }
    return response.json();
  };

  // Fetch disclaimers on mount
  useEffect(() => {
    fetchDisclaimers();
  }, [fetchDisclaimers]);

  // Set initial selection when data loads
  useEffect(() => {
    if (allDisclaimers.length > 0 && !selectedVersionId) {
      const activeVersion = allDisclaimers.find((d) => d.is_active);
      setSelectedVersionId(
        activeVersion?.disclaimer_id || allDisclaimers[0].disclaimer_id,
      );
    }
  }, [allDisclaimers, selectedVersionId]);

  // Update editor content when version changes
  useEffect(() => {
    const version = allDisclaimers.find(
      (d) => d.disclaimer_id === selectedVersionId,
    );
    if (version) {
      setEditorContent(version.disclaimer_text);
      setVersionName(version.version_name || "");
    } else if (selectedVersionId === DRAFT_ID) {
      setEditorContent("");
      setVersionName("");
    }
  }, [selectedVersionId, allDisclaimers]);

  const currentVersion = allDisclaimers.find(
    (d) => d.disclaimer_id === selectedVersionId,
  );

  const handleStartDraft = () => {
    setSelectedVersionId(DRAFT_ID);
  };

  const handleCreateNewVersion = async () => {
    try {
      const newDisclaimer = await createDisclaimer({
        disclaimer_text: editorContent,
        version_name: versionName || undefined,
      });
      setSnackbar({
        open: true,
        message: "New version created!",
        severity: "success",
      });
      await fetchDisclaimers();
      setSelectedVersionId(newDisclaimer.disclaimer_id);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : "Failed to create",
        severity: "error",
      });
    }
  };

  const handleSaveCurrent = async () => {
    if (!selectedVersionId || selectedVersionId === DRAFT_ID) {
      setSnackbar({
        open: true,
        message: "No version selected to save",
        severity: "error",
      });
      return;
    }
    try {
      await updateDisclaimerVersion({
        disclaimer_id: selectedVersionId,
        disclaimer_text: editorContent,
        version_name: versionName,
      });
      setSnackbar({
        open: true,
        message: "Version saved!",
        severity: "success",
      });
      await fetchDisclaimers();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : "Failed to save",
        severity: "error",
      });
    }
  };

  const handleSetActive = async (targetId: string = selectedVersionId) => {
    try {
      await activateDisclaimer(targetId);
      setSnackbar({
        open: true,
        message: "Disclaimer activated!",
        severity: "success",
      });
      await fetchDisclaimers();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : "Failed to activate",
        severity: "error",
      });
    }
  };

  const handleDelete = (targetId: string = selectedVersionId) => {
    const disclaimerToDelete = allDisclaimers.find(
      (d) => d.disclaimer_id === targetId,
    );
    if (disclaimerToDelete?.is_active) {
      setSnackbar({
        open: true,
        message: "Cannot delete an active disclaimer. Activate another first.",
        severity: "error",
      });
      return;
    }
    if (disclaimerToDelete) {
      setItemToDelete(disclaimerToDelete);
      setDeleteConfirmOpen(true);
    }
  };

  const handleCloseDeleteDialog = () => {
    setDeleteConfirmOpen(false);
    setItemToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDisclaimerVersion(itemToDelete.disclaimer_id);
      setSnackbar({
        open: true,
        message: "Disclaimer deleted.",
        severity: "success",
      });
      await fetchDisclaimers();
      handleCloseDeleteDialog();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : "Failed to delete",
        severity: "error",
      });
    }
  };

  const handleNameChange = (id: string, newName: string) => {
    setAllDisclaimers((prev) =>
      prev.map((d) =>
        d.disclaimer_id === id ? { ...d, version_name: newName } : d,
      ),
    );
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
            backgroundColor: "transparent",
          }}
        >
          <Typography
            variant="h5"
            sx={{ fontWeight: "bold", color: "var(--text)" }}
          >
            Disclaimer Management
          </Typography>

          {/* Workspace Panel */}
          <Paper
            elevation={0}
            sx={{
              width: "100%",
              backgroundColor: "var(--paper)",
              border: "1px solid var(--border)",
              borderRadius: 2,
              display: "flex",
              flexDirection: "column",
              minHeight: "400px",
              overflow: "hidden",
            }}
          >
            {/* Workspace Header */}
            <Box
              sx={{
                p: 2,
                borderBottom: "1px solid var(--border)",
                backgroundColor: "var(--header)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: "bold",
                    color: "var(--text)",
                    textAlign: "left",
                  }}
                >
                  Disclaimer Editor
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: "var(--text-secondary)",
                    textAlign: "left",
                    display: "block",
                  }}
                >
                  Edit the disclaimer text that users must accept before using
                  the system.
                </Typography>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0.5,
                }}
              >
                {selectedVersionId === DRAFT_ID ? (
                  <Chip
                    label="New Draft"
                    color="default"
                    variant="outlined"
                    size="small"
                    sx={{
                      borderColor: "var(--border)",
                      fontStyle: "italic",
                      color: "var(--text-secondary)",
                    }}
                  />
                ) : (
                  <>
                    {currentVersion && (
                      <Chip
                        label={`Editing: ${currentVersion.version_name || `v${currentVersion.version_number}`}`}
                        color="primary"
                        variant="outlined"
                        size="small"
                        sx={{ borderColor: "var(--border)" }}
                      />
                    )}
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={handleStartDraft}
                      sx={{
                        color: "var(--text)",
                        borderColor: "var(--border)",
                        textTransform: "none",
                        "&:hover": {
                          borderColor: "var(--text)",
                          backgroundColor: "var(--secondary)",
                        },
                      }}
                    >
                      Start New Draft
                    </Button>
                  </>
                )}
              </Box>
            </Box>

            {/* Editor */}
            <Box
              sx={{
                flex: 1,
                p: 3,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <TextField
                label="Version Name"
                fullWidth
                variant="outlined"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "var(--text)",
                    backgroundColor: "var(--background)",
                    "& fieldset": { borderColor: "var(--border)" },
                    "&:hover fieldset": {
                      borderColor: "var(--border)",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "var(--primary)",
                    },
                  },
                  "& .MuiInputLabel-root": {
                    color: "var(--text-secondary)",
                    "&.Mui-focused": {
                      color: "var(--primary)",
                    },
                  },
                }}
              />
              <TextField
                label="Disclaimer Content"
                multiline
                fullWidth
                minRows={10}
                maxRows={25}
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                placeholder="Enter disclaimer content here..."
                variant="outlined"
                sx={{
                  flex: 1,
                  "& .MuiOutlinedInput-root": {
                    height: "100%",
                    alignItems: "flex-start",
                    color: "var(--text)",
                    backgroundColor: "var(--background)",
                    fontFamily: "monospace",
                    fontSize: "0.95rem",
                    "& fieldset": { borderColor: "var(--border)" },
                    "&:hover fieldset": {
                      borderColor: "var(--border)",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "var(--primary)",
                    },
                  },
                  "& .MuiInputLabel-root": {
                    color: "var(--text-secondary)",
                    "&.Mui-focused": {
                      color: "var(--primary)",
                    },
                  },
                }}
              />
            </Box>

            {/* Footer Actions */}
            <Box
              sx={{
                p: 2,
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 2,
              }}
            >
              {selectedVersionId === DRAFT_ID ? (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleCreateNewVersion}
                  sx={{
                    backgroundColor: "var(--primary)",
                    color: "var(--text)",
                    textTransform: "none",
                    fontWeight: "bold",
                    "&:hover": {
                      backgroundColor: "var(--primary)",
                      opacity: 0.9,
                    },
                  }}
                >
                  Create New Version
                </Button>
              ) : (
                <>
                  <Button
                    variant="text"
                    startIcon={<RefreshIcon />}
                    onClick={() =>
                      setEditorContent(currentVersion?.disclaimer_text || "")
                    }
                    sx={{
                      color: "var(--text-secondary)",
                      textTransform: "none",
                    }}
                  >
                    Revert Changes
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveCurrent}
                    sx={{
                      color: "var(--text)",
                      borderColor: "var(--border)",
                      textTransform: "none",
                      "&:hover": {
                        borderColor: "var(--text)",
                        backgroundColor: "var(--secondary)",
                      },
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleCreateNewVersion}
                    sx={{
                      backgroundColor: "var(--primary)",
                      color: "var(--text)",
                      textTransform: "none",
                      fontWeight: "bold",
                      "&:hover": {
                        backgroundColor: "var(--primary)",
                        opacity: 0.9,
                      },
                    }}
                  >
                    Save as New Version
                  </Button>
                </>
              )}
            </Box>
          </Paper>

          {/* Version History Panel */}
          <Paper
            elevation={0}
            sx={{
              width: "100%",
              backgroundColor: "var(--paper)",
              border: "1px solid var(--border)",
              borderRadius: 2,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              minHeight: "300px",
            }}
          >
            <Box
              sx={{
                p: 2,
                backgroundColor: "var(--header)",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Typography
                variant="h6"
                fontWeight="bold"
                sx={{ color: "var(--text)" }}
              >
                Version History
              </Typography>
            </Box>

            <TableContainer sx={{ flex: 1, overflow: "auto" }}>
              <Table stickyHeader sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        backgroundColor: "var(--header)",
                        color: "var(--text-secondary)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      Version
                    </TableCell>
                    <TableCell
                      sx={{
                        backgroundColor: "var(--header)",
                        color: "var(--text-secondary)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      Name
                    </TableCell>
                    <TableCell
                      sx={{
                        backgroundColor: "var(--header)",
                        color: "var(--text-secondary)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      Last Updated
                    </TableCell>
                    <TableCell
                      sx={{
                        backgroundColor: "var(--header)",
                        color: "var(--text-secondary)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      Author
                    </TableCell>
                    <TableCell
                      sx={{
                        backgroundColor: "var(--header)",
                        color: "var(--text-secondary)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      Status
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        backgroundColor: "var(--header)",
                        color: "var(--text-secondary)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        align="center"
                        sx={{ color: "var(--text-secondary)", py: 4 }}
                      >
                        <CircularProgress
                          size={24}
                          sx={{ color: "var(--primary)" }}
                        />
                      </TableCell>
                    </TableRow>
                  ) : error ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        align="center"
                        sx={{ color: "#ef5350", py: 4 }}
                      >
                        {error}
                      </TableCell>
                    </TableRow>
                  ) : allDisclaimers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        align="center"
                        sx={{ color: "var(--text-secondary)", py: 4 }}
                      >
                        No disclaimer versions found. Create one to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    allDisclaimers.map((version) => (
                      <TableRow
                        key={version.disclaimer_id}
                        hover
                        sx={{
                          "&:last-child td, &:last-child th": {
                            border: 0,
                          },
                        }}
                      >
                        <TableCell
                          sx={{
                            color: "var(--text)",
                            fontWeight: "bold",
                          }}
                        >
                          v{version.version_number}
                        </TableCell>
                        <TableCell sx={{ color: "var(--text)" }}>
                          <TextField
                            value={version.version_name || ""}
                            onChange={(e) =>
                              handleNameChange(
                                version.disclaimer_id,
                                e.target.value,
                              )
                            }
                            variant="standard"
                            fullWidth
                            placeholder="Untitled"
                            InputProps={{
                              disableUnderline: true,
                              sx: {
                                fontSize: "0.875rem",
                                color: "var(--text)",
                                fontWeight: 500,
                                backgroundColor: "rgba(255,255,255,0.05)",
                                px: 1,
                                py: 0.5,
                                borderRadius: 1,
                                transition: "background-color 0.2s",
                                "&:hover": {
                                  backgroundColor: "rgba(255,255,255,0.1)",
                                },
                                "&.Mui-focused": {
                                  backgroundColor: "rgba(255,255,255,0.15)",
                                  boxShadow: "0 0 0 1px #64B5F6",
                                },
                              },
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: "var(--text-secondary)" }}>
                          {new Date(version.last_updated).toLocaleDateString()}
                        </TableCell>
                        <TableCell sx={{ color: "var(--text-secondary)" }}>
                          {version.author_name ||
                            version.author_id ||
                            "Unknown"}
                        </TableCell>
                        <TableCell>
                          {version.is_active ? (
                            <Chip
                              icon={
                                <CheckCircleIcon style={{ color: "inherit" }} />
                              }
                              label="Active"
                              size="small"
                              sx={{
                                backgroundColor: "rgba(76, 175, 80, 0.1)",
                                color: "#66bb6a",
                                fontWeight: "bold",
                                border: "1px solid rgba(76, 175, 80, 0.2)",
                              }}
                            />
                          ) : (
                            <Button
                              variant="outlined"
                              size="small"
                              color="inherit"
                              startIcon={<CheckCircleIcon />}
                              onClick={() =>
                                handleSetActive(version.disclaimer_id)
                              }
                              sx={{
                                textTransform: "none",
                                color: "var(--text-secondary)",
                                borderColor: "rgba(255,255,255,0.2)",
                                fontSize: "0.8rem",
                                "&:hover": {
                                  borderColor: "var(--text)",
                                  backgroundColor: "rgba(255,255,255,0.05)",
                                },
                              }}
                            >
                              Set active
                            </Button>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "flex-end",
                              gap: 1,
                            }}
                          >
                            <Tooltip title="Load to Workspace">
                              <IconButton
                                size="small"
                                onClick={() =>
                                  setSelectedVersionId(version.disclaimer_id)
                                }
                                sx={{ color: "#42a5f5" }}
                              >
                                <InputIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                onClick={() =>
                                  handleDelete(version.disclaimer_id)
                                }
                                sx={{
                                  color: "var(--text-secondary)",
                                  "&:hover": { color: "#ef5350" },
                                }}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={8000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        title="Delete Disclaimer Version"
        itemName={
          itemToDelete?.version_name || `v${itemToDelete?.version_number}`
        }
        description={`Are you sure you want to delete "${itemToDelete?.version_name || `v${itemToDelete?.version_number}`}"? This action cannot be undone.`}
      />
    </Box>
  );
};

export default AdminDisclaimer;
