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
} from "@patternfly/react-core";
import { BarsIcon } from "@patternfly/react-icons";
import React from "react";
import dbz_logo_black from "../assets/color_black_debezium.svg";
import dbz_svg from "../assets/debezium_logo.png";
// import imgAvatar from "@patternfly/react-core/src/components/assets/avatarImg.svg";
import { useNavigate } from "react-router-dom";
import { useData } from "./AppContext";
import { NotificationProps } from "./AppNotificationContext";

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
  const navigate = useNavigate();

  const { darkMode } = useData();

  const navigateTo = (url: string) => {
    navigate(url);
  };

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
          <Toolbar id="masthead-toggle" isStatic isFullHeight>
            <ToolbarContent>
              <ToolbarGroup
                variant="action-group-plain"
                align={{ default: "alignEnd" }}
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

              {/*
              // TODO: Add user avatar when multi tenancy is implemented
              <ToolbarItem variant="separator" />

              <ToolbarItem>
                <Avatar src={imgAvatar} alt="user avatar" />
              </ToolbarItem> */}
            </ToolbarContent>
          </Toolbar>
        </MastheadContent>
      </Masthead>
    </>
  );
};

export default AppHeader;
