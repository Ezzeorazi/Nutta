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

Además lleva **memoria** de tus hábitos ("hice lo de siempre"), te da un **score diario 0-100**, **insights** automáticos, seguimiento de **peso/medidas** con gráficos y predicción, **entrenamiento de fuerza** (series/reps/PR/volumen con un catálogo de +400 ejercicios), **rachas, logros y metas**, **exportación** CSV/PDF, y un **análisis semanal** en tono de entrenador. Los datos se **sincronizan en la nube** y funciona offline.

---

## 2. Stack

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 16 (App Router) + React 19 |
| Estilos | Tailwind CSS v4 (config en `globals.css`, dark mode incluido) |
| Base de datos + Auth | InstantDB (sync en tiempo real + login por código mágico) |
| IA (coach) | Vercel AI SDK v7 + Groq (modelo `openai/gpt-oss-20b`, gratis) |
| Datos de alimentos | Open Food Facts (API pública) |
| Datos de ejercicios | RepDB (catálogo de +400 ejercicios, licencia free; bundleado en `src/data/`) |
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
CHAT (principal) ◄─► Hoy ◄─► Gym ◄─► Progreso ◄─► Historial  (tabs abajo)
```

La **primera vez** que iniciás sesión, los datos que tuvieras guardados localmente (de antes de la nube) se **suben automáticamente** a tu cuenta.

Los **5 tabs**:
- **💬 Chat** — hablás y la IA registra. Es la pantalla de inicio. Confirma con un resumen de lo registrado y permite **deshacer** el último alta.
- **🍽️ Hoy** — resumen del día: score, calorías/macros, bienestar, suplementos, insights y timeline. Con las flechas **‹ ›** navegás a días anteriores y podés **completarlos** (ver §4).
- **🏋️ Gym** — entrenamiento de fuerza: series/reps/peso, PR, volumen y progresión. También permite **cargar series de un día pasado**.
- **📈 Progreso** — peso (con meta y predicción), medidas, fotos y metas personalizadas.
- **📊 Historial** — gráficos de los últimos 7/30 días, rachas y logros, y exportación.

---

## 4. Cómo funciona cada parte

### El Chat con IA (el corazón)
- Escribís (o dictás con el 🎙️) en lenguaje natural; el mensaje va al endpoint [`/api/chat`](../src/app/api/chat/route.ts).
- La IA (Groq) devuelve **salida estructurada** (`generateObject` con un esquema Zod): la respuesta del coach + los registros detectados (comidas con macros, ejercicios, peso, agua, sueño, pasos) + hechos nuevos para recordar.
- Antes de responder, un **post-proceso determinístico** ([`src/lib/coachEnrich.ts`](../src/lib/coachEnrich.ts)) "snapea" los ejercicios detectados contra el catálogo de RepDB: **normaliza el nombre** al canónico (evita duplicados de PR/volumen) y **recalcula las calorías con el MET real**. Esto es código, no IA: el dataset **nunca** entra al prompt.
- El cliente persiste todo en InstantDB y muestra la respuesta como en un chat, con un resumen **📝 Registrado** (qué se guardó, con kcal/proteína) y un botón **↩️ Deshacer** que borra ese último lote si la IA interpretó mal.
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

### Completar días pasados (backfill)
- El chat siempre registra en **hoy**, pero si te olvidaste de cargar algo podés completar días anteriores desde el alta manual:
  - **Tab Hoy** → flechas **‹ ›** hasta el día → sección "Agregar a \<fecha\>" (comida / ejercicio / recetas), la tarjeta de **Bienestar** (agua/sueño/pasos) y el checklist de **Suplementos**.
  - **Tab Gym** → flechas **‹ ›** hasta el día → aparece el formulario de alta de series.
- **Cómo cae en el día correcto**: el día efectivo de un registro se deriva de su `createdAt`, no del campo `date` (arrastre del bug histórico de UTC). Por eso, al dar de alta en un día pasado, el `createdAt` se **ancla al mediodía local** de ese día (`startOfLocalDayMs` en [`types.ts`](../src/lib/types.ts)); en el Gym se le suma **1 min por serie** ya cargada para preservar el orden de la sesión.
- Solo los **insights** quedan atados a hoy (miran el estado actual). No hay edición directa de un registro: se **borra y se vuelve a cargar**.

### Comidas y ejercicio (alta manual, además del chat)
- **Comidas**: búsqueda en Open Food Facts (desde el navegador) + escaneo de código de barras; los macros se escalan por gramos. Formularios en [`FoodForm.tsx`](../src/components/FoodForm.tsx).
- **Estimación con IA (fallback)**: cuando OFF no tiene el alimento **o está caído** (responde 503/HTML, cosa frecuente), el buscador avisa y ofrece un botón **"🤖 Estimar con IA"** que pide los macros por 100 g y rellena el form (los escala por cantidad igual que un producto). Motor en [`coach.ts`](../src/lib/coach.ts) (`estimateFood`), vía [`/api/foods/estimate`](../src/app/api/foods/estimate/route.ts).
- **Ejercicio (cardio)**: actividades con valores **MET** (`MET × peso × horas`) en [`ExerciseForm.tsx`](../src/components/ExerciseForm.tsx) y [`src/lib/exercises.ts`](../src/lib/exercises.ts).
- Onboarding y metas (Mifflin-St Jeor → TDEE → macros) en [`src/lib/nutrition.ts`](../src/lib/nutrition.ts).

### Gym — entrenamiento de fuerza (tab Gym)
- Alta rápida estilo Strong: ejercicio (con **autocompletado** de tu historial + los 400 nombres de RepDB), reps y peso; calcula **volumen** (reps × peso), marca **PR** 🏆 y grafica la **progresión** por ejercicio.
- El navegador de días (**‹ ›**) permite mirar sesiones anteriores y **cargar series en un día pasado** (ver §4, "Completar días pasados").
- **Sugerencia del día** (`dailyRoutineSuggestion`): según cuántos días de fuerza llevás en la semana (objetivo `GYM_DAYS_GOAL`, hoy **5**), te dice qué toca hoy con un banner descartable (✕, por jornada, guardado en `localStorage`):
  - Vas por debajo del objetivo → el **grupo que te falta** + 3 ejercicios concretos del catálogo (*"Hoy te conviene espalda. Probá: Peso Muerto con Barra, Remo con Barra Inclinado…"*).
  - Ya cumpliste los 5 días → 🧘 **recuperación activa** (cardio suave + core/movilidad).
  - Ya entrenaste hoy → ✅ confirmación.
- Los grupos musculares se detectan con los **músculos reales** del dataset (mapa `exercise-groups.json`), con fallback a regex para nombres libres. Los ejercicios sugeridos por grupo salen de `exercise-by-group.json` (priorizados: compuestos + pesos libres + básicos icónicos, con variedad).
- Desde el chat, frases como *"press banca 4x8 con 60"* se cargan como series de fuerza y se normalizan al nombre canónico de RepDB.
- Lógica en [`src/lib/gym.ts`](../src/lib/gym.ts); catálogo y matcher en [`src/lib/exerciseDb.ts`](../src/lib/exerciseDb.ts); UI en [`GymTab.tsx`](../src/components/GymTab.tsx).

### Catálogo de ejercicios (RepDB)
- Dataset de **+400 ejercicios** con nombre en español, **MET**, grupos musculares y categoría, adelgazado a [`src/data/exercises.json`](../src/data/exercises.json) por el script `npm run data:exercises`.
- El matcher ([`exerciseDb.ts`](../src/lib/exerciseDb.ts)) normaliza (sin tildes/minúsculas) y compara por tokens; un guard evita que frases genéricas ("entrené espalda") se snapeen a un ejercicio puntual.
- Se usa **solo como post-proceso determinístico**, nunca dentro de la IA (lo exige la licencia RepDB).

### Progreso corporal
- **Peso**: gráfico de evolución, meta y **predicción** (regresión lineal → ETA a la meta). En [`WeightPanel.tsx`](../src/components/WeightPanel.tsx) y [`src/lib/weight.ts`](../src/lib/weight.ts).
- **Medidas**: cintura, pecho, brazo, muslo y pantorrilla, con gráfico por parte. En [`MeasuresPanel.tsx`](../src/components/MeasuresPanel.tsx).

### Bienestar y suplementos (tab Hoy)
- **Agua** (botones rápidos), **sueño** (horas) y **pasos**, con barras de progreso. La **meta de agua se escala al peso** (~35 ml/kg, piso 2 L) y también cuenta en el score. Se puede registrar en días pasados. En [`WellbeingCard.tsx`](../src/components/WellbeingCard.tsx).
- **Suplementos**: lista propia con checklist diario y horario (**referencia visual**, sin notificación). Opcionalmente cada suplemento puede definir una **cantidad habitual** (ej. 30 g, 2 cápsulas) y la **proteína que aporta esa cantidad**; al marcarlo se puede ajustar la cantidad realmente tomada ese día (± cápsulas/gramos) con un stepper, y la proteína se **escala proporcionalmente** y se suma al total de proteína del día (Hoy, score e Historial). Cálculo puro en [`src/lib/supplements.ts`](../src/lib/supplements.ts); UI en [`SupplementsCard.tsx`](../src/components/SupplementsCard.tsx).

### Historial (últimos 7 días)
- Promedios + gráfico de calorías netas por día (con línea de meta) + gráfico de macros. En [`History.tsx`](../src/components/History.tsx) y [`src/lib/analytics.ts`](../src/lib/analytics.ts).

---

## 5. Dónde y cómo se guardan los datos

- La base de datos es **InstantDB** (en la nube), asociada a tu cuenta por **email**.
- Entidades, cada una con un campo `owner` (= tu id de usuario):
  `profiles`, `foods`, `exercises`, `messages` (chat), `memories`, `weights`, `metrics` (agua/sueño/pasos), `measures`, `supplements`, `supplementLogs`, `strengthSets` (fuerza), `customGoals` (metas), `favorites`, `recipes` y `photos` (+ `$files` de storage).
- Las escrituras son **optimistas**: se ven al instante y se sincronizan en segundo plano (funciona offline y reconcilia al reconectar).
- **Seguridad**: reglas de permisos que solo permiten a cada usuario ver/editar sus propios registros (`auth.id == data.owner`).
- Cliente y esquema en [`src/lib/db.ts`](../src/lib/db.ts); acceso centralizado en el hook [`src/lib/useNutta.ts`](../src/lib/useNutta.ts); login en [`Login.tsx`](../src/components/Login.tsx).

> El `App ID` de InstantDB es una clave **pública** (viaja al navegador); la seguridad real la dan las reglas de permisos.

---

## 6. Arquitectura de la IA

- **Tres endpoints** (Vercel Functions, server-side): `/api/chat` (parseo de mensaje → registros, `generateObject`), `/api/coach` (análisis semanal, `generateText`) y `/api/foods/estimate` (macros de un alimento por 100 g, `generateObject`).
- Toda la lógica de IA vive en [`src/lib/coach.ts`](../src/lib/coach.ts) (server-only; importa `@ai-sdk/groq`). El armado de contexto es puro y client-safe en [`src/lib/coachContext.ts`](../src/lib/coachContext.ts).
- `page.tsx` **nunca** importa `coach.ts` → el bundle del cliente no arrastra el SDK de IA.
- **Post-proceso determinístico**: la salida de la IA pasa por [`coachEnrich.ts`](../src/lib/coachEnrich.ts) (nombres canónicos + calorías por MET real desde el catálogo RepDB). Es código puro y client-safe; el dataset no se le pasa al modelo.
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

npm run data:exercises   # regenera el catálogo de ejercicios (RepDB)
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
│     └─ foods/
│        ├─ barcode/      Producto por código de barras (OFF)
│        └─ estimate/     Estimación IA de macros por 100 g
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
│  ├─ GymTab.tsx          Tab "Gym" (fuerza, PR, volumen, progresión)
│  ├─ FoodForm/ExerciseForm/Sheet, History, BottomNav, BarcodeScanner…
│  └─ Login.tsx / Onboarding.tsx
├─ data/                   Generados por scripts/build-exercises.mjs (RepDB)
│  ├─ exercises.json       Catálogo adelgazado (server)
│  ├─ exercise-names.json  Solo nombres (autocompletado del cliente)
│  ├─ exercise-groups.json Nombre → grupo muscular (recomendación)
│  └─ exercise-by-group.json  Grupo → ejercicios sugeridos (rutina)
└─ lib/
   ├─ db.ts               Cliente y esquema de InstantDB
   ├─ useNutta.ts         Hook central de datos (query + mutaciones)
   ├─ coach.ts            IA: esquema, prompts, interpretMessage/analyzeWeek
   ├─ coachContext.ts     Contexto puro para la IA (frecuentes, resumen semanal)
   ├─ coachEnrich.ts      Post-proceso: nombres canónicos + MET real (RepDB)
   ├─ exerciseDb.ts       Catálogo RepDB + matcher + grupos musculares
   ├─ gym.ts              Volumen, PR, progresión y recomendaciones
   ├─ score.ts            Score diario
   ├─ supplements.ts      Proteína aportada por suplementos (por toma/día)
   ├─ insights.ts         Insights
   ├─ achievements.ts     Rachas y logros
   ├─ export.ts           Exportación CSV/PDF
   ├─ weight.ts           Predicción de peso
   ├─ emoji.ts            Emoji por palabra clave
   ├─ nutrition.ts        Mifflin-St Jeor y metas
   ├─ exercises.ts        Tabla MET (cardio)
   ├─ analytics.ts        Agregación del historial
   ├─ off.ts              Normalización de Open Food Facts
   └─ types.ts            Tipos compartidos
```

> El script [`scripts/build-exercises.mjs`](../scripts/build-exercises.mjs) genera los dos JSON de `data/` a partir del dataset de RepDB.

---

## 10. Detalles a tener en cuenta

- La **búsqueda de alimentos se hace desde el navegador** (Open Food Facts bloquea las IPs de datacenter de Vercel). El endpoint de producto por código sí funciona server-side porque está cacheado en el edge.
- Groq **no ofrece visión gratis** en esta cuenta, por eso no hay análisis de fotos: el registro es por texto o voz.
- Sin `GROQ_API_KEY` el chat/coach no funcionan (el resto de la app sí).
- Los datos requieren estar **logueado**; sin sesión no hay acceso.
- **Licencia del catálogo de ejercicios (RepDB, free)**: permite uso comercial pero exige **atribución visible** ("Exercise data by RepDB — repdb.co", en el README y al pie del Gym) y **prohíbe** redistribuirlo como dataset/API o usarlo dentro de modelos generativos de IA. Por eso el dataset se bundlea en la app y solo se usa como post-proceso determinístico.

---

## 11. Ideas a futuro

- **Biblioteca visual de ejercicios**: fichas con imágenes (RepDB), músculos e instrucciones, para tocar y cargar.
- **Tabla de alias** para vocabulario que hoy no matchea el catálogo (ej. "zancada" → estocada).
- **Recordatorios push** reales (suplementos, hidratación) — hoy solo visual.
- **Análisis de fotos** con visión (bloqueado: Groq no ofrece visión gratis en esta cuenta).
