import { FunctionTool, LlmAgent } from "@google/adk";
import { z } from "zod";

// ─── TOOL ────────────────────────────────────────────────────────────────────
// El LLM puede pedir al harness que ejecute esta función.
// La implementación es simulada para no depender de credenciales externas.

const MOCK_WEATHER: Record<string, { temperatura: number; condicion: string }> =
  {
    madrid: { temperatura: 28, condicion: "soleado" },
    barcelona: { temperatura: 24, condicion: "nublado" },
    bilbao: { temperatura: 18, condicion: "lluvia" },
  };

const getWeather = new FunctionTool({
  name: "get_weather",
  description:
    "Devuelve el tiempo actual (temperatura y condición) para una ciudad española.",
  parameters: z.object({
    city: z.string().describe("Nombre de la ciudad en minúsculas, sin tildes"),
  }),
  execute: async ({ city }) => {
    const data = MOCK_WEATHER[city.toLowerCase()];
    if (!data) {
      return {
        error: `No hay datos para "${city}". Ciudades disponibles: ${Object.keys(MOCK_WEATHER).join(", ")}`,
      };
    }
    console.log(`[tool] get_weather("${city}") → ${JSON.stringify(data)}`);
    return data;
  },
});

// ─── GUARDRAIL DE INPUT ───────────────────────────────────────────────────────
// beforeModelCallback se ejecuta ANTES de enviar el prompt al LLM.
// Si devuelve un objeto, el harness usa esa respuesta y omite la llamada al LLM.
// Si devuelve undefined, el flujo continúa con normalidad.

function inputGuardrail({
  request,
}: {
  context: unknown;
  request: { contents: Array<{ parts?: Array<{ text?: string }> }> };
}) {
  const lastMessage = request.contents.at(-1)?.parts?.at(-1)?.text ?? "";

  const forbidden = [
    "contraseña",
    "password",
    "token",
    "credit card",
    "tarjeta",
  ];
  const hasForbidden = forbidden.some((word) =>
    lastMessage.toLowerCase().includes(word),
  );

  if (hasForbidden) {
    console.warn(
      "[guardrail:input] Petición bloqueada — contiene términos prohibidos",
    );
    return {
      content: {
        parts: [
          {
            text: "Lo siento, no puedo procesar peticiones con datos sensibles.",
          },
        ],
        role: "model",
      },
    };
  }

  return undefined; // continuar con normalidad
}

// ─── GUARDRAIL DE OUTPUT ──────────────────────────────────────────────────────
// afterModelCallback se ejecuta DESPUÉS de que el LLM genera su respuesta.
// Útil para censurar datos sensibles o validar formato.

function outputGuardrail({
  response,
}: {
  context: unknown;
  response: { content?: { parts?: Array<{ text?: string }>; role?: string } };
}) {
  const text = response.content?.parts?.at(0)?.text ?? "";

  // Ejemplo: ocultar patrones que parezcan emails en la respuesta
  const sanitized = text.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    "[email redactado]",
  );

  if (sanitized !== text) {
    console.warn(
      "[guardrail:output] Email detectado y redactado en la respuesta",
    );
    return {
      ...response,
      content: { parts: [{ text: sanitized }], role: "model" },
    };
  }

  return undefined; // devolver la respuesta original
}

// ─── AGENTE ───────────────────────────────────────────────────────────────────
// instruction = system prompt: define el rol y las restricciones del agente.

export const rootAgent = new LlmAgent({
  name: "agente-meteorologico",
  model: "gemini-3.6-flash",
  description:
    "Agente de demostración que informa sobre el tiempo en ciudades españolas.",
  instruction: `
    Eres un asistente meteorológico amable y conciso.
    Solo tienes información sobre el tiempo en ciudades españolas.
    Cuando el usuario pregunte por el tiempo de una ciudad, usa siempre la herramienta get_weather.
    Si la ciudad no está disponible, díselo al usuario con educación.
    Responde siempre en español.
    No inventes datos meteorológicos: usa únicamente lo que te devuelva la herramienta.
  `.trim(),
  tools: [getWeather],
  // ponytail: callbacks tipados como `any` en ADK — la lib no exporta los tipos de callback todavía
  beforeModelCallback: inputGuardrail as never,
  afterModelCallback: outputGuardrail as never,
});
