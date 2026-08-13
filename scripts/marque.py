#!/usr/bin/env python3
"""Reconstruit le logo AMN DEVSEC en SVG, depuis sa géométrie.

Ce que montre l'original, et que ce script reproduit :
  - les trois lettres forment une ligne de crête continue : A = chevron
    SANS barre, M = deux pics dont la vallée touche la ligne de base,
    N = pic + longue diagonale + montant presque vertical coupé en haut ;
  - toutes les POINTES culminent exactement à la même hauteur, tous les
    pieds sont coupés À PLAT sur la même ligne de base ;
  - les lettres se CROISENT : le pied droit du A passe derrière le
    premier trait du M, le dernier trait du M derrière le premier du N —
    c'est ce qui fait la « ligne continue ».

Chaque trait est un PARALLÉLOGRAMME PLEIN (pas un trait SVG) : les
pointes sont des sommets exacts, les pieds des coupes horizontales
exactes, et l'épaisseur perçue est constante quel que soit l'angle.
Les proportions sont mesurées sur l'image d'origine.

Sorties (assets/marque/) :
  logo-full.svg     AMN + DEVSEC, blanc sur transparent
  logo-mark.svg     monogramme seul, cadrage serré
  logo-dark.svg     version noire pour fond clair
  favicon.svg       monogramme épaissi dans un carré (16 px)
  favicon-a.svg     VARIANTE : le chevron A seul — proposée parce que
                    trois lettres dans 16 px, ça se mesure (voir aperçus)
"""
import os
import sys

# ── Géométrie de référence, mesurée sur l'image (H = hauteur de crête) ──
H = 34.0
T = 1.0            # y des pointes hautes
B = T + H          # y de la ligne de base
K = H / 365.0      # échelle image → unités

def x(px):         # abscisse image → unités, calée sur une marge de 3
    return px * K - 120 * K + 3.0

A_FL, A_AP, A_FR = x(120), x(270), x(420)
M_F1, M_P1, M_V, M_P2, M_F2 = x(350), x(465), x(580), x(700), x(815)
N_F1, N_PK, N_VN, N_END = x(780), x(890), x(1000), x(1060)

T_PERP = 1.05      # épaisseur perpendiculaire des traits (fidèle : fin)


def demi(xa, xb, t):
    """Demi-largeur HORIZONTALE d'un trait d'épaisseur perpendiculaire t."""
    dx = abs(xb - xa)
    long_ = (dx * dx + H * H) ** 0.5
    return (t / 2.0) * long_ / H


def inter(l1, l2):
    """Intersection de deux droites, chacune donnée par deux points."""
    (x1, y1), (x2, y2) = l1
    (x3, y3), (x4, y4) = l2
    d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / d
    py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / d
    return (px, py)


def dec(l, dx):
    """La même droite, décalée horizontalement de dx."""
    (a, b) = l
    return ((a[0] + dx, a[1]), (b[0] + dx, b[1]))


def lettres(t):
    """Les trois polygones A, M, N pour une épaisseur donnée.

    Convention par trait : deux bords parallèles écartés de 2h à
    l'horizontale. Un bord passe par la POINTE qu'il forme (le sommet
    exact), l'autre s'en déduit. Les pointes culminent donc précisément
    à y=T et la vallée touche précisément y=B — « hauteurs égales »
    n'est pas un à-peu-près, c'est une contrainte du tracé.
    """
    # ---- A : chevron sans barre ----
    h = demi(A_FL, A_AP, t)
    tip = (A_AP, T)
    g = (tip, (A_FL - h, B))          # bord gauche du trait montant
    d_ = (tip, (A_FR + h, B))         # bord droit du trait descendant
    creux = inter(dec(g, 2 * h), dec(d_, -2 * h))
    A = [(A_FL - h, B), tip, (A_FR + h, B), (A_FR - h, B), creux, (A_FL + h, B)]

    # ---- M : deux pics, vallée en pointe sur la ligne de base ----
    h1 = demi(M_F1, M_P1, t); h2 = demi(M_P1, M_V, t)
    h3 = demi(M_V, M_P2, t);  h4 = demi(M_P2, M_F2, t)
    p1, v, p2 = (M_P1, T), (M_V, B), (M_P2, T)
    s1g = (p1, (M_F1 - h1, B)); s1d = dec(s1g, 2 * h1)
    s2d = (p1, (M_V + 2 * h2, B)); s2g = dec(s2d, -2 * h2)   # bord gauche passe par v
    s3d = (v, (M_P2 + 2 * h3, T)); s3g = dec(s3d, -2 * h3)   # bord gauche passe par p2
    s4d = (p2, (M_F2 + h4, B)); s4g = dec(s4d, -2 * h4)
    M = [(M_F1 - h1, B), p1, inter(s2d, s3g), p2, (M_F2 + h4, B),
         (M_F2 - h4, B), inter(s4g, s3d), v, inter(s2g, s1d), (M_F1 + h1, B)]

    # ---- N : pic, diagonale, montant quasi vertical coupé en haut ----
    h1 = demi(N_F1, N_PK, t); h2 = demi(N_PK, N_VN, t); h3 = demi(N_VN, N_END, t)
    pk, vn = (N_PK, T), (N_VN, B)
    s1g = (pk, (N_F1 - h1, B)); s1d = dec(s1g, 2 * h1)
    s2d = (pk, (N_VN + 2 * h2, B)); s2g = dec(s2d, -2 * h2)
    s3d = (vn, (N_END + h3, T)); s3g = dec(s3d, -2 * h3)
    N = [(N_F1 - h1, B), pk, inter(s2d, s3g), (N_END - h3, T), (N_END + h3, T),
         vn, inter(s2g, s1d), (N_F1 + h1, B)]
    return [A, M, N]


def chemin(polys):
    bouts = []
    for p in polys:
        pts = ' '.join(f'{px:.2f},{py:.2f}' for px, py in p)
        bouts.append(f'M{pts}Z')
    return ' '.join(bouts).replace('M', 'M ', 1).replace('M ', 'M', 1)


def bornes(polys, marge):
    xs = [p[0] for poly in polys for p in poly]
    ys = [p[1] for poly in polys for p in poly]
    return (min(xs) - marge, min(ys) - marge,
            max(xs) - min(xs) + 2 * marge, max(ys) - min(ys) + 2 * marge)


# ── DEVSEC : capitales géométriques tracées au trait ────────────────────
CAP = 6.5
SW = 0.95

def devsec(x0, y0):
    y1, ym = y0 + CAP, y0 + CAP / 2
    r = CAP / 2
    t = []
    cx = x0
    # D — barre + demi-cercle
    t.append(f'M{cx},{y0} V{y1} M{cx},{y0} H{cx+2.0} A{r},{r} 0 0 1 {cx+2.0},{y1} H{cx}')
    cx += 2.0 + r + 5.6
    # E
    t.append(f'M{cx+4.9},{y0} H{cx} V{y1} H{cx+4.9} M{cx},{ym} H{cx+4.3}')
    cx += 4.9 + 5.6
    # V
    t.append(f'M{cx},{y0} L{cx+3.55},{y1} L{cx+7.1},{y0}')
    cx += 7.1 + 5.6
    # S — deux courbes opposées
    t.append(
        f'M{cx+4.75},{y0+1.0} C{cx+4.3},{y0-0.12} {cx+0.55},{y0-0.18} {cx+0.42},{y0+1.62} '
        f'C{cx+0.30},{y0+3.30} {cx+4.68},{y0+3.10} {cx+4.82},{y0+4.85} '
        f'C{cx+4.95},{y0+6.68} {cx+0.72},{y0+6.72} {cx+0.22},{y0+5.42}')
    cx += 5.15 + 5.6
    # E
    t.append(f'M{cx+4.9},{y0} H{cx} V{y1} H{cx+4.9} M{cx},{ym} H{cx+4.3}')
    cx += 4.9 + 5.6
    # C — arc ouvert à droite
    t.append(f'M{cx+5.1},{y0+1.05} A{r+0.1},{r+0.1} 0 1 0 {cx+5.1},{y1-1.05}')
    cx += 5.1
    return ' '.join(t), cx - x0


def svg(contenu, vb, larg=None, haut=None):
    dim = ''
    if larg:
        dim = f' width="{larg}" height="{haut}"'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="{vb[0]:.2f} {vb[1]:.2f} {vb[2]:.2f} {vb[3]:.2f}"{dim}>\n{contenu}\n</svg>\n')


DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'marque')
os.makedirs(DEST, exist_ok=True)

def ecrire(nom, s):
    with open(os.path.join(DEST, nom), 'w') as f:
        f.write(s)
    print(f'  {nom:20} {len(s):5} o')


polys = lettres(T_PERP)
d_mono = chemin(polys)

# logo-mark — monogramme seul, cadrage serré
vb = bornes(polys, 0.8)
ecrire('logo-mark.svg', svg(f'<path d="{d_mono}" fill="#ffffff"/>', vb))

# logo-full — monogramme + DEVSEC, blanc sur transparent.
# DEVSEC aligné à gauche sur le pied du A, comme l'original ; gris rendu
# par une opacité sur blanc, pour rester « une seule couleur ».
dev_d, dev_l = devsec(A_FL - 0.6, B + 5.2)
full = (f'<path d="{d_mono}" fill="#ffffff"/>\n'
        f'<path d="{dev_d}" fill="none" stroke="#ffffff" stroke-opacity=".62" '
        f'stroke-width="{SW}"/>')
vb_full = bornes(polys, 0.8)
vb_full = (vb_full[0], vb_full[1], vb_full[2], (B + 5.2 + CAP + 1.2) - vb_full[1])
ecrire('logo-full.svg', svg(full, vb_full))

# logo-dark — la même chose en noir, pour fond clair
dark = full.replace('#ffffff', '#0a0a0a')
ecrire('logo-dark.svg', svg(dark, vb_full))

# favicon — monogramme épaissi, centré dans un CARRÉ (une favicon est
# carrée ; le monogramme fait 2,6:1, il sera donc petit en hauteur —
# c'est une contrainte de la forme, pas un choix).
FAV_T = 6.0
pf = lettres(FAV_T)
bx = bornes(pf, 1.2)
cote = max(bx[2], bx[3])
vb_fav = (bx[0] - (cote - bx[2]) / 2, bx[1] - (cote - bx[3]) / 2, cote, cote)
ecrire('favicon.svg', svg(f'<path d="{chemin(pf)}" fill="#ffffff"/>', vb_fav))

# favicon-a — VARIANTE : le chevron seul, presque carré de nature.
pa = [lettres(FAV_T)[0]]
bxa = bornes(pa, 1.6)
cote = max(bxa[2], bxa[3])
vb_a = (bxa[0] - (cote - bxa[2]) / 2, bxa[1] - (cote - bxa[3]) / 2, cote, cote)
ecrire('favicon-a.svg', svg(f'<path d="{chemin(pa)}" fill="#ffffff"/>', vb_a))

print('\nrapport largeur/hauteur du monogramme :',
      f'{vb[2]/vb[3]:.2f}  (original ≈ 2,55)')
