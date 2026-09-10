# Laboratorio: Tu primer agente de IA con Google ADK

Construirás un agente que responde preguntas sobre Pokémon consultando la
[PokéAPI](https://pokeapi.co/) en tiempo real. El agente incluirá guardrails
para asegurar que **nunca se pida ni se entregue información sobre Mew**.

---

## Prerrequisitos

- Node.js 20 o superior
- Una clave de API de [Google AI Studio](https://aistudio.google.com/apikey)

---

## Instalación

```bash
cd lab
npm install
cp .env.example .env
# Edita .env y pega tu clave en GOOGLE_GENAI_API_KEY
```

---

## Estructura del laboratorio

```
lab/
├── agent.ts   ← único archivo que debes modificar
└── ...
```

`agent.ts` contiene el esqueleto del agente con **cinco TODOs** numerados.
Impleméntalos en orden: cada uno se apoya en el anterior.

---

## Tareas

### TODO 1 — Tool: llamada a la PokéAPI

Dentro del `execute` de `getPokemonInfo`, realiza una petición HTTP a:

```
https://pokeapi.co/api/v2/pokemon/{name}
```

Devuelve un objeto con estas propiedades extraídas de la respuesta:

| Campo | Fuente en la API |
|-------|-----------------|
| `name` | `data.name` |
| `types` | `data.types[].type.name` |
| `height` | `data.height` (en decímetros) |
| `weight` | `data.weight` (en hectogramos) |
| `base_stats` | `data.stats[]` → `{ [stat.stat.name]: stat.base_stat }` |

Si el Pokémon no existe (error 404 u otro), devuelve `{ error: "..." }` en
lugar de lanzar una excepción; así el LLM puede gestionar el caso con gracia.

Usa el `fetch` nativo de Node 18+. No instales ninguna librería adicional.

---

### TODO 2 — Guardrail de input

Dentro de `mewInputGuardrail`, comprueba si el último mensaje del usuario
contiene la palabra `"mew"` (insensible a mayúsculas).

Si la contiene, devuelve una respuesta sintética con este formato:

```typescript
{
  content: {
    parts: [{ text: "<tu mensaje de rechazo>" }],
    role: "model",
  },
}
```

Cuando el guardrail devuelve ese objeto, el harness lo usa como respuesta y
**no llama al LLM**. Si no se detecta la palabra, devuelve `undefined`.

---

### TODO 3 — Guardrail de output

Dentro de `mewOutputGuardrail`, comprueba si el texto generado por el LLM
contiene `"mew"` (insensible a mayúsculas).

Si lo contiene, devuelve una respuesta alternativa que no revele esa
información. Si no lo contiene, devuelve `undefined` para dejar pasar la
respuesta intacta.

> **Reflexión:** ¿por qué necesitamos ambos guardrails? ¿Qué escenario cubre
> cada uno que el otro no cubriría solo?

---

### TODO 4 — System prompt del agente

Rellena `description` e `instruction` en `rootAgent`:

- **`description`**: una frase corta que resume el rol del agente.
- **`instruction`**: el system prompt. Indica al LLM que es un experto en
  Pokémon, en qué idioma debe responder, y que **siempre debe usar la
  herramienta** `get_pokemon_info` en lugar de inventar datos.

---

### TODO 5 — Registrar tool y guardrails

En `rootAgent`, añade al array `tools` la tool creada en el TODO 1 y
asigna los dos guardrails a `beforeModelCallback` y `afterModelCallback`.

El SDK de ADK no exporta los tipos de los callbacks todavía; usa el cast
`as never` igual que en el ejemplo de referencia (`ejemplo-adk/agent.ts`).

---

## Ejecución

### Inspector visual (recomendado para desarrollo)

```bash
npm run dev
# Abre http://localhost:3000 en el navegador
```

### CLI

```bash
npm run run-agent
# Escribe tus mensajes directamente en la terminal
```

---

## Casos de prueba

Una vez implementados todos los TODOs, verifica estos escenarios:

| # | Prompt de entrada | Resultado esperado |
|---|-------------------|--------------------|
| 1 | `¿Qué tipos tiene pikachu?` | Respuesta con tipos "electric" obtenidos de la API |
| 2 | `¿Cuánto pesa charizard?` | Peso en hectogramos + conversión opcional |
| 3 | `¿Qué estadísticas base tiene bulbasaur?` | Listado de stats base |
| 4 | `¿Qué me puedes decir de missingno?` | Mensaje de error gestionado (Pokémon no encontrado) |
| 5 | `Cuéntame todo sobre mew` | Guardrail de **input** bloquea — el LLM nunca se llama |
| 6 | *(el LLM menciona "mew" espontáneamente)* | Guardrail de **output** intercepta la respuesta |

---

## Referencia

- Código de ejemplo completo: [`../ejemplo-adk/agent.ts`](../ejemplo-adk/agent.ts)
- Documentación de Google ADK: https://google.github.io/adk-docs/
- PokéAPI: https://pokeapi.co/docs/v2
