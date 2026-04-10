import React, { useEffect, useState, useCallback } from "react";
import { Box, CssBaseline } from "@mui/material";
import { Outlet, useParams } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import { useUser } from "../../contexts/UserContext";

import AdvocateHeader from "../../components/AdvocateHeader";
import SupervisorHeader from "../../components/SupervisorHeader";
import SideMenu from "./SideMenu";
import Notepad from "../../components/Case/Notepad";

// Context type for child routes
export interface CaseOutletContext {
  unlockedBlocks: string[];
  completedBlocks: string[];
  refreshUnlockedBlocks: () => Promise<void>;
  caseStatus: string;
  refreshCaseData: () => Promise<void>;
  caseTitle: string;
  caseStudentId: string | null;
}

const CaseLayout: React.FC = () => {
  const { caseId } = useParams();
  const { activePerspective } = useUser();
  const isInstructor = activePerspective === "instructor" || activePerspective === "admin";
  const [caseTitle, setCaseTitle] = useState<string>("");
  const [caseStatus, setCaseStatus] = useState<string>("");
  const [caseStudentId, setCaseStudentId] = useState<string | null>(null);
  const [unlockedBlocks, setUnlockedBlocks] = useState<string[]>([]);
  const [completedBlocks, setCompletedBlocks] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Notepad State
  const [showNotepad, setShowNotepad] = useState(false);
  const [notepadContent, setNotepadContent] = useState("");
  const [cognitoId, setCognitoId] = useState<string | null>(null);

  // Refresh unlocked blocks from server
  const refreshUnlockedBlocks = useCallback(async () => {
    if (!caseId) return;
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const cId = session.tokens?.idToken?.payload?.sub;

      if (!token || !cId) return;

      const res = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }/student/case_page?case_id=${caseId}`,
        {
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        },
      );

      if (res.ok) {
        const data = await res.json();
        const cData = data.caseData || data;
        setCompletedBlocks(
          Array.isArray(cData.completed_blocks) ? cData.completed_blocks : [],
        );
        // Forced unlock for testing/temporary requirement
        setUnlockedBlocks([
          "intake",
          "legal_analysis",
          "contrarian",
          "policy",
        ]);
        // Also update status if it changed
        if (cData.status) setCaseStatus(cData.status);
        if (cData.student_id) setCaseStudentId(cData.student_id);
      }
    } catch (err) {
    }
  }, [caseId]);

  const init = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const cId = session.tokens?.idToken?.payload?.sub;

      if (cId) setCognitoId(cId);

      if (!token || !cId) {
        return;
      }

      // Fetch Case Data for title
      const res = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }/student/case_page?case_id=${caseId}`,
        {
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        },
      );

      if (res.ok) {
        const data = await res.json();
        const cData = data.caseData || data;
        setCaseTitle(cData.case_title || "Untitled Case");
        setCaseStatus(cData.status || "");
        setCompletedBlocks(
          Array.isArray(cData.completed_blocks) ? cData.completed_blocks : [],
        );
        // Forced unlock for testing/temporary requirement
        setUnlockedBlocks([
          "intake",
          "legal_analysis",
          "contrarian",
          "policy",
        ]);
        setNotepadContent(cData.student_notes || "");
        if (cData.student_id) setCaseStudentId(cData.student_id);
      }

      // Update view_case if student
      if (!isInstructor) {
        const viewRes = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }/student/view_case?case_id=${caseId}`,
          {
            method: "PUT",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          },
        );

        if (!viewRes.ok) {
        }
      }
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (caseId) {
      init();
    }
  }, [caseId, init]);

  const handleSaveNotes = useCallback(
    async (content: string) => {
      if (!caseId || !cognitoId) return;
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();

        // Use PUT /student/notes to save notes
        await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }/student/notes?case_id=${caseId}`,
          {
            method: "PUT",
            headers: {
              Authorization: token || "",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              case_id: caseId,
              notes: content,
            }),
          },
        );

        setNotepadContent(content);
      } catch (e) {
      }
    },
    [caseId, cognitoId],
  );

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
        {isInstructor ? <SupervisorHeader /> : <AdvocateHeader />}
      </Box>

      {/* Side Menu */}
      <SideMenu
        caseTitle={caseTitle}
        loading={loading}
        completedBlocks={completedBlocks}
        onToggleNotepad={() => !loading && setShowNotepad(!showNotepad)}
      />

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 0,
          mt: "80px", // match header height
          width: { sm: `calc(100% - 220px)` },
          height: "calc(100vh - 80px)",
          overflowY: "auto",
          color: "var(--text)",
          bgcolor: "var(--background)",
        }}
      >
        <Outlet
          context={
            {
              unlockedBlocks,
              completedBlocks,
              refreshUnlockedBlocks,
              caseStatus,
              refreshCaseData: init,
              caseTitle,
              caseStudentId,
            } satisfies CaseOutletContext
          }
        />
      </Box>

      {/* Draggable Notepad */}
      {showNotepad && (
        <Notepad
          initialContent={notepadContent}
          onSave={handleSaveNotes}
          onClose={() => setShowNotepad(false)}
          readOnly={caseStatus === "archived"}
        />
      )}
    </Box>
  );
};

export default CaseLayout;
