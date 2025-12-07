import React, { useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { R2MigrationDashboard } from '@/components/admin/migration/R2MigrationDashboard';

export default function AdminR2MigrationPage() {
  useEffect(() => {
    document.title = 'Migração R2 | Admin';
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Migração para Cloudflare R2</h1>
          <p className="text-muted-foreground">
            Migre assets do Supabase Storage para Cloudflare R2 + CDN para alta performance
          </p>
        </div>

        <R2MigrationDashboard />
      </div>
    </AdminLayout>
  );
}