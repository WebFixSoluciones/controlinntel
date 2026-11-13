"use client";

import { useApp } from "@/lib/state";
import type { SystemUser } from "@/types";
import { UserFormView } from "./UserFormView";

interface UserPermissionsModalProps {
  user: SystemUser | null;
  isOpen: boolean;
  onClose: () => void;
}

/** The compatibility modal uses the same editor and save path as Personas. */
export function UserPermissionsModal({ user, isOpen, onClose }: UserPermissionsModalProps) {
  const { currentUser, updateSystemUser } = useApp();
  if (!isOpen || !user || currentUser.role !== "superadmin") return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Administrar permisos de usuario">
    <div className="max-h-[92dvh] w-full max-w-7xl overflow-y-auto rounded-xl bg-slate-50 p-3 sm:p-6">
      <UserFormView key={user.uid} user={user} onCancel={onClose} onSave={async (data, modulePermissions) => {
        await updateSystemUser(user.uid, { ...data, modulePermissions });
        onClose();
      }} />
    </div>
  </div>;
}
