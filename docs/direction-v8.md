# v8 — couper

## Le constat

Mohamed, en ouvrant le site :

> * ÉNORMÉMENT de texte que personne ne va lire
> * flagrance ÉNORME que le site a été fait à l'IA

Aaron avait dit la même chose en v3. Le défaut est revenu à chaque
chantier parce qu'il n'a **jamais été mesuré** : le dépôt comptait les
images sautées, les octets, les contrastes et les teintes, mais personne
n'avait jamais compté les tournures. Un tic qu'aucun contrôle ne regarde
revient tout seul, et j'en ai rajouté à chaque passage.

## Le contrôle qui manquait

`scripts/verifier-prose.mjs` compte deux choses et sort en échec si l'une
déborde.

**La longueur**, dans `<main>` seulement. L'en-tête, le sommaire, le rail
et le pied de page pèsent ~200 mots identiques d'une page à l'autre : ce
sont des repères de navigation, pas de la lecture. Les compter aurait
rendu le plafond illisible et n'aurait pas récompensé le seul geste qui
compte, couper dans le discours. Le total complet reste affiché.

**Les tournures**, sur le même corpus, plus les réponses de l'assistant
(elles vivent dans `site.js` et échappaient au comptage — elles portaient
exactement les mêmes tics).

Les plafonds sont des **choix**, écrits dans le script pour être
discutés. Ils ne sortent d'aucune norme.

## Mesuré

| mots dans `<main>` | avant | après |
| --- | --- | --- |
| accueil | 877 | **399** |
| ce qu'on fait | 815 | **476** |
| comment ça se passe | 847 | **449** |
| prix | 817 | **549** |
| à propos | 719 | **419** |
| contact | 364 | **269** |
| 404 | 133 | **100** |
| **total du site** | **7 346** | **5 333** |
| temps de lecture | ~37 min | **~27 min** |
| réponses de l'assistant | 806 | **642** |

| tournure | avant | après | seuil |
| --- | --- | --- | --- |
| antithèse « X, pas Y » | 22 | **3** | 3 |
| tiret cadratin | 30 | **7** | 8 |
| clivée « ce qui… c'est » | 9 | **0** | 2 |
| « ce n'est pas … c'est » | 1 | **0** | 0 |

## Ce qui a été coupé, et pourquoi

Le défaut n'était pas la longueur des phrases : c'était que **chaque
paragraphe finissait sur une chute**. « C'est un choix, pas un oubli. »
« Une alerte que personne ne lit n'est pas de la sécurité. » « Une
structure jeune qui affiche les chiffres d'une grande a déjà commencé à
mentir. » Une fois, c'est une formule. Vingt fois, c'est une signature.

Raccourcir les phrases n'y aurait rien changé : c'est le **rythme** qui
trahit. Il a donc fallu supprimer des blocs entiers plutôt que rogner
partout.

- **Accueil** : la section « Le logiciel, c'est la moitié du travail »
  est partie en entier. Elle redisait en prose ce que la section
  au-dessus montre déjà en listes.
- **Ce qu'on fait** : la carte « La différence, en une phrase » et le
  dépliant « Pourquoi ce choix » — deux essais.
- **Comment ça se passe** : quatre plaidoyers sur le délai de deux jours
  ramenés à trois faits.
- **À propos** : la petite nouvelle du message d'alerte qui part à la
  corbeille un mardi à 18 h.

Le second niveau d'information reste **derrière un pli** (`<details>`)
là où il est utile : la page reste courte à l'œil, le texte reste dans le
HTML servi, donc indexable.

## Deux affirmations corrigées en passant

En vérifiant les textes contre le code du produit plutôt que contre mon
souvenir :

1. **« Mots de passe et accès, chiffrés sur votre machine »** — faux pour
   la moitié des cas. Le coffre est chiffré par le trousseau du système
   dans l'application Windows ; dans le navigateur il retombe en clair,
   et le produit le signale lui-même à l'utilisateur. Ramené à « rangés à
   un seul endroit », sans promesse.
2. **« Aucune reprise de comptabilité passée »** — limite que je venais
   d'inventer, et qui contredisait la page prix : la reprise d'un
   existant y est l'un des trois éléments qui font le devis. Retirée.

À l'inverse, deux affirmations que je m'apprêtais à supprimer se sont
révélées **vraies** après lecture du code : les **devis** existent bien
(domaine `quotes`, créés depuis la fiche client, impression PDF) et le
coffre-fort contient bien des **mots de passe** (`VaultEntry.password`).

## Vérifié

- 462 contrôles navigateur, aucun échec.
- Lighthouse : accessibilité, bonnes pratiques 100 partout ; performance
  100 sauf l'accueil mobile à 99 ; CLS 0.
- Les captures ont été **regardées** : le raccourcissement de la colonne
  gauche du bandeau « votre côté / notre côté » ouvrait un trou en son
  milieu, à cause d'un `margin-top: auto` qui alignait les deux notes en
  bas. La règle tenait tant que les deux colonnes avaient une hauteur
  voisine ; elle a été retirée.
