import re, json, sys
txt = open(sys.argv[1], encoding='utf-8').read()
# quitar encabezados/pies de página
txt = re.sub(r'\f', '\n', txt)
txt = re.sub(r'^\s*VTC / PROCESOS INTEGRALES\s*$', '', txt, flags=re.M)
txt = re.sub(r'^\s*MODELO FUNCIONAL VTC • DOCUMENTO DE TRABAJO \|\s*\d+\s*$', '', txt, flags=re.M)
ini = txt.index('I. CONSIGNANTES, RECEPCIÓN Y PROPUESTAS')
fin = txt.index('REGLAS QUE REQUIEREN DECISIÓN')
cuerpo = txt[ini:fin]
bloques_re = re.compile(r'^(I|II|III|IV|V|VI|VII|VIII|IX)\. ([A-ZÁÉÍÓÚÑ ,/Y]+)$', re.M)
flujo_re = re.compile(r'^(\d{2})\. (.+)$', re.M)
def limpia(s):
    s = re.sub(r'\s*\n\s*', ' ', s).strip()
    return re.sub(r'\s{2,}', ' ', s)
salida = []
pos = [(m.start(), 'B', m) for m in bloques_re.finditer(cuerpo)] + [(m.start(), 'F', m) for m in flujo_re.finditer(cuerpo)]
pos.sort(key=lambda x: x[0])
bloque = None
for i,(p,t,m) in enumerate(pos):
    end = pos[i+1][0] if i+1 < len(pos) else len(cuerpo)
    if t == 'B':
        bloque = {'num': m.group(1), 'titulo': m.group(2).strip(), 'flujos': []}
        salida.append(bloque); continue
    seg = cuerpo[m.end():end]
    f = {'n': m.group(1), 'titulo': m.group(2).strip()}
    def campo(etq, sig):
        mm = re.search(etq + r'(.*?)(?=' + sig + r')', seg, re.S)
        return limpia(mm.group(1)) if mm else ''
    f['disparador'] = campo(r'Disparador y responsables:', r'Problema reportado:|Pasos del flujo')
    f['problema'] = campo(r'Problema reportado:', r'Pasos del flujo')
    pasos_txt = re.search(r'Pasos del flujo(.*?)Control y excepción:', seg, re.S).group(1)
    partes = re.split(r'^\s*(\d+)\.\s+', pasos_txt, flags=re.M)
    f['pasos'] = [limpia(partes[k]) for k in range(2, len(partes), 2)]
    f['control'] = campo(r'Control y excepción:', r'Resultado:')
    f['resultado'] = campo(r'Resultado:', r'Origen:')
    mm = re.search(r'Origen:(.*)$', seg, re.S); f['origen'] = limpia(mm.group(1)) if mm else ''
    bloque['flujos'].append(f)
# decisiones y criterios
dec = txt[fin:txt.index('CRITERIOS MÍNIMOS')]
partes = re.split(r'^\s*(\d+)\.\s+', dec, flags=re.M)
decisiones = [limpia(partes[k]) for k in range(2, len(partes), 2)]
crit = txt[txt.index('CRITERIOS MÍNIMOS'):txt.index('ANEXO A')]
crit = crit.split('\n',1)[1]
criterios = [limpia(c) for c in re.split(r'\n\s*[•●]\s*|\n\s*\s*', '\n'+crit) if limpia(c)]
json.dump({'bloques': salida, 'decisiones': decisiones, 'criterios': criterios}, open(sys.argv[2],'w',encoding='utf-8'), ensure_ascii=False, indent=1)
print(sum(len(b['flujos']) for b in salida), 'flujos;', len(salida), 'bloques;', len(decisiones), 'decisiones;', len(criterios), 'criterios')
for b in salida: print(b['num'], b['titulo'], [f['n'] for f in b['flujos']])
