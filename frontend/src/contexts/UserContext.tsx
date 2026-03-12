import React, { createContext, useContext } from "react";

export interface UserInfo {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  groups: string[];
}

interface UserContextType {
  userInfo: UserInfo | null;
  setUserInfo: (user: UserInfo | null) => void;
  activePerspective: string | null;
  setActivePerspective: (perspective: string | null) => void;
  availablePerspectives: string[];
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{
  children: React.ReactNode;
  value: UserContextType;
}> = ({ children, value }) => {
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
