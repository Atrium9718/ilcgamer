---
name: ILC Origen
version: 2.0.0
colors:
  # Tema oscuro (por defecto: on-premise, bares, eventos nocturnos)
  background: '#0C1613'
  surface: '#0C1613'
  surface-dim: '#080F0D'
  surface-bright: '#2A3F38'
  surface-container-lowest: '#08100E'
  surface-container-low: '#111E1A'
  surface-container: '#162621'
  surface-container-high: '#1D302A'
  surface-container-highest: '#253A33'
  on-background: '#F4EFE3'
  on-surface: '#F4EFE3'
  on-surface-variant: '#C9C2B0'
  inverse-surface: '#F4EFE3'
  inverse-on-surface: '#13201B'
  outline: '#7E8F86'
  outline-variant: '#34473F'
  primary: '#D4B673'
  on-primary: '#1E1606'
  primary-container: '#B89B5B'
  on-primary-container: '#1E1606'
  inverse-primary: '#6E561E'
  secondary: '#86CFA7'
  on-secondary: '#06281A'
  secondary-container: '#2F4941'
  on-secondary-container: '#D6F0E2'
  tertiary: '#E09A5F'
  on-tertiary: '#2E1504'
  tertiary-container: '#6B3A14'
  on-tertiary-container: '#FFDCC2'
  error: '#FFB4A9'
  on-error: '#690005'
  error-container: '#8C1D18'
  on-error-container: '#FFDAD6'
  warning: '#F0C15A'
  on-warning: '#2B1D00'
  brand-red: '#D01217'
typography:
  display-lg:
    fontFamily: EB Garamond
    fontSize: 44px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.5px
  headline-lg:
    fontFamily: EB Garamond
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.25px
  headline-md:
    fontFamily: EB Garamond
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: 0px
  title-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: 0px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: 0px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.2px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.8px
  numeric-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.5px
rounded:
  sm: 0.5rem
  DEFAULT: 0.75rem
  md: 0.75rem
  lg: 0.75rem
  xl: 0.75rem
  2xl: 1rem
  3xl: 1.5rem
  full: 9999px
spacing:
  base-unit: 4px
  margin-mobile: 16px
  margin-tablet: 24px
  margin-desktop: 32px
  gutter: 16px
  touch-min: 48px
  cta-height: 56px
---

# ILC Origen — Sistema de diseño (v2)

Sistema de diseño de la plataforma phygital de la **Industria Licorera de Caldas (ILC) y todas sus
submarcas**. Reemplaza a "Nocturnal Amber Phygital" (v1) para alinearse con *Instrucciones.md*,
la *Guía de Gamificación v1.2* (§3.5 tono, §22 sistema visual) y la *Guía Técnica v1.0* (§5.6, §9.4, §11).

Referencia visual tomada de ilc.com.co: sello circular verde con dorado, dorado `#B89B5B`, verde
bosque `#2F4941` / `#112822`, rojo institucional `#D01217`, imaginario de bosque de niebla, montañas
de Caldas, barrica de roble y aves nativas. No existe aún manual de marca digital aprobado: logos,
fotografía y tipografías propietarias se reemplazan por marcadores hasta recibir activos oficiales.

## Brand & Style

**Territorio creativo: "Los secretos del origen".** Hay más por descubrir detrás de cada historia de ILC.
La interfaz se siente como abrir un archivo antiguo a la luz de una lámpara en medio del bosque de niebla:
oscuridad cálida, verde profundo, destellos dorados de sello y etiqueta, texturas de papel y roble.

- **Estilo:** "Heritage nocturno". Fondos verde-negro profundos, superficies por capas tonales, acentos
  dorados como de lacre/sello, tipografía serif clásica para titulares y sans humanista para lectura.
- **Ambiente de uso:** bares y eventos con poca luz (tema oscuro por defecto) y uso diurno/off-premise,
  Ruta B y consolas (tema claro). Ambos temas cumplen WCAG AA.
- **Tono (Guía §3.5):** curioso y revelador, cálido y cómplice, experto sin solemnidad, regional sin
  folclorismo, elegante no excluyente y **responsable**. Nada de "VIP", "party", "shots", "aguante",
  conteo de tragos ni presión al grupo.
- **Microcopy de referencia:** "Hay historias que empiezan mucho antes de llegar a la botella." ·
  "Sigue la pista: descubre qué cuenta el origen." · "El Parche se une para resolver el misterio; cada
  quien juega a su ritmo." · Ruta A: "Activa el código, conoce tu beneficio y revisa las reglas de la campaña."

## Colors

Dos capas: **funcional** (fija, garantiza estados y accesibilidad) y **de marca/campaña** (variables
sobreescribibles desde el CMS para cada submarca o temporada, sin desplegar).

### Roles funcionales (tema oscuro)
- **Primary — Oro sello `#D4B673`** (contenedor `#B89B5B`, el dorado de ILC): CTA principal, foco,
  progreso, Puntos ILC. Texto sobre oro: `#1E1606`.
- **Secondary — Verde musgo `#86CFA7`** (contenedor verde bosque `#2F4941`): estados de verificación
  ("Código reconocido"), éxito, XP/insignias de Ruta B.
- **Tertiary — Roble `#E09A5F`**: coleccionables, capítulos de la Ruta del Origen, acentos editoriales.
- **Warning — `#F0C15A`**: "Requiere verificación adicional", avisos de vigencia.
- **Error — `#FFB4A9`** sobre `#8C1D18`: "Código no reconocido", errores recuperables.
- **Brand red `#D01217`**: solo para la marca institucional (sello/logo). **Nunca** como color de error
  ni de CTA, para no confundir marca con alerta.
- **Superficies:** base `#0C1613` → contenedores `#111E1A`, `#162621`, `#1D302A`, `#253A33`.
- **Texto:** crema papel `#F4EFE3` (16:1), secundario `#C9C2B0` (8.8:1).

### Tema claro (Ruta B diurna, off-premise, consolas)
Fondo papel `#FAF7F0`, superficie `#F1ECE0`, texto `#13201B`, secundario `#43524B`, primary oro
oscuro `#6E561E` (texto blanco encima), secondary `#2F4941`, tertiary `#9A4F17`, error `#B3261E`,
warning `#7A5400`, outline `#6B7A73`.

### Capa de submarcas (marcadores provisionales — validar con ILC)
Cada submarca sobreescribe `--brand-accent`, `--brand-surface` e imagen de cabecera. Los valores
se toman de etiquetas públicas y **deben confirmarse con el manual de cada marca**:
- **ILC corporativo:** acento `#B89B5B`, superficie `#1F3A31`.
- **Ron Viejo de Caldas:** acento `#C9A45C`, superficie `#1E4A2E` (verde botella).
- **Aguardiente Amarillo de Manzanares:** acento `#F2B90F`, superficie `#3A2E08`.
- **Aguardiente Cristal:** acento `#5B8FD6`, superficie `#132A45`.
- **Otras líneas (Licor de Cacao, Bosque de Indias, etc.):** usar tema ILC corporativo hasta tener activos.

## Typography

- **Titulares (display/headline): EB Garamond** — serif clásica tipo Garamond, evoca etiqueta
  y sello de licor de herencia. Solo ≥24px; nunca para texto corrido ni números de códigos.
- **Lectura, etiquetas y números: Plus Jakarta Sans** — sans humanista de gran altura de x, legible en
  movimiento y con poca luz (sustituye a Helvetica/Museo Sans del sitio corporativo).
- **Números** (PIN, puntos, temporizador, saldos): `font-variant-numeric: tabular-nums`, peso 800.
- Tamaño mínimo de cuerpo 15px; etiquetas en mayúsculas solo para `label-sm` (badges, tags).

## Layout & Spacing

- Mobile-first, una columna, márgenes 16px; tablet 24px; escritorio 32px con contenido máx. 1200px
  (consolas en grilla de 12 columnas).
- **Zona del pulgar:** CTA principal fijo en el 40% inferior, altura 56px, ancho completo en móvil,
  con padding inferior que respeta el indicador de inicio (safe-area).
- Objetivos táctiles ≥48×48px. Ritmo de 4px.
- Navegación inferior de 4 pestañas en la PWA: **Inicio · Jugar · Mi billetera · Perfil**.

## Elevation & Depth

Profundidad por **capas tonales y bordes luminosos**, no por sombras (invisibles en fondos oscuros).
1. Base `#0C1613`.
2. Tarjeta: `#162621` + borde 1px `rgba(244,239,227,0.08)`.
3. Tarjeta destacada ("lacre"): borde superior 1px degradado dorado `rgba(212,182,115,0.45)` → transparente.
4. Hojas/modales: `#1D302A`, radio superior 24px, fondo detrás atenuado 60%.
5. Estado verificado: halo verde suave `0 0 24px rgba(134,207,167,0.22)`; sin animaciones intermitentes.
Respetar `prefers-reduced-motion`.

## Shapes

- Tarjetas 16px (`rounded-2xl`); inputs y botones 12px (`rounded-xl`); hojas/modales 24px (`rounded-3xl`); chips y badges en píldora.
- **Motivo sello:** elementos circulares con doble anillo dorado (insignias, avatar del Parche, sello de
  verificación) inspirados en el sello ILC. Es recurso gráfico, no reproducción del logo.
- Texturas opcionales: grano de papel al 3–5% y vetas de roble muy sutiles en cabeceras.

## Components

- **Botón primario:** 56px, fondo oro `#D4B673`, texto `#1E1606` label-lg, presión `scale(0.98)`.
- **Botón secundario:** 52px, fondo transparente, borde 1px oro al 50%, texto crema.
- **Botón terciario/texto:** texto oro subrayado al foco.
- **Sello de verificación de código** (4 estados, nunca "100 % auténtico" — Guía Técnica §5.6):
  - `Código reconocido` (secondary, ícono check en sello),
  - `Código no reconocido` (error),
  - `Este código ya registra una reclamación` (warning),
  - `Requiere verificación adicional` (warning, con enlace "¿Qué significa?").
- **Tarjetas de ruta:** Ruta A "Activa tu código" (acento oro, ícono botella/código) y Ruta B "Explora el
  origen" (acento verde/roble, ícono brújula/hoja). Siempre visualmente diferenciadas.
- **Marcadores separados en El Parche:** "Marcador del reto" (XP/logros, verde) y "Puntos ILC de la mesa"
  (oro). Nunca sumados en una cifra única.
- **PIN input:** casillas grandes 56px, números tabulares, pegado y autocompletado OTP.
- **Visor QR:** esquinas iluminadas oro, texto de ayuda y alternativa "Ingresar código manualmente".
- **Chips de submarca, badges de insignia (motivo sello), barra de progreso dorada, toasts, estados
  vacío/cargando (skeleton)/error con acción de reintento seguro, banner "Sin conexión".**
- **LegalNotice (obligatorio en pantallas promocionales):** pie fijo en `label-sm` mayúsculas:
  "EL EXCESO DE ALCOHOL ES PERJUDICIAL PARA LA SALUD. PROHÍBASE EL EXPENDIO DE BEBIDAS EMBRIAGANTES A
  MENORES DE EDAD (LEY 30 DE 1986)." Legible, contraste AA, nunca oculto.
- **Age gate:** fondo de bosque de niebla atenuado, sello ILC, pregunta clara, botones "Sí, soy mayor de
  18" / "No". Sin imágenes de consumo.

## Do / Don't

- **Do:** paisajes de Caldas, bosque de niebla, roble, aves nativas, ingredientes, ilustración editorial,
  opciones sin alcohol con la misma jerarquía visual.
- **Don't:** personas bebiendo, brindis masivos, vasos llenándose, contadores de tragos, rankings de
  personas por consumo, estética infantil/caricaturesca, neones de discoteca, lenguaje "VIP/party".
