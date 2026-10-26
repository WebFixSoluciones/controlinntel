import { redirect } from "next/navigation";

export default function BovedaPage() {
  // El módulo independiente de credenciales ha sido retirado.
  // La gestión de contraseñas y accesos se realiza de forma centralizada
  // a través de la pestaña "Bóveda" en la ficha técnica de cada cliente.
  redirect("/clientes");
}
