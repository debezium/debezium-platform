import { BrowserRouter as Router } from "react-router-dom";
import "@patternfly/react-core/dist/styles/base.css";
import { AppLayout } from "./appLayout/AppLayout";
import { AppRoutes } from "./AppRoutes";
import { AppContextProvider } from "./appLayout/AppContext";
import { NotificationProvider } from "./appLayout/AppNotificationContext";

function App() {
  return (
    <Router>
      <AppContextProvider>
        <NotificationProvider>
      <AppLayout>
        <AppRoutes />
      </AppLayout>
      </NotificationProvider>
      </AppContextProvider>
    </Router>
  );
}

export default App;
