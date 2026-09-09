#!/usr/bin/env python3
"""Arma cola.tsv (giro<TAB>consulta) = stems del giro × ciudades.txt.
  python3 cola.py jeans trajesbano > cola.tsv
Cada consulta se raspa una vez: worker.sh se salta las que ya tienen pool-<giro>/<md5>.json."""
import sys, os
from giros_config import GIROS
D = os.path.dirname(os.path.abspath(__file__))
ciudades = [l.strip() for l in open(os.path.join(D, 'ciudades.txt')) if l.strip()]
for g in sys.argv[1:]:
    os.makedirs(os.path.join(D, 'pool-' + g), exist_ok=True)
    for stem in GIROS[g]['stems']:
        for c in ciudades: print(f'{g}\t{stem} {c}')
