/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  FC,
  useMemo,
  useCallback,
} from "react";

interface AppContextType {
  navigationCollapsed: boolean;
  darkMode: boolean;
  setDarkMode: (darkMode: boolean) => void;
  updateNavigationCollapsed: (collapsed: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [navigationCollapsed, setNavigationCollapsed] = useState(() => {
    const savedPreference = localStorage.getItem("side-nav-collapsed");
    return savedPreference ? JSON.parse(savedPreference) : false;
  });
  const [darkMode, setDarkMode] = useState(false);

  const updateNavigationCollapsed = useCallback(
    (collapsed: boolean) => {
      setNavigationCollapsed(collapsed);
      localStorage.setItem("side-nav-collapsed", JSON.stringify(collapsed));
    },
    [setNavigationCollapsed]
  );

  const value = useMemo(
    () => ({
      navigationCollapsed,
      updateNavigationCollapsed,
      darkMode,
      setDarkMode,
    }),
    [navigationCollapsed, updateNavigationCollapsed, darkMode, setDarkMode]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useData = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useData must be used within a AppContextProvider");
  }
  return context;
};
