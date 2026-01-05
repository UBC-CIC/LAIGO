import React from "react";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Divider,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LockIcon from "@mui/icons-material/Lock";
import EditNoteIcon from "@mui/icons-material/EditNote";

const drawerWidth = 220;

interface SideMenuProps {
  caseTitle: string;
  loading: boolean;
  unlockedBlocks: string[];
  onToggleNotepad: () => void;
}

const SideMenu: React.FC<SideMenuProps> = ({
  caseTitle,
  loading,
  unlockedBlocks,
  onToggleNotepad,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { text: "Case Overview", path: "overview" },
    {
      text: "Interview Assistant",
      path: "interview",
      subItems: [
        {
          text: "Intake & Facts",
          path: "interview/intake-facts",
          blockType: "intake",
        },
        {
          text: "Issue Identification",
          path: "interview/issue-identification",
          blockType: "issues",
        },
        {
          text: "Research Strategy",
          path: "interview/research-strategy",
          blockType: "research",
        },
        {
          text: "Argument Construction",
          path: "interview/argument-construction",
          blockType: "argument",
        },
        {
          text: "Contrarian Analysis",
          path: "interview/contrarian-analysis",
          blockType: "contrarian",
        },
        {
          text: "Policy Context",
          path: "interview/policy-context",
          blockType: "policy",
        },
      ],
    },
    { text: "Case Summaries", path: "summaries" },
    { text: "Case Transcriptions", path: "transcriptions" },
    { text: "Case Feedback", path: "feedback" },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: drawerWidth,
          boxSizing: "border-box",
          backgroundColor: "var(--header)",
          color: "var(--text)",
          marginTop: "64px", // Below header approx height
          height: "calc(100% - 64px)",
          borderRight: "1px solid #333",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <Box
        sx={{
          flexGrow: 1,
          overflow: "auto",
          py: 2,
          "&::-webkit-scrollbar": { width: 0, background: "transparent" },
          "-ms-overflow-style": "none", // IE and Edge
          scrollbarWidth: "none", // Firefox
        }}
      >
        {/* Back to Dashboard */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            mt: 2,
            mb: 2,
            px: 2,
            color: "var(--text-secondary)",
            "&:hover": { color: "var(--text-secondary)" },
          }}
          onClick={() => navigate("/")}
        >
          <ArrowBackIcon
            sx={{
              mr: 1,
              fontSize: "1rem",
              color: "var(--text-secondary)",
              display: "inline-flex",
              verticalAlign: "middle",
            }}
          />
          <Typography
            variant="caption"
            fontFamily="Outfit"
            sx={{
              color: "var(--text-secondary)",
              fontSize: "0.7rem",
              display: "inline-flex",
              alignItems: "center",
              lineHeight: 1,
            }}
          >
            Back to Dashboard
          </Typography>
        </Box>

        {/* Case Title */}
        <Typography
          variant="h6"
          fontFamily="Outfit"
          fontWeight="bold"
          sx={{
            mb: 1,
            lineHeight: 1.2,
            px: 2,
            fontSize: "0.95rem",
            textAlign: "left",
            width: "100%",
          }}
        >
          {loading ? "Loading..." : caseTitle}
        </Typography>

        <Divider sx={{ borderColor: "#444", mb: 2, mx: 2 }} />

        {/* Menu Items */}
        <List sx={{ px: 0 }}>
          {menuItems.map((item) => {
            const isActive = location.pathname.includes(item.path);
            const hasSubItems = !!item.subItems && item.subItems.length > 0;
            const isParentOfActiveSub =
              hasSubItems &&
              item.subItems!.some((sub) =>
                location.pathname.includes(sub.path)
              );

            const highlightParent = isActive || isParentOfActiveSub;

            return (
              <React.Fragment key={item.text}>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => navigate(item.path)}
                    sx={{
                      mb: 0.5,
                      borderLeft: highlightParent
                        ? "4px solid #64B5F6"
                        : "4px solid transparent",
                      pl: highlightParent ? 1.5 : 2,
                      "&:hover": {
                        backgroundColor: "rgba(255,255,255,0.05)",
                      },
                    }}
                  >
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontFamily: "Outfit",
                        fontWeight: highlightParent ? 600 : 400,
                        color: highlightParent ? "#64B5F6" : "white",
                        fontSize: "0.95rem",
                      }}
                    />
                  </ListItemButton>
                </ListItem>

                {/* Nested Sub-items */}
                {hasSubItems && highlightParent && (
                  <Box sx={{ ml: 3, borderLeft: "1px solid #444", mb: 1 }}>
                    {item.subItems!.map((sub) => {
                      const isSubActive = location.pathname.includes(sub.path);
                      const isLocked = !!(
                        sub.blockType && !unlockedBlocks.includes(sub.blockType)
                      );
                      return (
                        <ListItem key={sub.text} disablePadding>
                          <ListItemButton
                            disabled={isLocked}
                            onClick={() => !isLocked && navigate(sub.path)}
                            sx={{
                              py: 0.5,
                              ml: 1,
                              pl: 1,
                              borderRadius: 1,
                              backgroundColor: isSubActive
                                ? "rgba(100, 181, 246, 0.15)"
                                : "transparent",
                              "&:hover": {
                                backgroundColor: isLocked
                                  ? "transparent"
                                  : isSubActive
                                  ? "rgba(100, 181, 246, 0.2)"
                                  : "rgba(255,255,255,0.05)",
                              },
                            }}
                          >
                            <ListItemText
                              primary={sub.text}
                              primaryTypographyProps={{
                                fontFamily: "Outfit",
                                fontSize: "0.85rem",
                                color: isSubActive
                                  ? "#64B5F6"
                                  : isLocked
                                  ? "#666"
                                  : "rgba(255,255,255,0.7)",
                              }}
                            />
                            {isLocked && (
                              <LockIcon
                                sx={{ fontSize: 14, color: "#666", mr: 1 }}
                              />
                            )}
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </Box>
                )}
              </React.Fragment>
            );
          })}
        </List>
      </Box>

      {/* Notepad Toggle Button at Bottom */}
      <Box sx={{ borderTop: "1px solid #333" }}>
        <List>
          <ListItem disablePadding>
            <ListItemButton
              onClick={onToggleNotepad}
              sx={{ "&:hover": { backgroundColor: "rgba(255,255,255,0.05)" } }}
            >
              <EditNoteIcon sx={{ color: "white", mr: 2 }} />
              <ListItemText
                primary="Notepad"
                primaryTypographyProps={{
                  fontFamily: "Outfit",
                  fontSize: "0.95rem",
                  color: "white",
                }}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Drawer>
  );
};

export default SideMenu;
