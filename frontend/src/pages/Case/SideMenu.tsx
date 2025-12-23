import React, { useEffect, useState } from "react";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Divider,
  CssBaseline,
} from "@mui/material";
import { Outlet, useNavigate, useLocation, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { fetchAuthSession } from "aws-amplify/auth";
import StudentHeader from "../../components/StudentHeader";

const drawerWidth = 220;

const SideMenu: React.FC = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [caseTitle, setCaseTitle] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  const menuItems = [
    { text: "Case Overview", path: "overview" },
    { text: "Interview Assistant", path: "interview" },
    { text: "Case Summaries", path: "summaries" },
    { text: "Case Transcriptions", path: "transcriptions" },
    { text: "Case Feedback", path: "feedback" },
  ];

  useEffect(() => {
    const init = async () => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        const cognitoId = session.tokens?.idToken?.payload?.sub;
        const groups = session.tokens?.idToken?.payload?.[
          "cognito:groups"
        ] as string[];

        if (!token || !cognitoId) return; // Handle auth error/redirect?

        // Determine role

        // Fetch Case Data
        const res = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }/student/case_page?case_id=${caseId}&cognito_id=${cognitoId}`,
          {
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          }
        );

        if (res.ok) {
          const data = await res.json();
          const cData = data.caseData || data;
          setCaseTitle(cData.case_title || "Untitled Case");
        }

        // Update view_case if student
        if (!groups?.includes("instructor") && !groups?.includes("admin")) {
          await fetch(
            `${
              import.meta.env.VITE_API_ENDPOINT
            }/student/view_case?case_id=${caseId}`,
            {
              method: "PUT",
              headers: {
                Authorization: token,
                "Content-Type": "application/json",
              },
            }
          );
        }
      } catch (err) {
        console.error("Error in SideMenu init", err);
      } finally {
        setLoading(false);
      }
    };

    if (caseId) {
      init();
    }
  }, [caseId]);

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <Box
        position="fixed"
        top={0}
        left={0}
        width="100%"
        zIndex={1201} // High z-index to sit above drawer if needed, or drawer sits below?
        // Usually Header is above Drawer (clipped) or Drawer is full height.
        // Screenshot shows "Back to Dashboard" at very top of sidebar.
        // StudentHeader is usually the top navbar.
        // If I use Clipped drawer, Header is full width.
        // If I use Permanent drawer, it can be full height.
        // CaseOverview had Header fixed.
        // I will put Header fixed at top, margin-left for content?
        // Let's assume Header is separate and this SideMenu is below it?
        // Actually, let's keep StudentHeader here for consistency with CaseOverview.
        bgcolor="white"
      >
        <StudentHeader />
      </Box>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            backgroundColor: "#1C1C1C", // Dark background from screenshot
            color: "white",
            marginTop: "64px", // Below header approx height
            height: "calc(100% - 64px)",
            borderRight: "1px solid #333",
          },
        }}
      >
        <Box sx={{ overflow: "auto", py: 2 }}>
          {/* Back to Dashboard */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              mt: 2,
              mb: 2,
              px: 2, // restore padding for non-list items
              color: "#ccc",
              "&:hover": { color: "white" },
            }}
            onClick={() => navigate("/")}
          >
            <ArrowBackIcon sx={{ mr: 1, fontSize: 20 }} />
            <Typography variant="body1" fontFamily="Outfit">
              Back to Dashboard
            </Typography>
          </Box>

          {/* Case Title */}
          <Typography
            variant="h6"
            fontFamily="Outfit"
            fontWeight="bold"
            sx={{ mb: 1, lineHeight: 1.2, px: 2 }} // restore padding
          >
            {loading ? "Loading..." : caseTitle}
          </Typography>

          <Divider sx={{ borderColor: "#444", mb: 2, mx: 2 }} />

          {/* Menu Items */}
          <List>
            {menuItems.map((item) => {
              // check if active. Simple check: active if pathname ends with item.path
              // or pathname includes item.path
              const isActive = location.pathname.includes(item.path);

              return (
                <ListItem key={item.text} disablePadding>
                  <ListItemButton
                    onClick={() => navigate(item.path)} // Relative nav
                    sx={{
                      mb: 0.5,
                      borderLeft: isActive
                        ? "4px solid #64B5F6"
                        : "4px solid transparent",
                      pl: isActive ? 1.5 : 2, // nudge text to compensate for border
                      "&:hover": {
                        backgroundColor: "rgba(255,255,255,0.05)",
                      },
                    }}
                  >
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontFamily: "Outfit",
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? "#64B5F6" : "white", // Blue if active
                        fontSize: "0.95rem",
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>

        {/* Placeholder for Draggable Notes Toggle if needed later 
            The user said "Leave ... for later", but mentioned "Toggles ... via a bottom-left notes button".
            I'll leave it out for now to strictly follow "Leave ... for later".
        */}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8, // For header
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default SideMenu;
