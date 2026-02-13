import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

interface Student {
  user_id: string;
  first_name: string;
  last_name: string;
  user_email: string;
}

interface Supervisor {
  user_id: string;
  first_name: string;
  last_name: string;
  user_email: string;
}

interface SupervisorDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  supervisor: Supervisor | null;
}

const SupervisorDetailsDialog: React.FC<SupervisorDetailsDialogProps> = ({
  open,
  onClose,
  supervisor,
}) => {
  const [assignedStudents, setAssignedStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open && supervisor) {
      fetchAssignedStudents();
      setEmailInput("");
      setError(null);
      setSuccessMessage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supervisor]);

  const fetchAssignedStudents = async () => {
    if (!supervisor) return;
    setLoading(true);
    try {
      const { fetchAuthSession } = await import("aws-amplify/auth");
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (!token) throw new Error("No auth token");

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/instructorStudents?instructor_id=${supervisor.user_id}`,
        {
          headers: {
            Authorization: token,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch assigned students");
      }

      const data = await response.json();
      setAssignedStudents(data);
    } catch (err) {
      console.error("Error fetching students:", err);
      // If list is empty or fails, we assume empty or show error
      setAssignedStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async () => {
    if (!supervisor || !emailInput.trim()) return;

    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { fetchAuthSession } = await import("aws-amplify/auth");
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/assign_instructor_to_student`,
        {
          method: "POST",
          headers: {
            Authorization: token || "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            instructor_id: supervisor.user_id,
            student_email: emailInput.trim(),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to assign student");
      }

      setSuccessMessage("Student assigned successfully.");
      setEmailInput("");
      fetchAssignedStudents(); // Refresh list
    } catch (err) {
      console.error("Error adding student:", err);
      setError(err instanceof Error ? err.message : "Failed to add student.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!supervisor) return;

    const confirm = window.confirm(
      "Are you sure you want to remove this student?",
    );
    if (!confirm) return;

    setActionLoading(true); // crude blocking
    setError(null);

    try {
      const { fetchAuthSession } = await import("aws-amplify/auth");
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/assign_instructor_to_student?instructor_id=${supervisor.user_id}&student_id=${studentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: token || "",
          },
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove student");
      }

      setSuccessMessage("Student removed successfully.");
      fetchAssignedStudents();
    } catch (err) {
      console.error("Error removing student:", err);
      setError(
        err instanceof Error ? err.message : "Failed to remove student.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (!supervisor) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          backgroundColor: "var(--background)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          minWidth: 500,
          maxWidth: 600,
        },
      }}
    >
      <DialogTitle sx={{ borderBottom: "1px solid var(--border)", pb: 2 }}>
        <Typography variant="h6" component="div">
          {supervisor.first_name} {supervisor.last_name}
        </Typography>
        <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
          {supervisor.user_email}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
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

        <Typography
          variant="subtitle1"
          gutterBottom
          sx={{ color: "var(--text)" }}
        >
          Assigned Students:
        </Typography>

        {loading ? (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <List
            dense
            sx={{
              maxHeight: 200,
              overflowY: "auto",
              backgroundColor: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: 1,
              mb: 3,
            }}
          >
            {assignedStudents.length === 0 ? (
              <ListItem>
                <ListItemText
                  primary="No students assigned."
                  sx={{ color: "var(--text-secondary)" }}
                />
              </ListItem>
            ) : (
              assignedStudents.map((student) => (
                <ListItem
                  key={student.user_id}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => handleRemoveStudent(student.user_id)}
                      disabled={actionLoading}
                      sx={{
                        color: "var(--text-secondary)",
                        "&:hover": { color: "#ff5252" },
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                  sx={{ borderBottom: "1px solid var(--border)" }}
                >
                  <ListItemText
                    primary={`${student.first_name} ${student.last_name}`}
                    secondary={student.user_email}
                    slotProps={{
                      primary: { color: "var(--text)" },
                      secondary: { color: "var(--text-secondary)" },
                    }}
                  />
                </ListItem>
              ))
            )}
          </List>
        )}

        <Box display="flex" gap={1} alignItems="center">
          <TextField
            fullWidth
            size="small"
            placeholder="Add Student (Enter Email)"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            disabled={actionLoading}
            sx={{
              "& .MuiOutlinedInput-root": {
                color: "var(--text)",
                backgroundColor: "var(--background)",
                "& fieldset": { borderColor: "var(--border)" },
                "&:hover fieldset": { borderColor: "var(--text-secondary)" },
                "&.Mui-focused fieldset": { borderColor: "var(--primary)" },
              },
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: "1px solid var(--border)" }}>
        <Button onClick={onClose} sx={{ color: "var(--text-secondary)" }}>
          Cancel
        </Button>
        <Button
          onClick={handleAddStudent}
          disabled={!emailInput.trim() || actionLoading}
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
          {actionLoading ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            "Assign Student"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SupervisorDetailsDialog;
