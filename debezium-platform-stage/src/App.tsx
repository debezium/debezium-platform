import { BrowserRouter as Router } from "react-router-dom";
import "@patternfly/react-core/dist/styles/base.css";
import '@patternfly/react-styles/css/utilities/Spacing/spacing.css';
import { AppLayout } from "./appLayout/AppLayout";
import { AppRoutes } from "./AppRoutes";
import { AppContextProvider } from "./appLayout/AppContext";
import { NotificationProvider } from "./appLayout/AppNotificationContext";
import { GuidedTourProvider } from "./components/GuidedTourContext";
import { ChatContextProvider, ChatWidget } from "./app/chat";

function App() {
  return (
    <Router>
      <ChatContextProvider>
        <AppContextProvider>
          <NotificationProvider>
            <GuidedTourProvider>
              <AppLayout>
                <AppRoutes />
              </AppLayout>
              <ChatWidget />
            </GuidedTourProvider>
          </NotificationProvider>
        </AppContextProvider>
      </ChatContextProvider>
    </Router>
  );
}

export default App;
