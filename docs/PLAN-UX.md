# Plan de trabajo — Rediseño UX/UI de Nutta

> Estado: **propuesto**. Se ejecuta por fases; cada fase se revisa antes de seguir.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Librerías | `lucide-react` (iconos) + `motion` (animación) + `vaul` (bottom sheet) |
| Dinámica de formularios | Progresiva: buscar → elegir → cantidad, con macros calculados en vivo y colapsados |
| Iconografía | Híbrida: iconos de línea en lo estructural, emojis solo donde son contenido (🔥 racha, 🏆 PR, emoji por alimento) |
| Entrega | Por fases, con revisión entre cada una |

### Por qué esas tres librerías

- **vaul** resuelve de una todo lo que hoy le falta al modal: arrastre para cerrar, bloqueo de scroll del fondo, trampa de foco, ESC, `role="dialog"` y animación con física real. Escribir eso a mano son ~300 líneas frágiles.
- **motion** para transiciones entre tabs y micro-interacciones. Se importa por componente, así que solo entra al bundle lo que se use.
- **lucide-react** es tree-shakeable: cada icono es un componente suelto, entran al bundle solo los ~20 que usemos.

### Por qué NO usamos View Transitions nativas

Next 16 las soporta con `experimental.viewTransition: true`, pero ese flag reemplaza React por una build canary (`next/dist/compiled/react-experimental`) para todo el App Router. Atar la sensación de toda la app a un flag experimental no vale el riesgo cuando `motion` da el mismo resultado sobre React estable. Queda como experimento opcional para más adelante.

---

## Diagnóstico

Lo que encontré recorriendo los 33 componentes:

### El modal es el problema central

[`Sheet.tsx`](../src/components/Sheet.tsx) son 53 líneas que sostienen **10 pantallas**: `FoodForm`, `ExerciseForm`, `CardioSheet`, `ExercisePickerSheet`, `MemorySheet`, `RecipesSheet`, `MeasuresPanel`, `MetasPanel`, `WeightPanel` y `SupplementsCard`. Cada defecto suyo se multiplica por diez:

1. La `×` es un carácter de texto suelto de ~14px, sin área táctil (mínimo accesible: 44×44), sin fondo, sin hover.
2. No cierra con ESC.
3. No bloquea el scroll del fondo — al hacer scroll dentro del sheet se arrastra la página de atrás.
4. No tiene `role="dialog"`, `aria-modal` ni trampa de foco: con teclado o lector de pantalla, el foco se escapa al contenido de atrás.
5. No tiene animación de entrada ni salida: aparece y desaparece de golpe.
6. No tiene altura máxima ni scroll interno. El `FoodForm` con sus 6 campos se desborda en pantallas chicas, y con el teclado abierto es peor.
7. El botón primario ("Agregar") vive al final del formulario y se va con el scroll.
8. El `onClick` del backdrop cierra en cualquier click que termine ahí: seleccionar texto dentro y soltar afuera cierra el sheet y se pierde lo cargado.
9. El botón atrás de Android cierra la app en vez del sheet — grave en una PWA instalada.
10. No hay gesto de arrastrar hacia abajo, que es el gesto que todo el mundo espera en un bottom sheet.

### Formularios

- **`FoodForm`** muestra los 6 campos siempre. Y tiene **dos inputs de nombre**: el buscador (`query`) y el nombre del alimento (`f.name`). Son dos modelos mentales para una sola cosa.
- Ningún feedback al guardar: el sheet se cierra y listo. No se sabe si se guardó ni se puede deshacer (el chat sí tiene "Deshacer", el formulario manual no).
- El botón "Agregar" del `FoodForm` está siempre habilitado, pero si el nombre está vacío el submit no hace nada, en silencio.
- Cantidad, calorías y macros son 5 inputs numéricos crudos, sin steppers ni chips de valores típicos.
- **`ExerciseForm`** vuelca la lista completa de actividades MET sin agrupar ni filtrar por categoría.
- **`GymTab`** no tiene steppers +/- para reps y peso, que es lo que más se necesita entre serie y serie. Tampoco hay "repetir última serie" ni cronómetro de descanso.

### Navegación

- El cambio de tab es un `setState` seco: sin transición, sin dirección, sin continuidad.
- Cada tab desmonta el anterior, así que se pierde la posición de scroll al volver.
- La nav usa emojis (🍽️🏋️📈💬📊) que renderizan distinto en cada sistema operativo y tienen pesos visuales inconsistentes.
- Cada tab dibuja su propio header con estilos distintos: `HoyTab` usa `text-2xl` sin sticky, `Chat` usa `text-lg` sticky con blur, `GymTab` usa `text-2xl` con `items-baseline`.
- El navegador de días está duplicado en `HoyTab` y `GymTab` con dos maquetaciones distintas, y la función `shiftISO` está copiada en los dos archivos.

### Visual

- Todo es una caja con borde dentro de otra caja con borde. En `HoyTab` se apilan 7 tarjetas bordeadas seguidas: el ojo no encuentra jerarquía porque todo pesa igual.
- Radios mezclados sin criterio: `rounded-lg`, `xl`, `2xl`, `3xl`, `full` conviviendo en la misma vista.
- Sin sistema de movimiento: `active:scale-95`, `active:scale-[0.99]` y `active:scale-90` aparecen salteados según el componente.
- El estado de carga es texto pulsando ("Nutta"), sin skeletons.
- Los tokens de color existen y están bien, pero no hay tokens de radio, espaciado, elevación ni movimiento.

---

## Fase 1 — Base: sistema de diseño, Sheet y navegación

El cimiento. Todo lo demás se apoya acá.

### 1.1 Tokens de diseño (`globals.css`)

Sumar a la paleta que ya existe:

- **Radios**: `--radius-sm: 10px` / `md: 14px` / `lg: 20px` / `xl: 28px`. Regla: controles `md`, tarjetas `lg`, sheets `xl`.
- **Elevación**: tres niveles de sombra suave en vez de bordes. En modo oscuro, elevación por color de superficie (`--card` un paso más claro), no por sombra.
- **Movimiento**: `--duration-fast: 150ms` / `base: 210ms` / `slow: 320ms`, con curvas `--ease-out` y `--ease-spring`.
- **Superficie**: `--surface-1/2/3` para poder apagar bordes sin perder separación visual.
- `@media (prefers-reduced-motion: reduce)` global que anula todo el movimiento.

### 1.2 Primitivas nuevas (`src/components/ui/`)

- **`Sheet`** reescrito sobre vaul. Cierra de **cinco** formas: la cruz (botón de 40×40 con icono `X` de lucide, esquina superior derecha), el grabber arrastrable, ESC, tap en el backdrop y el botón atrás del teléfono. Header fijo con título, cuerpo con scroll propio, y footer opcional pegado abajo donde vive el botón primario (deja de irse con el scroll).
- **`Button`** con variantes `primary` / `secondary` / `ghost` / `danger` y tamaños, todos con altura mínima de 44px y el mismo feedback táctil.
- **`Input`, `Field`, `Stepper`, `ChipGroup`** — el `Stepper` es un número con − y + a los costados, pensado para el gym y para las cantidades.
- **`Toast`** — confirmación efímera al guardar, con acción "Deshacer". Le da al formulario manual el mismo red de seguridad que ya tiene el chat.
- **`Skeleton`** para los estados de carga.

### 1.3 El botón atrás

Un hook `useDismissable` que empuja una entrada en el historial cuando se abre un overlay y la consume al cerrar. Se conecta al `Sheet` y al `Onboarding` (también al escáner de códigos, ya retirado). Con esto, en la PWA instalada el botón atrás cierra el sheet en lugar de salir de la app.

### 1.4 Navegación

- Iconos de línea de lucide en la tab bar, con el estado activo marcado por peso y color (no solo color).
- Transición direccional entre tabs con `motion`: el contenido se desliza según la posición del tab en la barra, de forma que el movimiento tenga sentido espacial.
- Preservar la posición de scroll de cada tab al volver.
- Componente `AppHeader` único, para que los cinco tabs compartan altura, tipografía y comportamiento sticky.
- Extraer `DayNavigator` (el navegador de días) y `shiftISO` a un solo lugar, en vez de las dos copias actuales.

**Se toca:** `globals.css`, `Sheet.tsx`, `BottomNav.tsx`, `page.tsx`, `layout.tsx`, + `src/components/ui/*` y `src/lib/date.ts` nuevos.

---

## Fase 2 — Formularios

### 2.1 `FoodForm` — el rediseño más importante

Es el formulario que se usa varias veces por día. Pasa a tener dos estados en vez de uno:

**Estado A — Buscar.** Un solo input (se elimina el segundo campo de nombre). Debajo, favoritos y recientes como chips. Los resultados aparecen en lista, no en un dropdown flotante que tapa el formulario. El acceso a la cámara y a la estimación con IA quedan como acciones de la misma lista.

**Estado B — Cantidad.** Al elegir un alimento, el sheet transiciona: arriba el nombre elegido con la estrella de favorito y un "cambiar" para volver. En el centro, un `Stepper` grande con la cantidad y chips de valores típicos (50 / 100 / 150 / 200 g). Debajo, calorías y macros **calculados en vivo mientras se ajusta la cantidad**, mostrados como lectura visual (barras), no como inputs. Un "Editar valores" colapsado abre los 4 campos numéricos para los casos donde hace falta corregir a mano.

El botón primario vive en el footer fijo del sheet y se deshabilita con motivo visible cuando falta algo.

Al guardar: se cierra el sheet y aparece un toast "Yogur griego agregado a Desayuno · Deshacer".

### 2.2 Resto de formularios

- **`ExerciseForm`**: actividades agrupadas por categoría, con la búsqueda filtrando dentro de los grupos. Steppers para minutos. Las calorías estimadas se muestran como resultado en vivo, no como un input que compite con el cálculo.
- **`GymTab` (alta de serie)**: steppers +/− para reps y peso (el peso salta de a 2.5 kg, que es el disco chico), botón "repetir última serie", y cronómetro de descanso opcional entre series.
- **`CardioSheet`, `MeasuresPanel`, `WeightPanel`, `MetasPanel`, `MemorySheet`, `RecipesSheet`, `SupplementsCard`**: migración al nuevo `Sheet` y a las primitivas. Sin rediseño conceptual, solo consistencia.
- **`Onboarding`**: mismas primitivas, transición entre pasos, y el botón atrás del teléfono retrocediendo de paso en vez de saliendo.

---

## Fase 3 — Pantallas

- **`HoyTab`**: bajar el ruido. Menos bordes, más aire y jerarquía tipográfica. El anillo de calorías como protagonista visual; bienestar y suplementos con menos peso. "Agregar" pasa de una fila de chips perdida al final a una acción presente y clara.
- **`Chat`**: burbujas con más aire, el resumen "📝 Registrado" renderizado como tarjeta de items en vez de texto plano, "Deshacer" más visible, y los iconos del header (📊 🧠 🎙️ ➤) reemplazados por iconos de línea.
- **`GymTab`**: separar la sesión del día de la sugerencia de rutina y de la progresión; hoy los tres bloques compiten.
- **`History` / `ProgresoTab`**: unificar el estilo de los gráficos de recharts y sus tooltips, y agregar estados vacíos que digan qué hacer en vez de solo informar que no hay datos.

---

## Fase 4 — Pulido

- Skeletons reemplazando el splash de texto pulsando.
- Estados vacíos ilustrados y accionables en toda la app.
- Feedback háptico (`navigator.vibrate`) en las acciones de registro, donde esté disponible.
- Pasada de accesibilidad: contraste AA, foco visible, áreas táctiles de 44px, etiquetas de lector de pantalla.
- Verificación de `prefers-reduced-motion` en todas las animaciones nuevas.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| vaul cambia la sensación de los 10 sheets a la vez | La Fase 1 migra `FoodForm` como piloto; el resto solo después de tu visto bueno |
| El bundle crece con tres dependencias | motion y lucide se importan por componente; medimos el build antes y después |
| El rediseño toca código con lógica delicada (fechas locales, `createdAt`, upserts de métricas) | Los cambios son de presentación; la lógica de `src/lib/` no se toca en ninguna fase |

## Fuera de alcance

Funcionalidades nuevas. Este plan no agrega features: reordena, simplifica y pule lo que ya existe. Si en el camino aparece algo que conviene sumar, lo propongo aparte en vez de colarlo.
