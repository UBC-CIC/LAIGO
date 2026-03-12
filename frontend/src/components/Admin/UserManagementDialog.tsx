import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useRoleLabels } from "../../contexts/RoleLabelsContext";

interface User {
  user_id: string;
  user_email: string;
  first_name: string;
  last_name: string;
  roles: string[];
}

interface UserManagementDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: User | null;
}

const ROLE_KEYS = ["admin", "instructor", "student"] as const;

type RoleKey = (typeof ROLE_KEYS)[number];

const UserManagementDialog: React.FC<UserManagementDialogProps> = ({
  open,
  onClose,
  onSuccess,
  user,
}) => {
  const { singular } = useRoleLabels();

  const [pendingRoles, setPendingRoles] = useState<string[]>([]);
  const [roleLoading, setRoleLoading] = useState<RoleKey | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleSuccess, setRoleSuccess] = useState<string | null>(null);

  const [assignedStudents, setAssignedStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentEmailInput, setStudentEmailInput] = useState("");
  const [assignmentActionLoading, setAssignmentActionLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  const isInstructor = pendingRoles.includes("instructor");

  const fetchAssignedStudents = async () => {
    if (!user) return;

    setStudentsLoading(true);
    try {
      const { fetchAuthSession } = await import("aws-amplify/auth");
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (!token) throw new Error("No auth token");

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/instructorStudents?instructor_id=${user.user_id}`,
        {
          headers: { Authorization: token },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch assigned students");
      }

      const data = await response.json();
      setAssignedStudents(data);
    } catch (err) {
      console.error("Error fetching students:", err);
      setAssignedStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    if (open && user) {
      setPendingRoles(user.roles ?? []);
      setRoleError(null);
      setRoleSuccess(null);
      setAssignmentError(null);
      setStudentEmailInput("");

      if (user.roles.includes("instructor")) {
        fetchAssignedStudents();
      }
    }
  }, [open, user]);

  const handleToggleRole = async (toggledRole: RoleKey, newChecked: boolean) => {
    if (!user) return;

    if (!newChecked && pendingRoles.length === 1) return;

    setRoleLoading(toggledRole);
    setRoleError(null);
    setRoleSuccess(null);

    try {
      const { fetchAuthSession } = await import("aws-amplify/auth");
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No auth token");

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/user_role`,
        {
          method: "PUT",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: user.user_email,
            operation: newChecked ? "add" : "remove",
            role: toggledRole,
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update role");
      }

      const updatedRoles = newChecked
        ? [...pendingRoles, toggledRole]
        : pendingRoles.filter((r) => r !== toggledRole);
      setPendingRoles(updatedRoles);

      if (newChecked && toggledRole === "instructor") {
        fetchAssignedStudents();
      }

      setRoleSuccess(
        `${singular(toggledRole)} role ${newChecked ? "added" : "removed"}.`,
      );
      onSuccess();
    } catch (err) {
      console.error("Error updating role:", err);
      setRoleError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setRoleLoading(null);
    }
  };

  const handleAssignStudent = async () => {
    if (!user || !studentEmailInput.trim()) return;

    if (studentEmailInput.trim().toLowerCase() === user.user_email.toLowerCase()) {
      setAssignmentError("An instructor cannot be assigned as their own student.");
      return;
    }

    setAssignmentActionLoading(true);
    setAssignmentError(null);

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
            instructor_id: user.user_id,
            student_email: studentEmailInput.trim(),
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to assign student");
      }

      setStudentEmailInput("");
      fetchAssignedStudents();
    } catch (err) {
      console.error("Error assigning student:", err);
      setAssignmentError(
        err instanceof Error ? err.message : "Failed to assign student.",
      );
    } finally {
      setAssignmentActionLoading(false);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!user) return;

    if (!window.confirm("Are you sure you want to remove this assignment?")) {
      return;
    }

    setAssignmentActionLoading(true);
    setAssignmentError(null);

    try {
      const { fetchAuthSession } = await import("aws-amplify/auth");
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/assign_instructor_to_student?instructor_id=${user.user_id}&student_id=${studentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: token || "",
          },
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove assignment");
      }

      fetchAssignedStudents();
    } catch (err) {
      console.error("Error removing student:", err);
      setAssignmentError(
        err instanceof Error ? err.message : "Failed to remove assignment.",
      );
    } finally {
      setAssignmentActionLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          backgroundColor: "var(--background)",
          color: "var(--text)",
          border: "1px solid var(--border)",
        },
      }}
    >
      <DialogTitle component="div" sx={{ borderBottom: "1px solid var(--border)", pb: 1 }}>
        <Typography variant="h6">
          Manage User: {user.first_name} {user.last_name}
        </Typography>
        <Typography variant="body2" sx={{ color: "var(--text-secondary)" }}>
          {user.user_email}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: "bold" }}>
            Role Management
          </Typography>

          {roleError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {roleError}
            </Alert>
          )}
          {roleSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {roleSuccess}
            </Alert>
          )}

          <Box display="flex" flexDirection="column" gap={1}>
            {ROLE_KEYS.map((role) => {
              const checked = pendingRoles.includes(role);
              const isLast = checked && pendingRoles.length === 1;
              const inFlight = roleLoading === role;
              return (
                <Box key={role} display="flex" alignItems="center" gap={1}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={checked}
                        disabled={inFlight || isLast}
                        onChange={(e) => handleToggleRole(role, e.target.checked)}
                        sx={{
                          color: "var(--text-secondary)",
                          "&.Mui-checked": { color: "var(--primary)" },
                        }}
                      />
                    }
                    label={<Typography sx={{ color: "var(--text)" }}>{singular(role)}</Typography>}
                  />
                  {inFlight && <CircularProgress size={16} sx={{ color: "var(--primary)" }} />}
                  {isLast && (
                    <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
                      (last role)
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>

        {isInstructor && (
          <>
            <Divider sx={{ my: 3, borderColor: "var(--border)" }} />
            <Box>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: "bold" }}>
                Assigned Students
              </Typography>

              {assignmentError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {assignmentError}
                </Alert>
              )}

              <Box display="flex" gap={2} mb={2}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Student Email"
                  value={studentEmailInput}
                  onChange={(e) => setStudentEmailInput(e.target.value)}
                  disabled={assignmentActionLoading}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      color: "var(--text)",
                      "& fieldset": { borderColor: "var(--border)" },
                      "&:hover fieldset": { borderColor: "var(--text-secondary)" },
                    },
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleAssignStudent}
                  disabled={assignmentActionLoading || !studentEmailInput.trim()}
                  sx={{
                    width: 100,
                    whiteSpace: "nowrap",
                    backgroundColor: "var(--primary)",
                    color: "var(--text)",
                    "&:hover": { backgroundColor: "var(--primary)", opacity: 0.9 },
                  }}
                >
                  {assignmentActionLoading ? <CircularProgress size={20} color="inherit" /> : "Assign"}
                </Button>
              </Box>

              {studentsLoading ? (
                <Box display="flex" justifyContent="center" p={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <List
                  dense
                  sx={{
                    maxHeight: 200,
                    overflowY: "auto",
                    border: "1px solid var(--border)",
                    borderRadius: 1,
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
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
                    assignedStudents.map((s) => (
                      <ListItem
                        key={s.user_id}
                        secondaryAction={
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveStudent(s.user_id)}
                            disabled={assignmentActionLoading}
                            sx={{ color: "#ff5252" }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={`${s.first_name} ${s.last_name}`}
                          secondary={s.user_email}
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
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: "1px solid var(--border)" }}>
        <Button onClick={onClose} sx={{ color: "var(--text-secondary)" }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserManagementDialog;
