import React, { useState, useEffect } from "react";
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
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InputIcon from "@mui/icons-material/Input";
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
    category: "Reasoning Blocks",
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
    category: "Assessment Prompts",
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
  const [selectedBlockId, setSelectedBlockId] =
    useState<string>("intake-facts");
  const [allPrompts, setAllPrompts] =
    useState<PromptVersion[]>(INITIAL_PROMPTS);
  const blockPrompts = allPrompts
    .filter((p) => p.blockId === selectedBlockId)
    .sort((a, b) => b.versionNumber - a.versionNumber);
  const activeVersion = blockPrompts.find((p) => p.isActive);
  const latestVersion = blockPrompts[0];
  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    activeVersion?.id || latestVersion?.id || ""
  );

  const [editorContent, setEditorContent] = useState<string>("");

  // Update editor content when version changes
  useEffect(() => {
    const version = allPrompts.find((p) => p.id === selectedVersionId);
    if (version) {
      if (editorContent !== version.content) {
        // eslint-disable-next-line
        setEditorContent(version.content);
      }
    } else if (blockPrompts.length > 0) {
      // Fallback if selection is invalid
      const fallback = activeVersion?.id || blockPrompts[0].id;
      if (selectedVersionId !== fallback) {
        setSelectedVersionId(fallback);
      }
    } else {
      if (editorContent !== "") {
        setEditorContent("");
      }
    }
  }, [selectedVersionId, selectedBlockId, allPrompts]);

  const handleBlockChange = (blockId: string) => {
    setSelectedBlockId(blockId);
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
      content: editorContent,
      isActive: false,
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

  const handleSetActive = (targetId: string = selectedVersionId) => {
    setAllPrompts((prev) =>
      prev.map((p) => {
        if (p.blockId !== selectedBlockId) return p;
        return {
          ...p,
          isActive: p.id === targetId,
        };
      })
    );
  };

  const handleDelete = (targetId: string = selectedVersionId) => {
    const promptToDelete = allPrompts.find((p) => p.id === targetId);
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
      const remaining = blockPrompts.filter((p) => p.id !== targetId);
      setAllPrompts((prev) => prev.filter((p) => p.id !== targetId));

      // If we deleted the currently selected version, switch to another
      if (selectedVersionId === targetId && remaining.length > 0) {
        setSelectedVersionId(remaining[0].id);
      }
    }
  };

  const handleNameChange = (id: string, newName: string) => {
    setAllPrompts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, versionName: newName } : p))
    );
  };

  const activeItem = SECTIONS.flatMap((s) => s.items).find(
    (i) => i.id === selectedBlockId
  );

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
                  {section.category}
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

                {currentVersion && (
                  <Chip
                    label={`Editing: ${currentVersion.versionName}`}
                    color="primary"
                    variant="outlined"
                    size="small"
                    sx={{ borderColor: "var(--border)" }}
                  />
                )}
              </Box>

              {/* Editor */}
              <Box
                sx={{ flex: 1, p: 3, display: "flex", flexDirection: "column" }}
              >
                <TextField
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
                <Button
                  variant="text"
                  startIcon={<RefreshIcon />}
                  onClick={() =>
                    setEditorContent(currentVersion?.content || "")
                  }
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
                    color: "#000",
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
                    {blockPrompts.length === 0 ? (
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
                          key={version.id}
                          hover
                          sx={{
                            "&:last-child td, &:last-child th": { border: 0 },
                          }}
                        >
                          <TableCell
                            sx={{ color: "var(--text)", fontWeight: "bold" }}
                          >
                            v{version.versionNumber}
                          </TableCell>
                          <TableCell sx={{ color: "var(--text)" }}>
                            <TextField
                              value={version.versionName}
                              onChange={(e) =>
                                handleNameChange(version.id, e.target.value)
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
                            {new Date(version.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell sx={{ color: "var(--text-secondary)" }}>
                            {version.author}
                          </TableCell>
                          <TableCell>
                            {version.isActive ? (
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
                                onClick={() => handleSetActive(version.id)}
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
                                    setSelectedVersionId(version.id)
                                  }
                                  sx={{ color: "#42a5f5" }}
                                >
                                  <InputIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDelete(version.id)}
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
    </Box>
  );
};

export default AIConfiguration;
