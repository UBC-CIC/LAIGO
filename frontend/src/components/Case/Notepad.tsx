import React, { useState, useRef, useEffect, useCallback } from "react";
import Draggable from "react-draggable";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import {
  Box,
  IconButton,
  Paper,
  Typography,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

import SaveIcon from "@mui/icons-material/Save";

interface NotepadProps {
  initialContent: string;
  onSave: (content: string) => Promise<void> | void;
  onClose: () => void;
}

const Notepad: React.FC<NotepadProps> = ({
  initialContent,
  onSave,
  onClose,
}) => {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState(initialContent);
  const [showSavedIcon, setShowSavedIcon] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size] = useState({ width: 320, height: 400 });
  const nodeRef = useRef(null);

  const handleSave = useCallback(
    async (contentToSave: string) => {
      if (contentToSave === lastSavedContent) return;
      setIsSaving(true);
      setShowSavedIcon(false);
      try {
        await onSave(contentToSave);
        setLastSavedContent(contentToSave);
        setShowSavedIcon(true);
        setTimeout(() => setShowSavedIcon(false), 2000);
      } catch (error) {
        console.error("Notepad save error:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [lastSavedContent, onSave]
  );

  // Debounce save
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSave(content);
    }, 2000);
    return () => clearTimeout(timer);
  }, [content, handleSave]);

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".notepad-handle"
      position={position}
      onStop={(_e, data) => setPosition({ x: data.x, y: data.y })}
    >
      <Paper
        ref={nodeRef}
        sx={{
          position: "fixed",
          zIndex: 1300,
          width: size.width,
          height: size.height,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#fdfd96",
          border: "1px solid #d3d3d3",
          boxShadow: 3,
          overflow: "hidden",
          transition: "height 0.3s ease, width 0.3s ease",
          resize: "both",
        }}
      >
        {/* Header / Handle */}
        <Box
          className="notepad-handle"
          sx={{
            cursor: "move",
            backgroundColor: "#171717",
            borderBottom: "2px solid #333",
            padding: "4px 8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: "40px",
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: "bold", color: "white", userSelect: "none" }}
          >
            Notepad
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {isSaving ? (
              <CircularProgress size={16} sx={{ color: "white", mx: 1 }} />
            ) : showSavedIcon ? (
              <CheckCircleOutlineIcon
                sx={{ color: "#4caf50", fontSize: 18, mx: 1 }}
                titleAccess="Saved"
              />
            ) : (
              content !== lastSavedContent && (
                <Typography
                  variant="caption"
                  sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.65rem" }}
                >
                  Unsaved changes
                </Typography>
              )
            )}
            <IconButton
              size="small"
              onClick={() => handleSave(content)}
              title="Save Now"
              sx={{ color: "white" }}
              disabled={isSaving || content === lastSavedContent}
            >
              <SaveIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={onClose} sx={{ color: "white" }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Content Area */}
        <Box
          sx={{
            flexGrow: 1,
            overflow: "hidden",
            p: 1,
            "& .ql-container": {
              border: "none",
              fontFamily: "monospace",
              fontSize: "1rem",
            },
            "& .ql-toolbar": {
              border: "none",
              borderBottom: "1px solid #ccc",
              backgroundColor: "#fff9c4",
            },
          }}
        >
          <ReactQuill
            theme="snow"
            value={content}
            onChange={setContent}
            modules={{
              toolbar: [
                ["bold", "italic", "underline", "strike"],
                [{ list: "ordered" }, { list: "bullet" }],
                ["clean"],
              ],
            }}
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          />
          {/* CSS Override for the lines */}
          <style>{`
                .ql-container.ql-snow {
                    border: none !important;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden !important; /* Hide container overflow */
                }
                .ql-toolbar.ql-snow {
                    border: none !important;
                    border-bottom: 2px solid #aa0000 !important;
                    background-color: #fdfd96;
                    flex-shrink: 0; /* Keep toolbar fixed size */
                    text-align: left !important;
                    display: flex;
                    justify-content: flex-start;
                    flex-wrap: wrap;
                    padding-left: 0 !important;
                    padding-top: 0 !important;
                }
                
                /* The scrollable editor area */
                .ql-editor {
                     height: 100%;
                     overflow-y: auto;
                     /* Legal pad yellow */
                     background-color: #fdfd96;
                     /* Blue lines */
                     background-image: repeating-linear-gradient(
                        transparent,
                        transparent 31px,
                        #99cccc 31px,
                        #99cccc 32px
                      );
                      background-attachment: local;
                      line-height: 32px !important;
                      padding: 0 16px !important; /* Reset padding to align first line */
                      padding-top: 4px !important; /* Tweaked to sit on line */
                      font-size: 16px;
                      font-family: 'Courier New', Courier, monospace; /* Monospace helps, but not strictly required */
                      color: #2b2b2b;
                }
                
                /* Force block elements to match the grid */
                .ql-editor p, 
                .ql-editor ol, 
                .ql-editor ul, 
                .ql-editor li {
                    margin: 0;
                    padding: 0;
                    line-height: 32px !important;
                }
                
                /* List handling */
                .ql-editor ol, .ql-editor ul {
                    padding-left: 1.5em !important;
                }
                .ql-editor li {
                    padding-left: 0; 
                }

                /* Scrollbar Customization */
                .ql-editor::-webkit-scrollbar {
                    width: 8px; /* Slightly wider for the pill look */
                }
                
                .ql-editor::-webkit-scrollbar-track {
                    background: transparent; 
                }
                
                .ql-editor::-webkit-scrollbar-thumb {
                    background-color: rgba(0, 0, 0, 0.2);
                    border-radius: 4px;
                }
                .ql-editor::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(0, 0, 0, 0.3);
                }

                .ql-editor::-webkit-scrollbar-button {
                    display: none;
                }
            `}</style>
        </Box>
      </Paper>
    </Draggable>
  );
};

export default Notepad;
