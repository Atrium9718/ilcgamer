# Juegos de fiesta

Seis juegos para animar un grupo, instalados como módulos de la plataforma y **editables desde la consola**:

| Juego | Identificador | Qué hace |
|---|---|---|
| Pico de Flecha (antes «Pico de Botella») | `pico-de-flecha` | Gira una flecha (o aguja) y muestra un reto. Varios dedos en la pantalla o botón «Girar». |
| Verdad o Reto | `verdad-o-reto` | Elige verdad o reto; hay una penitencia sin alcohol. |
| Cultura Rumbera (antes «Cultura Chupística») | `cultura-rumbera` | Tema + cronómetro; «respondió bien» reinicia, si se acaba el tiempo se pierde. |
| Yo Nunca Nunca | `yo-nunca-nunca` | Frases en orden, una a una. |
| El Frentazo | `el-frentazo` | Palabras para adivinar con el celular en la frente: se inclina hacia el piso si aciertan y hacia el techo para pasar (sensor de movimiento; hay botones como alternativa). |
| Mano de Cirujano | `mano-de-cirujano` | Mantén el dedo dentro del círculo, que acelera, frena, crece y se encoge; si te sales o levantas el dedo, pierdes. |

## Cómo se personalizan (consola → «Juegos de fiesta»)
1. Entra como TI o Admin de Marca → **Juegos de fiesta** → **Personalizar** (o crea uno nuevo desde una plantilla).
2. Cambia **colores, forma y rótulos del girador, títulos, botones, mensajes y el contenido** (retos, verdades, temas, frases, palabras). A la derecha ves la **vista previa jugable** y los errores en vivo.
3. **Guardar** crea la siguiente versión (p. ej. 1.0.1) como borrador. Luego, en **Juegos** (Catálogo): pasar a prueba → aprobar (Marca y Jurídica) → activar. Mientras no se active, la gente sigue viendo la versión anterior; se puede volver a ella en cualquier momento.

## Reglas
- **Sin alcohol como castigo ni incentivo**: no se aceptan textos con shot, trago, fondo blanco, brindar, «toma un…», etc. La consola avisa y el servidor lo rechaza. Tampoco hay botellas ni copas en los gráficos (por eso el girador es una flecha o una aguja).
- Los juegos **no dan Puntos ILC ni XP** y el servidor no guarda resultados ni datos personales de la partida.
- Cambiar estas reglas (p. ej. recuperar «Pico de Botella») requiere una decisión explícita de ILC/TI.

## Técnica
- Motor `party` (`packages/contracts/src/party.ts`): la configuración se valida con zod y las plantillas están en `PARTY_TEMPLATES`.
- Vistas puras en `packages/ui/src/party/` (con Storybook y axe); editor en `packages/ui/src/console/PartyAdminViews.tsx`.
- Demo: `apps/api/src/seed-demo.ts` los instala por el flujo real y los pone en el catálogo general.
- E2E: `tools/e2e/party.cjs` (parte de `pnpm e2e`).
