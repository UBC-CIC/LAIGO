import { useEffect, useState, useCallback } from "react";
import { Amplify } from "aws-amplify";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { sessionStorage as amplifySessionStorage } from "aws-amplify/utils";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import SupervisorDashboard from "./pages/Supervisor/SupervisorDashboard";
import SupervisorPrompts from "./pages/Supervisor/SupervisorPrompts";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import AIConfiguration from "./pages/Admin/AIConfiguration";
import AdminDisclaimer from "./pages/Admin/AdminDisclaimer";
import { CircularProgress, Box } from "@mui/material";
import "./App.css";
import AdvocateDashboard from "./pages/Advocate/AdvocateDashboard";
import CreateCase from "./pages/Advocate/CreateCase";
import CaseLayout from "./pages/Case/CaseLayout";
import CaseOverview from "./pages/Case/CaseOverview";
import CaseSummaries from "./pages/Case/CaseSummaries";
import CaseTranscriptions from "./pages/Case/CaseTranscriptions";
import CaseFeedback from "./pages/Case/CaseFeedback";
import InterviewAssistant from "./pages/Case/InterviewAssistant";
import { UserProvider } from "./contexts/UserContext";
import type { UserInfo } from "./contexts/UserContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { RoleLabelsProvider } from "./contexts/RoleLabelsContext";
import DisclaimerModal from "./components/DisclaimerModal";
import { signOut } from "aws-amplify/auth";

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
cognitoUserPoolsTokenProvider.setKeyValueStorage(amplifySessionStorage);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerText, setDisclaimerText] = useState("");
  const [activePerspective, setActivePerspectiveState] = useState<string | null>(null);

  const getActivePerspectiveStorageKey = (userId: string | undefined) =>
    userId ? `activePerspective:${userId}` : "activePerspective";

  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const user = await getCurrentUser();
        const session = await fetchAuthSession();

        if (user && session.tokens?.idToken) {
          const token = session.tokens.idToken.toString();

          // Fetch user profile from database via API
          const response = await fetch(
            `${import.meta.env.VITE_API_ENDPOINT}/student/profile`,
            {
              headers: {
                Authorization: token,
              },
            }
          );

          if (response.status === 403) {
            // User not found in database - sign out and redirect to login
            await signOut();
            setIsAuthenticated(false);
            setUserInfo(null);
            setLoading(false);
            return;
          }

          if (!response.ok) {
            throw new Error(`Failed to fetch user profile: ${response.status}`);
          }

          const profile = await response.json();

          const userInfo: UserInfo = {
            userId: profile.userId,
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName,
            groups: profile.roles, // Use roles from database, not JWT
          };

          setUserInfo(userInfo);
          setIsAuthenticated(true);

          // Restore saved perspective or fall back to highest-priority available role
          const perspectiveStorageKey = getActivePerspectiveStorageKey(userInfo.userId);
          const savedPerspective = sessionStorage.getItem(perspectiveStorageKey);
          const roles: string[] = profile.roles;
          const priorityOrder = ["admin", "instructor", "student"];
          const defaultPerspective = priorityOrder.find((r) => roles.includes(r)) ?? null;
          const resolvedPerspective =
            savedPerspective && roles.includes(savedPerspective)
              ? savedPerspective
              : defaultPerspective;
          setActivePerspectiveState(resolvedPerspective);

          if (
            userInfo.groups.includes("student") ||
            userInfo.groups.includes("instructor")
          ) {
            checkDisclaimer();
          }
        }
      } catch {
        setIsAuthenticated(false);
        setUserInfo(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuthState();
  }, []);

  const checkDisclaimer = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) return;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/student/get_disclaimer`,
        { headers: { Authorization: token } },
      );

      if (response.ok) {
        const data = await response.json();
        if (data.disclaimer_text && !data.has_accepted) {
          setDisclaimerText(data.disclaimer_text);
          setShowDisclaimer(true);
        }
      }
    } catch (error) {
    }
  };

  const handleAcceptDisclaimer = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) return;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/student/accept_disclaimer`,
        {
          method: "POST",
          headers: { Authorization: token },
        },
      );

      if (response.ok) {
        setShowDisclaimer(false);
      }
    } catch (error) {
    }
  };

  const handleDeclineDisclaimer = async () => {
    try {
      await signOut();
      setIsAuthenticated(false);
      setUserInfo(null);
      setShowDisclaimer(false);
      window.location.reload();
    } catch (error) {
    }
  };

  const setActivePerspective = useCallback((perspective: string | null) => {
    setActivePerspectiveState(perspective);
    const storageKey = getActivePerspectiveStorageKey(userInfo?.userId);
    if (perspective) {
      sessionStorage.setItem(storageKey, perspective);
    } else {
      sessionStorage.removeItem(storageKey);
    }
  }, [userInfo?.userId]);

  const availablePerspectives = userInfo?.groups ?? [];

  const RoleBasedRoutes = () => {
    if (!userInfo) return null;

    switch (activePerspective) {
      case "admin":
        return (
          <Routes>
            <Route path="/" element={<AdminDashboard userInfo={userInfo} />} />
            <Route path="/ai-configuration/*" element={<AIConfiguration />} />
            <Route path="/disclaimer" element={<AdminDisclaimer />} />
            <Route path="*" element={<AdminDashboard userInfo={userInfo} />} />
          </Routes>
        );
      case "instructor":
        return (
          <Routes>
            <Route
              path="/"
              element={<SupervisorDashboard userInfo={userInfo} />}
            />
            <Route path="/create-case" element={<CreateCase />} />
            <Route path="/prompts/*" element={<SupervisorPrompts />} />
            <Route
              path="*"
              element={<SupervisorDashboard userInfo={userInfo} />}
            />
          </Routes>
        );
      case "student":
      default:
        return (
          <Routes>
            <Route path="/" element={<AdvocateDashboard />} />
            <Route path="/create-case" element={<CreateCase />} />
            <Route path="*" element={<AdvocateDashboard />} />
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
    <UserProvider value={{ userInfo, setUserInfo, activePerspective, setActivePerspective, availablePerspectives }}>
      <RoleLabelsProvider>
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

          {/* Global Components */}
          <DisclaimerModal
            open={showDisclaimer}
            disclaimerText={disclaimerText}
            onAccept={handleAcceptDisclaimer}
            onDecline={handleDeclineDisclaimer}
          />
        </div>
      </NotificationProvider>
      </RoleLabelsProvider>
    </UserProvider>
  );
}

export default App;
