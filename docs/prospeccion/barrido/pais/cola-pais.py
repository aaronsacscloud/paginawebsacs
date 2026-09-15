#!/usr/bin/env python3
"""Arma cola-<giro>.tsv (iso<TAB>consulta) = STEMS del giro × ciudades de cada país.
  python3 cola-pais.py novias co cl ar …   (sin países = los diez)
worker-pais.sh se salta las consultas que ya tienen pool-<iso>-<giro>/<md5>.json."""
import sys, os
from paises import PAISES, STEMS, stems
D = os.path.dirname(os.path.abspath(__file__))
giro = sys.argv[1]
isos = sys.argv[2:] or list(PAISES)
with open(os.path.join(D, f'cola-{giro}.tsv'), 'w') as f:
    for iso in isos:
        os.makedirs(os.path.join(D, f'pool-{iso}-{giro}'), exist_ok=True)
        for stem in stems(giro, iso):
            for c in PAISES[iso]['ciudades']: f.write(f'{iso}\t{stem} {c}\n')
print(sum(len(stems(giro, i)) * len(PAISES[i]['ciudades']) for i in isos), 'consultas')
