# Builds the logo's seasonal SVG overlays (back: tints, sun, night sky; front: petals, bird,
# leaves, snow, night tint) and writes them into index.html and about/index.html. Run from the repo root.
import random, re
random.seed(7)
def parts(cls, n, shape, xs=(20,220), ys=(10,230), dur=(7,11), sc=1.7):
    out=[]
    for i in range(n):
        x=random.uniform(*xs); y=random.uniform(*ys); d=random.uniform(*dur); dl=-random.uniform(0,d)
        sway=random.choice([1,-1])*random.uniform(6,16); rot=random.uniform(-180,180)
        out.append(f'<g class="{cls}" style="--sway:{sway:.0f}px;animation-duration:{d:.1f}s;animation-delay:{dl:.1f}s"><g transform="translate({x:.0f} {y:.0f}) rotate({rot:.0f}) scale({sc})">{shape(i)}</g></g>')
    return ''.join(out)
leafc=['#ffd23f','#e2402a','#ffb02e','#c8e04a']
leaf=lambda i:f'<g class="spin" style="animation-delay:-{i*.7:.1f}s"><path d="M0-5C4-4 5 0 0 5C-5 0-4-4 0-5Z" fill="{leafc[i%4]}" stroke="#5a2410" stroke-width=".6"/><path d="M0-4V5" stroke="#6b2e14" stroke-width=".7"/></g>'
petal=lambda i:f'<ellipse rx="2.6" ry="1.6" fill="{["#f7c2d4","#f39ab9","#fff0f5"][i%3]}"/>'
flake=lambda i:f'<circle r="{[1.3,1.7,2.1][i%3]}" fill="#fff" opacity=".9"/>'
star=lambda x,y,r,dl:f'<circle class="tw" cx="{x}" cy="{y}" r="{r}" fill="#fff" style="animation-delay:{dl}s"/>'
flower=lambda x,y,c:f'<g transform="translate({x} {y})"><path d="M0 0V9" stroke="#4c8a3a" stroke-width="1.4"/>'+''.join(f'<circle cx="{2.4*__import__("math").cos(a*1.2566):.1f}" cy="{2.4*__import__("math").sin(a*1.2566):.1f}" r="1.9" fill="{c}"/>' for a in range(5))+'<circle r="1.3" fill="#ffd34d"/></g>'
BACK=('<svg class="lg-fx lg-back" viewBox="0 0 240 240" aria-hidden="true">'
 '<defs><radialGradient id="lgSun" cx=".82" cy=".16" r=".6"><stop offset="0" stop-color="#fff3b0" stop-opacity="1"/><stop offset=".35" stop-color="#ffd36b" stop-opacity=".5"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient></defs>'
 '<g class="s s-spring"><rect width="240" height="240" fill="#bfe6a8" opacity=".12"/></g>'
 '<g class="s s-summer"><rect width="240" height="240" fill="url(#lgSun)"/></g>'
 '<g class="s s-fall"><rect width="240" height="240" fill="#e0782a" opacity=".14"/></g>'
 '<g class="s s-winter"><rect width="240" height="240" fill="#a8c8ec" opacity=".28"/></g>'
 '<g class="n"><rect width="240" height="240" fill="#0d1a3d" opacity=".62"/>'
 + ''.join(star(x,y,r,d) for x,y,r,d in [(184,62,1.6,0),(214,84,1.3,1.1),(196,104,1.1,2.3),(222,124,1.5,.6),(204,146,1.1,1.8),(186,170,1.3,2.9),(30,150,1.2,1.4),(42,176,1.5,.3),(22,124,1.1,2)])
 + '<g transform="translate(200 40)"><circle r="12" fill="#f4f1e0"/><circle cx="6" cy="-3" r="11" fill="#1f2b52"/></g></g>'
 '</svg>')
FRONT=('<svg class="lg-fx lg-front" viewBox="0 0 240 240" aria-hidden="true">'
 '<g class="s s-spring">'+flower(34,172,'#f39ab9')+flower(46,184,'#fff')+flower(28,190,'#f7c2d4')+flower(204,176,'#f39ab9')+flower(214,162,'#fff')+parts('fall drift',9,petal)+'</g>'
 '<g class="s s-summer"><g class="glide"><path d="M0 0q7-6 13 0q6-6 13 0" fill="none" stroke="#3b2a24" stroke-width="2.2" stroke-linecap="round"/></g></g>'
 '<g class="s s-fall"></g>'  # fall: the amber tint and rust ring are enough (leaves removed Oct 2)
 '<g class="s s-winter">'+parts('fall',22,flake,dur=(6,10))+'</g>'
 '<g class="n"><rect width="240" height="240" fill="#1a2a5a" opacity=".22"/></g>'
 '</svg>')
import sys
for p in ['index.html','about/index.html']:
    s=open(p).read()
    s=re.sub(r'<svg class="lg-fx lg-back".*?</svg>','',s); s=re.sub(r'<svg class="lg-fx lg-front".*?</svg>','',s)
    s=re.sub(r'(<img src="[^"]*plate\.webp"[^>]*>)',lambda m:m.group(1)+BACK,s)
    s=re.sub(r'(<img class="lg-head"[^>]*>)',lambda m:m.group(1)+FRONT,s)
    open(p,'w').write(s)
print(len(BACK)+len(FRONT))
