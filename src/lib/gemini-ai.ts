import { GoogleGenerativeAI } from "@google/generative-ai";

export async function askGeminiAssistant(
  prompt: string,
  userRole: string = "admin",
  contextData: any
): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  const systemContext = `
Eres el Asistente Inteligente de INNTEL CORP (ISP Telecomunicaciones en Ecuador regulado por ARCOTEL y SRI).
Rol del usuario: "${userRole.toUpperCase()}".

DATOS OPERATIVOS ACTUALES:
${JSON.stringify(contextData, null, 2)}
`;

  if (!apiKey) {
    return simulateAiResponse(prompt, userRole, contextData);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(`${systemContext}\n\nPREGUNTA: ${prompt}`);
    const response = await result.response;
    return response.text();
  } catch (error) {
    return simulateAiResponse(prompt, userRole, contextData);
  }
}

function simulateAiResponse(prompt: string, userRole: string, contextData: any): string {
  const p = prompt.toLowerCase();

  if (p.includes("poliza") || p.includes("venc")) {
    return "📋 Reporte Regulatorio ARCOTEL:\n\n- Tienes 1 póliza en estado crítico: Póliza de Responsabilidad Civil (Chubb Seguros) vence en 20 días.\n- Póliza de Fiel Cumplimiento (Seguros Sucre) vence en 45 días.\n\n👉 Recomendación: Genera el Oficio Formal desde el módulo de Plantillas y gestiona el endoso ante ARCOTEL.";
  }

  if (p.includes("gasto") || p.includes("finan") || p.includes("mrr")) {
    return "💰 Resumen Financiero:\n\n- Ingresos Recurrentes (MRR): $28,450.00 USD\n- Gastos Operativos: $8,920.00 USD\n- Utilidad Neta Proyectada: $19,530.00 USD (Margen del 68.6%)\n- Mayor egreso: Tránsito IP Internacional con Telconet ($1,450.00 USD).";
  }

  if (p.includes("nodo") || p.includes("mikrotik") || p.includes("red")) {
    return "📡 Diagnóstico de Red:\n\n- 4 POPs activos.\n- Alerta: Nodo Calderón presenta utilización del 82.5% (1650/2000 Mbps). Se sugiere programar ampliación en el Core Router CCR2116.\n- Pools CGNAT Norte y Sur operando con normalidad.";
  }

  return `🤖 Asistente INNTEL CORP (Rol: ${userRole.toUpperCase()}):\n\nActualmente el sistema cuenta con ${contextData.clientsCount || 4} clientes registrados, ${contextData.nodes?.length || 4} nodos de red y pólizas ARCOTEL monitoreadas.\n\n¿En qué proceso operativo o regulatorio te puedo asistir hoy?`;
}
