#!/usr/bin/env python3
"""Busca consultas que piden columnas que NO existen.

USO:
    # 1 · sacar el esquema (Management API, token en .supabase-token)
    #     select table_name, string_agg(column_name,',' order by column_name) cols
    #     from information_schema.columns where table_schema='public' group by table_name
    # 2 · correrlo
    python3 scripts/auditar-columnas.py esquema.json
    # 3 · CONFIRMAR cada sospecha contra la base antes de tocar nada:
    #     supabase.from(tabla).select(campo).limit(1) → ¿da error?
    #     El paso 3 no es opcional: el regex puede atribuirle un select a la
    #     tabla equivocada, y "arreglar" un falso positivo rompe algo que servía.

Encontró (3-sep-2026): onboarding muerto para las 345 empresas, el tablero de
Revenue en MRR 0 / ARR 0 / 0 clientes, nadie marcado como churned al cancelar
en Stripe, y el portal de partners sin visitas ni referidos.

Es la falla que el dueño reportó en Finanzas: PostgREST contesta 400, el código
hace `const { data } = ...` sin mirar el error, y la pantalla enseña un cero que
parece un dato. Duró meses porque nada lo grita.

Solo reporta lo que puede AFIRMAR: la tabla existe en el esquema, el campo se
pide de forma plana (sin embed ni alias), y ese campo no está entre sus
columnas. Todo lo dudoso se calla — un reporte con ruido no se lee.
"""
import json, re, os, sys

esquema = {r['table_name']: set(r['cols'].split(',')) for r in json.load(open(sys.argv[1]))}
RAIZ = '/opt/sacs/paginawebsacs/sitio/src'

# .from('tabla')  ...  .select('a, b, rel(x)')  — en la misma cadena
CADENA = re.compile(r"\.from\(\s*'([a-z0-9_]+)'\s*\)((?:.|\n){0,600}?)\.select\(\s*([`'\"])((?:.|\n)*?)\3", re.M)
# también: .update({...}) / .insert({...}) con llaves que no existen
ESCRIBE = re.compile(r"\.from\(\s*'([a-z0-9_]+)'\s*\)\s*\.(update|insert)\(\s*\{((?:.|\n){0,900}?)\}\s*\)", re.M)

def campos_planos(sel: str):
    """Los campos de primer nivel, sin embeds ni funciones."""
    fuera, prof, act = [], 0, ''
    for ch in sel:
        if ch == '(': prof += 1; act += ch
        elif ch == ')': prof -= 1; act += ch
        elif ch == ',' and prof == 0: fuera.append(act); act = ''
        else: act += ch
    fuera.append(act)
    limpio = []
    for f in fuera:
        f = f.strip()
        if not f or '(' in f or '${' in f or ':' in f or f == '*' or '!' in f: continue
        if re.fullmatch(r'[a-z0-9_]+', f): limpio.append(f)
    return limpio

def llaves_nivel0(cuerpo: str):
    """Llaves del objeto, sin entrar en objetos/arreglos/plantillas anidados."""
    prof, out, i, n = 0, [], 0, len(cuerpo)
    while i < n:
        ch = cuerpo[i]
        if ch in '{[(`': prof += 1
        elif ch in '}])`': prof -= 1
        elif prof == 0:
            m = re.match(r'([a-z][a-zA-Z0-9_]*)\s*:', cuerpo[i:])
            if m and (i == 0 or cuerpo[i-1] in ',{\n \t'):
                out.append(m.group(1)); i += m.end(); continue
        i += 1
    return out

hallazgos = []
for base, _, archivos in os.walk(RAIZ):
    for a in archivos:
        if not a.endswith(('.ts', '.tsx')) or a.endswith('.test.ts'): continue
        ruta = os.path.join(base, a)
        txt = open(ruta, encoding='utf-8').read()
        linea_de = lambda pos: txt.count('\n', 0, pos) + 1

        for m in CADENA.finditer(txt):
            tabla, medio, _, sel = m.group(1), m.group(2), m.group(3), m.group(4)
            if tabla not in esquema or '${' in sel: continue
            campos = campos_planos(sel)
            if not campos: continue
            # PRUEBA DE ATRIBUCIÓN. El regex puede pegar un .from() con el
            # .select() de OTRA cadena, y entonces «no existe» solo significa
            # «me equivoqué de tabla». Si la mayoría de los campos sí existen,
            # la tabla es la correcta y el que falta es un hallazgo de verdad.
            ok = [c for c in campos if c in esquema[tabla]]
            if len(ok) / len(campos) < 0.6: continue
            for c in campos:
                if c not in esquema[tabla]:
                    hallazgos.append(('SELECT', ruta.replace(RAIZ + '/', ''), linea_de(m.start()), tabla, c))

        for m in ESCRIBE.finditer(txt):
            tabla, op, cuerpo = m.group(1), m.group(2), m.group(3)
            if tabla not in esquema: continue
            # SOLO las llaves de primer nivel. Dentro de `metadata: {...}` —que es
            # jsonb— cualquier llave es válida, y contarlas ahogaba el reporte en
            # 600 falsos positivos.
            llaves = llaves_nivel0(cuerpo)
            if not llaves: continue
            okk = [k for k in llaves if k in esquema[tabla]]
            if len(okk) / len(llaves) < 0.6: continue
            for k in llaves:
                if k not in esquema[tabla]:
                    hallazgos.append((op.upper(), ruta.replace(RAIZ + '/', ''), linea_de(m.start()), tabla, k))

vistos = set(); out = []
for h in hallazgos:
    k = (h[0], h[1], h[3], h[4])
    if k in vistos: continue
    vistos.add(k); out.append(h)

print(f'{len(out)} sospechas\n')
for op, ruta, ln, tabla, campo in sorted(out, key=lambda x: (x[3], x[4])):
    print(f'{op:6} {tabla}.{campo:28} {ruta}:{ln}')
