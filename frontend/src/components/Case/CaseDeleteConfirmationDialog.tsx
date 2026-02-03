import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Button,
} from "@mui/material";

interface CaseDeleteConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  caseTitle: string;
}

const CaseDeleteConfirmationDialog: React.FC<
  CaseDeleteConfirmationDialogProps
> = ({ open, onClose, onConfirm, caseTitle }) => {
  const [confirmText, setConfirmText] = useState("");

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  const handleConfirm = () => {
    if (confirmText === caseTitle) {
      onConfirm();
      setConfirmText("");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          backgroundColor: "var(--background)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: "bold", fontFamily: "Outfit" }}>
        Delete Case
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: "var(--text-secondary)", mb: 2 }}>
          Are you sure you want to delete this case? This action cannot be
          undone.
        </DialogContentText>
        <DialogContentText sx={{ mt: 2, color: "var(--text)" }}>
          Please type <strong>{caseTitle}</strong> to confirm.
        </DialogContentText>
        <TextField
          autoFocus
          margin="dense"
          fullWidth
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          onPaste={(e) => e.preventDefault()}
          variant="outlined"
          size="small"
          sx={{
            mt: 2,
            "& .MuiOutlinedInput-root": {
              color: "var(--text)",
              backgroundColor: "var(--background)",
              "& fieldset": { borderColor: "var(--border)" },
              "&:hover fieldset": { borderColor: "var(--text-secondary)" },
              "&.Mui-focused fieldset": { borderColor: "var(--primary)" },
            },
          }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={handleClose}
          sx={{ color: "var(--text-secondary)", textTransform: "none" }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="error"
          disabled={confirmText !== caseTitle}
          sx={{ textTransform: "none", borderRadius: 2 }}
        >
          Delete Case
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CaseDeleteConfirmationDialog;
