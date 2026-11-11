import React, { createContext, useContext, useEffect, useState } from "react";
import { Alert, Button, LoginPage } from "@patternfly/react-core";
import { useTranslation } from "react-i18next";
import { API_URL } from "../utils/constants";
import dbz_logo_black from "../assets/color_black_debezium.svg";
import dbz_logo_white from "../assets/debezium_logo.png";

export type AuthUser = { email: string; name: string };

type AuthState =
  | { status: "loading" }
  | { status: "ok"; user: AuthUser | null }
  | { status: "login" }
  | { status: "denied"; user: AuthUser };

const AuthUserContext = createContext<AuthUser | null>(null);

/** The logged-in user, or null when OIDC is disabled on the conductor. */
export const useAuthUser = () => useContext(AuthUserContext);

export const logoutUrl = () => `${API_URL}/api/auth/logout`;

export const loginUrl = (returnTo: string) =>
  `${API_URL}/api/auth/login?redirect=${encodeURIComponent(returnTo)}`;

// Re-checks periodically so an expired session shows the login screen
const RECHECK_MS = 60_000;

/**
 * Asks the conductor who the user is: 401 shows the login screen, 403 the access denied screen (not in the
 * allowlist), and an anonymous answer (OIDC disabled) renders the app as is. Login is a full-page link because
 * providers do not allow the redirect from fetch (CORS), and it is not automatic so logging out does not
 * immediately log back in through the provider session.
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { t } = useTranslation();
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    const check = async () => {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`);
        if (response.status === 401) {
          setState({ status: "login" });
          return;
        }
        const body = await response.json();
        if (response.status === 403) {
          setState({ status: "denied", user: body });
        } else {
          setState({ status: "ok", user: body.anonymous ? null : body });
        }
      } catch {
        // Conductor unreachable or older than /api/auth: let pages report their own API errors
        setState((s) => (s.status === "loading" ? { status: "ok", user: null } : s));
      }
    };
    check();
    const timer = setInterval(check, RECHECK_MS);
    return () => clearInterval(timer);
  }, []);

  if (state.status === "loading") {
    return null;
  }
  if (state.status === "login" || state.status === "denied") {
    const denied = state.status === "denied";
    // Theme class is set by the blocking script in index.html, before React (and AppContext) mount
    const dark = document.documentElement.classList.contains("pf-v6-theme-dark");
    return (
      <LoginPage
        brandImgSrc={dark ? dbz_logo_white : dbz_logo_black}
        brandImgAlt="Debezium Logo"
        loginTitle={t("loginTitle")}
        loginSubtitle={denied ? undefined : t("loginSubtitle")}
      >
        {denied && (
          <Alert
            isInline
            variant="danger"
            title={t("accessDenied", { val: state.user.email })}
            className="pf-v6-u-mb-md"
          >
            {t("accessDeniedBody")}
          </Alert>
        )}
        <Button
          component="a"
          isBlock
          variant={denied ? "secondary" : "primary"}
          href={
            denied
              ? logoutUrl()
              : loginUrl(window.location.pathname + window.location.search)
          }
        >
          {denied ? t("logout") : t("login")}
        </Button>
      </LoginPage>
    );
  }
  return (
    <AuthUserContext.Provider value={state.user}>
      {children}
    </AuthUserContext.Provider>
  );
};
