# Acta de despliegue — frontend, release acumulado KM + PS + NV (2026-08-24)

> Registro posterior al despliegue. **El acta completa, con el detalle de backend, migraciones y
> verificación, vive en `CIAgro_alpha_back/logs/deploy-2026-08-24-km-ps-nv.md`.** Aquí queda solo
> lo propio del frontend.

## Qué entró

Cuatro entregas que nunca habían estado en producción:

- **KM-front**: botones de exportar KML y traer el clima del día en el reporte de sesión.
- **PS-front**: modal de alcance por parcela y poda del explorador.
- **NV**: el Visor como pantalla principal, navegación en pestaña desplegable, raíz del árbol
  según el alcance del usuario, migas de pan navegables, polígonos de parcela bajo los pines.
- **Rediseño visual** de CIAgro.

`master 279236b` → **`126fca0`** (14 commits).

## Orden y ejecución

**Backend primero, frontend después** — el front consume el endpoint de alcance
(`/api/v1/users/assignments/<pk>/scope/`) y campos nuevos del serializer de parcela; un front
nuevo contra un backend viejo da 404 en el modal de alcance. Se respetó.

```bash
git pull --ff-only                 # 279236b -> 126fca0
docker compose build frontend      # el bundle va horneado en la imagen
docker compose up -d frontend
```

El servicio del compose se llama **`frontend`**, no `front`. Confirmar con
`docker compose config --services` si hay duda.

## Dependencias nuevas

El `package.json` cambió: entran `@radix-ui/react-checkbox`, `@radix-ui/react-radio-group`,
`@radix-ui/react-switch`, `@radix-ui/react-tooltip` y `@fontsource-variable/inter`; sale
`tailwindcss-animate`. Se resuelven dentro del build de la imagen, no hace falta `npm install`
en el host.

## Verificación

| Comprobación | Resultado |
|---|---|
| `docker compose build frontend` | OK — el script `build` corre `tsc -b && vite build` |
| `http://localhost:8088/` | 200 |
| Proxy `/api/` hacia el backend (`/api/schema/` vía :8088) | 200 |
| `https://ciagro.bapta.mx/` (nginx del front tras el túnel) | 200 |

Manual, por el desarrollador: **positiva**, sin observaciones.

## Nota sobre `vite.config.ts`

`host: true` y `allowedHosts: true` llevaban meses viviendo como cambio local sin commitear en
el working copy del servidor: son los que permiten alcanzar el dev server de Vite (:5173) desde
el quick tunnel de Cloudflare que sirve de respaldo. Sobrevivieron al `pull` por ser
fast-forward, pero un `checkout` o `reset --hard` los habría borrado. Quedaron versionados el
mismo día en `646e45e` (`master` y `dev`), recuperando de paso el formato y los comentarios
originales del archivo, que la copia local había perdido. Solo afectan al dev server: el bundle
que sirve nginx es idéntico, así que no hizo falta recrear el contenedor tras ese commit.
