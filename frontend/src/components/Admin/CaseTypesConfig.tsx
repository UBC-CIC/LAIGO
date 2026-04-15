import { useState, useEffect, useCallback, type DragEvent } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import SaveIcon from "@mui/icons-material/Save";
import { fetchAuthSession } from "aws-amplify/auth";

const DEFAULT_CASE_TYPES = ["Other"];

const normalizeCaseTypes = (items: string[]) => {
  const cleaned = items.map((item) => item.trim()).filter((item) => item.length > 0);
  const unique: string[] = [];

  for (const item of cleaned) {
    if (!unique.includes(item)) {
      unique.push(item);
    }
  }

  return unique;
};

const validateCaseTypes = (caseTypes: string[]) => {
  if (caseTypes.length === 0) {
    return "Add at least one case type.";
  }
  return null;
};

const reorderCaseTypes = (items: string[], fromIndex: number, toIndex: number) => {
  if (fromIndex === toIndex) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

const CaseTypesConfig = () => {
  const [caseTypes, setCaseTypes] = useState<string[]>(DEFAULT_CASE_TYPES);
  const [newCaseTypeInput, setNewCaseTypeInput] = useState("");
  const [caseTypesError, setCaseTypesError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const fetchCaseTypes = useCallback(async () => {
    setLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No auth token");

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/ai_config`,
        { headers: { Authorization: token } },
      );
      if (!response.ok) throw new Error("Failed to fetch case types");

      const data = await response.json();
      const configuredCaseTypes = Array.isArray(data.case_types)
        ? data.case_types
            .filter((item: unknown): item is string => typeof item === "string")
            .map((item: string) => item.trim())
            .filter((item: string) => item.length > 0)
        : [];

      setCaseTypes(
        normalizeCaseTypes(
          configuredCaseTypes.length > 0 ? configuredCaseTypes : DEFAULT_CASE_TYPES,
        ),
      );
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Failed to load case types.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCaseTypes();
  }, [fetchCaseTypes]);

  useEffect(() => {
    setCaseTypesError(validateCaseTypes(caseTypes));
  }, [caseTypes]);

  const addCaseType = () => {
    const nextValue = newCaseTypeInput.trim();
    if (!nextValue) {
      setCaseTypesError("Enter a case type before adding.");
      return;
    }

    if (caseTypes.some((item) => item.toLowerCase() === nextValue.toLowerCase())) {
      setCaseTypesError("That case type already exists.");
      return;
    }

    setCaseTypes((prev) => [...prev, nextValue]);
    setNewCaseTypeInput("");
    setCaseTypesError(null);
  };

  const removeCaseType = (caseTypeToRemove: string) => {
    setCaseTypes((prev) => prev.filter((item) => item !== caseTypeToRemove));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
    setDragOverIndex(index);
  };

  const handleDragOver = (event: DragEvent, index: number) => {
    event.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null) {
      return;
    }
    setCaseTypes((prev) => reorderCaseTypes(prev, draggedIndex, index));
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const saveCaseTypes = async () => {
    const validationError = validateCaseTypes(caseTypes);
    if (validationError) {
      setCaseTypesError(validationError);
      return;
    }

    setSaving(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) throw new Error("No auth token");

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/admin/ai_config`,
        {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ case_types: caseTypes }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to save case types");
      }

      setSnackbar({
        open: true,
        message: "Case types saved successfully.",
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Failed to save case types.",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ textAlign: "left" }}>
      <Typography variant="h6" sx={{ mb: 1, color: "var(--text)" }}>
        Case Types
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: "var(--text-secondary)" }}>
        Manage allowed case types used in case creation and validation.
      </Typography>

      <Typography variant="caption" sx={{ display: "block", mb: 2, color: "var(--text-secondary)" }}>
        Drag rows by the handle to reorder how case types appear to users.
      </Typography>

      <Divider sx={{ mb: 3, borderColor: "var(--border)" }} />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", mb: 2 }}>
            <TextField
              label="Add New Case Type"
              value={newCaseTypeInput}
              onChange={(e) => setNewCaseTypeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCaseType();
                }
              }}
              fullWidth
              error={!!caseTypesError}
              helperText={
                caseTypesError || "Click Add or press Enter to append a case type."
              }
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": {
                  color: "var(--text)",
                  backgroundColor: "var(--background)",
                  "& fieldset": { borderColor: "var(--border)" },
                },
                "& .MuiInputLabel-root": {
                  color: "var(--text-secondary)",
                },
                "& .MuiFormHelperText-root:not(.Mui-error)": {
                  color: "var(--text-secondary)",
                },
              }}
            />
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addCaseType}
              sx={{
                minWidth: 100,
                mt: 0.5,
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            >
              Add
            </Button>
          </Box>

          <List
            sx={{
              border: "1px solid var(--border)",
              borderRadius: 1,
              backgroundColor: "var(--background)",
              maxHeight: 280,
              overflowY: "auto",
              py: 0,
              mb: 3,
            }}
          >
            {caseTypes.map((caseType, index) => (
              <ListItem
                key={caseType}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(event) => handleDragOver(event, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                divider={index < caseTypes.length - 1}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label={`Remove ${caseType}`}
                    onClick={() => removeCaseType(caseType)}
                    sx={{ color: "var(--text-secondary)" }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                }
                sx={{
                  cursor: "grab",
                  backgroundColor:
                    dragOverIndex === index && draggedIndex !== index
                      ? "var(--secondary)"
                      : "transparent",
                  opacity: draggedIndex === index ? 0.65 : 1,
                  "& .MuiListItemSecondaryAction-root": {
                    right: 8,
                  },
                }}
              >
                <DragIndicatorIcon
                  sx={{
                    color: "var(--text-secondary)",
                    mr: 1,
                  }}
                />
                <ListItemText
                  primary={caseType}
                  primaryTypographyProps={{
                    sx: { color: "var(--text)", textAlign: "left", pr: 6 },
                  }}
                />
              </ListItem>
            ))}
          </List>

          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={saveCaseTypes}
            disabled={saving || !!caseTypesError}
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
            {saving ? "Saving..." : "Save Case Types"}
          </Button>
        </>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CaseTypesConfig;
