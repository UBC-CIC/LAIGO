import React, { useEffect, useState, useRef } from "react";
import { Box, Container, CircularProgress } from "@mui/material";
import { useParams } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import UserMessage from "../../components/Chat/UserMessage";
import AiResponse from "../../components/Chat/AIResponse";
import ChatBar from "../../components/Chat/ChatBar";

interface Message {
  type: "human" | "ai";
  content: string;
}

const InterviewAssistant: React.FC = () => {
  const { caseId, section } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // Initialize chat when section changes
  useEffect(() => {
    setMessages([]); // Clear history on section switch
    if (caseId && section) {
      handleSendMessage("", true); // Send initial trigger for greeting
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, section]);

  const handleSendMessage = async (message: string, isInitial = false) => {
    if (!caseId || !section) return;

    if (!isInitial) {
      setMessages((prev) => [...prev, { type: "human", content: message }]);
    }

    setIsLoading(true);

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
        {messages.map((msg, index) =>
          msg.type === "human" ? (
            <UserMessage key={index} message={msg.content} />
          ) : (
            <AiResponse key={index} message={msg.content} />
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
