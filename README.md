# Nutta 🥗

App **mobile-first** para registrar alimentación y ejercicio: calorías, proteínas, carbohidratos y grasas. Local-first e instalable como PWA.

🌐 **Live:** https://app-alimentacion-nine.vercel.app

## Funcionalidades

- **Onboarding** con cálculo automático de metas (Mifflin-St Jeor → TDEE → macros).
- **Comidas**: búsqueda en [Open Food Facts](https://world.openfoodfacts.org/) y escaneo de código de barras.
- **Ejercicio**: actividades con valores MET, calorías quemadas según tu peso, y catálogo de +400 ejercicios ([RepDB](https://repdb.co)) para el chat y el registro de fuerza.
- **Reloj / smartband**: le sacás una captura a la pantalla del reloj (Xiaomi y cía.) y la IA carga el entrenamiento, los pasos o el sueño. Ver [Vincular el reloj](#vincular-el-reloj-xiaomi-amazfit).
- **Dashboard**: anillo de calorías (in/out) y barras de macros.
- **Historial** de 7 días con gráficos (calorías netas y macros).
- **PWA** instalable con soporte offline y dark mode.

## Stack

- [Next.js 16](https://nextjs.org/) (App Router) + React 19
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Recharts](https://recharts.org/) para gráficos
- [ZXing](https://github.com/zxing-js/browser) para el escaneo de códigos
- Persistencia local con `localStorage`

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de producción

npm run data:exercises   # regenera el catálogo de ejercicios (RepDB)
```

## Vincular el reloj (Xiaomi, Amazfit…)

Xiaomi **no publica una API**: no hay forma de pedirle los datos a Mi Fitness
directamente. Los caminos que quedan, y cuánto cuestan:

### Escanear la pantalla del reloj (gratis, el recomendado)

Le sacás una captura al reloj y la IA saca los números.

- **Entrenamiento** (actividad, minutos, kcal, LPM prom./máx., efecto del
  entrenamiento): tab **Gym** → **+ Cardio** → **Escanear captura**.
- **Resumen del día** (pasos, sueño): tab **Hoy** → tarjeta *Bienestar* →
  **Escanear reloj**.

Completa el formulario para que lo revises; no guarda solo. Solo necesita
`GROQ_API_KEY` (gratis, de console.groq.com); el modelo de visión se puede
cambiar con `GROQ_VISION_MODEL`.

### Por qué no hay sincronización automática

Ninguna de las otras vías cierra:

- **Strava** (Mi Fitness sabe empujarle los entrenamientos): desde el **1 de
  junio de 2026** su API exige una suscripción paga y no quedó tier gratuito
  para leer los datos propios. Además solo recibe los entrenamientos que
  arrancás a mano en el reloj — nunca los pasos, el sueño ni el efecto del
  entrenamiento.
- **Health Connect** sí tiene todo, pero es API **nativa de Android**: una PWA
  no la puede leer. Haría falta envolver la app con Capacitor y sideloadear un
  APK.
- **Google Fit**: Google apaga sus APIs a fines de 2026.
- **Bluetooth desde el navegador**: el reloj habla un protocolo propietario
  cifrado; sería reimplementar Gadgetbridge.

## Créditos

- Datos de alimentos: [Open Food Facts](https://world.openfoodfacts.org/).
- **Exercise data by [RepDB](https://repdb.co)** — catálogo de ejercicios usado en el chat, el registro de fuerza y el autocompletado del Gym.

## Notas

- Los datos se guardan en el navegador (local-first). Una fase futura sumará login y base de datos en la nube.
- La búsqueda de alimentos se hace desde el navegador (Open Food Facts bloquea IPs de datacenter).
