# Los países del barrido por país (§13 del manual ABM). Un solo lugar para el
# `gl` de Maps, la LADA, cómo se reconoce un móvil y las ciudades a barrer.
# El espejo del lado del CRM es sitio/src/lib/crm/abm-paises.ts: si se cambia
# algo aquí (LADA, largo del móvil), se cambia allá.
#
# Ciudades: las capitales y las plazas donde hay mercado de vestidos de novia
# y fiesta (no las 92 de México: allá el barrido es nacional; aquí se busca
# volumen suficiente para una cadencia, no el censo del país).
import re

PAISES = {
 'co': dict(nombre='Colombia', gl='CO', lada='57', movil=r'^3\d{9}$', largos={10}, moneda='cop',
   ciudades=['Bogotá','Medellín','Cali','Barranquilla','Cartagena','Bucaramanga','Pereira','Cúcuta','Manizales','Santa Marta','Ibagué','Villavicencio']),
 'cl': dict(nombre='Chile', gl='CL', lada='56', movil=r'^9\d{8}$', largos={9}, moneda='clp',
   ciudades=['Santiago','Providencia','Las Condes','Viña del Mar','Valparaíso','Concepción','La Serena','Antofagasta','Temuco','Rancagua']),
 'ar': dict(nombre='Argentina', gl='AR', lada='54', movil=r'^9?\d{10}$', largos={10,11}, moneda='ars',
   ciudades=['Buenos Aires','Palermo Buenos Aires','Córdoba','Rosario','Mendoza','La Plata','Mar del Plata','Tucumán','Salta','Santa Fe']),
 'pe': dict(nombre='Perú', gl='PE', lada='51', movil=r'^9\d{8}$', largos={8,9}, moneda='pen',
   ciudades=['Lima','Miraflores Lima','San Isidro Lima','Arequipa','Trujillo','Chiclayo','Piura','Cusco','Huancayo']),
 'ec': dict(nombre='Ecuador', gl='EC', lada='593', movil=r'^9\d{8}$', largos={8,9}, moneda='usd',
   ciudades=['Quito','Guayaquil','Cuenca','Ambato','Manta','Machala','Loja']),
 'cr': dict(nombre='Costa Rica', gl='CR', lada='506', movil=r'^[678]\d{7}$', largos={8}, moneda='usd',
   ciudades=['San José','Escazú','Heredia','Alajuela','Cartago','Santa Ana']),
 'pa': dict(nombre='Panamá', gl='PA', lada='507', movil=r'^6\d{7}$', largos={7,8}, moneda='usd',
   ciudades=['Ciudad de Panamá','San Francisco Panamá','Chitré','David Chiriquí','Santiago de Veraguas']),
 'uy': dict(nombre='Uruguay', gl='UY', lada='598', movil=r'^9\d{7}$', largos={8}, moneda='usd',
   ciudades=['Montevideo','Punta del Este','Maldonado','Salto','Paysandú']),
 'do': dict(nombre='República Dominicana', gl='DO', lada='1', movil=r'^(809|829|849)\d{7}$', largos={10}, moneda='usd',
   ciudades=['Santo Domingo','Santiago de los Caballeros','Punta Cana','La Romana','San Pedro de Macorís','Puerto Plata']),
 'gt': dict(nombre='Guatemala', gl='GT', lada='502', movil=r'^[345]\d{7}$', largos={8}, moneda='usd',
   ciudades=['Ciudad de Guatemala','Zona 10 Guatemala','Mixco','Quetzaltenango','Antigua Guatemala','Escuintla']),
}

# Las consultas del giro novias: las mismas cuatro en todos los países, en
# español neutro (en ningún país se dice «XV años» más que en México).
STEMS = {
 'novias': ['vestidos de novia', 'tienda de vestidos de novia', 'vestidos de fiesta', 'vestidos de 15 años'],
}

def e164(bruto, iso):
    """Un teléfono crudo de Maps → '+<lada><nacional>' o None. Nunca adivina:
    quita el prefijo internacional, el 0 de troncal y el «15» argentino; si lo
    que queda no tiene un largo válido en ese país, se descarta (sin teléfono
    la cuenta se elimina, igual que en México)."""
    p = PAISES[iso]
    s = (bruto or '').strip()
    d = re.sub(r'\D', '', s)
    if not d: return None
    internacional = s.startswith('+') or d.startswith('00')
    if d.startswith('00'): d = d[2:]
    if internacional or (d.startswith(p['lada']) and len(d) - len(p['lada']) in p['largos']):
        if not d.startswith(p['lada']): return None
        d = d[len(p['lada']):]
    if iso != 'do': d = d.lstrip('0')
    if iso == 'ar':
        # Móvil: «11 15 1234-5678» (el 15 tras el área) o ya con el 9 delante
        # (+54 9 11 …). Se guarda 9 + área + número, que es como marca WhatsApp.
        m = re.match(r'^(\d{2,4})15(\d{6,8})$', d)
        if m: d = '9' + m.group(1) + m.group(2)
    if len(d) not in p['largos']: return None
    return '+' + p['lada'] + d

def es_movil(e, iso):
    p = PAISES[iso]
    if not e: return False
    n = e[len('+' + p['lada']):]
    return bool(re.match(p['movil'], n))
