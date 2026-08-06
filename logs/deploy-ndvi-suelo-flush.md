# Deploy en producción — NDVI, Mapeo de Suelo y borrado seguro de puntos

> Entrega acumulada desde el último `master` en producción. **Backend primero**, el front
> consume sus endpoints nuevos.
>
> **Trae migraciones** (10 archivos) y **una app nueva** en `INSTALLED_APPS`.
> **No** trae dependencias nuevas (`pip` ni `npm`) ni variables de entorno nuevas.

## Qué entra

- Sesiones **NDVI**: header, puntos, importación CSV, contornos por interpolación IDW en PostGIS.
- Catálogo **`analytics_config`**: umbrales y colores por variable, por organización.
- **Mapeo de suelo**: campos opcionales `lim_inf_CC`, `Cap_efi_fert`, `C_de_MO` y registro en el admin.
- **Borrado seguro de puntos** por sesión (NDVI, suelo y aspersión), solo SuperAdmin.
- **Clasificación NDVI de 9 clases** precargada por defecto para toda organización.
- `plot_code`, `crop_name` y `crop_variety_name` en el árbol del Task Manager.

---

## EL PASO QUE PUEDE FALLAR — leer antes de migrar

La migración `datalayers/0038_enable_postgis_raster` ejecuta:

```sql
CREATE EXTENSION IF NOT EXISTS postgis_raster;
ALTER DATABASE "<db>" SET postgis.gdal_enabled_drivers = 'GTiff';
```

Ambas requieren **superusuario o dueño de la base**. En desarrollo `ciagro_user` pudo hacerlo;
**en producción hay que verificarlo antes**, o `migrate` aborta a media aplicación.

```bash
# 1. ¿El usuario de la app es dueño de la BD?
psql -h <host> -U postgres -d <db> -c "\l <db>"

# 2. ¿Ya existe la extensión?
psql -h <host> -U <app_user> -d <db> -c "SELECT extname FROM pg_extension WHERE extname='postgis_raster';"
```

Si el usuario de la app **no** tiene el privilegio, ejecutar como superusuario ANTES de `migrate`:

```bash
psql -h <host> -U postgres -d <db> -c "CREATE EXTENSION IF NOT EXISTS postgis_raster;"
psql -h <host> -U postgres -d <db> -c "ALTER DATABASE \"<db>\" SET postgis.gdal_enabled_drivers = 'GTiff';"
```

La migración es idempotente (`IF NOT EXISTS`), así que correrla después no falla.

> `ALTER DATABASE ... SET` aplica a **conexiones nuevas**. Por eso el reinicio de web y worker
> va DESPUÉS de migrar; si no, el worker sigue con la sesión vieja y la interpolación falla.

---

## 1) Backend

```bash
cd <ruta>/CIAgro_alpha_back
git fetch --all && git checkout master && git pull

# Respaldo de BD ANTES de migrar (hay una migración de datos, ver nota abajo)
pg_dump -h <host> -U <user> -d <db> -Fc -f backup_pre_ndvi_$(date +%F).dump

python manage.py migrate
python manage.py check --deploy

# Reiniciar web Y worker (el worker ejecuta las tareas de import y contornos):
#   docker:   docker compose up -d --build web celery
#   systemd:  sudo systemctl restart <gunicorn> <celery>
```

**Migraciones que se aplican:**

| App | Migración | Qué hace |
|---|---|---|
| `analytics_config` | `0001_initial` | Tabla del catálogo de configuración |
| `analytics_config` | `0002_alter_ndvivariableconfig_ndvi` | Cambia el default del campo `ndvi` |
| `analytics_config` | `0003_backfill_ndvi_canonical_classes` | **Migración de datos** (ver abajo) |
| `datalayers` | `0036_ndvisessionheader_...` | Header y puntos NDVI |
| `datalayers` | `0036_soil_map_optional_fields` | 3 campos opcionales de suelo |
| `datalayers` | `0037_ndvisessionheader_contour_status_...` | Estado de contorneo |
| `datalayers` | `0038_enable_postgis_raster` | **Extensión PostGIS** (ver arriba) |
| `datalayers` | `0039_ndvi_contours_per_tenant` | Coropleta por organización |
| `datalayers` | `0040_merge_20260731_1324` | Une las dos ramas de `0036` (vacía) |

Hay **dos migraciones `0036`** porque NDVI y Mapeo de Suelo salieron de `0035` en paralelo.
`0040` une el grafo y no toca el esquema. Si `migrate` se queja de *"multiple leaf nodes"*,
es que `0040` no llegó: verificar que el `git pull` trajo el archivo.

**Sobre `0003` (migración de datos):** es **no destructiva**. Solo reescribe las filas cuya
configuración de `ndvi` sigue siendo exactamente el default de fábrica de cuartiles; una
organización que ya eligió sus propias bandas conserva lo suyo. Es idempotente y reversible.
En una BD de producción sin `analytics_config` previa, no hay filas que tocar.

**Smoke (con token válido):**

```bash
GET  /api/v1/monitoring/ndvi/headers/
GET  /api/v1/monitoring/soil-map/headers/
GET  /api/v1/analytics-config/ndvi/variables/     # 15 índices
GET  /api/v1/analytics-config/ndvi/               # crea la fila del tenant al vuelo
GET  /api/v1/field_ops/master-programs/<uuid>/tree/   # debe traer plot_code y crop_name
```

En `analytics-config/ndvi/` el campo `ndvi` debe venir con `"strategy": "manual"` y **9 bandas**;
el resto de las variables con `"strategy": "quartile"`.

## 2) Frontend (después del backend)

```bash
cd <ruta>/CIAgro_alpha_front
git fetch --all && git checkout master && git pull

npm ci                # sin dependencias nuevas
npm run build         # usa VITE_API_BASE_URL de producción

# Publicar dist/ en el docroot de nginx y recargar
```

**Smoke:**
1. Visor de Datos → expandir hasta una parcela: deben aparecer los grupos **NDVI** y **Mapeo de suelo**.
2. Task Manager → `+ Nueva Sesión`: cuatro tipos (Aspersión, Fitosanitario, Índices vegetativos, Mapeo de suelo).
3. Detalle de un programa: los subprogramas muestran **parcela · temporada · cultivo**, y la lista scrollea sin estirar el modal.
4. Con usuario **SuperAdmin**, en una sesión con datos: botón "Eliminar los datos de esta sesión" (pide código de 6 dígitos).

---

## Notas y riesgos

- **Orden obligatorio:** backend antes que frontend. El front consume endpoints que no existen en la versión actual de producción.
- **Reiniciar el worker de Celery**, no solo el web: las tareas `import_ndvi_csv`, `import_soil_map_csv` y `build_ndvi_contours` son nuevas, y además el worker necesita reconectar para tomar `gdal_enabled_drivers`.
- El **borrado de puntos es irreversible** y solo para SuperAdmin (rol nivel ≥ 5). Está acotado a una sesión: no toca otras sesiones de la misma parcela. En NDVI además purga la coropleta cacheada de todas las organizaciones, porque se deriva de los puntos.
- La importación de CSV es **append**: reimportar duplica. Para eso existe el borrado seguro.
- La **paleta NDVI precargada** va de verde en la clase baja a rojo en la clase alta. Confirmar que es el criterio deseado antes de que los usuarios la vean; cambiarla después es editar los valores desde Administración → Configuración de variables.

## Rollback

```bash
# Backend
git checkout <commit_anterior> && <reiniciar web y celery>
python manage.py migrate analytics_config 0002    # revierte solo el backfill
# El resto de las migraciones son aditivas: revertirlas borra las tablas de NDVI.
# Si hay datos importados, preferir restaurar el dump.

# Frontend
git checkout <commit_anterior> && npm ci && npm run build && publicar dist/
```

`0038` no se revierte sola: el `disable_raster` hace `RESET` del driver pero **no** hace
`DROP EXTENSION`, a propósito, porque podría haber datos raster dependientes.
