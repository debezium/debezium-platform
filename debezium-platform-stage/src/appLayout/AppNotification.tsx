import {
  NotificationDrawer,
  NotificationDrawerHeader,
  Dropdown,
  MenuToggleElement,
  MenuToggle,
  DropdownList,
  NotificationDrawerBody,
  NotificationDrawerList,
  NotificationDrawerListItem,
  NotificationDrawerListItemHeader,
  NotificationDrawerListItemBody,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  DropdownItem,
} from "@patternfly/react-core";
import { EllipsisVIcon, SearchIcon } from "@patternfly/react-icons";
import React, { useState } from "react";
import { NotificationProps } from "./AppNotificationContext";
interface AppNotificationProps {
  // Define the props for your component here
  notifications: NotificationProps[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationProps[]>>;
  setDrawerExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

const AppNotification: React.FC<AppNotificationProps> = ({
  notifications,
  setNotifications,
  setDrawerExpanded,
}) => {
  const [openDropdownKey, setOpenDropdownKey] = useState<React.Key | null>(
    null
  );

  const removeNotification = (key: React.Key) => {
    setNotifications((prevNotifications) =>
      prevNotifications.filter((notification) => notification.key !== key)
    );
  };

  const removeAllNotifications = () => {
    setNotifications([]);
  };

  const isNotificationRead = (key: React.Key) =>
    notifications.find((notification) => notification.key === key)
      ?.isNotificationRead;

  const markNotificationRead = (key: React.Key) => {
    setNotifications((prevNotifications) =>
      prevNotifications.map((notification) =>
        notification.key === key
          ? { ...notification, isNotificationRead: true }
          : notification
      )
    );
  };

  const markAllNotificationsRead = () => {
    setNotifications((prevNotifications) =>
      prevNotifications.map((notification) => ({
        ...notification,
        isNotificationRead: true,
      }))
    );
  };

  const getUnreadNotificationsNumber = () =>
    notifications.filter(
      (notification) => notification.isNotificationRead === false
    ).length;

  const onDropdownToggle = (id: React.Key) => {
    if (id && openDropdownKey !== id) {
      setOpenDropdownKey(id);
      return;
    }
    setOpenDropdownKey(null);
  };

  const onDropdownSelect = () => {
    setOpenDropdownKey(null);
  };

  const notificationDrawerActions = (
    <>
      <DropdownItem key="markAllRead" onClick={markAllNotificationsRead}>
        Mark all read
      </DropdownItem>
      <DropdownItem key="clearAll" onClick={removeAllNotifications}>
        Clear all
      </DropdownItem>
    </>
  );
  const notificationDrawerDropdownItems = (key: React.Key) => [
    <DropdownItem
      key={`markRead-${key}`}
      onClick={() => markNotificationRead(key)}
    >
      Mark as read
    </DropdownItem>,
    <DropdownItem key={`clear-${key}`} onClick={() => removeNotification(key)}>
      Clear
    </DropdownItem>,
  ];

  return (
    <NotificationDrawer>
      <NotificationDrawerHeader
        count={getUnreadNotificationsNumber()}
        onClose={() => setDrawerExpanded(false)}
      >
        <Dropdown
          id="notification-drawer-0"
          isOpen={openDropdownKey === "dropdown-toggle-id-0"}
          onSelect={onDropdownSelect}
          popperProps={{ position: "right" }}
          onOpenChange={(isOpen: boolean) =>
            !isOpen && setOpenDropdownKey(null)
          }
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              ref={toggleRef}
              isExpanded={openDropdownKey === "dropdown-toggle-id-0"}
              variant="plain"
              onClick={() => onDropdownToggle("dropdown-toggle-id-0")}
              aria-label="Notification drawer actions"
            >
              <EllipsisVIcon aria-hidden="true" />
            </MenuToggle>
          )}
        >
          <DropdownList>{notificationDrawerActions}</DropdownList>
        </Dropdown>
      </NotificationDrawerHeader>
      <NotificationDrawerBody>
        {notifications.length !== 0 && (
          <NotificationDrawerList>
            {notifications.map(
              (
                { key, variant, title, srTitle, description, timestamp },
                index
              ) => (
                <NotificationDrawerListItem
                  key={key}
                  variant={variant}
                  isRead={isNotificationRead(key)}
                  onClick={() => markNotificationRead(key)}
                >
                  <NotificationDrawerListItemHeader
                    variant={variant}
                    title={title}
                    srTitle={srTitle}
                  >
                    <Dropdown
                      id={key.toString()}
                      isOpen={openDropdownKey === key}
                      onSelect={onDropdownSelect}
                      popperProps={{ position: "right" }}
                      onOpenChange={(isOpen: boolean) =>
                        !isOpen && setOpenDropdownKey(null)
                      }
                      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                        <MenuToggle
                          ref={toggleRef}
                          isExpanded={openDropdownKey === key}
                          variant="plain"
                          onClick={() => onDropdownToggle(key)}
                          aria-label={`Notification ${index + 1} actions`}
                        >
                          <EllipsisVIcon aria-hidden="true" />
                        </MenuToggle>
                      )}
                    >
                      <DropdownList>
                        {notificationDrawerDropdownItems(key)}
                      </DropdownList>
                    </Dropdown>
                  </NotificationDrawerListItemHeader>
                  <NotificationDrawerListItemBody timestamp={timestamp}>
                    {description}{" "}
                  </NotificationDrawerListItemBody>
                </NotificationDrawerListItem>
              )
            )}
          </NotificationDrawerList>
        )}
        {notifications.length === 0 && (
          <EmptyState
            headingLevel="h2"
            titleText="No notifications found"
            icon={SearchIcon}
            variant={EmptyStateVariant.full}
          >
            <EmptyStateBody>
              There are currently no notifications.
            </EmptyStateBody>
          </EmptyState>
        )}
      </NotificationDrawerBody>
    </NotificationDrawer>
  );
};

export default AppNotification;
