import React from "react";
import { Box, Typography, Button, IconButton, Stack } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";

interface AiResponseProps {
  message: string;
}

const AiResponse: React.FC<AiResponseProps> = ({ message }) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        color: "var(--text)",
        maxWidth: "90%",
      }}
    >
      <Typography
        variant="body2"
        sx={{ textAlign: "left", whiteSpace: "pre-wrap" }}
      >
        {message}
      </Typography>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
        <IconButton size="small" sx={{ color: "var(--text-secondary)" }}>
          <ContentCopyIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" sx={{ color: "var(--text-secondary)" }}>
          <VolumeUpIcon fontSize="small" />
        </IconButton>
        <Button
          variant="outlined"
          size="small"
          sx={{
            color: "var(--text-secondary)",
            borderColor: "var(--border)",
            textTransform: "none",
            fontSize: "0.7rem",
            borderRadius: 1,
            px: 1.5,
            py: 0.5,
            "&:hover": {
              borderColor: "var(--text-secondary)",
              backgroundColor: "rgba(255,255,255,0.05)",
            },
          }}
        >
          GENERATE SUMMARY
        </Button>
      </Stack>
    </Box>
  );
};

export default AiResponse;
