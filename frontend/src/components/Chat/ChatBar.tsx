import React from "react";
import { Box, InputBase, IconButton } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SendIcon from "@mui/icons-material/Send";

const ChatBar: React.FC = () => {
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

      <IconButton size="small" sx={{ color: "var(--text)", p: 0.5 }}>
        <SendIcon
          fontSize="small"
          sx={{ transform: "rotate(-45deg)", mb: 0.5 }}
        />
      </IconButton>
    </Box>
  );
};

export default ChatBar;
