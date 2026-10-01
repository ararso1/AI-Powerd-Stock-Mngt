"""Cover the printed label using clean burlap from the same row."""
from PIL import Image

SRC = r"C:\Users\Csolve\.cursor\projects\c-Users-Csolve-Documents-AI-Powerd-Stock-Mngt\assets\c__Users_Csolve_AppData_Roaming_Cursor_User_workspaceStorage_213d370ad7557cd9c64a68ab925c8fdb_images_photo_2026-10-01_11-54-31-06fc4e4a-6339-45a0-be85-b592ea351801.jpg"
DST = r"C:\Users\Csolve\Documents\AI-Powerd-Stock-Mngt\stock-frontend\public\doniya-sack.png"

im = Image.open(SRC).convert("RGB")
src = im.load()
out = im.copy()
px = out.load()
w, h = im.size


def lum(rgb):
    r, g, b = rgb
    return 0.3 * r + 0.59 * g + 0.11 * b


def usable(rgb):
    r, g, b = rgb
    if r > 225 and g > 215:
        return False
    return lum(rgb) > 105 and not (g > r + 6 and g > b + 4)


dest_x0, dest_x1 = 158, 348
dest_y0, dest_y1 = 146, 400

for y in range(dest_y0, dest_y1):
    cols = [src[x, y] for x in range(338, 370) if usable(src[x, y])]
    if len(cols) < 6:
        cols = [src[x, 120] for x in range(200, 320)]
    for x in range(dest_x0, dest_x1):
        i = (x * 2 + y) % len(cols)
        j = (i + 5) % len(cols)
        a, b = cols[i], cols[j]
        color = tuple((a[k] + b[k]) // 2 for k in range(3))
        edge = min(x - dest_x0, dest_x1 - 1 - x, y - dest_y0, dest_y1 - 1 - y)
        if edge < 14 and usable(src[x, y]):
            blend = edge / 14
            orig = src[x, y]
            color = tuple(int(color[k] * blend + orig[k] * (1 - blend)) for k in range(3))
        px[x, y] = color

out.save(DST)
print("wrote", out.size)
