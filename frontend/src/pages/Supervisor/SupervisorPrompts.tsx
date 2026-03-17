import { useEffect } from "react";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import SupervisorHeader from "../../components/SupervisorHeader";
import ReadOnlyPromptViewer from "../../components/Supervisor/ReadOnlyPromptViewer";

// --- Types based on DB Schema & Requirements ---

type PromptCategory = "General Settings" | "reasoning" | "assessment" | "summary";

type BlockType =
  | "intake"
  | "legal_analysis"
  | "contrarian"
  | "policy";

// Mapping from Sidebar ID to Backend Enums
const SIDEBAR_TO_BACKEND: Record<
  string,
  {
    category: PromptCategory;
    block_type: BlockType | null;
    prompt_scope?: "full_case";
  }
> = {
  // Reasoning
  "intake-facts": { category: "reasoning", block_type: "intake" },
  "legal-analysis": { category: "reasoning", block_type: "legal_analysis" },
  "contrarian-analysis": { category: "reasoning", block_type: "contrarian" },
  "policy-context": { category: "reasoning", block_type: "policy" },

  // Assessment
  "intake-assessment": { category: "assessment", block_type: "intake" },
  "legal-analysis-assessment": {
    category: "assessment",
    block_type: "legal_analysis",
  },
  "contrarian-assessment": { category: "assessment", block_type: "contrarian" },
  "policy-assessment": { category: "assessment", block_type: "policy" },

  // Summary
  "intake-summary": { category: "summary", block_type: "intake" },
  "legal-analysis-summary": {
    category: "summary",
    block_type: "legal_analysis",
  },
  "contrarian-summary": { category: "summary", block_type: "contrarian" },
  "policy-summary": { category: "summary", block_type: "policy" },
  "full-case-summary": {
    category: "summary",
    block_type: null,
    prompt_scope: "full_case",
  },
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
    category: "reasoning",
    items: [
      {
        id: "intake-facts",
        label: "Intake & Facts",
        description:
          "Instructs the AI to guide the user through gathering relevant factual details, establishing a timeline, and identifying missing information to assess the case.",
      },
      {
        id: "legal-analysis",
        label: "Legal Analysis",
        description:
          "Guides the AI in helping the user identify legal issues, develop research strategies, and construct persuasive arguments by synthesizing facts and legal principles.",
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
          "Defines criteria to evaluate if 'Intake & Facts' is complete. Passing advances the user to 'Legal Analysis'.",
      },
      {
        id: "legal-analysis-assessment",
        label: "Legal Analysis Assessment",
        description:
          "Establishes standards for assessing legal analysis comprehension. Success unlocks advanced stages (Contrarian, Policy).",
      },
      {
        id: "contrarian-assessment",
        label: "Contrarian Assessment",
        description:
          "Defines criteria to evaluate whether contrarian analysis adequately stress-tests assumptions and legal strategy.",
      },
      {
        id: "policy-assessment",
        label: "Policy Assessment",
        description:
          "Defines criteria to evaluate policy context, implications, and quality of broader legal reasoning.",
      },
    ],
  },
  {
    category: "summary",
    items: [
      {
        id: "intake-summary",
        label: "Intake Summary",
        description:
          "Controls how intake interviews are summarized into a clear legal work product.",
      },
      {
        id: "legal-analysis-summary",
        label: "Legal Analysis Summary",
        description:
          "Controls how legal analysis discussions are summarized into concise doctrinal output.",
      },
      {
        id: "contrarian-summary",
        label: "Contrarian Summary",
        description:
          "Controls how contrarian-stage analysis is summarized, emphasizing weaknesses and counterarguments.",
      },
      {
        id: "policy-summary",
        label: "Policy Summary",
        description:
          "Controls how policy-stage discussion is summarized, including implications and tradeoffs.",
      },
      {
        id: "full-case-summary",
        label: "Full Case Synthesis",
        description:
          "Controls the final synthesis prompt that combines all block summaries into a full-case summary.",
      },
    ],
  },
];

const SupervisorPrompts = () => {
  const navigate = useNavigate();
  const params = useParams();

  // Get the sub-route from the wildcard param, default to intake-facts if empty
  const subRoute = params["*"];
  const selectedBlockId = subRoute || "intake-facts";

  // Redirect if exactly at root /prompts (empty *)
  useEffect(() => {
    if (!subRoute) {
      navigate("/prompts/intake-facts", { replace: true });
    }
  }, [subRoute, navigate]);

  const activeItem = SECTIONS.flatMap((s) => s.items).find(
    (i) => i.id === selectedBlockId,
  );

  const target = SIDEBAR_TO_BACKEND[selectedBlockId];

  return (
    <Box
      sx={{
        backgroundColor: "var(--background)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <SupervisorHeader />
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
              Active Prompts
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
                    ? "Reasoning Prompts"
                    : section.category === "assessment"
                      ? "Assessment Prompts"
                      : section.category === "summary"
                        ? "Summary Prompts"
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
                          onClick={() => navigate(`/prompts/${item.id}`)}
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
                            slotProps={{
                              primary: {
                                fontSize: "0.9rem",
                                color:
                                  selectedBlockId === item.id
                                    ? "var(--primary)"
                                    : "var(--text-secondary)",
                              },
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
              minWidth: 0,
            }}
          >
            {target && (target.block_type || target.prompt_scope) ? (
              <ReadOnlyPromptViewer
                // Key forces remount when category/block changes, ensuring fresh active fetch
                key={
                  target.prompt_scope === "full_case"
                    ? `${target.category}-full_case`
                    : `${target.category}-${target.block_type}`
                }
                category={target.category}
                blockType={target.block_type}
                promptScope={target.prompt_scope}
                title={activeItem?.label || "Prompt Viewer"}
                description={activeItem?.description || ""}
              />
            ) : (
              <Typography sx={{ color: "var(--text)" }}>
                Select a prompt category.
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default SupervisorPrompts;
