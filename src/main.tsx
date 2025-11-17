import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";
import { SettingsProvider } from "./context/SettingsContext";
import { AuthProvider } from "./contexts/AuthContext";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </AuthProvider>
  </QueryClientProvider>
);
