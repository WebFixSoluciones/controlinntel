"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { ClientsTable } from "@/components/modules/clients/ClientsTable";
import { ClientProfile360 } from "@/components/modules/clients/ClientProfile360";
import { ClientModal } from "@/components/modules/clients/ClientModal";
import { useApp } from "@/lib/state";
import { canAccessModule } from "@/lib/permissions";
import { Plus, ShieldAlert } from "lucide-react";
import { Client } from "@/types";

function ClientesContent() {
  const { currentUser, clients } = useApp();
  const searchParams = useSearchParams();
  const clientIdFromUrl = searchParams.get("id");

  // Selected client for 360 view
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  // Escuchar evento del menú principal (Sidebar) para regresar al listado de clientes
  useEffect(() => {
    const handleReset = () => {
      setSelectedClient(null);
      setClientToEdit(null);
      if (typeof window !== "undefined" && window.location.search) {
        window.history.pushState({}, "", "/clientes");
      }
    };

    window.addEventListener("inntel:reset-client-selection", handleReset);
    return () => {
      window.removeEventListener("inntel:reset-client-selection", handleReset);
    };
  }, []);

  // Cargar cliente desde parámetro de URL si existe (?id=...)
  useEffect(() => {
    if (clientIdFromUrl) {
      const match = clients.find((c) => c.id === clientIdFromUrl);
      if (match) {
        setSelectedClient(match);
      }
    } else {
      setSelectedClient(null);
    }
  }, [clientIdFromUrl, clients]);

  const canAccessClientes = canAccessModule(currentUser, "abonados");

  const handleEdit = (client: Client) => {
    setClientToEdit(client);
    setIsNewModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsNewModalOpen(false);
    setClientToEdit(null);
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto w-full min-w-0">
          {!canAccessClientes ? (
            <div className="p-8 bg-white border border-[#e2e8f0] rounded-2xl text-center max-w-lg mx-auto my-12 space-y-3">
              <div className="w-12 h-12 bg-[#fee2e2] text-[#dc2626] rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-[#0b1c30]">Acceso Restringido</h2>
              <p className="text-xs text-[#737686]">
                Tu rol actual no tiene autorización para acceder al Módulo de Clientes. Consulta con tu administrador.
              </p>
            </div>
          ) : (
            <>
              {/* Action Toolbar */}
              {!selectedClient && (
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => {
                      setClientToEdit(null);
                      setIsNewModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nuevo Cliente</span>
                  </button>
                </div>
              )}

              {/* Main Content */}
              <div className="w-full">
                {selectedClient ? (
                  <ClientProfile360
                    client={clients.find((c) => c.id === selectedClient.id) || selectedClient}
                    onClose={() => setSelectedClient(null)}
                    onEdit={() => handleEdit(clients.find((c) => c.id === selectedClient.id) || selectedClient)}
                  />
                ) : (
                  <ClientsTable
                    onSelectClient={(c) => setSelectedClient(c)}
                    onOpenNewModal={() => {
                      setClientToEdit(null);
                      setIsNewModalOpen(true);
                    }}
                    onEditClient={handleEdit}
                  />
                )}
              </div>

              {/* New/Edit Modal */}
              <ClientModal
                key={clientToEdit ? clientToEdit.id : "new-client"}
                isOpen={isNewModalOpen}
                onClose={handleCloseModal}
                clientToEdit={clientToEdit}
              />
            </>
          )}
        </main>

        {/* Institutional Footer */}
        <footer className="px-8 py-4 bg-white border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#737686] select-none">
          <a
            href="https://www.inntelcorp.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#004ac6] font-medium transition-colors"
          >
            &copy; 2026 INNTEL CORP S.A. • Módulo de Clientes • www.inntelcorp.com
          </a>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-[#004ac6] transition-colors">
              Soporte
            </a>
            <a href="#" className="hover:text-[#004ac6] transition-colors">
              Privacidad
            </a>
            <a href="#" className="hover:text-[#004ac6] transition-colors">
              Términos
            </a>
          </div>
        </footer>
      </div>

      <QuickSearchModal />
    </div>
  );
}

export default function ClientesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8f9ff]" />}>
      <ClientesContent />
    </Suspense>
  );
}
