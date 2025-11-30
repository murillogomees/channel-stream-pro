/**
 * AdminClientesPage - Hub de gestão de clientes
 * Rota: /admin/clientes
 * Abas: Lista, Novo, Editar, M3U Assignments
 */

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AdminClientes from "../AdminClientes";
import AdminClienteForm from "../AdminClienteForm";
import { useSearchParams } from "react-router-dom";

export default function AdminClientesPage() {
  const [searchParams] = useSearchParams();
  const clienteId = searchParams.get('id');
  const action = searchParams.get('action') || 'lista';
  
  const [activeTab, setActiveTab] = useState(action);

  return (
    <AdminShell 
      title="Gestão de Clientes"
      description="Lista, cadastro e gestão de clientes"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-auto min-w-full sm:min-w-0 p-1 bg-muted/50">
            <TabsTrigger value="lista" className="flex-shrink-0 px-3 py-2 text-sm">
              📋 Lista de Clientes
            </TabsTrigger>
            <TabsTrigger value="novo" className="flex-shrink-0 px-3 py-2 text-sm">
              ➕ Novo Cliente
            </TabsTrigger>
            {clienteId && (
              <TabsTrigger value="editar" className="flex-shrink-0 px-3 py-2 text-sm">
                ✏️ Editar
              </TabsTrigger>
            )}
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="lista" className="space-y-4 mt-4">
          <AdminClientes />
        </TabsContent>

        <TabsContent value="novo" className="space-y-4 mt-4">
          <AdminClienteForm />
        </TabsContent>

        {clienteId && (
          <TabsContent value="editar" className="space-y-4 mt-4">
            <AdminClienteForm />
          </TabsContent>
        )}
      </Tabs>
    </AdminShell>
  );
}
