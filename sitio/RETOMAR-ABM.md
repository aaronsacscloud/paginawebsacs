# Retomar el motor ABM

Estado al **22-sep-2026**. Las REGLAS viven en `MANUAL-PROSPECCION-ABM.md`;
esto es solo dónde quedó la cosa y qué sigue.

---

## Lo primero que hay que mirar

```sql
-- 1 · ¿hay saldo de IA? (si no, todo sale con la plantilla cruda)
select ok, count(*) from ia_uso where created_at > now() - interval '1 hour' group by 1;

-- 2 · ¿cuántos correos están atorados sin firma?
select estado, count(*), count(distinct cuenta_id) from abm_toques where canal='email' group by 1;

-- 3 · ¿qué está encendido?
select clave, valor from abm_config where clave in ('pausado','wa_frio_giros','tope_diario');
select clave, activa from wa_automatizaciones where clave = 'abm_frio';
```

---

## Dónde quedó (22-sep)

| | |
|---|---|
| Cuentas en la base | 32,069 · **3,078 listas** en México |
| Correos enviados | **140** (130 entregados, **8 rebotes = 5.7%**) |
| Aperturas / clics / respuestas | **0 / 0 / 0** |
| En cola aprobados | 1,376 correos · 187 cuentas |
| **En borrador SIN FIRMA** | **1,145 correos · 142 cuentas** ← no sale ninguno |
| Motor de correo | encendido (`pausado='no'`, tope 320/día) |
| WhatsApp en frío | **apagado** (`abm_frio=false` y `wa_frio_giros` vacía) |
| Saldo de Anthropic | **agotado** |

**Las 0 aperturas no son un error de medición**: `sinRastreo` apaga el píxel en
los tres primeros correos y casi ninguna cuenta ha pasado del tercero. Hasta que
alguien llegue al correo 4 no se puede medir nada — y de eso dependen la cola de
llamada (pide 3 aperturas), la pieza visual y el puntaje de intención.

---

## Las tres decisiones que están esperando

### 1 · Firmar los 1,145 borradores

Se regeneraron 134 cadencias con IA y el guion nuevo, pero salen en `borrador`.
Los originales los firmaba Andrea (founder) porque ella encendió los goteos.
**Mientras no se firmen, esas 142 cuentas no reciben nada.**

Recomendación: firmar **solo mayoristas y novias** (20 cuentas), que salieron
bien — 88% y 66% de cuerpos únicos. Calzado y marcas no, por lo de abajo.

### 2 · Enriquecer marcas y calzado ANTES de regenerarlos

Medido, y es la causa de todo lo demás:

| giro | cuentas | sitio | redes | Maps |
|---|---|---|---|---|
| **marcas** | 397 | **0** | **0** | **0** |
| **calzado** | 488 | 117 | 47 | 41 |
| mayoristas | — | — | — | tiene **persona** → 88% únicos |
| novias | — | — | — | tiene **señal y sucursales** → 66% únicos |

Marcas viene del padrón de Intermoda: nombre, ciudad y correo, nada más. **La IA
no puede escribir distinto porque no hay información.** Ningún ajuste de prompt
lo arregla; gastar en regenerarlos otra vez sería pagar por sinónimos.

La salida: pasar esas ~844 cuentas por `/api/cron/abm-maps` (~$14 de Google, 200
al día por el cron o en tandas a mano), y después el raspado de sitios.

### 3 · El remitente compartido con las facturas

`abm_config.tenant_slug='sacs'` → el frío sale por `aaron@news.sacscloud.com`,
el mismo de las facturas. En SendGrid una queja de spam suprime a nivel de
CUENTA. Fue decisión del dueño el 13-sep; queda señalado, no resuelto.

---

## Lo que se hizo y NO hay que rehacer

**Datos y base**
- 39 cuentas de seguridad industrial fuera de los giros de moda (a
  `seguridad_industrial`, no borradas: es otro mercado).
- 436 departamentales y franquicias a `no_contactar` (Liverpool ×16, Vans,
  Levi's…). El patrón va anclado al inicio del nombre: como subcadena se llevaba
  «Bordados Levi's» y «Confecciones Mazara».
- Las 32,069 recalificadas con la fórmula viva. Antes había 18,154 con
  `encaje+accesibilidad`, de migraciones que copiaron la fórmula a mano.

**Cadencia y textos**
- Ritmo comprimido de 33 a **26 días** (`1,3,5,8,12,16,21,26`), 60 cadencias.
- Los 27 giros con cadencia completa de 8 correos + 3 WhatsApp.
- Calzado, marcas y mayoristas reescritos en **la voz de novias** (manual
  §7.6 bis): abrir por el negocio de ellos, nombrar personas, conceder antes de
  contradecir, cerrar con pregunta corta, y del correo 2 en adelante no decir
  «Sacs». Se mide así:

```sql
select giro, count(*) filter (where cuerpo like '%Sacs%') mencionan_producto,
       count(*) filter (where btrim(cuerpo) like '%?') cierran_preguntando
from abm_plantillas where canal='email' and activa and orden between 2 and 7 group by 1;
```

**Arreglos de motor** (ver el manual §11 y §11 bis/ter/quater/quinquies)
- El WhatsApp en frío tenía cinco puertas abiertas: sin filtro de país, horario
  de CDMX para todos, tope que no topaba, se saltaba el freno de calidad de la
  línea, y el disyuntor no lo apagaba.
- Una baja ahora detiene la cadencia entera, no solo ese correo.
- Un autorespondedor de WhatsApp ya no cuenta como respuesta.
- Un clic ya no cancela la cadencia (se perdía al prospecto más caliente).
- Auth de los 10 crons: exige rol de casa, no cualquier sesión.
- El correo no sale si el cuerpo trae marcas de plantilla o «cicatriz» de una
  variable vacía (`..`, `:.`).

---

## Números para dimensionar

- Regenerar una cadencia con IA: **~$0.06**. Las 134 costaron **$8.61**.
- A 40 cuentas nuevas al día, el motor consume **~$2.50 diarios** (~$75/mes).
  Abrir los 22 giros restantes sube en proporción.
- Enriquecer por Maps: **~$0.017 por cuenta**.

---

## La trampa en la que se cayó cuatro veces el mismo día

**Arreglar la plantilla NO arregla lo que ya está en la cola.** El cuerpo de un
toque se congela al generar. Después de tocar una plantilla o una regla, siempre
las dos preguntas: *¿y lo que ya está agendado?* y *¿a cuántos aplicaba el
problema contra a cuántos llegó el arreglo?*
