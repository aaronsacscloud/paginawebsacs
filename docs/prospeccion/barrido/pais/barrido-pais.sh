#!/bin/bash
# barrido-pais.sh <giro> [workers]  — el feed de Maps de cada consulta de cola-<giro>.tsv
cd "$(dirname "$0")"
g=$1; N=${2:-4}
for w in $(seq 0 $((N-1))); do ( bash worker-pais.sh "$g" $w $N > "log-feed-$g-w$w.txt" 2>&1 ) & done
wait
date > "barrido-fin-$g.txt"
