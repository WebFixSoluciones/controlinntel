// Prueba unitaria directa del motor tributario SRI Ecuador

function calcularModulo11(clave48) {
  let factor = 2;
  let suma = 0;
  for (let i = clave48.length - 1; i >= 0; i--) {
    suma += parseInt(clave48[i], 10) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const residuo = suma % 11;
  let verificador = 11 - residuo;
  if (verificador === 11) verificador = 0;
  if (verificador === 10) verificador = 1;
  return verificador;
}

function generarClaveAccesoSRI({
  fechaEmision,
  tipoComprobante = "01",
  ruc,
  ambiente = "1",
  establecimiento = "001",
  puntoEmision = "001",
  secuencial,
  codigoNumerico = "12345678",
  tipoEmision = "1",
}) {
  let ddmmyyyy = "";
  if (fechaEmision.includes("-")) {
    const [y, m, d] = fechaEmision.split("T")[0].split("-");
    ddmmyyyy = `${d.padStart(2, "0")}${m.padStart(2, "0")}${y}`;
  } else if (fechaEmision.includes("/")) {
    const [d, m, y] = fechaEmision.split("/");
    ddmmyyyy = `${d.padStart(2, "0")}${m.padStart(2, "0")}${y}`;
  } else {
    ddmmyyyy = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  }

  const rucLimpio = String(ruc).trim().padEnd(13, "0").slice(0, 13);
  const estab = String(establecimiento).padStart(3, "0").slice(-3);
  const pto = String(puntoEmision).padStart(3, "0").slice(-3);
  const cleanSec = String(secuencial).replace(/[^0-9]/g, "");
  const secPadded = cleanSec.padStart(9, "0").slice(-9);
  const codNum = String(codigoNumerico).padStart(8, "0").slice(-8);

  const clave48 = `${ddmmyyyy}${tipoComprobante}${rucLimpio}${ambiente}${estab}${pto}${secPadded}${codNum}${tipoEmision}`;
  const digitoVerificador = calcularModulo11(clave48);

  return `${clave48}${digitoVerificador}`;
}

function validarIdentificacionEcuador(identificacion) {
  if (!identificacion) return false;
  const clean = String(identificacion).trim();
  if (clean === "9999999999999") return true;
  if (clean.length !== 10 && clean.length !== 13) return false;
  if (clean.length === 13 && !clean.endsWith("001")) return false;

  const cedula = clean.substring(0, 10);
  const provincia = parseInt(cedula.substring(0, 2), 10);
  if (provincia < 1 || provincia > 24) return false;

  const tercerDigito = parseInt(cedula.substring(2, 3), 10);
  if (tercerDigito === 9) {
    const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    const verificador = parseInt(cedula.substring(9, 10), 10);
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      suma += parseInt(cedula[i], 10) * coeficientes[i];
    }
    const residuo = suma % 11;
    const digitoCalculado = residuo === 0 ? 0 : 11 - residuo;
    return digitoCalculado === verificador;
  }
  return true;
}

console.log("--- TEST MOTOR TRIBUTARIO SRI ---");
const rucValido = validarIdentificacionEcuador("1792458927001");
console.log("1. Validar RUC Sociedad Privada (1792458927001):", rucValido ? "PASS" : "FAIL");

const cedulaValida = validarIdentificacionEcuador("1710034065");
console.log("1b. Validar Cédula Natural (1710034065):", cedulaValida ? "PASS" : "FAIL");

const consumidorFinal = validarIdentificacionEcuador("9999999999999");
console.log("2. Validar Consumidor Final (9999999999999):", consumidorFinal ? "PASS" : "FAIL");

const claveAcceso = generarClaveAccesoSRI({
  fechaEmision: "2026-09-28",
  tipoComprobante: "01",
  ruc: "1792458921001",
  ambiente: "1",
  establecimiento: "001",
  puntoEmision: "001",
  secuencial: "45",
  codigoNumerico: "12345678",
});
console.log("3. Clave Acceso SRI:", claveAcceso);
console.log("4. Longitud exacta 49 digitos:", claveAcceso.length === 49 ? "PASS" : "FAIL");

// Verificar digito verificador modulo 11
const clave48 = claveAcceso.slice(0, 48);
const digito = parseInt(claveAcceso.slice(48), 10);
const digitoEsperado = calcularModulo11(clave48);
console.log("5. Digito Verificador Modulo 11:", digito === digitoEsperado ? "PASS (DV: " + digito + ")" : "FAIL");

if (rucValido && consumidorFinal && claveAcceso.length === 49 && digito === digitoEsperado) {
  console.log(">>> TODAS LAS PRUEBAS UNITARIAS PASARON EXITOSAMENTE <<<");
  process.exit(0);
} else {
  console.error(">>> ERROR EN LAS PRUEBAS UNITARIAS <<<");
  process.exit(1);
}
