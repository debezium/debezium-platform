import React, { createContext, useContext, useState } from "react";

const STORAGE_KEY = "dbz-doc-help-open";

interface DocHelpContextProps {
  isDocHelpOpen: boolean;
  toggleDocHelp: () => void;
  closeDocHelp: () => void;
}

const DocHelpContext = createContext<DocHelpContextProps | undefined>(undefined);

export const DocHelpProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isDocHelpOpen, setIsDocHelpOpen] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) === "true"
  );

  const toggleDocHelp = () => {
    setIsDocHelpOpen((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  const closeDocHelp = () => {
    setIsDocHelpOpen(false);
    localStorage.setItem(STORAGE_KEY, "false");
  };

  return (
    <DocHelpContext.Provider value={{ isDocHelpOpen, toggleDocHelp, closeDocHelp }}>
      {children}
    </DocHelpContext.Provider>
  );
};

export function useDocHelp(): DocHelpContextProps {
  const ctx = useContext(DocHelpContext);
  if (!ctx) {
    throw new Error("useDocHelp must be used within a DocHelpProvider");
  }
  return ctx;
}
