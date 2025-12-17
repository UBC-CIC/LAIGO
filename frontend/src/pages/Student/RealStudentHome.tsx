import React from "react";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Grid as Grid,
  Container,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import StudentHeader from "../../components/StudentHeader";
import CaseCard from "../../components/CaseCard";

// Mock data replicating the screenshot
const mockCases = [
  {
    id: "89H%2Lx",
    title: "Federal Civil Law: Tenancy Dispute Leads to Assault",
    status: "In Progress",
    jurisdiction: "Federal",
    dateAdded: "November 19th, 2025",
  },
  {
    id: "89H%2Lx",
    title: "Federal Civil Law: Tenancy Dispute Leads to Assault",
    status: "In Progress",
    jurisdiction: "Federal",
    dateAdded: "November 19th, 2025",
  },
  {
    id: "89H%2Lx",
    title: "Federal Civil Law: Tenancy Dispute Leads to Assault",
    status: "In Progress",
    jurisdiction: "Federal",
    dateAdded: "November 19th, 2025",
  },
  {
    id: "89H%2Lx",
    title: "Federal Civil Law: Tenancy Dispute Leads to Assault",
    status: "In Progress",
    jurisdiction: "Federal",
    dateAdded: "November 19th, 2025",
  },
  {
    id: "89H%2Lx",
    title: "Federal Civil Law: Tenancy Dispute Leads to Assault",
    status: "In Progress",
    jurisdiction: "Federal",
    dateAdded: "November 19th, 2025",
  },
];

const RealStudentHome: React.FC = () => {
  return (
    <Box
      sx={{
        backgroundColor: "#181818", // Deep dark background
        minHeight: "100vh",
        color: "white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <StudentHeader />

      <Container maxWidth="lg" sx={{ mt: 8, mb: 4, flexGrow: 1 }}>
        <Typography
          variant="h4"
          align="center"
          gutterBottom
          sx={{ fontWeight: "bold", mb: 4 }}
        >
          View All Cases
        </Typography>

        {/* Search Bar */}
        <Box sx={{ display: "flex", justifyContent: "center", mb: 6 }}>
          <TextField
            variant="outlined"
            placeholder="Search for a case"
            fullWidth
            sx={{
              backgroundColor: "#2c2c2c",
              borderRadius: "4px",
              maxWidth: "100%",
              "& .MuiOutlinedInput-root": {
                color: "white",
                "& fieldset": {
                  borderColor: "#444",
                },
                "&:hover fieldset": {
                  borderColor: "#666",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#888",
                },
              },
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "#aaa" }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        {/* Cases Grid */}
        <Grid container spacing={3}>
          {mockCases.map((caseItem, index) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
              <CaseCard
                caseId={caseItem.id}
                title={caseItem.title}
                status={caseItem.status}
                jurisdiction={caseItem.jurisdiction}
                dateAdded={caseItem.dateAdded}
              />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default RealStudentHome;
