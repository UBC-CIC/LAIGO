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
} from "@mui/material";
import StudentHeader from "../../components/StudentHeader";

const CreateCase: React.FC = () => {
  const [isFederal, setIsFederal] = useState(false);
  const [isProvincial, setIsProvincial] = useState(false);
  const [statuteApplicable, setStatuteApplicable] = useState(false);

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
        maxWidth="lg"
        sx={{
          mt: 8,
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
          <Typography variant="h5" sx={{ fontWeight: "bold", mb: 3 }}>
            Create a Case
          </Typography>

          <Stack spacing={3} width="100%">
            {/* Broad Area of Law */}
            <TextField
              fullWidth
              label="Broad Area of Law"
              variant="outlined"
              sx={inputStyles}
            />

            {/* Jurisdiction */}
            <Box >
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: "bold", mb: 1, color: "var(--text)", textAlign: "left" }}
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
                sx={{ fontWeight: "bold", color: "var(--text)" }}
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
                color: "#000",
                fontWeight: "bold",
                textTransform: "none",
                fontSize: "1rem",
                py: 1.5,
                "&:hover": {
                  backgroundColor: "#5a9bd0",
                },
              }}
            >
              Start Chat
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default CreateCase;
