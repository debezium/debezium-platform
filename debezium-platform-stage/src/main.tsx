import ReactDOM from 'react-dom/client'
import App from './App.tsx';
import "reactflow/dist/style.css";
import { QueryClient, QueryClientProvider } from 'react-query';
import './index.css'
import { StrictMode, Suspense } from 'react';
import './i18n';

// Create a client 
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <Suspense fallback="loading">
      <StrictMode>
        <App />
      </StrictMode>

    </Suspense>
  </QueryClientProvider>

)
