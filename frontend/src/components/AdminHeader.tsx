import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Stack, Menu, MenuItem } from "@mui/material";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import { signOut } from "aws-amplify/auth";
import { useUser } from "../contexts/UserContext";
import { useRoleLabels } from "../contexts/RoleLabelsContext";

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
      ...(onClick ? {} : { pointerEvents: "none" }),
    }}
  >
    {icon}
    <Typography variant="caption" className="header-label" sx={labelStyle}>
      {label}
    </Typography>
  </Stack>
);

const AdminHeader: React.FC = () => {
  const navigate = useNavigate();
  const { userInfo, setActivePerspective, availablePerspectives } = useUser();
  const { plural, singular } = useRoleLabels();
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
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "flex-end", // Aligns items to the right as per StudentHeader
        alignItems: "center",
        padding: "1rem 2rem",
        backgroundColor: "var(--header)",
        height: "80px",
      }}
    >
      <Box sx={{ display: "flex" }}>
        <HeaderItem
          icon={<PeopleAltOutlinedIcon sx={iconStyle} />}
          label={"Users"}
          onClick={() => navigate("/")}
        />
        <HeaderItem
          icon={<SettingsOutlinedIcon sx={iconStyle} />}
          label="Settings"
          onClick={() => navigate("/ai-configuration")}
        />
        <HeaderItem
          icon={<DescriptionOutlinedIcon sx={iconStyle} />}
          label="Disclaimer"
          onClick={() => navigate("/disclaimer")}
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
        {availablePerspectives
          .filter((p) => p !== "admin")
          .map((p) => (
            <MenuItem
              key={p}
              onClick={() => {
                setActivePerspective(p);
                navigate("/");
                handleProfileClose();
              }}
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
              Switch to {singular(p)}
            </MenuItem>
          ))}
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

export default AdminHeader;
