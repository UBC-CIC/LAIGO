import { useState, useEffect } from "react";
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

type PromptCategory = "General Settings" | "reasoning" | "assessment";

type BlockType =
  | "intake"
  | "issues"
  | "research"
  | "argument"
  | "contrarian"
  | "policy";

interface PromptVersion {
  prompt_version_id: string; // db: uuid
  category: PromptCategory;
  block_type: BlockType;
  version_number: number;
  version_name: string;
  prompt_text: string;
  author_id: string; // db: uuid (will just show UUID for now, or mock name if verified)
  time_created: string; // ISO string
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

const INITIAL_PROMPTS: PromptVersion[] = [
  {
    prompt_version_id: "1",
    category: "reasoning",
    block_type: "intake",
    version_number: 1,
    version_name: "System Default",
    prompt_text: "Original system prompt for Intake & Facts...",
    is_active: false,
    time_created: new Date(Date.now() - 86400000 * 10).toISOString(),
    author_id: "system-uuid",
  },
  {
    prompt_version_id: "2",
    category: "reasoning",
    block_type: "intake",
    version_number: 2,
    version_name: "Strict Timeline Focus",
    prompt_text:
      "You are an expert legal assistant. Guide the junior associate to establish the client's eligibility and gather the factual foundation. Focus on dates, witnesses, and specific events. Do not move forward until the timeline is clear.",
    is_active: true,
    time_created: new Date(Date.now() - 86400000 * 2).toISOString(),
    author_id: "admin-uuid",
  },
  {
    prompt_version_id: "3",
    category: "reasoning",
    block_type: "intake",
    version_number: 3,
    version_name: "Draft - Emphasize Witnesses",
    prompt_text:
      "You are an expert legal assistant. Priority is on gathering witness statements...",
    is_active: false,
    time_created: new Date().toISOString(),
    author_id: "admin-uuid",
  },
];

const AIConfiguration = () => {
  const [selectedBlockId, setSelectedBlockId] =
    useState<string>("intake-facts");
  const [allPrompts, setAllPrompts] =
    useState<PromptVersion[]>(INITIAL_PROMPTS);

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
      // Handle case where no prompts exist for a block (create default?)
      const defaultPrompt: PromptVersion = {
        prompt_version_id: uuidv4(),
        category: target.category,
        block_type: target.block_type!,
        version_number: 1,
        version_name: "Initial Draft",
        prompt_text: "Start writing your prompt here...",
        is_active: true,
        time_created: new Date().toISOString(),
        author_id: "system-uuid",
      };
      setAllPrompts((prev) => [...prev, defaultPrompt]);
      setSelectedVersionId(defaultPrompt.prompt_version_id);
    }
  };

  const handleStartDraft = () => {
    setSelectedVersionId(DRAFT_ID);
  };

  const handleCreateNewVersion = () => {
    const target = SIDEBAR_TO_BACKEND[selectedBlockId];
    if (!target || !target.block_type) return;

    const currentMaxVersion =
      blockPrompts.length > 0
        ? Math.max(...blockPrompts.map((p) => p.version_number))
        : 0;
    const newVersion: PromptVersion = {
      prompt_version_id: uuidv4(),
      category: target.category,
      block_type: target.block_type!,
      version_number: currentMaxVersion + 1,
      version_name: versionName || `Version ${currentMaxVersion + 1}`, // User provided or auto-generated
      prompt_text: editorContent,
      is_active: false,
      time_created: new Date().toISOString(),
      author_id: "admin-uuid",
    };
    setAllPrompts((prev) => [...prev, newVersion]);
    setSelectedVersionId(newVersion.prompt_version_id);
    alert("New version created!");
  };

  const handleSaveCurrent = () => {
    setAllPrompts((prev) =>
      prev.map((p) =>
        p.prompt_version_id === selectedVersionId
          ? { ...p, prompt_text: editorContent, version_name: versionName }
          : p,
      ),
    );
    alert("Version saved.");
  };

  const handleSetActive = (targetId: string = selectedVersionId) => {
    const target = SIDEBAR_TO_BACKEND[selectedBlockId];
    if (!target) return;

    setAllPrompts((prev) =>
      prev.map((p) => {
        // Only affect items in the current block
        if (
          p.category !== target.category ||
          p.block_type !== target.block_type
        )
          return p;
        return {
          ...p,
          is_active: p.prompt_version_id === targetId,
        };
      }),
    );
  };

  const handleDelete = (targetId: string = selectedVersionId) => {
    const promptToDelete = allPrompts.find(
      (p) => p.prompt_version_id === targetId,
    );
    if (promptToDelete?.is_active) {
      alert(
        "Cannot delete the active version. Please set another version as active first.",
      );
      return;
    }
    if (
      confirm(
        `Are you sure you want to delete "${promptToDelete?.version_name}"?`,
      )
    ) {
      const remaining = blockPrompts.filter(
        (p) => p.prompt_version_id !== targetId,
      );
      setAllPrompts((prev) =>
        prev.filter((p) => p.prompt_version_id !== targetId),
      );

      // If we deleted the currently selected version, switch to another
      if (selectedVersionId === targetId && remaining.length > 0) {
        setSelectedVersionId(remaining[0].prompt_version_id);
      }
    }
  };

  const handleNameChange = (id: string, newName: string) => {
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
                            {version.author_id}
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
    </Box>
  );
};

export default AIConfiguration;
