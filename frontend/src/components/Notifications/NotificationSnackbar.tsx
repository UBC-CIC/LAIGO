import React from "react";
import { Snackbar, Paper, Box, Typography } from "@mui/material";
import type { Notification } from "../../types/notification";

interface NotificationSnackbarProps {
  notification: Notification | null;
  open: boolean;
  onClose: () => void;
  onClick: () => void;
}

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const NotificationSnackbar: React.FC<NotificationSnackbarProps> = ({
  notification,
  open,
  onClose,
  onClick,
}) => {
  return (
    <Snackbar
      open={open}
      onClose={(_, reason) => {
        if (reason === "clickaway") return;
        onClose();
      }}
      autoHideDuration={6000}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      sx={{
        "& .MuiSnackbarContent-root": {
          p: 0,
          background: "transparent",
          boxShadow: "none",
        },
      }}
    >
      <Paper
        elevation={6}
        onClick={onClick}
        sx={{
          width: 360,
          maxWidth: "calc(100vw - 32px)",
          borderRadius: "10px",
          backgroundColor: "var(--header)",
          borderLeft: "3px solid var(--primary)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
          overflow: "hidden",
          cursor: "pointer",
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            backgroundColor: "rgba(var(--primary-rgb), 0.08)",
            textAlign: "left",
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: "var(--text)",
              fontSize: "0.85rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              textAlign: "left",
            }}
          >
            {notification?.title}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "var(--text-secondary)",
              fontSize: "0.75rem",
              mt: 0.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "normal",
              wordBreak: "break-word",
              textAlign: "left",
            }}
          >
            {notification?.message}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: "var(--text-secondary)",
              fontSize: "0.65rem",
              opacity: 0.7,
              mt: 0.75,
              display: "block",
              textAlign: "left",
            }}
          >
            {notification ? formatTimestamp(notification.createdAt) : ""}
          </Typography>
        </Box>
      </Paper>
    </Snackbar>
  );
};

export default NotificationSnackbar;
