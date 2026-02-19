import React, { useState, useEffect, useCallback } from "react";
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
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InputIcon from "@mui/icons-material/Input";
import { fetchAuthSession } from "aws-amplify/auth";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";

// Types
type PromptCategory = "General Settings" | "reasoning" | "assessment";

type BlockType =
  | "intake"
  | "issues"
  | "research"
  | "argument"
  | "contrarian"
  | "policy";

interface PromptVersion {
  prompt_version_id: string;
  category: PromptCategory;
  block_type: BlockType;
  version_number: number;
  version_name: string;
  prompt_text: string;
  author_id: string;
  author_name?: string;
  time_created: string;
  is_active: boolean;
}

interface PromptEditorProps {
  category: PromptCategory;
  blockType: BlockType;
  title: string;
  description: string;
}

const DRAFT_ID = "new_draft";

const PromptEditor: React.FC<PromptEditorProps> = ({
  category,
  blockType,
  title,
  description,
}) => {
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [editorContent, setEditorContent] = useState<string>("");
  const [versionName, setVersionName] = useState<string>("");

  // Error States
  const [versionNameError, setVersionNameError] = useState<string | null>(null);
  const [editorContentError, setEditorContentError] = useState<string | null>(
    null,
  );

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PromptVersion | null>(null);

  const fetchPrompts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No auth token");

      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }/admin/prompt?category=${category}&block_type=${blockType}`,
        { headers: { Authorization: token } },
      );
      if (!response.ok) throw new Error("Failed to fetch prompts");
      const data = await response.json();
      setPrompts(data);
    } catch (err) {
      console.error("Error fetching prompts:", err);
      setError(err instanceof Error ? err.message : "Failed to load prompts");
    } finally {
      setIsLoading(false);
    }
  }, [category, blockType]);

  const createPromptVersion = async (promptData: {
    category: string;
    block_type: string;
    prompt_text: string;
    version_name?: string;
  }) => {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) throw new Error("No auth token");

    const response = await fetch(
      `${import.meta.env.VITE_API_ENDPOINT}/admin/prompt`,
      {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify(promptData),
      },
    );
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to create prompt");
    }
    return response.json();
  };

  const updatePromptVersion = async (updateData: {
    prompt_version_id: string;
    prompt_text?: string;
    version_name?: string;
  }) => {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) throw new Error("No auth token");

    const response = await fetch(
      `${import.meta.env.VITE_API_ENDPOINT}/admin/prompt`,
      {
        method: "PUT",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      },
    );
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to update prompt");
    }
    return response.json();
  };

  const activatePrompt = async (prompt_version_id: string) => {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) throw new Error("No auth token");

    const response = await fetch(
      `${import.meta.env.VITE_API_ENDPOINT}/admin/prompt/activate`,
      {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_version_id }),
      },
    );
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to activate prompt");
    }
    return response.json();
  };

  const deletePromptVersion = async (prompt_version_id: string) => {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) throw new Error("No auth token");

    const response = await fetch(
      `${import.meta.env.VITE_API_ENDPOINT}/admin/prompt?prompt_version_id=${prompt_version_id}`,
      {
        method: "DELETE",
        headers: { Authorization: token },
      },
    );
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Failed to delete prompt");
    }
    return response.json();
  };

  const handleStartDraft = () => {
    setSelectedVersionId(DRAFT_ID);
  };

  const handleCreateNewVersion = async () => {
    let hasError = false;
    setVersionNameError(null);
    setEditorContentError(null);

    if (!editorContent || editorContent.trim().length === 0) {
      setEditorContentError("Prompt content cannot be empty.");
      hasError = true;
    }
    if (!versionName || versionName.trim().length === 0) {
      setVersionNameError("Version name is required.");
      hasError = true;
    }

    if (hasError) return;

    try {
      const newPrompt = await createPromptVersion({
        category: category,
        block_type: blockType,
        prompt_text: editorContent,
        version_name: versionName || undefined,
      });
      setSnackbar({
        open: true,
        message: "New version created!",
        severity: "success",
      });
      await fetchPrompts();
      setSelectedVersionId(newPrompt.prompt_version_id);
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

    let hasError = false;
    setVersionNameError(null);
    setEditorContentError(null);

    if (!editorContent || editorContent.trim().length === 0) {
      setEditorContentError("Prompt content cannot be empty.");
      hasError = true;
    }
    if (!versionName || versionName.trim().length === 0) {
      setVersionNameError("Version name is required.");
      hasError = true;
    }

    if (hasError) return;

    try {
      await updatePromptVersion({
        prompt_version_id: selectedVersionId,
        prompt_text: editorContent,
        version_name: versionName,
      });
      setSnackbar({
        open: true,
        message: "Version saved!",
        severity: "success",
      });
      await fetchPrompts();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : "Failed to save",
        severity: "error",
      });
    }
  };

  const handleSetActive = async (targetId: string) => {
    try {
      await activatePrompt(targetId);
      setSnackbar({
        open: true,
        message: "Prompt activated!",
        severity: "success",
      });
      await fetchPrompts();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : "Failed to activate",
        severity: "error",
      });
    }
  };

  const handleDelete = (targetId: string) => {
    const promptToDelete = prompts.find(
      (p) => p.prompt_version_id === targetId,
    );
    if (promptToDelete?.is_active) {
      setSnackbar({
        open: true,
        message: "Cannot delete an active prompt. Activate another first.",
        severity: "error",
      });
      return;
    }
    if (promptToDelete) {
      setItemToDelete(promptToDelete);
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
      await deletePromptVersion(itemToDelete.prompt_version_id);
      setSnackbar({
        open: true,
        message: "Prompt deleted.",
        severity: "success",
      });
      await fetchPrompts();
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
    setPrompts((prev) =>
      prev.map((p) =>
        p.prompt_version_id === id ? { ...p, version_name: newName } : p,
      ),
    );
  };

  // ── Effects ─────────────────────────────────────────────────────────

  // Initial data fetch
  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  // Set initial selection or handle deletions
  useEffect(() => {
    if (isLoading) return;

    if (prompts.length === 0) {
      setSelectedVersionId("");
      setEditorContent("");
      setVersionName("");
      return;
    }

    // Check if current selection is still valid
    const currentStillExists = prompts.some(
      (p) => p.prompt_version_id === selectedVersionId,
    );

    // If nothing selected OR the currently selected version was deleted (and it wasn't a draft)
    if (
      !selectedVersionId ||
      (selectedVersionId !== DRAFT_ID && !currentStillExists)
    ) {
      const active = prompts.find((p) => p.is_active);
      if (active) {
        setSelectedVersionId(active.prompt_version_id);
      } else {
        setSelectedVersionId(prompts[0].prompt_version_id);
      }
    }
  }, [isLoading, prompts, selectedVersionId]);

  // Update editor content when selection changes
  useEffect(() => {
    if (selectedVersionId === DRAFT_ID) {
      setEditorContent("");
      setVersionName("");
      setVersionNameError(null);
      setEditorContentError(null);
      return;
    }

    const version = prompts.find(
      (p) => p.prompt_version_id === selectedVersionId,
    );
    if (version) {
      setEditorContent(version.prompt_text);
      setVersionName(version.version_name);
      // Clear errors on load as we assume stored versions are valid
      setVersionNameError(null);
      setEditorContentError(null);
    } else {
      setEditorContent("");
      setVersionName("");
    }
  }, [selectedVersionId, prompts]);

  // Real-time validation
  useEffect(() => {
    if (versionName.trim().length === 0) {
      setVersionNameError("Version name is required.");
    } else {
      setVersionNameError(null);
    }
  }, [versionName]);

  useEffect(() => {
    if (editorContent.trim().length === 0) {
      setEditorContentError("Prompt content cannot be empty.");
    } else {
      setEditorContentError(null);
    }
  }, [editorContent]);

  // ── Derived Values ──────────────────────────────────────────────────

  const currentVersion = prompts.find(
    (p) => p.prompt_version_id === selectedVersionId,
  );

  return (
    <>
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
              {title} - Workspace
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "var(--text-secondary)",
                textAlign: "left",
                display: "block",
                mb: 1,
              }}
            >
              {description}
            </Typography>
            <Alert
              severity="info"
              icon={false}
              sx={{
                backgroundColor: "transparent",
                color: "var(--text-secondary)",
                p: 0,
                fontSize: "0.8rem",
                "& .MuiAlert-message": { p: 0 },
              }}
            >
              Note: Create a new version here to test in the Playground.
            </Alert>
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
                    label={`Editing: ${currentVersion.version_name}`}
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
            error={!!versionNameError}
            helperText={versionNameError}
            sx={{
              "& .MuiOutlinedInput-root": {
                color: "var(--text)",
                backgroundColor: "var(--background)",
                "& fieldset": { borderColor: "var(--border)" },
                "&:hover fieldset": { borderColor: "var(--border)" },
                "&.Mui-focused fieldset": { borderColor: "var(--primary)" },
              },
              "& .MuiInputLabel-root": {
                color: "var(--text-secondary)",
                "&.Mui-focused": { color: "var(--primary)" },
              },
              "& .MuiInputLabel-root.Mui-error": {
                color: "var(--text-secondary)",
              },
              "& .MuiFormHelperText-root:not(.Mui-error)": {
                color: "var(--text-secondary)",
              },
            }}
          />
          <TextField
            label="Prompt Content"
            multiline
            fullWidth
            minRows={10}
            maxRows={25}
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            placeholder="Enter prompt content here..."
            variant="outlined"
            error={!!editorContentError}
            helperText={editorContentError}
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
                "&:hover fieldset": { borderColor: "var(--border)" },
                "&.Mui-focused fieldset": { borderColor: "var(--primary)" },
              },
              "& .MuiInputLabel-root": {
                color: "var(--text-secondary)",
                "&.Mui-focused": { color: "var(--primary)" },
              },
              "& .MuiInputLabel-root.Mui-error": {
                color: "var(--text-secondary)",
              },
              "& .MuiFormHelperText-root:not(.Mui-error)": {
                color: "var(--text-secondary)",
              },
            }}
          />
        </Box>

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
                  setEditorContent(currentVersion?.prompt_text || "")
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
                disabled={!!versionNameError || !!editorContentError}
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
                disabled={!!versionNameError || !!editorContentError}
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
          mt: 3,
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
                  Created At
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
              ) : prompts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    align="center"
                    sx={{ color: "var(--text-secondary)", py: 4 }}
                  >
                    No versions found for this block.
                  </TableCell>
                </TableRow>
              ) : (
                prompts.map((version) => (
                  <TableRow
                    key={version.prompt_version_id}
                    hover
                    sx={{
                      "&:last-child td, &:last-child th": { border: 0 },
                    }}
                  >
                    <TableCell
                      sx={{ color: "var(--text)", fontWeight: "bold" }}
                    >
                      v{version.version_number}
                    </TableCell>
                    <TableCell sx={{ color: "var(--text)" }}>
                      <TextField
                        value={version.version_name}
                        onChange={(e) =>
                          handleNameChange(
                            version.prompt_version_id,
                            e.target.value,
                          )
                        }
                        variant="standard"
                        fullWidth
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
                      {new Date(version.time_created).toLocaleDateString()}
                    </TableCell>
                    <TableCell sx={{ color: "var(--text-secondary)" }}>
                      {version.author_name || version.author_id || "Unknown"}
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
                            handleSetActive(version.prompt_version_id)
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
                              setSelectedVersionId(version.prompt_version_id)
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
                              handleDelete(version.prompt_version_id)
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
        itemName="delete prompt"
        title="Delete Prompt Version"
        description="Are you sure you want to delete this prompt version? This action cannot be undone."
      />
    </>
  );
};

export default PromptEditor;
