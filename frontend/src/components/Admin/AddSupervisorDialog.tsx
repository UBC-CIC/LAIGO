import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";

interface AddSupervisorDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddSupervisorDialog: React.FC<AddSupervisorDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleClose = () => {
    setEmail("");
    setError(null);
    setSuccessMessage(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("Please enter an email address.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { fetchAuthSession } = await import("aws-amplify/auth");
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (!token) throw new Error("No auth token");

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/elevate_instructor?email=${encodeURIComponent(email.trim())}`,
        {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json();

      if (response.status === 404) {
        setError(data.error || "User not found.");
      } else if (response.status === 500) {
        setError(data.error || "An error occurred.");
      } else if (response.ok) {
        if (data.alreadyInstructor) {
          setSuccessMessage(
            data.message || "This user already has supervisor permissions.",
          );
        } else if (data.success) {
          setSuccessMessage(
            data.message || "User successfully elevated to supervisor.",
          );
          onSuccess();
        } else {
          setSuccessMessage(data.message || "Operation completed.");
        }
      } else {
        setError(data.error || "An unexpected error occurred.");
      }
    } catch (err) {
      console.error("Error elevating instructor:", err);
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
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
          minWidth: 400,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: "bold" }}>Add Supervisor</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: "var(--text-secondary)", mb: 2 }}>
          Enter the email address of an existing user to grant them supervisor
          permissions.
        </DialogContentText>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successMessage}
          </Alert>
        )}

        <TextField
          autoFocus
          margin="dense"
          label="Email Address"
          type="email"
          fullWidth
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading || !!successMessage}
          variant="outlined"
          sx={{
            "& .MuiOutlinedInput-root": {
              color: "var(--text)",
              backgroundColor: "var(--background)",
              "& fieldset": { borderColor: "var(--border)" },
              "&:hover fieldset": { borderColor: "var(--text-secondary)" },
              "&.Mui-focused fieldset": { borderColor: "var(--primary)" },
            },
            "& .MuiInputLabel-root": {
              color: "var(--text-secondary)",
            },
            "& .MuiInputLabel-root.Mui-focused": {
              color: "var(--primary)",
            },
          }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} sx={{ color: "var(--text-secondary)" }}>
          {successMessage ? "Close" : "Cancel"}
        </Button>
        {!successMessage && (
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || !email.trim()}
            sx={{
              backgroundColor: "#90caf9",
              color: "#000",
              "&:hover": { backgroundColor: "#42a5f5" },
              "&:disabled": { backgroundColor: "#4a4a4a" },
            }}
          >
            {loading ? <CircularProgress size={20} /> : "Add"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AddSupervisorDialog;
