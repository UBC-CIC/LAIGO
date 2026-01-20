import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Box,
  Container,
  CircularProgress,
  LinearProgress,
  Typography,
  Snackbar,
  Alert,
} from "@mui/material";
import { useParams, useOutletContext } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import UserMessage from "../../components/Chat/UserMessage";
import AiResponse from "../../components/Chat/AIResponse";
import ChatBar from "../../components/Chat/ChatBar";
import type { CaseOutletContext } from "./CaseLayout";
import { useWebSocket } from "../../hooks/useWebSocket";

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
  const { unlockedBlocks, refreshUnlockedBlocks } =
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
      unlockedBlocks.includes(block)
    );

    return !allNextUnlocked;
  }, [currentBlock, unlockedBlocks]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
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
        setMessages((prev) => {
          if (streamingIndexRef.current === null) return prev;
          const updated = [...prev];
          const idx = streamingIndexRef.current;
          if (updated[idx]) {
            updated[idx] = { ...updated[idx], isStreaming: false };
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
            unlockedBlocks.includes(block)
          );
          if (!allNextUnlocked) {
            assessProgress();
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
    [currentBlock, unlockedBlocks]
  );

  // Initialize WebSocket connection
  const { sendMessage, isConnected } = useWebSocket(wsUrl, {
    onMessage: handleWebSocketMessage,
  });

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

  // Call assess_progress endpoint
  const assessProgress = async () => {
    if (!caseId || !currentBlock) return;

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
        }
      );

      if (response.ok) {
        const data = await response.json();
        // data.progress is 0-5. Convert to percentage.
        // If undefined, default to 0.
        const currentScore =
          typeof data.progress === "number" ? data.progress : 0;
        setProgress((currentScore / 5) * 100);

        if (data.unlocked) {
          // Show snackbar notifying user
          setShowSnackbar(true);
          // Refresh unlocked blocks from server
          await refreshUnlockedBlocks();
        }
      }
    } catch (error) {
      console.error("Error calling assess_progress:", error);
    }
  };

  // Generate summary for current block
  const handleGenerateSummary = async () => {
    if (!caseId || !section) return;

    setIsGeneratingSummary(true);
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
        }/student/generate_summary?case_id=${caseId}&sub_route=${section}`,
        {
          method: "GET",
          headers: {
            Authorization: token,
          },
        }
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
          }
        );

        if (response.ok) {
          const history = await response.json();
          setMessages(
            Array.isArray(history) && history.length > 0
              ? history
              : [DEFAULT_GREETING]
          );
          // Set message count based on existing human messages
          const humanMsgCount = history.filter(
            (m: Message) => m.type === "human"
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
      const sent = sendMessage({
        action: "generate_text",
        case_id: caseId,
        sub_route: section,
        message_content: message,
      });
      if (!sent) {
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
          }
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
                  unlockedBlocks.includes(block)
                );
                if (!allNextUnlocked) {
                  assessProgress();
                }
              }
            }
          }
        } else {
          console.error("API Error", response.statusText);
          setMessages((prev) => [
            ...prev,
            {
              type: "ai",
              content:
                "Sorry, I encountered an error connecting to the server.",
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
      {/* Progress Bar (Absolute Top) */}
      {showProgressBar && (
        <Box
          sx={{
            width: "100%",
            zIndex: 10,
            backgroundColor: "var(--background-secondary)",
            backdropFilter: "blur(10px)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
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
                backgroundColor: "rgba(255,255,255,0.1)",
                "& .MuiLinearProgress-bar": {
                  backgroundColor: "#64B5F6",
                  borderRadius: 2,
                },
              }}
            />
          </Box>
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
          px: { xs: 2, md: 8 }, // Add more horizontal padding
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
                key={index}
                message={msg.content}
                onGenerateSummary={handleGenerateSummary}
                isGeneratingSummary={isGeneratingSummary}
              />
            )
          )
        )}

        {isLoading && (
          <Box sx={{ display: "flex", justifyContent: "flex-start", pl: 2 }}>
            <CircularProgress
              size={24}
              sx={{ color: "var(--text-secondary)" }}
            />
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
          <ChatBar onSendMessage={handleSendMessage} isLoading={isLoading} />
        </Container>
      </Box>

      {/* Unlock Notification Snackbar */}
      <Snackbar
        open={showSnackbar}
        autoHideDuration={4000}
        onClose={() => setShowSnackbar(false)}
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
