import React, { useState, useMemo, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Grid as Grid,
  Container,
  CircularProgress,
} from "@mui/material";
import { fetchAuthSession, fetchUserAttributes } from "aws-amplify/auth";
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
  const [cases, setCases] = useState<typeof mockCases | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch recent cases for the logged-in user using Amplify session token
  useEffect(() => {
    const fetchCases = async () => {
      setLoading(true);
      try {
        const session = await fetchAuthSession();
        // ensure user attributes are available (keeps parity with older code)
        await fetchUserAttributes();

        const token = session.tokens?.idToken?.toString();
        const cognito_id = session.tokens?.idToken?.payload?.sub;

        if (!token || !cognito_id) {
          console.warn('No token or user id available from session');
          setCases([]);
          setLoading(false);
          return;
        }

        const url = `${import.meta.env.VITE_API_ENDPOINT}/student/get_cases?user_id=${cognito_id}`;

        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: token,
            'Content-Type': 'application/json',
          },
        });

        if (resp.status === 404) {
          // No cases — normalize to empty and bubble up to catch for logging
          setCases([]);
          throw new Error('No cases found');
        }

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Failed to fetch cases: ${resp.status} ${errText}`);
        }

        const data = await resp.json();

        // Normalize API response to an array of cases
        let casesArray: any[] = [];
        if (Array.isArray(data)) {
          casesArray = data;
        } else if (data && Array.isArray(data.cases)) {
          casesArray = data.cases;
        } else if (data && typeof data === 'object') {
          casesArray = data.cases || [];
        }

        const activeCases = casesArray.filter((c) => c.status !== 'Archived');
        setCases(activeCases as typeof mockCases);
      } catch (error) {
        console.error('Error fetching cases:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  // Using fetched data (or empty list) for search/filtering
  const filteredCases = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = cases !== null ? cases : mockCases; // if cases === null we're still using mock data as a pre-fetch placeholder
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
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" width="100%" sx={{ mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
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
        )}
      </Container>
    </Box>
  );
};

export default RealStudentHome;
