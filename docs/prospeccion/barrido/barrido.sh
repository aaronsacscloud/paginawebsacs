#!/bin/bash
cd "$(dirname "$0")"
N=4
for w in $(seq 0 $((N-1))); do ( bash worker.sh $w $N > "log-w$w.txt" 2>&1 ) & done
wait
date > barrido-fin.txt
