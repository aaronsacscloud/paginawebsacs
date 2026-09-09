import json,random,sys
g=sys.argv[1]; f=json.load(open(g+'-fusion.json')); n=f['nuevas']
if n: print('campos:', list(n[0].keys()))
random.seed(3); s=random.sample(n,min(45,len(n)))
def row(c): print((c.get('nombre') or '')[:44].ljust(45), (c.get('cat') or c.get('categoria') or '?')[:26].ljust(27), (c.get('ciudad') or '')[:16].ljust(17), c.get('sucursales') or len(c.get('sucs',[]) or [1]))
for c in s: row(c)
print('--- top sucursales')
for c in sorted(n,key=lambda c:-(c.get('sucursales') or len(c.get('sucs',[]) or [1])))[:25]: row(c)
