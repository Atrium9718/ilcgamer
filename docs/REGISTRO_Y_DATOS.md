# Registro al entrar y panel de datos (Paso 16)

## Qué pide la app al entrar
Con `REQUIRE_PROFILE_AT_ENTRY=true` (lo activa `deploy/staging_demo.sh`; por defecto está apagado), después del control de edad la PWA lleva a `/bienvenida` y no deja usar nada más hasta completar:
- **Nombre completo**, **correo** y **celular colombiano** (se normalizan: correo en minúsculas, celular `+57…`).
- **Autorización del tratamiento de datos** (obligatoria), con enlace a la política de tratamiento.
- **Novedades y promociones** de ILC y sus marcas: casilla **aparte y opcional**.

Cada autorización se guarda como un registro nuevo e inmutable (`consent_records`: propósito, sí/no, versión del aviso, origen `registro`, fecha). Si cambia la versión del aviso, se vuelve a pedir. No se repiten correo ni celular de otra persona. La persona puede corregir sus datos volviendo a enviar el formulario, y puede pedir su eliminación (la cuenta y sus datos personales se borran).

> El correo y el celular **no se verifican** con código en esta etapa (no hay pasarela de correo/SMS). Cuando exista (`OTP_PROVIDER=webhook`), el registro por código los verificará.

## Panel en la consola → «Contactos» (Marca y TI)
- Resumen: registrados, nuevos en el periodo (7/30/90 días), % que acepta novedades, con correo y celular.
- Gráfica de registros por día (hora de Colombia).
- Lista con búsqueda (nombre, correo o celular) y **descarga en CSV** de todos los registros: nombre, correo, celular, fecha de autorización de datos, si acepta novedades, fecha y origen. El CSV protege contra fórmulas de hoja de cálculo.
- Solo aparecen quienes tienen la autorización de tratamiento **vigente** y cuenta no eliminada. Cada consulta queda en la auditoría (`contacts.registrations_listed`), sin guardar los datos.

## Reglas de uso
- Los datos son personales: usarlos solo para lo autorizado. Para comunicaciones comerciales, solo las personas con «Acepta novedades = sí».
- Pendiente con Jurídica/Privacidad de ILC: texto final de la autorización y de la política de tratamiento, finalidades, conservación y quién accede al CSV.
