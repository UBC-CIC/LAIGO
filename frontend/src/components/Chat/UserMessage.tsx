import React from "react";
import { Box, Typography } from "@mui/material";

interface UserMessageProps {
  message: string;
}

const UserMessage: React.FC<UserMessageProps> = ({ message }) => {
  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        justifyContent: "flex-end",
        alignItems: "flex-start",
        width: "100%",
      }}
    >
      <Box
        sx={{
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          color: "var(--text)",
          borderRadius: 2,
          borderTopRightRadius: 0,
          width: "fit-content",
          p: 2,
          maxWidth: "80%",
          border: "1px solid var(--border)",
        }}
      >
        <Typography
          variant="body2"
          sx={{
            display: "inline-block",
            color: "var(--text)",
            textAlign: "left",
            whiteSpace: "pre-wrap",
          }}
        >
          {message}
        </Typography>
      </Box>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          backgroundColor: "var(--accent)",
          flexShrink: 0,
        }}
      />
    </Box>
  );
};

export default UserMessage;
