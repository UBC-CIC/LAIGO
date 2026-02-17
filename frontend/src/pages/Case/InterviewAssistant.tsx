import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Box,
  Container,
  CircularProgress,
  LinearProgress,
  Typography,
  Snackbar,
  Alert,
  IconButton,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import { useParams, useOutletContext } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import UserMessage from "../../components/Chat/UserMessage";
import AiResponse from "../../components/Chat/AIResponse";
import ChatBar from "../../components/Chat/ChatBar";
import type { CaseOutletContext } from "./CaseLayout";
import { useWebSocket } from "../../hooks/useWebSocket";
import ThinkingIndicator from "../../components/Chat/ThinkingIndicator";

interface Message {
  type: "human" | "ai";
  content: string;
  isStreaming?: boolean;
}

interface WebSocketMessage {
  type: "start" | "chunk" | "complete" | "error" | "pong";
  content?: string;
  metadata?: { llm_output?: string };
}

interface AssessmentResponse {
  progress: number;
  reasoning?: string;
  unlocked?: boolean;
}

// Map sub_route to block_type for assessment
const SUB_ROUTE_TO_BLOCK: Record<string, string> = {
  "intake-facts": "intake",
  "issue-identification": "issues",
  "research-strategy": "research",
  "argument-construction": "argument",
  "contrarian-analysis": "contrarian",
  "policy-context": "policy",
};

// Progression map: current block -> next block(s) to unlock
const PROGRESSION_MAP: Record<string, string | string[]> = {
  intake: "issues",
  issues: "research",
  research: ["argument", "contrarian", "policy"],
};

const InterviewAssistant: React.FC = () => {
  const { caseId, section } = useParams();
  const { unlockedBlocks, refreshUnlockedBlocks, caseStatus } =
    useOutletContext<CaseOutletContext>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  // Progress & Notification State
  const [progress, setProgress] = useState(0);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [rightOpen, setRightOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 240 && newWidth < 600) {
          setSidebarWidth(newWidth);
        }
      }
    },
    [isResizing],
  );

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    } else {
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    }
    return () => {
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingIndexRef = useRef<number | null>(null);

  // Get current block type from section
  const currentBlock = section ? SUB_ROUTE_TO_BLOCK[section] : null;

  // Determine if we should show the progress bar
  // Hide if terminal block OR next block(s) are already unlocked
  const showProgressBar = React.useMemo(() => {
    if (!currentBlock) return false;
    const nextStep = PROGRESSION_MAP[currentBlock];
    if (!nextStep) return false;

    const nextBlocks = Array.isArray(nextStep) ? nextStep : [nextStep];
    const allNextUnlocked = nextBlocks.every((block) =>
      unlockedBlocks.includes(block),
    );

    return !allNextUnlocked;
  }, [currentBlock, unlockedBlocks]);

  const assessProgressRef = useRef<(() => Promise<void>) | null>(null);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      console.log("WebSocket message received:", message.type, message);
      if (message.type === "start") {
        // Add an empty AI message that will be filled with chunks
        setMessages((prev) => {
          const newMessages = [
            ...prev,
            { type: "ai" as const, content: "", isStreaming: true },
          ];
          streamingIndexRef.current = newMessages.length - 1;
          return newMessages;
        });
      } else if (message.type === "chunk" && message.content) {
        // Append chunk to the streaming message
        setMessages((prev) => {
          if (streamingIndexRef.current === null) return prev;
          const updated = [...prev];
          const idx = streamingIndexRef.current;
          if (updated[idx]) {
            updated[idx] = {
              ...updated[idx],
              content: updated[idx].content + message.content,
            };
          }
          return updated;
        });
      } else if (message.type === "complete") {
        // Mark streaming as complete
        console.log(
          "WebSocket COMPLETE message received, streamingIndexRef:",
          streamingIndexRef.current,
        );

        // Capture the index before the setState to avoid closure issues
        const completedIndex = streamingIndexRef.current;

        setMessages((prev) => {
          if (completedIndex === null) {
            console.log("completedIndex is null, returning prev");
            return prev;
          }
          const updated = [...prev];
          console.log(
            "Setting isStreaming to false for message at index:",
            completedIndex,
          );
          if (updated[completedIndex]) {
            updated[completedIndex] = {
              type: updated[completedIndex].type,
              content: updated[completedIndex].content,
              isStreaming: false,
            };
            console.log("Updated message:", updated[completedIndex]);
          }
          return updated;
        });
        streamingIndexRef.current = null;
        setIsLoading(false);

        // Check if we should trigger assessment
        if (currentBlock && PROGRESSION_MAP[currentBlock]) {
          const nextStep = PROGRESSION_MAP[currentBlock];
          const nextBlocks = Array.isArray(nextStep) ? nextStep : [nextStep];
          const allNextUnlocked = nextBlocks.every((block) =>
            unlockedBlocks.includes(block),
          );
          if (!allNextUnlocked) {
            assessProgressRef.current?.();
          }
        }
      } else if (message.type === "error") {
        // Handle error
        setMessages((prev) => {
          if (streamingIndexRef.current !== null) {
            const updated = [...prev];
            const idx = streamingIndexRef.current;
            if (updated[idx]) {
              updated[idx] = {
                ...updated[idx],
                content: message.content || "An error occurred.",
                isStreaming: false,
              };
            }
            return updated;
          }
          return [
            ...prev,
            {
              type: "ai" as const,
              content: message.content || "An error occurred.",
            },
          ];
        });
        streamingIndexRef.current = null;
        setIsLoading(false);
      }
    },
    [currentBlock, unlockedBlocks],
  );
  // Initialize WebSocket connection
  const { sendStreamingRequest, isConnected } = useWebSocket(wsUrl, {
    onMessage: handleWebSocketMessage,
  });

  // Call assess_progress endpoint
  const assessProgress = useCallback(async () => {
    if (!caseId || !currentBlock) return;

    // Try WebSocket first if connected
    if (isConnected) {
      sendStreamingRequest(
        "assess_progress",
        { case_id: caseId, block_type: currentBlock },
        {
          onComplete: async (data: Record<string, unknown>) => {
            const assessment = data as unknown as AssessmentResponse;
            const progress =
              typeof assessment.progress === "number" ? assessment.progress : 0;
            setProgress((progress / 5) * 100);

            if (assessment.reasoning) {
              setFeedback(assessment.reasoning);
            }

            if (assessment.unlocked) {
              setShowSnackbar(true);
              await refreshUnlockedBlocks();
            }
          },
          onError: (msg) => console.error("assess_progress error:", msg),
        },
      );
      return;
    }

    // Fallback to HTTP
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (!token) return;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/student/assess_progress`,
        {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            case_id: caseId,
            block_type: currentBlock,
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        const currentScore =
          typeof data.progress === "number" ? data.progress : 0;
        setProgress((currentScore / 5) * 100);

        if (data.reasoning) {
          setFeedback(data.reasoning);
        }

        if (data.unlocked) {
          setShowSnackbar(true);
          await refreshUnlockedBlocks();
        }
      }
    } catch (error) {
      console.error("Error calling assess_progress:", error);
    }
  }, [
    caseId,
    currentBlock,
    isConnected,
    sendStreamingRequest,
    refreshUnlockedBlocks,
  ]);

  useEffect(() => {
    assessProgressRef.current = assessProgress;
  }, [assessProgress]);

  // Set up WebSocket URL when auth is available
  useEffect(() => {
    const setupWebSocket = async () => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (token && import.meta.env.VITE_WEBSOCKET_URL) {
          setWsUrl(`${import.meta.env.VITE_WEBSOCKET_URL}?token=${token}`);
        }
      } catch (error) {
        console.error("Error setting up WebSocket:", error);
      }
    };
    setupWebSocket();
  }, []);

  // Generate summary for current block
  const handleGenerateSummary = async () => {
    if (!caseId || !section) return;

    setIsGeneratingSummary(true);

    // Try WebSocket first if connected
    if (isConnected) {
      sendStreamingRequest(
        "generate_summary",
        { case_id: caseId, sub_route: section },
        {
          onStart: () => {
            console.log("Summary generation started (streaming)");
          },
          onChunk: (content) => {
            // Summary is being streamed - could display progress if desired
            console.log("Summary chunk received:", content.substring(0, 50));
          },
          onComplete: (data) => {
            console.log("Summary generated successfully via WebSocket", data);
            setIsGeneratingSummary(false);
          },
          onError: (msg) => {
            console.error("Summary generation error:", msg);
            setIsGeneratingSummary(false);
          },
        },
      );
      return;
    }

    // Fallback to HTTP
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (!token) {
        console.error("No auth token found");
        setIsGeneratingSummary(false);
        return;
      }

      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }/student/generate_summary?case_id=${caseId}&sub_route=${section}`,
        {
          method: "GET",
          headers: {
            Authorization: token,
          },
        },
      );

      if (response.ok) {
        console.log("Summary generated successfully");
      } else {
        console.error("Failed to generate summary", response.statusText);
      }
    } catch (error) {
      console.error("Error generating summary:", error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // Reset state when section changes
  useEffect(() => {
    setMessageCount(0);
    setProgress(0); // Reset progress on new section

    const DEFAULT_GREETING: Message = {
      type: "ai",
      content:
        "Hi, I'm your Legal Interview Assistant. Try asking me to analyze the case to begin!",
    };

    const fetchChatHistory = async () => {
      if (!caseId || !section) return;

      setIsLoadingHistory(true);
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();

        if (!token) {
          console.error("No auth token found");
          setMessages([DEFAULT_GREETING]);
          return;
        }

        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }/student/get_messages?case_id=${caseId}&sub_route=${section}`,
          {
            method: "GET",
            headers: {
              Authorization: token,
            },
          },
        );

        if (response.ok) {
          const history = await response.json();
          setMessages(
            Array.isArray(history) && history.length > 0
              ? history
              : [DEFAULT_GREETING],
          );
          // Set message count based on existing human messages
          const humanMsgCount = history.filter(
            (m: Message) => m.type === "human",
          ).length;
          setMessageCount(humanMsgCount);

          // Initialize progress bar if there's existing chat history
          if (Array.isArray(history) && history.length > 0 && showProgressBar) {
            assessProgress();
          }
        } else {
          if (response.status !== 404) {
            console.error("Failed to fetch chat history", response.statusText);
          }
          setMessages([DEFAULT_GREETING]);
        }
      } catch (error) {
        console.error("Error fetching chat history", error);
        setMessages([DEFAULT_GREETING]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchChatHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, section]);

  const handleSendMessage = async (message: string) => {
    if (!caseId || !section) return;

    setMessages((prev) => [...prev, { type: "human", content: message }]);
    setIsLoading(true);

    // Increment message count
    const newMessageCount = messageCount + 1;
    setMessageCount(newMessageCount);

    // Use WebSocket if connected, otherwise fall back to HTTP
    if (isConnected) {
      const requestId = sendStreamingRequest(
        "generate_text",
        {
          case_id: caseId,
          sub_route: section,
          message_content: message,
        },
        {
          onStart: () => {
            // Add an empty AI message that will be filled with chunks
            setMessages((prev) => {
              const newMessages = [
                ...prev,
                { type: "ai" as const, content: "", isStreaming: true },
              ];
              streamingIndexRef.current = newMessages.length - 1;
              return newMessages;
            });
          },
          onChunk: (content) => {
            // Append chunk to the streaming message
            setMessages((prev) => {
              if (streamingIndexRef.current === null) return prev;
              const updated = [...prev];
              const idx = streamingIndexRef.current;
              if (updated[idx]) {
                updated[idx] = {
                  ...updated[idx],
                  content: updated[idx].content + content,
                };
              }
              return updated;
            });
          },
          onComplete: () => {
            // Mark streaming as complete
            const completedIndex = streamingIndexRef.current;
            setMessages((prev) => {
              if (completedIndex === null) return prev;
              const updated = [...prev];
              if (updated[completedIndex]) {
                updated[completedIndex] = {
                  type: updated[completedIndex].type,
                  content: updated[completedIndex].content,
                  isStreaming: false,
                };
              }
              return updated;
            });
            streamingIndexRef.current = null;
            setIsLoading(false);

            // Check if we should trigger assessment
            if (
              newMessageCount % 2 === 1 &&
              currentBlock &&
              PROGRESSION_MAP[currentBlock]
            ) {
              const nextStep = PROGRESSION_MAP[currentBlock];
              const nextBlocks = Array.isArray(nextStep)
                ? nextStep
                : [nextStep];
              const allNextUnlocked = nextBlocks.every((block) =>
                unlockedBlocks.includes(block),
              );
              if (!allNextUnlocked) {
                assessProgress();
              }
            }
          },
          onError: (errorMsg) => {
            setMessages((prev) => {
              if (streamingIndexRef.current !== null) {
                const updated = [...prev];
                const idx = streamingIndexRef.current;
                if (updated[idx]) {
                  updated[idx] = {
                    ...updated[idx],
                    content: errorMsg || "An error occurred.",
                    isStreaming: false,
                  };
                }
                return updated;
              }
              return [
                ...prev,
                {
                  type: "ai" as const,
                  content: errorMsg || "An error occurred.",
                },
              ];
            });
            streamingIndexRef.current = null;
            setIsLoading(false);
          },
        },
      );

      if (!requestId) {
        console.error("Failed to send WebSocket message");
        setMessages((prev) => [
          ...prev,
          { type: "ai", content: "Failed to send message. Please try again." },
        ]);
        setIsLoading(false);
      }
    } else {
      // Fallback to HTTP (backward compatibility)
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();

        if (!token) {
          console.error("No auth token found");
          return;
        }

        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }/student/text_generation?case_id=${caseId}&sub_route=${section}`,
          {
            method: "POST",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message_content: message,
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();
          if (data.llm_output) {
            setMessages((prev) => [
              ...prev,
              { type: "ai", content: data.llm_output },
            ]);

            // Check if we should trigger assessment after AI responds
            if (newMessageCount % 2 === 1) {
              if (currentBlock && PROGRESSION_MAP[currentBlock]) {
                const nextStep = PROGRESSION_MAP[currentBlock];
                const nextBlocks = Array.isArray(nextStep)
                  ? nextStep
                  : [nextStep];
                const allNextUnlocked = nextBlocks.every((block) =>
                  unlockedBlocks.includes(block),
                );
                if (!allNextUnlocked) {
                  assessProgress();
                }
              }
            }
          }
        } else {
          let errorMsg =
            "Sorry, I encountered an error connecting to the server.";
          if (response.status === 429) {
            try {
              const errorData = await response.json();
              errorMsg = errorData.error || errorMsg;
            } catch (e) {
              console.error("Failed to parse error response", e);
            }
          }
          console.error("API Error", response.status, response.statusText);
          setMessages((prev) => [
            ...prev,
            {
              type: "ai",
              content: errorMsg,
            },
          ]);
        }
      } catch (error) {
        console.error("Network Error", error);
        setMessages((prev) => [
          ...prev,
          { type: "ai", content: "Sorry, I encountered a network error." },
        ]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Box
      sx={{
        width: "100%",
        height: "calc(100vh - 80px)",
        backgroundColor: "var(--background)",
        display: "flex",
        flexDirection: "column",
        color: "var(--text)",
        overflow: "hidden", // Prevent outer scroll
      }}
    >
      {/* Main Layout: Split into Center (Chat) and Right (Sidebar) */}
      <Box
        sx={{
          display: "flex",
          flexGrow: 1,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Chat Area + Bottom Bar Container */}
        <Box
          sx={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Progress Bar (Above messages, constrained to layout width) */}
          {showProgressBar && (
            <Box
              sx={{
                width: "100%",
                zIndex: 10,
                backgroundColor: "var(--background)",
                backdropFilter: "blur(10px)",
                borderTop: "1px solid var(--border)",
                boxShadow: "0px -2px 4px rgba(0, 0, 0, 0.9)",
                display: "flex",
                alignItems: "center",
                py: "2px",
                px: 3,
                gap: 2,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: "var(--text-secondary)",
                  fontSize: "0.75rem",
                  whiteSpace: "nowrap",
                  fontFamily: "Outfit",
                }}
              >
                Progress to next block
              </Typography>
              <Box sx={{ flexGrow: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: "var(--border)",
                    "& .MuiLinearProgress-bar": {
                      backgroundColor: "var(--primary)",
                      borderRadius: 2,
                    },
                  }}
                />
              </Box>
            </Box>
          )}
          {/* Right Ribbon Trigger (only visible when sidebar is closed) */}
          {!rightOpen && (
            <Box
              sx={{
                position: "absolute",
                right: 0,
                top: 12,
                zIndex: 10,
                backgroundColor: "var(--background)",
                border: "1px solid var(--border)",
                borderRight: "none",
                borderTopLeftRadius: "8px",
                borderBottomLeftRadius: "8px",
                boxShadow: "-2px 0 5px rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "24px",
                height: "40px",
                cursor: "pointer",
                "&:hover": {
                  backgroundColor: "var(--secondary)",
                },
              }}
              onClick={() => setRightOpen(true)}
            >
              <KeyboardDoubleArrowLeftIcon
                sx={{ fontSize: "16px", color: "var(--text-secondary)" }}
              />
            </Box>
          )}

          {/* Messages Area */}
          <Container
            maxWidth="lg"
            sx={{
              flexGrow: 1,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              overflowY: "auto",
              py: 4,
              px: { xs: 2, md: 8 },
              position: "relative",
            }}
          >
            {isLoadingHistory ? (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                }}
              >
                <CircularProgress sx={{ color: "var(--text-secondary)" }} />
              </Box>
            ) : (
              messages.map((msg, index) =>
                msg.type === "human" ? (
                  <UserMessage key={index} message={msg.content} />
                ) : (
                  <AiResponse
                    key={`ai-${index}-${
                      msg.isStreaming ? "streaming" : "complete"
                    }`}
                    message={msg.content}
                    onGenerateSummary={
                      caseStatus === "archived"
                        ? undefined
                        : handleGenerateSummary
                    }
                    isGeneratingSummary={isGeneratingSummary}
                    isStreaming={msg.isStreaming === true}
                  />
                ),
              )
            )}

            {isLoading && !messages.some((m) => m.isStreaming) && (
              <Box
                sx={{ display: "flex", justifyContent: "flex-start", pl: 2 }}
              >
                <ThinkingIndicator />
              </Box>
            )}

            <div ref={scrollRef} />
          </Container>

          {/* Bottom Bar Area */}
          <Box
            sx={{
              width: "100%",
              pb: 2,
              pt: 1,
              backgroundColor: "var(--background)",
              flexShrink: 0,
            }}
          >
            <Container maxWidth="lg" sx={{ px: { xs: 2, md: 8 } }}>
              <ChatBar
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                disabled={caseStatus === "archived"}
              />
            </Container>
          </Box>
        </Box>

        {/* Right Sidebar */}
        <Box
          sx={{
            width: rightOpen ? sidebarWidth : 0,
            transition: isResizing ? "none" : "width 0.1s ease",
            borderLeft: rightOpen ? "1px solid var(--border)" : "none",
            backgroundColor: "var(--background)",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            height: "100%",
            position: "relative",
          }}
        >
          {/* Resize Handle */}
          {rightOpen && (
            <Box
              onMouseDown={startResizing}
              sx={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: "4px",
                cursor: "col-resize",
                zIndex: 100,
                "&:hover": {
                  backgroundColor: "rgba(25, 118, 210, 0.2)",
                  width: "6px",
                },
                transition: "background-color 0.2s",
              }}
            />
          )}

          <Box
            sx={{
              p: 2,
              height: "56px",
              display: "flex",
              alignItems: "center",
              justifyContent: rightOpen ? "space-between" : "center",
              borderBottom: "1px solid var(--border)",
              boxSizing: "border-box",
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
              <Typography
                variant="subtitle2"
                sx={{
                  fontFamily: "Outfit",
                  fontWeight: 600,
                  color: "var(--text)",
                }}
              >
                Assessment Feedback
              </Typography>
            )}
          </Box>

          {rightOpen && (
            <>
              <Box
                sx={{
                  flexGrow: 1,
                  overflowY: "auto",
                  p: 1.5,
                  backgroundColor: "var(--background)",
                }}
              >
                {feedback ? (
                  <Card
                    sx={{
                      backgroundColor: "var(--background2)",
                      border: "1px solid var(--border)",
                      boxShadow: "none",
                    }}
                  >
                    <CardContent sx={{ p: 1.25, "&:last-child": { pb: 1.25 } }}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "var(--text)",
                          fontSize: "0.875rem",
                          lineHeight: 1.4,
                          whiteSpace: "pre-wrap",
                          textAlign: "left",
                        }}
                      >
                        {feedback}
                      </Typography>
                    </CardContent>
                  </Card>
                ) : (
                  <Typography
                    variant="body2"
                    sx={{
                      color: "var(--text-secondary)",
                      textAlign: "center",
                      mt: 4,
                      fontSize: "0.875rem",
                      whiteSpace: "normal",
                      lineHeight: 1.4,
                    }}
                  >
                    No feedback available yet. Continue the conversation to
                    receive assessment.
                  </Typography>
                )}
              </Box>
              <Box sx={{ p: 2, borderTop: "1px solid var(--border)" }}>
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  onClick={() => setInstructionsOpen(true)}
                  sx={{
                    textTransform: "none",
                    borderColor: "var(--border)",
                    color: "var(--text-secondary)",
                    "&:hover": {
                      borderColor: "var(--primary)",
                      color: "var(--primary)",
                      backgroundColor: "rgba(25, 118, 210, 0.04)", // Fallback if var not set
                    },
                  }}
                >
                  How does this work?
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Box>

      {/* Instructions Dialog */}
      <Dialog
        open={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: "var(--background)",
            border: "1px solid var(--border)",
            borderRadius: 2,
            backgroundImage: "none",
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: "bold",
            backgroundColor: "var(--header)",
            color: "var(--text)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          How to use the Assistant
        </DialogTitle>
        <DialogContent
          sx={{
            backgroundColor: "var(--background)",
            p: 3,
            paddingTop: "24px !important",
            borderBottom: "none",
          }}
        >
          <Box
            component="ul"
            sx={{
              m: 0,
              pl: 2,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              "& li": {
                pl: 1,
                "&::marker": {
                  color: "var(--text-secondary)",
                },
              },
            }}
          >
            <li>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: "bold", color: "var(--text)" }}
              >
                Locked Progression
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "var(--text-secondary)", mt: 0.5 }}
              >
                The case simulation is structured in sequential blocks. You are
                currently restricted to this specific phase and must satisfy its
                requirements before the next section of the case becomes
                available.
              </Typography>
            </li>
            <li>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: "bold", color: "var(--text)" }}
              >
                How to Unlock
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "var(--text-secondary)", mt: 0.5 }}
              >
                Engage naturally with the Assistant by asking questions and
                analyzing the case facts. The system analyzes your conversation
                depth and coverage of key legal concepts to determine when you
                are ready to advance.
              </Typography>
            </li>
            <li>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: "bold", color: "var(--text)" }}
              >
                Track Progress
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "var(--text-secondary)", mt: 0.5 }}
              >
                A progress bar at the top of the chat visualizes your standing.
                As you cover more ground in your conversation, this bar will
                fill up. Reaching 100% will trigger a notification that the next
                block is unlocked.
              </Typography>
            </li>
            <li>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: "bold", color: "var(--text)" }}
              >
                Get Guidance
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "var(--text-secondary)", mt: 0.5 }}
              >
                The feedback panel on the right is your real-time coach. It
                offers specific insights into what information you might be
                missing or which topics require further exploration to complete
                the current block.
              </Typography>
            </li>
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            borderTop: "1px solid var(--border)",
            backgroundColor: "var(--header)",
            p: 2,
          }}
        >
          <Button
            onClick={() => setInstructionsOpen(false)}
            variant="contained"
            sx={{
              backgroundColor: "var(--primary)",
              color: "white",
              fontWeight: "bold",
              "&:hover": {
                backgroundColor: "var(--primary-hover)",
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unlock Notification Snackbar */}
      <Snackbar
        open={showSnackbar}
        autoHideDuration={8000}
        onClose={() => setShowSnackbar(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setShowSnackbar(false)}
          severity="success"
          sx={{ width: "100%" }}
        >
          Success! You have unlocked the next block. Feel free to proceed or
          continue asking questions.
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default InterviewAssistant;
