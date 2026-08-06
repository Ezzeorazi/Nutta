# Cómo funciona Nutta 🥗

Resumen del funcionamiento de la app: qué hace, cómo está armada y cómo fluye la información.

- **Live:** https://nutta.vercel.app
- **Código:** https://github.com/Ezzeorazi/Nutta

---

## 1. Qué es

Nutta es un **coach fitness conversacional**, mobile-first y PWA instalable. En vez de llenar formularios, le **hablás como a ChatGPT/WhatsApp** y la IA registra sola tu comida, ejercicio, peso, agua, sueño y pasos.

Ejemplo real:

> «Hoy desayuné 3 huevos, media palta y un café, dormí 7 horas y me pesé 79»

…queda todo registrado (con calorías y macros estimados) sin tocar un solo formulario.

Pero lo que la hace un **entrenador** y no un contador de calorías es que **nutrición y entrenamiento no son módulos separados**: todo se cruza en una sola capa ([`athlete.ts`](../src/lib/athlete.ts)) antes de recomendar nada. Si entrenaste fuerte y comiste poco, te habla de carbohidratos, no de fuerza de voluntad. Si dormiste 5 horas, eso va antes que cualquier ajuste de macros. Si subiste de peso pero bajó la cintura, te dice que estás recomponiendo, no que engordaste.

Además lleva **memoria** de tus hábitos ("hice lo de siempre"), te da un **score diario 0-100 explicado**, un panel de **estado actual** con tu recuperación, **objetivos dinámicos** que se ajustan a lo que entrenaste, **tendencias** automáticas (PR, estancamientos, exceso de volumen, poca recuperación), seguimiento de **peso/medidas** con lectura de **recomposición corporal**, **entrenamiento de fuerza** (series/reps/PR/volumen con un catálogo de +400 ejercicios), **rachas, logros y metas**, **exportación** CSV/PDF, y un **análisis semanal** en tono de entrenador. Los datos se **sincronizan en la nube** y funciona offline.

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

### Estado del atleta — la capa que cruza todo
- **El problema que resuelve**: cada módulo miraba su propia rebanada de datos. El score no veía las series de fuerza (entrenabas una hora de gym y te decía *"hoy no registraste entrenamiento"*), los insights no veían el sueño, la rutina no veía la recuperación y las metas de macros eran las mismas entrenando fuerte que en el sillón.
- [`src/lib/athlete.ts`](../src/lib/athlete.ts) calcula **una sola vez** lo que un entrenador tiene en la cabeza antes de hablar: qué se entrenó (volumen, series, duración, intensidad, PR, kcal), cómo se llega de recuperado, cuánto falta comer hoy y qué conviene hacer ahora. Score, insights, rutina y coach **leen de ahí**.
- Es una función pura y client-safe: no toca la red, la IA ni el reloj.
- **Intensidad de la sesión**: si el reloj dio su "efecto del entrenamiento" (0-5) se usa ese; si no, se compara el volumen contra **las propias sesiones de las últimas 4 semanas** (20 series son "fuerte" para uno y rutina para otro).
- **Recuperación 0-100**: sueño 40 · carga acumulada 25 (días seguidos + salto de volumen) · nutrición de ayer 20 · hidratación 15. Lo que no se registró se excluye del reparto.

### Panel "Estado actual" (tab Hoy)
- Recuperación con su desglose, las **cinco señales del día** (entrenamiento, proteína, sueño, agua, pasos), **una** recomendación principal y la lectura del coach.
- Después de entrenar cruza la sesión con la comida: *"Entrenaste fuerte y vas 1.916 de 3.430 kcal. Subí los carbohidratos en la cena para recuperar bien."*
- Cuando falta proteína (o carbos) propone **comida concreta**: *"250 g de pechuga · 1 lata de atún + 150 g de pollo · 2 scoops de proteína"*. Tabla de alimentos en [`src/lib/meals.ts`](../src/lib/meals.ts).
- UI en [`EstadoCard.tsx`](../src/components/EstadoCard.tsx).

### El peso corporal: una sola fuente de verdad
- Había **dos pesos que no se hablaban**: el `weight` del perfil (se completa una vez en el onboarding y queda viejo) y la serie `weights` de Progreso (se actualiza cada vez que te pesás). Las metas, la meta de agua y **todas** las calorías de ejercicio usaban el del formulario, así que podías pesarte todos los días y ninguna meta se enteraba.
- `effectiveWeight()` en [nutrition.ts](../src/lib/nutrition.ts) resuelve el peso a usar: promedio de los pesajes de la última semana (para que la meta no salte 200 kcal porque te pesaste después de cenar), con fallback al último registro y, si no hay ninguno, al perfil.
- El peso del onboarding **siembra** la serie de la balanza (`saveProfile` en [useNutta.ts](../src/lib/useNutta.ts)) solo si todavía no hay ningún pesaje, así los dos no nacen separados.

### Perfil vs. realidad
- El factor de actividad multiplica el metabolismo basal **entero**: una casilla de más son cientos de kcal y ~100 g de carbos fantasma por día. Y es un dato que se elige una vez, de memoria, antes de haber entrenado nada.
- `activityMismatch()` contrasta el nivel declarado con los días que realmente entrenás en los últimos 28. Si difieren en **dos niveles o más**, aparece un insight con el número real y cuánto cambiaría la meta. Uno solo de diferencia no avisa: entra dentro del error de una fórmula que ya es una estimación.

### Objetivos dinámicos
- Las metas del día se ajustan a lo que se entrenó: sesión fuerte **+20% de carbos**, media +10%, día sin entrenar **−15%**. La **proteína no se toca nunca** (es la que sostiene el músculo) y la grasa tampoco.
- El anillo de calorías y la barra de carbos muestran la meta ajustada, y la barra dice por qué (*"Carbohidratos (+85 por tu entreno)"*).

### Score diario (0-100)
- Reparto: **entrenamiento 30 · proteína 25 · sueño 20 · agua 10 · pasos 10 · calorías 5**. El alcohol resta 15.
- El **entrenamiento cuenta fuerza Y cardio**, y pondera por intensidad (fuerte 100%, medio 90%, suave 70%).
- Las calorías pesan poco a propósito: llegar a la meta calórica comiendo cualquier cosa y sin entrenar no es un buen día.
- Se **normaliza sobre los factores presentes**: no registrar sueño/agua/pasos no te penaliza (y el score te lo dice).
- **Siempre explica el número**: una frase fija debajo del puntaje (*"Entrenamiento te sube el score y sueño te lo baja"*) y, al desplegar, el motivo de cada factor.
- Cálculo determinista (sin IA) en [`src/lib/score.ts`](../src/lib/score.ts); tarjeta en [`ScoreCard.tsx`](../src/components/ScoreCard.tsx).

### Tendencias e insights automáticos
- Detecta **mejoras de fuerza** (PR reciente o salto de volumen), **estancamientos** (mismo peso máximo dos ventanas de 14 días seguidas), **exceso de volumen** (+50% de una semana a la otra), **poca recuperación** (sueño promedio < 6,5 h), poca proteína, **exceso de alcohol** (3+ días en la semana), **mala hidratación** y grupos musculares abandonados.
- Los avisos van primero: lo que hay que corregir es más útil que la palmada.
- Deterministas en [`src/lib/insights.ts`](../src/lib/insights.ts); vista en [`InsightsCard.tsx`](../src/components/InsightsCard.tsx).

### Coach IA — análisis semanal
- Botón 📊 en el chat: arma un resumen de los últimos 7 días y la IA responde como entrenador (directo, concreto), vía [`/api/coach`](../src/app/api/coach/route.ts).
- El resumen incluye entrenamiento **y** volumen de fuerza con su tendencia, nutrición, sueño/agua/pasos y composición corporal. Si no le pasás sueño ni medidas, la IA no puede hacer otra cosa que hablar de calorías — que es justo lo que no queremos.
- El prompt le exige **cruzar** los datos (entrenó mucho y comió poco → el problema es la comida), poner el sueño antes que cualquier ajuste de macros y **no** llamar retroceso a subir de peso si la cintura baja.

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

### Reloj / smartband (Xiaomi y cía.)
- **El problema**: Xiaomi **no publica API** ni OAuth para terceros, y ninguna de las vías indirectas cierra. **Strava** (que Mi Fitness sabe alimentar) exige **suscripción paga desde el 1/6/2026** y no quedó tier gratuito para leer los datos propios ([anuncio](https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428)); encima solo recibe los entrenamientos que arrancás a mano en el reloj. **Health Connect** tiene todo pero es API **nativa de Android** (una PWA no la puede leer). **Google Fit** se apaga a fines de 2026. Y hablarle al reloj **por Bluetooth** desde el navegador sería reimplementar su protocolo cifrado.
- **La solución: leer la pantalla del reloj con IA de visión.** Botón **Escanear** en el alta de cardio y en la tarjeta de *Bienestar* (Hoy): se elige una captura y la IA saca actividad/minutos/kcal/LPM/efecto, o pasos/sueño si es el resumen del día. Es gratis y es el **único** camino que trae pasos, sueño y efecto del entrenamiento.
- **Completa el formulario, no guarda**: el número siempre se ve antes de confirmar. Lo que se dio de alta desde una captura queda marcado con `source: "reloj"` y muestra el chip **"Reloj"** en la lista de cardio.
- **El `kind` que devuelve el modelo es una pista, no la verdad**: manda lo que realmente se pudo leer (una captura sin minutos no es un entrenamiento por más que el modelo lo diga).
- **El modelo es el punto frágil**: Groq dejó de ofrecer los Llama 4 y hoy el **único** de su catálogo que acepta imágenes es `qwen/qwen3.6-27b` (verificado contra `/v1/models`; el resto rechaza el formato multimodal). Si Groq también lo saca, el escaneo deja de andar y hay que revisar la lista — se puede tapar el bache con `GROQ_VISION_MODEL` sin tocar código.
- Como ese modelo **razona**, se lo llama con `reasoningFormat: "hidden"` y `reasoningEffort: "none"`; sin eso antepone un bloque `<think>` y el JSON queda enterrado. Igual se parsea tolerante (se descarta el `<think>`, se ignoran las ``` y se toma el **último objeto balanceado**, no del primer `{` al último `}`), y por eso tampoco se usa `generateObject`.
- Archivos: [`src/lib/watchScan.ts`](../src/lib/watchScan.ts), [`/api/watch/scan`](../src/app/api/watch/scan/route.ts), [`WatchScanButton.tsx`](../src/components/WatchScanButton.tsx). Contexto en el [README](../README.md#vincular-el-reloj-xiaomi-amazfit).

### Gym — entrenamiento de fuerza (tab Gym)
- Alta rápida estilo Strong: ejercicio, reps y peso; calcula **volumen** (reps × peso), marca **PR** 🏆 y grafica la **progresión** por ejercicio.
- **Buscador visual por grupo muscular** (botón 🔍): en vez de acertar el nombre, elegís **grupo** (Pecho, Espalda, Piernas, Hombros, Brazos, Core) y ves **todos sus ejercicios** con **foto**, equipo y si es compuesto/aislado; también hay búsqueda por texto (sin tildes) y una fila de **Recientes**. Al tocar uno se autocompleta el nombre y solo cargás reps/peso. Sigue disponible el input de texto libre para nombres propios y carga rápida de varias series. UI en [`ExercisePickerSheet.tsx`](../src/components/ExercisePickerSheet.tsx) e imagen con fallback a emoji en [`ExerciseImage.tsx`](../src/components/ExerciseImage.tsx).
- El navegador de días (**‹ ›**) permite mirar sesiones anteriores y **cargar series en un día pasado** (ver §4, "Completar días pasados").
- **Sugerencia del día** (`buildDailyRoutine`): mira **cómo llegás** (sueño, días seguidos entrenando, salto de volumen y recuperación) y recién después el calendario. Banner descartable (✕, por jornada, guardado en `localStorage`) que además dice **por qué** recomienda eso:
  - **Recuperación < 45%** → descanso o algo muy suave, aunque falten días de fuerza en la semana. Entrenar fuerte sin recuperar no suma volumen, suma fatiga.
  - **Recuperación 45-65%** → se entrena igual pero con **una serie menos** por ejercicio.
  - Vas por debajo del objetivo semanal (`GYM_DAYS_GOAL`, hoy **5**) → el **grupo que te falta** + ejercicios concretos del catálogo con series y reps según tu objetivo.
  - Ya cumpliste los 5 días → 🧘 **recuperación activa** (cardio suave + core/movilidad).
  - Ya entrenaste hoy → ✅ confirmación.
- Los grupos musculares se detectan con los **músculos reales** del dataset (mapa `exercise-groups.json`), con fallback a regex para nombres libres. Los ejercicios sugeridos por grupo salen de `exercise-by-group.json` (priorizados: compuestos + pesos libres + básicos icónicos, con variedad).
- Desde el chat, frases como *"press banca 4x8 con 60"* se cargan como series de fuerza y se normalizan al nombre canónico de RepDB.
- Lógica en [`src/lib/gym.ts`](../src/lib/gym.ts); catálogo y matcher en [`src/lib/exerciseDb.ts`](../src/lib/exerciseDb.ts); UI en [`GymTab.tsx`](../src/components/GymTab.tsx).

### Catálogo de ejercicios (RepDB)
- Dataset de **+400 ejercicios** con nombre en español, **MET**, grupos musculares, equipo, mecánica (compuesto/aislado) y **una imagen** por ejercicio, adelgazado a [`src/data/exercises.json`](../src/data/exercises.json) por el script `npm run data:exercises`.
- Las **imágenes** (`.webp`, ~7 MB en total) se descargan en el build y se **bundlean** en [`public/exercises/`](../public/exercises) (`<id>.webp`), así funcionan **offline** (el service worker las cachea). El campo `image` de cada ejercicio apunta a ese archivo.
- Helpers de agrupación y etiquetas en [`exerciseDb.ts`](../src/lib/exerciseDb.ts): `exercisesByGroup` (grupos con compuestos primero), `searchExercises`, `equipmentLabel`/`mechanicLabel` y `MUSCLE_GROUPS`.
- El matcher normaliza (sin tildes/minúsculas) y compara por tokens; un guard evita que frases genéricas ("entrené espalda") se snapeen a un ejercicio puntual.
- Se usa **solo como post-proceso determinístico**, nunca dentro de la IA (lo exige la licencia RepDB).

### Progreso corporal
- **Peso**: gráfico de evolución, meta y **predicción** (regresión lineal → ETA a la meta). En [`WeightPanel.tsx`](../src/components/WeightPanel.tsx) y [`src/lib/weight.ts`](../src/lib/weight.ts).
- **Medidas**: cintura, pecho, brazo, muslo y pantorrilla, con gráfico por parte. En [`MeasuresPanel.tsx`](../src/components/MeasuresPanel.tsx).
- **Recomposición corporal** ([`src/lib/body.ts`](../src/lib/body.ts) + [`RecompCard.tsx`](../src/components/RecompCard.tsx)): peso y medidas se leen **juntos**, nunca el peso solo. Compara el promedio de las últimas 3 semanas contra las 3 anteriores (promediar evita que un pesaje malo dé vuelta la conclusión) y dictamina *recomposición · músculo · definición · grasa · estable*.
  - Si el peso sube pero la cintura baja y los brazos crecen → **recomposición**, con mensaje positivo.
  - **Regla dura**: nunca concluir que el usuario está peor solo porque subió de peso. Recién se habla de grasa cuando peso **y** cintura suben juntos y ninguna medida de músculo se mueve, y aun así con una acción concreta, no con un reto.
  - **La confianza acompaña a los datos.** Sin dos ventanas completas la comparación cae a "primera contra última medición", y eso ahora se informa en vez de disimularse: con pocas mediciones el veredicto se anuncia como *"Señal preliminar"*, el tono baja de verde a informativo y el pie dice qué se comparó de verdad (antes decía siempre "las 3 semanas anteriores", incluso cuando eran dos tomas con 14 días de diferencia). Medio centímetro de brazo entre dos tomas suele ser la cinta puesta distinto, no músculo.
  - **También cuenta lo que baja**: si una medida de músculo cayó, se nombra aunque el veredicto sea bueno.
  - El panel de peso recibe el veredicto: cuando las medidas dicen que el kilo que subiste es músculo, deja de decir *"a este ritmo te estás alejando de tu meta"* y el delta deja de pintarse en naranja. Antes esas dos frases convivían en la misma pantalla.

### Gráficos: dominio y escala del eje Y
- El eje Y se calcula con `niceScale`/`yAxis` en [`src/lib/chart.ts`](../src/lib/chart.ts): ajusta el dominio a múltiplos de un escalón redondo (1, 2, 5, 10 × 10ⁿ) y genera las marcas, así el peso muestra `92 · 93 · 94 · 95 · 96` y la cintura `95 · 100 · 105` en vez de decimales arbitrarios.
- El **margen izquierdo va en 0**. Antes era `-18` para ganar ancho, pero eso corría el eje fuera del área visible y —como las etiquetas están alineadas a la derecha— **recortaba los primeros píxeles**: `94.9` se leía `4.9`, `100.75` se leía `.75` y `103` se leía `03`. El ancho del eje ahora se calcula según el texto real de las marcas.
- Lo usan los cuatro gráficos (Peso, Medidas, Progresión del Gym e Historial), junto con `axisProps` y `chartMargin`.

### Bienestar y suplementos (tab Hoy)
- **Agua** (botones rápidos), **sueño** (horas) y **pasos**, con barras de progreso. La **meta de agua se escala al peso** (~35 ml/kg, piso 2 L) y también cuenta en el score. Se puede registrar en días pasados. En [`WellbeingCard.tsx`](../src/components/WellbeingCard.tsx).
- **Suplementos**: lista propia con checklist diario y horario (**referencia visual**, sin notificación). Opcionalmente cada suplemento puede definir una **cantidad habitual** (ej. 30 g, 2 cápsulas) y la **proteína que aporta esa cantidad**; al marcarlo se puede ajustar la cantidad realmente tomada ese día (± cápsulas/gramos) con un stepper, y la proteína se **escala proporcionalmente** y se suma al total de proteína del día (Hoy, score e Historial). Cálculo puro en [`src/lib/supplements.ts`](../src/lib/supplements.ts); UI en [`SupplementsCard.tsx`](../src/components/SupplementsCard.tsx).

### Historial (últimos 7/30 días)
- Promedios + gráfico de calorías netas por día (con línea de meta) + gráfico de macros. En [`History.tsx`](../src/components/History.tsx) y [`src/lib/analytics.ts`](../src/lib/analytics.ts).
- **Cada promedio se calcula sobre los días que tienen ESE dato.** Antes el denominador era "días con actividad", así que un día en el que registrabas el entrenamiento pero no la comida entraba como 0 kcal comidas: mostraba 1383 kcal/día a alguien que los días que registró comió 2500. Un promedio que mezcla "comí poco" con "no anoté" no dice nada, y la tarjeta ahora aclara sobre cuántos días promedia.

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

Variables de entorno:

| Variable | Para qué |
|----------|----------|
| `GROQ_API_KEY` | IA: coach, estimación de macros y lectura de capturas del reloj |
| `GROQ_MODEL` | Opcional. Modelo del coach (default `openai/gpt-oss-20b`) |
| `GROQ_VISION_MODEL` | Opcional. Modelo con visión para leer capturas del reloj (default `qwen/qwen3.6-27b`, el único con visión que le queda a Groq) |

- Cada `git push` a `main` dispara un **deploy automático** a producción en Vercel.
- Todas las claves van también en Vercel → Settings → Environment Variables. Ojo: **agregarlas no alcanza**, hay que hacer un **Redeploy** para que el deploy en curso las tome.

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
│     ├─ foods/
│     │  ├─ barcode/      Producto por código de barras (OFF)
│     │  └─ estimate/     Estimación IA de macros por 100 g
│     └─ watch/scan/      Lectura IA de una captura del reloj
├─ components/
│  ├─ Chat.tsx            Chat estilo WhatsApp + voz + botones 🧠/📊
│  ├─ HoyTab.tsx          Tab "Hoy" (estado, macros, bienestar, timeline…)
│  ├─ ProgresoTab.tsx     Tab "Progreso" (peso + recomposición + medidas)
│  ├─ EstadoCard.tsx      Panel "Estado actual" + coach del día
│  ├─ RecompCard.tsx      Lectura de la composición corporal
│  ├─ Timeline.tsx        Línea de tiempo del día
│  ├─ ScoreCard.tsx       Score diario 0-100 (con su explicación)
│  ├─ InsightsCard.tsx    Tendencias e insights automáticos
│  ├─ MemorySheet.tsx     Memoria del usuario (🧠)
│  ├─ WeightPanel.tsx     Peso: gráfico, meta, predicción
│  ├─ MeasuresPanel.tsx   Medidas corporales por parte
│  ├─ WellbeingCard.tsx   Agua / sueño / pasos
│  ├─ SupplementsCard.tsx Suplementos + checklist
│  ├─ GymTab.tsx          Tab "Gym" (fuerza, PR, volumen, progresión)
│  ├─ ExercisePickerSheet.tsx  Buscador visual de ejercicios por grupo
│  ├─ ExerciseImage.tsx    Miniatura del ejercicio (foto RepDB + fallback emoji)
│  ├─ AchievementsCard.tsx Rachas y logros
│  ├─ MetasPanel.tsx       Metas personalizadas (customGoals)
│  ├─ ExportPanel.tsx      Exportación CSV/PDF
│  ├─ RecipesSheet.tsx     Recetas propias (reutilizables como comida)
│  ├─ PhotosPanel.tsx      Fotos de progreso
│  ├─ CalorieRing.tsx      Anillo de calorías del día
│  ├─ MacroBar.tsx         Barra de macros (proteína / carbos / grasa)
│  ├─ MacroSplit.tsx       Macros en vivo del alta de comida (reparto por kcal)
│  ├─ History.tsx          Tab "Historial" (7/30 días, gráficos)
│  ├─ FoodForm.tsx / ExerciseForm.tsx  Alta manual (comida / cardio)
│  ├─ CardioSheet.tsx      Alta de cardio con datos del reloj
│  ├─ WatchScanButton.tsx  Captura del reloj → IA → formulario
│  ├─ RestTimer.tsx        Cronómetro de descanso entre series
│  ├─ AppHeader.tsx        Encabezado común a los cinco tabs (sticky)
│  ├─ DayNavigator.tsx     Navegador de días, compartido por Hoy y Entreno
│  ├─ BottomNav.tsx        Navegación de tabs (con safe-area)
│  ├─ BarcodeScanner.tsx   Escáner de códigos de barras (ZXing, por portal)
│  ├─ ServiceWorker.tsx    Registro del service worker (PWA)
│  ├─ ui/                  Sistema de diseño (ver abajo)
│  └─ Login.tsx / Onboarding.tsx
├─ data/                   Generados por scripts/build-exercises.mjs (RepDB)
│  ├─ exercises.json       Catálogo adelgazado, con `image` (server)
│  ├─ exercise-names.json  Solo nombres (autocompletado del cliente)
│  ├─ exercise-groups.json Nombre → grupo muscular (recomendación)
│  └─ exercise-by-group.json  Grupo → ejercicios sugeridos (rutina)
└─ lib/
   ├─ db.ts               Cliente y esquema de InstantDB
   ├─ useNutta.ts         Hook central de datos (query + mutaciones)
   ├─ athlete.ts          ★ Estado del atleta: cruza TODOS los datos
   ├─ body.ts             Composición corporal (peso + medidas → interpretación)
   ├─ meals.ts            "Te faltan 45 g de proteína" → comida concreta
   ├─ useDismissable.ts   El botón atrás del teléfono cierra overlays
   ├─ chart.ts            Estilo y escalas de los gráficos (tooltip, ejes)
   ├─ chatLog.ts          Formato del resumen "Registrado" del coach
   ├─ uid.ts              Id corto para registros nuevos
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

> El script [`scripts/build-exercises.mjs`](../scripts/build-exercises.mjs) genera los JSON de `data/` **y descarga las imágenes** a `public/exercises/` a partir del dataset de RepDB.

### Sistema de diseño (`components/ui/`)

Toda la interfaz se arma con estas piezas. Si algo necesita un botón, un campo
o un sheet, sale de acá: es lo que evita que cada pantalla invente su propia
versión (que es como se llegó a tener cinco radios distintos y `×` de texto
como botón de cerrar).

| Pieza | Para qué |
|---|---|
| `Sheet` | Bottom sheet sobre [vaul](https://vaul.emilkowal.ski/). Cierra con la cruz, arrastre, ESC, tap afuera y **el botón atrás del teléfono**. Trae scroll interno y un slot de `footer` fijo para la acción principal. |
| `Button` | Variantes `primary` / `accent` / `secondary` / `ghost` / `danger`, alturas de 44px+. |
| `Chip` | Píldora de selección rápida (cantidades, favoritos, filtros). |
| `Stepper` | Número con − y +. Para cargar con una mano en el gym o la cocina. |
| `Field` / `Input` / `inputCls` | Campos. Van a 16px porque iOS hace zoom por debajo de eso. |
| `Toast` | Confirmación con acción **Deshacer**. Se usa vía `useToast()`. |
| `Skeleton` | Estados de carga. |
| `AppProviders` | `MotionConfig` (respeta `prefers-reduced-motion`) + `ToastProvider`. |

Los tokens (colores, radios, elevación, curvas y duraciones de movimiento)
viven en [`app/globals.css`](../src/app/globals.css). Regla de radios:
`rounded-control` para controles, `rounded-card` para tarjetas,
`rounded-sheet` para sheets. Las tarjetas se separan del fondo con
`shadow-e1`, no con borde.

---

## 10. Detalles a tener en cuenta

- La **búsqueda de alimentos se hace desde el navegador** (Open Food Facts bloquea las IPs de datacenter de Vercel). El endpoint de producto por código sí funciona server-side porque está cacheado en el edge.
- Groq **no ofrece visión gratis** en esta cuenta, por eso no hay análisis de fotos: el registro es por texto o voz.
- Sin `GROQ_API_KEY` el chat/coach no funcionan (el resto de la app sí).
- Los datos requieren estar **logueado**; sin sesión no hay acceso.
- **Licencia del catálogo de ejercicios (RepDB, free)**: permite uso comercial pero exige **atribución visible** ("Exercise data by RepDB — repdb.co", en el README y al pie del Gym) y **prohíbe** redistribuirlo como dataset/API o usarlo dentro de modelos generativos de IA. Por eso el dataset se bundlea en la app y solo se usa como post-proceso determinístico.

---

## 11. Ideas a futuro

- **Biblioteca visual de ejercicios**: ✅ hecho en parte (buscador por grupo con fotos y tap-para-cargar). Falta sumar **instrucciones** y músculos trabajados en una ficha ampliada.
- **Tabla de alias** para vocabulario que hoy no matchea el catálogo (ej. "zancada" → estocada).
- **Recordatorios push** reales (suplementos, hidratación) — hoy solo visual.
- **Análisis de fotos** con visión (bloqueado: Groq no ofrece visión gratis en esta cuenta).
