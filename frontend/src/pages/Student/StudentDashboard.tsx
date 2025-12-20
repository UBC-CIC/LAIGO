import React, { useState, useMemo } from "react";
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
  const [query, setQuery] = useState("");
  const [cases, setCases] = useState<typeof mockCases>(mockCases);

  // Using mock data only for now; search will filter this list
  const filteredCases = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = cases || mockCases;
    if (!q) return source;
    return source.filter((c) => {
      return (
        (c.title || "").toLowerCase().includes(q) ||
        (c.jurisdiction || "").toLowerCase().includes(q) ||
        (c.status || "").toLowerCase().includes(q) ||
        (c.id || "").toLowerCase().includes(q)
      );
    });
  }, [query, cases]);

  return (
    <Box
      sx={{
        backgroundColor: "var(--background)", // Deep dark background
        minHeight: "100vh",
        color: "var(--text)",
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
              backgroundColor: "var(--background)",
              borderRadius: "4px",
              maxWidth: "100%",
              "& .MuiOutlinedInput-root": {
                color: "var(--text)",
                "& fieldset": {
                  borderColor: "var(--border)",
                },
                "&:hover fieldset": {
                  borderColor: "var(--text-secondary)",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "var(--primary)",
                },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "var(--text-secondary)" }} />
                </InputAdornment>
              ),
            }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Box>

        {/* Cases Grid */}
        <Grid container spacing={3}>
          {filteredCases.length === 0 ? (
            <Grid size={{ xs: 12 }}>
              <Typography align="center" sx={{ color: "var(--text-secondary)", mt: 2 }}>
                No cases found
              </Typography>
            </Grid>
          ) : (
            filteredCases.map((caseItem, index) => (
               <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
              <CaseCard
                caseId={caseItem.id}
                title={caseItem.title}
                status={caseItem.status}
                jurisdiction={caseItem.jurisdiction}
                dateAdded={caseItem.dateAdded}
              />
            </Grid>
            ))
          )}
        </Grid>
      </Container>
    </Box>
  );
};

export default RealStudentHome;
