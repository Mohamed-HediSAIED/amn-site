# Les valeurs du produit — source de vérité unique

**Tout ce qui suit est COPIÉ de `amn-desktop`, pas interprété.** Chaque ligne
porte son fichier d'origine. Aucune valeur de ce document n'a été choisie pour
le site : si une valeur du site ne se retrouve pas ici, elle est fausse.

Origine : `amn-desktop/src/index.css` (bloc `@theme`), les classes Tailwind v4
réellement employées dans `src/screens/` et `src/components/`, et
`src/components/GrainOverlay.tsx`.

---

## 1. Couleurs — valeurs exactes

| Jeton | Valeur | Emploi |
| --- | --- | --- |
| `--color-bg` | `#0a0a0a` | fond de l'application |
| `--color-surface` | `#131313` | cartes, panneaux |
| `--color-surface-hover` | `#1c1c1c` | survol d'une carte |
| `--color-border` | `#262626` | filet par défaut |
| `--color-border-strong` | `#3a3a3a` | filet au survol / au focus |
| `--color-text-primary` | `#f2f2f0` | texte principal |
| `--color-text-secondary` | `#9a9a97` | texte secondaire |
| `--color-text-muted` | `#616160` | étiquettes discrètes |
| `--color-accent` | **`#ededed`** | **accent — un BLANC CASSÉ** |
| `--color-accent-hover` | `#ffffff` | accent au survol |
| `--color-accent-muted` | `rgba(255,255,255,.08)` | fond d'accent |
| `--color-success` | `#d8d8d5` | succès — gris clair |
| `--color-warning` | `#8f8f8c` | avertissement — gris |
| `--color-danger` | `#ff4230` | **la seule couleur du produit** |
| `--color-danger-muted` | `rgba(255,66,48,.14)` | fond d'alerte |

### Le point qui décide de tout ce chantier

`src/index.css` porte ce commentaire, mot pour mot :

> `/* "Accent" is now a near-white highlight — monochrome, not a colour */`
> `/* Status: monochrome, EXCEPT the single reserved signal red for critical */`

**Le produit est monochrome.** Son accent est `#ededed`, un blanc cassé. La
seule couleur de tout le système est le rouge d'alerte critique `#ff4230`, et
elle est réservée.

L'ambre `#ffb224` que le site portait depuis la v1 **ne vient pas du produit**.
Elle a été introduite côté site, puis justifiée après coup comme « couleur de
marque ». Elle n'a jamais existé dans `amn-desktop`. C'est vérifiable en une
commande :

```sh
grep -ri "ffb224\|amber\|orange" amn-desktop/src/   # → aucun résultat
```

Sur le produit, la couleur d'accent est en plus **configurable par
organisation cliente** : il ne peut donc pas s'agir d'une couleur de marque.

---

## 2. Rayons de bordure — comptés dans le code réel

Tailwind v4 (`"tailwindcss": "^4.3.3"`), donc l'échelle v4.

| Classe | Valeur | Occurrences |
| --- | --- | --- |
| `rounded-lg` | `0.5rem` = **8 px** | 119 |
| `rounded-full` | pilule | 99 |
| `rounded-xl` | `0.75rem` = **12 px** | 49 |
| `rounded-md` | `0.375rem` = **6 px** | 40 |
| `rounded-sm` | `0.25rem` = **4 px** | 35 |

**Le produit est arrondi.** Le site, lui, mesurait **1 102 éléments sur 1 102 à
`border-radius: 0`**, plus un coin coupé en diagonale (`.notch`) qui n'existe
nulle part dans le produit.

Mais l'arrondi n'est pas uniforme, et c'est ce détail qui fait la
ressemblance :

- **les conteneurs sont arrondis** — cartes `rounded-2xl` (16 px), boîtes
  d'icône `rounded-xl` (12 px), puces `rounded-full` ;
- **les boutons et les champs sont carrés** — mais **pas tous**, et la première
  rédaction de ce document le disait de façon trop absolue. Le compte réel :

  | | Carrés | Avec rayon | Rayons employés |
  | --- | --- | --- | --- |
  | Boutons `bg-accent` | 41 / 55 | 14 / 55 | `rounded-lg` ×6, `-full` ×4, `-md` ×2 |
  | Champs `input-focus` | 88 / 102 | 14 / 102 | `rounded-lg` ×10, `-xl` ×2, `-md` ×1 |

  Le carré est donc la règle (≈ 3 sur 4 dans les deux cas), pas une loi. Les
  exceptions sont les boutons **à l'intérieur d'un panneau déjà arrondi**
  (boîtes de dialogue, tiroirs), où le rayon suit celui du conteneur.

### Le coin coupé : il existe, mais il est mort

`src/index.css` définit bien un coin coupé, et le site s'en est servi pour
justifier son `.notch` :

```css
/* Corner-cut frame — a hard notch for a "control panel" character. */
.corner-cut { clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%); }
```

Mais : `grep -r "corner-cut" src/ --include=*.tsx` → **0 occurrence**. C'est du
code mort. Il ne se voit nulle part dans le produit, donc il n'appartient pas à
son identité visuelle. La v5 disait « n'existe nulle part dans le produit » :
c'était faux dans la lettre, juste dans les faits.

---

## 2 bis. La géométrie — la valeur qui manquait

**C'est l'omission qui a fait échouer la première maquette.** Les rayons y
étaient exacts (16 / 12 / 6 / 0 px, mesurés au navigateur) et Aaron les a
pourtant vus carrés. La cause n'était pas le rayon, c'était la **taille de ce
qui le porte**.

`AppLayout.tsx` et `HomeScreen.tsx` :

```
coquille  : mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8   → 1152 px, marge 32 px
accueil   : mx-auto max-w-3xl ... py-10                    → colonne de 768 px
grille    : grid grid-cols-2 gap-3 sm:grid-cols-3          → écart 12 px
```

→ carte de module = (768 − 2 × 12) / 3 = **248 px**.

La maquette posait une colonne de 1 120 px sans colonne intérieure, donc des
cartes de **348 px** : 40 % plus larges pour un rayon identique. Mesuré côte à
côte, la carte de 248 px se lit arrondie et celle de 348 px se lit carrée.

> **Recopier un jeton ne suffit pas si on ne recopie pas la proportion sur
> laquelle il s'applique.** Un rayon est une fraction d'un coin, pas une valeur
> absolue.

| Mesure | Produit | À respecter sur le site |
| --- | --- | --- |
| Coquille de page | `max-w-6xl` = 1152 px, marge 32 px | identique |
| Colonne d'accueil | `max-w-3xl` = 768 px, centrée | identique |
| Écart de grille | `gap-3` = 12 px | identique |
| Carte de module | **248 px** | ne pas dépasser ≈ 280 px |

---

## 3. Les recettes exactes, recopiées

### Carte de module (la grille 3 × 2 de l'écran d'accueil)

```
elev-1 elev-hover group flex flex-col gap-3 rounded-2xl border border-border
bg-surface p-5 text-left transition-colors hover:border-border-strong
```
→ rayon 16 px · filet 1 px `#262626` · fond `#131313` · marge intérieure 20 px ·
écart 12 px · survol : filet `#3a3a3a`

### Boîte d'icône dans la carte

```
flex h-10 w-10 items-center justify-center rounded-xl border border-border
bg-bg text-text-secondary group-hover:text-text-primary
```
→ 40 × 40 · rayon 12 px · fond `#0a0a0a` (**plus sombre que la carte**) ·
icône `#9a9a97` → `#f2f2f0` au survol

### Bandeau de chiffres (3 SITES SUPERVISÉS / 0 EN LIGNE / 2 TÂCHES OUVERTES)

```
elev-1 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border
```
Cellules : `flex flex-col items-center gap-1 bg-surface px-3 py-4`

→ Le procédé à retenir : **`gap-px` sur un fond `bg-border`**. Les cellules sont
en `bg-surface` et l'écart d'un pixel laisse voir le fond — les séparateurs
sont donc l'arrière-plan lui-même, jamais des bordures.

### Bouton principal

```
bg-accent px-4 py-2 text-sm font-semibold text-bg hover:bg-accent-hover
```
→ fond `#ededed` · texte `#0a0a0a` · 14 px · graisse 600 · **carré** ·
survol `#ffffff`

### Champ de saisie

```
input-focus min-h-11 border border-border bg-bg px-2.5 text-sm text-text-primary outline-none
```
→ **carré** · fond `#0a0a0a` · filet `#262626` · hauteur mini 44 px ·
focus : filet `#3a3a3a` + `box-shadow: 0 0 0 3px rgba(255,255,255,.1)`

### Puce / pilule

```
rounded-full border border-border bg-surface px-3 py-1.5 text-xs
```

### Étiquette mono

```
rounded-md border border-border bg-bg px-1.5 py-0.5 font-mono text-[9px]
uppercase tracking-wider text-text-muted
```

---

## 4. Élévation — copiée avec sa justification

`src/index.css` :

> Sur une surface quasi noire une ombre seule est invisible, donc chaque niveau
> associe une ombre portée à un filet clair d'un pixel en haut — le même tour
> qu'une plaque physique reçoit de la lumière ambiante. Trois niveaux
> seulement : carte au repos, panneau flottant, fenêtre modale. Ce qui
> demanderait un quatrième niveau demande en réalité une autre mise en page.

```css
.elev-1 { box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 1px 2px rgba(0,0,0,.4); }
.elev-2 { box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 8px 24px -8px rgba(0,0,0,.7), 0 2px 6px rgba(0,0,0,.45); }
.elev-3 { box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 24px 60px -12px rgba(0,0,0,.85), 0 8px 20px rgba(0,0,0,.5); }
.elev-hover:hover { box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 12px 28px -10px rgba(0,0,0,.75), 0 3px 8px rgba(0,0,0,.45); }
```
Transition de l'élévation : `.25s cubic-bezier(.16, 1, .3, 1)`.

---

## 5. Typographie

```css
--font-sans: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
```

Graisses chargées : Space Grotesk 400/500/600/700, JetBrains Mono 400/500/700.

**Le site avait remplacé les deux par Archivo + Martian Mono en v3**, pour
« plus de caractère ». C'est le contraire de la fidélité : on revient aux
polices du produit.

Échelle réellement employée, comptée sur `src/` :

| Taille | Occurrences | Emploi |
| --- | --- | --- |
| `text-sm` — 14 px | **415** | le texte courant du produit |
| `text-[10px]` | 256 | étiquettes mono |
| `text-xs` — 12 px | 255 | texte secondaire |
| `text-[11px]` | 90 | étiquettes |
| `text-[9px]` | 72 | micro-étiquettes |
| `text-lg` — 18 px | 28 | |
| `text-3xl` — 30 px | 22 | titres d'écran |
| `text-2xl` — 24 px | 16 | |

Titre de l'accueil (« Bonsoir, Aaron. ») :
`text-4xl font-semibold tracking-tight sm:text-5xl`
→ **36 px, 48 px au-delà de `sm`, graisse 600, interlettrage −0,025 em**.

Chiffres et horodatages : `.tnum` → `font-mono`, `tabular-nums`,
`letter-spacing: -0.01em`.

---

## 6. Mouvement et retours

| Élément | Valeur |
| --- | --- |
| Transition standard | `0.16s ease` |
| Élévation au survol | `0.25s cubic-bezier(.16, 1, .3, 1)` |
| Focus des champs | `0.15s ease` |
| Appui | `transform: scale(0.985)` — « assez pour se sentir, trop peu pour se voir comme une animation » |
| Anneau de focus | `outline: 2px solid rgba(255,255,255,.55)` · décalage 2 px |
| Survol de carte | `translateY(-1px)` + filet `#3a3a3a` + fond `#171717` |
| Veille | 4 minutes (`IdleScreensaver.tsx`) |

---

## 7. Le grain — `src/components/GrainOverlay.tsx`

> Voile de grain argentique plein cadre. Volontairement franc (~9 %) pour
> donner au noir une vraie matière — une texture de pellicule développée
> plutôt qu'un saupoudrage symbolique.

```
opacity: 0.09 · mix-blend-mode: soft-light · fixed inset-0 · pointer-events: none
motif : SVG feTurbulence, type fractalNoise, baseFrequency 0.6, numOctaves 3,
        stitchTiles stitch, tuile 200 × 200
```

C'est un élément d'identité du produit **que le site n'avait pas du tout**.

---

## 8. Sparkline — `src/components/Sparkline.tsx`

`<svg>` + `<polyline>`, 96 × 28 par défaut, `stroke-width: 1.5`,
`stroke-linecap: round`, `stroke-linejoin: round`, couleur
`var(--color-accent)` — donc **blanc cassé**, pas une teinte.

---

## 9. Écarts constatés entre le site (v5) et le produit

| | Produit | Site v5 | Verdict |
| --- | --- | --- | --- |
| Accent | `#ededed` blanc cassé | `#ffb224` ambre | **à supprimer** |
| Rayons | 4 à 16 px, pilules | 0 partout + coin coupé | **à corriger** |
| Police texte | Space Grotesk | Archivo | **à remettre** |
| Police mono | JetBrains Mono | Martian Mono | **à remettre** |
| Grain | présent, 9 % | absent | **à ajouter** |
| Élévation | 3 niveaux + filet clair | filet clair seul | **à compléter** |
| Survol de carte | `translateY(-1px)` | néant | **à ajouter** |
| Fond de survol | `#1c1c1c` | `#1a1a1a` | **à aligner** |
| Sparkline | présente | absente | **à ajouter** |

---

## 10. Deux points où le site DOIT diverger — mesurés, pas supposés

### a) `--color-text-muted` #616160 ne passe pas sur un site public

Recopié tel quel dans la première maquette, il a fait tomber
l'accessibilité à **93** sur onze éléments :

| Fond | Contraste obtenu | Exigé (AA, texte normal) |
| --- | --- | --- |
| `#0a0a0a` | 3,19:1 | 4,5:1 |
| `#131313` | 2,99:1 | 4,5:1 |

Le site avait déjà tranché en v1 et le produit ne l'oblige pas : `--text-3`
`#858583` est le plancher lisible (**5,04:1** sur `#131313`, 5,37:1 sur
`#0a0a0a`), `#616160` reste décoratif et **ne doit jamais porter de sens**.
Une étiquette de chiffre (« MODULES LIVRÉS ») porte du sens.

→ Retour à **100** en accessibilité, sans toucher au reste de la palette.

### b) Le coût du masque, et ce qu'il payait

Les nappes de télémétrie sont le seul endroit où Aaron autorise à dépasser
l'extraction. Avant d'en ajouter, il fallait savoir ce que coûtait
l'existant. Mesure : processeur bridé ×6, trois passes, images comptées
pendant 3 s d'animation continue.

| | 4 nappes + `mask-image` | 6 nappes, 4 natures, 2 aires, voiles en dégradé |
| --- | --- | --- |
| Images sautées — ordinateur | **30,3 %** | **2,31 %** |
| Images sautées — téléphone | 0 % | 0 % |
| p95 — ordinateur | 33,4 ms | **16,8 ms** |
| Tâches longues | 0 | 0 |
| Couches composées | 24 | 26 |
| Mémoire de couches | 49,8 Mo | **44,7 Mo** |
| Lighthouse performance | — | **100** |

**Le coupable n'était pas le nombre de courbes, c'était `mask-image`.** Il
sortait les nappes du chemin composé : à lui seul, 30 % des images. Le même
estompage des bords, obtenu par deux voiles en dégradé de la couleur du fond,
coûte 1,14 %. C'est ce qui a payé six nappes au lieu de quatre, deux aires
dégradées et quatre natures de signal — pour **moins** de mémoire qu'avant.

> Mesuré en rendu logiciel (conteneur sans carte graphique), ce qui **majore**
> le coût de composition par rapport à un vrai appareil. Les chiffres valent
> donc comme comparaison avant/après, pas comme valeur absolue.
