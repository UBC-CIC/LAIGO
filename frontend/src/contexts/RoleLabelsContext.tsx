import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { fetchAuthSession } from "aws-amplify/auth";

export interface RoleLabel {
  singular: string;
  plural: string;
}

export type RoleLabels = Record<string, RoleLabel>;

const DEFAULTS: RoleLabels = {
  student:    { singular: "Advocate",   plural: "Advocates"   },
  instructor: { singular: "Supervisor", plural: "Supervisors" },
  admin:      { singular: "Admin",      plural: "Admins"      },
};

interface RoleLabelsContextType {
  /** Singular display name for a canonical role key, e.g. singular("student") → "Advocate" */
  singular: (key: string) => string;
  /** Plural display name for a canonical role key, e.g. plural("instructor") → "Supervisors" */
  plural: (key: string) => string;
  /** Raw label map — useful for the admin editor */
  rawLabels: RoleLabels;
  /** Refresh labels from the API (call after a successful PUT) */
  refreshLabels: () => Promise<void>;
}

const RoleLabelsContext = createContext<RoleLabelsContextType | undefined>(
  undefined,
);

export const RoleLabelsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [labels, setLabels] = useState<RoleLabels>(DEFAULTS);

  const fetchLabels = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) return;

      const res = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}/student/role_labels`,
        { headers: { Authorization: token } },
      );
      if (!res.ok) return;

      const data: RoleLabels = await res.json();
      setLabels({ ...DEFAULTS, ...data });
    } catch {
      // Keep defaults on network error
    }
  }, []);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const singular = (key: string) =>
    labels[key]?.singular ?? DEFAULTS[key]?.singular ?? key;

  const plural = (key: string) =>
    labels[key]?.plural ?? DEFAULTS[key]?.plural ?? key;

  return (
    <RoleLabelsContext.Provider
      value={{ singular, plural, rawLabels: labels, refreshLabels: fetchLabels }}
    >
      {children}
    </RoleLabelsContext.Provider>
  );
};

export const useRoleLabels = (): RoleLabelsContextType => {
  const ctx = useContext(RoleLabelsContext);
  if (!ctx) {
    throw new Error("useRoleLabels must be used within a RoleLabelsProvider");
  }
  return ctx;
};
