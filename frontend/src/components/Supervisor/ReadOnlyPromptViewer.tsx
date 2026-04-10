import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Chip,
  Alert,
  TextField,
} from "@mui/material";
import { fetchAuthSession } from "aws-amplify/auth";

// Types matching the Admin component structure
type PromptCategory = "General Settings" | "reasoning" | "assessment" | "summary";

type BlockType =
  | "intake"
  | "legal_analysis"
  | "contrarian"
  | "policy";

interface PromptVersion {
  prompt_version_id: string;
  category: PromptCategory;
  block_type: BlockType | null;
  prompt_scope?: "block" | "full_case";
  version_number: number;
  version_name: string;
  prompt_text: string;
  time_created: string;
}

interface ReadOnlyPromptViewerProps {
  category: PromptCategory;
  blockType: BlockType | null;
  promptScope?: "full_case";
  title: string;
  description: string;
}

const ReadOnlyPromptViewer: React.FC<ReadOnlyPromptViewerProps> = ({
  category,
  blockType,
  promptScope,
  title,
  description,
}) => {
  const [prompt, setPrompt] = useState<PromptVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivePrompt = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No auth token");

      const queryParam =
        promptScope === "full_case"
          ? "prompt_scope=full_case"
          : `block_type=${blockType}`;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/instructor/prompts?category=${category}&${queryParam}`,
        { headers: { Authorization: token } },
      );
      if (!response.ok) throw new Error("Failed to fetch active prompt");
      const data = await response.json();

      // The endpoint returns a list of active prompts (usually just one per block)
      if (Array.isArray(data) && data.length > 0) {
        setPrompt(data[0]);
      } else {
        setPrompt(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prompt");
    } finally {
      setIsLoading(false);
    }
  }, [category, blockType, promptScope]);

  useEffect(() => {
    fetchActivePrompt();
  }, [fetchActivePrompt]);

  return (
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
            {title}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: "var(--text-secondary)",
              textAlign: "left",
              display: "block",
            }}
          >
            {description}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {prompt && (
            <Chip
              label={`Active: ${prompt.version_name || `v${prompt.version_number}`}`}
              color="primary"
              variant="outlined"
              size="small"
              sx={{ borderColor: "var(--border)" }}
            />
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
        {isLoading ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            flex={1}
          >
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : !prompt ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            flex={1}
            flexDirection="column"
          >
            <Typography color="textSecondary">
              No active prompt configured for this selection.
            </Typography>
          </Box>
        ) : (
          <TextField
            label="Prompt Content"
            multiline
            fullWidth
            minRows={10}
            maxRows={25}
            value={prompt.prompt_text}
            InputProps={{
              readOnly: true,
            }}
            variant="outlined"
            sx={{
              flex: 1,
              "& .MuiOutlinedInput-root": {
                height: "100%",
                alignItems: "flex-start",
                color: "var(--text)",
                backgroundColor: "var(--background)",
                fontSize: "0.95rem",
                "& fieldset": {
                  borderColor: "var(--border)",
                  borderWidth: "1px !important",
                },
                "&:hover fieldset": {
                  borderColor: "var(--border)",
                  borderWidth: "1px !important",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "var(--border)",
                  borderWidth: "1px !important",
                }, // Prevent blue highlight and thickness change
              },
              "& .MuiInputBase-input": {
                // cursor: "text", // Default behavior
              },
              "& .MuiInputLabel-root": {
                color: "var(--text-secondary)",
                "&.Mui-focused": { color: "var(--text-secondary)" }, // Prevent label highlight
              },
            }}
          />
        )}
      </Box>

      {prompt && (
        <Box
          sx={{
            p: 1.5,
            borderTop: "1px solid var(--border)",
            backgroundColor: "var(--header)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography
            variant="caption"
            color="var(--text-secondary)"
            sx={{ fontStyle: "italic" }}
          >
            Note: To make changes to these prompts, please contact the system
            administrator.
          </Typography>
          <Typography variant="caption" color="var(--text-secondary)">
            Last Updated: {new Date(prompt.time_created).toLocaleDateString()}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default ReadOnlyPromptViewer;
