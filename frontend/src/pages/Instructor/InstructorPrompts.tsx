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
import InstructorHeader from "../../components/InstructorHeader";
import ReadOnlyPromptViewer from "../../components/Instructor/ReadOnlyPromptViewer";

// --- Types based on DB Schema & Requirements ---

type PromptCategory = "General Settings" | "reasoning" | "assessment";

type BlockType =
  | "intake"
  | "issues"
  | "research"
  | "argument"
  | "contrarian"
  | "policy";

// Mapping from Sidebar ID to Backend Enums
const SIDEBAR_TO_BACKEND: Record<
  string,
  { category: PromptCategory; block_type: BlockType | null }
> = {
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

const InstructorPrompts = () => {
  const navigate = useNavigate();
  const params = useParams();

  // Get the sub-route from the wildcard param, default to intake-facts if empty
  const subRoute = params["*"];
  const selectedBlockId = subRoute || "intake-facts";

  // Redirect if exactly at root /instructor/prompts (empty *)
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
      <InstructorHeader />
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
            {target && target.block_type ? (
              <ReadOnlyPromptViewer
                // Key forces remount when category/block changes, ensuring fresh active fetch
                key={`${target.category}-${target.block_type}`}
                category={target.category}
                blockType={target.block_type}
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

export default InstructorPrompts;
