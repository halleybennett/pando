#!/usr/bin/env python3
"""Accessibility audit for Pando. Reads the tokens out of app/styles.css rather than a copy,
so the numbers cannot drift from what actually ships.

Thresholds: 4.5 for text under ~18px, 3.0 for meaningful graphics and UI boundaries,
1.10 for a raised surface against its ground (a house rule, not WCAG - a card has to read
as a card). Decorative elements are listed but not failed.
"""
import re, sys, os, math

HERE = os.path.dirname(os.path.abspath(__file__))
CSS = open(os.path.join(HERE, '..', 'app', 'styles.css')).read()

def block(after=None):
    """Pull `--name:value;` pairs from :root, optionally from inside the dark media block."""
    src = CSS
    if after:
        i = src.index(after)
        src = src[i:src.index('}', src.index(':root{', i))]
    else:
        src = src[src.index(':root{'):src.index('}', src.index(':root{'))]
    return dict(re.findall(r'--([a-z-]+)\s*:\s*([^;]+);', src))

LIGHT = block()
DARK = dict(LIGHT); DARK.update(block('@media (prefers-color-scheme: dark)'))

def s2l(c):
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def hx(h):
    h = h.strip().lstrip('#')
    return [int(h[i:i+2], 16) for i in (0, 2, 4)]
def lum(h):
    r, g, b = [s2l(v) for v in hx(h)]
    return .2126*r + .7152*g + .0722*b
def cr(a, b):
    x, y = lum(a), lum(b)
    hi, lo = max(x, y), min(x, y)
    return (hi + .05) / (lo + .05)

def stops(grad):
    return re.findall(r'#[0-9a-fA-F]{6}', grad)

CHECKS = [
    # label,               foreground,     background,   floor, note
    ('city name / ink on card',      'ink',      'card',      4.5, ''),
    ('country + day-shift on card',  'muted',    'card',      4.5, '11px'),
    ('footer + header on paper',     'muted',    'paper',     4.5, '11.5px, worst gradient stop'),
    ('home chip label',              'on-chip',  'chip-bg',   4.5, '11px'),
    ('add-city label on card',       'muted',    'card',      4.5, ''),
    ('+ glyph on the button',        'on-night', 'night',     4.5, ''),
    ('delete button text',           'on-night', 'night',     4.5, ''),
    ('cancel / links on card',       'night',    'card',      4.5, ''),
    ('major hour tick on paper',     'tick-maj', 'paper',     3.0, 'graphic'),
    ('day-state marker: moon',       'moon',     'card',      3.0, 'graphic'),
    ('day-state marker: sun',        'sun-edge', 'card',      3.0,
     'graphic - tested on its OUTLINE, the element that defines the shape. The Noon fill\n                                                        alone is 1.57 on white, which is exactly why the outline exists'),
    # --- the dial's own text: it sits on the white face, not on a card ---
    ('dial home-city label',         'muted',    'dial-face', 4.5, '10px, inside the dial'),
    ('dial hour numerals',           'muted',    'paper',     4.5, '10.5px, on the ground'),
    ('12/24 live value',             'ink',      'dial-face', 4.5, '11px'),
    ('12/24 inactive value',         'muted',    'dial-face', 4.5, '11px'),
    ('am/pm suffix in a row',        'muted',    'card',      4.5, '17px'),
    ('search result subtitle',       'muted',    'card',      4.5, '12px'),
    ('already-added row',            'muted',    'card',      4.5,
     'quietened by dropping the name to muted, not by opacity - fading it put this at 1.75'),
    ('card raised off paper',        'card',     'paper',     1.10, 'house rule'),
    ('chip raised off card',         'chip-bg',  'card',      1.10, 'house rule'),
]
DECORATIVE = [('minor half-hour tick', 'tick-min', 'paper',
               'subdivision, redundant with the hour ticks and the numerals')]

# Anything with opacity on it: the effective colour is the blend over its background, not the
# token. These are easy to miss because the stylesheet never names the resulting colour.
FADED = [
    ('12/24 separator "·"', 'muted', 'dial-face', 0.45, 4.5,
     'a dot between two labels - decorative, carries no meaning'),

]
def blend(fg, bg, a):
    F, B = hx(fg), hx(bg)
    return '#%02x%02x%02x' % tuple(round(F[i]*a + B[i]*(1-a)) for i in range(3))

fails = 0
for scheme, T in (('LIGHT', LIGHT), ('DARK', DARK)):
    print('\n=== %s ===' % scheme)
    for label, fg, bg, floor, note in CHECKS:
        f, b = T[fg], T[bg]
        cand = stops(b) if 'gradient' in b else [b]
        cand = cand or [b]
        fs = stops(f) if 'gradient' in f else [f]
        worst, at = 99, ''
        for x in fs:
            for y in cand:
                v = cr(x, y)
                if v < worst: worst, at = v, y
        ok = worst >= floor
        fails += 0 if ok else 1
        print('  %-32s %6.2f  (need %.2f)  %-4s %s' %
              (label, worst, floor, 'ok' if ok else 'FAIL',
               ('@ %s ' % at if len(cand) > 1 else '') + note))
    for label, fg, bg, alpha, floor, note in FADED:
        cand = stops(T[bg]) or [T[bg]]
        worst, at = 99, ''
        for y in cand:
            v = cr(blend(T[fg], y, alpha), y)
            if v < worst: worst, at = v, y
        flag = 'ok' if worst >= floor else 'below %.1f' % floor
        print('  %-32s %6.2f  @%d%% opacity  %-9s %s' % (label, worst, alpha*100, flag, note))
    for label, fg, bg, note in DECORATIVE:
        cand = stops(T[bg]) or [T[bg]]
        worst = min(cr(T[fg], y) for y in cand)
        print('  %-32s %6.2f  (exempt)         %s' % (label, worst, note))

print('\n=== documented exemptions ===')
print('  sun outline (Amber #a97103, light only) - a legibility patch, not a colour choice:')
print('     Noon on white measures %.2f and the disc vanishes without it.' % cr('#f7c948', '#ffffff'))
print('     Amber vs the white card: %.2f  |  vs the Noon disc: %.2f'
      % (cr('#a97103', '#ffffff'), cr('#a97103', '#f7c948')))
print('  the dial has no keyboard or screen-reader path - accepted 3 Sept, see PLAN.md')
print('\n%s' % ('ALL CHECKS PASS' if not fails else '%d FAILURES' % fails))
sys.exit(1 if fails else 0)
