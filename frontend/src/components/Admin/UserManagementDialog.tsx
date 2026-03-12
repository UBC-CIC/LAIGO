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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
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

const UserManagementDialog: React.FC<UserManagementDialogProps> = ({
  open,
  onClose,
  onSuccess,
  user,
}) => {
  const { singular } = useRoleLabels();
  // Role management state
  const [role, setRole] = useState("student");
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleSuccess, setRoleSuccess] = useState<boolean>(false);

  // Student assignment state
  const [assignedStudents, setAssignedStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentEmailInput, setStudentEmailInput] = useState("");
  const [assignmentActionLoading, setAssignmentActionLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  const isInstructor = user && user.roles.includes("instructor");

  useEffect(() => {
    if (open && user) {
      // Determine primary role for display
      const primaryRole = user.roles.includes("admin")
        ? "admin"
        : user.roles.includes("instructor")
          ? "instructor"
          : "student";

      setRole(primaryRole);
      setRoleError(null);
      setRoleSuccess(false);
      setAssignmentError(null);
      setStudentEmailInput("");

      if (isInstructor) {
        fetchAssignedStudents();
      }
    }
  }, [open, user]);

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
      setAssignedStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!user) return;
    setRoleLoading(true);
    setRoleError(null);
    setRoleSuccess(false);

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
            new_role: role,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update role");
      }

      setRoleSuccess(true);
      onSuccess(); // Refresh user list in dashboard
    } catch (err) {
      console.error("Error updating role:", err);
      setRoleError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setRoleLoading(false);
    }
  };

  const handleAssignStudent = async () => {
    if (!user || !studentEmailInput.trim()) return;

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

    if (!window.confirm("Are you sure you want to remove this assignment?"))
      return;

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
      <DialogTitle
        component="div"
        sx={{ borderBottom: "1px solid var(--border)", pb: 1 }}
      >
        <Typography variant="h6">
          Manage User: {user.first_name} {user.last_name}
        </Typography>
        <Typography variant="body2" sx={{ color: "var(--text-secondary)" }}>
          {user.user_email}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {/* Role Section */}
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="subtitle1"
            gutterBottom
            sx={{ fontWeight: "bold" }}
          >
            Role Management
          </Typography>

          {roleError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {roleError}
            </Alert>
          )}
          {roleSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Role updated successfully.
            </Alert>
          )}

          <Box display="flex" gap={2} alignItems="center">
            <FormControl fullWidth size="small">
              <InputLabel
                id="role-select-label"
                sx={{ color: "var(--text-secondary)" }}
              >
                Role
              </InputLabel>
              <Select
                labelId="role-select-label"
                value={role}
                label="Role"
                onChange={(e) => setRole(e.target.value)}
                sx={{
                  color: "var(--text)",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--border)",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--text-secondary)",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--primary)",
                  },
                }}
              >
                <MenuItem value="admin">{singular("admin")}</MenuItem>
                <MenuItem value="instructor">{singular("instructor")}</MenuItem>
                <MenuItem value="student">{singular("student")}</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              onClick={handleUpdateRole}
              disabled={
                roleLoading ||
                role ===
                  (user.roles.includes("admin")
                    ? "admin"
                    : user.roles.includes("instructor")
                      ? "instructor"
                      : "student")
              }
              sx={{
                width: 100,
                whiteSpace: "nowrap",
                backgroundColor: "var(--primary)",
                color: "var(--text)",
                "&:hover": { backgroundColor: "var(--primary)", opacity: 0.9 },
                "&.Mui-disabled": {
                  backgroundColor: "var(--border)",
                  color: "var(--text-secondary)",
                },
              }}
            >
              {roleLoading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                "Update"
              )}
            </Button>
          </Box>
        </Box>

        {/* Students Section - Only for instructors */}
        {isInstructor && (
          <>
            <Divider sx={{ my: 3, borderColor: "var(--border)" }} />
            <Box>
              <Typography
                variant="subtitle1"
                gutterBottom
                sx={{ fontWeight: "bold" }}
              >
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
                      "&:hover fieldset": {
                        borderColor: "var(--text-secondary)",
                      },
                    },
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleAssignStudent}
                  disabled={
                    assignmentActionLoading || !studentEmailInput.trim()
                  }
                  sx={{
                    width: 100,
                    whiteSpace: "nowrap",
                    backgroundColor: "var(--primary)",
                    color: "var(--text)",
                    "&:hover": {
                      backgroundColor: "var(--primary)",
                      opacity: 0.9,
                    },
                  }}
                >
                  {assignmentActionLoading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    "Assign"
                  )}
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
