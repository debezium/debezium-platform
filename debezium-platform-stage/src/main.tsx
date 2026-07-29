import ReactDOM from 'react-dom/client'
import App from './App.tsx';
import "@xyflow/react/dist/style.css";
import { QueryClient, QueryClientProvider } from 'react-query';
import './index.css';
import './styles/shared.css';
import { StrictMode, Suspense } from 'react';
import './i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <Suspense fallback={null}>
      <StrictMode>
        <App />
      </StrictMode>
    </Suspense>
  </QueryClientProvider>
)
