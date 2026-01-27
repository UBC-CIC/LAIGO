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

interface DeleteConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string; // The exact name the user must type to confirm
  title?: string;
  description?: string;
}

const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  open,
  onClose,
  onConfirm,
  itemName,
  title = "Delete Item",
  description = "Are you sure you want to delete this item? This action cannot be undone.",
}) => {
  const [confirmText, setConfirmText] = useState("");

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  const handleConfirm = () => {
    if (confirmText === itemName) {
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
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: "bold" }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: "var(--text-secondary)" }}>
          {description}
        </DialogContentText>
        <DialogContentText sx={{ mt: 2, color: "var(--text)" }}>
          Please type <strong>{itemName}</strong> to confirm.
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
        <Button onClick={handleClose} sx={{ color: "var(--text-secondary)" }}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="error"
          disabled={confirmText !== itemName}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteConfirmationDialog;
