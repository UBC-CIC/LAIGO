import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  Collapse,
  Card,
  CardContent,
  Stack,
} from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import DownloadIcon from "@mui/icons-material/Download";
import AddIcon from "@mui/icons-material/Add";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ArticleIcon from "@mui/icons-material/Article";
import AssignmentIcon from "@mui/icons-material/Assignment";

// --- Types ---

type SummaryScope = "full_case" | "block";
type BlockType =
  | "intake"
  | "issues"
  | "research"
  | "argument"
  | "contrarian"
  | "policy";

interface Summary {
  id: string;
  date: string; // ISO string
  title: string;
  content: string; // Markdown
  version: number;
  scope: SummaryScope;
  block_context?: BlockType;
}

interface Annotation {
  id: string;
  summaryId: string;
  authorName: string;
  date: string; // ISO string
  startOffset: number; // For mock purpose, just visual reference
  endOffset: number;
  quote: string;
  comment: string;
}

// --- Mock Data ---

const MOCK_SUMMARIES: Summary[] = [
  {
    id: "sum-1",
    date: "2025-11-20T09:45:00",
    title: "Full Case Analysis",
    version: 2,
    scope: "full_case",
    content: `### 1. Factual Foundation

The tenant lodged multiple maintenance complaints over several months regarding unsafe or uninhabitable conditions in her apartment (e.g., structural issues, leaks, or unsanitary conditions—specifics to be filled in once discovery clarifies). The landlord allegedly failed to perform adequate repairs. In response to continued neglect, the tenant withheld a portion of her rent, believing the conditions justified partial nonpayment.

The property manager, acting within his role, scheduled and conducted an inspection purportedly to address the maintenance dispute. During this inspection, the manager and tenant engaged in a heated verbal exchange. According to the tenant, the manager escalated the situation by shoving her, causing minor physical injuries and significant emotional distress. The tenant then filed a federal civil complaint alleging:

(1) violation of habitability obligations,
(2) unlawful retaliation for asserting tenant rights, and
(3) landlord liability for the property manager’s assault.

The landlord denies liability, asserting that:
* the manager’s conduct was not authorized and was outside the scope of employment,
* the tenant’s rent-withholding was improper, and
* appropriate repairs were either underway or not required.

### 2. Legal Issues Identified

1. **Habitability Violations**
   Whether the landlord failed to maintain the premises in a safe and habitable condition as required by the implied warranty of habitability and applicable housing statutes.
2. **Tenant Retaliation**
   Whether the confrontation, including the alleged shove, constitutes retaliation for the tenant’s protected activities (complaints, code reports, rent withholding).
3. **Vicarious Liability for Intentional Torts**
   Whether the landlord can be held civilly liable for the property manager’s assault under principles of respondeat superior, negligent supervision, negligent hiring, or ratification.
4. **Scope of Employment**
   Whether the shove occurred within the "course and scope" of the manager’s duties—i.e., during a landlord–tenant business interaction arising out of the tenancy.
`,
  },
  {
    id: "sum-2",
    date: "2025-11-18T15:15:00",
    title: "Initial Overview",
    version: 1,
    scope: "full_case",
    content: `### Initial Case Overview

Tenant claims landlord failed to repair maintenance issues. Fight ensued with property manager.

**Key Points:**
- Maintenance requests ignored.
- Rent withheld.
- Physical altercation during inspection.
`,
  },
  {
    id: "sum-3",
    date: "2025-11-15T10:00:00",
    title: "Intake Summary",
    version: 1,
    scope: "block",
    block_context: "intake",
    content: `### Intake Summary

Client: Jane Doe
Date of Incident: Oct 30, 2025
Location: 123 Main St, Apt 4B

**Incident Description:**
Client reports property manager shoved her during an inspection. Police were called but no arrest made. Client seeking damages for emotional distress and physical injury.
`,
  },
];

const MOCK_ANNOTATIONS: Annotation[] = [
  {
    id: "ann-1",
    summaryId: "sum-1",
    authorName: "Allan Jordan",
    date: "2025-11-20T10:45:00",
    startOffset: 0,
    endOffset: 0,
    quote: "unsafe or uninhabitable conditions",
    comment:
      "Make sure to describe the unsafe conditions precisely (e.g., 'persistent ceiling leak causing mold growth,' 'collapsed flooring,' etc.) rather than using generic categories.",
  },
  {
    id: "ann-2",
    summaryId: "sum-1",
    authorName: "Allan Jordan",
    date: "2025-11-17T11:09:00",
    startOffset: 0,
    endOffset: 0,
    quote: "tenant withheld a portion of her rent",
    comment:
      "Check local statutes regarding rent withholding. Did she escrow the funds properly? This is a critical defense point.",
  },
];

// --- Helper Components ---

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const CaseSummaries: React.FC = () => {
  const [selectedSummaryId, setSelectedSummaryId] = useState<string>(
    MOCK_SUMMARIES[0].id
  );
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [openCategories, setOpenCategories] = useState<{
    [key: string]: boolean;
  }>({
    full_case: true,
    block: true,
  });

  const selectedSummary = MOCK_SUMMARIES.find(
    (s) => s.id === selectedSummaryId
  );
  const currentAnnotations = MOCK_ANNOTATIONS.filter(
    (a) => a.summaryId === selectedSummaryId
  );

  // Group summaries
  const groupedSummaries = MOCK_SUMMARIES.reduce((acc, summary) => {
    const key = summary.scope;
    if (!acc[key]) acc[key] = [];
    acc[key].push(summary);
    return acc;
  }, {} as Record<string, Summary[]>);

  const toggleCategory = (category: string) => {
    setOpenCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  return (
    <Box
      sx={{
        display: "flex",
        height: "calc(100vh - 64px)", // Adjust based on header height
        backgroundColor: "var(--background)",
        color: "var(--text)",
        overflow: "hidden",
      }}
    >
      {/* --- Left Sidebar (Summaries List) --- */}
      <Box
        sx={{
          width: leftOpen ? 300 : 50,
          transition: "width 0.3s ease",
          borderRight: "1px solid var(--border)",
          backgroundColor: "var(--background2)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: leftOpen ? "space-between" : "center",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {leftOpen && (
            <Typography
              variant="subtitle1"
              fontWeight="bold"
              sx={{ fontFamily: "Outfit" }}
            >
              Summaries
            </Typography>
          )}
          <IconButton
            size="small"
            onClick={() => setLeftOpen(!leftOpen)}
            sx={{ color: "var(--text-secondary)" }}
          >
            {leftOpen ? (
              <KeyboardDoubleArrowLeftIcon />
            ) : (
              <KeyboardDoubleArrowRightIcon />
            )}
          </IconButton>
        </Box>

        {/* Generate Button Area */}
        {leftOpen && (
          <Box sx={{ p: 2 }}>
            <Button
              variant="contained"
              fullWidth
              startIcon={<AddIcon />}
              sx={{
                backgroundColor: "var(--primary)",
                color: "white", // Fixed as primary usually needs white text
                fontFamily: "Outfit",
                textTransform: "none",
                "&:hover": {
                  backgroundColor: "#42a5f5", // Slightly lighter/darker
                },
              }}
            >
              Generate
            </Button>
          </Box>
        )}

        {/* List Content */}
        {leftOpen && (
          <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
            {/* Full Case Summaries */}
            {groupedSummaries["full_case"] && (
              <>
                <ListItemButton
                  onClick={() => toggleCategory("full_case")}
                  sx={{ py: 0.5, backgroundColor: "rgba(0,0,0,0.03)" }}
                >
                  <AssignmentIcon
                    sx={{
                      fontSize: 18,
                      mr: 1,
                      color: "var(--text-secondary)",
                    }}
                  />
                  <ListItemText
                    primary="Full Case"
                    primaryTypographyProps={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      fontFamily: "Outfit",
                    }}
                  />
                  {openCategories["full_case"] ? (
                    <ExpandLess
                      sx={{ fontSize: 18, color: "var(--text-secondary)" }}
                    />
                  ) : (
                    <ExpandMore
                      sx={{ fontSize: 18, color: "var(--text-secondary)" }}
                    />
                  )}
                </ListItemButton>
                <Collapse
                  in={openCategories["full_case"]}
                  timeout="auto"
                  unmountOnExit
                >
                  <List component="div" disablePadding>
                    {groupedSummaries["full_case"].map((summary) => (
                      <ListItemButton
                        key={summary.id}
                        selected={selectedSummaryId === summary.id}
                        onClick={() => setSelectedSummaryId(summary.id)}
                        sx={{
                          pl: 4,
                          borderLeft:
                            selectedSummaryId === summary.id
                              ? "4px solid var(--primary)"
                              : "4px solid transparent",
                          "&.Mui-selected": {
                            backgroundColor: "var(--secondary)",
                          },
                          "&.Mui-selected:hover": {
                            backgroundColor: "var(--secondary)",
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography
                              variant="body2"
                              fontWeight={
                                selectedSummaryId === summary.id ? 600 : 400
                              }
                              sx={{
                                fontFamily: "Outfit",
                                color: "var(--text)",
                              }}
                            >
                              {formatDate(summary.date)}
                            </Typography>
                          }
                          secondary={
                            <Typography
                              variant="caption"
                              sx={{ color: "var(--text-secondary)" }}
                            >
                              {formatTime(summary.date)}
                            </Typography>
                          }
                        />
                        <IconButton
                          size="small"
                          sx={{ color: "var(--text-secondary)" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle download mock
                          }}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </>
            )}

            {/* Block Summaries */}
            {groupedSummaries["block"] && (
              <>
                <ListItemButton
                  onClick={() => toggleCategory("block")}
                  sx={{ py: 0.5, backgroundColor: "rgba(0,0,0,0.03)", mt: 1 }}
                >
                  <ArticleIcon
                    sx={{
                      fontSize: 18,
                      mr: 1,
                      color: "var(--text-secondary)",
                    }}
                  />
                  <ListItemText
                    primary="Block Summaries"
                    primaryTypographyProps={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      fontFamily: "Outfit",
                    }}
                  />
                  {openCategories["block"] ? (
                    <ExpandLess
                      sx={{ fontSize: 18, color: "var(--text-secondary)" }}
                    />
                  ) : (
                    <ExpandMore
                      sx={{ fontSize: 18, color: "var(--text-secondary)" }}
                    />
                  )}
                </ListItemButton>
                <Collapse
                  in={openCategories["block"]}
                  timeout="auto"
                  unmountOnExit
                >
                  <List component="div" disablePadding>
                    {groupedSummaries["block"].map((summary) => (
                      <ListItemButton
                        key={summary.id}
                        selected={selectedSummaryId === summary.id}
                        onClick={() => setSelectedSummaryId(summary.id)}
                        sx={{
                          pl: 4,
                          borderLeft:
                            selectedSummaryId === summary.id
                              ? "4px solid var(--primary)"
                              : "4px solid transparent",
                          "&.Mui-selected": {
                            backgroundColor: "var(--secondary)",
                          },
                          "&.Mui-selected:hover": {
                            backgroundColor: "var(--secondary)",
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography
                              variant="body2"
                              fontWeight={
                                selectedSummaryId === summary.id ? 600 : 400
                              }
                              sx={{
                                fontFamily: "Outfit",
                                color: "var(--text)",
                              }}
                            >
                              {summary.block_context
                                ? summary.block_context
                                    .charAt(0)
                                    .toUpperCase() +
                                  summary.block_context.slice(1)
                                : "Block"}
                            </Typography>
                          }
                          secondary={
                            <Typography
                              variant="caption"
                              sx={{ color: "var(--text-secondary)" }}
                            >
                              {formatDate(summary.date)}
                            </Typography>
                          }
                        />
                        <IconButton
                          size="small"
                          sx={{ color: "var(--text-secondary)" }}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </>
            )}
          </Box>
        )}
      </Box>

      {/* --- Center Content (Markdown) --- */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          p: 4,
          display: "flex",
          justifyContent: "center",
          backgroundColor: "#1e1e1e", // Slightly darker/distinct for the "document" feel, or var(--background)
        }}
      >
        <Card
          sx={{
            width: "100%",
            maxWidth: "800px",
            height: "fit-content",
            backgroundColor: "var(--background)", // Contrast against the container
            border: "1px solid var(--border)",
            borderRadius: 2,
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
        >
          <CardContent sx={{ p: 4, "&:last-child": { pb: 4 } }}>
            {selectedSummary ? (
              <Box
                sx={{
                  color: "var(--text)",
                  fontFamily: "Inter",
                  "& h1, & h2, & h3": {
                    fontFamily: "Outfit",
                    color: "var(--text)",
                    mt: 2,
                    mb: 1,
                  },
                  "& p": {
                    mb: 2,
                    lineHeight: 1.7,
                  },
                  "& ul, & ol": {
                    pl: 3,
                    mb: 2,
                  },
                  "& li": {
                    mb: 0.5,
                  },
                }}
              >
                {/* Title Header inside the doc */}
                <Typography
                  variant="h5"
                  fontFamily="Outfit"
                  fontWeight="bold"
                  mb={3}
                >
                  {selectedSummary.title}
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                >
                  {selectedSummary.content}
                </ReactMarkdown>
              </Box>
            ) : (
              <Typography color="var(--text-secondary)">
                Select a summary to view details.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* --- Right Sidebar (Annotations) --- */}
      <Box
        sx={{
          width: rightOpen ? 320 : 50,
          transition: "width 0.3s ease",
          borderLeft: "1px solid var(--border)",
          backgroundColor: "var(--background)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            p: 2, // Consistent padding
            height: "56px", // Explicit height to match typical headers if needed, or let it flow
            display: "flex",
            alignItems: "center",
            justifyContent: rightOpen ? "space-between" : "center",
            borderBottom: "1px solid var(--border)",
            boxSizing: "border-box", // Ensure padding is included in height
          }}
        >
          <IconButton
            size="small"
            onClick={() => setRightOpen(!rightOpen)}
            sx={{ color: "var(--text-secondary)" }}
          >
            {rightOpen ? (
              <KeyboardDoubleArrowRightIcon />
            ) : (
              <KeyboardDoubleArrowLeftIcon />
            )}
          </IconButton>

          {rightOpen && (
            // Placeholder for potential header title or actions
            <div />
          )}
        </Box>

        {rightOpen && (
          <Box
            sx={{
              flexGrow: 1,
              overflowY: "auto",
              p: 2,
              backgroundColor: "var(--background)",
            }}
          >
            {currentAnnotations.length > 0 ? (
              <Stack spacing={2}>
                {currentAnnotations.map((ann) => (
                  <Card
                    key={ann.id}
                    sx={{
                      backgroundColor: "var(--background2)",
                      border: "1px solid var(--border)",
                      boxShadow: "none",
                    }}
                  >
                    <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          mb: 1,
                        }}
                      >
                        <Typography
                          variant="caption"
                          fontWeight="bold"
                          sx={{ color: "var(--text)", fontFamily: "Outfit" }}
                        >
                          {ann.authorName}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "var(--text-secondary)" }}
                        >
                          {formatDate(ann.date)}
                        </Typography>
                      </Box>

                      <Typography
                        variant="body2"
                        sx={{
                          color: "var(--text)",
                          fontSize: "0.9rem",
                          mb: 1.5,
                        }}
                      >
                        {ann.comment}
                      </Typography>

                      <Box
                        sx={{
                          backgroundColor: "rgba(0,0,0,0.1)", // Light separate background for quote
                          p: 1,
                          borderRadius: 1,
                          borderLeft: "3px solid var(--primary)",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            color: "var(--text-secondary)",
                            fontStyle: "italic",
                            display: "block",
                            mb: 0.5,
                          }}
                        >
                          Quote:
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "var(--text-secondary)",
                            fontStyle: "italic",
                            fontSize: "0.85rem",
                          }}
                        >
                          "{ann.quote}"
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Typography
                variant="body2"
                sx={{
                  color: "var(--text-secondary)",
                  textAlign: "center",
                  mt: 4,
                }}
              >
                No annotations for this summary.
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default CaseSummaries;
