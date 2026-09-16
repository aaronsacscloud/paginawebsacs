# Los países del barrido por país (§13 del manual ABM). Un solo lugar para el
# `gl` de Maps, la LADA, cómo se reconoce un móvil y las ciudades a barrer.
# El espejo del lado del CRM es sitio/src/lib/crm/abm-paises.ts: si se cambia
# algo aquí (LADA, largo del móvil), se cambia allá.
#
# Ciudades: como en México (92 ciudades, no solo CDMX: León, Villa Hidalgo…),
# el barrido es por PROVINCIA —capitales de departamento/región/provincia,
# barrios comerciales de la capital y las plazas del ramo—. Regla del dueño
# (15-sep-2026): «considera provincias, no nada más el lugar principal».
import re

PAISES = {
 'co': dict(nombre='Colombia', gl='CO', lada='57', movil=r'^3\d{9}$', largos={10}, moneda='cop',
   ciudades=['Bogotá','Chapinero Bogotá','Usaquén Bogotá','Medellín','El Poblado Medellín','Cali','Barranquilla','Cartagena','Bucaramanga','Pereira','Cúcuta','Manizales','Santa Marta','Ibagué','Villavicencio','Pasto','Neiva','Armenia','Montería','Valledupar','Sincelejo','Popayán','Tunja','Riohacha','Florencia','Yopal','Quibdó','Chía','Soacha','Bello','Envigado','Itagüí','Palmira','Tuluá','Buga','Sogamoso','Duitama','Girardot','Barrancabermeja','Cartago Valle','Rionegro Antioquia','Apartadó','Fusagasugá','Zipaquirá']),
 'cl': dict(nombre='Chile', gl='CL', lada='56', movil=r'^9\d{8}$', largos={9}, moneda='clp',
   ciudades=['Santiago','Providencia','Las Condes','Ñuñoa','Maipú','Puente Alto','La Florida','San Bernardo','Viña del Mar','Valparaíso','Quilpué','Concepción','Talcahuano','La Serena','Coquimbo','Antofagasta','Calama','Iquique','Arica','Copiapó','Rancagua','Talca','Curicó','Chillán','Los Ángeles','Temuco','Valdivia','Osorno','Puerto Montt','Punta Arenas','Ovalle','Linares','Melipilla','Quillota','San Antonio Chile']),
 'ar': dict(nombre='Argentina', gl='AR', lada='54', movil=r'^9\d{10}$', largos={10,11}, moneda='ars',
   ciudades=['Buenos Aires','Palermo Buenos Aires','Recoleta Buenos Aires','Belgrano Buenos Aires','Flores Buenos Aires','Once Buenos Aires','Caballito Buenos Aires','Villa Crespo Buenos Aires','Quilmes','Lomas de Zamora','Morón','San Isidro Buenos Aires','Tigre','Pilar Buenos Aires','Lanús','Avellaneda','San Justo La Matanza','Ramos Mejía','Córdoba','Villa Carlos Paz','Río Cuarto','Villa María','Rosario','Santa Fe','Rafaela','Mendoza','San Rafael Mendoza','La Plata','Mar del Plata','Bahía Blanca','Tandil','Tucumán','Salta','Jujuy','Santiago del Estero','Catamarca','La Rioja Argentina','San Juan Argentina','San Luis Argentina','Neuquén','Paraná','Corrientes','Resistencia','Posadas','Formosa','Comodoro Rivadavia','Trelew','Río Gallegos','Ushuaia','Santa Rosa La Pampa','Viedma','Concordia','Gualeguaychú','Pergamino','Junín Buenos Aires','San Nicolás de los Arroyos','Zárate','Luján','Olavarría','Necochea']),
 'pe': dict(nombre='Perú', gl='PE', lada='51', movil=r'^9\d{8}$', largos={8,9}, moneda='pen',
   ciudades=['Lima','Miraflores Lima','San Isidro Lima','Surco Lima','La Molina Lima','San Borja Lima','Jesús María Lima','Los Olivos Lima','San Juan de Lurigancho','San Miguel Lima','Gamarra La Victoria Lima','Callao','Arequipa','Trujillo','Chiclayo','Piura','Cusco','Huancayo','Iquitos','Pucallpa','Tacna','Ica','Cajamarca','Huánuco','Ayacucho','Tarapoto','Puno','Juliaca','Huaraz','Chimbote','Sullana','Tumbes','Moquegua','Abancay','Chincha','Huacho','Cerro de Pasco','Huancavelica','Jaén Perú','Moyobamba']),
 'ec': dict(nombre='Ecuador', gl='EC', lada='593', movil=r'^9\d{8}$', largos={8,9}, moneda='usd',
   ciudades=['Quito','Norte de Quito','Valle de los Chillos','Cumbayá','Guayaquil','Samborondón','Durán','Cuenca','Ambato','Manta','Portoviejo','Machala','Loja','Santo Domingo de los Tsáchilas','Riobamba','Ibarra','Esmeraldas','Latacunga','Babahoyo','Quevedo','Milagro','Tulcán','Salinas Ecuador','Otavalo','Azogues','Guaranda','Puyo','Tena','Nueva Loja','Zamora Ecuador']),
 'cr': dict(nombre='Costa Rica', gl='CR', lada='506', movil=r'^[678]\d{7}$', largos={8}, moneda='usd',
   ciudades=['San José','Escazú','Santa Ana','Heredia','Alajuela','Cartago','Curridabat','Tibás','Moravia','Desamparados','Guadalupe Goicoechea','San Pedro Montes de Oca','Liberia Guanacaste','Puntarenas','Limón','Ciudad Quesada','Pérez Zeledón','Grecia','San Ramón','Turrialba','Nicoya','Jacó','Guápiles']),
 'pa': dict(nombre='Panamá', gl='PA', lada='507', movil=r'^6\d{7}$', largos={7,8}, moneda='usd',
   ciudades=['Ciudad de Panamá','San Francisco Panamá','Obarrio Panamá','El Cangrejo Panamá','Costa del Este','Bella Vista Panamá','Arraiján','La Chorrera','Colón','Chitré','David Chiriquí','Santiago de Veraguas','Penonomé','Las Tablas','Aguadulce','Bocas del Toro','Boquete','Changuinola']),
 'uy': dict(nombre='Uruguay', gl='UY', lada='598', movil=r'^9\d{7}$', largos={8}, moneda='usd',
   ciudades=['Montevideo','Pocitos Montevideo','Carrasco Montevideo','Centro Montevideo','Ciudad de la Costa','Las Piedras','Canelones','Punta del Este','Maldonado','San Carlos Maldonado','Salto','Paysandú','Rivera','Tacuarembó','Melo','Durazno','Colonia del Sacramento','Mercedes','Florida','Minas','San José de Mayo','Fray Bentos','Artigas','Rocha','Treinta y Tres','Trinidad Flores']),
 'do': dict(nombre='República Dominicana', gl='DO', lada='1', movil=r'^(809|829|849)\d{7}$', largos={10}, moneda='usd',
   ciudades=['Santo Domingo','Piantini Santo Domingo','Naco Santo Domingo','Santo Domingo Este','Santo Domingo Norte','Santo Domingo Oeste','Santiago de los Caballeros','Punta Cana','Bávaro','La Romana','San Pedro de Macorís','Puerto Plata','San Cristóbal','La Vega','San Francisco de Macorís','Higüey','Moca','Bonao','Baní','San Juan de la Maguana','Barahona','Azua','Nagua','Mao','Cotuí','Hato Mayor','El Seibo','Jarabacoa','Constanza','Sosúa']),
 'gt': dict(nombre='Guatemala', gl='GT', lada='502', movil=r'^[345]\d{7}$', largos={8}, moneda='usd',
   ciudades=['Ciudad de Guatemala','Zona 10 Guatemala','Zona 14 Guatemala','Zona 1 Guatemala','Zona 11 Guatemala','Mixco','Villa Nueva','San Miguel Petapa','Santa Catarina Pinula','Quetzaltenango','Antigua Guatemala','Escuintla','Huehuetenango','Cobán','Chiquimula','Mazatenango','Retalhuleu','Jutiapa','Zacapa','Chimaltenango','Sololá','Puerto Barrios','Totonicapán','Jalapa','San Marcos Guatemala','Salamá','Santa Cruz del Quiché','Flores Petén','Amatitlán','Coatepeque']),
 'es': dict(nombre='España', gl='ES', lada='34', movil=r'^[67]\d{8}$', largos={9}, moneda='eur',
   ciudades=['Madrid','Salamanca Madrid','Chamberí Madrid','Chamartín Madrid','Alcalá de Henares','Móstoles','Fuenlabrada','Leganés','Getafe','Alcorcón','Alcobendas','Pozuelo de Alarcón','Majadahonda','Torrejón de Ardoz','Barcelona','Eixample Barcelona','Sarrià Barcelona','Gràcia Barcelona','Hospitalet de Llobregat','Badalona','Terrassa','Sabadell','Mataró','Igualada','Granollers','Manresa','Vic','Sitges','Girona','Figueres','Lleida','Tarragona','Reus','Valencia','Ruzafa Valencia','Torrent','Gandía','Alcoy','Alicante','Elche','Elda','Torrevieja','Benidorm','Orihuela','Castellón de la Plana','Vila-real','Sevilla','Dos Hermanas','Utrera','Écija','Málaga','Marbella','Fuengirola','Vélez-Málaga','Antequera','Córdoba','Lucena','Granada','Motril','Almería','El Ejido','Jaén','Linares','Úbeda','Cádiz','Jerez de la Frontera','Algeciras','San Fernando Cádiz','Chiclana','Ubrique','Huelva','Zaragoza','Huesca','Teruel','Murcia','Cartagena','Lorca','Molina de Segura','Palma de Mallorca','Ibiza','Manacor','Inca Mallorca','Las Palmas de Gran Canaria','Santa Cruz de Tenerife','San Cristóbal de La Laguna','Arrecife','Puerto del Rosario','Bilbao','Getxo','Barakaldo','Donostia San Sebastián','Irún','Vitoria-Gasteiz','Pamplona','Tudela','Logroño','Santander','Torrelavega','Oviedo','Gijón','Avilés','A Coruña','Santiago de Compostela','Ferrol','Vigo','Pontevedra','Ourense','Lugo','Valladolid','Burgos','León','Ponferrada','Salamanca','Zamora','Palencia','Ávila','Segovia','Soria','Toledo','Talavera de la Reina','Guadalajara','Cuenca','Albacete','Ciudad Real','Puertollano','Badajoz','Mérida','Cáceres','Plasencia','Ceuta','Melilla']),
}

# Las consultas del giro novias: las mismas cuatro en todos los países, en
# español neutro (en ningún país se dice «XV años» más que en México).
STEMS = {
 'novias': ['vestidos de novia', 'tienda de vestidos de novia', 'vestidos de fiesta', 'vestidos de 15 años'],
}
# España no tiene quince años: ahí la cuarta consulta es la madrina y la
# invitada (la boda es la temporada; comunión es otro giro).
STEMS_PAIS = {
 'es': {'novias': ['vestidos de novia', 'tienda de novias', 'vestidos de fiesta', 'vestidos de madrina e invitada']},
}
# La consulta lleva apellidos para que Maps no se confunda («Jaén Perú»,
# «Zona 10 Guatemala», «Cartago Valle»); en el correo la ciudad va limpia.
ALIAS_CIUDAD = {'Cartago Valle': 'Cartago', 'Trinidad Flores': 'Trinidad', 'Santa Rosa La Pampa': 'Santa Rosa',
 'San Antonio Chile': 'San Antonio', 'Gamarra La Victoria Lima': 'Lima', 'Valle de los Chillos': 'Quito',
 'Costa del Este': 'Ciudad de Panamá', 'Guadalupe Goicoechea': 'San José', 'San Pedro Montes de Oca': 'San José',
 'Liberia Guanacaste': 'Liberia', 'San Justo La Matanza': 'San Justo', 'Donostia San Sebastián': 'San Sebastián',
 'Inca Mallorca': 'Inca', 'Palma de Mallorca': 'Palma', 'San Fernando Cádiz': 'San Fernando',
 'Santiago de Chile': 'Santiago', 'Ciudad de México': 'Ciudad de México'}
def ciudad_limpia(c, iso):
    if not c: return c
    c = ALIAS_CIUDAD.get(c, c)
    if re.match(r'^Zona \d+ Guatemala$', c): return 'Ciudad de Guatemala'
    for suf in (' ' + PAISES[iso]['nombre'], ' ' + PAISES[iso]['nombre'].split()[-1]):
        if c.endswith(suf) and c != suf.strip():
            queda = c[:-len(suf)].strip()
            # «Ciudad de Panamá» NO es «Ciudad de»: si lo que queda cuelga de
            # una preposición o de un artículo, el nombre del país es parte de
            # la ciudad. Salieron seis cuentas con ciudad «Ciudad de»
            # (16-sep-2026). Lo que sí se recorta de verdad («Santiago de
            # Chile») vive arriba, en ALIAS_CIUDAD.
            if queda and not re.search(r'\b(de|del|la|las|los|el)$', queda, re.I): c = queda
    return c
def stems(giro, iso): return STEMS_PAIS.get(iso, {}).get(giro) or STEMS[giro]

# Cómo se ve un número nacional de verdad en cada país. El largo solo no
# alcanza (16-sep-2026): un móvil chileno de 11 dígitos «+5696437850 8» pasaba
# como argentino y acabó de WhatsApp en cuatro cuentas de Argentina, y
# cualquier número de Estados Unidos o Puerto Rico pasaba como dominicano
# —tres teléfonos de Puerto Rico formaron una «cuenta» de Hato Mayor—.
NACIONAL = {
    'co': r'^([13]\d{9}|[2-8]\d{7,9})$',
    'cl': r'^([2-9]\d{8})$',
    'ar': r'^(9[1-9]\d{9}|[1-9]\d{9})$',       # el área argentina nunca empieza con 9
    'pe': r'^(9\d{8}|[1-8]\d{7})$',
    'ec': r'^(9\d{8}|[2-7]\d{7})$',
    'cr': r'^[2-8]\d{7}$',
    'pa': r'^([2-9]\d{6}|6\d{7})$',
    'uy': r'^(9\d{7}|[2-4]\d{7})$',
    'gt': r'^[2-7]\d{7}$',
    'do': r'^(809|829|849)\d{7}$',             # el resto del +1 es Estados Unidos o Puerto Rico
    'es': r'^[6789]\d{8}$',
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
        # Con el 9 delante tienen que quedar 11 dígitos (9 + área + número):
        # «549916052376» es un wa.me publicado con un dígito de menos, no un
        # número. Ningún código de área argentino empieza con 9.
        if d.startswith('9') and len(d) != 11: return None
    if len(d) not in p['largos']: return None
    if iso in NACIONAL and not re.match(NACIONAL[iso], d): return None
    return '+' + p['lada'] + d

def es_movil(e, iso):
    p = PAISES[iso]
    if not e: return False
    n = e[len('+' + p['lada']):]
    return bool(re.match(p['movil'], n))
