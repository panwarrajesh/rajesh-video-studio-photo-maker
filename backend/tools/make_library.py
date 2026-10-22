"""Generates the built-in music library: ORIGINAL instrumental loops synthesised from scratch (no samples, no copyrighted material).
Free to use in any video. Run:  python3 tools/make_library.py   (needs numpy + ffmpeg)."""
import json, os, subprocess, wave
import numpy as np

SR = 44100
rng = np.random.default_rng(7)
OUT = os.path.join(os.path.dirname(__file__), '..', 'library')
mid = lambda n: 440.0 * 2 ** ((n - 69) / 12)
T = lambda n: np.arange(int(n)) / SR

def adsr(n, a=0.01, r=0.1):
    e = np.ones(n); a, r = max(1, int(a * SR)), max(1, int(r * SR))
    e[:a] = np.linspace(0, 1, a)[:n]; e[-r:] *= np.linspace(1, 0, min(r, n))[:n] if n >= r else 1
    return e
def pluck(f, d, bright=1.0):
    t = T(d * SR); return (np.sin(2*np.pi*f*t)*np.exp(-t*5) + .4*bright*np.sin(2*np.pi*2*f*t)*np.exp(-t*8) + .2*bright*np.sin(2*np.pi*3*f*t)*np.exp(-t*11)) * adsr(len(t), .004, .05)
def piano(f, d):
    t = T(d * SR); y = sum(a * np.sin(2*np.pi*h*f*t) * np.exp(-t*(2.2 + h*1.6)) for h, a in [(1, 1), (2, .5), (3, .28), (4, .14), (5, .08)])
    return (y + .02 * rng.standard_normal(len(t)) * np.exp(-t*60)) * adsr(len(t), .003, .12)
def rhodes(f, d):
    t = T(d * SR); y = sum(np.sin(2*np.pi*f*(1 + dt)*t) for dt in (-.002, .002)) * .5 * np.exp(-t*2.2) + .25 * np.sin(2*np.pi*f*2*t) * np.exp(-t*5) + .1 * np.sin(2*np.pi*f*7*t) * np.exp(-t*14)
    return y * adsr(len(t), .006, .15)
def pad(f, d, att=.5, rel=.8, vib=0.0):
    t = T(d * SR); y = 0
    for dt in (-.004, 0, .004):
        ph = 2*np.pi*f*(1+dt)*t + vib * np.sin(2*np.pi*5*t)
        y = y + sum(np.sin(h*ph) / h for h in range(1, 7))
    return y / 3 * adsr(len(t), att, rel)
def bass(f, d, dec=3.0):
    t = T(d * SR); return (np.sin(2*np.pi*f*t) + .35*np.sin(2*np.pi*2*f*t)) * np.exp(-t*dec) * adsr(len(t), .004, .04)
def kick(d=.42, f0=130, f1=42, dec=9):
    t = T(d * SR); ph = 2*np.pi*np.cumsum(f1 + (f0 - f1)*np.exp(-t*28)) / SR; return np.sin(ph) * np.exp(-t*dec)
def snare(d=.22): t = T(d * SR); return (rng.standard_normal(len(t)) * np.exp(-t*20) * .6 + np.sin(2*np.pi*190*t) * np.exp(-t*25) * .4)
def hat(d=.05, o=False):
    t = T((.25 if o else d) * SR); n = np.diff(rng.standard_normal(len(t) + 1)); return n * np.exp(-t*(14 if o else 70)) * .35
def tom(f=70, d=.9): t = T(d * SR); return np.sin(2*np.pi*f*t*(1 + .4*np.exp(-t*8))) * np.exp(-t*4.5)

def chord(root, kind):
    iv = {'M': [0, 4, 7], 'm': [0, 3, 7], 'm7': [0, 3, 7, 10], 'M7': [0, 4, 7, 11], 'D7': [0, 4, 7, 10], 'M9': [0, 4, 7, 11, 14]}[kind]
    return [root + i for i in iv]

class Mix:
    def __init__(self, sec): self.n = int(sec * SR); self.L = np.zeros(self.n + SR * 3); self.R = np.zeros(self.n + SR * 3)
    def add(self, y, t, g=1.0, pan=0.0):
        i = int(t * SR)
        if i >= self.n: return
        y = y[: len(self.L) - i]; self.L[i:i+len(y)] += y * g * (1 - max(pan, 0)); self.R[i:i+len(y)] += y * g * (1 + min(pan, 0))
    def finish(self, tail=0.0, vinyl=0.0):
        L, R = self.L[: self.n].copy(), self.R[: self.n].copy()
        if vinyl: nz = np.diff(rng.standard_normal(self.n + 1)) * vinyl * (rng.random(self.n) > .9992 - 0); L += nz; R += nz
        fo = int(.05 * SR); w = np.ones(self.n); w[:fo] = np.linspace(0, 1, fo); w[-fo:] = np.linspace(1, 0, fo); L *= w; R *= w
        st = np.stack([np.tanh(L * 1.1), np.tanh(R * 1.1)], 1); return st / max(1e-6, np.abs(st).max()) * 0.89

def arrange(bpm, prog, sec, swing=0.0):
    bar = 4 * 60 / bpm; bars = max(4, round(sec / bar) // 4 * 4); return bar, bars, prog * (bars // len(prog) + 1)

def trending(m, bpm=120):
    bar, bars, prog = arrange(bpm, [(57, 'm'), (53, 'M'), (60, 'M'), (55, 'M')], 32); s = bar / 16
    for b in range(bars):
        r, k = prog[b]; ch = chord(r + 12, k); t0 = b * bar
        m.add(pad(mid(ch[0]), bar + .2, .05, .3), t0, .12, -.3); m.add(bass(mid(r - 12), bar / 2 - .02), t0, .5); m.add(bass(mid(r - 12), bar / 2 - .02), t0 + bar / 2, .45)
        for i in range(16): m.add(pluck(mid(ch[i % 3] + (12 if i % 4 == 3 else 0)), s * 1.6), t0 + i * s, .2, (-.3 if i % 2 else .3))
        for q in range(4): m.add(kick(), t0 + q * bar / 4, .8)
        for q in (1, 3): m.add(snare(), t0 + q * bar / 4, .45)
        for i in range(8): m.add(hat(o=i % 4 == 3), t0 + i * bar / 8 + bar / 16, .5, .2)
def cinematic(m, bpm=68):
    bar, bars, prog = arrange(bpm, [(50, 'm'), (46, 'M'), (53, 'M'), (48, 'M')], 36)
    for b in range(bars):
        r, k = prog[b]; t0 = b * bar
        for n in chord(r, k): m.add(pad(mid(n), bar + 1.2, 1.2, 1.4, vib=.4), t0, .1, rng.uniform(-.5, .5))
        m.add(pad(mid(r - 24), bar + 1, 1.0, 1.4), t0, .22)
        for i, n in enumerate(chord(r + 24, k)): m.add(piano(mid(n), 2.4), t0 + bar * (.25 + i * .22), .35, .25)
        if b % 4 == 0: m.add(tom(), t0, .9)
        if b % 4 == 3: m.add(tom(60), t0 + bar * .75, .7); m.add(tom(75), t0 + bar * .875, .7)
def romantic(m, bpm=72):
    bar, bars, prog = arrange(bpm, [(60, 'M'), (55, 'M'), (57, 'm'), (53, 'M')], 32)
    for b in range(bars):
        r, k = prog[b]; ch = chord(r, k); t0 = b * bar
        m.add(pad(mid(ch[0] + 12), bar + .6, .4, .8), t0, .14)
        for i in range(8): m.add(piano(mid(ch[(0, 1, 2, 1, 0, 1, 2, 1)[i] % 3] + (12 if i in (3, 7) else 0)), 1.6), t0 + i * bar / 8, .5, .15)
        m.add(bass(mid(r - 12), bar), t0, .35, 0)
def sad(m, bpm=64):
    bar, bars, prog = arrange(bpm, [(57, 'm'), (50, 'm'), (53, 'M'), (52, 'M')], 36)
    for b in range(bars):
        r, k = prog[b]; ch = chord(r, k); t0 = b * bar
        m.add(pad(mid(ch[1]), bar + 1, .8, 1.2, vib=.3), t0, .13, .2)
        for i, n in enumerate(ch): m.add(piano(mid(n), 3.2), t0 + i * .05, .45, -.1 + i * .1)
        for i in (0, 2, 4): m.add(piano(mid(ch[(i // 2) % 3] + 12), 1.6), t0 + bar * (.5 + i * .08) , .35, .3)
        m.add(bass(mid(r - 12), bar * .98, 1.2), t0, .35)
def happy(m, bpm=124):
    bar, bars, prog = arrange(bpm, [(60, 'M'), (53, 'M'), (55, 'M'), (60, 'M')], 32); s = bar / 8
    for b in range(bars):
        r, k = prog[b]; ch = chord(r + 12, k); t0 = b * bar
        for i in range(8): m.add(pluck(mid(ch[(0, 1, 2, 1, 0, 2, 1, 2)[i]]), s * 1.8, 1.2), t0 + i * s, .3, (-.25 if i % 2 else .25))
        m.add(bass(mid(r - 12), s * 1.5), t0, .5); m.add(bass(mid(r - 12), s * 1.5), t0 + bar / 2, .45)
        for q in range(4): m.add(kick(), t0 + q * bar / 4, .6)
        for q in (1, 3): m.add(snare(.15), t0 + q * bar / 4, .4)
        for i in range(8): m.add(hat(), t0 + i * s + s / 2, .45, .2)
def vlog(m, bpm=100):
    bar, bars, prog = arrange(bpm, [(53, 'M'), (55, 'M'), (57, 'm'), (60, 'M')], 32); s = bar / 8
    for b in range(bars):
        r, k = prog[b]; ch = chord(r + 12, k); t0 = b * bar
        for i in range(4): m.add(pluck(mid(ch[(0, 2, 1, 2)[i]] + 12), s * 2, 1.1), t0 + i * bar / 4 + (s if i % 2 else 0), .3, .2)
        m.add(pad(mid(ch[1]), bar + .1, .1, .3), t0, .1, -.2); m.add(bass(mid(r - 12), s * 3), t0, .5); m.add(bass(mid(r - 12), s * 3), t0 + bar * .625, .4)
        m.add(kick(), t0, .7); m.add(kick(), t0 + bar * .625, .6); m.add(snare(.16), t0 + bar / 4, .4); m.add(snare(.16), t0 + bar * .75, .4)
        for i in range(8): m.add(hat(), t0 + i * s, .35, -.2)
def travel(m, bpm=96):
    bar, bars, prog = arrange(bpm, [(55, 'M'), (50, 'M'), (52, 'm'), (60, 'M')], 32); s = bar / 8
    for b in range(bars):
        r, k = prog[b]; ch = chord(r + 12, k); t0 = b * bar
        for i in range(8): m.add(pluck(mid(ch[(0, 1, 2, 1, 0, 1, 2, 1)[i]] + (12 if i % 4 == 2 else 0)), s * 2.2, 1.0), t0 + i * s, .3, (-.3 if i % 2 else .3))
        m.add(pad(mid(ch[0]), bar + .4, .3, .6), t0, .1); m.add(bass(mid(r - 12), bar / 2), t0, .45); m.add(kick(.3, 110, 50), t0, .5); m.add(kick(.3, 110, 50), t0 + bar * .5, .45)
        for i in range(16): m.add(hat(.03), t0 + i * bar / 16, .25, .3 if i % 2 else -.3)
def lofi(m, bpm=78):
    bar, bars, prog = arrange(bpm, [(50, 'm7'), (55, 'D7'), (48, 'M7'), (57, 'm7')], 32); s = bar / 16
    for b in range(bars):
        r, k = prog[b]; ch = chord(r + 12, k); t0 = b * bar
        for j, n in enumerate(ch): m.add(rhodes(mid(n), bar * .95), t0 + j * .018, .2, -.2 + j * .12)
        m.add(bass(mid(r - 12), bar * .45, 2.5), t0, .5); m.add(bass(mid(r - 12), bar * .3, 2.5), t0 + bar * .56, .4)
        m.add(kick(.35, 100, 48), t0, .75); m.add(kick(.35, 100, 48), t0 + bar * .625 + s * .5, .6); m.add(snare(.2), t0 + bar / 4, .38); m.add(snare(.2), t0 + bar * .75, .38)
        for i in range(8): m.add(hat(), t0 + i * bar / 8 + (s * .6 if i % 2 else 0), .3, .25)
        m.add(rhodes(mid(ch[2] + 12), .7), t0 + bar * .875, .12, .3)
def beats(m, bpm=140):
    bar, bars, prog = arrange(bpm, [(48, 'm'), (44, 'M'), (51, 'M'), (46, 'M')], 30); s = bar / 16
    for b in range(bars):
        r, k = prog[b]; t0 = b * bar
        m.add(bass(mid(r - 12), bar * .5, 1.4) * 1.3, t0, .6); m.add(bass(mid(r - 12), bar * .4, 1.4), t0 + bar * .56, .5)
        m.add(kick(.5, 150, 38, 5), t0, .95); m.add(kick(.5, 150, 38, 5), t0 + bar * .4375, .8); m.add(kick(.5, 150, 38, 5), t0 + bar * .625, .85)
        m.add(snare(.25), t0 + bar / 2, .6)
        for i in range(16): m.add(hat(), t0 + i * s, .4 if i % 2 == 0 else .25, .2)
        if b % 2 == 1:
            for i in range(4): m.add(hat(.03), t0 + bar * .75 + i * s / 2, .4)
        for i, n in enumerate(chord(r + 24, 'm' if k == 'm' else 'M')): m.add(pluck(mid(n), .5, 1.4), t0 + bar * (.125 + i * .25), .22, .3)
def instrumental(m, bpm=88):
    bar, bars, prog = arrange(bpm, [(52, 'm'), (48, 'M'), (55, 'M'), (50, 'M')], 32)
    for b in range(bars):
        r, k = prog[b]; ch = chord(r + 12, k); t0 = b * bar
        for n in ch: m.add(pad(mid(n), bar + .8, .7, 1.0, vib=.35), t0, .1, rng.uniform(-.4, .4))
        for i in range(8): m.add(piano(mid(ch[(0, 1, 2, 1)[i % 4]] + (12 if i % 2 else 0)), 1.3), t0 + i * bar / 8, .4, .1)
        m.add(bass(mid(r - 12), bar * .95, 1.3), t0, .4)
        if b % 2 == 0: m.add(kick(.4, 100, 45), t0, .45); m.add(kick(.4, 100, 45), t0 + bar / 2, .4)
def ambient(m, bpm=58):
    bar, bars, prog = arrange(bpm, [(48, 'M9'), (53, 'M7'), (45, 'm7'), (55, 'M')], 40)
    for b in range(bars):
        r, k = prog[b]; t0 = b * bar
        for n in chord(r + 12, k): m.add(pad(mid(n), bar + 3, 2.2, 2.6, vib=.5), t0, .09, rng.uniform(-.7, .7))
        m.add(pad(mid(r - 12), bar + 2.5, 2.0, 2.4), t0, .2)
        if b % 2 == 0: m.add(pluck(mid(r + 36 + int(rng.integers(0, 7))), 3, .6), t0 + bar * .4, .1, rng.uniform(-.8, .8))

TRACKS = [
    ('neon-drive', 'Neon Drive', ['trending', 'beats'], trending, 32, {}), ('golden-hour', 'Golden Hour', ['cinematic', 'trending'], cinematic, 36, {}),
    ('first-light', 'First Light', ['romantic'], romantic, 32, {}), ('empty-streets', 'Empty Streets', ['sad'], sad, 36, {}),
    ('sunny-side', 'Sunny Side', ['happy', 'trending'], happy, 32, {}), ('walk-and-talk', 'Walk and Talk', ['vlog', 'trending'], vlog, 32, {}),
    ('open-road', 'Open Road', ['travel'], travel, 32, {}), ('rainy-window', 'Rainy Window', ['lo-fi'], lofi, 32, {'vinyl': .004}),
    ('night-run', 'Night Run', ['beats'], beats, 30, {}), ('quiet-focus', 'Quiet Focus', ['instrumental'], instrumental, 32, {}),
    ('drifting-clouds', 'Drifting Clouds', ['ambient', 'instrumental'], ambient, 40, {}),
]
os.makedirs(OUT, exist_ok=True); manifest = []
for tid, title, cats, fn, sec, extra in TRACKS:
    m = Mix(sec); fn(m); y = m.finish(vinyl=extra.get('vinyl', 0)); tmp = os.path.join(OUT, f'{tid}.wav')
    with wave.open(tmp, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((y * 32767).astype('<i2').tobytes())
    mp3 = os.path.join(OUT, f'{tid}.mp3'); subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-codec:a', 'libmp3lame', '-b:a', '96k', '-ar', '44100', mp3], check=True); os.remove(tmp)
    mono = np.abs(y).max(1); bins = np.array_split(mono, 80); peaks = [int(round(100 * b.max() / max(1e-6, mono.max()))) for b in bins]
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3], capture_output=True, text=True).stdout)
    manifest.append({'id': f'rvs-{tid}', 'title': title, 'artist': 'RVS Originals', 'categories': cats, 'duration': round(dur, 2), 'file': f'{tid}.mp3', 'size': os.path.getsize(mp3), 'peaks': peaks,
                     'license': 'Original instrumental created for Rajesh Video Studio. Free to use in your videos, no attribution needed.'})
    print(f'{tid:16} {dur:5.1f}s {os.path.getsize(mp3)//1024:4d}KB')
json.dump({'version': 1, 'tracks': manifest}, open(os.path.join(OUT, 'manifest.json'), 'w'), separators=(',', ':'))
