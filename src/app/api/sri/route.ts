import { NextRequest, NextResponse } from "next/server";
import { SRI_WS_URLS } from "@/lib/sri-service";
import type { SriEnvironment } from "@/types";

export const runtime = "nodejs";

/**
 * Endpoint para Test de Conectividad con el SRI y Consulta RUC
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "test_connection";
  const ambiente = (searchParams.get("ambiente") || "1") as SriEnvironment;

  if (action === "consultar_ruc") {
    const rawRuc = searchParams.get("ruc") || "";
    const clean = String(rawRuc).replace(/\s+/g, "").trim();

    if (clean.length !== 10 && clean.length !== 13) {
      return NextResponse.json(
        { error: "La identificación debe tener 10 (Cédula) o 13 (RUC) dígitos." },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(clean)) {
      return NextResponse.json(
        { error: `La identificación ${clean} solo puede contener dígitos numéricos.` },
        { status: 400 }
      );
    }

    const rucParaConsulta = clean.length === 10 ? `${clean}001` : clean;
    const errors: string[] = [];

    // INTENTO 1: API CipherByte desde el servidor (sin restricciones CORS)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);
      const resCb = await fetch(`https://aggregator.cipherbyte.ec/company/${rucParaConsulta}`, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json, text/plain, */*",
        },
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      if (resCb.ok) {
        const apiData = await resCb.json();
        if (apiData && (apiData.razonSocial || apiData.numeroRuc)) {
          return NextResponse.json(
            {
              success: true,
              source: "cipherbyte",
              originalInput: clean,
              rucConsultado: rucParaConsulta,
              data: apiData,
            },
            {
              headers: {
                "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
              },
            }
          );
        }
      } else if (resCb.status === 404) {
        errors.push("CipherByte: 404 (No encontrado)");
      } else {
        errors.push(`CipherByte: HTTP ${resCb.status}`);
      }
    } catch (err: any) {
      errors.push(`CipherByte: ${err?.message || "Timeout"}`);
    }

    // INTENTO 2: Catastro Oficial SRI En Línea (obtenerPorNumerosRuc + establecimientos)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);
      const sriUrl = `https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/obtenerPorNumerosRuc?&ruc=${rucParaConsulta}`;
      const resSri = await fetch(sriUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json, text/plain, */*",
        },
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      if (resSri.ok) {
        const sriArr = await resSri.json();
        const sriMain = Array.isArray(sriArr) ? sriArr[0] : sriArr;
        if (sriMain && (sriMain.razonSocial || sriMain.numeroRuc)) {
          // Intentar obtener también establecimientos del SRI
          let establecimientos: any[] = [];
          try {
            const estController = new AbortController();
            const estTimeout = setTimeout(() => estController.abort(), 5000);
            const estRes = await fetch(
              `https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/Establecimiento/consultarPorNumeroRuc?numeroRuc=${rucParaConsulta}`,
              {
                signal: estController.signal,
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                  Accept: "application/json",
                },
                cache: "no-store",
              }
            );
            clearTimeout(estTimeout);
            if (estRes.ok) {
              const estJson = await estRes.json();
              if (Array.isArray(estJson)) establecimientos = estJson;
            }
          } catch {
            // Ignorar si falla la consulta secundaria de establecimientos
          }

          return NextResponse.json(
            {
              success: true,
              source: "sri",
              originalInput: clean,
              rucConsultado: rucParaConsulta,
              data: {
                ...sriMain,
                establecimientos,
              },
            },
            {
              headers: {
                "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
              },
            }
          );
        }
      } else {
        errors.push(`SRI: HTTP ${resSri.status}`);
      }
    } catch (err: any) {
      errors.push(`SRI: ${err?.message || "Timeout"}`);
    }

    return NextResponse.json(
      {
        success: false,
        error: `No se encontraron datos en el SRI para ${rucParaConsulta}.`,
        details: errors,
      },
      { status: 404 }
    );
  }

  if (action !== "test_connection" || !["1", "2"].includes(ambiente)) {
    return NextResponse.json({ error: "Consulta SRI inválida." }, { status: 400 });
  }
  const urls = ambiente === "2" ? SRI_WS_URLS.produccion : SRI_WS_URLS.pruebas;
  const startTime = Date.now();
  async function check(url: string) {
    try {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
      return response.ok && /<(?:[\w.-]+:)?definitions[\s>]/.test(await response.text());
    } catch {
      return false;
    }
  }
  const [receipt, authorization] = await Promise.all([check(urls.recepcion), check(urls.autorizacion)]);
  return NextResponse.json({
    online: receipt && authorization, ambiente, recepcionWsUrl: urls.recepcion, autorizacionWsUrl: urls.autorizacion,
    recepcionStatus: receipt ? "disponible" : "inaccesible",
    autorizacionStatus: authorization ? "disponible" : "inaccesible",
    latencyMs: Date.now() - startTime, checkedAt: new Date().toISOString(),
    message: receipt && authorization ? "Recepción y autorización respondieron." : "Hay servicios del SRI que no respondieron.",
  }, { headers: { "Cache-Control": "no-store" } });
}
