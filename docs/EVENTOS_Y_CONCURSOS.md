# Eventos y concurso de disfraces

Un **evento** (p. ej. la feria) agrupa **concursos**. El primer tipo es el **concurso de disfraces**: la gente sube la foto de su
disfraz, otras personas votan, gana quien tenga más votos y se lleva un premio (p. ej. un palco), y las votaciones se ven en vivo en
una pantalla. Contrato: `packages/contracts/src/events.ts`.

## Flujo

1. **Marca** crea el evento y lo **publica** (consola → Eventos).
2. **Marca** crea el concurso (premio, fecha de cierre de inscripción y fechas de la votación). Otra persona distinta **lo abre**
   (separación de funciones).
3. **Fase INSCRIPCIÓN**: cada persona con cuenta guardada se inscribe con el nombre del disfraz, una foto y la **autorización expresa**
   para mostrarla. La foto queda **en revisión**.
4. **Marca modera** cada foto (ve la imagen): aprueba o rechaza con motivo. Solo lo aprobado se ve.
5. **Fase VOTACIÓN**: un voto por cuenta; nadie vota por su propio disfraz; el voto no se edita. La **pantalla del evento** muestra el ranking.
6. **Cierre**: pasada la hora de cierre, el sistema cierra solo (o Marca con «Cerrar y declarar ganador») y fija al ganador. Con empate gana
   quien se inscribió primero; sin votos no hay ganador.
7. **Entrega**: la persona ganadora ve su **código** en el concurso; quien entrega el premio lo registra en la consola con ese código
   (una sola vez, auditado). El premio **no** es Puntos ILC ni XP.

## Pantalla del evento

Consola → Eventos → Gestionar → **Pantalla del evento**: copia el enlace (`https://<app>/pantalla/<token>`) y ábrelo en la pantalla o el
proyector (pantalla completa, F11). Se actualiza sola cada 4 s, muestra alias, título, foto aprobada y conteos, y un **QR para votar**.
No requiere iniciar sesión: **el enlace es el acceso**, así que no lo publiques. Si se filtra, «Generar enlace nuevo» invalida el anterior.

## Privacidad y contenido

- La foto es dato personal: autorización expresa, moderación previa, JPEG sin metadatos (el servidor quita EXIF/ubicación), eliminación
  al borrar la cuenta y **30 días después de cerrar el concurso** (`retention.contestPhotosDays`, editable). Se conserva el título y el resultado.
- La pantalla pública nunca muestra datos de contacto.
- Reglas de contenido: sin copas, botellas ni consumo de alcohol en la foto; sin menores ni datos personales visibles. Marca las verifica al moderar.

## Pendiente de ILC / Jurídica

Texto legal de autorización de uso de imagen, bases del concurso, y definir quién entrega el premio y dónde.

## Probar

`pnpm --filter @ilc/api test` (`events.spec.ts`, `jpeg.spec.ts`), `pnpm --filter @ilc/ui test` y el recorrido en navegador:
`node tools/e2e/contest.cjs` (misma preparación que `docs/OPERACION.md`). Datos de demostración para staging: `docs/DESPLIEGUE.md`.
