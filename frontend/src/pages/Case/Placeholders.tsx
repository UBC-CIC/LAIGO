import { Box, Typography } from "@mui/material";

export const Placeholder = ({ title }: { title: string }) => (
  <Box p={4}>
    <Typography variant="h4" fontFamily="Outfit">
      {title}
    </Typography>
    <Typography variant="body1" mt={2}>
      Feature coming soon.
    </Typography>
  </Box>
);

import { Outlet } from "react-router-dom";

export const InterviewAssistant = () => <Outlet />;
export const CaseSummaries = () => <Placeholder title="Case Summaries" />;
export const CaseTranscriptions = () => (
  <Placeholder title="Case Transcriptions" />
);
