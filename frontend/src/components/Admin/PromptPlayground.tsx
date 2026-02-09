import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  IconButton,
  CircularProgress,
  Paper,
  Tooltip,
  Snackbar,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";
import { fetchAuthSession } from "aws-amplify/auth";
import { useWebSocket } from "../../hooks/useWebSocket";

// Types
interface Message {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface ConfigurationState {
  blockType: string;
  modelId: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  systemPrompt: string;
  selectedVersionId: string | null;
  sessionId: string;
  messages: Message[];
  isLoading: boolean;
}

interface PromptVersion {
  prompt_version_id: string;
  version_number: number;
  version_name: string;
  prompt_text: string;
  is_active: boolean;
}

// Available models (same as ModelConfig)
const AVAILABLE_MODELS = [
  {
    id: "anthropic.claude-3-5-sonnet-20241022-v2:0",
    name: "Claude 3.5 Sonnet v2",
  },
  {
    id: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    name: "Claude 3.5 Sonnet",
  },
  { id: "anthropic.claude-3-haiku-20240307-v1:0", name: "Claude 3 Haiku" },
  { id: "anthropic.claude-3-sonnet-20240229-v1:0", name: "Claude 3 Sonnet" },
  { id: "anthropic.claude-3-opus-20240229-v1:0", name: "Claude 3 Opus" },
];

// Block types for prompt selection
const BLOCK_TYPES = [
  { id: "intake", label: "Intake & Facts" },
  { id: "issues", label: "Issue Identification" },
  { id: "research", label: "Research Strategy" },
  { id: "argument", label: "Argument Construction" },
  { id: "contrarian", label: "Contrarian Analysis" },
  { id: "policy", label: "Policy Context" },
];

const DEFAULT_PROMPT = `You are a helpful AI assistant for law students. Provide clear, educational responses that help the student think through legal problems. Be supportive and guide them through their analysis step by step.`;

const generateSessionId = () =>
  `playground-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createDefaultConfig = (): ConfigurationState => ({
  blockType: "intake",
  modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
  temperature: 0.5,
  topP: 0.9,
  maxTokens: 2048,
  systemPrompt: DEFAULT_PROMPT,
  selectedVersionId: null,
  sessionId: generateSessionId(),
  messages: [],
  isLoading: false,
});

// Single configuration panel component
const ConfigPanel: React.FC<{
  config: ConfigurationState;
  onConfigChange: (updates: Partial<ConfigurationState>) => void;
  promptVersions: PromptVersion[];
  onLoadVersion: (versionId: string) => void;
  onSaveAsNew: () => void;
  label?: string;
}> = ({
  config,
  onConfigChange,
  promptVersions,
  onLoadVersion,
  onSaveAsNew,
  label,
}) => {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {label && (
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: "bold", color: "var(--text)" }}
        >
          {label}
        </Typography>
      )}

      {/* Model and Block Type Row */}
      <Box sx={{ display: "flex", gap: 2 }}>
        <FormControl size="small" sx={{ flex: 1 }}>
          <InputLabel sx={{ color: "var(--text-secondary)" }}>
            Block Type
          </InputLabel>
          <Select
            value={config.blockType}
            label="Block Type"
            onChange={(e) => onConfigChange({ blockType: e.target.value })}
            sx={{
              color: "var(--text)",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "var(--border)",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "var(--primary)",
              },
            }}
          >
            {BLOCK_TYPES.map((block) => (
              <MenuItem key={block.id} value={block.id}>
                {block.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ flex: 1 }}>
          <InputLabel sx={{ color: "var(--text-secondary)" }}>Model</InputLabel>
          <Select
            value={config.modelId}
            label="Model"
            onChange={(e) => onConfigChange({ modelId: e.target.value })}
            sx={{
              color: "var(--text)",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "var(--border)",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "var(--primary)",
              },
            }}
          >
            {AVAILABLE_MODELS.map((model) => (
              <MenuItem key={model.id} value={model.id}>
                {model.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Sliders Row */}
      <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
            Temperature: {config.temperature.toFixed(2)}
          </Typography>
          <Slider
            value={config.temperature}
            onChange={(_, v) => onConfigChange({ temperature: v as number })}
            min={0}
            max={1}
            step={0.01}
            size="small"
            sx={{ color: "var(--primary)" }}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
            Top P: {config.topP.toFixed(2)}
          </Typography>
          <Slider
            value={config.topP}
            onChange={(_, v) => onConfigChange({ topP: v as number })}
            min={0}
            max={1}
            step={0.01}
            size="small"
            sx={{ color: "var(--primary)" }}
          />
        </Box>
        <TextField
          label="Max Tokens"
          type="number"
          size="small"
          value={config.maxTokens}
          onChange={(e) =>
            onConfigChange({ maxTokens: parseInt(e.target.value) || 2048 })
          }
          sx={{
            width: 120,
            "& .MuiInputLabel-root": { color: "var(--text-secondary)" },
            "& .MuiOutlinedInput-root": {
              color: "var(--text)",
              "& fieldset": { borderColor: "var(--border)" },
            },
          }}
        />
      </Box>

      {/* System Prompt Section */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="subtitle2" sx={{ color: "var(--text)" }}>
            System Prompt
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={config.selectedVersionId || ""}
                displayEmpty
                onChange={(e) => {
                  if (e.target.value) {
                    onLoadVersion(e.target.value);
                  }
                }}
                sx={{
                  color: "var(--text)",
                  fontSize: "0.8rem",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--border)",
                  },
                }}
              >
                <MenuItem value="" disabled>
                  Load Version...
                </MenuItem>
                {promptVersions.map((v) => (
                  <MenuItem
                    key={v.prompt_version_id}
                    value={v.prompt_version_id}
                  >
                    v{v.version_number}{" "}
                    {v.version_name ? `- ${v.version_name}` : ""}{" "}
                    {v.is_active ? "(Active)" : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="Save as New Version">
              <IconButton
                size="small"
                onClick={onSaveAsNew}
                sx={{ color: "var(--primary)" }}
              >
                <SaveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <TextField
          multiline
          rows={4}
          value={config.systemPrompt}
          onChange={(e) => onConfigChange({ systemPrompt: e.target.value })}
          placeholder="Enter your system prompt..."
          sx={{
            "& .MuiOutlinedInput-root": {
              color: "var(--text)",
              backgroundColor: "var(--background)",
              "& fieldset": { borderColor: "var(--border)" },
              "&:hover fieldset": { borderColor: "var(--primary)" },
            },
          }}
        />
      </Box>
    </Box>
  );
};

// Chat panel component
const ChatPanel: React.FC<{
  messages: Message[];
  isLoading: boolean;
  onClear: () => void;
  label?: string;
}> = ({ messages, isLoading, onClear, label }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--border)",
        borderRadius: 1,
        overflow: "hidden",
        minHeight: 300,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 2,
          py: 1,
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--secondary)",
        }}
      >
        <Typography variant="subtitle2" sx={{ color: "var(--text)" }}>
          {label || "Conversation"}
        </Typography>
        <Tooltip title="Clear Chat">
          <IconButton
            size="small"
            onClick={onClear}
            sx={{ color: "var(--text-secondary)" }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Messages */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          backgroundColor: "var(--background)",
        }}
      >
        {messages.length === 0 ? (
          <Typography
            sx={{
              color: "var(--text-secondary)",
              textAlign: "center",
              mt: 4,
              fontStyle: "italic",
            }}
          >
            Send a message to test the prompt...
          </Typography>
        ) : (
          messages.map((msg, idx) => (
            <Box
              key={idx}
              sx={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  maxWidth: "80%",
                  p: 1.5,
                  borderRadius: 2,
                  backgroundColor:
                    msg.role === "user" ? "var(--primary)" : "var(--secondary)",
                  color: msg.role === "user" ? "white" : "var(--text)",
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {msg.content}
                  {msg.isStreaming && (
                    <Box
                      component="span"
                      sx={{
                        display: "inline-block",
                        width: 8,
                        height: 16,
                        backgroundColor: "var(--primary)",
                        ml: 0.5,
                        animation: "blink 1s infinite",
                        "@keyframes blink": {
                          "0%, 50%": { opacity: 1 },
                          "51%, 100%": { opacity: 0 },
                        },
                      }}
                    />
                  )}
                </Typography>
              </Paper>
            </Box>
          ))
        )}
        {isLoading && messages.length === 0 && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} sx={{ color: "var(--primary)" }} />
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>
    </Box>
  );
};

// Main PromptPlayground component
const PromptPlayground: React.FC = () => {
  const [compareMode, setCompareMode] = useState(false);
  const [configA, setConfigA] = useState<ConfigurationState>(
    createDefaultConfig(),
  );
  const [configB, setConfigB] = useState<ConfigurationState>(
    createDefaultConfig(),
  );
  const [inputMessage, setInputMessage] = useState("");
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([]);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info";
  }>({ open: false, message: "", severity: "info" });

  // WebSocket state
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  // Initialize WebSocket URL with auth token
  useEffect(() => {
    const setupWebSocket = async () => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (token && import.meta.env.VITE_WEBSOCKET_URL) {
          setWsUrl(
            `${import.meta.env.VITE_WEBSOCKET_URL}?token=${token}&playground_mode=true`,
          );
        }
      } catch (error) {
        console.error("Error setting up WebSocket:", error);
      }
    };
    setupWebSocket();
  }, []);

  const { sendStreamingRequest, isConnected } = useWebSocket(wsUrl);

  // Fetch prompt versions when block type changes
  const fetchPromptVersions = useCallback(async (blockType: string) => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}admin/prompt?category=reasoning&block_type=${blockType}`,
        {
          headers: { Authorization: token },
        },
      );
      if (response.ok) {
        const data = await response.json();
        setPromptVersions(data);
      }
    } catch (error) {
      console.error("Failed to fetch prompt versions:", error);
    }
  }, []);

  useEffect(() => {
    fetchPromptVersions(configA.blockType);
  }, [configA.blockType, fetchPromptVersions]);

  // Load a specific prompt version
  const loadPromptVersion = useCallback(
    (
      versionId: string,
      setConfig: React.Dispatch<React.SetStateAction<ConfigurationState>>,
    ) => {
      const version = promptVersions.find(
        (v) => v.prompt_version_id === versionId,
      );
      if (version) {
        setConfig((prev) => ({
          ...prev,
          selectedVersionId: versionId,
          systemPrompt: version.prompt_text,
        }));
      }
    },
    [promptVersions],
  );

  // Save current prompt as new version
  const saveAsNewVersion = useCallback(
    async (config: ConfigurationState) => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        const response = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}admin/prompt`,
          {
            method: "POST",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              category: "reasoning",
              block_type: config.blockType,
              prompt_text: config.systemPrompt,
              version_name: `Playground - ${new Date().toISOString().split("T")[0]}`,
            }),
          },
        );
        if (response.ok) {
          setSnackbar({
            open: true,
            message: "Saved as new version!",
            severity: "success",
          });
          fetchPromptVersions(config.blockType);
        } else {
          throw new Error("Failed to save");
        }
      } catch (error) {
        setSnackbar({
          open: true,
          message: "Failed to save version",
          severity: "error",
        });
      }
    },
    [fetchPromptVersions],
  );

  // Send message handler
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !isConnected) return;

    const message = inputMessage.trim();
    setInputMessage("");

    // Add user message to config A
    setConfigA((prev) => ({
      ...prev,
      messages: [...prev.messages, { role: "user", content: message }],
      isLoading: true,
    }));

    // If compare mode, also add to config B
    if (compareMode) {
      setConfigB((prev) => ({
        ...prev,
        messages: [...prev.messages, { role: "user", content: message }],
        isLoading: true,
      }));
    }

    // Send request for Config A
    sendStreamingRequest(
      "playground_test",
      {
        message_content: message,
        custom_prompt: configA.systemPrompt,
        session_id: configA.sessionId,
        model_id: configA.modelId,
        temperature: configA.temperature,
        top_p: configA.topP,
        max_tokens: configA.maxTokens,
      },
      {
        onStart: () => {
          setConfigA((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              { role: "assistant", content: "", isStreaming: true },
            ],
          }));
        },
        onChunk: (content) => {
          setConfigA((prev) => {
            const msgs = [...prev.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.role === "assistant") {
              msgs[msgs.length - 1] = {
                ...lastMsg,
                content: lastMsg.content + content,
              };
            }
            return { ...prev, messages: msgs };
          });
        },
        onComplete: () => {
          setConfigA((prev) => {
            const msgs = [...prev.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.role === "assistant") {
              msgs[msgs.length - 1] = { ...lastMsg, isStreaming: false };
            }
            return { ...prev, messages: msgs, isLoading: false };
          });
        },
        onError: (errorMsg) => {
          setSnackbar({
            open: true,
            message: `Error: ${errorMsg}`,
            severity: "error",
          });
          setConfigA((prev) => ({ ...prev, isLoading: false }));
        },
      },
    );

    // Send request for Config B if in compare mode
    if (compareMode) {
      sendStreamingRequest(
        "playground_test",
        {
          message_content: message,
          custom_prompt: configB.systemPrompt,
          session_id: configB.sessionId,
          model_id: configB.modelId,
          temperature: configB.temperature,
          top_p: configB.topP,
          max_tokens: configB.maxTokens,
        },
        {
          onStart: () => {
            setConfigB((prev) => ({
              ...prev,
              messages: [
                ...prev.messages,
                { role: "assistant", content: "", isStreaming: true },
              ],
            }));
          },
          onChunk: (content) => {
            setConfigB((prev) => {
              const msgs = [...prev.messages];
              const lastMsg = msgs[msgs.length - 1];
              if (lastMsg && lastMsg.role === "assistant") {
                msgs[msgs.length - 1] = {
                  ...lastMsg,
                  content: lastMsg.content + content,
                };
              }
              return { ...prev, messages: msgs };
            });
          },
          onComplete: () => {
            setConfigB((prev) => {
              const msgs = [...prev.messages];
              const lastMsg = msgs[msgs.length - 1];
              if (lastMsg && lastMsg.role === "assistant") {
                msgs[msgs.length - 1] = { ...lastMsg, isStreaming: false };
              }
              return { ...prev, messages: msgs, isLoading: false };
            });
          },
          onError: (errorMsg) => {
            setSnackbar({
              open: true,
              message: `Error B: ${errorMsg}`,
              severity: "error",
            });
            setConfigB((prev) => ({ ...prev, isLoading: false }));
          },
        },
      );
    }
  }, [
    inputMessage,
    isConnected,
    configA,
    configB,
    compareMode,
    sendStreamingRequest,
  ]);

  // Clear chat handlers
  const clearChatA = () => {
    setConfigA((prev) => ({
      ...prev,
      messages: [],
      sessionId: generateSessionId(),
    }));
  };

  const clearChatB = () => {
    setConfigB((prev) => ({
      ...prev,
      messages: [],
      sessionId: generateSessionId(),
    }));
  };

  // Toggle compare mode
  const toggleCompareMode = () => {
    if (!compareMode) {
      setConfigB(createDefaultConfig());
    }
    setCompareMode(!compareMode);
  };

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 3, height: "100%" }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <Typography
            variant="h5"
            sx={{ fontWeight: "bold", color: "var(--text)" }}
          >
            Prompt Playground
          </Typography>
          <Typography variant="body2" sx={{ color: "var(--text-secondary)" }}>
            Test prompts with different configurations before activating them.
          </Typography>
        </Box>
        <Button
          variant={compareMode ? "outlined" : "contained"}
          startIcon={compareMode ? <CloseIcon /> : <AddIcon />}
          onClick={toggleCompareMode}
          sx={{
            backgroundColor: compareMode ? "transparent" : "var(--primary)",
            color: compareMode ? "var(--primary)" : "white",
            borderColor: "var(--primary)",
          }}
        >
          {compareMode ? "Exit Compare" : "Compare"}
        </Button>
      </Box>

      {/* Connection Status */}
      {!isConnected && (
        <Alert severity="warning" sx={{ py: 0.5 }}>
          WebSocket not connected. Messages cannot be sent.
        </Alert>
      )}

      {/* Configuration Panels */}
      <Box sx={{ display: "flex", gap: 3 }}>
        <Box sx={{ flex: 1 }}>
          <ConfigPanel
            config={configA}
            onConfigChange={(updates) =>
              setConfigA((prev) => ({ ...prev, ...updates }))
            }
            promptVersions={promptVersions}
            onLoadVersion={(v) => loadPromptVersion(v, setConfigA)}
            onSaveAsNew={() => saveAsNewVersion(configA)}
            label={compareMode ? "Configuration A" : undefined}
          />
        </Box>
        {compareMode && (
          <Box sx={{ flex: 1 }}>
            <ConfigPanel
              config={configB}
              onConfigChange={(updates) =>
                setConfigB((prev) => ({ ...prev, ...updates }))
              }
              promptVersions={promptVersions}
              onLoadVersion={(v) => loadPromptVersion(v, setConfigB)}
              onSaveAsNew={() => saveAsNewVersion(configB)}
              label="Configuration B"
            />
          </Box>
        )}
      </Box>

      {/* Chat Panels */}
      <Box sx={{ display: "flex", gap: 3, flex: 1 }}>
        <ChatPanel
          messages={configA.messages}
          isLoading={configA.isLoading}
          onClear={clearChatA}
          label={compareMode ? "Conversation A" : undefined}
        />
        {compareMode && (
          <ChatPanel
            messages={configB.messages}
            isLoading={configB.isLoading}
            onClear={clearChatB}
            label="Conversation B"
          />
        )}
      </Box>

      {/* Input Bar */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          p: 2,
          backgroundColor: "var(--secondary)",
          borderRadius: 1,
          border: "1px solid var(--border)",
        }}
      >
        <TextField
          fullWidth
          placeholder={
            compareMode
              ? "Type a message to test both configurations..."
              : "Type a message to test the prompt..."
          }
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          multiline
          maxRows={3}
          sx={{
            "& .MuiOutlinedInput-root": {
              color: "var(--text)",
              backgroundColor: "var(--background)",
              "& fieldset": { borderColor: "var(--border)" },
            },
          }}
        />
        <Button
          variant="contained"
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || !isConnected || configA.isLoading}
          sx={{
            backgroundColor: "var(--primary)",
            minWidth: 100,
            "&:disabled": { backgroundColor: "var(--border)" },
          }}
        >
          {configA.isLoading ? (
            <CircularProgress size={20} sx={{ color: "white" }} />
          ) : (
            <>
              <SendIcon sx={{ mr: 1 }} />
              {compareMode ? "Send Both" : "Send"}
            </>
          )}
        </Button>
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PromptPlayground;
