import React, { useState } from "react";
import { Stack, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import HelpDialog from "./HelpDialog";

const iconStyle = { color: "var(--text-secondary)", fontSize: "1.5rem" };
const labelStyle = {
  color: "var(--text-secondary)",
  fontSize: "0.7rem",
  marginTop: "4px",
};

const HelpButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Stack
        alignItems="center"
        onClick={() => setIsOpen(true)}
        sx={{
          cursor: "pointer",
          mx: 2,
          p: 1,
          borderRadius: 1,
          transition: "all 0.2s ease",
          "& svg": { transition: "color 0.2s ease" },
          "&:hover": {
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            "& svg": { color: "var(--text)" },
            "& .header-label": { color: "var(--text)" },
          },
        }}
      >
        <InfoOutlinedIcon sx={iconStyle} />
        <Typography variant="caption" className="header-label" sx={labelStyle}>
          Guide
        </Typography>
      </Stack>

      <HelpDialog open={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export default HelpButton;
