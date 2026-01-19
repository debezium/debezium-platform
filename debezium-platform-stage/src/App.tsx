import { BrowserRouter as Router } from "react-router-dom";
import "@patternfly/react-core/dist/styles/base.css";
import '@patternfly/react-styles/css/utilities/Spacing/spacing.css';
import { AppLayout } from "./appLayout/AppLayout";
import { AppRoutes } from "./AppRoutes";
import { AppContextProvider } from "./appLayout/AppContext";
import { NotificationProvider } from "./appLayout/AppNotificationContext";
import { ChatbotProvider } from "./components/AIChatbot";

function App() {
  return (
    <Router>
      <AppContextProvider>
        <NotificationProvider>
          <ChatbotProvider>
            <AppLayout>
              <AppRoutes />
            </AppLayout>
          </ChatbotProvider>
        </NotificationProvider>
      </AppContextProvider>
    </Router>
  );
}

export default App;
