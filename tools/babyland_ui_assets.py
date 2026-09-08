"""Bake generated UI art and the first wardrobe layers; no runtime fitting."""
from pathlib import Path
from PIL import Image, ImageOps
import numpy as np
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/babyland/gpt-image'
PUBLIC = ROOT / 'public/art/babyland'

def visible_crop(im):
    # Ignore faint generated alpha dust that previously enlarged the crop box.
    bounds = im.getchannel('A').point(lambda a: 255 if a > 32 else 0).getbbox()
    if not bounds:
        raise ValueError('Empty image')
    return im.crop(bounds)

def thumbnail(im, size=192):
    art = ImageOps.contain(visible_crop(im), (size - 24, size - 24), Image.Resampling.LANCZOS)
    result = Image.new('RGBA', (size, size))
    result.alpha_composite(art, ((size-art.width)//2, (size-art.height)//2))
    return result

def build():
    dest = PUBLIC / 'ui'
    dest.mkdir(exist_ok=True)
    for name in ('hair', 'top', 'bottom', 'shoes', 'acc', 'makeup'):
        im = Image.open(SOURCE / 'ui-source' / f'{name}.png').convert('RGBA')
        thumbnail(im).save(dest / f'{name}.png', optimize=True)
    Image.open(SOURCE / 'ui-source/panel.png').resize((512,512), Image.Resampling.LANCZOS).save(dest / 'panel.png', optimize=True)
    # Offline rig anchors: common waist=430; sleeve envelope matches shoulders.
    # Actual opaque bounds, not alpha dust, determine the source registration.
    placements = {'top_ruffles': (148, 268, 300, 177), 'bot_tutu': (143, 430, 310, 151), 'top_hoodie_baggy': (133, 238, 330, 336)}
    layers = {}
    for name, (x,y,w,h) in placements.items():
        im = Image.open(SOURCE / 'wardrobe-source' / f'{name}.png').convert('RGBA')
        if name == 'top_hoodie_baggy':
            pixels = np.asarray(im).copy()
            rgb = pixels[:,:,:3].astype(float)
            green = np.clip((rgb[:,:,1] - np.maximum(rgb[:,:,0],rgb[:,:,2])) / 180, 0, 1)
            pixels[:,:,3] = np.round(255 * (1-green)).astype('uint8')
            pixels[:,:,1] = np.minimum(pixels[:,:,1], np.maximum(pixels[:,:,0],pixels[:,:,2]))
            im = Image.fromarray(pixels)
        crop = visible_crop(im)
        if name == 'top_hoodie_baggy':
            # Register hood and shoulder independently of sleeve length.
            seam = round(crop.height * .17)
            art = Image.new('RGBA', (w,h))
            art.alpha_composite(crop.crop((0,0,crop.width,seam)).resize((w,30),Image.Resampling.LANCZOS))
            art.alpha_composite(crop.crop((0,seam,crop.width,crop.height)).resize((w,h-30),Image.Resampling.LANCZOS),(0,30))
        else:
            art = crop.resize((w,h), Image.Resampling.LANCZOS)
        layer = Image.new('RGBA', (596,1200))
        layer.alpha_composite(art, (x,y))
        layer.save(PUBLIC / 'items' / f'{name}.png', optimize=True)
        thumbnail(art).save(PUBLIC / 'items' / f'{name}.thumb.png', optimize=True)
        layers[name] = layer
    composite = Image.new('RGBA', (596,1200), '#dac0cd')
    composite.alpha_composite(Image.open(SOURCE / 'base.png').convert('RGBA'))
    for name in ('bot_tutu','top_ruffles'):
        composite.alpha_composite(layers[name])
    composite.save(SOURCE / 'fit-check.png')
    path = PUBLIC / 'manifest.json'
    manifest = json.loads(path.read_text(encoding='utf-8'))
    manifest['items']['top_hoodie_baggy'] = {'slot':'top','z':40,'src':'items/top_hoodie_baggy.png','thumb':'items/top_hoodie_baggy.thumb.png','placed':True}
    path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    composite = Image.new('RGBA', (596,1200), '#dac0cd')
    composite.alpha_composite(Image.open(SOURCE / 'base.png').convert('RGBA'))
    composite.alpha_composite(layers['bot_tutu'])
    composite.alpha_composite(layers['top_hoodie_baggy'])
    composite.save(SOURCE / 'hoodie-fit-check.png')
    print('UI: 6 icons + reusable panel; wardrobe: 3 layers 596x1200; alpha-aware thumbnails')

if __name__ == '__main__':
    build()
