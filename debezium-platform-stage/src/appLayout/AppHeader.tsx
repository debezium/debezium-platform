import {
  Masthead,
  MastheadToggle,
  MastheadMain,
  MastheadBrand,
  Brand,
  MastheadContent,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  // Avatar,
  NotificationBadge,
  NotificationBadgeVariant,
  PageToggleButton,
  MastheadLogo,
  MenuToggleElement,
  MenuToggle,
  DropdownItem,
  Dropdown,
  DropdownList,
} from "@patternfly/react-core";
import { BarsIcon } from "@patternfly/react-icons";
import React, { useEffect, useState } from "react";
import dbz_logo_black from "../assets/color_black_debezium.svg";
import dbz_svg from "../assets/debezium_logo.png";
import { useNavigate } from "react-router-dom";
import { useData } from "./AppContext";
import { NotificationProps } from "./AppNotificationContext";
import SystemThemeIcon from "src/assets/customeIcons/SystemThemeIcon";
import LightThemeIcon from "src/assets/customeIcons/LightThemeIcon";
import DarkThemeIcon from "src/assets/customeIcons/DarkThemeIcon";
import { useTranslation } from "react-i18next";

interface AppHeaderProps {
  toggleSidebar: () => void;
  handleNotificationBadgeClick: () => void;
  getNotificationBadgeVariant: () => unknown;
  addNotification: (
    variant: NotificationProps["variant"],
    alertHeader: string,
    alertMessage: string
  ) => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  toggleSidebar,
  handleNotificationBadgeClick,
  getNotificationBadgeVariant,
}) => {
  const { darkMode, setDarkMode } = useData();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);


  const onSelect = (_event: React.MouseEvent<Element, MouseEvent> | undefined, value: string | number | undefined) => {
    setSelectedTheme(value as string);
    setIsThemeDropdownOpen(false);
    toggleDarkMode(value as string);
  };

  const onThemeDropdownToggle = () => {
    setIsThemeDropdownOpen(!isThemeDropdownOpen);
  };

  const navigateTo = (url: string) => {
    navigate(url);
  };
  const getThemeIcon = (theme: string) => {
    switch (theme) {
      case 'light':
        return <LightThemeIcon color="var(--pf-global--Color--100)" />;
      case 'dark':
        return <DarkThemeIcon color="var(--pf-global--Color--100)" />;
      default:
        return <SystemThemeIcon color="var(--pf-global--Color--100)" />;
    }
  };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      onClick={onThemeDropdownToggle}
      isExpanded={isThemeDropdownOpen}
    >
      {getThemeIcon(selectedTheme || 'system')}
    </MenuToggle>
  );
  console.log("system dark theme",window.matchMedia('(prefers-color-scheme: dark)').matches);
  console.log("locally set theme",localStorage.getItem("themeMode"));

  const toggleDarkMode = (val: string) => {
    let newDarkMode = val === "dark";
    if (val === "system") {
      newDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    setDarkMode(newDarkMode);
    localStorage.setItem("themeMode", val);
    if (newDarkMode) {
      if (!document.documentElement.classList.contains("pf-v6-theme-dark")) {
        document.documentElement.classList.add("pf-v6-theme-dark");
      }
    } else {
      document.documentElement.classList.remove("pf-v6-theme-dark");
    }
  };
  useEffect(() => {
    const storedThemeMode = localStorage.getItem("themeMode");
    setSelectedTheme(storedThemeMode || "system");
    toggleDarkMode(storedThemeMode || "system");
  }, []);

  return (
    <>
      <Masthead>
        <MastheadMain>
          <MastheadToggle>
            <PageToggleButton
              variant="plain"
              aria-label="Global navigation"
              onClick={toggleSidebar}
            >
              <BarsIcon />
            </PageToggleButton>
          </MastheadToggle>
          <MastheadBrand>
            <MastheadLogo>
              <Brand
                src={!darkMode ? dbz_logo_black : dbz_svg}
                alt="Debezium Logo"
                heights={{ default: "36px" }}
                onClick={() => navigateTo("/")}
                style={{ cursor: "pointer" }}
              />
            </MastheadLogo>
          </MastheadBrand>
        </MastheadMain>
        <MastheadContent>
          <Toolbar id="masthead-toggle" isStatic isFullHeight >
            <ToolbarContent style={{ display: "flex", justifyContent: "flex-end" }}>
              <ToolbarGroup
                variant="action-group-plain"
              >
                <ToolbarItem visibility={{ default: 'hidden', md: 'visible' }}>
                  <Dropdown
                    id="single-select"
                    isOpen={isThemeDropdownOpen}
                    selected={selectedTheme}
                    onSelect={onSelect}
                    onOpenChange={(isOpen) => setIsThemeDropdownOpen(isOpen)}
                    toggle={toggle}
                    popperProps={{ flipBehavior: ['bottom', 'bottom-start'], position: 'right' }}
                  >
                    <DropdownList>
                      <DropdownItem value="system" icon={<SystemThemeIcon color="var(--pf-global--Color--100)" />} description={t('systemPreference')}>{t('system')}</DropdownItem>
                      <DropdownItem value="light" icon={<LightThemeIcon color="var(--pf-global--Color--100)" />} description={t('lightMode')}>{t('light')}</DropdownItem>
                      <DropdownItem value="dark" icon={<DarkThemeIcon color="var(--pf-global--Color--100)" />} description={t('darkMode')}>{t('dark')}</DropdownItem>
                    </DropdownList>
                  </Dropdown>
                </ToolbarItem>
              </ToolbarGroup>
              <ToolbarItem variant="separator" />

              <ToolbarGroup
                variant="action-group-plain"
              >
                <ToolbarItem>
                  <NotificationBadge
                    variant={
                      getNotificationBadgeVariant() as
                      | NotificationBadgeVariant
                      | "read"
                      | "unread"
                      | "attention"
                      | undefined
                    }
                    onClick={handleNotificationBadgeClick}
                    aria-label="Notifications"
                  ></NotificationBadge>
                </ToolbarItem>
              </ToolbarGroup>
            </ToolbarContent>
          </Toolbar>
        </MastheadContent>
      </Masthead>
    </>
  );
};

export default AppHeader;
