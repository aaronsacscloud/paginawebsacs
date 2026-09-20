# Los tres subdominios: la decisión y los pasos

Medido el 19-sep-2026.

## Lo que hay hoy

| Subdominio | Qué sirve | Título indexado | robots.txt | Contenido sin JavaScript |
|---|---|---|---|---|
| `app.sacscloud.com` | la aplicación | «Sacscloud» | devuelve HTML, no reglas | pantalla de login |
| `facturacion.sacscloud.com` | portal de facturación | «Facturacion SACS» | **404** | **2 palabras** |
| `mi.sacscloud.com` | **el mismo portal, byte por byte** | «Facturacion SACS» | **404** | **2 palabras** |

Los dos últimos devuelven exactamente el mismo HTML (mismo md5) y ninguno declara
canónica hacia el otro: para Google son dos páginas duplicadas, y además vacías.

## La decisión

**1. Portal de facturación: una sola dirección y fuera del índice.**
Nadie te descubre buscando ese portal; el cliente llega por el enlace de su
ticket o desde el sistema. Y lo que Google tiene indexado es una página en
blanco que solo rankea por la marca.

- Redirección permanente (301) de `mi.sacscloud.com` a `facturacion.sacscloud.com`.
- En el Apache que los sirve (35.232.19.166, no es el servidor de desarrollo),
  cualquiera de estas dos:
  - un `robots.txt` en la raíz con `User-agent: *` y `Disallow: /`, o
  - en el virtual host: `Header set X-Robots-Tag "noindex, nofollow"`.
- La cabecera es mejor que el robots.txt: `Disallow` impide rastrear pero NO
  saca del índice lo ya indexado; `X-Robots-Tag: noindex` sí lo saca, porque
  Google tiene que poder entrar para leer la instrucción.

**2. La aplicación: primero el camino nuevo, después el noindex.**
Aquí sí hay gente buscando entrar a su cuenta. Sacarla del índice sin darles a
dónde ir los deja colgados. El orden importa:

- **Ya hecho en el sitio principal:** la página `/entrar`, que lleva al login y
  resuelve las dudas con las que llega quien busca «entrar a sacscloud». Vive en
  el dominio que sí controlamos y entra al sitemap. Redirecciones desde `/login`,
  `/acceso` e `/iniciar-sesion`.
- **Falta en `sacs3` (repo de la aplicación, deploy manual `firebase deploy`):**
  en `index.html`, dentro del `<head>`:

```html
<meta name="robots" content="noindex, nofollow" />
```

  o, sin tocar archivos del build, en `firebase.json` dentro de `hosting.headers`:

```json
{ "source": "**", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] }
```

  No lo apliqué: ese deploy reconstruye la aplicación de producción entera y el
  repo local está 11 commits atrás con trabajo sin commitear de otra sesión.

## Después de aplicarlo

Los cambios solo evitan rastreos nuevos y, con `X-Robots-Tag`, la salida del
índice en el siguiente paso de Google (semanas). Para que sea en días, pide la
retirada en Search Console de cada propiedad.
