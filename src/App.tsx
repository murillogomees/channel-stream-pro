import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminCustomize from "./pages/AdminCustomize";
import AdminClientes from "./pages/AdminClientes";
import AdminClienteForm from "./pages/AdminClienteForm";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/customize" element={<AdminCustomize />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/clientes" element={<AdminClientes />} />
        <Route path="/admin/clientes/novo" element={<AdminClienteForm />} />
        <Route path="/admin/clientes/editar/:id" element={<AdminClienteForm />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
