import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { getPageContext } from "./pageContextMap";
import { defaultContext } from "./pageContextMap";
import type { PageContext } from "./types";

const ChatContext = createContext<PageContext>(defaultContext);

export function useChatContext(): PageContext {
  return useContext(ChatContext);
}

export interface ChatContextProviderProps {
  children: ReactNode;
}

export function ChatContextProvider({ children }: ChatContextProviderProps) {
  const location = useLocation();
  const pageContext = useMemo(
    () => getPageContext(location.pathname),
    [location.pathname]
  );

  const value = useMemo(() => pageContext, [pageContext.label, pageContext.hint]);

  return (
    <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
  );
}
