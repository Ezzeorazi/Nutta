# Cómo funciona Nutta 🥗

Resumen del funcionamiento de la app: qué hace, cómo está armada y cómo fluye la información.

- **Live:** https://app-alimentacion-nine.vercel.app
- **Código:** https://github.com/Ezzeorazi/Nutta

---

## 1. Qué es

Nutta es un **coach fitness conversacional**, mobile-first y PWA instalable. En vez de llenar formularios, le **hablás como a ChatGPT/WhatsApp** y la IA registra sola tu comida, ejercicio, peso, agua, sueño y pasos.

Ejemplo real:

> «Hoy desayuné 3 huevos, media palta y un café, dormí 7 horas y me pesé 79»

…queda todo registrado (con calorías y macros estimados) sin tocar un solo formulario.

Además lleva **memoria** de tus hábitos ("hice lo de siempre"), te da un **score diario 0-100**, **insights** automáticos, seguimiento de **peso/medidas** con gráficos y predicción, y un **análisis semanal** en tono de entrenador. Los datos se **sincronizan en la nube** y funciona offline.

---

## 2. Stack

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 16 (App Router) + React 19 |
| Estilos | Tailwind CSS v4 (config en `globals.css`, dark mode incluido) |
| Base de datos + Auth | InstantDB (sync en tiempo real + login por código mágico) |
| IA (coach) | Vercel AI SDK v7 + Groq (modelo `openai/gpt-oss-20b`, gratis) |
| Datos de alimentos | Open Food Facts (API pública) |
| Escaneo de códigos | ZXing (`@zxing/browser`, carga diferida) |
| Voz | Web Speech API (dictado, es-AR) |
| Gráficos | Recharts |
| Hosting | Vercel (deploy automático desde GitHub) |

> La IA necesita la variable de entorno `GROQ_API_KEY` (gratis, de console.groq.com). En local va en `.env.local`; en Vercel se carga en Settings → Environment Variables.

---

## 3. Flujo del usuario

```
Abrir app
   │
   ▼
¿Logueado? ──no──► Login por código mágico (email → código de 6 dígitos)
   │ sí
   ▼
¿Tiene perfil? ──no──► Onboarding (2 pasos) → calcula metas
   │ sí
   ▼
CHAT (pantalla principal) ◄─► Hoy ◄─► Progreso ◄─► Historial  (tabs abajo)
```

La **primera vez** que iniciás sesión, los datos que tuvieras guardados localmente (de antes de la nube) se **suben automáticamente** a tu cuenta.

Los **4 tabs**:
- **💬 Chat** — hablás y la IA registra. Es la pantalla de inicio.
- **🍽️ Hoy** — resumen del día: score, calorías/macros, bienestar, suplementos, insights y timeline.
- **📈 Progreso** — peso (con meta y predicción) y medidas corporales.
- **📊 Historial** — gráficos de los últimos 7 días.

---

## 4. Cómo funciona cada parte

### El Chat con IA (el corazón)
- Escribís (o dictás con el 🎙️) en lenguaje natural; el mensaje va al endpoint [`/api/chat`](../src/app/api/chat/route.ts).
- La IA (Groq) devuelve **salida estructurada** (`generateObject` con un esquema Zod): la respuesta del coach + los registros detectados (comidas con macros, ejercicios, peso, agua, sueño, pasos) + hechos nuevos para recordar.
- El cliente persiste todo en InstantDB y muestra la respuesta como en un chat.
- Lógica de la IA en [`src/lib/coach.ts`](../src/lib/coach.ts); orquestación en [`src/app/page.tsx`](../src/app/page.tsx); UI en [`Chat.tsx`](../src/components/Chat.tsx).

### Memoria del usuario ("hice lo de siempre")
- Nutta recuerda hábitos, alimentos frecuentes, suplementos, lesiones, objetivos y rutina (botón 🧠 en el chat).
- La IA **lee** esa memoria + tus alimentos frecuentes para resolver "lo de siempre", y **aprende sola** guardando hechos nuevos y duraderos.
- Contexto puro (sin IA) en [`src/lib/coachContext.ts`](../src/lib/coachContext.ts); UI en [`MemorySheet.tsx`](../src/components/MemorySheet.tsx).

### Timeline del día
- Muestra la jornada en orden cronológico (hora + emoji + nombre + kcal), estilo WhatsApp/Apple.
- Emojis derivados por palabra clave en [`src/lib/emoji.ts`](../src/lib/emoji.ts); vista en [`Timeline.tsx`](../src/components/Timeline.tsx).

### Score diario (0-100)
- Pondera proteína, calorías, macros, entrenamiento y —si los registrás— sueño y agua; el alcohol resta.
- Se **normaliza sobre los factores presentes**: no registrar sueño/agua no te penaliza.
- Cálculo determinista (sin IA) en [`src/lib/score.ts`](../src/lib/score.ts); tarjeta con anillo, banda de color y tips en [`ScoreCard.tsx`](../src/components/ScoreCard.tsx).

### Insights automáticos
- Detecta racha de entrenamiento, grupos musculares sin trabajar hace tiempo, tendencia de proteína y alcohol del día.
- Deterministas en [`src/lib/insights.ts`](../src/lib/insights.ts); vista en [`InsightsCard.tsx`](../src/components/InsightsCard.tsx).

### Coach IA — análisis semanal
- Botón 📊 en el chat: arma un resumen de los últimos 7 días y la IA responde como entrenador (directo, concreto), vía [`/api/coach`](../src/app/api/coach/route.ts).

### Comidas y ejercicio (alta manual, además del chat)
- **Comidas**: búsqueda en Open Food Facts (desde el navegador) + escaneo de código de barras; los macros se escalan por gramos. Formularios en [`FoodForm.tsx`](../src/components/FoodForm.tsx).
- **Ejercicio**: actividades con valores **MET** (`MET × peso × horas`) en [`ExerciseForm.tsx`](../src/components/ExerciseForm.tsx) y [`src/lib/exercises.ts`](../src/lib/exercises.ts).
- Onboarding y metas (Mifflin-St Jeor → TDEE → macros) en [`src/lib/nutrition.ts`](../src/lib/nutrition.ts).

### Progreso corporal
- **Peso**: gráfico de evolución, meta y **predicción** (regresión lineal → ETA a la meta). En [`WeightPanel.tsx`](../src/components/WeightPanel.tsx) y [`src/lib/weight.ts`](../src/lib/weight.ts).
- **Medidas**: cintura, pecho, brazo, muslo y pantorrilla, con gráfico por parte. En [`MeasuresPanel.tsx`](../src/components/MeasuresPanel.tsx).

### Bienestar y suplementos (tab Hoy)
- **Agua** (botones rápidos), **sueño** (horas) y **pasos**, con barras de progreso. En [`WellbeingCard.tsx`](../src/components/WellbeingCard.tsx).
- **Suplementos**: lista propia con checklist diario y horario. En [`SupplementsCard.tsx`](../src/components/SupplementsCard.tsx).

### Historial (últimos 7 días)
- Promedios + gráfico de calorías netas por día (con línea de meta) + gráfico de macros. En [`History.tsx`](../src/components/History.tsx) y [`src/lib/analytics.ts`](../src/lib/analytics.ts).

---

## 5. Dónde y cómo se guardan los datos

- La base de datos es **InstantDB** (en la nube), asociada a tu cuenta por **email**.
- Entidades, cada una con un campo `owner` (= tu id de usuario):
  `profiles`, `foods`, `exercises`, `messages` (chat), `memories`, `weights`, `metrics` (agua/sueño/pasos), `measures`, `supplements` y `supplementLogs`.
- Las escrituras son **optimistas**: se ven al instante y se sincronizan en segundo plano (funciona offline y reconcilia al reconectar).
- **Seguridad**: reglas de permisos que solo permiten a cada usuario ver/editar sus propios registros (`auth.id == data.owner`).
- Cliente y esquema en [`src/lib/db.ts`](../src/lib/db.ts); acceso centralizado en el hook [`src/lib/useNutta.ts`](../src/lib/useNutta.ts); login en [`Login.tsx`](../src/components/Login.tsx).

> El `App ID` de InstantDB es una clave **pública** (viaja al navegador); la seguridad real la dan las reglas de permisos.

---

## 6. Arquitectura de la IA

- **Dos endpoints** (Vercel Functions, server-side): `/api/chat` (parseo de mensaje → registros, `generateObject`) y `/api/coach` (análisis semanal, `generateText`).
- Toda la lógica de IA vive en [`src/lib/coach.ts`](../src/lib/coach.ts) (server-only; importa `@ai-sdk/groq`). El armado de contexto es puro y client-safe en [`src/lib/coachContext.ts`](../src/lib/coachContext.ts).
- `page.tsx` **nunca** importa `coach.ts` → el bundle del cliente no arrastra el SDK de IA.
- **Modelo**: `openai/gpt-oss-20b` en Groq (gratis y rápido). Se eligió porque los modelos Llama de Groq **no soportan** salida estructurada (`json_schema`) y estos sí. Se puede cambiar con la env `GROQ_MODEL`.

---

## 7. PWA (instalable + offline)

- **Manifest** con nombre, colores e íconos: [`src/app/manifest.ts`](../src/app/manifest.ts).
- **Service worker** ([`public/sw.js`](../public/sw.js)) cachea el app-shell para uso offline (no cachea las APIs).
- La UI respeta el **safe-area** de iOS (barra de gestos) en la navegación y el input del chat.
- Instalación: Android/Chrome → "Instalar app"; iOS/Safari → Compartir → "Agregar a inicio".

---

## 8. Desarrollo y despliegue

```bash
npm install
# crear .env.local con GROQ_API_KEY=... (gratis, de console.groq.com)
npm run dev      # http://localhost:3000
npm run build    # build de producción
```

- Cada `git push` a `main` dispara un **deploy automático** a producción en Vercel.
- Para que la IA funcione en producción hay que cargar `GROQ_API_KEY` en las variables de entorno de Vercel.

---

## 9. Estructura del proyecto

```
src/
├─ app/
│  ├─ page.tsx            Orquestador: hook de datos + handlers + tabs
│  ├─ layout.tsx          Layout raíz, metadata, service worker
│  ├─ globals.css         Tema (paleta Nutta + dark mode)
│  ├─ manifest.ts         Manifest PWA
│  └─ api/
│     ├─ chat/            Coach IA: mensaje → registros (generateObject)
│     ├─ coach/           Coach IA: análisis semanal (generateText)
│     └─ foods/barcode/   Producto por código de barras
├─ components/
│  ├─ Chat.tsx            Chat estilo WhatsApp + voz + botones 🧠/📊
│  ├─ HoyTab.tsx          Tab "Hoy" (score, macros, bienestar, timeline…)
│  ├─ ProgresoTab.tsx     Tab "Progreso" (peso + medidas)
│  ├─ Timeline.tsx        Línea de tiempo del día
│  ├─ ScoreCard.tsx       Score diario 0-100
│  ├─ InsightsCard.tsx    Insights automáticos
│  ├─ MemorySheet.tsx     Memoria del usuario (🧠)
│  ├─ WeightPanel.tsx     Peso: gráfico, meta, predicción
│  ├─ MeasuresPanel.tsx   Medidas corporales por parte
│  ├─ WellbeingCard.tsx   Agua / sueño / pasos
│  ├─ SupplementsCard.tsx Suplementos + checklist
│  ├─ FoodForm/ExerciseForm/Sheet, History, BottomNav, BarcodeScanner…
│  └─ Login.tsx / Onboarding.tsx
└─ lib/
   ├─ db.ts               Cliente y esquema de InstantDB
   ├─ useNutta.ts         Hook central de datos (query + mutaciones)
   ├─ coach.ts            IA: esquema, prompts, interpretMessage/analyzeWeek
   ├─ coachContext.ts     Contexto puro para la IA (frecuentes, resumen semanal)
   ├─ score.ts            Score diario
   ├─ insights.ts         Insights
   ├─ weight.ts           Predicción de peso
   ├─ emoji.ts            Emoji por palabra clave
   ├─ nutrition.ts        Mifflin-St Jeor y metas
   ├─ exercises.ts        Tabla MET
   ├─ analytics.ts        Agregación del historial
   ├─ off.ts              Normalización de Open Food Facts
   └─ types.ts            Tipos compartidos
```

---

## 10. Detalles a tener en cuenta

- La **búsqueda de alimentos se hace desde el navegador** (Open Food Facts bloquea las IPs de datacenter de Vercel). El endpoint de producto por código sí funciona server-side porque está cacheado en el edge.
- Groq **no ofrece visión gratis** en esta cuenta, por eso no hay análisis de fotos: el registro es por texto o voz.
- Sin `GROQ_API_KEY` el chat/coach no funcionan (el resto de la app sí).
- Los datos requieren estar **logueado**; sin sesión no hay acceso.

---

## 11. Ideas a futuro

- **Rutinas de gym**: series/reps/peso, PR, volumen total y recomendaciones ("ayer pecho, hoy espalda").
- **Fotos** antes/después con slider comparativo.
- **Rachas, logros y metas** personalizadas.
- **Estadísticas** mensuales y **exportación** CSV/PDF.
- **Recetas / favoritos** para cargar más rápido.
