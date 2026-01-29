import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Stack, Menu, MenuItem } from "@mui/material";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import { signOut } from "aws-amplify/auth";
import { useUser } from "../contexts/UserContext";

const iconStyle = { color: "var(--text-secondary)", fontSize: "1.5rem" };
const labelStyle = {
  color: "var(--text-secondary)",
  fontSize: "0.7rem",
  marginTop: "4px",
};

type HeaderItemProps = {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
};

const HeaderItem: React.FC<HeaderItemProps> = ({ icon, label, onClick }) => (
  <Stack
    alignItems="center"
    onClick={onClick}
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
      ...(onClick ? {} : { pointerEvents: "none" }), // Optional safety, though cursor pointer suggests interactive
    }}
  >
    {icon}
    <Typography variant="caption" className="header-label" sx={labelStyle}>
      {label}
    </Typography>
  </Stack>
);

const StudentHeader: React.FC = () => {
  const navigate = useNavigate();
  const { userInfo } = useUser();
  const [profileMenuAnchor, setProfileMenuAnchor] =
    useState<null | HTMLElement>(null);

  const handleProfileClick = (event: React.MouseEvent<HTMLElement>) => {
    setProfileMenuAnchor(event.currentTarget);
  };

  const handleProfileClose = () => {
    setProfileMenuAnchor(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      handleProfileClose();
      window.location.href = "/";

      // Optionally, you can add navigation or other logic here
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        padding: "1rem 2rem",
        backgroundColor: "var(--header)",
        height: "80px",
      }}
    >
      <Box sx={{ display: "flex" }}>
        <HeaderItem
          icon={<CreateNewFolderIcon sx={iconStyle} />}
          label="New Case"
          onClick={() => navigate("/create-case")}
        />
        <HeaderItem
          icon={<FolderOpenOutlinedIcon sx={iconStyle} />}
          label="All Cases"
          onClick={() => navigate("/")}
        />
        <HeaderItem
          icon={<NotificationsNoneOutlinedIcon sx={iconStyle} />}
          label="Notifications"
        />
        <Stack
          alignItems="center"
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
          onClick={handleProfileClick}
        >
          <AccountCircleOutlinedIcon sx={iconStyle} />
          <Typography
            variant="caption"
            className="header-label"
            sx={labelStyle}
          >
            {userInfo?.firstName || "User"}
          </Typography>
        </Stack>
      </Box>

      <Menu
        anchorEl={profileMenuAnchor}
        open={Boolean(profileMenuAnchor)}
        onClose={handleProfileClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        PaperProps={{
          elevation: 0,
          sx: {
            backgroundColor: "var(--header)",
            color: "var(--text)",
            boxShadow: "none",
          },
        }}
      >
        <MenuItem
          onClick={handleSignOut}
          sx={{
            color: "var(--text)",
            backgroundColor: "inherit",
            fontSize: "0.7rem",
            fontFamily: "var(--font-family)",
            "&:hover": {
              color: "var(--text-secondary)",
              backgroundColor: "inherit",
            },
          }}
        >
          Sign Out
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default StudentHeader;
