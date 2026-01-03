import React, { useState } from "react";
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
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AdminHeader from "../../components/AdminHeader";

// Mock Data Structure
const SECTIONS = [
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

const MOCK_PROMPTS: Record<
  string,
  { versions: string[]; currentVersion: string; content: string }
> = {
  "intake-facts": {
    versions: ["Version 1", "Version 2", "Version 3"],
    currentVersion: "Version 2",
    content:
      "You are an expert legal assistant. Guide the junior associate to establish the client's eligibility and gather the factual foundation. Focus on dates, witnesses, and specific events. Do not move forward until the timeline is clear.",
  },
  // Default fallback for others
  default: {
    versions: ["Version 1"],
    currentVersion: "Version 1",
    content: "This is a placeholder prompt for this section.",
  },
};

const AIConfiguration = () => {
  const [selectedId, setSelectedId] = useState("intake-facts");
  const [selectedVersion, setSelectedVersion] = useState(
    MOCK_PROMPTS["intake-facts"]?.currentVersion || "Version 1"
  );
  const [promptContent, setPromptContent] = useState(
    MOCK_PROMPTS["intake-facts"]?.content || ""
  );

  const handleSelectionChange = (id: string) => {
    setSelectedId(id);
    const data = MOCK_PROMPTS[id] || MOCK_PROMPTS["default"];
    setSelectedVersion(data.currentVersion);
    setPromptContent(data.content);
  };

  const handleVersionChange = (event: SelectChangeEvent) => {
    // In a real app, this would fetch the content for the selected version
    setSelectedVersion(event.target.value as string);
  };

  const handlePromptChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setPromptContent(event.target.value);
  };

  const activeItemLabel = SECTIONS.flatMap((s) => s.items).find(
    (i) => i.id === selectedId
  )?.label;

  const data = MOCK_PROMPTS[selectedId] || MOCK_PROMPTS["default"];

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
          display: "flex", // Centering logic similar to screenshot
          justifyContent: "center",
          alignItems: "center",
          p: 4,
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: "1200px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 2,
            p: 4,
          }}
        >
          <Typography
            variant="h4"
            sx={{
              mb: 4,
              color: "var(--text)",
              fontWeight: "bold",
              textAlign: "left",
            }}
          >
            AI Configuration
          </Typography>

          <Box sx={{ display: "flex", gap: 4 }}>
            {/* Sidebar */}
            <Box sx={{ width: "250px", shrink: 0 }}>
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
                      pl: 2, // Align with the start of the indentation
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
                            selected={selectedId === item.id}
                            onClick={() => handleSelectionChange(item.id)}
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
                                  selectedId === item.id
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

            {/* Main Content Area */}
            <Paper
              elevation={0}
              sx={{
                flex: 1,
                backgroundColor: "var(--paper)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 2,
                p: 0,
                overflow: "hidden",
                boxShadow: "none",
              }}
            >
              <Box
                sx={{
                  p: 3,
                  borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    mb: 1,
                  }}
                >
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography
                        variant="h6"
                        sx={{ color: "var(--text)", fontWeight: "bold" }}
                      >
                        {activeItemLabel}
                      </Typography>
                      <Button
                        size="small"
                        sx={{
                          minWidth: "auto",
                          p: 0.5,
                          color: "var(--text-secondary)",
                          "&:hover": { color: "var(--text)" },
                        }}
                        onClick={() => alert(`Rename ${activeItemLabel}`)}
                      >
                        <EditIcon sx={{ fontSize: "1rem" }} />
                      </Button>
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{ color: "var(--text-secondary)" }}
                    >
                      Affects how the LLM responds within the {activeItemLabel}{" "}
                      reasoning block
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Select
                      value={selectedVersion}
                      onChange={handleVersionChange}
                      size="small"
                      sx={{
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
                        "& .MuiSvgIcon-root": {
                          color: "var(--text)",
                        },
                        minWidth: 120,
                      }}
                    >
                      {data.versions.map((v) => (
                        <MenuItem key={v} value={v}>
                          {v}
                        </MenuItem>
                      ))}
                    </Select>
                    <Button
                      size="small"
                      sx={{
                        minWidth: "auto",
                        p: 0.5,
                        color: "rgba(255, 0, 0, 0.5)",
                        "&:hover": {
                          color: "rgba(255, 0, 0, 0.8)",
                          backgroundColor: "rgba(255, 0, 0, 0.05)",
                        },
                      }}
                      onClick={() => alert(`Delete ${selectedVersion}`)}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: "1.2rem" }} />
                    </Button>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ p: 3 }}>
                <TextField
                  multiline
                  rows={12}
                  fullWidth
                  value={promptContent}
                  onChange={handlePromptChange}
                  variant="outlined"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      color: "var(--text)",
                      backgroundColor: "rgba(0, 0, 0, 0.2)",
                      "& fieldset": {
                        borderColor: "rgba(255, 255, 255, 0.1)",
                      },
                      "&:hover fieldset": {
                        borderColor: "rgba(255, 255, 255, 0.3)",
                      },
                      "&.Mui-focused fieldset": {
                        borderColor: "#546bdf",
                      },
                    },
                  }}
                />
              </Box>

              <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.1)" }} />

              <Box
                sx={{
                  p: 2,
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 2,
                  alignItems: "center",
                }}
              >
                <Button
                  startIcon={<RefreshIcon />}
                  sx={{
                    color: "var(--text-secondary)",
                    textTransform: "none",
                    "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.05)" },
                  }}
                  onClick={() => {
                    setPromptContent(
                      MOCK_PROMPTS[selectedId]?.content ||
                        MOCK_PROMPTS["default"].content
                    );
                  }}
                >
                  Reset to Default
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<SaveIcon />}
                  sx={{
                    color: "var(--text)",
                    borderColor: "rgba(255, 255, 255, 0.3)",
                    textTransform: "none",
                    "&:hover": {
                      borderColor: "var(--text)",
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                    },
                  }}
                  onClick={() => alert("Overwriting current version...")}
                >
                  Save
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  sx={{
                    backgroundColor: "#82b1ff", // Light blue from screenshot button
                    color: "#000",
                    textTransform: "none",
                    fontWeight: "bold",
                    "&:hover": {
                      backgroundColor: "#6f9ceb",
                    },
                  }}
                  onClick={() =>
                    alert("Save functionality would be implemented here.")
                  }
                >
                  Save as New Version
                </Button>
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default AIConfiguration;
