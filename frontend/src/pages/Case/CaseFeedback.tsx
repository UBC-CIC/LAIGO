import React, { useEffect, useState } from "react";
import { Box, Typography, CircularProgress, Container } from "@mui/material";
import { fetchAuthSession } from "aws-amplify/auth";
import { useParams } from "react-router-dom";
import FeedbackMessage from "../../components/FeedbackMessage";

// Interface for feedback messages
interface FeedbackMessageData {
  id: string;
  sender: string;
  timestamp: string;
  content: string;
}

const CaseFeedback: React.FC = () => {
  const { caseId } = useParams();
  const [loading, setLoading] = useState<boolean>(true);
  const [messages, setMessages] = useState<FeedbackMessageData[]>([]);

  useEffect(() => {
    const loadFeedback = async () => {
      try {
        setLoading(true);
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();

        if (!token) {
          console.error("No auth token found");
          return;
        }

        // TODO: Replace with actual endpoint when available
        await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate delay

        const mockData: FeedbackMessageData[] = [
          {
            id: "1",
            sender: "Allan Jordan",
            timestamp: "November 24th, 11:04 am",
            content:
              "Good overall draft. Could use some work on fleshing out specific counterarguments to prepare for.\n\nI'd suggest focusing on picking out some past cases we can use as precedent.",
          },
        ];

        setMessages(mockData);
      } catch (err) {
        console.error("Failed to load feedback", err);
      } finally {
        setLoading(false);
      }
    };

    if (caseId) {
      loadFeedback();
    }
  }, [caseId]);

  return (
    <Box
      sx={{
        width: "100%",
        minHeight: "calc(100vh - 80px)",
        backgroundColor: "var(--background)",
        color: "var(--text)",
        p: 4,
      }}
    >
      <Container maxWidth="lg">
        <Typography
          variant="h4"
          fontFamily="Outfit"
          fontWeight="500"
          mb={4}
          textAlign="left"
        >
          Case Feedback
        </Typography>

        <Box
          sx={{
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: 1,
            overflow: "hidden",
            backgroundColor: "transparent",
            p: 2,
          }}
        >
          {/* Header */}
          <Typography
            variant="h6"
            fontFamily="Outfit"
            textAlign="left"
            fontWeight="500"
            mb={2}
          >
            Previous feedback
          </Typography>

          {/* List content */}
          <Box sx={{ p: 0 }}>
            {loading ? (
              <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
                <CircularProgress
                  size={30}
                  sx={{ color: "var(--text-secondary)" }}
                />
              </Box>
            ) : messages.length === 0 ? (
              <Box sx={{ p: 4 }}>
                <Typography color="var(--text-secondary)" textAlign="left">
                  No feedback yet.
                </Typography>
              </Box>
            ) : (
              <Box>
                {messages.map((msg) => (
                  <FeedbackMessage
                    key={msg.id}
                    sender={msg.sender}
                    timestamp={msg.timestamp}
                    content={msg.content}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default CaseFeedback;
