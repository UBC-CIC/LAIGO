import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Select,
  MenuItem,
  TextField,
  Button,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AdminHeader from "../../components/AdminHeader";
import { v4 as uuidv4 } from "uuid";

// --- Types based on DB Schema & Requirements ---

type PromptCategory =
  | "General Settings"
  | "Reasoning Blocks"
  | "Assessment Prompts";

interface PromptVersion {
  id: string;
  blockId: string; // correlates to the sidebar ID
  versionNumber: number;
  versionName: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  author: string;
}

interface SidebarItem {
  id: string;
  label: string;
}

interface SidebarSection {
  category: PromptCategory;
  items: SidebarItem[];
}

// --- Mock Data Setup ---

const SECTIONS: SidebarSection[] = [
  {
    category: "General Settings",
    items: [{ id: "model-configs", label: "Model Configs" }],
  },
  {
    category: "Reasoning Blocks",
    items: [
      { id: "intake-facts", label: "Intake & Facts" },
      { id: "issue-identification", label: "Issue Identification" },
      { id: "research-strategy", label: "Research Strategy" },
      { id: "argument-construction", label: "Argument Construction" },
      { id: "contrarian-analysis", label: "Contrarian Analysis" },
      { id: "policy-context", label: "Policy Context" },
    ],
  },
  {
    category: "Assessment Prompts",
    items: [
      { id: "intake-assessment", label: "Intake Assessment" },
      { id: "issues-assessment", label: "Issues Assessment" },
      { id: "research-assessment", label: "Research Assessment" },
    ],
  },
];

const INITIAL_PROMPTS: PromptVersion[] = [
  {
    id: "1",
    blockId: "intake-facts",
    versionNumber: 1,
    versionName: "System Default",
    content: "Original system prompt for Intake & Facts...",
    isActive: false,
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    author: "System",
  },
  {
    id: "2",
    blockId: "intake-facts",
    versionNumber: 2,
    versionName: "Strict Timeline Focus",
    content:
      "You are an expert legal assistant. Guide the junior associate to establish the client's eligibility and gather the factual foundation. Focus on dates, witnesses, and specific events. Do not move forward until the timeline is clear.",
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    author: "Admin User",
  },
  {
    id: "3",
    blockId: "intake-facts",
    versionNumber: 3,
    versionName: "Draft - Emphasize Witnesses",
    content:
      "You are an expert legal assistant. Priority is on gathering witness statements...",
    isActive: false,
    createdAt: new Date().toISOString(),
    author: "Admin User",
  },
];

const AIConfiguration = () => {
  // --- State ---
  const [selectedBlockId, setSelectedBlockId] =
    useState<string>("intake-facts");

  // All prompts in "database"
  const [allPrompts, setAllPrompts] =
    useState<PromptVersion[]>(INITIAL_PROMPTS);

  // Derived state: Prompts for current block
  const blockPrompts = allPrompts
    .filter((p) => p.blockId === selectedBlockId)
    .sort((a, b) => b.versionNumber - a.versionNumber); // Newest first

  // Selection State
  // Default to active version, else latest
  const activeVersion = blockPrompts.find((p) => p.isActive);
  const latestVersion = blockPrompts[0];
  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    activeVersion?.id || latestVersion?.id || ""
  );

  // Editor State
  const [editorContent, setEditorContent] = useState<string>("");

  // UI State
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // --- Effects ---

  // Update editor content when version changes
  useEffect(() => {
    const version = allPrompts.find((p) => p.id === selectedVersionId);
    if (version) {
      setEditorContent(version.content);
    } else if (blockPrompts.length > 0) {
      // Fallback if selection is invalid (e.g. after block switch)
      const fallback = activeVersion?.id || blockPrompts[0].id;
      setSelectedVersionId(fallback);
    } else {
      setEditorContent("");
    }
  }, [selectedVersionId, selectedBlockId, allPrompts]);

  // When switching blocks, reset selection to that block's active/latest
  const handleBlockChange = (blockId: string) => {
    setSelectedBlockId(blockId);
    // Logic to find best version for this new block handled by effect or needs immediate recalc
    // Better to do here to avoid flicker
    const newBlockPrompts = allPrompts
      .filter((p) => p.blockId === blockId)
      .sort((a, b) => b.versionNumber - a.versionNumber);

    if (newBlockPrompts.length > 0) {
      const newActive = newBlockPrompts.find((p) => p.isActive);
      setSelectedVersionId(newActive?.id || newBlockPrompts[0].id);
    } else {
      // Handle case where no prompts exist for a block (create default?)
      const defaultPrompt: PromptVersion = {
        id: uuidv4(),
        blockId,
        versionNumber: 1,
        versionName: "Initial Draft",
        content: "Start writing your prompt here...",
        isActive: true,
        createdAt: new Date().toISOString(),
        author: "System",
      };
      setAllPrompts((prev) => [...prev, defaultPrompt]);
      setSelectedVersionId(defaultPrompt.id);
    }
  };

  // --- Handlers ---

  const handleCreateNewVersion = () => {
    const currentMaxVersion =
      blockPrompts.length > 0
        ? Math.max(...blockPrompts.map((p) => p.versionNumber))
        : 0;
    const newVersion: PromptVersion = {
      id: uuidv4(),
      blockId: selectedBlockId,
      versionNumber: currentMaxVersion + 1,
      versionName: `Version ${currentMaxVersion + 1}`,
      content: editorContent, // Start with current content
      isActive: false, // New versions shouldn't auto-activate
      createdAt: new Date().toISOString(),
      author: "Admin User",
    };
    setAllPrompts((prev) => [...prev, newVersion]);
    setSelectedVersionId(newVersion.id);
    alert("New version created!");
  };

  const handleSaveCurrent = () => {
    setAllPrompts((prev) =>
      prev.map((p) =>
        p.id === selectedVersionId ? { ...p, content: editorContent } : p
      )
    );
    alert("Version saved.");
  };

  const handleSetActive = () => {
    setAllPrompts((prev) =>
      prev.map((p) => {
        if (p.blockId !== selectedBlockId) return p; // Don't touch other blocks
        return {
          ...p,
          isActive: p.id === selectedVersionId, // Set current to true, others to false
        };
      })
    );
  };

  const handleDelete = () => {
    const promptToDelete = allPrompts.find((p) => p.id === selectedVersionId);
    if (promptToDelete?.isActive) {
      alert(
        "Cannot delete the active version. Please set another version as active first."
      );
      return;
    }
    if (
      confirm(
        `Are you sure you want to delete "${promptToDelete?.versionName}"?`
      )
    ) {
      const remaining = blockPrompts.filter((p) => p.id !== selectedVersionId);
      setAllPrompts((prev) => prev.filter((p) => p.id !== selectedVersionId));
      if (remaining.length > 0) {
        setSelectedVersionId(remaining[0].id);
      }
    }
  };

  const openRenameDialog = () => {
    const p = allPrompts.find((p) => p.id === selectedVersionId);
    if (p) {
      setRenameValue(p.versionName);
      setIsRenameDialogOpen(true);
    }
  };

  const confirmRename = () => {
    setAllPrompts((prev) =>
      prev.map((p) =>
        p.id === selectedVersionId ? { ...p, versionName: renameValue } : p
      )
    );
    setIsRenameDialogOpen(false);
  };

  // --- Render Helpers ---

  const activeLabel = SECTIONS.flatMap((s) => s.items).find(
    (i) => i.id === selectedBlockId
  )?.label;

  const currentVersion = allPrompts.find((p) => p.id === selectedVersionId);

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
          alignItems: "flex-start", // Start aligning from top to allow expansion
          p: 4,
          overflow: "auto",
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: "1400px", // Increased width for better layout
            display: "flex",
            gap: 4,
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 2,
            p: 4,
            backgroundColor: "transparent", // Or a subtle background if needed
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
                  {section.category}
                </Typography>
                <Box
                  sx={{
                    ml: 2,
                    borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
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
                            ml: 1, // Gap from the grey border
                            "&.Mui-selected": {
                              backgroundColor: "rgba(100, 181, 246, 0.15)", // Light blue background for active (matched SideMenu)
                              color: "#64B5F6", // Blue text for active (matched SideMenu)
                              "&:hover": {
                                backgroundColor: "rgba(100, 181, 246, 0.2)",
                              },
                            },
                            "&:hover": {
                              backgroundColor: "rgba(255, 255, 255, 0.05)",
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
                                  ? "#64B5F6"
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

          {/* Main Content */}
          <Paper
            elevation={0}
            sx={{
              flex: 1,
              backgroundColor: "var(--paper)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 2,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header / Toolbar */}
            <Box
              sx={{
                p: 3,
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                backgroundColor: "rgba(0,0,0,0.02)",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Box>
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: "bold", color: "var(--text)" }}
                  >
                    {activeLabel}
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mt: 0.5,
                    }}
                  >
                    {currentVersion?.isActive ? (
                      <Chip
                        icon={<CheckCircleIcon style={{ color: "#4caf50" }} />}
                        label="Active Version"
                        size="small"
                        sx={{
                          backgroundColor: "rgba(76, 175, 80, 0.1)",
                          color: "#4caf50",
                          fontWeight: "bold",
                        }}
                      />
                    ) : (
                      <Chip
                        label="Inactive"
                        size="small"
                        sx={{
                          backgroundColor: "rgba(255,255,255,0.05)",
                          color: "var(--text-secondary)",
                        }}
                      />
                    )}
                    <Typography variant="caption" color="textSecondary">
                      Last updated:{" "}
                      {new Date(
                        currentVersion?.createdAt || ""
                      ).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Version Controls */}
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <Select
                  value={selectedVersionId}
                  onChange={(e: SelectChangeEvent) =>
                    setSelectedVersionId(e.target.value as string)
                  }
                  size="small"
                  sx={{
                    minWidth: 250,
                    color: "var(--text)",
                    borderColor: "rgba(255, 255, 255, 0.23)",
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(255, 255, 255, 0.23)",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: "var(--text)",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#546bdf",
                    },
                    "& .MuiSvgIcon-root": { color: "var(--text)" },
                  }}
                >
                  {blockPrompts.map((v) => (
                    <MenuItem key={v.id} value={v.id}>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          width: "100%",
                          alignItems: "center",
                        }}
                      >
                        <Typography variant="body2">{`v${v.versionNumber}: ${v.versionName}`}</Typography>
                        {v.isActive && (
                          <CheckCircleIcon
                            sx={{ fontSize: 16, color: "#4caf50", ml: 1 }}
                          />
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>

                <Tooltip title="Rename Version">
                  <IconButton
                    onClick={openRenameDialog}
                    size="small"
                    sx={{ color: "var(--text-secondary)" }}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Delete Version">
                  <IconButton
                    onClick={handleDelete}
                    size="small"
                    sx={{
                      color: "var(--text-secondary)",
                      "&:hover": { color: "#ef5350" },
                    }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Tooltip>

                <Divider
                  orientation="vertical"
                  flexItem
                  sx={{ mx: 1, borderColor: "rgba(255,255,255,0.1)" }}
                />

                {!currentVersion?.isActive && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CheckCircleIcon />}
                    onClick={handleSetActive}
                    sx={{
                      textTransform: "none",
                      borderColor: "#4caf50",
                      color: "#4caf50",
                      "&:hover": {
                        borderColor: "#43a047",
                        backgroundColor: "rgba(76, 175, 80, 0.05)",
                      },
                    }}
                  >
                    Set as Active
                  </Button>
                )}
              </Box>
            </Box>

            {/* Editor */}
            <Box
              sx={{ flex: 1, p: 3, display: "flex", flexDirection: "column" }}
            >
              <TextField
                multiline
                fullWidth
                minRows={15}
                maxRows={25} // Allow it to grow but capped
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                placeholder="Enter prompt content here..."
                variant="outlined"
                sx={{
                  flex: 1,
                  "& .MuiOutlinedInput-root": {
                    height: "100%", // Fill container
                    alignItems: "flex-start", // Top align text
                    color: "var(--text)",
                    backgroundColor: "rgba(0, 0, 0, 0.2)",
                    fontFamily: "monospace", // Better for code/prompts
                    fontSize: "0.95rem",
                    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                    "&:hover fieldset": {
                      borderColor: "rgba(255, 255, 255, 0.3)",
                    },
                    "&.Mui-focused fieldset": { borderColor: "#546bdf" },
                  },
                }}
              />
            </Box>

            {/* Footer Actions */}
            <Box
              sx={{
                p: 2,
                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 2,
              }}
            >
              <Button
                variant="text"
                startIcon={<RefreshIcon />}
                onClick={() => setEditorContent(currentVersion?.content || "")}
                sx={{ color: "var(--text-secondary)", textTransform: "none" }}
              >
                Revert Changes
              </Button>
              <Button
                variant="outlined"
                startIcon={<SaveIcon />}
                onClick={handleSaveCurrent}
                sx={{
                  color: "var(--text)",
                  borderColor: "rgba(255, 255, 255, 0.3)",
                  textTransform: "none",
                  "&:hover": {
                    borderColor: "var(--text)",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
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
                  backgroundColor: "#82b1ff",
                  color: "#000",
                  textTransform: "none",
                  fontWeight: "bold",
                  "&:hover": { backgroundColor: "#6f9ceb" },
                }}
              >
                Save as New Version
              </Button>
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Rename Dialog */}
      <Dialog
        open={isRenameDialogOpen}
        onClose={() => setIsRenameDialogOpen(false)}
      >
        <DialogTitle
          sx={{ backgroundColor: "var(--header)", color: "var(--text)" }}
        >
          Rename Version
        </DialogTitle>
        <DialogContent
          sx={{ backgroundColor: "var(--header)", color: "var(--text)" }}
        >
          <TextField
            autoFocus
            margin="dense"
            label="Version Name"
            fullWidth
            variant="outlined"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            sx={{
              "& .MuiInputBase-root": { color: "var(--text)" },
              "& .MuiInputLabel-root": { color: "var(--text-secondary)" },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(255, 255, 255, 0.3)",
              },
            }}
          />
        </DialogContent>
        <DialogActions
          sx={{ backgroundColor: "var(--header)", color: "var(--text)" }}
        >
          <Button
            onClick={() => setIsRenameDialogOpen(false)}
            sx={{ color: "var(--text-secondary)" }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmRename}
            variant="contained"
            sx={{ backgroundColor: "#82b1ff", color: "#000" }}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AIConfiguration;
