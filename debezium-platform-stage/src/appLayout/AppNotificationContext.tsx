import React, { createContext, useContext, useState } from "react";
import {
  Alert,
  AlertActionCloseButton,
  AlertProps,
  getUniqueId,
} from "@patternfly/react-core";

export interface NotificationProps {
  title: string;
  srTitle: string;
  variant: "success" | "danger" | "warning" | "info";
  key: React.Key;
  timestamp: string;
  description: string;
  isNotificationRead: boolean;
}

interface AppNotificationContextProps {
  notifications: NotificationProps[];
  alerts: React.ReactElement<AlertProps>[];
  isDrawerExpanded: boolean;
  addNotification: (
    variant: NotificationProps["variant"],
    alertHeader: string,
    alertMessage: string
  ) => void;
  removeAlert: (key: React.Key) => void;
  setDrawerExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  setAlerts: React.Dispatch<
    React.SetStateAction<React.ReactElement<AlertProps>[]>
  >;
  setNotifications: React.Dispatch<React.SetStateAction<NotificationProps[]>>;
}

const AppNotificationContext = createContext<
  AppNotificationContextProps | undefined
>(undefined);

const alertTimeout = 8000;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [alerts, setAlerts] = useState<React.ReactElement<AlertProps>[]>([]);
  const [notifications, setNotifications] = useState<NotificationProps[]>([]);
  const [isDrawerExpanded, setDrawerExpanded] = useState(false);

  // const getTimeCreated = () => {
  //   const dateCreated = new Date();
  //   return (
  //     dateCreated.toDateString() +
  //     " at " +
  //     ("00" + dateCreated.getHours().toString()).slice(-2) +
  //     ":" +
  //     ("00" + dateCreated.getMinutes().toString()).slice(-2)
  //   );
  // };

  const removeAlert = (key: React.Key) => {
    setAlerts((prevAlerts) =>
      prevAlerts.filter((alert) => alert.props.id !== key.toString())
    );
  };

  const addNotification = (
    variant: NotificationProps["variant"],
    alertHeader: string,
    alertMessage: string
  ) => {
    // const variantFormatted = variant.charAt(0).toUpperCase() + variant.slice(1);
    const title = alertHeader;
    // const srTitle = variantFormatted + " alert";
    const description = alertMessage;
    const key = getUniqueId();
    // const timestamp = getTimeCreated();

    // setNotifications((prevNotifications) => [
    //   {
    //     title,
    //     srTitle,
    //     variant,
    //     key,
    //     timestamp,
    //     description,
    //     isNotificationRead: false,
    //   },
    //   ...prevNotifications,
    // ]);

    if (!isDrawerExpanded) {
      setAlerts((prevAlerts) => [
        <Alert
          variant={variant}
          title={title}
          timeout={alertTimeout}
          onTimeout={() => removeAlert(key)}
          isLiveRegion
          actionClose={
            <AlertActionCloseButton
              title={title}
              variantLabel={`${variant} alert`}
              onClose={() => removeAlert(key)}
            />
          }
          key={key}
          id={key.toString()}
        >
          <p style={{ whiteSpace: 'pre-line' }}>{description}</p>
        </Alert>,
        ...prevAlerts,
      ]);
    }
  };

  return (
    <AppNotificationContext.Provider
      value={{
        notifications,
        alerts,
        isDrawerExpanded,
        addNotification,
        removeAlert,
        setDrawerExpanded,
        setAlerts,
        setNotifications,
      }}
    >
      {children}
    </AppNotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(AppNotificationContext);
  if (!context) {
    throw new Error(
      "useNotification must be used within a NotificationProvider"
    );
  }
  return context;
};
