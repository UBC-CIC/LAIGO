import React from "react";
import {
  Menu,
  MenuItem,
  Typography,
  Box,
  CircularProgress,
  Divider,
} from "@mui/material";
import { useNotifications } from "../../contexts/NotificationContext";
import type { Notification } from "../../types/notification";

interface NotificationDropdownProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
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

const NotificationItem: React.FC<{
  notification: Notification;
  onClick: () => void;
}> = ({ notification, onClick }) => (
  <MenuItem
    onClick={onClick}
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      py: 1.5,
      px: 2,
      maxWidth: "100%",
      overflow: "hidden",
      backgroundColor: notification.isRead
        ? "inherit"
        : "rgba(var(--primary-rgb), 0.08)",
      "&:hover": {
        backgroundColor: "rgba(var(--primary-rgb), 0.12)",
      },
      borderLeft: notification.isRead ? "none" : "3px solid var(--primary)",
    }}
  >
    <Typography
      variant="subtitle2"
      sx={{
        fontWeight: notification.isRead ? 400 : 600,
        color: "var(--text)",
        fontSize: "0.85rem",
        width: "100%",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {notification.title}
    </Typography>
    <Typography
      variant="body2"
      sx={{
        color: "var(--text-secondary)",
        fontSize: "0.75rem",
        mt: 0.5,
        width: "100%",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "normal",
        wordBreak: "break-word",
      }}
    >
      {notification.message}
    </Typography>
    <Typography
      variant="caption"
      sx={{
        color: "var(--text-secondary)",
        fontSize: "0.65rem",
        mt: 0.5,
        opacity: 0.7,
      }}
    >
      {formatTimestamp(notification.createdAt)}
    </Typography>
  </MenuItem>
);

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  open,
  anchorEl,
  onClose,
}) => {
  const {
    notifications,
    isLoading,
    error,
    isConnected,
    unreadCount,
    markAllAsRead,
    markAsRead,
  } = useNotifications();

  return (
    <Menu
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      transformOrigin={{ vertical: "top", horizontal: "center" }}
      PaperProps={{
        sx: {
          backgroundColor: "var(--header)",
          color: "var(--text)",
          minWidth: "320px",
          maxWidth: "400px",
          maxHeight: "450px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
          borderRadius: "12px",
          overflow: "hidden", // Let MenuList handle scrolling
          display: "flex",
          flexDirection: "column",
        },
      }}
      MenuListProps={{
        sx: {
          padding: 0,
          overflowY: "auto",
          flexGrow: 1,
          maxHeight: "380px", // Reserve space for header
          "&::-webkit-scrollbar": {
            width: "6px",
          },
          "&::-webkit-scrollbar-track": {
            backgroundColor: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "rgba(var(--text-rgb), 0.2)",
            borderRadius: "10px",
            "&:hover": {
              backgroundColor: "rgba(var(--text-rgb), 0.3)",
            },
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(var(--text-rgb), 0.1)",
          backgroundColor: "var(--header)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 600, color: "var(--text)", flexGrow: 1 }}
        >
          Notifications
        </Typography>
        {unreadCount > 0 && (
          <Typography
            variant="body2"
            onClick={markAllAsRead}
            sx={{
              color: "var(--primary)",
              fontSize: "0.75rem",
              cursor: "pointer",
              fontWeight: 500,
              mr: 1,
              "&:hover": {
                textDecoration: "underline",
              },
            }}
          >
            Mark all as read
          </Typography>
        )}
        {isConnected && (
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#4caf50",
            }}
            title="Connected"
          />
        )}
      </Box>

      {/* Content */}
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : error ? (
        <Box sx={{ px: 2, py: 3, textAlign: "center" }}>
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        </Box>
      ) : notifications.length === 0 ? (
        <Box sx={{ px: 2, py: 4, textAlign: "center" }}>
          <Typography
            variant="body2"
            sx={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}
          >
            No notifications yet
          </Typography>
        </Box>
      ) : (
        notifications.map((notification, index) => (
          <React.Fragment key={notification.notificationId}>
            <NotificationItem
              notification={notification}
              onClick={() => markAsRead(notification.notificationId)}
            />
            {index < notifications.length - 1 && (
              <Divider sx={{ borderColor: "rgba(var(--text-rgb), 0.1)" }} />
            )}
          </React.Fragment>
        ))
      )}
    </Menu>
  );
};

export default NotificationDropdown;
