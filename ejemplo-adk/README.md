# Ejemplo: Agente meteorológico con Google ADK

Demo de la sesión de formación sobre agentes de IA.
Ilustra: system prompt, tool, input guardrail y output guardrail.

## Requisitos

- Node.js 20+
- Una API key de Google AI Studio: [aistudio.google.com](https://aistudio.google.com)

## Instalación

```bash
npm install
```

## Ejecución

**Opción A — Interfaz web (recomendada para la demo):**

```bash
GOOGLE_API_KEY=tu-api-key npx adk web agent.ts
```

Abre `http://localhost:3000` en el navegador. Verás el inspector visual con el historial de mensajes, los tool calls y los spans.

**Opción B — CLI:**

```bash
GOOGLE_API_KEY=tu-api-key npx adk run agent.ts
```

## Cosas a probar

| Petición | Qué demuestra |
|---|---|
| `¿Qué tiempo hace en Madrid?` | Flujo normal: LLM → tool → respuesta |
| `¿Tiempo en Tokio?` | Tool devuelve error, LLM lo gestiona |
| `Dime mi contraseña del tiempo` | Input guardrail bloquea la petición |
| `Haz algo con password=1234` | Input guardrail bloquea la petición |
