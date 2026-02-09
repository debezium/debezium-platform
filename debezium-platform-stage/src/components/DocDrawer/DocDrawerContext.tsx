import React, { createContext, useCallback, useContext, useState } from "react";

interface DocDrawerState {
  isOpen: boolean;
  url: string | null;
  title: string | null;
  openDoc: (url: string, title?: string) => void;
  closeDoc: () => void;
}

const DocDrawerContext = createContext<DocDrawerState>({
  isOpen: false,
  url: null,
  title: null,
  openDoc: () => {},
  closeDoc: () => {},
});

export const useDocDrawer = () => useContext(DocDrawerContext);

export const DocDrawerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);

  const openDoc = useCallback((docUrl: string, docTitle?: string) => {
    setUrl(docUrl);
    setTitle(docTitle || "Documentation");
    setIsOpen(true);
  }, []);

  const closeDoc = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <DocDrawerContext.Provider value={{ isOpen, url, title, openDoc, closeDoc }}>
      {children}
    </DocDrawerContext.Provider>
  );
};
