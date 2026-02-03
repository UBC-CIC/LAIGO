import React, { useState } from "react";
import {
  Menu,
  MenuItem,
  Typography,
  Box,
  CircularProgress,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  MoreVert as MoreVertIcon,
  MarkEmailRead as MarkReadIcon,
  MarkEmailUnread as MarkUnreadIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
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
  onMarkAsRead: () => void;
  onMarkAsUnread: () => void;
  onDelete: () => void;
}> = ({ notification, onClick, onMarkAsRead, onMarkAsUnread, onDelete }) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleMarkToggle = () => {
    if (notification.isRead) {
      onMarkAsUnread();
    } else {
      onMarkAsRead();
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    onDelete();
    handleMenuClose();
  };

  return (
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
        position: "relative",
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
          pr: 4, // Make room for the menu icon
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
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          mt: 0.5,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: "var(--text-secondary)",
            fontSize: "0.65rem",
            opacity: 0.7,
          }}
        >
          {formatTimestamp(notification.createdAt)}
        </Typography>
      </Box>
      <IconButton
        size="small"
        onClick={handleMenuOpen}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          opacity: 0,
          transition: "opacity 0.2s",
          ".MuiMenuItem-root:hover &": {
            opacity: 1,
          },
          color: "var(--text-secondary)",
          "&:hover": {
            color: "var(--text)",
            backgroundColor: "rgba(var(--text-rgb), 0.05)",
          },
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          sx: {
            backgroundColor: "var(--header)",
            color: "var(--text)",
            minWidth: "140px",
            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.15)",
          },
        }}
        MenuListProps={{
          dense: true,
          sx: {
            py: 0.5,
          },
        }}
      >
        <MenuItem onClick={handleMarkToggle} sx={{ py: 0.75, px: 1.5 }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            {notification.isRead ? (
              <MarkUnreadIcon
                fontSize="small"
                sx={{ color: "var(--text)", fontSize: "1rem" }}
              />
            ) : (
              <MarkReadIcon
                fontSize="small"
                sx={{ color: "var(--text)", fontSize: "1rem" }}
              />
            )}
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: "0.8rem" }}>
            {notification.isRead ? "Mark as unread" : "Mark as read"}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ py: 0.75, px: 1.5 }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <DeleteIcon
              fontSize="small"
              sx={{ color: "#f44336", fontSize: "1rem" }}
            />
          </ListItemIcon>
          <ListItemText
            sx={{ color: "#f44336" }}
            primaryTypographyProps={{ fontSize: "0.8rem" }}
          >
            Delete
          </ListItemText>
        </MenuItem>
      </Menu>
    </MenuItem>
  );
};

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
    markAsUnread,
    deleteNotification,
  } = useNotifications();

  const navigate = useNavigate();

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.isRead) {
      markAsRead(notification.notificationId);
    }

    // Determine navigation based on notification type
    const caseId = notification.metadata?.caseId;

    if (!caseId) {
      // Fallback if no case ID
      navigate("/student");
      onClose();
      return;
    }

    switch (notification.type) {
      case "feedback":
        navigate(`/case/${caseId}/feedback`);
        break;
      case "summary_complete":
        navigate(`/case/${caseId}/summaries`);
        break;
      case "transcript_complete":
        navigate(`/case/${caseId}/transcriptions`);
        break;
      default:
        navigate(`/case/${caseId}/overview`);
    }

    onClose();
  };

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
        notifications.flatMap((notification, index) => [
          <NotificationItem
            key={notification.notificationId}
            notification={notification}
            onClick={() => handleNotificationClick(notification)}
            onMarkAsRead={() => markAsRead(notification.notificationId)}
            onMarkAsUnread={() => markAsUnread(notification.notificationId)}
            onDelete={() => deleteNotification(notification.notificationId)}
          />,
          ...(index < notifications.length - 1
            ? [
                <Divider
                  key={`divider-${notification.notificationId}`}
                  sx={{ borderColor: "rgba(var(--text-rgb), 0.1)" }}
                />,
              ]
            : []),
        ])
      )}
    </Menu>
  );
};

export default NotificationDropdown;
