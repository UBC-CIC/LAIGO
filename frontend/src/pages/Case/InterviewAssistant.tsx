import React, { useEffect } from "react";
import { Box, Container } from "@mui/material";
import { useParams } from "react-router-dom";
import UserMessage from "../../components/Chat/UserMessage";
import AiResponse from "../../components/Chat/AIResponse";
import ChatBar from "../../components/Chat/ChatBar";

const InterviewAssistant: React.FC = () => {
  const { section } = useParams<{ section: string }>();

  // Logic to determine functionality based on 'section' (e.g., "intake-facts", "issue-identification")
  useEffect(() => {
    console.log("Current Interview Section:", section);
  }, [section]);

  // Use CSS variables from index.css for theme consistency
  // Assuming the dark theme uses the variables defined in @media (prefers-color-scheme: dark) or similar class

  return (
    <Box
      sx={{
        width: "100%",
        height: "calc(100vh - 80px)",
        backgroundColor: "var(--background)",
        display: "flex",
        flexDirection: "column",
        color: "var(--text)",
        overflow: "hidden", // Prevent outer scroll
      }}
    >
      {/* Messages Area */}
      <Container
        maxWidth="lg"
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          overflowY: "auto",
          py: 4,
          px: { xs: 2, md: 8 }, // Add more horizontal padding
        }}
      >
        <UserMessage message="What specific gaps in the 'time of offense' timeline need to be addressed to confirm the alibi viability?" />

        <AiResponse message="You could look at gaps such as: When the suspect was last seen, When the offence was estimated to occur, and When the alibi was first documented. Based on the inconsistencies you've noticed, which of these areas feels most significant to investigate further? Could more than one gap be influencing the alibi's viability?" />
      </Container>

      {/* Bottom Bar Area */}
      <Box
        sx={{
          width: "100%",
          pb: 4,
          pt: 2,
          backgroundColor: "var(--background)",
          flexShrink: 0,
        }}
      >
        <Container maxWidth="lg" sx={{ px: { xs: 2, md: 8 } }}>
          <ChatBar />
        </Container>
      </Box>
    </Box>
  );
};

export default InterviewAssistant;
