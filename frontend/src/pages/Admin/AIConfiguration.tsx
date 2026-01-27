import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
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

// --- Types based on DB Schema & Requirements ---

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
  author_name?: string; // From JOIN with users table
  time_created: string;
  is_active: boolean;
}

// Mapping from Sidebar ID to Backend Enums
const SIDEBAR_TO_BACKEND: Record<
  string,
  { category: PromptCategory; block_type: BlockType | null }
> = {
  // General
  "model-configs": { category: "General Settings", block_type: null },

  // Reasoning
  "intake-facts": { category: "reasoning", block_type: "intake" },
  "issue-identification": { category: "reasoning", block_type: "issues" },
  "research-strategy": { category: "reasoning", block_type: "research" },
  "argument-construction": { category: "reasoning", block_type: "argument" },
  "contrarian-analysis": { category: "reasoning", block_type: "contrarian" },
  "policy-context": { category: "reasoning", block_type: "policy" },

  // Assessment
  "intake-assessment": { category: "assessment", block_type: "intake" },
  "issues-assessment": { category: "assessment", block_type: "issues" },
  "research-assessment": { category: "assessment", block_type: "research" },
};

interface SidebarItem {
  id: string;
  label: string;
  description: string;
}

interface SidebarSection {
  category: PromptCategory;
  items: SidebarItem[];
}

// --- Mock Data Setup ---

const SECTIONS: SidebarSection[] = [
  {
    category: "General Settings",
    items: [
      {
        id: "model-configs",
        label: "Model Configs",
        description:
          "Configure the global settings for the AI models, including temperature and model selection, which affect the overall behavior of the system.",
      },
    ],
  },
  {
    category: "reasoning",
    items: [
      {
        id: "intake-facts",
        label: "Intake & Facts",
        description:
          "Instructs the AI to guide the user through gathering relevant factual details, establishing a timeline, and identifying missing information to assess the case.",
      },
      {
        id: "issue-identification",
        label: "Issue Identification",
        description:
          "Directs the AI to help the user identify core legal issues based on the facts, exploring potential angles and framing the problem for research.",
      },
      {
        id: "research-strategy",
        label: "Research Strategy",
        description:
          "Guides the AI in helping the user formulate a research plan, identifying relevant case law, statutes, and regulations to support legal arguments.",
      },
      {
        id: "argument-construction",
        label: "Argument Construction",
        description:
          "Structures the AI's assistance in building a persuasive legal argument, synthesizing facts and research into a cohesive narrative for the client.",
      },
      {
        id: "contrarian-analysis",
        label: "Contrarian Analysis",
        description:
          "Instructs the AI to act as a 'Devil's Advocate', challenging arguments, identifying weaknesses, and anticipating opposition to strengthen the case.",
      },
      {
        id: "policy-context",
        label: "Policy Context",
        description:
          "Guides the user to consider broader contexts like comparative precedents, public policy, and Charter issues for a holistic analysis.",
      },
    ],
  },
  {
    category: "assessment",
    items: [
      {
        id: "intake-assessment",
        label: "Intake Assessment",
        description:
          "Defines criteria to evaluate if 'Intake & Facts' is complete. Passing advances the user to 'Issue Identification'.",
      },
      {
        id: "issues-assessment",
        label: "Issues Assessment",
        description:
          "Establishes standards for assessing issue understanding. Success advances the workflow to 'Research Strategy'.",
      },
      {
        id: "research-assessment",
        label: "Research Assessment",
        description:
          "Determines if the research strategy is robust. Approval unlocks advanced blocks (Argument, Contrarian, Policy).",
      },
    ],
  },
];

const AIConfiguration = () => {
  const [selectedBlockId, setSelectedBlockId] =
    useState<string>("intake-facts");
  const [allPrompts, setAllPrompts] = useState<PromptVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PromptVersion | null>(null);

  // API Functions
  const fetchPrompts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No auth token");

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/prompt`,
        { headers: { Authorization: token } },
      );
      if (!response.ok) throw new Error("Failed to fetch prompts");
      const data = await response.json();
      setAllPrompts(data);
    } catch (err) {
      console.error("Error fetching prompts:", err);
      setError(err instanceof Error ? err.message : "Failed to load prompts");
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  // Fetch prompts on mount
  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  // Filter based on mapping
  const currentTarget = SIDEBAR_TO_BACKEND[selectedBlockId];
  const blockPrompts = allPrompts
    .filter(
      (p) =>
        currentTarget &&
        p.category === currentTarget.category &&
        p.block_type === currentTarget.block_type,
    )
    .sort((a, b) => b.version_number - a.version_number);

  const activeVersion = blockPrompts.find((p) => p.is_active);
  const latestVersion = blockPrompts[0];
  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    activeVersion?.prompt_version_id || latestVersion?.prompt_version_id || "",
  );

  const [editorContent, setEditorContent] = useState<string>("");
  const [versionName, setVersionName] = useState<string>("");

  const DRAFT_ID = "new_draft";

  // Update editor content when version changes
  useEffect(() => {
    const version = allPrompts.find(
      (p) => p.prompt_version_id === selectedVersionId,
    );
    if (version) {
      if (editorContent !== version.prompt_text) {
        setEditorContent(version.prompt_text);
      }
      if (versionName !== version.version_name) {
        setVersionName(version.version_name);
      }
    } else if (blockPrompts.length > 0 && selectedVersionId !== DRAFT_ID) {
      // Fallback if selection is invalid
      const fallback =
        activeVersion?.prompt_version_id || blockPrompts[0].prompt_version_id;
      if (selectedVersionId !== fallback) {
        setSelectedVersionId(fallback);
      }
    } else {
      if (editorContent !== "") {
        setEditorContent("");
      }
      if (versionName !== "") {
        setVersionName("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersionId, selectedBlockId, allPrompts]);

  const handleBlockChange = (blockId: string) => {
    setSelectedBlockId(blockId);
    const target = SIDEBAR_TO_BACKEND[blockId];
    if (!target || !target.block_type) {
      // Handle general settings or invalid blocks
      setSelectedVersionId("");
      return;
    }

    const newBlockPrompts = allPrompts
      .filter(
        (p) =>
          p.category === target.category && p.block_type === target.block_type,
      )
      .sort((a, b) => b.version_number - a.version_number);

    if (newBlockPrompts.length > 0) {
      const newActive = newBlockPrompts.find((p) => p.is_active);
      setSelectedVersionId(
        newActive?.prompt_version_id || newBlockPrompts[0].prompt_version_id,
      );
    } else {
      // No prompts exist for this block - reset selection
      setSelectedVersionId("");
    }
  };

  const handleStartDraft = () => {
    setSelectedVersionId(DRAFT_ID);
  };

  const handleCreateNewVersion = async () => {
    const target = SIDEBAR_TO_BACKEND[selectedBlockId];
    if (!target || !target.block_type) return;

    try {
      const newPrompt = await createPromptVersion({
        category: target.category,
        block_type: target.block_type,
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

  const handleSetActive = async (targetId: string = selectedVersionId) => {
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

  const handleDelete = (targetId: string = selectedVersionId) => {
    const promptToDelete = allPrompts.find(
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
    // This is just local state update for inline editing - no API call
    setAllPrompts((prev) =>
      prev.map((p) =>
        p.prompt_version_id === id ? { ...p, version_name: newName } : p,
      ),
    );
  };

  const activeItem = SECTIONS.flatMap((s) => s.items).find(
    (i) => i.id === selectedBlockId,
  );

  const currentVersion = allPrompts.find(
    (p) => p.prompt_version_id === selectedVersionId,
  );

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
            maxWidth: "1400px",
            display: "flex",
            gap: 4,
            border: "1px solid var(--border)",
            borderRadius: 2,
            p: 4,
            backgroundColor: "transparent",
          }}
        >
          {/* Sidebar */}
          <Box sx={{ width: "260px", shrink: 0 }}>
            <Typography
              variant="h5"
              sx={{ mb: 3, fontWeight: "bold", color: "var(--text)" }}
            >
              AI Configuration
            </Typography>
            {SECTIONS.map((section) => (
              <Box key={section.category} sx={{ mb: 3 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: "var(--text-secondary)",
                    fontWeight: "bold",
                    mb: 1,
                    display: "block",
                    textAlign: "left",
                    pl: 2,
                    textTransform: "uppercase",
                  }}
                >
                  {section.category === "reasoning"
                    ? "Reasoning Blocks"
                    : section.category === "assessment"
                      ? "Assessment Prompts"
                      : section.category}
                </Typography>
                <Box
                  sx={{
                    ml: 2,
                    borderLeft: "1px solid var(--border)",
                  }}
                >
                  <List disablePadding>
                    {section.items.map((item) => (
                      <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
                        <ListItemButton
                          selected={selectedBlockId === item.id}
                          onClick={() => handleBlockChange(item.id)}
                          sx={{
                            borderRadius: 1,
                            ml: 1,
                            "&.Mui-selected": {
                              backgroundColor: "var(--secondary)",
                              color: "var(--primary)",
                              "&:hover": {
                                backgroundColor: "var(--secondary)",
                              },
                            },
                            "&:hover": {
                              backgroundColor: "var(--secondary)",
                            },
                            py: 0.5,
                            pl: 1,
                          }}
                        >
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{
                              fontSize: "0.9rem",
                              color:
                                selectedBlockId === item.id
                                  ? "var(--primary)"
                                  : "var(--text-secondary)",
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </Box>
            ))}
          </Box>

          {/* Main Content Area */}
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 3,
              minWidth: 0, // Prevent flex item from overflowing
            }}
          >
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
                    {activeItem?.label} - Workspace
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "var(--text-secondary)",
                      textAlign: "left",
                      display: "block",
                    }}
                  >
                    {activeItem?.description || "Select a block to configure."}
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
                  label="Prompt Content"
                  multiline
                  fullWidth
                  minRows={10}
                  maxRows={25}
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  placeholder="Enter prompt content here..."
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
                    ) : blockPrompts.length === 0 ? (
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
                      blockPrompts.map((version) => (
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
                            {new Date(
                              version.time_created,
                            ).toLocaleDateString()}
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
                                  <CheckCircleIcon
                                    style={{ color: "inherit" }}
                                  />
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
                                    setSelectedVersionId(
                                      version.prompt_version_id,
                                    )
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
          </Box>
        </Box>
      </Box>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
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
        itemName={itemToDelete?.version_name || ""}
        title="Delete Prompt Version"
        description="Are you sure you want to delete this prompt version? This action cannot be undone."
      />
    </Box>
  );
};

export default AIConfiguration;
