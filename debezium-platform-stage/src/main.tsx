import ReactDOM from 'react-dom/client'
import App from './App.tsx';
import "reactflow/dist/style.css";
import { QueryClient, QueryClientProvider } from 'react-query';
import './index.css';
import './styles/shared.css';
import { StrictMode, Suspense } from 'react';
import './i18n';

// Create a client 
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
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
