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
  Tooltip,
  Snackbar,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SaveIcon from "@mui/icons-material/Save";
import { fetchAuthSession } from "aws-amplify/auth";
import { useWebSocket } from "../../hooks/useWebSocket";
import UserMessage from "../../components/Chat/UserMessage";
import AiResponse from "../../components/Chat/AiResponse";
import ThinkingIndicator from "../../components/Chat/ThinkingIndicator";

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
  sessionId: string; // This is now the testId part
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
    id: "anthropic.claude-3-sonnet-20240229-v1:0",
    name: "Claude 3 Sonnet",
  },
  { id: "meta.llama3-70b-instruct-v1:0", name: "Llama 3 70b Instruct" },
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

const generateTestId = () => Math.random().toString(36).slice(2, 10);

const createDefaultConfig = (
  blockType: string = "intake",
): ConfigurationState => ({
  blockType,
  modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
  temperature: 0.5,
  topP: 0.9,
  maxTokens: 2048,
  systemPrompt: DEFAULT_PROMPT,
  selectedVersionId: null,
  sessionId: generateTestId(),
  messages: [],
  isLoading: false,
});

// Model Configuration Section - Top section with model settings
const ModelConfigSection: React.FC<{
  config: ConfigurationState;
  onConfigChange: (updates: Partial<ConfigurationState>) => void;
  label?: string;
}> = React.memo(({ config, onConfigChange, label }) => {
  return (
    <Box
      sx={{
        border: "1px solid var(--border)",
        borderRadius: 2,
        backgroundColor: "var(--paper)",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          p: 2,
          backgroundColor: "var(--header)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: "bold", color: "var(--text)", textAlign: "left" }}
        >
          {label ? `${label} - Model Configuration` : "Model Configuration"}
        </Typography>
      </Box>

      <Box
        sx={{
          p: 2,
          display: "flex",
          gap: 3,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        {/* Model Selection */}
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel sx={{ color: "var(--text-secondary)" }}>Model</InputLabel>
          <Select
            value={config.modelId}
            label="Model"
            onChange={(e) => onConfigChange({ modelId: e.target.value })}
            sx={{
              color: "var(--text)",
              backgroundColor: "var(--background)",
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

        {/* Temperature */}
        <Box sx={{ width: 140 }}>
          <Typography
            variant="caption"
            sx={{ color: "var(--text-secondary)", display: "block", mb: 0.5 }}
          >
            Temperature: {config.temperature.toFixed(2)}
          </Typography>
          <Slider
            value={config.temperature}
            onChange={(_, v) => onConfigChange({ temperature: v as number })}
            min={0}
            max={1}
            step={0.01}
            size="small"
            sx={{ color: "var(--primary)", py: 1 }}
          />
        </Box>

        {/* Top P */}
        <Box sx={{ width: 140 }}>
          <Typography
            variant="caption"
            sx={{ color: "var(--text-secondary)", display: "block", mb: 0.5 }}
          >
            Top P: {config.topP.toFixed(2)}
          </Typography>
          <Slider
            value={config.topP}
            onChange={(_, v) => onConfigChange({ topP: v as number })}
            min={0}
            max={1}
            step={0.01}
            size="small"
            sx={{ color: "var(--primary)", py: 1 }}
          />
        </Box>

        {/* Max Tokens */}
        <TextField
          label="Max Tokens"
          type="number"
          size="small"
          value={config.maxTokens}
          onChange={(e) =>
            onConfigChange({ maxTokens: parseInt(e.target.value) || 2048 })
          }
          sx={{
            width: 100,
            "& .MuiInputLabel-root": { color: "var(--text-secondary)" },
            "& .MuiOutlinedInput-root": {
              color: "var(--text)",
              backgroundColor: "var(--background)",
              "& fieldset": { borderColor: "var(--border)" },
            },
          }}
        />
      </Box>
    </Box>
  );
});

// System Prompt Section - Middle section for prompt selection and editing
const SystemPromptSection: React.FC<{
  config: ConfigurationState;
  onConfigChange: (updates: Partial<ConfigurationState>) => void;
  promptVersions: PromptVersion[];
  onLoadVersion: (versionId: string) => void;
  onSave: () => void;
  label?: string;
}> = React.memo(
  ({
    config,
    onConfigChange,
    promptVersions,
    onLoadVersion,
    onSave,
    label,
  }) => {
    return (
      <Box
        sx={{
          border: "1px solid var(--border)",
          borderRadius: 2,
          backgroundColor: "var(--paper)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            p: 2,
            backgroundColor: "var(--header)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: "bold", color: "var(--text)", textAlign: "left" }}
          >
            {label ? `${label} - System Prompt` : "System Prompt"}
          </Typography>

          <Box
            sx={{
              display: "flex",
              gap: 1,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {/* Block Type Selection */}
            <FormControl size="small" sx={{ width: 160 }}>
              <InputLabel sx={{ color: "var(--text-secondary)" }}>
                Block Type
              </InputLabel>
              <Select
                value={config.blockType}
                label="Block Type"
                onChange={(e) => onConfigChange({ blockType: e.target.value })}
                sx={{
                  color: "var(--text)",
                  backgroundColor: "var(--background)",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--border)",
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

            {/* Load Version */}
            <FormControl size="small" sx={{ width: 160 }}>
              <InputLabel sx={{ color: "var(--text-secondary)" }}>
                Version
              </InputLabel>
              <Select
                value={config.selectedVersionId || ""}
                label="Version"
                onChange={(e) => {
                  if (e.target.value) {
                    onLoadVersion(e.target.value);
                  }
                }}
                sx={{
                  color: "var(--text)",
                  backgroundColor: "var(--background)",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--border)",
                  },
                }}
              >
                <MenuItem value="" disabled>
                  <em>None</em>
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

            {/* Save Button */}
            {config.selectedVersionId && (
              <Tooltip title="Save Version">
                <IconButton
                  size="small"
                  onClick={onSave}
                  sx={{
                    color: "var(--primary)",
                    "&:hover": { backgroundColor: "var(--header-hover)" },
                  }}
                >
                  <SaveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        <Box sx={{ p: 2 }}>
          {/* Prompt Text Area */}
          <TextField
            multiline
            rows={5}
            fullWidth
            value={config.systemPrompt}
            onChange={(e) => onConfigChange({ systemPrompt: e.target.value })}
            placeholder="Enter your system prompt..."
            sx={{
              "& .MuiOutlinedInput-root": {
                color: "var(--text)",
                backgroundColor: "var(--background)",
                fontFamily: "monospace",
                fontSize: "0.9rem",
                "& fieldset": { borderColor: "var(--border)" },
                "&:hover fieldset": { borderColor: "var(--primary)" },
                "& textarea": {
                  resize: "vertical",
                },
                "& textarea::-webkit-resizer": {
                  backgroundColor: "var(--background)",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M10 0 L0 10 M10 4 L4 10 M10 8 L8 10' stroke='%23888' stroke-width='1'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "bottom right",
                },
              },
            }}
          />
        </Box>
      </Box>
    );
  },
);

// Chat panel component
const ChatPanel: React.FC<{
  messages: Message[];
  isLoading: boolean;
  onClear: () => void;
  label?: string;
}> = React.memo(({ messages, isLoading, onClear, label }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--border)",
        borderRadius: 2,
        backgroundColor: "var(--paper)",
        overflow: "hidden",
        minHeight: 400,
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
          backgroundColor: "var(--header)",
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{ color: "var(--text)", fontWeight: "bold" }}
        >
          {label || "Conversation"}
        </Typography>
        <Tooltip title="Clear Chat">
          <IconButton
            size="small"
            onClick={onClear}
            sx={{ color: "var(--text-secondary)" }}
          >
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Messages */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 3,
          display: "flex",
          flexDirection: "column",
          gap: 3,
          backgroundColor: "var(--background)",
        }}
      >
        {messages.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              opacity: 0.5,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: "var(--text-secondary)",
                textAlign: "center",
                fontStyle: "italic",
              }}
            >
              Send a message to test the prompt versions...
            </Typography>
          </Box>
        ) : (
          messages.map((msg, idx) => (
            <Box key={idx} sx={{ width: "100%" }}>
              {msg.role === "user" ? (
                <UserMessage message={msg.content} />
              ) : (
                <AiResponse
                  message={msg.content}
                  isStreaming={msg.isStreaming === true}
                />
              )}
            </Box>
          ))
        )}

        {isLoading && !messages.some((m) => m.isStreaming) && (
          <Box sx={{ display: "flex", justifyContent: "flex-start", pl: 1 }}>
            <ThinkingIndicator />
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>
    </Box>
  );
});

// Main PromptPlayground component
const PromptPlayground: React.FC = () => {
  const [compareMode, setCompareMode] = useState(false);
  const [configA, setConfigA] = useState<ConfigurationState>(
    createDefaultConfig("intake"),
  );
  const [configB, setConfigB] = useState<ConfigurationState>(
    createDefaultConfig("intake"),
  );
  const [inputMessage, setInputMessage] = useState("");
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([]);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info";
  }>({ open: false, message: "", severity: "info" });

  // Chunk buffers for batching streaming updates
  const chunkBufferA = useRef<string | null>(null);
  const chunkBufferB = useRef<string | null>(null);

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
      if (!token) return;
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

  // Auto-load active version when versions are fetched
  useEffect(() => {
    if (promptVersions.length > 0) {
      const activeVersion =
        promptVersions.find((v) => v.is_active) || promptVersions[0];

      // Auto-load for Panel A if nothing selected or current selected ID is invalid for this block
      if (
        !configA.selectedVersionId ||
        !promptVersions.some(
          (v) => v.prompt_version_id === configA.selectedVersionId,
        )
      ) {
        loadPromptVersion(activeVersion.prompt_version_id, setConfigA);
      }

      // Auto-load for Panel B if nothing selected or current selected ID is invalid for this block
      if (
        compareMode &&
        (!configB.selectedVersionId ||
          !promptVersions.some(
            (v) => v.prompt_version_id === configB.selectedVersionId,
          ))
      ) {
        loadPromptVersion(activeVersion.prompt_version_id, setConfigB);
      }
    }
  }, [
    promptVersions,
    loadPromptVersion,
    compareMode,
    configA.selectedVersionId,
    configB.selectedVersionId,
  ]);

  // Save current prompt version
  const savePromptVersion = useCallback(
    async (config: ConfigurationState) => {
      if (!config.selectedVersionId) return;

      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (!token) {
          setSnackbar({
            open: true,
            message: "Not authenticated",
            severity: "error",
          });
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}admin/prompt`,
          {
            method: "PUT",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt_version_id: config.selectedVersionId,
              prompt_text: config.systemPrompt,
            }),
          },
        );
        if (response.ok) {
          setSnackbar({
            open: true,
            message: "Version updated!",
            severity: "success",
          });
          fetchPromptVersions(config.blockType);
        } else {
          throw new Error("Failed to save");
        }
      } catch {
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
        block_type: configA.blockType,
        test_id: configA.sessionId,
        custom_prompt: configA.systemPrompt,
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
          // Batch chunks using RAF to reduce render frequency
          if (!chunkBufferA.current) {
            chunkBufferA.current = content;
            requestAnimationFrame(() => {
              const batch = chunkBufferA.current;
              chunkBufferA.current = null;

              setConfigA((prev) => {
                const msgs = [...prev.messages];
                const lastMsg = msgs[msgs.length - 1];
                if (lastMsg && lastMsg.role === "assistant") {
                  msgs[msgs.length - 1] = {
                    ...lastMsg,
                    content: lastMsg.content + batch,
                  };
                }
                return { ...prev, messages: msgs };
              });
            });
          } else {
            chunkBufferA.current += content;
          }
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
          block_type: configB.blockType,
          test_id: configB.sessionId,
          custom_prompt: configB.systemPrompt,
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
            // Batch chunks using RAF to reduce render frequency
            if (!chunkBufferB.current) {
              chunkBufferB.current = content;
              requestAnimationFrame(() => {
                const batch = chunkBufferB.current;
                chunkBufferB.current = null;

                setConfigB((prev) => {
                  const msgs = [...prev.messages];
                  const lastMsg = msgs[msgs.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    msgs[msgs.length - 1] = {
                      ...lastMsg,
                      content: lastMsg.content + batch,
                    };
                  }
                  return { ...prev, messages: msgs };
                });
              });
            } else {
              chunkBufferB.current += content;
            }
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

  // Handle config changes with session rotation for block type
  const handleConfigAChange = (updates: Partial<ConfigurationState>) => {
    setConfigA((prev) => {
      const newConfig = { ...prev, ...updates };
      // If blockType changed, rotate test ID and clear messages
      if (updates.blockType && updates.blockType !== prev.blockType) {
        newConfig.sessionId = generateTestId();
        newConfig.messages = [];

        // If in compare mode, synchronize Config B's block category
        if (compareMode) {
          setConfigB((prevB) => ({
            ...prevB,
            blockType: updates.blockType!,
            sessionId: generateTestId(),
            messages: [],
          }));
        }
      }
      return newConfig;
    });
  };

  const handleConfigBChange = (updates: Partial<ConfigurationState>) => {
    setConfigB((prev) => {
      const newConfig = { ...prev, ...updates };
      // If blockType changed, rotate test ID and clear messages
      if (updates.blockType && updates.blockType !== prev.blockType) {
        newConfig.sessionId = generateTestId();
        newConfig.messages = [];

        // If in compare mode, synchronize Config A's block category
        if (compareMode) {
          setConfigA((prevA) => ({
            ...prevA,
            blockType: updates.blockType!,
            sessionId: generateTestId(),
            messages: [],
          }));
        }
      }
      return newConfig;
    });
  };

  // Clear chat handlers
  const clearChatA = () => {
    setConfigA((prev) => ({
      ...prev,
      messages: [],
      sessionId: generateTestId(),
    }));
  };

  const clearChatB = () => {
    setConfigB((prev) => ({
      ...prev,
      messages: [],
      sessionId: generateTestId(),
    }));
  };

  // Toggle compare mode
  const toggleCompareMode = () => {
    if (!compareMode) {
      setConfigB(createDefaultConfig(configA.blockType));
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

      {/* Model Configuration Section - Top */}
      <Box sx={{ display: "flex", gap: 3 }}>
        <Box sx={{ flex: 1 }}>
          <ModelConfigSection
            config={configA}
            onConfigChange={handleConfigAChange}
            label={compareMode ? "Model Config A" : undefined}
          />
        </Box>
        {compareMode && (
          <Box sx={{ flex: 1 }}>
            <ModelConfigSection
              config={configB}
              onConfigChange={handleConfigBChange}
              label="Model Config B"
            />
          </Box>
        )}
      </Box>

      {/* System Prompt Section - Middle */}
      <Box sx={{ display: "flex", gap: 3 }}>
        <Box sx={{ flex: 1 }}>
          <SystemPromptSection
            config={configA}
            onConfigChange={handleConfigAChange}
            promptVersions={promptVersions}
            onLoadVersion={(v) => loadPromptVersion(v, setConfigA)}
            onSave={() => savePromptVersion(configA)}
            label={compareMode ? "Prompt A" : undefined}
          />
        </Box>
        {compareMode && (
          <Box sx={{ flex: 1 }}>
            <SystemPromptSection
              config={configB}
              onConfigChange={handleConfigBChange}
              promptVersions={promptVersions}
              onLoadVersion={(v) => loadPromptVersion(v, setConfigB)}
              onSave={() => savePromptVersion(configB)}
              label="Prompt B"
            />
          </Box>
        )}
      </Box>

      {/* Chat Section - Bottom */}
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
          backgroundColor: "var(--paper)",
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
