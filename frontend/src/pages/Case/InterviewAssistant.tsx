import React, { useEffect, useState, useRef } from "react";
import { Box, Container, CircularProgress } from "@mui/material";
import { useParams, useOutletContext } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import UserMessage from "../../components/Chat/UserMessage";
import AiResponse from "../../components/Chat/AIResponse";
import ChatBar from "../../components/Chat/ChatBar";
import type { CaseOutletContext } from "./CaseLayout";

interface Message {
  type: "human" | "ai";
  content: string;
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get current block type from section
  const currentBlock = section ? SUB_ROUTE_TO_BLOCK[section] : null;

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
        console.log("Assessment result:", data);

        if (data.unlocked) {
          // Refresh unlocked blocks from server
          await refreshUnlockedBlocks();
        }
      }
    } catch (error) {
      console.error("Error calling assess_progress:", error);
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // Reset message count and fetch chat history when section changes
  useEffect(() => {
    setMessageCount(0);

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
  }, [caseId, section]);

  const handleSendMessage = async (message: string) => {
    if (!caseId || !section) return;

    setMessages((prev) => [...prev, { type: "human", content: message }]);
    setIsLoading(true);

    // Increment message count
    const newMessageCount = messageCount + 1;
    setMessageCount(newMessageCount);

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
          // Use the new count value for check
          if (newMessageCount % 2 === 1) {
            // Only check the other conditions now
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
            content: "Sorry, I encountered an error connecting to the server.",
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
              <AiResponse key={index} message={msg.content} />
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
          pb: 4,
          pt: 2,
          backgroundColor: "var(--background)",
          flexShrink: 0,
        }}
      >
        <Container maxWidth="lg" sx={{ px: { xs: 2, md: 8 } }}>
          <ChatBar onSendMessage={handleSendMessage} isLoading={isLoading} />
        </Container>
      </Box>
    </Box>
  );
};

export default InterviewAssistant;
