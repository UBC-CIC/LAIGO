import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";

interface DisclaimerModalProps {
  open: boolean;
  disclaimerText: string;
  onAccept: () => void;
  onDecline: () => void; // Could lead to logout
}

const DisclaimerModal: React.FC<DisclaimerModalProps> = ({
  open,
  disclaimerText,
  onAccept,
  onDecline,
}) => {
  return (
    <Dialog
      open={open}
      disableEscapeKeyDown
      // Prevent closing by clicking outside
      onClose={() => {
        // Prevent closing by clicking outside
      }}
      aria-labelledby="disclaimer-dialog-title"
      aria-describedby="disclaimer-dialog-description"
      PaperProps={{
        sx: {
          backgroundColor: "var(--background)",
          border: "1px solid var(--border)",
          borderRadius: 2,
          minWidth: "300px",
          maxWidth: "600px",
        },
      }}
    >
      <DialogTitle
        id="disclaimer-dialog-title"
        sx={{
          backgroundColor: "var(--header)",
          color: "var(--text)",
          borderBottom: "1px solid var(--border)",
          fontWeight: "bold",
        }}
      >
        Terms of Service & Disclaimer
      </DialogTitle>
      <DialogContent
        sx={{
          mt: 2,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <DialogContentText
          id="disclaimer-dialog-description"
          component="div"
          sx={{
            color: "var(--text)",
            whiteSpace: "pre-wrap",
            maxHeight: "60vh",
            overflowY: "auto",
            p: 2,
            backgroundColor: "var(--background)",
            borderRadius: 1,
            border: "1px solid var(--border)",
            fontFamily: "var(--font-family)",
          }}
        >
          {disclaimerText ? (
            <Typography variant="body1">{disclaimerText}</Typography>
          ) : (
            <Typography variant="body2" color="error">
              Unable to load disclaimer text.
            </Typography>
          )}
        </DialogContentText>
      </DialogContent>
      <DialogActions
        sx={{
          p: 2,
          borderTop: "1px solid var(--border)",
          backgroundColor: "var(--header)",
        }}
      >
        <Button
          onClick={onDecline}
          sx={{
            color: "var(--text-secondary)",
            "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.05)" },
          }}
        >
          Decline & Logout
        </Button>
        <Button
          onClick={onAccept}
          variant="contained"
          sx={{
            backgroundColor: "var(--primary)",
            color: "var(--text)",
            fontWeight: "bold",
            "&:hover": {
              backgroundColor: "var(--primary)",
              opacity: 0.9,
            },
          }}
        >
          I Agree
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DisclaimerModal;
