# Guía de integración de juegos

Esta guía es para el equipo de Marca, Trade Marketing, TI y los proveedores de juegos (estudios de marca blanca).
Explica cómo **agregar, modificar, probar, activar, desactivar y revertir** un juego sin desplegar la plataforma
(Instrucciones §13.1; Guía Técnica §5.4). También se muestra en la consola, en **Juegos → Guía de integración**.

## 1. Las dos rutas

| | Ruta A | Ruta B |
|---|---|---|
| Para qué | Juego simple y rápido para el momento de consumo (trivia, ruleta, charadas). | Experiencia de mediano y largo plazo (el Explorador, mixología editorial). |
| Qué suma | **Marcador del Parche** (experiencial). | **XP e insignias** de la persona. |
| Límite | — | **Máximo 2 experiencias de Ruta B por persona en cada campaña** (o en la plataforma, si no hay campaña). Cambiar este límite requiere decisión formal. |

Reglas que ningún juego puede saltar (el esquema las hace imposibles de configurar):

- **Un juego nunca emite Puntos ILC.** Los Puntos ILC solo nacen de reclamar un código de botella (Smart Tags).
- **El XP solo existe en módulos de Ruta B.** Un juego de Ruta A declara `xpMax: 0`.
- **El cliente nunca se autoasigna recompensa.** El resultado lo decide el servidor (motor propio) o lo confirma el
  servidor del proveedor con una llamada firmada.
- Sin retos de consumo, velocidad, cantidad o presión grupal. Sin copas ni botellas sirviéndose. Contenido de marca
  (preguntas, relatos, datos) solo después de la aprobación de Marca y Jurídica.

## 2. El manifiesto del módulo

Cada versión de un juego se registra con un manifiesto JSON (Consola → Juegos → Registrar módulo). Es un objeto
**cerrado**: un campo desconocido se rechaza.

| Campo | Qué es |
|---|---|
| `moduleId` | Identificador estable en minúsculas con guiones (`trivia-origen`). |
| `provider`, `version` | Quién lo entrega y su versión `x.y.z`. Cada cambio es una versión nueva. |
| `title`, `description`, `icon`, `minutes`, `players` | Cómo se presenta en el catálogo (ícono de Material Symbols; sin alusiones al consumo). |
| `route` | `"A"` o `"B"`. |
| `languages`, `aspect` | Idiomas (`es-CO`) y relación de aspecto (`portrait` o `any`). |
| `permissions` | Permisos del dispositivo que pide (`camera`, `microphone`, `geolocation`). Cualquiera exige aprobación de Privacidad. |
| `dataPolicy` | `collectsPersonalData`, `trackers`. Si alguno es verdadero, exige aprobación de Privacidad. |
| `accessibility` | `screenReader`, `reducedMotion`: qué soporta. |
| `delivery` | **Cómo se entrega** (ver §3). |
| `scoring` | Topes: `parcheScoreMax`, `xpMax`, `attemptsPerDay`, `maxSeconds`. El servidor los aplica siempre. |
| `badge` | Insignia que otorga (debe existir antes en Economía → Insignias). |

Ejemplos listos para copiar están en `games/ejemplos/` (contenido de **prueba**, no de marca).

## 3. Cómo se entrega un juego

### 3.1 Motor propio (`delivery.kind = "engine"`)

La plataforma trae tres motores; el contenido se configura por esquema, sin código:

- **`trivia`** (Ruta A): `questions` (id, pregunta, 2–4 opciones, `correctIndex`, `fact`), `perGame`,
  `parchePerCorrect`, `secondsPerQuestion`. El servidor sortea las preguntas y **nunca envía la respuesta correcta**
  al celular. El tiempo es solo un tope: no hay bonificación por rapidez.
- **`wheel`** (Ruta A): `segments` (etiqueta, `score`, `challenge` opcional). El servidor decide el giro.
  Los retos son culturales o de conocimiento.
- **`chapters`** (Ruta B): `chapters` (relato, pregunta, `xp`) y `finalBadge`. Los capítulos se desbloquean en orden,
  cada uno da su XP **una sola vez** por persona y la insignia llega al completarlos todos.

### 3.2 Módulo de proveedor en iframe (`delivery.kind = "iframe"`)

Para juegos de estudios externos (Branded Mini Games, Interactly u otros):

1. El proveedor aloja el juego en **HTTPS, en un origen distinto** al de la plataforma
   (`entryUrl` y `allowedOrigin` en el manifiesto).
2. La plataforma lo incrusta con `sandbox="allow-scripts allow-same-origin"` (sin navegación superior, ventanas
   emergentes, formularios ni modales), sin permisos de dispositivo salvo los aprobados, y sin enviarle cookies ni
   datos de la persona. El navegador solo le revela el origen de la aplicación (`Referer` de solo origen, sin ruta ni
   parámetros); aun así, indica `hostOrigin` al crear el cliente. Solo recibe un identificador de partida.
3. El juego usa el **Game SDK** para hablar con la plataforma (`postMessage` validado por origen y ventana):

```html
<script type="module">
  import { createGameClient } from './ilc-game-sdk.js'; // packages/game-sdk/dist/ilc-game-sdk.js (1 KB)

  const ilc = createGameClient({ hostOrigin: 'https://app.ilc.com.co' });
  const { missionId, locale, reducedMotion } = await ilc.ready(); // la plataforma responde con la partida
  // … tu juego …
  ilc.progress(60);   // opcional, 0-100
  ilc.finish();       // terminó (no envía puntaje)
  // ilc.error('no_carga', 'mensaje corto'); // si algo falla
</script>
```

4. **El navegador nunca informa cuánto ganó la persona.** Al terminar, el *servidor del proveedor* llama a
   `POST /api/v1/games/provider-callback` con el resultado y una firma. Mientras tanto la partida queda
   "verificando".

```js
// Servidor del proveedor (Node). El secreto lo entrega TI en Consola → Juegos → Secreto del proveedor.
import { createHmac } from 'node:crypto';

const canonical = (v) =>
  Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`
  : JSON.stringify(v);

const body = { missionId, issuedAt: new Date().toISOString(), outcome: 'completed', parcheScore: 30, xp: 0 };
const signature = 'sha256=' + createHmac('sha256', SECRET).update(canonical(body)).digest('hex');

await fetch('https://api.ilc.com.co/api/v1/games/provider-callback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Provider-Signature': signature },
  body: JSON.stringify(body),
});
```

   - La firma es HMAC-SHA256 del **JSON canónico** (claves ordenadas, sin espacios) del cuerpo.
   - `issuedAt` debe estar dentro de ±5 minutos. Cada partida se confirma una sola vez.
   - `outcome` puede ser `completed` o `rejected`. `parcheScore` y `xp` se **acotan** a los topes del manifiesto.
   - Si el secreto se filtra, TI lo **rota** y el anterior deja de valer.

## 4. Requisitos de compatibilidad (lista de chequeo)

- [ ] HTTPS, sin credenciales en la URL, origen distinto al de la plataforma.
- [ ] Funciona en celular vertical (360 × 640 en adelante) y respeta `reducedMotion`.
- [ ] Texto en español de Colombia, contraste AA, objetivos táctiles de 48 px, compatible con lector de pantalla.
- [ ] Peso total razonable en datos móviles (se recomienda menos de 3 MB).
- [ ] No usa cookies, rastreadores ni almacenamiento propio sin declararlo en `dataPolicy`.
- [ ] No pide permisos que no estén en `permissions`.
- [ ] No contiene retos de consumo ni elementos que inciten a beber más, más rápido o en grupo.
- [ ] Solo muestra alias de personas (nunca nombres, teléfonos ni correos).
- [ ] Incluye la advertencia legal obligatoria donde corresponda.

La plataforma que aloja la PWA debe permitir el origen del proveedor en `frame-src` de su política de seguridad de
contenido (CSP); TI lo configura al activar un proveedor nuevo.

## 5. Cómo agregar, modificar, activar y revertir un juego

1. **Registrar** (TI, SuperAdmin): Consola → Juegos → *Registrar módulo*, pegar el manifiesto. Si hay errores, se
   muestran por campo. Cada cambio es una **versión nueva**: no se edita una versión ya registrada.
2. **Probar** (Admin de Marca): *Probar* pasa la versión a *En prueba*. Desde ese momento el equipo editorial puede
   jugarla en modo prueba, que **no otorga nada**.
3. **Aprobar**: Marca y Jurídica (y Privacidad si el módulo recoge datos, rastrea o pide permisos). Cada aprobación
   vale solo para el contenido exacto revisado; quien registró o envió a prueba no puede aprobar. Un rechazo devuelve
   la versión a borrador.
4. **Activar** (Admin de Marca): con todas las aprobaciones, la versión pasa a *Activo* y la anterior queda
   *Desactivada*. Solo una versión por módulo está activa.
5. **Asignar a campañas**: en el editor de la campaña, sección *Juegos* (máximo 2 de Ruta B). Para cuando no hay
   campaña, Consola → Juegos → *Juegos por defecto*. Una campaña no se puede publicar si alguno de sus juegos no está
   activo.
6. **Desactivar o revertir**: *Desactivar* retira el juego de inmediato (con motivo, queda en auditoría).
   *Volver a esta versión* reactiva una versión anterior ya aprobada.

Todo queda en la bitácora de auditoría: quién registró, probó, aprobó, activó, desactivó, vio o rotó el secreto.
