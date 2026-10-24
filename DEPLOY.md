# Deploy en Vercel — WebForge Builder (100% gratis)

Guía para publicar en internet, con URL propia y HTTPS. Costo total: **$0** —
Vercel plan Hobby + Supabase plan Free.

Son **dos deploys distintos** y conviene no mezclarlos:

| Qué publicás | Para qué | Base de datos |
|---|---|---|
| **[El Builder](#parte-a--publicar-el-builder)** | tener el generador online y mandarle propuestas armadas a un cliente | opcional (solo para "Compartir link") |
| **[Un proyecto generado](#parte-b--publicar-un-proyecto-generado)** | el sitio del cliente, en producción | **obligatoria** (Supabase) |

Los dos repos ya vienen preparados: `api/index.js` (función serverless), `vercel.json`
(rewrites + inclusión de archivos) y `supabase/schema.sql`. No hay que tocar código.

---

## Parte A — Publicar el Builder

### Cómo queda armado

```
Navegador ──► Vercel
              ├── public/  → estáticos (la UI del Builder, servidos por CDN)
              └── /api/*   → api/index.js (función serverless con la app Express:
                             catálogo, preview, export ZIP, proyectos compartidos)
                                  │
                                  └──► Supabase (opcional): tabla builder_projects
                                       para "Compartir link"
```

Dato clave: el generador es **stateless** (config entra, ZIP sale), así que el Builder
funciona en Vercel **sin ninguna base de datos**. Supabase se usa solo para una feature
opcional: guardar una configuración y compartirla por link (`?p=abc123`).

### Opción 1 — CLI de Vercel (sin git, sin GitHub) · 3 min

La vía directa: sube la carpeta tal cual está.

```bash
npm i -g vercel
cd webforge-builder
vercel        # primera vez: te loguea y pregunta la config del proyecto
vercel --prod # publica en la URL definitiva
```

Cuando pregunte:

| Pregunta | Respuesta |
|---|---|
| Set up and deploy? | `y` |
| Which scope? | tu cuenta |
| Link to existing project? | `n` |
| Project name | `webforge-builder` |
| In which directory is your code located? | `./` |
| Want to modify the settings? | `n` (framework `Other`, sin build) |

En ~1 minuto tenés tu URL: `https://webforge-builder-xxxx.vercel.app`.
Cada `vercel --prod` vuelve a publicar.

> `node_modules/` y `.env` quedan afuera por `.gitignore` / `.vercelignore`.
> Nunca subas `.env`: los secretos van como variables de entorno (Parte C).

### Opción 2 — Importar desde GitHub · 5 min

Conviene si querés que cada cambio se publique solo.

1. Subí el repo a GitHub (puede ser privado).
2. [vercel.com](https://vercel.com) → **Add New → Project** → importá `webforge-builder`.
3. Configuración:
   - **Framework Preset:** `Other`
   - **Build Command:** vacío (no hay build)
   - **Output Directory:** vacío
   - **Install Command:** `npm install`
4. **Deploy**. Cada push a `main` redeploya solo.

### Por qué funciona sin tocar nada

- Vercel sirve `public/` como estáticos automáticamente (por eso la UI carga en `/`).
- El `rewrite` de `vercel.json` manda todo `/api/*` a la función `api/index.js`, que
  exporta la app Express completa.
- `includeFiles: "{modules,src,public}/**"` es importante: el registro de módulos hace
  `fs.readdir + require` dinámico, y el trazador de Vercel no detecta requires dinámicos —
  sin esa línea, la función se publicaría sin los módulos y el catálogo saldría vacío.

---

## Parte B — Publicar un proyecto generado

El `.zip` que exporta el Builder ya trae todo lo necesario, **siempre que hayas elegido
`Vercel` + `Supabase` en el panel de infraestructura**. No es opcional: el filesystem de
Vercel es efímero, así que un proyecto con persistencia JSON perdería los datos en cada
deploy. Por eso el Builder fuerza Supabase cuando elegís Vercel.

### 1. Base de datos (Supabase)

1. Creá una cuenta en [supabase.com](https://supabase.com) → **New project**
   (región `South America (São Paulo)` para menor latencia desde Argentina).
2. Cuando termine de provisionarse: **SQL Editor → New query**, pegá el contenido de
   `supabase/schema.sql` del proyecto y ejecutá (**Run**). Crea una tabla por colección,
   todas con RLS activado (solo accesibles con la service key).
3. **Project Settings → API**, copiá:
   - **Project URL** (ej: `https://abcdefgh.supabase.co`)
   - **service_role key** (⚠ la secreta, **no** la `anon`)

### 2. Deploy

```bash
cd el-proyecto-generado
npm i -g vercel
vercel --prod
```

O importando el repo desde GitHub, igual que en la Parte A.

### 3. Variables de entorno

En Vercel: tu proyecto → **Settings → Environment Variables**. Están todas listadas en el
`.env.example` que vino en el `.zip`:

| Name | Value | Cuándo |
|---|---|---|
| `JWT_SECRET` | una cadena larga y aleatoria | si el proyecto tiene el módulo Autenticación |
| `SUPABASE_URL` | `https://abcdefgh.supabase.co` | siempre |
| `SUPABASE_SERVICE_KEY` | `eyJhbGciOi...` (la service_role) | siempre |
| `AI_BASE_URL` · `AI_API_KEY` · `AI_MODEL` | credenciales del proveedor | si tiene Chatbot o Agente IA |

Para generar un `JWT_SECRET` fuerte:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Después de cargarlas: **Deployments → ⋯ → Redeploy** (las env vars aplican al próximo deploy).

### 4. Primer arranque

Entrá a la URL. Los datos de ejemplo (`seedIfEmpty`) se cargan solos la primera vez.
**El primer usuario que se registre recibe rol `admin`** — registrate vos antes de pasarle
el sitio al cliente, o hacelo con él.

Revisá también la sección **Notas** del `README.md` del proyecto: ahí están los pasos que
requieren acción humana (número de WhatsApp, textos legales, montos de las garantías,
clientes y medios reales en vez de los de ejemplo).

---

## Parte C — Supabase para "Compartir link" del Builder

Opcional. Sin esto el Builder funciona igual; solo queda oculto el botón **Compartir link**.

1. Creá el proyecto en Supabase y ejecutá `supabase/schema.sql` **del Builder** (crea la
   tabla `builder_projects`), igual que en la Parte B paso 1.
2. En Vercel, en el proyecto del Builder → **Settings → Environment Variables**:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | `https://abcdefgh.supabase.co` |
   | `SUPABASE_SERVICE_KEY` | `eyJhbGciOi...` (la service_role) |

3. **Deployments → ⋯ → Redeploy**.

Ahora el botón **Compartir link** aparece en el topbar: guarda la config, copia una URL
tipo `https://tu-builder.vercel.app/?p=fcfd3c4d3e`, y quien la abra ve el Builder con esa
configuración ya cargada (marca, colores, módulos, infraestructura). Ideal para mandarle
una propuesta armada a un cliente.

**Seguridad:** la service key solo vive en las env vars del servidor; el navegador nunca
la ve. La tabla tiene RLS activado, así que la clave pública (`anon`) no puede leerla.
El endpoint valida cada config **generándola** antes de guardar: si no genera, no entra.

---

## Verificación

Contra el Builder publicado (reemplazá la URL):

```powershell
# catálogo de módulos (hoy son 210: 100 de interfaz y 110 funcionales)
curl https://tu-builder.vercel.app/api/modules

# export directo por API (descarga un proyecto completo)
curl -X POST https://tu-builder.vercel.app/api/export `
  -H "Content-Type: application/json" `
  -d '{"config":{"brand":{"name":"Prueba"},"modules":["hero","contact"]}}' `
  -o prueba.zip
```

Y en el navegador: preview en vivo, export, y —si configuraste Supabase— compartir un
link y abrirlo en una ventana de incógnito.

Contra un proyecto generado publicado:

```powershell
# una ruta pública de cualquier módulo funcional debe responder 200 con JSON
curl https://tu-sitio.vercel.app/api/servicios
```

---

## Problemas típicos

| Síntoma | Causa | Solución |
|---|---|---|
| Catálogo de módulos vacío en producción | Falta `includeFiles` en `vercel.json` | Ya está en el repo; si lo editaste, restauralo y volvé a publicar |
| "Compartir link" no aparece | Env vars sin configurar o sin redeploy | Parte C, pasos 2–3 |
| 503 al guardar proyecto | `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` mal copiadas | Verificá que sea la **service_role**, no la `anon` |
| Error de Supabase al guardar | No corriste `supabase/schema.sql` | Parte B paso 1 / Parte C paso 1 |
| El sitio generado pierde los datos entre deploys | Se exportó con persistencia JSON | Regenerá desde el Builder eligiendo **Vercel + Supabase** |
| El panel admin dice que necesitás cuenta de administrador | Todavía no se registró nadie, o tu usuario no es el primero | El primer registrado es `admin`; desde Gestión de usuarios se puede promover a otro |
| Export lento la primera vez | Cold start de la función serverless | Normal en plan gratuito (~1–2 s); después responde al toque |
| La base de Supabase dejó de responder | Se pausa tras 7 días sin uso en el plan Free | Entrar al dashboard la reactiva |

## Límites del plan gratuito (sobrados para este caso)

- **Vercel Hobby:** 100 GB-hs de funciones/mes, respuestas hasta 4,5 MB (los ZIP del
  Builder pesan 10–70 KB), dominios `.vercel.app` gratis o dominio propio.
- **Supabase Free:** 500 MB de base (cada proyecto guardado pesa ~2 KB → cientos de miles
  de proyectos), pausa la base tras 7 días sin uso.

## Dominio propio

Vercel → **Settings → Domains** → agregá `builder.tudominio.com` (o el dominio del cliente
para su sitio) y creá el CNAME que te indica en tu DNS. HTTPS automático, costo $0 (solo el
dominio que ya tengas).

Si el proyecto usa los módulos de SEO o RSS, cargá ese mismo dominio en el campo **Dominio**
del Builder antes de exportar: es el que usan para armar las URLs absolutas del `sitemap.xml`,
las metas canónicas y el feed.
