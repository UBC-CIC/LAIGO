import { Box, Typography, IconButton } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

export interface FeedbackMessageProps {
  sender: string;
  timestamp: string;
  content: string;
  onDelete?: () => void;
}

const FeedbackMessage: React.FC<FeedbackMessageProps> = ({
  sender,
  timestamp,
  content,
  onDelete,
}) => {
  return (
    <Box
      sx={{
        border: "1px solid var(--border)",
        borderRadius: 1,
        mb: 2,
        overflow: "hidden",
      }}
    >
      {/* Header Section: Matches SideMenu/Header color */}
      <Box
        sx={{
          bgcolor: "var(--header)",
          p: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          <Typography
            variant="subtitle1"
            fontWeight="bold"
            fontFamily="Outfit"
            color="var(--text-secondary)"
          >
            {sender}
          </Typography>
          <Typography variant="caption" color="var(--text)" fontFamily="Outfit">
            {timestamp}
          </Typography>
        </Box>
        {onDelete && (
          <IconButton
            onClick={onDelete}
            size="small"
            sx={{
              color: "var(--text-secondary)",
              "&:hover": { color: "#f44336" },
            }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Body Section: Matches Page Background color */}
      <Box
        sx={{
          bgcolor: "var(--background)",
          p: 2,
          textAlign: "left",
        }}
      >
        <Typography
          variant="body2"
          color="var(--text)"
          sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}
        >
          {content}
        </Typography>
      </Box>
    </Box>
  );
};

export default FeedbackMessage;
