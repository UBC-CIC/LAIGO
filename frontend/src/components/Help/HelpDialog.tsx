import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

const FAQ_ITEMS = [
  {
    question: "How does the progression work?",
    answer:
      "The case simulation is structured in sequential blocks. You are currently restricted to a specific phase and must satisfy its requirements before the next section of the case becomes available.",
  },
  {
    question: "How do I unlock the next block?",
    answer:
      "Engage naturally with the Assistant by asking questions and analyzing the case facts. The system analyzes your conversation depth and coverage of key legal concepts to determine when you are ready to advance.",
  },
  {
    question: "How can I track my progress?",
    answer:
      "A progress bar at the top of the chat visualizes your standing. As you cover more ground in your conversation, this bar will fill up. Reaching 100% will trigger a notification that the next block is unlocked.",
  },
  {
    question: "What is the feedback panel for?",
    answer:
      "The feedback panel on the right is your real-time coach. It offers specific insights into what information you might be missing or which topics require further exploration to complete the current block.",
  },
];

const HelpDialog: React.FC<HelpDialogProps> = ({ open, onClose }) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: "var(--background)",
          border: "1px solid var(--border)",
          borderRadius: 3,
          backgroundImage: "none",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          backgroundColor: "var(--header)",
          color: "var(--text)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          fontFamily: "Outfit",
          py: 2.5,
        }}
      >
        <InfoOutlinedIcon sx={{ color: "var(--primary)" }} />
        How it Works
      </DialogTitle>
      <DialogContent
        sx={{
          backgroundColor: "var(--background)",
          p: 0,
          borderBottom: "none",
        }}
      >
        <Box sx={{ p: 1 }}>
          {FAQ_ITEMS.map((item, index) => (
            <Accordion
              key={index}
              sx={{
                backgroundColor: "transparent",
                backgroundImage: "none",
                boxShadow: "none",
                borderBottom:
                  index !== FAQ_ITEMS.length - 1
                    ? "1px solid var(--border)"
                    : "none",
                "&:before": { display: "none" },
                "&.Mui-expanded": { margin: 0 },
              }}
            >
              <AccordionSummary
                expandIcon={
                  <ExpandMoreIcon sx={{ color: "var(--text-secondary)" }} />
                }
                sx={{
                  "& .MuiAccordionSummary-content": {
                    my: 2,
                  },
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 600,
                    color: "var(--text)",
                    fontFamily: "Outfit",
                  }}
                >
                  {item.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, pb: 2.5 }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                    fontSize: "0.9rem",
                  }}
                >
                  {item.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </DialogContent>
      <DialogActions
        sx={{
          borderTop: "1px solid var(--border)",
          backgroundColor: "var(--header)",
          p: 2,
        }}
      >
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            backgroundColor: "var(--primary)",
            color: "white",
            fontWeight: 600,
            textTransform: "none",
            borderRadius: 2,
            px: 3,
            "&:hover": {
              backgroundColor: "var(--primary-hover)",
              boxShadow: "0 4px 12px rgba(var(--primary-rgb), 0.3)",
            },
          }}
        >
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HelpDialog;
