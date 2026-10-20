# Usage: python3 field/tools/niche-cutout.py <render.jpg> assets/homestead/niche-<first place id>.webp [preview.png] [--glass]
# (the Lake Home cabinet's shelf objects; --glass keeps a little body in gray seen through glass)
# Cut a shelf object out of its flat-ish gray background: fit the background as a smooth surface, key against it,
# keep enclosed gray (inside glass) a little opaque, un-mix the gray from soft edges, trim.
import sys
from PIL import Image, ImageFilter, ImageDraw
import numpy as np
def cut(src, dst, sheet_dst=None, glass=False):
    im=Image.open(src).convert('RGB'); a=np.asarray(im).astype(float); h,w,_=a.shape
    sat=a.max(2)-a.min(2)
    ys,xs=np.mgrid[0:h,0:w]; X=xs/w-.5; Y=ys/h-.5
    F=np.stack([np.ones_like(X),X,Y,X*X,Y*Y,X*Y],-1)
    corner=np.median(np.concatenate([a[:15].reshape(-1,3),a[-15:].reshape(-1,3)]),0)
    m=(np.sqrt(((a-corner)**2).sum(2))<40)&(sat<14)
    for _ in range(3):
        idx=np.flatnonzero(m.ravel())[::7]
        coef=np.linalg.lstsq(F.reshape(-1,6)[idx],a.reshape(-1,3)[idx],rcond=None)[0]
        bg=(F.reshape(-1,6)@coef).reshape(h,w,3)
        d=np.sqrt(((a-bg)**2).sum(2))
        m=(d<10)&(sat<14)
    alpha=np.clip((d-6)/18,0,1)
    near=Image.fromarray(np.where(d<9,255,0).astype('uint8')).copy()   # (a copy: a fill on an array-backed image does nothing)
    for x in range(0,w,10):
        for y in (0,h-1):
            if near.getpixel((x,y))==255: ImageDraw.floodfill(near,(x,y),128)
    for y in range(0,h,10):
        for x in (0,w-1):
            if near.getpixel((x,y))==255: ImageDraw.floodfill(near,(x,y),128)
    outside=np.asarray(near)==128
    alpha=np.where(d<9,0,alpha) if not glass else np.where(outside,np.where(d<9,0,alpha),np.maximum(alpha,.3))   # gray inside glass keeps a little body
    A=Image.fromarray((alpha*255).astype('uint8')).filter(ImageFilter.GaussianBlur(.7))
    al=np.asarray(A).astype(float)[...,None]/255
    rgb=np.clip((a-bg*(1-al))/np.maximum(al,1e-3),0,255); rgb=np.where(al>.02,rgb,0)
    out=Image.fromarray(np.dstack([rgb,np.asarray(A)]).astype('uint8'),'RGBA')
    bb=out.getchannel('A').point(lambda v:255 if v>24 else 0).getbbox()
    out=out.crop((max(0,bb[0]-4),max(0,bb[1]-4),min(w,bb[2]+4),min(h,bb[3]+4)))
    out.thumbnail((520,620),Image.LANCZOS)
    out.save(dst,quality=88,method=6)
    if sheet_dst: out.save(sheet_dst)
    return out
if __name__=='__main__':
    o=cut(sys.argv[1],sys.argv[2],sys.argv[3] if len(sys.argv)>3 else None,'--glass' in sys.argv); print(sys.argv[2],o.size)
