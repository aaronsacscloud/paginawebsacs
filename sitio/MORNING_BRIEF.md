# Morning Brief — Partner Embajador System

Buenos días. Mientras dormías shipeé los TIERS A, B, C, E y F del plan de
completación del sistema partner. Todo está en producción en
`https://www.sacscloud.com`.

## ⚡ TL;DR — 9 deploys consecutivos

| Tier | Commit | Qué se añadió |
|---|---|---|
| A | `6ff8ece` | CRM "Comisiones" tab + bulk pay + emails earned/paid |
| B | `f1a0af0` | Welcome banner + empty states + firma + toast en vivo |
| C | `741b717` | Brand kit: 6 verticales × 4 ángulos de contenido |
| E | `a5d9f0a` | Atribución correcta + Stripe fallback + auto slug |
| F | `7c4e0ec` | /partners landing pública + form de aplicación |
| F+ | `de8b733` | Email confirmación al aplicante |
| H | `ed62cef` | Hardening: rate limit + spam + size limits en /apply |
| I | `4dee5ac` | dashboard.ts atribución + JSON-LD SEO en /partners |

Todos los `npm run build` pasaron limpio. Todos los `vercel --prod` desplegaron
sin errores. **No se aplicó ninguna nueva migración SQL** — tu schema sigue
igual al de anoche.

## 📋 Lo más importante para que pruebes

### 1. Nueva landing pública del programa
Visita https://www.sacscloud.com/partners (en lugar del viejo "Coming soon"):
- Hero + stats grandes
- 4 pasos del proceso
- 3 tipos de partnership
- Form de aplicación que funciona
- FAQ con 6 preguntas

**Test rápido:** llena el form con tu email — debe llegar email de confirmación
+ aparecer un nuevo `partner_invitations` en draft en CRM admin.

### 2. CRM "Comisiones" — nueva tab
Abre `/admin/crm` → sidebar izquierdo, sección "Partners" → tab nueva
**"Comisiones"**. Ahí puedes:
- Ver todas las commissions (filter: status, tipo, búsqueda)
- Aprobar bonos pending → earned (envía email automático al partner)
- Pagar individual con referencia
- **Bulk pay**: select múltiples earned del MISMO partner → "Pagar N" con
  referencia única (un payout = una commission paid email al partner)
- Cancelar commissions pending/earned con motivo
- Export CSV

### 3. Portal del partner — mejoras
Si entras a `/partner/portal` con la cuenta de prueba:
- Banner de bienvenida primera visita (con cookie de dismissal)
- Empty states bonitos cuando no hay actividad
- Tab "Mi link": ahora con WhatsApp/Email/Twitter/LinkedIn/QR + 4
  plantillas copy-paste por contexto
- Tab "Mi perfil": ahora muestra tu firma digital + fechas
- Toast en vivo cuando el admin aprueba un bono (polling 60s)

### 4. Brand kit — nuevas ideas por vertical
`/partners/brand-kit` ahora tiene una sección **"06 · Ideas por vertical"**
con cards para 6 giros (moda, farmacia, restaurantes, ferretería, belleza,
abarrotes). Cada uno con pains típicos + 4 ángulos de contenido + hashtags.

## 🔗 Atribución end-to-end ahora funciona

El flow completo está cerrado:

1. Partner comparte `/p/{slug}` → cookie `sacs_ref` 90d
2. Visitante llena prueba gratis → `contact.referrer_partner_id` set
   → bono $500 pending creado
3. Visitante reserva demo → `booking.referrer_partner_id` set
   (BookingPage ahora lee la cookie y la envía)
4. Admin marca demo realizada → bono $300 earned + email al partner
5. Admin verifica bono prueba_gratis → earned + email al partner
6. Cliente cierra venta → `deal.referrer_partner_id` heredado del contact
   → commission al partner correcto (no al owner)
7. Stripe webhook marca earned (con fallback que crea commission si falta)
8. Admin paga vía CRM → email al partner con desglose

## 🧪 Smoke test sugerido

```
1. Aprobar a un partner de prueba en CRM (con tu email)
2. Setear contraseña desde el email "Bienvenido"
3. Login → /partner/portal → ver welcome banner
4. Ir a "Mi link" → copiar tu URL
5. Abrir incógnito → /p/{slug} → cookie set
6. Click "prueba gratis" → llenar form (otro email)
7. Vuelve al portal → debe aparecer 1 lead + bono pending $500
8. CRM → Comisiones → "Aprobar" → debe llegar email al partner
   → portal: toast aparece + bono pasa a earned
9. CRM → Comisiones → seleccionar la earned → "Pagar 1" con referencia
   → email al partner
10. Portal: aparece en tab "Pagos" con desglose
```

## ⏭️ Pendientes (no urgentes)

- **D**: Detail drawer per-partner en CRM (nice-to-have)
- **E4**: Soft-delete partner con estado=paused (bajo valor)
- **Testimoniales reales** en /partners (necesitas darme contenido)
- **Provisión Fideliza automática** vía API de app.sacscloud.com (cross-repo)
- **WhatsApp notifications** cuando Kapso esté listo

## 🛠️ Si algo no anda

Comandos útiles:
```bash
cd /Users/anonimoanonimo/paginawebsacs/sitio
git log --oneline -10        # ver últimos commits
vercel ls                    # ver deploys recientes
npm run build                # verificar build local
```

Plan completo en: `~/.claude/plans/partner-embajador-completion.md`

— Claude (sesión nocturna 03-may)
