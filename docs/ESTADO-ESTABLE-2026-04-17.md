# Estado estable - Modo Sabor

Fecha: 2026-04-17

## Validacion realizada

- Frontend: `npm run build` OK.
- Backend smoke: `npm run smoke` OK.
- Backend core: `npm run verify:core` OK.
- Operacion completa: `npm run verify:operacion` OK.
- Lanzador: sintaxis de `ModoSabor.pyw` OK.
- Health backend: `/api/health` OK.

## Flujo operativo verificado

La prueba operativa crea un pedido por API publica, confirma que aparece en administracion, cambia su estado, genera un ticket de impresion y limpia los datos de prueba al finalizar.

## Estado de configuracion

- Base de datos: OK.
- URL publica APP: configurada.
- URL publica API: configurada.
- Acceso LAN: configurado.
- Mercado Pago: pendiente de token real.
- HTTPS publico: pendiente de URL externa real.

## Limpieza aplicada

- Se eliminaron helpers muertos de WhatsApp/bot que ya no estaban importados.
- Se neutralizaron flujos viejos de notificacion automatica.
- Se ocultaron errores tecnicos de inventario/receta para que no salgan al cliente.
- Se agrego una verificacion operativa reutilizable.

## Siguiente prioridad

Mantener este punto como base estable antes de seguir agregando funciones grandes.
