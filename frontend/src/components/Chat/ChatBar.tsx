import React from "react";
import { Box, InputBase, IconButton } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SendIcon from "@mui/icons-material/Send";

interface ChatBarProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

const ChatBar: React.FC<ChatBarProps> = ({ onSendMessage, isLoading }) => {
  const [input, setInput] = React.useState("");

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderRadius: 50,
        px: 2,
        py: 1.5,
        border: "1px solid var(--border)",
        width: "100%",
      }}
    >
      <IconButton size="small" sx={{ color: "var(--text)", p: 0.5 }}>
        <AddIcon fontSize="small" />
      </IconButton>

      <InputBase
        placeholder="Ask me a question"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        sx={{
          ml: 2,
          flex: 1,
          color: "var(--text)",
          fontSize: "0.9rem",
          "& input::placeholder": {
            color: "var(--text-secondary)",
            opacity: 0.7,
          },
        }}
        fullWidth
      />

      <IconButton
        size="small"
        sx={{ color: "var(--text)", p: 0.5 }}
        onClick={handleSend}
        disabled={isLoading || !input.trim()}
      >
        <SendIcon
          fontSize="small"
          sx={{ transform: "rotate(-45deg)", mb: 0.5 }}
        />
      </IconButton>
    </Box>
  );
};

export default ChatBar;
