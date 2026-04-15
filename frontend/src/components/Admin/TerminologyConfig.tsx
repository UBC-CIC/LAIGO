import { Box, Divider } from "@mui/material";
import RoleLabelsConfig from "./RoleLabelsConfig";
import CaseTypesConfig from "./CaseTypesConfig";

const TerminologyConfig = () => {
  return (
    <Box
      sx={{
        width: "100%",
        backgroundColor: "var(--paper)",
        border: "1px solid var(--border)",
        borderRadius: 2,
        p: 4,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <RoleLabelsConfig />
      <Divider sx={{ borderColor: "var(--border)" }} />
      <CaseTypesConfig />
    </Box>
  );
};

export default TerminologyConfig;
