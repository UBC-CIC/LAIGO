import React, { useState } from "react";
import { Stack, Typography, Badge } from "@mui/material";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import { useNotifications } from "../../contexts/NotificationContext";
import NotificationDropdown from "./NotificationDropdown";

const iconStyle = { color: "var(--text-secondary)", fontSize: "1.5rem" };
const labelStyle = {
  color: "var(--text-secondary)",
  fontSize: "0.7rem",
  marginTop: "4px",
};

const NotificationButton: React.FC = () => {
  const { unreadCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setAnchorEl(null);
  };

  return (
    <>
      <Stack
        alignItems="center"
        onClick={handleClick}
        sx={{
          cursor: "pointer",
          mx: 2,
          p: 1,
          borderRadius: 1,
          transition: "color 0.2s ease",
          "& svg": { transition: "color 0.2s ease" },
          "&:hover": {
            "& svg": { color: "var(--text-secondary)" },
            "& .header-label": { color: "var(--text-secondary)" },
          },
        }}
      >
        <Badge
          badgeContent={unreadCount}
          color="error"
          max={99}
          sx={{
            "& .MuiBadge-badge": {
              fontSize: "0.65rem",
              minWidth: "16px",
              height: "16px",
            },
          }}
        >
          <NotificationsNoneOutlinedIcon sx={iconStyle} />
        </Badge>
        <Typography variant="caption" className="header-label" sx={labelStyle}>
          Notifications
        </Typography>
      </Stack>

      <NotificationDropdown
        open={isOpen}
        anchorEl={anchorEl}
        onClose={handleClose}
      />
    </>
  );
};

export default NotificationButton;
