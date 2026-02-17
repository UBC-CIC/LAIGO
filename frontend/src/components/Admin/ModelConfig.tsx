import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { fetchAuthSession } from "aws-amplify/auth";

const MODEL_OPTIONS = [
  {
    label: "Claude 3 Sonnet",
    value: "anthropic.claude-3-sonnet-20240229-v1:0",
  },
  { label: "Llama 3 70b Instruct", value: "meta.llama3-70b-instruct-v1:0" },
];

const ModelConfig = () => {
  const [bedrockLlmId, setBedrockLlmId] = useState("");
  const [temperature, setTemperature] = useState(0.5);
  const [topP, setTopP] = useState(0.9);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [messageLimit, setMessageLimit] = useState("Infinity");
  const [isAiConfigLoading, setIsAiConfigLoading] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });
  const [fieldError, setFieldError] = useState<string | null>(null);

  const fetchAiConfig = useCallback(async () => {
    setIsAiConfigLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No auth token");

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/ai_config`,
        { headers: { Authorization: token } },
      );
      if (!response.ok) throw new Error("Failed to fetch AI config");
      const data = await response.json();
      setBedrockLlmId(data.bedrock_llm_id || "");
      setTemperature(parseFloat(data.temperature) || 0.5);
      setTopP(parseFloat(data.top_p) || 0.9);
      setMaxTokens(parseInt(data.max_tokens) || 2048);

      // Fetch Message Limit
      const limitResponse = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/message_limit`,
        { headers: { Authorization: token } },
      );
      if (limitResponse.ok) {
        const limitData = await limitResponse.json();
        setMessageLimit(limitData.value || "Infinity");
      }
    } catch (err) {
      console.error("Error fetching AI config:", err);
      setSnackbar({
        open: true,
        message: "Failed to load AI config",
        severity: "error",
      });
    } finally {
      setIsAiConfigLoading(false);
    }
  }, []);

  const saveAiConfig = async () => {
    setIsSavingConfig(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No auth token");

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/ai_config`,
        {
          method: "POST",
          headers: { Authorization: token, "Content-Type": "application/json" },
          body: JSON.stringify({
            bedrock_llm_id: bedrockLlmId,
            temperature: temperature,
            top_p: topP,
            max_tokens: maxTokens,
          }),
        },
      );
      if (!response.ok) throw new Error("Failed to save AI config");

      // Save Message Limit

      // Save Message Limit
      const limitResponse = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/message_limit`,
        {
          method: "PUT",
          headers: { Authorization: token, "Content-Type": "application/json" },
          body: JSON.stringify({
            limit: messageLimit,
          }),
        },
      );
      if (!limitResponse.ok) throw new Error("Failed to save message limit");

      setSnackbar({
        open: true,
        message: "AI Configuration saved!",
        severity: "success",
      });
      setFieldError(null);
    } catch (err) {
      console.error("Error saving AI config:", err);
      setSnackbar({
        open: true,
        message: "Failed to save AI config",
        severity: "error",
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  useEffect(() => {
    fetchAiConfig();
  }, [fetchAiConfig]);

  // Real-time validation
  useEffect(() => {
    const isInfinity = messageLimit === "Infinity";
    const numLimit = parseInt(messageLimit);

    if (
      !isInfinity &&
      messageLimit.trim() !== "" &&
      (isNaN(numLimit) || numLimit < 10)
    ) {
      setFieldError("Must be 'Infinity' or a number ≥ 10");
    } else {
      setFieldError(null);
    }
  }, [messageLimit]);

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          backgroundColor: "var(--paper)",
          border: "1px solid var(--border)",
          borderRadius: 2,
          p: 4,
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        <Typography
          variant="h6"
          sx={{ color: "var(--text)", fontWeight: "bold" }}
        >
          AI Model Configuration
        </Typography>

        {isAiConfigLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <FormControl fullWidth>
              <InputLabel
                id="model-select-label"
                sx={{ color: "var(--text-secondary)" }}
              >
                Bedrock Model
              </InputLabel>
              <Select
                labelId="model-select-label"
                value={
                  MODEL_OPTIONS.some((o) => o.value === bedrockLlmId)
                    ? bedrockLlmId
                    : ""
                }
                label="Bedrock Model"
                onChange={(e) => setBedrockLlmId(e.target.value)}
                sx={{
                  color: "var(--text)",
                  backgroundColor: "var(--background)",
                  textAlign: "left",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--border)",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--border)",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--primary)",
                  },
                  "& .MuiSvgIcon-root": { color: "var(--text)" },
                }}
              >
                {MODEL_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Temperature"
                type="number"
                inputProps={{ step: 0.1, min: 0, max: 1 }}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                fullWidth
                variant="outlined"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "var(--text)",
                    backgroundColor: "var(--background)",
                    "& fieldset": { borderColor: "var(--border)" },
                  },
                  "& .MuiInputLabel-root": {
                    color: "var(--text-secondary)",
                  },
                }}
              />
              <TextField
                label="Top P"
                type="number"
                inputProps={{ step: 0.1, min: 0, max: 1 }}
                value={topP}
                onChange={(e) => setTopP(parseFloat(e.target.value))}
                fullWidth
                variant="outlined"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "var(--text)",
                    backgroundColor: "var(--background)",
                    "& fieldset": { borderColor: "var(--border)" },
                  },
                  "& .MuiInputLabel-root": {
                    color: "var(--text-secondary)",
                  },
                }}
              />

              <TextField
                label="Max Tokens"
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                fullWidth
                variant="outlined"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "var(--text)",
                    backgroundColor: "var(--background)",
                    "& fieldset": { borderColor: "var(--border)" },
                  },
                  "& .MuiInputLabel-root": {
                    color: "var(--text-secondary)",
                  },
                }}
              />
            </Box>

            <TextField
              label="Daily Message Limit (per user)"
              type="text"
              error={!!fieldError}
              helperText={
                fieldError ||
                'Enter a number (min 10) or "Infinity" for no limit'
              }
              value={messageLimit}
              onChange={(e) => setMessageLimit(e.target.value)}
              fullWidth
              variant="outlined"
              sx={{
                "& .MuiOutlinedInput-root": {
                  color: "var(--text)",
                  backgroundColor: "var(--background)",
                  "& fieldset": { borderColor: "var(--border)" },
                },
                "& .MuiInputLabel-root": {
                  color: "var(--text-secondary)",
                },
                "& .MuiFormHelperText-root:not(.Mui-error)": {
                  color: "var(--text-secondary)",
                },
              }}
            />

            <Button
              variant="contained"
              startIcon={
                isSavingConfig ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <SaveIcon />
                )
              }
              onClick={saveAiConfig}
              disabled={isSavingConfig || !!fieldError}
              sx={{
                alignSelf: "flex-end",
                backgroundColor: "var(--primary)",
                color: "var(--text)",
                fontWeight: "bold",
                "&:hover": {
                  backgroundColor: "var(--primary)",
                  opacity: 0.9,
                },
              }}
            >
              {isSavingConfig ? "Saving..." : "Save Configuration"}
            </Button>
          </Box>
        )}
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
    </>
  );
};

export default ModelConfig;
