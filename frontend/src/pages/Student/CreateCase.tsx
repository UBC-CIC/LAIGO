import React, { useState } from "react";
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
} from "@mui/material";
import StudentHeader from "../../components/StudentHeader";

const CreateCase: React.FC = () => {
  const [isFederal, setIsFederal] = useState(false);
  const [isProvincial, setIsProvincial] = useState(false);
  const [statuteApplicable, setStatuteApplicable] = useState(false);
  const [broadLaw, setBroadLaw] = useState<string>("");

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
      <StudentHeader />
      
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
            display:"flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          <Typography variant="h5" sx={{ mb: 3, color: "var(--text)" }}>
            Create a Case
          </Typography>

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
            >
              {broadLawOptions.map((opt) => (
                <MenuItem value={opt} key={opt} sx={{ textAlign: 'left' }}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>

            {/* Jurisdiction */}
            <Box >
              <Typography
                variant="subtitle1"
                sx={{mb: 1, color: "var(--text)", textAlign: "left" }}
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
                      onChange={(e) => setIsProvincial(e.target.checked)}
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
            </Box>

            {/* Statute Applicable? */}
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography
                variant="subtitle1"
                sx={{color: "var(--text)" }}
              >
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
              sx={{...inputStyles}}
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
            />

            {/* Start Chat Button */}
            <Button
              variant="contained"
              fullWidth
              sx={{
                backgroundColor: "#76b9f0",
                color: "var(--text)",
                textTransform: "none",
                fontSize: "1rem",
                py: 1.5,
                "&:hover": {
                  backgroundColor: "#5a9bd0",
                },
              }}
            >
              START CHAT
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default CreateCase;
