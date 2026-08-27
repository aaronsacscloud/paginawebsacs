# 📘 Wiki — Cómo el CRM le avisa a TikTok qué leads sirvieron

**Para:** el equipo de ventas.
**Objetivo:** entender por qué mover la etapa de un lead en el CRM es parte del trabajo
comercial y no un trámite administrativo, y qué pasa exactamente cuando lo haces.

---

## 1. El problema que esto resuelve

TikTok sabe **cuántos formularios se llenaron**. No sabe **cuáles sirvieron**.

Con esa información a medias, su algoritmo optimiza por lo único que puede medir: la
cantidad. Entrega los leads más baratos de conseguir, que casi nunca son los que compran.

El dato que le falta lo tenemos nosotros, en el CRM. Cuando un lead se vuelve cliente,
solo nosotros lo sabemos. Devolvérselo es lo que le enseña a distinguir un lead bueno de
uno barato — y lo que hace que la misma inversión traiga mejores prospectos.

> Antes de esto: 76 leads de TikTok, 4 se volvieron clientes, y TikTok no sabía de ninguno.

---

## 2. Lo único que tienes que hacer

**Mover la etapa del lead en el CRM.** Nada más.

📍 *Dónde:* CRM → **Leads** → columna **ETAPA** → clic en la pastilla → eliges la etapa.

Todo lo demás es automático. No hay que tocar hojas de cálculo, ni TikTok, ni avisarle a
nadie.

---

## 3. Las tres etapas que sí le dicen algo a TikTok

| Etapa en el CRM | Lo que TikTok recibe | Qué significa para el algoritmo |
|---|---|---|
| **Calificado** | `Qualified` | «Este lead sí era del perfil» |
| **Oportunidad** | `Opportunity` | «Este iba en serio» |
| **Cliente** | `Converted` + el monto | «Este compró, y por esto» |

Las demás etapas **no se reportan**, y es a propósito:

- **Nuevo lead** es el estado en que TikTok ya lo entregó. Decírselo no le enseña nada y
  le quita peso a las señales que sí importan.
- **Perdido** tampoco se manda. TikTok optimiza hacia lo que le señalas, no en contra.

**El monto solo viaja con «Cliente»**, y sale de su suscripción. Es lo que hace que TikTok
persiga clientes grandes en vez de clientes cualesquiera. Si el cliente no tiene
suscripción registrada, se reporta la conversión sin monto — nunca en cero, porque un cero
le enseñaría que esa venta no valió nada.

---

## 4. La cadena completa

```
Cambias la etapa en el CRM
        ↓   al instante
Queda registrado con la fecha real del cambio
        ↓   cada 3 horas
Se escribe en el Google Sheet que TikTok tiene conectado
        ↓   cada ~10 minutos
TikTok lo recibe y lo usa para optimizar
```

En total, entre que mueves la etapa y TikTok se entera pasan **entre 10 minutos y 3 horas**.

---

## 5. Por qué importa CUÁNDO lo mueves

**Mueve la etapa cuando pasa, no en lote a fin de mes.**

TikTok solo acepta conversiones de los **últimos 28 días**. Una venta reportada al día 29
se descarta: para efectos del algoritmo, nunca ocurrió.

Ya nos pasó. Tres clientes que sumaban **$53,240 de ARR** estuvieron a punto de quedar
fuera porque su etapa se movió semanas después de la venta.

El sistema usa la **fecha real del cambio de etapa**, no la del día en que corre el
proceso. Así que si mueves la etapa tarde, se reporta tarde — con la fecha en que la
moviste, no con la de la venta.

---

## 6. Cómo saber si está funcionando

📍 *Dónde:* TikTok Ads Manager → **Tools** → **Events Manager** → dataset **TIKTOK AGENDAS**.

Hay una barra de progreso con cuatro pasos:

```
Dataset created → CRM connected → Events received → Funnel created
```

✅ *Qué debe pasar:* si estamos reportando bien, la barra llega a **«Events received»**.
Si se queda en «CRM connected», TikTok no está recibiendo nada y hay que revisar.

---

## 7. Qué NO hacer

- **No edites la columna «TikTok Lead Status» del Google Sheet a mano.** La escribe el
  sistema; lo que pongas ahí se sobrescribe en la siguiente corrida.
- **No muevas etapas para «probar».** Cada envío cuenta como una conversión del lado de
  TikTok. Marcar a alguien como cliente y luego regresarlo no deshace la señal.
- **No dejes leads muertos en «Nuevo lead».** No causa daño, pero desperdicia la única
  oportunidad de enseñarle algo al algoritmo sobre ese perfil.

---

## 8. Límites que conviene conocer

| Límite | Consecuencia práctica |
|---|---|
| TikTok guarda los leads **90 días** | Un lead de hace más de 3 meses ya no existe de su lado |
| Solo acepta conversiones de **28 días** | Mover la etapa tarde equivale a no moverla |
| Identifica por **correo, teléfono o Lead ID** | Un lead sin ninguno de los tres no se puede reportar |
| Se reporta **una vez por etapa** | Regresar y volver a avanzar no manda la señal dos veces |

---

## 9. Preguntas frecuentes

**¿Tengo que hacer algo en TikTok?**
No. Solo mover la etapa en el CRM.

**¿Y si me equivoco de etapa?**
Corrígela. La señal equivocada ya salió, pero la correcta también saldrá. No hay forma de
retirar una señal enviada, así que vale la pena mover la etapa cuando estés seguro.

**¿Esto sirve para leads que no vinieron de TikTok?**
No. Solo se reportan los que llegaron por un anuncio de TikTok. Los demás se ignoran.

**¿Cuánto tarda en notarse en el rendimiento de la campaña?**
El algoritmo necesita volumen para aprender. Con unas pocas conversiones no cambia nada;
la diferencia aparece cuando hay decenas de señales acumuladas. Por eso importa que sea
un hábito y no un esfuerzo de una semana.

---

*Última actualización: 27 de agosto de 2026.*
