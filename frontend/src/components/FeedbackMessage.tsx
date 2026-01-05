import React from "react";
import { Box, Typography } from "@mui/material";

export interface FeedbackMessageProps {
  sender: string;
  timestamp: string;
  content: string;
}

const FeedbackMessage: React.FC<FeedbackMessageProps> = ({
  sender,
  timestamp,
  content,
}) => {
  return (
    <Box
      sx={{
        border: "1px solid rgba(255, 255, 255, 0.2)",
        borderRadius: 1,
        mb: 2,
        overflow: "hidden",
      }}
    >
      {/* Header Section: Matches SideMenu/Header color */}
      <Box
        sx={{
          bgcolor: "var(--header)",
          p: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <Typography
          variant="subtitle1"
          fontWeight="bold"
          fontFamily="Outfit"
          color="var(--header-text)"
        >
          {sender}
        </Typography>
        <Typography
          variant="caption"
          color="var(--text-secondary)"
          fontFamily="Outfit"
        >
          {timestamp}
        </Typography>
      </Box>

      {/* Body Section: Matches Page Background color */}
      <Box
        sx={{
          bgcolor: "var(--background)",
          p: 2,
          textAlign: "left",
        }}
      >
        <Typography
          variant="body2"
          color="var(--text-secondary)"
          sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}
        >
          {content}
        </Typography>
      </Box>
    </Box>
  );
};

export default FeedbackMessage;
