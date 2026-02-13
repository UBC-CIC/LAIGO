import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  Grid,
  Container,
  Stack,
  Button,
  TextField,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useParams, useOutletContext } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import EditIcon from "@mui/icons-material/Edit";
import EditOffIcon from "@mui/icons-material/EditOff";
import SendIcon from "@mui/icons-material/Send";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import type { CaseOutletContext } from "./CaseLayout";

interface CaseData {
  case_id: string;
  case_hash: string;
  student_id: string;
  case_title: string;
  case_description: string;
  case_type: string;
  jurisdiction: string | string[];
  status: string;
  province: string;
  statute: string;
  time_created: string;
  last_updated: string;
  last_viewed?: string;
  [key: string]: string | string[] | undefined;
}

interface Supervisor {
  instructor_id: string;
  instructor_name: string;
}

interface EditedCase {
  case_title: string;
  case_description: string;
  case_type: string;
  jurisdiction: string;
  status: string;
  province: string;
  statute: string;
}

const CaseOverview: React.FC = () => {
  const { caseId } = useParams();
  const { refreshCaseData } = useOutletContext<CaseOutletContext>();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>([]);
  const [editedCase, setEditedCase] = useState<EditedCase>({
    case_title: "",
    case_description: "",
    case_type: "",
    jurisdiction: "",
    status: "",
    province: "",
    statute: "",
  });

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info" | "warning";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  const handleSnackbarClose = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const toggleSupervisor = (id: string) => {
    setSelectedSupervisors((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSendForReview = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() ?? null;
      if (!token) throw new Error("Authentication required");

      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }/student/review_case?case_id=${caseId}`,
        {
          method: "PUT",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reviewer_ids: selectedSupervisors }),
        },
      );

      if (!response.ok) throw new Error("Failed to send for review");

      setSnackbar({
        open: true,
        message: "Case sent for review successfully!",
        severity: "success",
      });
    } catch (error) {
      console.error("Error sending case for review:", error);
      setSnackbar({
        open: true,
        message: "Failed to send case for review.",
        severity: "error",
      });
    }
  };

  const handleArchive = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() ?? null;
      if (!token) throw new Error("Authentication required");

      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }/student/archive_case?case_id=${caseId}`,
        {
          method: "PUT",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) throw new Error("Failed to archive case");

      setCaseData((prev: CaseData | null) =>
        prev ? { ...prev, status: "archived" } : prev,
      );
      await refreshCaseData();
      setSnackbar({
        open: true,
        message: "Case archived successfully.",
        severity: "success",
      });
    } catch (error) {
      console.error("Error archiving case:", error);
      setSnackbar({
        open: true,
        message: "Failed to archive case.",
        severity: "error",
      });
    }
  };
  const handleUnarchive = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() ?? null;
      if (!token) throw new Error("Authentication required");

      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }/student/unarchive_case?case_id=${caseId}`,
        {
          method: "PUT",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) throw new Error("Failed to unarchive case");

      setCaseData((prev: CaseData | null) =>
        prev ? { ...prev, status: "In Progress" } : prev,
      );
      await refreshCaseData();
      setSnackbar({
        open: true,
        message: "Case successfully unarchived.",
        severity: "success",
      });
    } catch (error) {
      console.error("Error unarchiving case:", error);
      setSnackbar({
        open: true,
        message: "Failed to unarchive case.",
        severity: "error",
      });
    }
  };

  useEffect(() => {
    if (caseData) {
      setEditedCase({
        case_title: caseData.case_title,
        case_type: caseData.case_type,
        case_description: caseData.case_description,
        status: caseData.status,
        jurisdiction: Array.isArray(caseData.jurisdiction)
          ? caseData.jurisdiction.join(", ")
          : caseData.jurisdiction,
        province: caseData.province,
        statute: caseData.statute,
      });
    }
  }, [caseData]);

  useEffect(() => {
    const fetchCaseData = async () => {
      if (!caseId) return;

      const session = await fetchAuthSession();
      if (!session.tokens) {
        throw new Error("Authentication required");
      }
      const token = session.tokens?.idToken?.toString() ?? null;
      if (!token) throw new Error("Authentication required");

      try {
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }/student/case_page?case_id=${caseId}`,
          {
            method: "GET",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) throw new Error("Case not found");
        const data = await response.json();
        const payload = data.caseData ?? data;
        setCaseData(payload);
      } catch (error) {
        console.error("Error fetching case data:", error);
        setCaseData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCaseData();
  }, [caseId]);

  useEffect(() => {
    const fetchSupervisors = async () => {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() ?? null;
      const cognitoId = session.tokens?.idToken?.payload?.sub ?? null;
      if (!token || !cognitoId) {
        console.error("Authentication required");
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/student/instructors`,
        {
          headers: { Authorization: token, "Content-Type": "application/json" },
        },
      );
      if (!res.ok) {
        console.error("Failed to fetch supervisors:", res.statusText);
        return;
      }

      const data = await res.json();
      setSupervisors(data || []);
    };

    fetchSupervisors();
  }, [caseId]);

  const handleSaveEdit = async () => {
    try {
      const session = await fetchAuthSession();
      if (!session.tokens) {
        throw new Error("Authentication required");
      }
      const token = session.tokens?.idToken?.toString() ?? null;
      if (!token) throw new Error("Authentication required");

      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }/student/edit_case?case_id=${encodeURIComponent(caseId ?? "")}`,
        {
          method: "PUT",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(editedCase),
        },
      );

      if (!response.ok) throw new Error("Failed to update case");

      setSnackbar({
        open: true,
        message: "Case edited successfully!",
        severity: "success",
      });
      setCaseData((prev: CaseData | null) =>
        prev ? { ...prev, ...editedCase } : prev,
      );
      setEditMode(false);
    } catch (error) {
      console.error("Error editing case:", error);
      setSnackbar({
        open: true,
        message: "Failed to edit case.",
        severity: "error",
      });
    }
  };

  if (loading) {
    return (
      <Container
        maxWidth="lg"
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "calc(100vh - 80px)",
        }}
      >
        <CircularProgress sx={{ color: "var(--text-secondary)" }} />
      </Container>
    );
  }

  return (
    <>
      <Container
        sx={{
          flexGrow: 1,
          p: 4,
          mx: "auto",
          borderTop: "1px solid var(--border)",
        }}
      >
        {!caseData ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="70vh"
          >
            <Typography variant="h5" color="gray">
              No case data available
            </Typography>
          </Box>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "1em",
                marginBottom: "0.5rem",
              }}
            >
              <h2
                style={{
                  fontFamily: "Outfit",
                  fontSize: "20pt",
                  fontWeight: "600",
                  margin: 0,
                }}
              >
                Case Details
              </h2>

              <div style={{ display: "flex", gap: "1em", flexWrap: "wrap" }}>
                {caseData.status === "archived" ? (
                  <Button
                    startIcon={<UnarchiveIcon />}
                    variant="outlined"
                    color="primary"
                    sx={{
                      fontFamily: "Outfit",
                      textTransform: "none",
                      borderRadius: 5,
                      height: "40px",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                      "&:hover": {
                        backgroundColor: "var(--background2)",
                        borderColor: "var(--primary)",
                      },
                    }}
                    onClick={handleUnarchive}
                  >
                    Unarchive Case
                  </Button>
                ) : (
                  <Button
                    startIcon={<ArchiveIcon />}
                    sx={{
                      textTransform: "none",
                      fontFamily: "Inter",
                      fontWeight: 350,
                      px: 2,
                      color: "#ffffff",
                      width: "fit-content",
                      backgroundColor:
                        caseData.status === "archived"
                          ? "var(--border)"
                          : "var(--secondary)",
                      py: 1,
                      borderRadius: 10,
                      transition: "0.2s ease",
                      boxShadow: "none",
                      "&:hover": {
                        boxShadow: "none",
                        backgroundColor: "var(--primary)",
                      },
                    }}
                    onClick={handleArchive}
                  >
                    Archive Case
                  </Button>
                )}

                <div
                  onClick={() => setEditMode(!editMode)}
                  style={{
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "transform 0.2s ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.transform = "scale(1.05)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.transform = "scale(1)")
                  }
                >
                  {editMode ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        gap: "0.5em",
                        alignItems: "center",
                      }}
                    >
                      <EditOffIcon style={{ fontSize: "25px" }} />
                      <p>Cancel Edit Case</p>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        gap: "0.5em",
                        alignItems: "center",
                      }}
                    >
                      <EditIcon style={{ fontSize: "25px" }} />
                      <p>Edit Case</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Card
              sx={{
                mb: 3,
                textAlign: "left",
                color: "var(--text)",
                backgroundColor: "var(--background)",
                boxShadow: "none",
                border: "1px solid var(--border)",
              }}
            >
              <CardContent>
                {editMode ? (
                  <>
                    <TextField
                      label="Case Title"
                      fullWidth
                      value={editedCase.case_title}
                      onChange={(e) =>
                        setEditedCase({
                          ...editedCase,
                          case_title: e.target.value,
                        })
                      }
                      sx={{
                        mb: 2,
                        "& .MuiInputBase-input": {
                          color: "var(--text)", // input text
                        },
                        "& .MuiInputLabel-root": {
                          color: "var(--text)", // label text
                        },
                        "& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline":
                          {
                            borderColor: "var(--border)", // outline border
                          },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: "var(--border)", // hover border
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                          borderColor: "var(--border)", // focused border
                        },
                      }}
                    />

                    <TextField
                      label="Case Description"
                      fullWidth
                      multiline
                      rows={4}
                      value={editedCase.case_description}
                      onChange={(e) =>
                        setEditedCase({
                          ...editedCase,
                          case_description: e.target.value,
                        })
                      }
                      sx={{
                        "& .MuiInputBase-input": {
                          color: "var(--text)",
                        },
                        "& .MuiInputLabel-root": {
                          color: "var(--text)",
                        },
                        "& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline":
                          {
                            borderColor: "var(--border)",
                          },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: "var(--border)",
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                          borderColor: "var(--border)",
                        },
                      }}
                    />
                    <Button
                      variant="contained"
                      color="success"
                      sx={{
                        mt: 2,
                        boxShadow: "none",
                        borderRadius: "2em",
                        textTransform: "none",
                        fontFamily: "Outfit",
                      }}
                      onClick={handleSaveEdit}
                    >
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexDirection: "row",
                      }}
                    >
                      <Typography variant="h6" style={{ fontFamily: "Outfit" }}>
                        {caseData.case_title}
                      </Typography>
                      <Typography
                        variant="subtitle2"
                        style={{
                          fontFamily: "Outfit",
                          color: "var(--placeholder-text)",
                        }}
                        fontWeight={100}
                        mb={0}
                        textAlign="left"
                      >
                        Case #{caseData.case_hash}
                      </Typography>
                    </div>
                    <Divider sx={{ my: 2, borderColor: "var(--border)" }} />
                    <Typography
                      variant="body2"
                      sx={{ whiteSpace: "normal", wordBreak: "break-word" }}
                    >
                      {caseData.case_description}
                    </Typography>
                  </>
                )}
              </CardContent>
            </Card>

            <Stack direction="row" spacing={2} mb={3}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: "1em",
                  width: "100%",
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: "Outfit",
                    fontWeight: 500,
                    color: "var(--text)",
                    mb: 1,
                  }}
                >
                  Senior Lawyers Available for Review
                </Typography>

                <Box
                  sx={{
                    border: "1px solid var(--border)",
                    borderRadius: 1,
                    width: "100%",
                    overflow: "hidden",
                  }}
                >
                  <Grid container>
                    {supervisors.map((supervisor, index) => {
                      const isSelected = selectedSupervisors.includes(
                        supervisor.instructor_id,
                      );
                      return (
                        <Grid
                          size={{ xs: 12, md: 6 }}
                          key={supervisor.instructor_id || index}
                          onClick={() => {
                            if (supervisor.instructor_id) {
                              toggleSupervisor(supervisor.instructor_id);
                            }
                          }}
                          sx={{
                            cursor: "pointer",
                            borderBottom: "1px solid var(--border)",
                            borderRight: {
                              md:
                                index % 2 === 0
                                  ? "1px solid var(--border)"
                                  : "none",
                              xs: "none",
                            },
                            borderColor: "var(--border)",
                          }}
                        >
                          <Box
                            sx={{
                              p: 2,
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                              color: isSelected
                                ? "var(--primary)"
                                : "var(--text)",
                              transition: "all 0.2s ease",
                              backgroundColor: isSelected
                                ? "var(--secondary)"
                                : "transparent",
                              "&:hover": {
                                backgroundColor: "var(--background2)",
                              },
                            }}
                          >
                            <PersonOutlineIcon />
                            <Typography
                              sx={{
                                fontFamily: "Outfit",
                                fontWeight: 400,
                                fontSize: "1rem",
                              }}
                            >
                              {supervisor.instructor_name}
                            </Typography>
                          </Box>
                        </Grid>
                      );
                    })}
                    {supervisors.length === 0 && (
                      <Box sx={{ p: 3, width: "100%", textAlign: "center" }}>
                        <Typography color="textSecondary">
                          No supervisors available.
                        </Typography>
                      </Box>
                    )}
                  </Grid>
                </Box>

                <Stack
                  direction="column"
                  spacing={1}
                  alignItems="flex-start"
                  mt={2}
                >
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SendIcon />}
                    onClick={handleSendForReview}
                    disabled={
                      caseData.status === "Sent to Review" ||
                      selectedSupervisors.length === 0 ||
                      caseData.status === "archived"
                    }
                    sx={{
                      textTransform: "none",
                      fontFamily: "Inter",
                      fontWeight: 500,
                      px: 3,
                      py: 1,
                      color: "var(--text)",
                      backgroundColor: "var(--primary)",
                      "&:hover": {
                        backgroundColor: "var(--primary)",
                        opacity: 0.9,
                      },
                      "&.Mui-disabled": {
                        backgroundColor: "var(--border)",
                        color: "var(--text-secondary)",
                      },
                    }}
                  >
                    Submit for Review
                  </Button>

                  {caseData.status === "archived" && (
                    <Typography
                      sx={{
                        fontStyle: "italic",
                        fontSize: "0.85rem",
                        color: "var(--text-secondary)",
                        fontFamily: "Outfit",
                      }}
                    >
                      This case is archived. You must unarchive it to enable
                      review.
                    </Typography>
                  )}
                </Stack>
              </div>
            </Stack>

            <CardContent>
              <Grid container spacing={3} sx={{ textAlign: "left" }}>
                {["case_type", "jurisdiction"].map((key, index) => (
                  <Grid size={{ xs: 12, md: 6 }} key={index}>
                    <Typography variant="h6" fontWeight={500}>
                      {key
                        .replace("_", " ")
                        .replace(/\b\w/g, (char) => char.toUpperCase())}
                    </Typography>
                    <Typography variant="body2">
                      {key === "jurisdiction" && caseData[key]
                        ? Array.isArray(caseData[key])
                          ? caseData[key]
                              .map((j) =>
                                j === "Provincial"
                                  ? `Provincial (${caseData.province})`
                                  : j,
                              )
                              .join(", ")
                          : caseData[key] === "Provincial"
                            ? `Provincial (${caseData.province})`
                            : caseData[key]
                        : caseData[key] || "N/A"}
                    </Typography>
                  </Grid>
                ))}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="h6" fontWeight={500}>
                    Status
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color:
                        caseData.status === "reviewed" ||
                        caseData.status === "Reviewed"
                          ? "var(--orange-text)"
                          : caseData.status === "submitted" ||
                              caseData.status === "Submitted"
                            ? "var(--purple-text)"
                            : "var(--green-text)",
                      fontWeight: "bold",
                    }}
                  >
                    {caseData.status === "in_progress"
                      ? "In Progress"
                      : (caseData.status || "N/A").charAt(0).toUpperCase() +
                        (caseData.status || "N/A").slice(1)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="h6" fontWeight={500}>
                    Last Updated
                  </Typography>
                  <Typography variant="body2">
                    {caseData?.last_updated
                      ? new Date(caseData.last_updated).toLocaleString(
                          "en-US",
                          {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "numeric",
                            hour12: true,
                          },
                        )
                      : "N/A"}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </>
        )}
      </Container>

      {/* Snackbar for alerts */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={8000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default CaseOverview;
