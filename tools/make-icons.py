#!/usr/bin/env python3
"""Renders Pando's app icons.

    python3 tools/make-icons.py [out_dir]

The icon is V2b, chosen 4 Sept 2026: the wheel's own gradient full-bleed, a white circle punched
out of it, and the grove inside - three aspen at uneven heights whose outer stems turn into
lateral roots, with the centre stem running deeper and forking beneath them.

Two things are deliberately different from the header mark in app/app.js:
  - the leaves keep their midribs here, because at 512px they read; at 16px they close up
  - the outer trees keep their roots, for the same reason

Geometry is duplicated from icon-current.html rather than imported, because that page is a
tuning tool and this is the build. If the mark changes, change it in both.
"""
import math, os, subprocess, sys

# --- the shape, exactly as tuned ---
LEAF_W, LEAF_H, LEAN = 13.5, 34.0, 0.22
CORNER, ROOT_REACH, ROOT_GAP = 6.5, 17.0, 6.0
CENTRE_HALF = 26.0          # V2b: pulled in from 35, so the overhang is pronounced
STROKE, ROOT_BOT = 1.9, 82.0
XS, TIPS = (24.0, 50.0, 76.0), (16.0, 2.0, 22.0)
CUTOUT_R, MARK_FILL = 0.43, 0.69

# --- the wheel, as the app paints it (soft: 46% toward white) ---
STOPS = [(0,'#0d21a5'),(4.5,'#3f57bd'),(6.5,'#8ba2f0'),(8,'#cfd3ee'),(9.5,'#f6e3b4'),
         (11,'#f7c948'),(17.5,'#f7c948'),(19.5,'#f8dfa0'),(20.5,'#ecdcdd'),
         (21.5,'#a9b6ea'),(22.5,'#5d74d2'),(24,'#0d21a5')]
def _hx(h): h=h.lstrip('#'); return [int(h[i:i+2],16) for i in (0,2,4)]
def _mix(a,b,t):
    A,B=_hx(a),_hx(b); return '#%02x%02x%02x'%tuple(round(A[i]+(B[i]-A[i])*t) for i in range(3))
def ramp(h):
    col = STOPS[-1][1]
    for i in range(1,len(STOPS)):
        if h <= STOPS[i][0]:
            a,b = STOPS[i-1],STOPS[i]; col = _mix(a[1],b[1],(h-a[0])/(b[0]-a[0])); break
    return _mix(col,'#ffffff',0.46)
WHEEL_RUN = [ramp(h) for h in (0,3,6,8,10,12)]

def leaf_path(W,H,lean):
    Wl, Wr, tx, wy = W*(1-lean*0.5), W*(1+lean*0.5), -W*lean*0.35, H*0.58
    f = lambda n: '%.2f' % n
    return ('M %s 0 C %s %s, %s %s, %s %s C %s %s, %s %s, %s %s L %s %s '
            'C %s %s, %s %s, %s %s C %s %s, %s %s, %s 0 Z') % (
        f(tx), f(Wr*0.10), f(H*0.24), f(Wr*0.78), f(wy-H*0.26), f(Wr), f(wy),
        f(Wr), f(wy+H*0.24), f(Wr*0.55), f(H*1.02), f(W*0.06), f(H), f(-W*0.06), f(H),
        f(-Wl*0.55), f(H*1.02), f(-Wl), f(wy+H*0.24), f(-Wl), f(wy),
        f(-Wl), f(wy-H*0.26), f(-Wl*0.10), f(H*0.24), f(tx))

def spindle(x0,y0,x1,y1,w0,n=22):
    """A vein drawn as a filled shape, so it can taper - a stroke of constant width cannot."""
    L,R = [],[]
    for i in range(n+1):
        t=i/n; x=x0+(x1-x0)*t; y=y0+(y1-y0)*t
        dx,dy=x1-x0,y1-y0; m=math.hypot(dx,dy) or 1; nx,ny=-dy/m,dx/m
        w=w0*math.sin(math.pi*(t**0.72))
        L.append((x+nx*w,y+ny*w)); R.append((x-nx*w,y-ny*w))
    pts = L + R[::-1]
    return 'M ' + ' L '.join('%.2f %.2f'%p for p in pts) + ' Z'

def grove(fg, bg):
    ry, cy, R = ROOT_BOT-ROOT_GAP, ROOT_BOT, CORNER
    out = []
    for cx, d, i in ((24.0,-1,0),(76.0,1,2)):
        base = TIPS[i]+LEAF_H
        out.append('M %s %.1f L %s %.1f Q %s %s %s %s L %s %s'
                   % (cx, base, cx, ry-R, cx, ry, cx+d*R, ry, cx+d*ROOT_REACH, ry))
    cb = TIPS[1]+LEAF_H
    out.append('M 50 %.1f L 50 %.1f Q 50 %s %s %s L %s %s'
               % (cb, cy-R, cy, 50-R, cy, 50-CENTRE_HALF, cy))
    out.append('M 50 %.1f Q 50 %s %s %s L %s %s' % (cy-R, cy, 50+R, cy, 50+CENTRE_HALF, cy))
    s = ('<g fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round" '
         'stroke-linejoin="round">%s</g>'
         % (fg, STROKE, ''.join('<path d="%s"/>' % p for p in out)))
    for cx, top in zip(XS, TIPS):
        s += ('<g transform="translate(%s,%s)"><path d="%s" fill="%s"/>'
              '<path d="%s" fill="%s"/></g>'
              % (cx, top, leaf_path(LEAF_W,LEAF_H,LEAN), fg,
                 spindle(0,LEAF_H*0.90,0,LEAF_H*0.12,LEAF_W*0.105), bg))
    return s

def extent():
    left  = min(24-ROOT_REACH, 50-CENTRE_HALF)
    right = max(76+ROOT_REACH, 50+CENTRE_HALF)
    return left-1.5, 0.0, (right-left)+3, ROOT_BOT+1.5

def icon_svg(px, cutout_r=CUTOUT_R):
    r = px*cutout_r
    stops = ''.join('<stop offset="%.1f%%" stop-color="%s"/>' % (i/(len(WHEEL_RUN)-1)*100, c)
                    for i, c in enumerate(WHEEL_RUN))
    x,y,w,h = extent()
    k = (2*r*MARK_FILL)/max(w,h)
    tx, ty = px/2-(x+w/2)*k, px/2-(y+h/2)*k
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">'
            '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">%s</linearGradient></defs>'
            '<rect width="%d" height="%d" fill="url(#g)"/>'
            '<circle cx="%s" cy="%s" r="%s" fill="#ffffff"/>'
            '<g transform="translate(%.2f,%.2f) scale(%.4f)">%s</g></svg>'
            % (px,px,px,px, stops, px,px, px/2,px/2,r, tx,ty,k, grove('#14161a','#ffffff')))

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
def render(svg, px, out, tmp):
    f = os.path.join(tmp,'f.html')
    open(f,'w').write('<!doctype html><meta charset="utf-8">'
        '<style>html,body{margin:0;padding:0;overflow:hidden}svg{display:block}</style>'+svg)
    subprocess.run([CHROME,'--headless','--disable-gpu','--hide-scrollbars',
        '--force-device-scale-factor=1','--window-size=%d,%d'%(px,px),
        '--screenshot='+out,'--virtual-time-budget=1200','file://'+f],
        check=True, capture_output=True)

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = sys.argv[1] if len(sys.argv)>1 else os.path.join(here,'..','app','icons')
    tmp = os.path.join(here,'.tmp')
    os.makedirs(out_dir, exist_ok=True); os.makedirs(tmp, exist_ok=True)
    # maskable: Android crops to the inner 80%, so the cutout comes in to keep its edge intact
    jobs = [('icon-192.png',192,CUTOUT_R), ('icon-512.png',512,CUTOUT_R),
            ('apple-touch-icon.png',180,CUTOUT_R), ('icon-maskable-512.png',512,0.34)]
    for name, px, cr in jobs:
        p = os.path.join(out_dir,name)
        render(icon_svg(px,cr), px, p, tmp)
        print('%-24s %6d bytes' % (name, os.path.getsize(p)))
    open(os.path.join(out_dir,'VARIANT'),'w').write('V2b - grove + roots in a wheel-gradient cutout\n')
    print('V2b written to %s' % os.path.normpath(out_dir))
