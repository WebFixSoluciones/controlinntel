/** Commercial issuer details needed for quotations; excludes tax and delivery settings. */
export function quoteCompanyDetails(value: Record<string, unknown>) {
  const fields = ["id", "razonSocial", "nombreComercial", "ruc", "direccionMatriz", "direccionEstablecimiento",
    "emailNotificaciones", "telefonoContacto", "logoUrl", "website", "representanteLegal", "bankTransferDetails"];
  return Object.fromEntries(fields.filter(key => key in value).map(key => [key, value[key]]));
}
