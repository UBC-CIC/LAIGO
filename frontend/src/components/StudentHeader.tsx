import React, { useState } from "react";
import { Box, Typography, Stack, Menu, MenuItem } from "@mui/material";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import { signOut } from 'aws-amplify/auth';

const iconStyle = { color: "var(--header-text)", fontSize: "1.5rem" };
const labelStyle = {
  color: "var(--text-secondary)",
  fontSize: "0.7rem",
  marginTop: "4px",
};

type HeaderItemProps = {
  icon: React.ReactNode;
  label: string;
};

const HeaderItem: React.FC<HeaderItemProps> = ({ icon, label }) => (
  <Stack
    alignItems="center"
    sx={{
      cursor: "pointer",
      mx: 2,
      p: 1,
      borderRadius: 1,
      transition: "color 0.2s ease",
      '& svg': { transition: "color 0.2s ease" },
      '&:hover': {
        '& svg': { color: "var(--text-secondary)" },
        '& .header-label': { color: "var(--text-secondary)" },
      },
    }}
  >
    {icon}
    <Typography variant="caption" className="header-label" sx={labelStyle}>
      {label}
    </Typography>
  </Stack>
);

const StudentHeader: React.FC = () => {
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);

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
      console.error('Error signing out:', error);
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
        />
        <HeaderItem
          icon={<FolderOpenOutlinedIcon sx={iconStyle} />}
          label="All Cases"
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
            '& svg': { transition: "color 0.2s ease" },
            '&:hover': {
              '& svg': { color: "var(--text-secondary)" },
              '& .header-label': { color: "var(--text-secondary)" },
            },
          }}
          onClick={handleProfileClick}
        >
          <AccountCircleOutlinedIcon sx={iconStyle} />
          <Typography variant="caption" className="header-label" sx={labelStyle}>
            Aniket
          </Typography>
        </Stack>
      </Box>

      <Menu
        anchorEl={profileMenuAnchor}
        open={Boolean(profileMenuAnchor)}
        onClose={handleProfileClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        PaperProps={{
          elevation: 0,
          sx: {
            backgroundColor: 'var(--header)',
            color: 'var(--text)',
            boxShadow: 'none',
          }
        }}
      >
        <MenuItem
          onClick={handleSignOut}
          sx={{
            color: 'var(--text)',
            backgroundColor: 'inherit',
            fontSize: '0.7rem',
            fontFamily: "var(--font-family)",
            '&:hover': { color: 'var(--text-secondary)', backgroundColor: 'inherit' },
          }}
        >
          Sign Out
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default StudentHeader;
