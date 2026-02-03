import { useEffect, useState } from "react";
import { Amplify } from "aws-amplify";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import InstructorDashboard from "./pages/Instructor/InstructorDashboard";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import AIConfiguration from "./pages/Admin/AIConfiguration";
import AdminDisclaimer from "./pages/Admin/AdminDisclaimer";
import { CircularProgress, Box } from "@mui/material";
import "./App.css";
import StudentDashboard from "./pages/Student/StudentDashboard";
import CreateCase from "./pages/Student/CreateCase";
import CaseLayout from "./pages/Case/CaseLayout";
import CaseOverview from "./pages/Case/CaseOverview";
import CaseSummaries from "./pages/Case/CaseSummaries";
import CaseTranscriptions from "./pages/Case/CaseTranscriptions";
import CaseFeedback from "./pages/Case/CaseFeedback";
import InterviewAssistant from "./pages/Case/InterviewAssistant";
import { UserProvider } from "./contexts/UserContext";
import type { UserInfo } from "./contexts/UserContext";
import { NotificationProvider } from "./contexts/NotificationContext";

// Amplify configuration
const amplifyConfig = {
  API: {
    REST: {
      MyApi: {
        endpoint: import.meta.env.VITE_API_ENDPOINT,
      },
    },
  },
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
      identityPoolId: import.meta.env.VITE_IDENTITY_POOL_ID,
      loginWith: {
        email: true,
      },
      signUpVerificationMethod: "code" as const,
      userAttributes: {
        email: {
          required: true,
        },
      },
      allowGuestAccess: false,
    },
  },
};

// Configure Amplify
Amplify.configure(amplifyConfig);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const user = await getCurrentUser();
      const session = await fetchAuthSession();

      if (user && session.tokens?.idToken) {
        const idToken = session.tokens.idToken;
        const payload = idToken.payload;

        const userInfo: UserInfo = {
          userId: payload.sub as string,
          email: payload.email as string,
          firstName: (payload.given_name as string) || "",
          lastName: (payload.family_name as string) || "",
          groups: (payload["cognito:groups"] as string[]) || ["student"],
        };

        setUserInfo(userInfo);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.log("User not authenticated:", error);
      setIsAuthenticated(false);
      setUserInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const getUserRole = (groups: string[]): string => {
    if (groups.includes("admin")) return "admin";
    if (groups.includes("instructor")) return "instructor";
    return "student";
  };

  const RoleBasedRoutes = () => {
    if (!userInfo) return null;

    const role = getUserRole(userInfo.groups);

    switch (role) {
      case "admin":
        return (
          <Routes>
            <Route path="/" element={<AdminDashboard userInfo={userInfo} />} />
            <Route path="/ai-configuration" element={<AIConfiguration />} />
            <Route path="/disclaimer" element={<AdminDisclaimer />} />
            <Route path="*" element={<AdminDashboard userInfo={userInfo} />} />
          </Routes>
        );
      case "instructor":
        return (
          <Routes>
            <Route
              path="/"
              element={<InstructorDashboard userInfo={userInfo} />}
            />
            <Route path="/create-case" element={<CreateCase />} />
            <Route
              path="*"
              element={<InstructorDashboard userInfo={userInfo} />}
            />
          </Routes>
        );
      case "student":
      default:
        return (
          <Routes>
            <Route path="/" element={<StudentDashboard />} />
            <Route path="/create-case" element={<CreateCase />} />
            <Route path="*" element={<StudentDashboard />} />
          </Routes>
        );
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <UserProvider value={{ userInfo, setUserInfo }}>
      <NotificationProvider>
        <div className="app">
          <Routes>
            {/* Shared Case Routes - Accessible to all authenticated users */}
            <Route path="/case/:caseId" element={<CaseLayout />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<CaseOverview />} />
              <Route
                path="interview"
                element={<Navigate to="intake-facts" replace />}
              />
              <Route
                path="interview/:section"
                element={<InterviewAssistant />}
              />
              <Route path="summaries" element={<CaseSummaries />} />
              <Route path="transcriptions" element={<CaseTranscriptions />} />
              <Route path="feedback" element={<CaseFeedback />} />
            </Route>

            {/* Dashboard Routes based on Role */}
            <Route path="/*" element={<RoleBasedRoutes />} />
          </Routes>
        </div>
      </NotificationProvider>
    </UserProvider>
  );
}

export default App;
