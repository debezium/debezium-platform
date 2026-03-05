import ReactDOM from 'react-dom/client'
import App from './App.tsx';
import "reactflow/dist/style.css";
import { QueryClient, QueryClientProvider } from 'react-query';
import { Provider as JotaiProvider } from 'jotai';
import './index.css';
import './styles/shared.css';
import { StrictMode, Suspense } from 'react';
import './i18n';

// Create a client 
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <JotaiProvider>
      <Suspense fallback="loading">
        <StrictMode>
          <App />
        </StrictMode>
      </Suspense>
    </JotaiProvider>
  </QueryClientProvider>

)
