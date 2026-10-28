"""Turn a phone photo of the signature into art/signature/sketch-clean.png (black line on white, ~1000px wide).

Flattens paper tone and lighting, blurs away pencil grain, thresholds, and closes small gaps in faint strokes.
Run: python3 art/clean-photo.py photo.jpg left top right bottom [rotate] [threshold]
  crop box is in the photo's (EXIF-upright) pixels; rotate turns the crop counter-clockwise in degrees, for a
  signature written sideways; lower the threshold (default 0.925) to drop faint grid lines on squared paper.
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
rotate = float(sys.argv[6]) if len(sys.argv) > 6 else 0
threshold = float(sys.argv[7]) if len(sys.argv) > 7 else 0.925
img = ImageOps.exif_transpose(Image.open(photo)).convert('L').crop(tuple(int(v) for v in box))
img = img.rotate(rotate, expand=True, fillcolor=255) if rotate else img
a = np.asarray(img, float)
a = np.clip(a / ndimage.gaussian_filter(a, 40), 0, 1)  # paper tone and lighting -> white
small = Image.fromarray((a * 255).astype(np.uint8)).resize((1000, round(1000 * img.height / img.width)), Image.LANCZOS)
s = ndimage.gaussian_filter(np.asarray(small, float) / 255, 2.0)  # merge pencil grain into a solid line
ink = s < threshold
ink = ndimage.binary_closing(ink, structure=disk(4))
ink = ndimage.binary_opening(ink, structure=disk(1))
ink = remove_small_objects(ink, max_size=220)
Image.fromarray(np.where(ink, 0, 255).astype(np.uint8)).save(OUT)
print('wrote', OUT)
