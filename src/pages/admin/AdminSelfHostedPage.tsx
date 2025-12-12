/**
 * Admin Self-Hosted Migration Page
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SelfHostedMigrationDashboard from '@/components/admin/SelfHostedMigrationDashboard';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const AdminSelfHostedPage = () => {
  const { user, isMaster } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only master users can access this page
    if (user && !isMaster) {
      navigate('/admin/dashboard');
    }
  }, [user, isMaster, navigate]);

  if (!user || !isMaster) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Acesso restrito a usuários master.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/admin/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Dashboard
        </Button>
      </div>
      
      <SelfHostedMigrationDashboard />
    </div>
  );
};

export default AdminSelfHostedPage;
