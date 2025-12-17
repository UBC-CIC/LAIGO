import React from "react";
import { Box, Typography, Stack } from "@mui/material";
import AddBoxOutlinedIcon from "@mui/icons-material/AddBoxOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";

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
          icon={<AddBoxOutlinedIcon sx={iconStyle} />}
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
        <HeaderItem
          icon={<AccountCircleOutlinedIcon sx={iconStyle} />}
          label="Aniket"
        />
      </Box>
    </Box>
  );
};

export default StudentHeader;
