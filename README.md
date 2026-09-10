# Formación: Desarrollo de Agentes de IA

> Material de apoyo para la sesión del 10 de septiembre de 2026.
> Audiencia: desarrolladores JavaScript/TypeScript.

---

## Índice

1. [Modelo, LLM y Agente — ¿cuál es la diferencia?](#1-modelo-llm-y-agente)
2. [Anatomía de un agente](#2-anatomía-de-un-agente)
3. [Harness, Graphs y Workflows](#3-harness-graphs-y-workflows)
4. [Observabilidad y Evaluaciones](#4-observabilidad-y-evaluaciones)
5. [Ejemplo práctico: Google ADK en TypeScript](#5-ejemplo-práctico-google-adk)

---

## 1. Modelo, LLM y Agente

### ¿Qué es un modelo?

Un modelo es una función matemática. Tiene parámetros (pesos) que se ajustan durante el entrenamiento: dado un input, produce un output. Un modelo de visión recibe píxeles y predice si hay un gato; un modelo de clasificación recibe texto y predice sentimiento.

La clave es que un modelo, por sí solo, no "habla" ni "razona": transforma una entrada en una salida según lo que aprendió durante el entrenamiento.

### ¿Qué es un LLM?

Un **LLM (Large Language Model)** es un tipo de modelo entrenado sobre enormes volúmenes de texto. Durante el entrenamiento, su tarea es sencilla: *predecir el siguiente token dado el contexto anterior*. A partir de esa tarea tan básica, el modelo aprende representaciones del lenguaje, del mundo, y adquiere capacidad de razonamiento.

GPT-4, Claude, Gemini o Llama son LLMs. Cuando les preguntas algo, en realidad están "prediciendo" cuál es el token más probable que seguiría a tu pregunta —una y otra vez hasta completar la respuesta—.

### ¿Qué es un Agente?

Un **agente** es una pieza de software que envuelve un LLM en un **bucle de razonamiento → acción → observación**. El LLM es el "cerebro"; el agente es el sistema completo.

```
┌─────────────────────────────────────────────────────┐
│                      AGENTE                         │
│                                                     │
│  User prompt                                        │
│      │                                              │
│      ▼                                              │
│  ┌────────────┐    Tool call    ┌──────────────┐   │
│  │    LLM     │ ──────────────► │  Herramienta │   │
│  │  (Gemini,  │ ◄────────────── │  (función    │   │
│  │  Claude…)  │   Resultado     │   local/API) │   │
│  └────────────┘                 └──────────────┘   │
│      │                                              │
│      ▼                                              │
│  Respuesta final al usuario                         │
└─────────────────────────────────────────────────────┘
```

El LLM decide en cada paso si necesita llamar a una herramienta o si ya tiene suficiente información para responder. El bucle continúa hasta que el LLM emite una respuesta final.

### Resumen de diferencias

| Concepto | Qué es | Ejemplo |
|---|---|---|
| **Modelo** | Función matemática con pesos | ResNet, BERT, Gemini (pesos) |
| **LLM** | Modelo entrenado para predecir texto | Gemini, GPT-4, Claude, Llama |
| **Agente** | Software que envuelve un LLM con tools y bucle | Claude Code, Cursor, un bot de atención al cliente |

---

## 2. Anatomía de un Agente

### Tokens: la unidad de intercambio

El LLM no trabaja con palabras, trabaja con **tokens**. Un token es un fragmento de texto (típicamente 3-4 caracteres en inglés, algo más en español). El texto se tokeniza antes de entrar al modelo, y los tokens que genera el modelo se decodifican de vuelta a texto.

Esto importa porque los modelos tienen un **límite de contexto** (máximo de tokens que pueden procesar a la vez) y los proveedores cobran por tokens consumidos.

```
"Hola mundo"  →  ["Hola", " mundo"]  →  [15496, 9978]
```

### System prompt

El **system prompt** es el mensaje que se envía al LLM antes de cualquier interacción con el usuario. Define:

- El **rol** del agente ("Eres un asistente de soporte técnico…")
- Las **restricciones** de comportamiento ("Nunca reveles información de otros clientes")
- El **contexto** necesario ("Tienes acceso a estas herramientas…")

Es fijo —o casi fijo— durante toda la sesión. Cualquier desarrollador que construya un agente controla este texto.

### User prompt

El **user prompt** es el mensaje que envía el usuario en cada turno. El LLM recibe el historial completo de la conversación (system prompt + turnos anteriores + nuevo user prompt) cada vez que genera una respuesta.

### Tools (herramientas)

El LLM no puede ejecutar código directamente. Lo que puede hacer es **pedir al sistema** que ejecute una función. El flujo es:

1. El LLM decide llamar a `get_weather` con `city: "Madrid"`
2. El agente (el harness) detecta esa intención en la respuesta del LLM
3. El harness ejecuta la función `get_weather("Madrid")`
4. El resultado se añade al historial como un mensaje de "herramienta"
5. El LLM recibe ese resultado y genera la respuesta final

Las tools se definen con un **nombre**, una **descripción** (en lenguaje natural, para que el LLM entienda cuándo usarla) y un **schema de parámetros** (JSON Schema o Zod, dependiendo del framework).

```typescript
const get_weather = new FunctionTool({
  name: 'get_weather',
  description: 'Devuelve el tiempo actual para una ciudad dada.',
  parameters: z.object({
    city: z.string().describe('Nombre de la ciudad'),
  }),
  execute: async ({ city }) => {
    // Esta función la ejecuta el harness, no el LLM
    return fetchWeatherAPI(city);
  },
});
```

### Guardrails

Los **guardrails** son validaciones que envuelven la llamada al LLM para controlar qué entra y qué sale:

```
User input
    │
    ▼
┌─────────────────┐
│ Input Guardrail │  ← ¿Es una petición válida? ¿Hay prompt injection?
└─────────────────┘
    │ (si pasa)
    ▼
   LLM
    │
    ▼
┌──────────────────┐
│ Output Guardrail │  ← ¿Hay datos sensibles? ¿Tiene el formato correcto?
└──────────────────┘
    │ (si pasa)
    ▼
Respuesta al usuario
```

Los guardrails pueden ser:

- **Reglas de negocio simples**: expresiones regulares, listas negras de palabras
- **Otro LLM**: un modelo más pequeño y económico que clasifica la petición antes de pasarla al LLM principal
- **Servicios externos**: APIs de moderación de contenido (ej. Google Safe Browsing)

En Google ADK, los guardrails se implementan como **callbacks**: `beforeModelCallback` (input) y `afterModelCallback` (output).

---

## 3. Harness, Graphs y Workflows

### Harness

El **harness** es el entorno de ejecución que gestiona el bucle del agente. Se encarga de:

- Mantener el historial de mensajes (la "memoria" de conversación)
- Detectar cuando el LLM solicita una herramienta y ejecutarla
- Controlar el número máximo de iteraciones del bucle
- Gestionar errores y reintentos

El harness es lo que convierte a un LLM (que solo predice texto) en un agente funcional.

> **Ejemplos de harness que ya conoces**: Claude Code (el CLI que ejecuta este material), Cursor, GitHub Copilot, cualquier chatbot de atención al cliente basado en LLM.

Google ADK, LangChain, o el Vercel AI SDK son frameworks que proporcionan un harness y utilidades para construir agentes.

### Graph (sistemas multi-agente)

Un **grafo de agentes** es una arquitectura donde múltiples agentes especializados colaboran. Cada nodo del grafo es un agente con su propio system prompt y sus propias herramientas; los arcos representan el flujo de mensajes.

```
                ┌──────────────────┐
  User ──────►  │  Agente Orquesta │
                └──────┬──────┬────┘
                       │      │
           ┌───────────┘      └────────────┐
           ▼                               ▼
  ┌────────────────┐             ┌─────────────────┐
  │ Agente Extrae  │             │  Agente Analiza │
  │  (parsing)     │             │  (razonamiento) │
  └────────────────┘             └─────────────────┘
```

El agente orquestador recibe la petición del usuario, decide qué subagentes invocar, y agrega sus respuestas. Cada subagente es independiente —tiene su propio system prompt y sus propias herramientas—.

**Ventaja**: Separation of concerns. Un agente especializado en extracción de datos hace mejor ese trabajo que un agente genérico.

**Coste**: Más llamadas al LLM = más latencia y más coste.

### Workflows

Un **workflow** es la orquestación determinista de pasos. A diferencia del razonamiento libre de un agente (donde el LLM decide qué herramientas llamar y en qué orden), un workflow define el flujo de ejecución de forma explícita en el código:

| | Agente | Workflow |
|---|---|---|
| **Quién decide el flujo** | El LLM | El desarrollador |
| **Flexibilidad** | Alta | Baja |
| **Previsibilidad** | Menor | Alta |
| **Coste** | Mayor (más iteraciones) | Menor |
| **Uso ideal** | Tareas abiertas, conversacionales | Pipelines de datos, procesos empresariales |

Los workflows pueden ser secuenciales, paralelos o condicionales. Google ADK soporta ambos paradigmas: puedes tener un workflow que en uno de sus pasos invoca a un agente, y viceversa.

---

## 4. Observabilidad y Evaluaciones

### ¿Por qué es difícil la observabilidad en agentes?

En una API REST tradicional, el flujo es determinista: sabes exactamente qué llamadas se hicieron y en qué orden. En un agente, el LLM decide en tiempo de ejecución qué herramientas llamar y cuántas iteraciones hacer. Esto hace que la observabilidad sea crítica: sin trazas, un agente es una caja negra.

### Trazas y spans

El estándar de facto para observabilidad en agentes es **OpenTelemetry (OTel)**. Cada llamada al LLM y cada ejecución de herramienta se registra como un **span** dentro de una **traza** que representa la petición completa.

```
Traza: "¿Cuál es el tiempo en Madrid?"
│
├── Span: input_guardrail         [2ms]
├── Span: llm_call (gemini-flash) [340ms]  ← tokens: 512 in / 128 out
├── Span: tool_call (get_weather) [120ms]
├── Span: llm_call (gemini-flash) [280ms]  ← tokens: 640 in / 64 out
└── Span: output_guardrail        [1ms]
```

Herramientas como **Google Cloud Trace**, **Langfuse**, **Phoenix (Arize)** o **Honeycomb** consumen estas trazas y permiten depurar, analizar latencias y detectar anomalías.

### Métricas clave

| Métrica | Qué mide | Alerta cuando… |
|---|---|---|
| Latencia P99 | Tiempo de respuesta extremo | Supera el SLA |
| Coste por conversación | Tokens × precio | Excede el presupuesto |
| Tool error rate | % de llamadas a tools que fallan | > 1% |
| Guardrail block rate | % de peticiones bloqueadas | Sube de golpe (posible ataque) |
| Iterations per request | Bucles del agente por petición | > 10 (posible loop infinito) |

### Evaluaciones (Evals)

Las evaluaciones son el equivalente a los tests unitarios en el mundo de los agentes. Dado que la salida del LLM no es determinista, los evals miden calidad, no igualdad exacta.

**Tipos de evaluación:**

**1. Assertion-based** — para comportamientos binarios:
```typescript
// La respuesta debe mencionar la temperatura
assert(response.includes('°C') || response.includes('grados'));

// El agente debe haber llamado a get_weather
assert(toolCallLog.includes('get_weather'));
```

**2. LLM-as-judge** — para evaluar calidad semántica:
```
Prompt al modelo juez:
"Dada la pregunta del usuario y la respuesta del agente,
 puntúa del 1 al 5 qué tan útil, precisa y segura es la respuesta.
 Justifica tu puntuación."
```
Un modelo más económico (ej. Gemini Flash) actúa como evaluador. Útil cuando la respuesta correcta no es única.

**3. Human eval** — para casos ambiguos o de alto riesgo. Un evaluador humano revisa una muestra de conversaciones y las etiqueta.

**El ciclo de evaluación en producción:**

```
Producción → Logs de conversaciones → Muestra aleatoria
    ↓
Eval pipeline (assertions + LLM judge)
    ↓
Dashboard de calidad → Regresiones → Iteración del system prompt o tools
```

---

## 5. Ejemplo práctico: Google ADK

### ¿Qué es Google ADK?

**Google Agent Development Kit (ADK)** es el framework oficial de Google para construir agentes de IA. Está optimizado para Gemini pero es agnóstico al modelo. Tiene SDKs en Python y TypeScript, y en 2026 lanzó soporte oficial para Go y Java.

**Por qué ADK** (y no LangChain, Vercel AI SDK, etc.):
- Mantenido por el mismo equipo que Gemini
- Integración nativa con Google Cloud (Vertex AI, Cloud Run, Trace)
- `npx adk web` levanta un inspector visual del agente para debug
- Soporte nativo de multi-agent graphs y workflows

### Estructura del ejemplo

El código está en el directorio `ejemplo-adk/` de este repositorio:

```
ejemplo-adk/
├── package.json
├── tsconfig.json
├── agent.ts        ← el agente completo: system prompt, tool, guardrails
└── README.md       ← instrucciones de instalación y ejecución
```

### Conceptos que ilustra el ejemplo

| Concepto de la teoría | Dónde aparece en el código |
|---|---|
| System prompt | Propiedad `instruction` del agente |
| Tool | `FunctionTool` con `get_weather` |
| Guardrail de input | `beforeModelCallback` |
| Guardrail de output | `afterModelCallback` |
| Harness | `npx adk web` o `npx adk run` |

### Cómo seguir aprendiendo

- [Documentación oficial ADK](https://adk.dev)
- [Repositorio de ejemplos ADK](https://github.com/google/adk-samples)
- [Callbacks y guardrails en ADK](https://google.github.io/adk-docs/callbacks/)
