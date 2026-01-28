import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Container,
  TextField,
  Button,
  Snackbar,
  Alert,
} from "@mui/material";
import { fetchAuthSession } from "aws-amplify/auth";
import { useParams } from "react-router-dom";
import FeedbackMessage from "../../components/Case/FeedbackMessage";
import SendIcon from "@mui/icons-material/Send";
import { useUser } from "../../contexts/UserContext";

// Interface for feedback messages
interface FeedbackMessageData {
  id: string;
  sender: string;
  timestamp: string;
  content: string;
}

interface ApiFeedbackMessage {
  message_id: string;
  message_content: string;
  time_sent: string;
  first_name: string;
  last_name: string;
}

const CaseFeedback: React.FC = () => {
  const { caseId } = useParams();
  const { userInfo } = useUser();
  const [loading, setLoading] = useState<boolean>(true);
  const [messages, setMessages] = useState<FeedbackMessageData[]>([]);
  const [newFeedback, setNewFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">(
    "success",
  );

  const isInstructor = userInfo?.groups?.includes("instructor");

  const loadFeedback = React.useCallback(async () => {
    try {
      setLoading(true);
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (!token) {
        console.error("No auth token found");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/student/feedback?case_id=${caseId}`,
        {
          headers: {
            Authorization: token,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch feedback");
      }

      const data: ApiFeedbackMessage[] = await response.json();

      const normalizedMessages: FeedbackMessageData[] = data.map((msg) => ({
        id: msg.message_id,
        sender:
          `${msg.first_name || "Instructor"} ${msg.last_name || ""}`.trim(),
        timestamp: new Date(msg.time_sent).toLocaleString(),
        content: msg.message_content,
      }));

      setMessages(normalizedMessages);
    } catch (err) {
      console.error("Failed to load feedback", err);
      showSnackbar("Failed to load feedback.", "error");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (caseId) {
      loadFeedback();
    }
  }, [caseId, loadFeedback]);

  const showSnackbar = (message: string, severity: "success" | "error") => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSendFeedback = async () => {
    if (!newFeedback.trim()) return;

    try {
      setSubmitting(true);
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const userId = session.tokens?.accessToken?.payload.sub;

      if (!token || !userId) {
        showSnackbar("Authentication error", "error");
        return;
      }

      // Backend now uses cognito_id from authorizer
      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/instructor/send_feedback?case_id=${caseId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: token,
          },
          body: JSON.stringify({
            message_content: newFeedback,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to send feedback");
      }

      showSnackbar("Feedback sent successfully", "success");
      setNewFeedback("");
      loadFeedback(); // Refresh list
    } catch (err) {
      console.error("Error sending feedback:", err);
      showSnackbar("Failed to send feedback", "error");
    } finally {
      setSubmitting(false);
    }
  };

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
            border: "1px solid var(--border)",
            borderRadius: 1,
            overflow: "hidden",
            backgroundColor: "transparent",
            p: 3,
          }}
        >
          {/* Instructor Input Section */}
          {isInstructor && (
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="h6"
                fontFamily="Outfit"
                fontWeight="500"
                mb={2}
                textAlign="left"
              >
                Provide New Feedback
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={3}
                variant="outlined"
                placeholder="Enter feedback regarding the case approach"
                value={newFeedback}
                onChange={(e) => setNewFeedback(e.target.value)}
                sx={{
                  backgroundColor: "var(--background)",
                  marginBottom: 2,
                  "& .MuiOutlinedInput-root": {
                    color: "var(--text)",
                    "& fieldset": { borderColor: "var(--border)" },
                    "&:hover fieldset": {
                      borderColor: "var(--text-secondary)",
                    },
                    "&.Mui-focused fieldset": { borderColor: "var(--primary)" },
                  },
                }}
              />
              <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
                <Button
                  variant="contained"
                  startIcon={
                    submitting ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <SendIcon />
                    )
                  }
                  onClick={handleSendFeedback}
                  disabled={submitting || !newFeedback.trim()}
                  sx={{
                    backgroundColor: "var(--primary)",
                    color: "var(--text)",
                    textTransform: "none",
                    fontWeight: "bold",
                    "&:hover": {
                      backgroundColor: "var(--primary)",
                      filter: "brightness(0.9)",
                    },
                  }}
                >
                  {submitting ? "Sending..." : "Send Feedback"}
                </Button>
              </Box>
              <Box
                sx={{
                  borderBottom: "1px solid var(--border)",
                  mt: 4,
                }}
              />
            </Box>
          )}

          {/* Header */}
          <Typography
            variant="h6"
            fontFamily="Outfit"
            textAlign="left"
            fontWeight="500"
            mb={2}
            mt={isInstructor ? 4 : 0}
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

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CaseFeedback;
