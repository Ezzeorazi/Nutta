# Nutta 🥗

App **mobile-first** para registrar alimentación y ejercicio: calorías, proteínas, carbohidratos y grasas. Local-first e instalable como PWA.

🌐 **Live:** https://app-alimentacion-nine.vercel.app

## Funcionalidades

- **Onboarding** con cálculo automático de metas (Mifflin-St Jeor → TDEE → macros).
- **Comidas**: búsqueda en [Open Food Facts](https://world.openfoodfacts.org/) y escaneo de código de barras.
- **Ejercicio**: actividades con valores MET, calorías quemadas según tu peso.
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
```

## Notas

- Los datos se guardan en el navegador (local-first). Una fase futura sumará login y base de datos en la nube.
- La búsqueda de alimentos se hace desde el navegador (Open Food Facts bloquea IPs de datacenter).
