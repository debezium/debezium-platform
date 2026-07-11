import React, { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  Drawer,
  DrawerContent,
  DrawerContentBody,
  DrawerPanelContent,
  DrawerHead,
  DrawerActions,
  DrawerCloseButton,
  Button,
  EmptyState,
  EmptyStateBody,
  Title,
  BackToTop,
} from "@patternfly/react-core";
import { ExternalLinkAltIcon } from "@patternfly/react-icons";
import { DocMapping, resolveDocMapping } from "../docs/docMappings";
import { useDocHelp } from "./DocHelpContext";
import "./DocHelpDrawer.css";

const DRAWER_PANEL_ID = "dbz-doc-help-drawer-panel";

function docHref(mapping: DocMapping): string {
  return mapping.sectionId ? `${mapping.docUrl}#${mapping.sectionId}` : mapping.docUrl;
}

const DocHelpDrawer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isDocHelpOpen, closeDocHelp } = useDocHelp();
  const { pathname } = useLocation();
  const activeMapping = resolveDocMapping(pathname);

  const baseSrc = activeMapping ? docHref(activeMapping) : null;

  // iframeSrc can be overridden by the TOC button (scrollToTop).
  // We pair it with the pathname it was set for so we can detect
  // when the user navigates to a new route and must reset to baseSrc.
  const [iframeSrc, setIframeSrc] = useState<{
    src: string | null;
    forPathname: string;
  }>({ src: baseSrc, forPathname: pathname });

  // When pathname changes, derive a fresh src directly in render (no effect/memo).
  const effectiveSrc =
    iframeSrc.forPathname === pathname ? iframeSrc.src : baseSrc;

  // Close drawer on click outside the panel
  useEffect(() => {
    if (!isDocHelpOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      const panelEl = document.getElementById(DRAWER_PANEL_ID);
      if (panelEl && !panelEl.contains(e.target as Node)) {
        closeDocHelp();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isDocHelpOpen, closeDocHelp]);

  const scrollToTop = useCallback(() => {
    if (activeMapping) {
      // Append a cache-bust timestamp so repeated clicks always remount the iframe
      setIframeSrc({
        src: `${activeMapping.docUrl}?_t=${Date.now()}#toctitle`,
        forPathname: pathname,
      });
    }
  }, [activeMapping, pathname]);

  const panelContent = (
    <DrawerPanelContent id={DRAWER_PANEL_ID} widths={{ default: "width_33" }}>
      <DrawerHead>
        <div className="dbz-doc-drawer-header-title">
          <span className="pf-v6-c-title pf-m-md">
            {/* {activeMapping?.title ?? "Documentation"} */}
            <i>Browse the full documentation on <b>debezium.io</b></i>
          </span>
          {activeMapping && (
            <Button
              variant="link"
              isInline
              component="a"
              href={docHref(activeMapping)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open full documentation in new tab"
            >
              <ExternalLinkAltIcon />
            </Button>
          )}
        </div>
        <DrawerActions>
          <DrawerCloseButton onClick={closeDocHelp} />
        </DrawerActions>
      </DrawerHead>

      <div className="dbz-doc-iframe-container">
        {effectiveSrc ? (
          <>
            <iframe
              key={effectiveSrc}
              src={effectiveSrc}
              title={activeMapping?.title ?? "Documentation"}
              className="dbz-doc-iframe"
              // Deliberately NOT allow-same-origin: combined with
              // allow-scripts, that lets embedded content strip its own
              // sandbox restrictions (a well-known iframe anti-pattern).
              // Docs content doesn't need same-origin access to render or
              // navigate; dropping it costs nothing but closes that hole.
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"

              referrerPolicy="no-referrer"
            />
            <BackToTop
              isAlwaysVisible
              onClick={scrollToTop}
              aria-label="Scroll to table of contents"
              className="dbz-doc-toc-btn"
            />
          </>
        ) : (
          <EmptyState>
            <Title headingLevel="h4" size="md">
              No documentation available
            </Title>
            <EmptyStateBody>
              There is no specific documentation mapped to this page yet.{" "}
              <a
                href="https://debezium.io/documentation/reference/stable/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Browse the full Debezium documentation
                <ExternalLinkAltIcon style={{ marginLeft: "0.25rem" }} />
              </a>
            </EmptyStateBody>
          </EmptyState>
        )}
      </div>
    </DrawerPanelContent>
  );

  return (
    <Drawer isExpanded={isDocHelpOpen} position="end">
      <DrawerContent panelContent={panelContent}>
        <DrawerContentBody>{children}</DrawerContentBody>
      </DrawerContent>
    </Drawer>
  );
};

export default DocHelpDrawer;
