"""Master a spoken-word episode for Field Notes: 44.1 kHz mono, gentle compression, true-peak
limiting, then MP3 96 kbps landing at -16 LUFS integrated / <= -1 dBTP after encoding.
   python3 master.py in.wav out.mp3"""
import sys, numpy as np, soundfile as sf, pyloudnorm as pyln, lameenc
from math import gcd
from scipy.signal import resample_poly
from scipy.ndimage import minimum_filter1d, uniform_filter1d
src, dst = sys.argv[1], sys.argv[2]
x, sr0 = sf.read(src)
if x.ndim > 1: x = x.mean(1)
g = gcd(44100, sr0); x = resample_poly(x, 44100 // g, sr0 // g); sr = 44100
def tpeak(y): return 20*np.log10(np.max(np.abs(resample_poly(y, 4, 1))) + 1e-12)
def follow(env, att, rel):
    ka, kr = np.exp(-1/(att*sr)), np.exp(-1/(rel*sr)); out = np.empty_like(env); c = env[0]
    for i, v in enumerate(env):
        c = v + (c - v)*(ka if v > c else kr); out[i] = c
    return out
def compress(y, thr=-24, ratio=2.5, knee=6):
    over = 10*np.log10(uniform_filter1d(y*y, int(0.01*sr)) + 1e-12) - thr
    gr = np.where(over <= -knee/2, 0, np.where(over >= knee/2, over*(1-1/ratio), (over+knee/2)**2/(2*knee)*(1-1/ratio)))
    return y*10**(-follow(gr, 0.015, 0.25)/20)
def limit(y, ceil_db, look=0.005, rel=0.06):
    a = np.abs(resample_poly(y, 4, 1)).reshape(-1, 4).max(1)[:len(y)]; a = np.pad(a, (0, len(y)-len(a)), mode='edge')
    n = int(look*sr); gg = minimum_filter1d(np.minimum(1, 10**(ceil_db/20)/np.maximum(a, 1e-9)), 2*n+1)
    out = np.empty_like(gg); k = np.exp(-1/(rel*sr)); cur = 1.0
    for i, v in enumerate(gg):
        cur = v if v < cur else v + (cur - v)*k; out[i] = cur
    return y*uniform_filter1d(out, n)
def encode(y):
    e = lameenc.Encoder(); e.set_bit_rate(96); e.set_in_sample_rate(sr); e.set_channels(1); e.set_quality(2)
    open(dst, 'wb').write(e.encode((np.clip(y, -1, 1)*32767).astype('<i2').tobytes()) + e.flush())
    d, dsr = sf.read(dst); return pyln.Meter(dsr).integrated_loudness(d), tpeak(d)
c = compress(x); meter = pyln.Meter(sr); target, ceil = -16.0, -2.0; gain = 0.0
for _ in range(4):                       # loudness is judged on the decoded MP3, not the pre-encode audio
    for _ in range(8):
        y = limit(c*10**(gain/20), ceil); L = meter.integrated_loudness(y); gain += (target + 0.0) - L
        if abs(target - L) < 0.03: break
    Lm, tp = encode(y)
    if abs(-16.0 - Lm) < 0.15 and tp <= -1.0: break
    target += -16.0 - Lm
    if tp > -1.0: ceil -= (tp + 1.0) + 0.2
print(f'{dst}: {Lm:.2f} LUFS, true peak {tp:.2f} dBTP, {len(x)/sr:.1f}s (ceiling {ceil:.1f} dB)')
