import { FunctionTool, LlmAgent } from "@google/adk";
import { z } from "zod";

// ─── TOOL ────────────────────────────────────────────────────────────────────
// El LLM puede invocar esta función para obtener datos reales de la PokeAPI.
// Documentación de la API: https://pokeapi.co/api/v2/pokemon/{name}

const getPokemonInfo = new FunctionTool({
  name: "get_pokemon_info",
  description:
    "Obtiene información sobre un Pokémon dado su nombre en inglés.",
  parameters: z.object({
    name: z
      .string()
      .describe(
        "Nombre del Pokémon en minúsculas y en inglés (p.ej. 'pikachu')",
      ),
  }),
  // TODO 1: Implementa la llamada a la PokeAPI.
  //
  // - Llama a: https://pokeapi.co/api/v2/pokemon/{name}
  // - Extrae y devuelve un objeto con:
  //     name       → string
  //     types      → string[]  (p.ej. ["electric"])
  //     height     → number    (en decímetros)
  //     weight     → number    (en hectogramos)
  //     base_stats → Record<string, number>  (p.ej. { hp: 45, attack: 49, ... })
  // - Si el Pokémon no existe (respuesta 404 u otro error), devuelve:
  //     { error: "Pokémon '<name>' no encontrado." }
  // - No instales ninguna librería HTTP; usa el fetch nativo de Node 18+.
  execute: async ({ name }) => {
    throw new Error("TODO 1: implementa la llamada a la PokeAPI");
  },
});

// ─── GUARDRAIL DE INPUT ───────────────────────────────────────────────────────
// beforeModelCallback se ejecuta ANTES de que el LLM reciba el mensaje.
//
// Devuelve un objeto  → el harness usa esa respuesta y NO llama al LLM.
// Devuelve undefined  → el flujo continúa con normalidad.

function mewInputGuardrail({
  request,
}: {
  context: unknown;
  request: { contents: Array<{ parts?: Array<{ text?: string }> }> };
}) {
  const lastMessage = request.contents.at(-1)?.parts?.at(-1)?.text ?? "";

  // TODO 2: Bloquea cualquier petición que mencione "mew".
  //
  // - Comprueba si lastMessage contiene la palabra "mew"
  //   (insensible a mayúsculas).
  // - Si la contiene, devuelve un objeto con la forma:
  //     {
  //       content: {
  //         parts: [{ text: "<mensaje de rechazo>" }],
  //         role: "model",
  //       },
  //     }
  // - Si no la contiene, devuelve undefined para continuar con normalidad.

  return undefined;
}

// ─── GUARDRAIL DE OUTPUT ──────────────────────────────────────────────────────
// afterModelCallback se ejecuta DESPUÉS de que el LLM genera su respuesta.
// Útil para filtrar o sanitizar el contenido producido por el modelo.

function mewOutputGuardrail({
  response,
}: {
  context: unknown;
  response: { content?: { parts?: Array<{ text?: string }>; role?: string } };
}) {
  const text = response.content?.parts?.at(0)?.text ?? "";

  // TODO 3: Bloquea cualquier respuesta que mencione "mew".
  //
  // - Comprueba si text contiene la palabra "mew"
  //   (insensible a mayúsculas).
  // - Si la contiene, devuelve un objeto alternativo que no revele esa
  //   información (puedes usar la misma forma que en el guardrail de input).
  // - Si no la contiene, devuelve undefined para dejar pasar la respuesta.

  return undefined;
}

// ─── AGENTE ───────────────────────────────────────────────────────────────────
// rootAgent es el nombre que el harness de ADK busca para arrancar el agente.

export const rootAgent = new LlmAgent({
  name: "agente-pokemon",
  model: "gemini-2.0-flash",

  // TODO 4: Rellena description e instruction.
  //
  // - description: una frase que resume qué hace este agente.
  // - instruction (system prompt): indica al LLM su rol, en qué idioma
  //   responder y cuándo debe invocar la herramienta get_pokemon_info.
  //   Recuerda: el LLM no debe inventar datos; siempre debe usar la tool.
  description: "TODO 4",
  instruction: "TODO 4",

  // TODO 5: Registra la tool y los guardrails.
  //
  // - tools:               añade getPokemonInfo al array.
  // - beforeModelCallback: asigna mewInputGuardrail  (usa `as never` para el tipo).
  // - afterModelCallback:  asigna mewOutputGuardrail (usa `as never` para el tipo).
  tools: [],
});
