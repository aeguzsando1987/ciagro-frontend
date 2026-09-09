CIAGRO - FRONTEND: comparación Rendimiento + usuario Guest por códigos

Incluye archivos completos modificados.

Cambios:
- Rendimiento A/B: filtro MapLibre siempre explícito y layers/sources únicos por instancia.
- Sincronización A/B: evita rebote de cámara por jumpTo.
- Guest (role_level=1): árbol y selector muestran slug/código en vez de nombres.
- Guest: búsqueda avanzada oculta/desactivada para no exponer nombres descriptivos.
- Ranchos en mapa de productor también usan código para Guest.

Copiar este ZIP sobre C:\Users\leons\Downloads\ciagro-frontend\ conservando rutas.
Luego ejecutar: npm run typecheck
Y reconstruir: docker compose up -d --build --force-recreate
