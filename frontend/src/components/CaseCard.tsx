import React from "react";
import { Card, CardContent, Typography, Box, IconButton, Menu, MenuItem } from "@mui/material";
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArchiveIcon from '@mui/icons-material/Archive';

interface CaseCardProps {
  caseId: string;
  title: string;
  status: string;
  jurisdiction: string;
  dateAdded: string;
  onDelete?: (caseId: string) => void;
  onArchive?: (caseId: string) => void;
}

const CaseCard: React.FC<CaseCardProps> = ({
  caseId,
  title,
  status,
  jurisdiction,
  dateAdded,
  onDelete,
  onArchive,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleEllipsisClick = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleEllipsisClose = () => setAnchorEl(null);
  const handleDelete = () => {
    handleEllipsisClose();
    if (onDelete) onDelete(caseId);
  };
  const handleArchive = () => {
    handleEllipsisClose();
    if (onArchive) onArchive(caseId);
  };

  return (
    <Card
      sx={{
        backgroundColor: "var(--background)", // card background
        color: "var(--text)",
        border: "1px solid var(--border)",
        borderRadius: "4px",
        boxShadow: "none",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "flex-start",
        position: 'relative',
        "&:hover": {
          border: "1px solid var(--text-secondary)",
        },
      }}
    >
      <CardContent
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          textAlign: "left",
          width: "100%",
        }}
      >
        <Typography
          variant="caption"
          display="block"
          sx={{ color: "var(--text-secondary)", mb: 1 }}
        >
          Case: #{caseId}
        </Typography>
        <Typography
          variant="h6"
          component="div"
          sx={{
            fontWeight: "bold",
            lineHeight: 1.3,
            mb: 1,
            fontSize: "1.1rem",
          }}
        >
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: status === "In Progress" ? "var(--green-text)" : "#ffa726",
            fontWeight: "bold",
            mb: 2,
          }}
        >
          {status}
        </Typography>

        <Box sx={{ mt: "auto" }}>
          <Typography
            variant="caption"
            display="block"
            sx={{ color: "var(--text)" }}
          >
            <span style={{ fontWeight: "bold" }}>Jurisdiction:</span>{" "}
            {jurisdiction}
          </Typography>
          <Typography
            variant="caption"
            display="block"
            sx={{ color: "var(--text)" }}
          >
            <span style={{ fontWeight: "bold" }}>Date Added:</span> {dateAdded}
          </Typography>
        </Box>
      </CardContent>

      {/* Ellipsis button for menu */}
      <IconButton
        aria-label="more"
        aria-controls={open ? `case-menu-${caseId}` : undefined}
        aria-haspopup="true"
        onClick={handleEllipsisClick}
        size="small"
        sx={{
          position: 'absolute',
          right: 8,
          bottom: 8,
          color: 'var(--text-secondary)',
          backgroundColor: 'transparent',
          '&:hover': { backgroundColor: 'transparent', color: 'var(--text)' },
          '&:focus': { outline: 'none', boxShadow: 'none' },
          '&:active': { backgroundColor: 'transparent' },
        }}
      >
        <MoreHorizIcon />
      </IconButton>

      <Menu
        id={`case-menu-${caseId}`}
        anchorEl={anchorEl}
        open={open}
        onClose={handleEllipsisClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        disableScrollLock
        PaperProps={{
          sx: {
            backgroundColor: 'var(--background3)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            minWidth: 160,
          }
        }}
      >
        <MenuItem onClick={handleDelete} sx={{ color: 'var(--text)', gap: 1 }}>
          <DeleteOutlineIcon sx={{ mr: 1, color: 'var(--text)' }} />
          Delete
        </MenuItem>
        <MenuItem onClick={handleArchive} sx={{ color: 'var(--text)', gap: 1 }}>
          <ArchiveIcon sx={{ mr: 1, color: 'var(--text)' }} />
          Archive
        </MenuItem>
      </Menu>
    </Card>
  );
};

export default CaseCard;
