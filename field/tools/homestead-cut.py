# THE HOMESTEAD'S CUT-OUTS (assets/homestead, js/homestead.js): cuts each place's four renders (day, night, day snow,
# night snow; Christian's, on flat magenta) out of the background, all four cropped to one shared box so they line up,
# with soft edges and lamp halos un-mixed from the magenta and pink light spill turned back into warm lamplight.
#   python3 field/tools/homestead-cut.py [place ...]      (no places: all of them, plus the Kinetic Garden's rotors)
# H is a folder holding day/ night/ daysnow/ nightsnow/ with the renders, named as in homestead-places.json
# (the Drive folder "Village", plus the extras Christian sent in chat). Needs numpy, scipy and Pillow.
import json, os, numpy as np
from PIL import Image
from scipy import ndimage
import os as _os
H=_os.environ.get('HOMESTEAD_RENDERS','/tmp/claude-0/hs'); OUT=_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),'../../assets/homestead')
src=json.load(open(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),'homestead-places.json')))
V=['day','night','daysnow','nightsnow']
def keyed(path, region=None):
    a=np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    if region: x0,y0,x1,y1=region; a=a.copy(); mask=np.zeros(a.shape[:2],bool); mask[y0:y1,x0:x1]=True
    border=np.concatenate([a[:6].reshape(-1,3),a[-6:].reshape(-1,3),a[:,:6].reshape(-1,3),a[:,-6:].reshape(-1,3)])
    bg=np.median(border,axis=0)
    m=np.minimum(a[...,0],a[...,2])-a[...,1]; mbg=min(bg[0],bg[2])-bg[1]
    al=np.clip(1-(m-45)/max(40,(mbg-15)-45),0,1)
    al[al<0.03]=0
    if region: al[~mask]=0
    # keep only pieces of real size (drops specks), then un-mix the background out of soft edges and glows
    lab,n=ndimage.label(al>0.5); 
    if n:
        sizes=ndimage.sum(np.ones_like(al),lab,range(1,n+1)); keep=np.isin(lab,1+np.nonzero(sizes>=400)[0])
        near=ndimage.binary_dilation(keep,iterations=40); al[~near]=0
    # Outside the building's own outline (door light spilling on the ground, lamp halos, smoke), take the least
    # opacity that still explains the colour over the magenta: a warm glow stays warm and smoke stays grey, not pink.
    solid=ndimage.binary_opening(al>0.97,iterations=1); sil=ndimage.binary_fill_holes(solid)
    out=~ndimage.binary_dilation(sil,iterations=2)
    # and anything pink, wherever it is: light spilling on the magenta, never the building itself
    r_,g_,b_=a[...,0],a[...,1],a[...,2]
    pink=((r_-g_>40)&(b_-g_>15)&(b_>0.55*r_))|(out&(r_-g_>40)&(b_-g_>0)&(b_>0.4*r_))|((r_>200)&(r_-g_>50)&(b_-g_>-5)&(b_>0.5*r_)&(g_>90))
    ysil=np.nonzero(sil.any(axis=1))[0]
    if len(ysil):
        low=np.zeros(al.shape,bool); low[int(ysil.max()-0.1*(ysil.max()-ysil.min())):]=True
        pink|=low&(r_>200)&(r_-g_>60)&(b_-g_>-25)&(b_>0.45*r_)&(g_>90)
    with np.errstate(divide='ignore',invalid='ignore'):
        lo=np.zeros(al.shape)
        for c in range(3):
            b=bg[c]; o=a[...,c]
            need=np.where(o<b,1-o/max(b,1),np.where(o>b,(o-b)/np.maximum(255-b,1),0))   # a >= this keeps F in 0..255
            lo=np.maximum(lo,need)
    lo=np.clip(lo,0,1); lo[lo<0.06]=0
    al=np.where(out,np.minimum(al,lo),al)
    A=al[...,None]; fg=np.where(A>0.02,(a-(1-A)*bg)/np.maximum(A,0.02),a)
    # pink is lamplight spilling over the magenta: keep how strong it is (the green it adds), in a warm lamp colour
    gl=np.clip((g_-bg[1])/max(1,255-bg[1]),0,1)*0.85; gl[gl<0.1]=0; gl[~ndimage.binary_dilation(sil,iterations=36)]=0
    fg=np.where(pink[...,None],np.array([255,212,150],np.float32),fg); al=np.where(pink,gl,al)
    return np.dstack([np.clip(fg,0,255),al*255])
def save(arr,box,name):
    x0,y0,x1,y1=box; im=Image.fromarray(arr[y0:y1,x0:x1].astype(np.uint8),'RGBA')
    if im.width>920: im=im.resize((920,round(im.height*920/im.width)),Image.LANCZOS)
    im.save(f'{OUT}/{name}.webp','WEBP',quality=80,method=6); return im.size
REG={'waterwheel':(0,0,690,768),'trailhead':(0,0,1330,768),'kinetic':(0,0,1000,768),'butterfly':(820,0,1376,768)}
sizes={}
import sys
ONLY=sys.argv[1:]
for p,vs in src.items():
    if ONLY and p not in ONLY: continue
    arrs={v:keyed(f'{H}/{v}/{vs[v]}',REG.get(p)) for v in V}
    ys,xs=np.nonzero(sum((arrs[v][...,3]>10) for v in V))
    box=(max(0,xs.min()-4),max(0,ys.min()-4),min(1376,xs.max()+5),min(768,ys.max()+5))
    for v in V: sizes[p]=save(arrs[v],box,f'{p}-{v}')
    print(p,box,sizes[p])
# the Kinetic Garden's rotors, each on its own (day and night), and the butterfly's two poses
def pieces(path,region,minsize=1500):
    arr=keyed(path,region); lab,n=ndimage.label(arr[...,3]>40)
    objs=[(s,(sl[1].start,sl[0].start,sl[1].stop,sl[0].stop)) for s,sl in zip(ndimage.sum(np.ones(lab.shape),lab,range(1,n+1)),ndimage.find_objects(lab))]
    return arr,[b for s,b in objs if s>=minsize]
for v in ([] if ONLY else ['day','night']):
    arr,bs=pieces(f'{H}/{v}/{src["kinetic"][v]}',(1120,0,1376,768),800)
    bs.sort(key=lambda b:(b[1]//60,b[0]))
    for i,b in enumerate(bs): sizes[f'rotor{i}']=save(arr,(b[0]-2,b[1]-2,b[2]+2,b[3]+2),f'rotor{i}-{v}'); print('rotor',i,b,v)
ONLY or json.dump(sizes,open(f'{H}/sizes.json','w'))
