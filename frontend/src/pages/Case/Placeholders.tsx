import { Box, Typography } from "@mui/material";

const Placeholder = ({ title }: { title: string }) => (
  <Box p={4}>
    <Typography variant="h4" fontFamily="Outfit">
      {title}
    </Typography>
    <Typography variant="body1" mt={2}>
      Feature coming soon.
    </Typography>
  </Box>
);

export const InterviewAssistant = () => (
  <Placeholder title="Interview Assistant" />
);
export const CaseSummaries = () => <Placeholder title="Case Summaries" />;
export const CaseTranscriptions = () => (
  <Placeholder title="Case Transcriptions" />
);
export const CaseFeedback = () => <Placeholder title="Case Feedback" />;
