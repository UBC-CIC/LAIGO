import React from "react";
import { Box } from "@mui/material";
import { keyframes } from "@mui/system";

const bounce = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
`;

const ThinkingIndicator = () => {
  return (
    <Box sx={{ display: "flex", gap: 0.5, p: 2, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: 8,
            height: 8,
            backgroundColor: "var(--text-secondary)",
            borderRadius: "50%",
            animation: `${bounce} 1.4s infinite ease-in-out both`,
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </Box>
  );
};

export default ThinkingIndicator;
