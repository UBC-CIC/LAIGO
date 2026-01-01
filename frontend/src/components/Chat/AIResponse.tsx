import React, { useState } from "react";
import { Box, Typography, Button, IconButton, Stack, List, ListItem } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import CheckIcon from "@mui/icons-material/Check";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

interface AiResponseProps {
  message: string;
}

const AiResponse: React.FC<AiResponseProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = message;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }; 

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        color: "var(--text)",
        maxWidth: "90%",
      }}
    >
      <Typography
        variant="body2"
        component="div"
        sx={{
          textAlign: "left"
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ul: (props: any) => (
              <List component="ul" sx={{ pl: 2, mb: 1, listStyleType: 'disc', listStylePosition: 'outside' }} {...props} />
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ol: (props: any) => (
              <List component="ol" sx={{ pl: 2, mb: 1, listStyleType: 'decimal', listStylePosition: 'outside' }} {...props} />
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            li: (props: any) => (
              <ListItem component="li" sx={{ display: 'list-item', p: 0, mb: 0.5, '&::marker': { color: 'var(--text-secondary)' } }} {...props} />
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            p: (props: any) => (
              <Typography variant="body2" component="p" sx={{ mb: 1 }} {...props} />
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            blockquote: (props: any) => (
              <Box component="blockquote" sx={{ borderLeft: '3px solid rgba(255,255,255,0.06)', pl: 1.5, color: 'var(--text-secondary)', mb: 1 }} {...props} />
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            code: ({ inline, className, children, ...props }: any) =>
              inline ? (
                <Box component="code" sx={{ backgroundColor: 'rgba(255,255,255,0.03)', px: 0.5, borderRadius: 1 }} {...props}>
                  {children}
                </Box>
              ) : (
                <Box component="pre" sx={{ backgroundColor: 'rgba(255,255,255,0.03)', p: 1, borderRadius: 1, overflowX: 'auto' }} {...props}>
                  <code className={className}>{children}</code>
                </Box>
              ),
          }}
        >
          {message}
        </ReactMarkdown>
      </Typography>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
        <IconButton
          size="small"
          disableRipple
          sx={{ color: "var(--text-secondary)", '&.Mui-focusVisible, &:focus, &:focus-visible': { outline: 'none !important', boxShadow: 'none !important', border: 'none !important' } }}
          onClick={copyToClipboard}
          aria-label={copied ? "Copied" : "Copy AI response"}
        >
          {copied ? <CheckIcon fontSize="small" sx={{ color: 'var(--text-secondary)' }} /> : <ContentCopyIcon fontSize="small" />}
        </IconButton> 
        <IconButton size="small" disableRipple sx={{ color: "var(--text-secondary)", '&.Mui-focusVisible, &:focus, &:focus-visible': { outline: 'none !important', boxShadow: 'none !important', border: 'none !important' } }}>
          <VolumeUpIcon fontSize="small" />
        </IconButton> 
        <Button
          variant="outlined"
          size="small"
          disableRipple
          sx={{
            color: "var(--text-secondary)",
            borderColor: "var(--border)",
            textTransform: "none",
            fontSize: "0.7rem",
            borderRadius: 1,
            px: 1.5,
            py: 0.5,
            "&:hover": {
              borderColor: "var(--text-secondary)",
              backgroundColor: "rgba(255,255,255,0.05)",
            },
            '&.Mui-focusVisible, &:focus, &:focus-visible': { outline: 'none !important', boxShadow: 'none !important', border: 'none !important' }
          }}
        >
          GENERATE SUMMARY
        </Button>
      </Stack>
    </Box>
  );
};

export default AiResponse;
