"""Procedural PBR texture generator for the escape-room scene.

Every map is generated from seeded noise, so the output is fully reproducible.
Outputs albedo (sRGB), normal (OpenGL convention) and roughness maps into
assets/textures/. Tileable maps use FFT-filtered noise, which is periodic by
construction.

Usage: python3 -I scripts/gen_textures.py
"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "textures")
os.makedirs(OUT, exist_ok=True)


def rng(seed):
    return np.random.default_rng(seed)


def fft_noise(h, w, beta, seed, aniso=(1.0, 1.0)):
    """Periodic 1/f^beta noise normalised to [0,1]. aniso=(sy, sx) elongates features by sy along y, sx along x."""
    r = rng(seed)
    white = r.standard_normal((h, w))
    F = np.fft.fft2(white)
    fy = np.fft.fftfreq(h)[:, None] * aniso[0]
    fx = np.fft.fftfreq(w)[None, :] * aniso[1]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    F = F / (f ** beta)
    F[0, 0] = 0
    n = np.real(np.fft.ifft2(F))
    n -= n.min()
    n /= n.max()
    return n


def band_noise(h, w, lo, hi, seed, aniso=(1.0, 1.0)):
    """Periodic noise limited to a frequency band (in cycles per image). aniso=(sy, sx) elongates features."""
    r = rng(seed)
    white = r.standard_normal((h, w))
    F = np.fft.fft2(white)
    fy = np.fft.fftfreq(h, 1.0 / h)[:, None] * aniso[0]
    fx = np.fft.fftfreq(w, 1.0 / w)[None, :] * aniso[1]
    f = np.sqrt(fx * fx + fy * fy)
    mask = np.exp(-((np.log(f + 1e-6) - np.log((lo + hi) / 2)) ** 2) / (2 * (np.log(hi / lo) / 2) ** 2))
    n = np.real(np.fft.ifft2(F * mask))
    n = (n - n.mean()) / (n.std() + 1e-9)
    return n


def normal_from_height(hmap, strength):
    gx = (np.roll(hmap, -1, axis=1) - np.roll(hmap, 1, axis=1)) * 0.5
    gy = (np.roll(hmap, -1, axis=0) - np.roll(hmap, 1, axis=0)) * 0.5
    nx = -gx * strength
    ny = gy * strength
    nz = np.ones_like(hmap)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    n = np.stack([nx / l, ny / l, nz / l], axis=-1)
    return Image.fromarray(np.clip((n * 0.5 + 0.5) * 255 + 0.5, 0, 255).astype(np.uint8), "RGB")


def save_rgb(arr, name):
    Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8), "RGB").save(os.path.join(OUT, name), quality=93)


def save_gray(arr, name):
    Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8), "L").save(os.path.join(OUT, name), quality=93)


def lerp(a, b, t):
    return a + (b - a) * t


def srgb(c):
    return np.array(c, dtype=np.float64) / 255.0


# ---------------------------------------------------------------- wood floor
def wood_floor(size=2048, seed=11):
    """Dark oak planks, 8 planks across, running along the image's vertical axis."""
    H = W = size
    planks = 8
    pw = W // planks
    r = rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    albedo = np.zeros((H, W, 3))
    height = np.zeros((H, W))
    rough = np.zeros((H, W))
    # long-grain noise (stretched along v)
    grain_fine = band_noise(H, W, 60, 260, seed + 1, aniso=(16.0, 1.0))
    grain_mid = band_noise(H, W, 8, 40, seed + 2, aniso=(8.0, 1.0))
    warp = band_noise(H, W, 2, 10, seed + 3, aniso=(3.0, 1.0))
    blotch = band_noise(H, W, 3, 14, seed + 4)
    pores = band_noise(H, W, 300, 700, seed + 5, aniso=(6.0, 1.0))
    base_dark = srgb((46, 29, 18))
    base_light = srgb((104, 68, 40))
    for p in range(planks):
        x0 = p * pw
        # staggered plank joints along the length
        n_seg = 2
        offset = r.uniform(0, H)
        seg_len = H / n_seg
        for s in range(n_seg + 1):
            y0 = (offset + s * seg_len) % H
            tone = r.uniform(0.15, 0.85)
            ring_f = r.uniform(18, 34)
            ring_ph = r.uniform(0, 100)
            sl = slice(x0, x0 + pw)
            # mask of rows belonging to this segment (wrapping)
            rows = (np.arange(H) - y0) % H < seg_len
            m = rows[:, None]
            lx = (xx[:, sl] - x0) / pw
            rings = np.sin((lx * ring_f + warp[:, sl] * 2.2 + ring_ph) * np.pi * 2)
            rings = (rings * 0.5 + 0.5) ** 2.2
            t = np.clip(tone + 0.18 * grain_mid[:, sl] + 0.22 * rings - 0.1 + 0.06 * blotch[:, sl], 0, 1)
            col = lerp(base_dark, base_light, t[..., None])
            col *= (1.0 + 0.07 * grain_fine[:, sl][..., None])
            col *= (1.0 - 0.06 * np.clip(pores[:, sl], 0, None)[..., None])
            albedo[:, sl] = np.where(m[..., None], col, albedo[:, sl])
            hh = 0.5 + 0.08 * grain_fine[:, sl] + 0.1 * rings + 0.03 * pores[:, sl]
            height[:, sl] = np.where(m, hh, height[:, sl])
            rr = 0.52 + 0.1 * grain_mid[:, sl] - 0.08 * rings + 0.05 * blotch[:, sl]
            rough[:, sl] = np.where(m, rr, rough[:, sl])
            # joint line across the plank
            jy = int(y0) % H
            for d in range(-2, 3):
                row = (jy + d) % H
                k = 1.0 - abs(d) / 3.0
                albedo[row, sl] *= (1 - 0.65 * k)
                height[row, sl] -= 0.35 * k
                rough[row, sl] = 0.8
    # gaps between planks
    for p in range(planks):
        x = p * pw
        for d in range(-3, 4):
            col = (x + d) % W
            k = 1.0 - abs(d) / 4.0
            albedo[:, col] *= (1 - 0.7 * k)
            height[:, col] -= 0.45 * k
            rough[:, col] = np.maximum(rough[:, col], 0.75 * k)
    # scuffs / wear in the varnish
    wear = np.clip(band_noise(H, W, 4, 30, seed + 9), 0.8, None) - 0.8
    rough = np.clip(rough + wear * 0.4, 0.25, 0.9)
    save_rgb(np.clip(albedo, 0, 1), "floor_albedo.jpg")
    normal_from_height(height, 6.0).save(os.path.join(OUT, "floor_normal.jpg"), quality=93)
    save_gray(rough, "floor_rough.jpg")


# ---------------------------------------------------------------- plaster
def plaster(size=1024, seed=21):
    H = W = size
    low = band_noise(H, W, 1.5, 6, seed)
    mid = band_noise(H, W, 10, 40, seed + 1)
    fine = band_noise(H, W, 120, 400, seed + 2)
    trowel = band_noise(H, W, 6, 24, seed + 3, aniso=(1.0, 3.0))
    base = srgb((214, 203, 182))
    shade = srgb((176, 162, 138))
    t = np.clip(0.62 + 0.08 * low + 0.05 * mid + 0.06 * trowel, 0, 1)
    col = lerp(shade, base, t[..., None]) * (1 + 0.025 * fine[..., None])
    height = 0.5 + 0.25 * trowel + 0.12 * mid + 0.06 * fine
    rough = np.clip(0.86 + 0.05 * mid - 0.05 * np.clip(trowel, 0, None), 0.7, 0.97)
    save_rgb(np.clip(col, 0, 1), "plaster_albedo.jpg")
    normal_from_height(height, 2.2).save(os.path.join(OUT, "plaster_normal.jpg"), quality=93)
    save_gray(rough, "plaster_rough.jpg")


# ---------------------------------------------------------------- dark wood (furniture)
def dark_wood(size=1024, seed=31):
    H = W = size
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64) / size
    warp = band_noise(H, W, 2, 8, seed, aniso=(4.0, 1.0))
    fine = band_noise(H, W, 80, 300, seed + 1, aniso=(20.0, 1.0))
    mid = band_noise(H, W, 10, 40, seed + 2, aniso=(10.0, 1.0))
    rings = np.sin((xx * 34 + warp * 0.6) * np.pi * 2) * 0.5 + 0.5
    rings = rings ** 2
    a = srgb((30, 17, 10))
    b = srgb((84, 48, 26))
    t = np.clip(0.3 + 0.3 * rings + 0.15 * mid + 0.1 * fine, 0, 1)
    col = lerp(a, b, t[..., None])
    height = 0.5 + 0.12 * rings + 0.08 * fine
    rough = np.clip(0.38 + 0.08 * mid - 0.06 * rings + 0.04 * fine, 0.22, 0.7)
    save_rgb(col, "darkwood_albedo.jpg")
    normal_from_height(height, 3.0).save(os.path.join(OUT, "darkwood_normal.jpg"), quality=93)
    save_gray(rough, "darkwood_rough.jpg")


# ---------------------------------------------------------------- brushed / painted black steel
def steel(size=1024, seed=41):
    H = W = size
    brush = band_noise(H, W, 40, 500, seed, aniso=(1.0, 50.0))  # horizontal streaks
    blot = band_noise(H, W, 2, 10, seed + 1)
    speck = band_noise(H, W, 200, 500, seed + 2)
    r = rng(seed + 3)
    scratch = np.zeros((H, W))
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    for _ in range(160):
        x0, y0 = r.uniform(0, W), r.uniform(0, H)
        ang = r.normal(0, 0.5)
        ln = r.uniform(20, 160)
        d.line([(x0, y0), (x0 + np.cos(ang) * ln, y0 + np.sin(ang) * ln)], fill=int(r.uniform(60, 200)), width=1)
    scratch = np.asarray(img.filter(ImageFilter.GaussianBlur(0.6)), dtype=np.float64) / 255
    base = srgb((34, 33, 32))
    col = base[None, None, :] * (1 + 0.12 * brush[..., None] + 0.15 * blot[..., None]) + scratch[..., None] * 0.18
    rough = np.clip(0.42 + 0.08 * brush + 0.1 * blot + 0.04 * speck - scratch * 0.2, 0.2, 0.75)
    height = 0.5 + 0.05 * brush - 0.3 * scratch
    save_rgb(np.clip(col, 0, 1), "steel_albedo.jpg")
    normal_from_height(height, 2.0).save(os.path.join(OUT, "steel_normal.jpg"), quality=93)
    save_gray(rough, "steel_rough.jpg")


# ---------------------------------------------------------------- brass
def brass(size=512, seed=51):
    H = W = size
    tarn = band_noise(H, W, 2, 12, seed)
    fine = band_noise(H, W, 60, 250, seed + 1, aniso=(1.0, 20.0))
    smudge = band_noise(H, W, 6, 30, seed + 2)
    base = srgb((214, 168, 82))
    dark = srgb((112, 78, 34))
    t = np.clip(0.9 - 0.18 * np.clip(tarn - 0.8, 0, None) + 0.04 * fine, 0, 1)
    col = lerp(dark, base, t[..., None])
    rough = np.clip(0.3 + 0.15 * np.clip(tarn, 0, None) + 0.08 * smudge + 0.04 * fine, 0.15, 0.7)
    height = 0.5 + 0.06 * fine
    save_rgb(col, "brass_albedo.jpg")
    normal_from_height(height, 1.5).save(os.path.join(OUT, "brass_normal.jpg"), quality=93)
    save_gray(rough, "brass_rough.jpg")


# ---------------------------------------------------------------- paper
def paper(size=1024, seed=61):
    H = W = size
    fib = band_noise(H, W, 100, 400, seed)
    low = band_noise(H, W, 1.5, 6, seed + 1)
    base = srgb((222, 211, 186))
    col = base[None, None, :] * (1 + 0.03 * fib[..., None] + 0.05 * low[..., None])
    # handwritten-looking lines of "ink"
    img = Image.fromarray(np.clip(col * 255, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    r = rng(seed + 2)
    for blk in range(4):
        bx, by = (blk % 2) * W // 2 + 40, (blk // 2) * H // 2 + 50
        for line in range(11):
            y = by + 30 + line * 36
            x = bx + r.uniform(0, 20)
            end = bx + r.uniform(260, W // 2 - 70)
            while x < end:
                wl = r.uniform(18, 60)
                pts = []
                for k in range(int(wl / 3)):
                    pts.append((x + k * 3, y + np.sin(k * 1.3 + r.uniform(0, 6)) * 4))
                d.line(pts, fill=(48, 36, 30), width=2)
                x += wl + r.uniform(8, 16)
        # a circled note in each block
        cx, cy = bx + r.uniform(60, 300), by + r.uniform(80, 360)
        d.ellipse([cx - 40, cy - 22, cx + 40, cy + 22], outline=(120, 30, 24), width=3)
    img = img.filter(ImageFilter.GaussianBlur(0.5))
    img.save(os.path.join(OUT, "paper_albedo.jpg"), quality=93)
    normal_from_height(0.5 + 0.05 * fib, 2.0).save(os.path.join(OUT, "paper_normal.jpg"), quality=93)


# ---------------------------------------------------------------- book spines atlas
def books(seed=71):
    """1024x1024 atlas of 16 spines (cols) x 1 row; each spine is 64 px wide."""
    W, H = 1024, 1024
    r = rng(seed)
    palettes = [
        (92, 28, 24), (62, 22, 18), (46, 36, 28), (110, 72, 36), (30, 26, 22),
        (74, 52, 30), (120, 92, 52), (54, 44, 34), (84, 34, 26), (40, 40, 30),
        (138, 104, 56), (66, 30, 22), (26, 24, 22), (96, 64, 38), (58, 48, 26), (78, 26, 30),
    ]
    img = Image.new("RGB", (W, H))
    rough = Image.new("L", (W, H))
    d = ImageDraw.Draw(img)
    dr = ImageDraw.Draw(rough)
    leather = band_noise(H, W, 60, 300, seed + 1)
    for i in range(16):
        x0 = i * 64
        c = palettes[i]
        d.rectangle([x0, 0, x0 + 63, H], fill=c)
        dr.rectangle([x0, 0, x0 + 63, H], fill=int(r.uniform(140, 200)))
        gold = (196, 156, 78)
        style = i % 4
        bands = [0.08, 0.14, 0.86, 0.92] if style != 2 else [0.1, 0.9]
        for b in bands:
            y = int(b * H)
            d.rectangle([x0 + 4, y, x0 + 59, y + 10], fill=gold if style != 3 else tuple(int(v * 0.6) for v in c))
            dr.rectangle([x0 + 4, y, x0 + 59, y + 10], fill=70)
        # title plate / lettering strokes
        ty = int(r.uniform(0.28, 0.4) * H)
        if style in (0, 2):
            d.rectangle([x0 + 10, ty, x0 + 53, ty + 160], fill=(26, 20, 16))
            for k in range(5):
                d.rectangle([x0 + 26, ty + 16 + k * 28, x0 + 37, ty + 34 + k * 28], fill=gold)
        else:
            for k in range(6):
                d.rectangle([x0 + 27, ty + k * 26, x0 + 36, ty + 16 + k * 26], fill=gold)
        # spine ribs (raised bands) shading
        for k in range(64):
            shade = 0.72 + 0.28 * np.sin(np.pi * k / 63)
            pass
    arr = np.asarray(img, dtype=np.float64) / 255
    xs = (np.arange(W) % 64) / 63.0
    shade = 0.55 + 0.45 * np.sin(np.pi * xs) ** 0.6
    arr = arr * shade[None, :, None] * (1 + 0.06 * leather[..., None])
    save_rgb(np.clip(arr, 0, 1), "books_albedo.jpg")
    rough.save(os.path.join(OUT, "books_rough.jpg"), quality=93)
    h = shade[None, :].repeat(H, 0) * 0.6 + 0.05 * leather
    normal_from_height(h, 4.0).save(os.path.join(OUT, "books_normal.jpg"), quality=93)


# ---------------------------------------------------------------- oil painting
def painting(seed=81):
    """A moody oil landscape: dusk sea, a lighthouse on a cliff, warm glow on the horizon."""
    W, H = 768, 1024
    r = rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    u, v = xx / W, yy / H
    horizon = 0.58
    # sky: dark umber at the top, warm amber glow near the horizon
    sky = lerp(srgb((30, 24, 20)), srgb((120, 82, 44)), np.clip(v / horizon, 0, 1)[..., None] ** 2.2)
    glow = np.exp(-((v - horizon) ** 2) / 0.006) * np.exp(-((u - 0.66) ** 2) / 0.05)
    sky = sky + glow[..., None] * (srgb((255, 196, 80)) - sky) * 0.85
    clouds = band_noise(H, W, 3, 12, seed, aniso=(1.0, 3.5))
    sky = sky * (1 + 0.22 * clouds[..., None])
    # sea: dark with warm reflection streaks under the glow
    waves = band_noise(H, W, 20, 90, seed + 1, aniso=(1.0, 7.0))
    sea = srgb((40, 34, 28))[None, None, :] * (1 + 0.35 * waves[..., None]) * (0.6 + 0.4 * (1 - (v - horizon) / (1 - horizon)))[..., None]
    refl = np.exp(-((u - 0.66) ** 2) / (0.004 + 0.06 * np.clip(v - horizon, 0, 1))) * np.clip(waves, 0, None)
    sea = sea + refl[..., None] * srgb((230, 160, 60)) * 0.55
    img = np.where((v < horizon)[..., None], sky, sea)
    # cliff on the left
    prof = horizon - 0.2 * np.clip(1 - u[0] / 0.42, 0, 1) ** 0.6 + 0.01 * band_noise(1, W, 6, 50, seed + 3)[0]
    cliff_mask = (v > prof[None, :]) & (u < 0.42 + 0.35 * np.clip(v - horizon, 0, 1)) & (u < 0.42 + 0.0 * v + 0.35 * np.clip(v - prof[None, :], 0, 1))
    rock = srgb((24, 20, 17))[None, None, :] * (1 + 0.35 * band_noise(H, W, 15, 70, seed + 4)[..., None])
    img = np.where(cliff_mask[..., None], rock, img)
    pil = Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(pil)
    lx = int(W * 0.17)
    ly = int(H * prof[int(W * 0.17)]) + 4
    d.polygon([(lx - 20, ly), (lx + 20, ly), (lx + 13, ly - 170), (lx - 13, ly - 170)], fill=(150, 128, 98))
    for k in range(3):
        y0 = ly - 40 - k * 45
        d.rectangle([lx - 18 + k * 3, y0, lx + 18 - k * 3, y0 + 14], fill=(110, 30, 24))
    d.rectangle([lx - 17, ly - 196, lx + 17, ly - 170], fill=(255, 220, 120))
    d.polygon([(lx - 22, ly - 196), (lx + 22, ly - 196), (lx, ly - 222)], fill=(28, 24, 20))
    beam = Image.new("L", (W, H), 0)
    ImageDraw.Draw(beam).polygon([(lx, ly - 183), (W, ly - 300), (W, ly - 90)], fill=90)
    beam = beam.filter(ImageFilter.GaussianBlur(22))
    pil = Image.composite(Image.new("RGB", (W, H), (255, 214, 120)), pil, beam)
    halo = Image.new("L", (W, H), 0)
    ImageDraw.Draw(halo).ellipse([lx - 60, ly - 243, lx + 60, ly - 123], fill=140)
    halo = halo.filter(ImageFilter.GaussianBlur(26))
    pil = Image.composite(Image.new("RGB", (W, H), (255, 200, 100)), pil, halo)
    # brush strokes sampled from the underpainting
    base = np.asarray(pil, dtype=np.float64) / 255
    strokes = pil.copy()
    sd = ImageDraw.Draw(strokes)
    height = Image.new("L", (W, H), 110)
    hd = ImageDraw.Draw(height)
    for _ in range(16000):
        x, y = r.uniform(0, W), r.uniform(0, H)
        c = base[int(y) % H, int(x) % W]
        if y / H < horizon:
            ang = r.normal(0.0, 0.3)
        else:
            ang = r.normal(0.0, 0.08)
        ln = r.uniform(6, 22)
        jit = r.normal(0, 0.03, 3)
        cc = tuple(int(np.clip(v_ * r.uniform(0.92, 1.08) + j, 0, 1) * 255) for v_, j in zip(c, jit))
        wdt = int(r.uniform(2, 6))
        pts = [(x, y), (x + np.cos(ang) * ln, y + np.sin(ang) * ln)]
        sd.line(pts, fill=cc, width=wdt)
        hd.line(pts, fill=int(r.uniform(150, 240)), width=wdt)
    pil = Image.blend(pil, strokes, 0.85).filter(ImageFilter.GaussianBlur(0.5))
    a = np.asarray(pil, dtype=np.float64) / 255
    vign = np.clip(1 - 0.55 * ((u - 0.5) ** 2 + (v - 0.5) ** 2) * 2.4, 0, 1)
    a = a * vign[..., None] * srgb((255, 238, 205))
    crack = band_noise(H, W, 40, 120, seed + 6)
    crackl = (np.abs(crack) < 0.035).astype(np.float64)
    a = a * (1 - 0.2 * crackl[..., None])
    save_rgb(np.clip(a, 0, 1), "painting_albedo.jpg")
    h = np.asarray(height.filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float64) / 255
    canvas = band_noise(H, W, 250, 380, seed + 7)
    normal_from_height(h * 0.6 + 0.04 * canvas - 0.1 * crackl, 3.0).save(os.path.join(OUT, "painting_normal.jpg"), quality=93)


# ---------------------------------------------------------------- rug
def rug(seed=91):
    W, H = 1024, 1536
    r = rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    u, v = xx / W, yy / H
    base = srgb((88, 52, 30))
    border = srgb((40, 26, 18))
    accent = srgb((176, 128, 52))
    col = np.ones((H, W, 3)) * base
    edge = np.minimum(np.minimum(u, 1 - u) * W / H, np.minimum(v, 1 - v))
    col = np.where((edge < 0.08)[..., None], border, col)
    col = np.where(((edge > 0.085) & (edge < 0.1))[..., None], accent, col)
    # central medallion pattern
    cu, cv = (u - 0.5) * W / H, v - 0.5
    rr = np.sqrt(cu ** 2 + cv ** 2)
    ang = np.arctan2(cv, cu)
    pat = np.sin(rr * 60 + np.sin(ang * 8) * 2) > 0.6
    col = np.where((pat & (rr < 0.22))[..., None], accent * 0.8, col)
    diamonds = (np.abs(np.sin(u * 40) * np.sin(v * 60)) > 0.85) & (edge > 0.12) & (rr > 0.25)
    col = np.where(diamonds[..., None], border * 1.4, col)
    fuzz = band_noise(H, W, 200, 500, seed + 1)
    wear = band_noise(H, W, 3, 12, seed + 2)
    col = col * (1 + 0.12 * fuzz[..., None] + 0.08 * wear[..., None])
    save_rgb(np.clip(col, 0, 1), "rug_albedo.jpg")
    normal_from_height(0.5 + 0.2 * fuzz, 2.0).save(os.path.join(OUT, "rug_normal.jpg"), quality=93)


if __name__ == "__main__":
    which = sys.argv[1:] or ["wood_floor", "plaster", "dark_wood", "steel", "brass", "paper", "books", "painting", "rug"]
    for name in which:
        print("generating", name, flush=True)
        globals()[name]()
    print("done")
