"""Turn a phone photo of the signature into art/signature/sketch-clean.png (black line on white, ~1000px wide).

Flattens paper tone and lighting, blurs away pencil grain, thresholds, and closes small gaps in faint strokes.
Run: python3 art/clean-photo.py photo.jpg left top right bottom   (crop box in the upright photo's pixels)
Then: python3 art/trace-sketch.py sheet.png, update STROKES in build-signature.py, python3 art/build-signature.py
"""
import os
import sys

import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage
from skimage.morphology import disk, remove_small_objects

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'signature', 'sketch-clean.png')

photo, *box = sys.argv[1:6]
img = ImageOps.exif_transpose(Image.open(photo)).convert('L').crop(tuple(int(v) for v in box))
a = np.asarray(img, float)
a = np.clip(a / ndimage.gaussian_filter(a, 40), 0, 1)  # paper tone and lighting -> white
small = Image.fromarray((a * 255).astype(np.uint8)).resize((1000, round(1000 * img.height / img.width)), Image.LANCZOS)
s = ndimage.gaussian_filter(np.asarray(small, float) / 255, 2.0)  # merge pencil grain into a solid line
ink = s < 0.925
ink = ndimage.binary_closing(ink, structure=disk(4))
ink = ndimage.binary_opening(ink, structure=disk(1))
ink = remove_small_objects(ink, max_size=220)
Image.fromarray(np.where(ink, 0, 255).astype(np.uint8)).save(OUT)
print('wrote', OUT)
