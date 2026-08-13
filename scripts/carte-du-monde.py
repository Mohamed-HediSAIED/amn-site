#!/usr/bin/env python3
"""Carte du monde en matrice de points, sans aucune dépendance de données.

Les continents sont des polygones simplifiés écrits à la main en
longitude/latitude, puis échantillonnés sur une grille équirectangulaire.
On n'embarque donc aucun fichier géographique : la géométrie tient dans
ce fichier, et le SVG produit ne contient que des points.

Le rendu est VÉRIFIÉ À L'ŒIL (voir carte-controle.png) — une carte du
monde fausse se voit immédiatement.
"""

# Grille : 110 colonnes × 52 lignes. La projection équirectangulaire
# étire les hautes latitudes ; on coupe à 78° N et 56° S, au-delà il n'y
# a rien qui compte pour nous (et l'Antarctique ferait une barre pleine
# en bas de l'image).
COLS, LIGNES = 110, 52
LON_MIN, LON_MAX = -170.0, 180.0
LAT_MAX, LAT_MIN = 78.0, -56.0

# ── Polygones (longitude, latitude), sens quelconque ──────────────────
CONTINENTS = {
    'amerique_nord': [
        (-168, 65), (-160, 71), (-141, 70), (-125, 70), (-110, 68), (-95, 68),
        (-85, 70), (-72, 68), (-62, 66), (-56, 60), (-64, 52), (-56, 47),
        (-66, 44), (-70, 41), (-75, 36), (-81, 31), (-80, 25), (-84, 30),
        (-90, 29), (-97, 26), (-97, 21), (-94, 18), (-88, 21), (-87, 16),
        (-83, 9), (-78, 8), (-83, 15), (-92, 15), (-105, 20), (-110, 24),
        (-114, 29), (-117, 33), (-124, 40), (-124, 48), (-131, 54),
        (-140, 60), (-152, 58), (-165, 62),
    ],
    'amerique_sud': [
        (-81, 6), (-77, 8), (-72, 11), (-64, 11), (-60, 8), (-52, 5),
        (-50, 0), (-44, -2), (-35, -5), (-35, -10), (-39, -16), (-48, -25),
        (-53, -34), (-58, -38), (-62, -40), (-65, -45), (-68, -50),
        (-70, -55), (-74, -52), (-73, -45), (-73, -37), (-71, -30),
        (-70, -20), (-70, -14), (-77, -6), (-80, -3), (-80, 1),
    ],
    'europe': [
        (-10, 44), (-9, 39), (-6, 36), (0, 39), (3, 42), (9, 44), (13, 40),
        (16, 41), (19, 40), (24, 38), (27, 41), (29, 45), (34, 46),
        (38, 47), (40, 51), (45, 55), (48, 60), (52, 65), (60, 70),
        (50, 71), (40, 68), (30, 70), (25, 71), (18, 69), (10, 63),
        (5, 59), (8, 55), (4, 52), (0, 50), (-4, 48),
    ],
    'iles_britanniques': [
        (-10, 51), (-6, 50), (-2, 51), (1, 51), (2, 53), (-1, 56),
        (-3, 59), (-7, 58), (-8, 55), (-10, 54),
    ],
    'afrique': [
        (-17, 15), (-16, 21), (-13, 28), (-9, 32), (-2, 36), (10, 37),
        (20, 33), (25, 32), (32, 31), (36, 28), (39, 22), (43, 12),
        (51, 12), (43, 4), (41, -2), (40, -10), (35, -18), (33, -26),
        (28, -33), (20, -35), (16, -29), (12, -18), (9, -1), (2, 4),
        (-8, 5), (-13, 9), (-17, 12),
    ],
    'madagascar': [(43, -13), (50, -16), (48, -25), (44, -22), (43, -17)],
    'asie': [
        (60, 70), (75, 74), (90, 76), (105, 78), (120, 74), (135, 72),
        (150, 70), (165, 68), (178, 66), (175, 62), (162, 60), (155, 55),
        (142, 54), (140, 46), (130, 43), (126, 37), (122, 31), (120, 24),
        (110, 21), (105, 10), (100, 6), (98, 12), (92, 21), (88, 22),
        (80, 15), (77, 8), (72, 20), (68, 24), (60, 25), (56, 26),
        (48, 30), (44, 38), (40, 43), (48, 48), (55, 52), (60, 58),
    ],
    'inde_sud': [(72, 20), (77, 8), (80, 15), (87, 22), (78, 24)],
    'indonesie': [
        (95, 6), (105, 0), (115, -3), (120, -1), (128, -3), (135, -3),
        (141, -6), (135, -9), (125, -9), (115, -8), (105, -7), (98, 2),
    ],
    'philippines': [(120, 18), (125, 16), (126, 10), (122, 6), (119, 11)],
    'japon': [(130, 32), (136, 34), (141, 38), (145, 44), (142, 45),
              (137, 37), (131, 33)],
    'australie': [
        (114, -22), (113, -26), (115, -34), (119, -34), (125, -32),
        (131, -32), (137, -35), (140, -38), (146, -39), (150, -37),
        (153, -30), (153, -25), (146, -19), (142, -11), (136, -12),
        (130, -12), (125, -14), (121, -19),
    ],
    'nouvelle_zelande': [(166, -46), (170, -45), (174, -41), (178, -38),
                         (175, -37), (170, -43)],
    'islande': [(-24, 65), (-14, 66), (-14, 64), (-22, 63)],
    'groenland_sud': [(-52, 60), (-42, 61), (-32, 68), (-45, 72),
                      (-55, 70), (-58, 65)],
}


def dans(px, py, poly):
    """Point-dans-polygone, lancer de rayon."""
    n = len(poly)
    dedans = False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > py) != (yj > py):
            x = (xj - xi) * (py - yi) / (yj - yi) + xi
            if px < x:
                dedans = not dedans
        j = i
    return dedans


def grille():
    lignes = []
    for r in range(LIGNES):
        lat = LAT_MAX - (r + 0.5) * (LAT_MAX - LAT_MIN) / LIGNES
        ligne = []
        for c in range(COLS):
            lon = LON_MIN + (c + 0.5) * (LON_MAX - LON_MIN) / COLS
            ligne.append(any(dans(lon, lat, p) for p in CONTINENTS.values()))
        lignes.append(ligne)
    return lignes


def apercu(g):
    return '\n'.join(''.join('#' if v else '.' for v in l) for l in g)


if __name__ == '__main__':
    import sys
    g = grille()
    n = sum(sum(l) for l in g)
    if '--ascii' in sys.argv:
        print(apercu(g))
        print(f'\n{n} points sur {COLS * LIGNES} cellules')
    else:
        # Un seul <path>, en coordonnées ENTIÈRES et en déplacements
        # RELATIFS. La viewBox est la grille elle-même (110 × 52), donc
        # chaque point s'écrit « m1 0h.01 » au lieu de « M123.4 56.7h.01 » :
        # le tracé passe de ~28 Ko à ~13 Ko bruts, sans changer d'un
        # pixel ce qui est rendu.
        d = []
        px = py = 0
        premier = True
        for r, ligne in enumerate(g):
            for c, v in enumerate(ligne):
                if not v:
                    continue
                if premier:
                    d.append(f'M{c} {r}h.01')
                    premier = False
                else:
                    dx, dy = c - px, r - py
                    d.append(f'm{dx} {dy}h.01' if dy else f'm{dx} 0h.01')
                px, py = c, r
        print(f'<svg class="carte" viewBox="0 0 {COLS} {LIGNES}" fill="none" aria-hidden="true">'
              f'<path d="{"".join(d)}" stroke="#ededed" stroke-width=".28" '
              f'stroke-linecap="round"/></svg>')
