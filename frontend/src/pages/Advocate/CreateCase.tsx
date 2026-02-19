import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Checkbox,
  FormControlLabel,
  Switch,
  Button,
  Container,
  Paper,
  Stack,
  FormGroup,
  MenuItem,
  Alert,
  Snackbar,
} from "@mui/material";
import AdvocateHeader from "../../components/AdvocateHeader";
import { fetchAuthSession } from "aws-amplify/auth";
import { useNavigate } from "react-router-dom";

// Import UserContext and InstructorHeader
import { useUser } from "../../contexts/UserContext";
import SupervisorHeader from "../../components/SupervisorHeader";

const CreateCase: React.FC = () => {
  const { userInfo } = useUser();
  const isSupervisor = userInfo?.groups.includes("instructor");

  // ... existing state ...
  const [isFederal, setIsFederal] = useState(false);
  const [isProvincial, setIsProvincial] = useState(false);
  const [province, setProvince] = useState<string>("");
  const [statuteApplicable, setStatuteApplicable] = useState(false);
  const [broadLaw, setBroadLaw] = useState<string>("");
  const [statuteDetails, setStatuteDetails] = useState<string>("");
  const [overview, setOverview] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form alert state
  const [genericError, setGenericError] = useState<string | null>(null);
  const [broadLawError, setBroadLawError] = useState<string | null>(null);
  const [provinceError, setProvinceError] = useState<string | null>(null);
  const [statuteError, setStatuteError] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const MAX_OVERVIEW_LENGTH = 4000;

  const broadLawOptions = [
    "Criminal Law",
    "Civil Law",
    "Family Law",
    "Business Law",
    "Environmental Law",
    "Health Law",
    "Immigration Law",
    "Labour Law",
    "Personal Injury Law",
    "Tax Law",
    "Intellectual Property Law",
    "Other",
  ];

  const canadianProvinces = [
    "Alberta",
    "British Columbia",
    "Manitoba",
    "New Brunswick",
    "Newfoundland and Labrador",
    "Northwest Territories",
    "Nova Scotia",
    "Nunavut",
    "Ontario",
    "Prince Edward Island",
    "Quebec",
    "Saskatchewan",
    "Yukon",
  ];

  const inputStyles = {
    transition: "all 0.3s ease",
    input: {
      WebkitBoxShadow: "0 0 0 1000px var(--background) inset",
      WebkitTextFillColor: "var(--text)",
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "var(--border)",
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: "var(--primary)",
    },
    "& .MuiInputBase-root": {
      backgroundColor: "var(--background)",
      color: "var(--text)",
    },
    "& .MuiInputLabel-root": {
      color: "var(--text)",
    },
    "& .MuiInputLabel-root.Mui-error": {
      color: "var(--text)",
    },
    "& .MuiFormHelperText-root:not(.Mui-error)": {
      color: "var(--text-secondary)",
    },
  };

  const navigate = useNavigate();

  // Real-time validation effects
  useEffect(() => {
    if (broadLaw) setBroadLawError(null);
  }, [broadLaw]);

  useEffect(() => {
    if (isProvincial && province) {
      setProvinceError(null);
    } else if (!isProvincial) {
      setProvinceError(null);
    }
  }, [isProvincial, province]);

  useEffect(() => {
    if (statuteApplicable && statuteDetails.trim().length > 0) {
      setStatuteError(null);
    } else if (!statuteApplicable) {
      setStatuteError(null);
    }
  }, [statuteApplicable, statuteDetails]);

  useEffect(() => {
    if (overview.length > MAX_OVERVIEW_LENGTH) {
      setOverviewError(
        `Overview is too long (max ${MAX_OVERVIEW_LENGTH} characters). Currently ${overview.length}`,
      );
    } else if (overview.trim().length > 0) {
      setOverviewError(null);
    }
  }, [overview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setGenericError(null);
    setBroadLawError(null);
    setProvinceError(null);
    setStatuteError(null);
    setOverviewError(null);

    let hasValidationErrors = false;

    // Validation
    if (!broadLaw) {
      setBroadLawError("Please select a Broad Area of Law.");
      hasValidationErrors = true;
    }

    if (isProvincial && !province) {
      setProvinceError("Please select a Province/Territory.");
      hasValidationErrors = true;
    }

    if (
      statuteApplicable &&
      (!statuteDetails || statuteDetails.trim().length === 0)
    ) {
      setStatuteError("Please provide statute details.");
      hasValidationErrors = true;
    }

    if (!overview || overview.trim().length === 0) {
      setOverviewError("Please provide a case overview.");
      hasValidationErrors = true;
    }

    if (overview.length > MAX_OVERVIEW_LENGTH) {
      setOverviewError(
        `Overview is too long (max ${MAX_OVERVIEW_LENGTH} characters). Currently ${overview.length}`,
      );
      hasValidationErrors = true;
    }

    if (hasValidationErrors) {
      setSubmitting(false);
      return;
    }

    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() || null;
      const userId = session.tokens?.idToken?.payload?.sub as string;

      if (!token || !userId)
        throw new Error("No auth token or user ID available");

      // Step 1: Call /student/new_case to generate case with LLM-generated title
      const jurisdictionArray: string[] = [];
      if (isFederal) jurisdictionArray.push("Federal");
      if (isProvincial) jurisdictionArray.push("Provincial");

      const newCasePayload = {
        case_title: "", // Empty - will be generated by LLM
        case_type: broadLaw,
        jurisdiction:
          jurisdictionArray.length > 0 ? jurisdictionArray : ["Unknown"],
        case_description: overview,
        province: province || "",
        statute: statuteApplicable ? statuteDetails : "",
      };

      const newCaseResp = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/student/new_case?user_id=${userId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token,
          },
          body: JSON.stringify(newCasePayload),
        },
      );

      if (!newCaseResp.ok) {
        const text = await newCaseResp.text();
        throw new Error(
          `Failed to generate case: ${newCaseResp.status} ${text}`,
        );
      }

      const newCaseData = await newCaseResp.json();
      console.log("case generation response", newCaseData);

      // Step 2: Call /student/edit_case to save the generated case to the database
      const editCasePayload = {
        case_title: newCaseData.case_title || "Untitled Case",
        case_type: broadLaw,
        case_description: overview,
        status: "in_progress",
        jurisdiction:
          jurisdictionArray.length > 0 ? jurisdictionArray : ["Unknown"],
        province: province || "",
        statute: statuteApplicable ? statuteDetails : "",
      };

      const editCaseResp = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/student/edit_case?case_id=${newCaseData.case_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: token,
          },
          body: JSON.stringify(editCasePayload),
        },
      );

      if (!editCaseResp.ok) {
        const text = await editCaseResp.text();
        throw new Error(`Failed to save case: ${editCaseResp.status} ${text}`);
      }

      const editCaseData = await editCaseResp.json();
      console.log("case save response", editCaseData);

      /* Success snackbar removed as we navigate away immediately */

      // reset form
      setIsFederal(false);
      setIsProvincial(false);
      setProvince("");
      setStatuteApplicable(false);
      setBroadLaw("");
      setStatuteDetails("");
      setOverview("");

      // Navigate to the new case's interview page (start at intake section)
      navigate(`/case/${newCaseData.case_id}/interview/intake-facts`);
    } catch (err) {
      console.error("Failed to submit case", err);
      const msg = err instanceof Error ? err.message : "Failed to submit case";
      setGenericError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        backgroundColor: "var(--background)",
        minHeight: "100vh",
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {isSupervisor ? <SupervisorHeader /> : <AdvocateHeader />}

      <Container
        maxWidth="xl"
        sx={{
          mt: 4,
          mb: 4,
          flexGrow: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: "100%",
            maxWidth: "800px",
            backgroundColor: "var(--background)",
            border: "1px solid var(--border)",
            p: 4,
            borderRadius: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            position: "relative",
          }}
        >
          <Typography variant="h5" sx={{ mb: 3, color: "var(--text)" }}>
            Create a Case
          </Typography>

          <form onSubmit={handleSubmit} style={{ width: "100%" }}>
            <Stack spacing={3} width="100%">
              {/* Broad Area of Law */}
              <TextField
                select
                fullWidth
                label="Broad Area of Law"
                value={broadLaw}
                onChange={(e) => setBroadLaw(e.target.value as string)}
                variant="outlined"
                sx={{ ...inputStyles, textAlign: "left" }}
                error={!!broadLawError}
                helperText={broadLawError}
              >
                {broadLawOptions.map((opt) => (
                  <MenuItem value={opt} key={opt} sx={{ textAlign: "left" }}>
                    {opt}
                  </MenuItem>
                ))}
              </TextField>

              {/* Jurisdiction */}
              <Box>
                <Typography
                  variant="subtitle1"
                  sx={{ mb: 1, color: "var(--text)", textAlign: "left" }}
                >
                  Jurisdiction
                </Typography>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isFederal}
                        onChange={(e) => setIsFederal(e.target.checked)}
                        sx={{
                          color: "var(--text-secondary)",
                          "&.Mui-checked": { color: "var(--primary)" },
                        }}
                      />
                    }
                    label={
                      <Typography sx={{ color: "var(--text-secondary)" }}>
                        Federal
                      </Typography>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isProvincial}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsProvincial(checked);
                          if (!checked) setProvince("");
                        }}
                        sx={{
                          color: "var(--text-secondary)",
                          "&.Mui-checked": { color: "var(--primary)" },
                        }}
                      />
                    }
                    label={
                      <Typography sx={{ color: "var(--text-secondary)" }}>
                        Provincial
                      </Typography>
                    }
                  />
                </FormGroup>

                {isProvincial && (
                  <TextField
                    select
                    fullWidth
                    label="Province / Territory"
                    value={province}
                    onChange={(e) => setProvince(e.target.value as string)}
                    variant="outlined"
                    sx={{ ...inputStyles, textAlign: "left" }}
                    error={!!provinceError}
                    helperText={provinceError}
                  >
                    {canadianProvinces.map((p) => (
                      <MenuItem value={p} key={p} sx={{ textAlign: "left" }}>
                        {p}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </Box>

              {/* Statute Applicable? */}
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="subtitle1" sx={{ color: "var(--text)" }}>
                  Statute Applicable?
                </Typography>
                <Switch
                  checked={statuteApplicable}
                  onChange={(e) => setStatuteApplicable(e.target.checked)}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": {
                      color: "#90caf9",
                      "& + .MuiSwitch-track": {
                        backgroundColor: "#64b5f6",
                      },
                    },
                  }}
                />
              </Stack>

              {/* Statute Details */}
              {statuteApplicable && (
                <TextField
                  fullWidth
                  label="Statute Details"
                  variant="outlined"
                  sx={{ ...inputStyles }}
                  value={statuteDetails}
                  onChange={(e) => setStatuteDetails(e.target.value)}
                  error={!!statuteError}
                  helperText={statuteError}
                />
              )}

              {/* Overview */}
              <TextField
                fullWidth
                multiline
                rows={6}
                label="Provide an overview of the details of the case"
                variant="outlined"
                sx={inputStyles}
                value={overview}
                onChange={(e) => setOverview(e.target.value)}
                error={!!overviewError}
                helperText={overviewError}
              />

              {/* Start Chat Button */}
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={submitting}
                sx={{
                  backgroundColor: "var(--primary)",
                  color: "var(--text)",
                  textTransform: "none",
                  fontSize: "1rem",
                  py: 1.5,
                  "&:hover": {
                    backgroundColor: "var(--primary)",
                    opacity: 0.9,
                  },
                }}
              >
                {submitting ? "Creating..." : "START CHAT"}
              </Button>
            </Stack>
          </form>
        </Paper>
      </Container>
      <Snackbar
        open={!!genericError}
        autoHideDuration={6000}
        onClose={() => setGenericError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setGenericError(null)}
          severity="error"
          sx={{ width: "100%" }}
        >
          {genericError}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CreateCase;
