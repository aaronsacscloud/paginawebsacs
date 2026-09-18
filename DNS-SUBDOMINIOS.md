# Los subdominios de `*.sacscloud.com` — qué hacer y por qué

**Esto NO se arregla desde este repo.** `*.sacscloud.com` apunta por DNS
comodín a `35.232.19.166`, un Apache que sirve «Facturacion SACS». Hay que
entrar a ESE servidor.

Cualquier subdominio inventado responde **200** con esa página. Probado:
`globosilusionn`, `dev`, `ww` — los tres devuelven lo mismo, sin `noindex`, sin
canonical, con el título «Facturacion SACS».

## Qué está costando hoy (Search Console, 16 meses)

| Host | Páginas | Impresiones | Clics |
|---|---|---|---|
| **www**.sacscloud.com | 77 | 98,095 | 3,834 |
| **app**.sacscloud.com | 2 | 24,428 | 10,502 |
| middle · front · tienda | 15 | 19,786 | 452 |
| **ww**.sacscloud.com | 1 | 1,747 | 124 |
| retailersextraordinarios | 1 | 690 | 0 |
| **dev**.sacscloud.com | 1 | 605 | 3 |
| globosilusionn · novedadesmene · alphaomega · bikemarket · tds | 5 | 1,118 | 3 |

Lo que esto le dice a Google y a una IA: que `sacscloud.com` es un dominio con
decenas de hosts que sirven la misma página de facturación. Eso reparte la
señal del dominio entre hosts que no venden nada.

## Los cuatro cambios, en orden de lo que pesa

### 1. `ww.sacscloud.com` → 301 a `www` (lo más barato)

Son 1,747 impresiones y **124 clics** de gente que se equivocó de tecla y llegó
a una página de facturación en vez de al sitio.

```apache
<VirtualHost *:443>
    ServerName ww.sacscloud.com
    Redirect permanent / https://www.sacscloud.com/
</VirtualHost>
```

### 2. `dev.sacscloud.com` → fuera del índice

605 impresiones de un entorno de desarrollo abierto a Google. Lo correcto es
contraseña; el mínimo es `noindex` **por cabecera**, que no depende de que
alguien edite el HTML:

```apache
<VirtualHost *:443>
    ServerName dev.sacscloud.com
    Header always set X-Robots-Tag "noindex, nofollow"
    # Mejor todavía, si se puede:
    # <Location />
    #     AuthType Basic
    #     AuthName "Dev"
    #     Require valid-user
    # </Location>
</VirtualHost>
```

### 3. El comodín: que lo desconocido dé 404, no 200

Es la raíz de todo lo demás. Hoy cualquier subdominio que alguien invente —o que
Google descubra en un enlace viejo— responde 200 con contenido. Un
`VirtualHost` por defecto que devuelva 404 corta eso de golpe:

```apache
# PRIMER VirtualHost del archivo: Apache usa el primero como predeterminado
# para cualquier host que no coincida con ningún ServerName.
<VirtualHost *:443>
    ServerName _catchall
    Header always set X-Robots-Tag "noindex, nofollow"
    RedirectMatch 404 ^/
</VirtualHost>
```

⚠️ **Antes de aplicarlo:** listar los subdominios que SÍ se usan y darles su
propio `VirtualHost`. Si alguno queda fuera, deja de funcionar. Al menos estos
están vivos en Search Console: `app`, `middle`, `front`, `tienda`, y las tiendas
de clientes.

### 4. Las tiendas de clientes — decisión de negocio, no técnica

`globosilusionn`, `novedadesmene`, `alphaomega`, `bikemarket`, `tds` y
`retailersextraordinarios` son tiendas de clientes viviendo en `*.sacscloud.com`.
Suman 1,808 impresiones y **3 clics**.

Hay dos caminos y conviene elegir a conciencia:

**A. `noindex` (lo que pidió el dueño).** Sale del índice lo que no vende nada
nuestro y deja de repartir la señal del dominio.

```apache
Header always set X-Robots-Tag "noindex, nofollow"
```

**B. Dominio propio para cada tienda.** Es mejor para el cliente —su tienda con
su marca— y quita el problema de raíz. Cuesta más: hay que soportar dominios
propios en la plataforma.

**Lo que NO conviene** es dejarlas indexadas como están: 3 clics en 16 meses no
es tráfico, y cada una diluye lo que Google entiende por «sacscloud.com».

⚠️ Antes de poner `noindex` a una tienda de cliente, avísale. Es su tienda: si
alguno la está promocionando, el `noindex` le quita algo que él cree tener.

## Cómo comprobar que quedó

```bash
# debe dar 301 a www
curl -sI https://ww.sacscloud.com/ | head -1

# debe traer X-Robots-Tag: noindex
curl -sI https://dev.sacscloud.com/ | grep -i x-robots-tag

# un subdominio inventado debe dar 404
curl -s -o /dev/null -w '%{http_code}\n' https://esto-no-existe.sacscloud.com/
```

Y en Search Console, pedir la retirada temporal de las URLs de `dev` y de las
tiendas que se pongan en `noindex`: el `noindex` tarda semanas en aplicarse solo.
