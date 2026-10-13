# Piloto controlado: checklist y criterios

Fuentes: Guía Técnica §9.3, §12, §15, §16. Este documento separa lo que **la plataforma ya hace** de lo que **ILC debe
decidir o aprobar** antes de tener usuarios reales.

## 1. Checklist de campaña (§16) → cómo lo impone la plataforma

La consola **no deja publicar** una campaña sin las aprobaciones de Marca y Jurídica (más Privacidad si hay GPS o datos extra) y sin
marcar los 11 puntos de la lista; cada marca queda con su autor y el contenido exacto aprobado queda fijado por *hash*.

| Punto de la lista | Qué hace la plataforma | Qué debe hacer una persona |
|---|---|---|
| Menores | Control de edad previo a todo contenido promocional; edad mínima por campaña (+21) | Elegir canales y medios que minimicen exposición |
| Ruta, objetivo y KPI | Campos obligatorios en la campaña | Definir la línea base y la ficha de métrica |
| Mecánica comercial y términos | Versionado inmutable de reglas y topes verificados en servidor | Aprobar valores (puntos, multiplicadores, vigencias) con Finanzas y Jurídico |
| Sin presión ni velocidad de ingesta | Ningún juego emite Puntos ILC; esquema de manifiesto sin esos retos; tableros sin puntuación única | Revisar el contenido de los juegos y retos |
| Assets autorizados | Contenido de marca solo tras aprobación | Autorizar textos, imágenes y música |
| Advertencias legales | Aviso legal visible en pantallas y tarjetas | Validar el texto exacto por jurídica |
| GPS y permisos | Apagados por defecto; permisos de juegos requieren Privacidad | Justificar y ofrecer alternativa si se usan |
| Premios | Inventario por zona, límites, fechas, responsable de entrega, entrega por código | Cargar el catálogo real y su logística |
| QA y rollback | Pausar campaña y desactivar juego/recompensa al instante | Ejecutar el plan de pruebas en staging |
| Staff y comercios | Códigos de Staff, paneles y entrega por ciudad | Capacitar y dar canal de soporte |
| Analítica | Eventos versionados sin datos personales | Confirmar la finalidad autorizada |

## 2. Decisiones que ILC debe cerrar (§15)

| Decisión | Estado en la plataforma |
|---|---|
| Objetivo/KPI por ruta y línea base | Campos listos; falta definirlos |
| Marcas y SKU iniciales | Catálogo editable; la semilla no inventa SKUs |
| Mecánica de activación, límites y valor de puntos | Todo parametrizable por campaña; valores del borrador solo son datos de prueba |
| Smart Tags: proveedor y antifalsificación | Importación/generación, revocación y exportes listos; falta el proveedor de impresión |
| Modelo de control de edad | Declaración + fecha (no se guarda la fecha); falta el análisis de riesgo aprobado |
| Datos, retención y consentimiento | Consentimientos separados y retención configurable (abajo); falta validación legal de textos |
| Infraestructura | `deploy/` listo para un VPS; falta aprobar proveedor y ubicación |
| Proveedor de códigos de acceso (WhatsApp/SMS/correo) | Pasarela por webhook lista; **sin proveedor nadie puede iniciar sesión** |
| Contenido real de juegos, preguntas y recompensas | Solo contenido de prueba |
| Staff y beneficios B2B | Paneles y vinculación listos; los incentivos económicos no se calculan |
| Referidos | Mecanismo listo y apagado; falta presupuesto, términos y topes |
| Piloto: tamaño, duración y umbrales | Tableros y métricas listos; falta el plan de medición |

## 3. Inventario de datos (§9.3)

| Dato | Finalidad | Base | Retención | Quién lo ve |
|---|---|---|---|---|
| Fecha de nacimiento | Control de edad | Obligación legal / consentimiento | **No se guarda**: solo el resultado y la edad mínima verificada | Nadie |
| Correo o celular (cifrado/hash) | Acceso por código y guardar progreso | Consentimiento (términos) | Hasta que la persona elimine su cuenta | Nadie en consola; hash para búsqueda |
| Alias | Identificación en el Parche y rankings | Funcional | Hasta eliminar la cuenta | Participantes del Parche; Staff y Comercio solo en agregado |
| Ledger de Puntos ILC | Trazabilidad económica | Obligación contable | Permanente (inmutable) | Marca/TI en Economía |
| Canjes y entregas | Operar premios | Contractual | Permanente | Marca/TI; Staff/Comercio solo el código que reciben |
| Consentimientos | Prueba de autorización | Obligación legal | Permanente | Privacidad |
| Auditoría | Trazabilidad de operaciones críticas | Seguridad | Permanente | TI/Privacidad |
| Eventos analíticos | Medir KPI aprobados | Interés legítimo / consentimiento | 730 días; sin PII | Marca/TI en agregado |
| Incidentes de seguridad | Antifraude | Seguridad | Abiertos hasta resolver; resueltos 730 días | TI |
| Consultas de código | Detección de anomalías | Seguridad | 365 días | TI |
| Estado privado de misiones | Evaluar en servidor | Funcional | 30 días tras terminar | Nadie |
| Ubicación / contactos / huella de dispositivo | — | — | **No se recogen** | — |

Pendiente: aprobación legal del inventario, canal de atención a derechos (acceso, corrección, supresión) y textos finales de aviso.

## 4. Matriz de compatibilidad

| Entorno | Cómo se prueba | Estado |
|---|---|---|
| Android Chrome (viewport Pixel 5) | E2E automático `pnpm e2e` en CI | ✅ |
| Escritorio Chrome (consola) | Pruebas de UI + E2E de consola | ✅ |
| Accesibilidad (WCAG 2.1 AA, claro y oscuro) | axe en 174 combinaciones de Storybook | ✅ |
| iOS Safari (iPhone) | **Manual** con dispositivo real | ☐ pendiente |
| Android con navegador in-app (cámara/WhatsApp) | **Manual** | ☐ pendiente |
| Apertura del QR desde la cámara nativa | **Manual** en iOS y Android | ☐ pendiente |
| Lectura de QR con cámara en la PWA (BarcodeDetector) | **Manual**; sin soporte cae al PIN o a la cámara nativa | ☐ pendiente |
| Instalación como PWA y modo sin conexión | **Manual** | ☐ pendiente |
| Datos móviles lentos (3G) | **Manual** con *throttling* | ☐ pendiente |

## 5. Criterios para decidir el piloto (Go / No-Go)

**Técnicos (la plataforma los cumple hoy)**: lint, tipos y todas las pruebas en verde; E2E de ruta crítica; axe sin violaciones;
`pnpm audit --prod` sin vulnerabilidades; matriz de autorización sin rutas abiertas; restauración de copia verificada.

**Antes de abrir al público (dependen de personas)**:
1. Infraestructura aprobada y desplegada en *staging*; restauración probada **en ese servidor**.
2. Proveedor de códigos de acceso conectado y probado de punta a punta.
3. Aprobaciones de Marca, Jurídica y Privacidad de la campaña piloto y de cada juego y recompensa.
4. Textos legales, aviso de privacidad y advertencias validados.
5. Matriz de compatibilidad completa en dispositivos reales.
6. Staff y comercios capacitados y con canal de soporte; recompensas físicas con stock real y responsable.
7. Plan de medición del piloto (umbrales de escala) y responsables de monitoreo con las alertas de `docs/OPERACION.md`.
8. Prueba de penetración externa o revisión de seguridad independiente (esta lista no la sustituye).

## 6. Riesgos conocidos

- La prueba de carga fue en un solo proceso local; falta dimensionar con el tráfico real esperado.
- La API corre en una instancia; el tiempo real usa Redis pub/sub, por lo que escalar a varias instancias es posible pero no se probó.
- Las imágenes de Docker no se construyeron todavía; la primera construcción en el servidor puede requerir ajustes.
- La lectura de QR en la PWA depende del navegador; hay alternativas (PIN, cámara nativa).
