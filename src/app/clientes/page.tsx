"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { QuickSearchModal } from "@/components/layout/QuickSearchModal";
import { ClientsTable } from "@/components/modules/clients/ClientsTable";
import { ClientProfile360 } from "@/components/modules/clients/ClientProfile360";
import { ClientModal } from "@/components/modules/clients/ClientModal";
import { useApp } from "@/lib/state";
import { canAccessModule } from "@/lib/permissions";
import { ShieldAlert } from "lucide-react";
import { Client } from "@/types";

function ClientesContent() {
  const { currentUser, clients } = useApp();
  const searchParams = useSearchParams();
  const clientIdFromUrl = searchParams.get("id");
  const tabFromUrl = searchParams.get("tab");

  // Selected client for 360 view
  const [selectedClient, setSelectedClient] = useState<Client | null>(() => {
    if (clientIdFromUrl) {
      return clients.find((c) => c.id === clientIdFromUrl) || null;
    }
    return null;
  });
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  // Escuchar evento del menú principal (Sidebar) para regresar al listado de clientes
  useEffect(() => {
    const handleReset = () => {
      setSelectedClient(null);
      setClientToEdit(null);
      if (typeof window !== "undefined") {
        window.history.pushState({}, "", "/clientes");
      }
    };

    window.addEventListener("inntel:reset-client-selection", handleReset);
    return () => {
      window.removeEventListener("inntel:reset-client-selection", handleReset);
    };
  }, []);

  // Catálogo vigente en una referencia: el efecto de URL no depende de `clients`
  // para no reiniciar la ficha cada vez que cambian los contadores de servicios.
  const clientsRef = useRef(clients);
  clientsRef.current = clients;

  // Cargar cliente desde parámetro de URL si cambia (?id=...) sin desmontar por cambios en otros estados
  useEffect(() => {
    if (clientIdFromUrl) {
      const match = clientsRef.current.find((c) => c.id === clientIdFromUrl);
      if (match) {
        setSelectedClient((prev) => (prev?.id === match.id ? prev : match));
      }
    } else {
      setSelectedClient(null);
    }
  }, [clientIdFromUrl]);

  // Reintento de enlace profundo cuando los clientes aún no se habían hidratado.
  // Solo actúa si no hay ficha abierta: nunca reemplaza una selección existente.
  useEffect(() => {
    if (!clientIdFromUrl || selectedClient) return;
    const match = clients.find((c) => c.id === clientIdFromUrl);
    if (match) setSelectedClient(match);
  }, [clients, clientIdFromUrl, selectedClient]);

  // Mantener datos del cliente actualizados si cambia en la base de datos o estado global
  // (por ejemplo al agregar/editar servicios) SIN desmontar la pantalla ni cerrar la ficha
  useEffect(() => {
    if (selectedClient) {
      const updated = clients.find((c) => c.id === selectedClient.id);
      if (updated && updated !== selectedClient) {
        setSelectedClient(updated);
      }
      if (!updated) setSelectedClient(null);
    }
  }, [clients, selectedClient?.id]);

  const handleSelectClient = (c: Client) => {
    setSelectedClient(c);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.pathname = "/clientes";
      url.searchParams.set("id", c.id);
      window.history.pushState({}, "", url.toString());
    }
  };

  const handleCloseProfile = () => {
    setSelectedClient(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.pathname = "/clientes";
      url.searchParams.delete("id");
      url.searchParams.delete("tab");
      window.history.pushState({}, "", url.pathname);
    }
  };

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
            <div className="p-8 bg-white border border-[#e2e8f0] rounded-xl text-center max-w-lg mx-auto my-12 space-y-3">
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
              {/* Main Content */}
              <div className="w-full">
                {selectedClient ? (
                  <ClientProfile360
                    client={clients.find((c) => c.id === selectedClient.id) || selectedClient}
                    onClose={handleCloseProfile}
                    onEdit={() => handleEdit(clients.find((c) => c.id === selectedClient.id) || selectedClient)}
                    initialTab={(tabFromUrl as any) || undefined}
                    onTabChange={(tab) => {
                      if (typeof window !== "undefined") {
                        const url = new URL(window.location.href);
                        url.searchParams.set("tab", tab);
                        window.history.replaceState({}, "", url.toString());
                      }
                    }}
                  />
                ) : (
                  <ClientsTable
                    onSelectClient={handleSelectClient}
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
