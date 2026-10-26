import { GoogleGenerativeAI } from "@google/generative-ai";

export async function askGeminiAssistant(
  prompt: string,
  userRole: string = "admin",
  contextData: any
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return simulateAiResponse(prompt, userRole, contextData);
  }

  const systemContext = `
Eres el Asistente Técnico y Regulatorio de INNTEL CORP (Empresa de Telecomunicaciones en Ecuador regulada por ARCOTEL).
Rol del usuario: "${userRole.toUpperCase()}".

DATOS DE CONTEXTO OPERATIVO:
- Clientes Registrados: ${contextData?.clientsCount || 0}
- Sedes / Nodos: ${contextData?.nodesCount || 0}
- Pólizas ARCOTEL: ${contextData?.policiesCount || 0}
- Tickets Activos: ${contextData?.activeTicketsCount || 0}

INSTRUCCIONES:
1. Responde de forma concisa, técnica y respetuosa.
2. Si te consultan sobre normativas ARCOTEL, cita la normativa ecuatoriana aplicable.
3. No inventes cifras ni reveles contraseñas o secretos de red.
`;

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

  if (p.includes("poliza") || p.includes("arcotel") || p.includes("venc")) {
    return "📋 Pólizas y Garantías ARCOTEL:\n\nPara el seguimiento de pólizas, consulta la pestaña 'Contratos & ARCOTEL' en la ficha del cliente o el módulo regulatorio central. Recuerda que los endosos y renovaciones deben presentarse ante ARCOTEL con al menos 15 días de anticipación.";
  }

  if (p.includes("nodo") || p.includes("mikrotik") || p.includes("red")) {
    return `📡 Infraestructura de Red:\n\nActualmente el sistema registra ${contextData.nodesCount || 0} sedes/nodos. Para verificar el direccionamiento IPv4 de los enlaces de transporte y sus credenciales de borde, ingresa a la pestaña de 'Nodos' del cliente.`;
  }

  return `🤖 Asistente INNTEL CORP:\n\nEl servicio de IA generativa requiere configurar la variable de entorno 'GEMINI_API_KEY' en el servidor para procesamiento dinámico en tiempo real.\n\nDatos activos del sistema: ${contextData.clientsCount || 0} clientes y ${contextData.nodesCount || 0} sedes registradas.`;
}
