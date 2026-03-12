import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  Divider,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { fetchAuthSession } from "aws-amplify/auth";
import { useRoleLabels, type RoleLabels } from "../../contexts/RoleLabelsContext";

const ROLE_KEYS = ["student", "instructor", "admin"] as const;
type RoleKey = (typeof ROLE_KEYS)[number];

const DEFAULT_DISPLAY: Record<RoleKey, string> = {
  student:    "student",
  instructor: "instructor",
  admin:      "admin",
};

const RoleLabelsConfig = () => {
  const { rawLabels, refreshLabels } = useRoleLabels();

  const [draft, setDraft] = useState<RoleLabels>({ ...rawLabels });
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  // Sync draft when context labels load/refresh
  useEffect(() => {
    setDraft({ ...rawLabels });
  }, [rawLabels]);

  const handleChange = (
    role: RoleKey,
    field: "singular" | "plural",
    value: string,
  ) => {
    setDraft((prev) => ({
      ...prev,
      [role]: { ...prev[role], [field]: value },
    }));
  };

  const handleSave = async () => {
    // Basic client-side validation
    for (const key of ROLE_KEYS) {
      const entry = draft[key];
      if (!entry?.singular?.trim() || !entry?.plural?.trim()) {
        setSnackbar({
          open: true,
          message: `Singular and plural labels are required for "${key}".`,
          severity: "error",
        });
        return;
      }
      if (entry.singular.length > 64 || entry.plural.length > 64) {
        setSnackbar({
          open: true,
          message: `Labels for "${key}" must be 64 characters or fewer.`,
          severity: "error",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No auth token");

      const body: Record<RoleKey, { singular: string; plural: string }> = {
        student:    { singular: draft.student.singular.trim(),    plural: draft.student.plural.trim()    },
        instructor: { singular: draft.instructor.singular.trim(), plural: draft.instructor.plural.trim() },
        admin:      { singular: draft.admin.singular.trim(),      plural: draft.admin.plural.trim()      },
      };

      const res = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/role_labels`,
        {
          method: "PUT",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Save failed");
      }

      await refreshLabels();
      setSnackbar({ open: true, message: "Role labels saved.", severity: "success" });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : "Failed to save labels.",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ textAlign: "left" }}>
      <Typography variant="h6" sx={{ mb: 1, color: "var(--text)" }}>
        Role Display Labels
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: "var(--text-secondary)" }}>
        Customise the singular and plural display names for each user role.
        Canonical role keys (student / instructor / admin) are preserved
        internally and are not affected by these labels.
      </Typography>

      {ROLE_KEYS.map((key, idx) => (
        <Box key={key}>
          {idx > 0 && <Divider sx={{ my: 3, borderColor: "var(--border)" }} />}
          <Typography
            variant="subtitle2"
            sx={{ mb: 2, color: "var(--text)", textTransform: "capitalize" }}
          >
            {DEFAULT_DISPLAY[key]}
          </Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <TextField
              label="Singular label"
              value={draft[key]?.singular ?? ""}
              onChange={(e) => handleChange(key, "singular", e.target.value)}
              inputProps={{ maxLength: 64 }}
              size="small"
              sx={{
                minWidth: 200,
                "& .MuiOutlinedInput-root": {
                  color: "var(--text)",
                  backgroundColor: "var(--background)",
                  "& fieldset": { borderColor: "var(--border)" },
                },
                "& .MuiInputLabel-root": { color: "var(--text-secondary)" },
              }}
            />
            <TextField
              label="Plural label"
              value={draft[key]?.plural ?? ""}
              onChange={(e) => handleChange(key, "plural", e.target.value)}
              inputProps={{ maxLength: 64 }}
              size="small"
              sx={{
                minWidth: 200,
                "& .MuiOutlinedInput-root": {
                  color: "var(--text)",
                  backgroundColor: "var(--background)",
                  "& fieldset": { borderColor: "var(--border)" },
                },
                "& .MuiInputLabel-root": { color: "var(--text-secondary)" },
              }}
            />
          </Box>
        </Box>
      ))}

      <Box sx={{ mt: 4 }}>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{
            backgroundColor: "var(--primary)",
            "&:hover": { backgroundColor: "var(--primary-dark, var(--primary))" },
          }}
        >
          {saving ? "Saving…" : "Save Labels"}
        </Button>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RoleLabelsConfig;
