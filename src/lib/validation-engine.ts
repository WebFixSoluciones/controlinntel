/**
 * Motor de Validaciones Empresarial para INNTEL CORP
 * Validador oficial para Ecuador: Cédula, RUC (Natural, Privada, Pública),
 * Direccionamiento IPv4 / CIDR, Teléfonos, Fechas y Tarifas.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Valida Cédula de Identidad de Ecuador (Módulo 10)
 */
export function validateCedulaEcuador(cedula: string): ValidationResult {
  const clean = cedula.trim().replace(/\D/g, "");
  if (clean.length !== 10) {
    return { isValid: false, error: "La cédula debe contener exactamente 10 dígitos numéricos." };
  }

  const province = parseInt(clean.substring(0, 2), 10);
  if ((province < 1 || province > 24) && province !== 30) {
    return { isValid: false, error: `Código de provincia '${province}' inválido en la cédula (debe ser 01-24 o 30).` };
  }

  const thirdDigit = parseInt(clean.charAt(2), 10);
  if (thirdDigit >= 6) {
    return { isValid: false, error: "El tercer dígito de una cédula de persona natural debe ser menor a 6." };
  }

  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    let val = parseInt(clean.charAt(i), 10) * coefficients[i];
    if (val >= 10) val -= 9;
    sum += val;
  }

  const verifier = parseInt(clean.charAt(9), 10);
  const calculatedVerifier = (10 - (sum % 10)) % 10;

  if (verifier !== calculatedVerifier) {
    return {
      isValid: false,
      error: `Dígito verificador inválido en la cédula. Se esperaba ${calculatedVerifier}, pero se recibió ${verifier}.`,
    };
  }

  return { isValid: true };
}

/**
 * Valida RUC de Ecuador:
 * - RUC Persona Natural (10 dígitos de cédula + "001")
 * - RUC Sociedad Privada / Extranjeros (tercer dígito = 9, Módulo 11)
 * - RUC Sociedad Pública (tercer dígito = 6, Módulo 11)
 */
export function validateRucEcuador(ruc: string): ValidationResult {
  const clean = ruc.trim().replace(/\D/g, "");
  if (clean.length !== 13) {
    return { isValid: false, error: "El RUC debe contener exactamente 13 dígitos numéricos." };
  }

  const province = parseInt(clean.substring(0, 2), 10);
  if ((province < 1 || province > 24) && province !== 30) {
    return { isValid: false, error: `Código de provincia '${province}' inválido en el RUC.` };
  }

  const thirdDigit = parseInt(clean.charAt(2), 10);

  // 1. RUC Persona Natural (Tercer dígito < 6)
  if (thirdDigit < 6) {
    const cedulaPart = clean.substring(0, 10);
    const cedulaVal = validateCedulaEcuador(cedulaPart);
    if (!cedulaVal.isValid) {
      return { isValid: false, error: `RUC de persona natural inválido: ${cedulaVal.error}` };
    }
    const establishment = clean.substring(10, 13);
    if (establishment === "000") {
      return { isValid: false, error: "El código de establecimiento del RUC no puede ser '000'." };
    }
    return { isValid: true };
  }

  // 2. RUC Sociedad Privada o Jurídica (Tercer dígito == 9, Módulo 11)
  if (thirdDigit === 9) {
    const coefficients = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(clean.charAt(i), 10) * coefficients[i];
    }
    const verifier = parseInt(clean.charAt(9), 10);
    const mod = sum % 11;
    const calculatedVerifier = mod === 0 ? 0 : 11 - mod;

    if (verifier !== calculatedVerifier) {
      return { isValid: false, error: "Dígito verificador inválido para RUC de Sociedad Jurídica (Módulo 11)." };
    }
    const establishment = clean.substring(10, 13);
    if (establishment === "000") {
      return { isValid: false, error: "El código de establecimiento del RUC no puede ser '000'." };
    }
    return { isValid: true };
  }

  // 3. RUC Entidad Pública (Tercer dígito == 6, Módulo 11)
  if (thirdDigit === 6) {
    const coefficients = [3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += parseInt(clean.charAt(i), 10) * coefficients[i];
    }
    const verifier = parseInt(clean.charAt(8), 10);
    const mod = sum % 11;
    const calculatedVerifier = mod === 0 ? 0 : 11 - mod;

    if (verifier !== calculatedVerifier) {
      return { isValid: false, error: "Dígito verificador inválido para RUC de Entidad Pública (Módulo 11)." };
    }
    return { isValid: true };
  }

  return { isValid: false, error: "Estructura de RUC no válida según el formato estándar." };
}

/**
 * Validador Integral de Identificación (RUC, Cédula o Pasaporte)
 */
export function validateIdentification(type: "RUC" | "CEDULA" | "PASAPORTE", number: string): ValidationResult {
  if (!number || !number.trim()) {
    return { isValid: false, error: "El número de identificación es obligatorio." };
  }
  if (type === "CEDULA") return validateCedulaEcuador(number);
  if (type === "RUC") return validateRucEcuador(number);
  if (type === "PASAPORTE") {
    if (number.trim().length < 5 || number.trim().length > 20) {
      return { isValid: false, error: "El pasaporte debe tener entre 5 y 20 caracteres alfanuméricos." };
    }
    return { isValid: true };
  }
  return { isValid: true };
}

/**
 * Valida Dirección IPv4 o Prefijo CIDR (ej. 192.168.1.1 o 100.64.0.0/20)
 */
export function validateIpv4OrCidr(input: string): ValidationResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { isValid: false, error: "La dirección IP no puede estar vacía." };
  }

  const [ipPart, cidrPart] = trimmed.split("/");

  const octets = ipPart.split(".");
  if (octets.length !== 4) {
    return { isValid: false, error: "La dirección IPv4 debe contener 4 octetos separados por punto (ej. 10.50.0.1)." };
  }

  for (const octet of octets) {
    if (!/^\d+$/.test(octet)) {
      return { isValid: false, error: `El octeto '${octet}' no es un número entero válido.` };
    }
    const num = parseInt(octet, 10);
    if (num < 0 || num > 255) {
      return { isValid: false, error: `El octeto '${num}' está fuera de rango (debe ser entre 0 y 255).` };
    }
  }

  if (cidrPart !== undefined) {
    if (!/^\d+$/.test(cidrPart)) {
      return { isValid: false, error: "La máscara CIDR debe ser un número entero (ej. /24)." };
    }
    const mask = parseInt(cidrPart, 10);
    if (mask < 0 || mask > 32) {
      return { isValid: false, error: "La máscara CIDR debe estar en el rango de /0 a /32." };
    }
  }

  return { isValid: true };
}

/**
 * Valida Correo Electrónico con formato RFC
 */
export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();
  if (!trimmed) {
    return { isValid: false, error: "El correo electrónico es obligatorio para emisión de comprobantes." };
  }
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: "Formato de correo electrónico inválido (ejemplo: contacto@inntelcorp.ec)." };
  }
  return { isValid: true };
}

/**
 * Valida Teléfono Ecuatoriano (Móvil 09x o Fijo 02x)
 */
export function validatePhoneEcuador(phone: string): ValidationResult {
  const clean = phone.trim().replace(/\D/g, "");
  if (clean.length < 9 || clean.length > 15) {
    return { isValid: false, error: "El teléfono debe contener entre 9 y 15 dígitos numéricos." };
  }
  return { isValid: true };
}

/**
 * Valida Montos y Tarifas en USD
 */
export function validateMonetaryAmount(amount: number, fieldName: string = "Monto"): ValidationResult {
  if (isNaN(amount) || amount <= 0) {
    return { isValid: false, error: `${fieldName} debe ser un valor numérico mayor a $0.00 USD.` };
  }
  if (amount > 1000000) {
    return { isValid: false, error: `${fieldName} excede el límite permitido de $1,000,000.00 USD.` };
  }
  return { isValid: true };
}

/**
 * Valida Rango de Fechas para Pólizas ARCOTEL
 */
export function validateDateRange(startDateStr: string, endDateStr: string): ValidationResult {
  if (!startDateStr || !endDateStr) {
    return { isValid: false, error: "Las fechas de inicio y vencimiento son obligatorias." };
  }
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { isValid: false, error: "Formato de fecha inválido." };
  }
  if (end <= start) {
    return { isValid: false, error: "La fecha de vencimiento debe ser posterior a la fecha de emisión." };
  }
  return { isValid: true };
}
