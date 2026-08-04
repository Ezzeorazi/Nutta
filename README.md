# Nutta 🥗

App **mobile-first** para registrar alimentación y ejercicio: calorías, proteínas, carbohidratos y grasas. Local-first e instalable como PWA.

🌐 **Live:** https://app-alimentacion-nine.vercel.app

## Funcionalidades

- **Onboarding** con cálculo automático de metas (Mifflin-St Jeor → TDEE → macros).
- **Comidas**: búsqueda en [Open Food Facts](https://world.openfoodfacts.org/) y escaneo de código de barras.
- **Ejercicio**: actividades con valores MET, calorías quemadas según tu peso, y catálogo de +400 ejercicios ([RepDB](https://repdb.co)) para el chat y el registro de fuerza.
- **Reloj / smartband**: importa el cardio del reloj (Xiaomi y cía.) vía Strava, y lee capturas de la pantalla del reloj con IA. Ver [Vincular el reloj](#vincular-el-reloj-xiaomi-amazfit).
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

### Importar desde Strava (requiere suscripción paga a Strava)

Mi Fitness puede empujar los entrenamientos a Strava, y Nutta leerlos de ahí.
**Desde el 1 de junio de 2026 la API de Strava exige una suscripción activa**
(~US$ 12/mes): ya no hay tier gratuito para leer tus propios datos. Solo tiene
sentido si ya pagás Strava. Además, en junio de 2027 Strava cambia la base URL
y los headers de la API, así que este camino va a pedir mantenimiento.

Si ya sos suscriptor:

1. **Crear la app** en https://www.strava.com/settings/api. En *Authorization
   Callback Domain* va **solo el dominio**, sin `https://` ni ruta (`localhost`
   en desarrollo, el dominio de Vercel en producción). Strava admite un dominio
   por app: hace falta una app de dev y otra de prod.
2. **Cargar las claves** en `.env.local` y en Vercel → Settings → Environment
   Variables:
   ```bash
   STRAVA_CLIENT_ID=12345
   STRAVA_CLIENT_SECRET=...
   ```
   Sin ellas, la UI de Strava directamente no aparece.
3. **Enganchar el reloj**: Mi Fitness → *Perfil* → *Apps conectadas* →
   **Strava** → autorizar.
4. **Conectar Nutta**: tab **Gym** → sección *Cardio* → **Conectar Strava** →
   autorizar → **Sincronizar**. Trae los últimos 30 días; reimportar no duplica
   nada (cada actividad se recuerda por su id de Strava).

Por este camino **solo viajan los entrenamientos que arrancás a mano en el
reloj**: los pasos, el sueño y el efecto del entrenamiento no salen a Strava.

### Lo que no sirve

- **Health Connect** sincroniza con Mi Fitness, pero es API **nativa de
  Android**: una PWA no la puede leer. Haría falta envolver la app con
  Capacitor y sideloadear un APK.
- **Google Fit**: Google apaga sus APIs a fines de 2026.
- **Bluetooth desde el navegador**: el reloj habla un protocolo propietario
  cifrado; sería reimplementar Gadgetbridge.

## Créditos

- Datos de alimentos: [Open Food Facts](https://world.openfoodfacts.org/).
- **Exercise data by [RepDB](https://repdb.co)** — catálogo de ejercicios usado en el chat, el registro de fuerza y el autocompletado del Gym.

## Notas

- Los datos se guardan en el navegador (local-first). Una fase futura sumará login y base de datos en la nube.
- La búsqueda de alimentos se hace desde el navegador (Open Food Facts bloquea IPs de datacenter).
