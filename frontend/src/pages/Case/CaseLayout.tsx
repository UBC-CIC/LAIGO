import React, { useEffect, useState } from "react";
import { Box, CssBaseline } from "@mui/material";
import { Outlet, useParams } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import StudentHeader from "../../components/StudentHeader";
import SideMenu from "./SideMenu";

const CaseLayout: React.FC = () => {
  const { caseId } = useParams();
  const [caseTitle, setCaseTitle] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const init = async () => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        const cognitoId = session.tokens?.idToken?.payload?.sub;
        const groups = session.tokens?.idToken?.payload?.["cognito:groups"] as string[];

        if (!token || !cognitoId) {
          console.error("Authentication required");
          return;
        }

        // Fetch Case Data for title
        const res = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}/student/case_page?case_id=${caseId}&cognito_id=${cognitoId}`,
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
          const viewRes = await fetch(
            `${import.meta.env.VITE_API_ENDPOINT}/student/view_case?case_id=${caseId}`,
            {
              method: "PUT",
              headers: {
                Authorization: token,
                "Content-Type": "application/json",
              },
            }
          );

          if (!viewRes.ok) {
            console.warn("Failed to record case view:", viewRes.statusText);
          }
        }
      } catch (err) {
        console.error("Error in CaseLayout init:", err);
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
      
      {/* Fixed Header */}
      <Box
        position="fixed"
        top={0}
        left={0}
        width="100%"
        zIndex={1201}
        bgcolor="var(--header)"
      >
        <StudentHeader />
      </Box>

      {/* Side Menu */}
      <SideMenu caseTitle={caseTitle} loading={loading} />

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 0,
          mt: "80px", // match header height
          width: { sm: `calc(100% - 220px)` },
          minHeight: "calc(100vh - 80px)", // fill remaining viewport
          color: "var(--text)", // inherit text color from CSS variables
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default CaseLayout;
