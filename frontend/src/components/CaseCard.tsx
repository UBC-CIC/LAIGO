import React from "react";
import { Card, CardContent, Typography, Box } from "@mui/material";

interface CaseCardProps {
  caseId: string;
  title: string;
  status: string;
  jurisdiction: string;
  dateAdded: string;
}

const CaseCard: React.FC<CaseCardProps> = ({
  caseId,
  title,
  status,
  jurisdiction,
  dateAdded,
}) => {
  return (
    <Card
      sx={{
        backgroundColor: "var(--background)", // Dark card background
        color: "var(--text)",
        border: "1px solid var(--border)",
        borderRadius: "4px",
        boxShadow: "none",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "flex-start",
        "&:hover": {
          border: "1px solid var(--text-secondary)",
        },
      }}
    >
      <CardContent
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          textAlign: "left",
          width: "100%",
        }}
      >
        <Typography
          variant="caption"
          display="block"
          sx={{ color: "var(--text-secondary)", mb: 1 }}
        >
          Case: #{caseId}
        </Typography>
        <Typography
          variant="h6"
          component="div"
          sx={{
            fontWeight: "bold",
            lineHeight: 1.3,
            mb: 1,
            fontSize: "1.1rem",
          }}
        >
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: status === "In Progress" ? "var(--green-text)" : "#ffa726",
            fontWeight: "bold",
            mb: 2,
          }}
        >
          {status}
        </Typography>

        <Box sx={{ mt: "auto" }}>
          <Typography
            variant="caption"
            display="block"
            sx={{ color: "var(--text)" }}
          >
            <span style={{ fontWeight: "bold" }}>Jurisdiction:</span>{" "}
            {jurisdiction}
          </Typography>
          <Typography
            variant="caption"
            display="block"
            sx={{ color: "var(--text)" }}
          >
            <span style={{ fontWeight: "bold" }}>Date Added:</span> {dateAdded}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default CaseCard;
