# v5 — le dossier d'accès

> « Aucun chantier ne m'a vraiment étonné. Je veux quelque chose dont on se
> souvient. Extrême dans le design, mais **pro**. »

## Comment la direction a été choisie

Quatre directions ont été écrites indépendamment, puis notées par trois juges
qui ne voyaient chacun qu'un seul critère.

| | Mémorabilité | Crédibilité | Faisabilité | Total |
| --- | --- | --- | --- | --- |
| **La demande — partie A / partie B** | **9** | 6 | 6 | **21** |
| La Régie — le mur de dalles | 5,5 | **7** | **8** | 20,5 |
| Client zéro — la supervision sur soi | 7,5 | 4 | 7,5 | 19 |
| Le Tracé — l'enregistreur à plume | 7 | 5 | 5 | 12 |

Deux juges sur trois ont préféré le mur. Il n'a pas été retenu, et le motif
est celui du juge mémorabilité : le mur **ajoute un appareil à un site vitrine
qui reste un site vitrine**. Six dalles noires portant chacune un gros chiffre
à côté du titre, c'est une barre d'indicateurs — la forme la plus banale du web
marketing. C'est exactement l'amélioration incrémentale qu'Aaron a déjà refusée
quatre fois.

**Retenu : la seule proposition qui supprime le genre au lieu de le décorer.**

## En une phrase

Le site cesse d'être une vitrine et devient **le dossier d'accès lui-même** :
six feuillets numérotés dont AMN a déjà rempli sa moitié, et dont le seul blanc
de tout le site, ce sont les quatre champs à votre nom.

Ce qui change est le **contenant**, jamais le discours. Le chrome du dossier —
réglure à numéros d'article, cartouche technique, sommaire — enveloppe les
textes existants **sans en réécrire un mot**. L'article 01 de l'accueil est le
bandeau de la v4, mot pour mot : le titre, le chapô, la trace, les deux
boutons, le bloc « Votre côté / Notre côté ».

C'est la discipline centrale du chantier. **Le contenant est froid, le premier
écran reste chaud.** Un dossier à articles numérotés peut se lire en cinq
secondes comme un formulaire d'impôts, et c'est précisément ce qu'un artisan
fuit — c'est le seul mode d'échec de cette direction qui n'apparaît dans aucune
mesure automatique.

## Pourquoi c'est crédible et pas décoratif

La référence n'est pas juridique, elle est **technique** : le **cartouche**
d'un plan d'exécution. Émetteur, objet, indice, feuillet. C'est l'objet que
produit un bureau d'études — pas un contrat, pas un formulaire.

Et il dit quelque chose de vrai sur le modèle de vente, en six mots :

> **RÉFÉRENCE — *attribuée à la réception*, pas ici.**

Aucun accès ne s'ouvre tout seul. Quelqu'un lit, puis attribue. Une ligne de
cartouche porte tout le positionnement — là où la v4 avait besoin d'un
paragraphe.

## Pixel ou réaliste : sans objet, et c'est un choix

Le brief demandait de trancher sans entre-deux entre pixel art assumé et rendu
réaliste de moniteurs. **La question tombe avec le mur d'écrans.** Il n'y a pas
d'écran miniature dans cette direction : il y a un document.

Le pixel art aurait de toute façon été écarté. Il traîne un registre —
nostalgie, jeu vidéo, terminal vert — qui n'a aucun rapport avec ce qui est
vendu à un artisan, et il aurait fait de la page une blague de développeur.

## La séquence d'ouverture

Un terminal qui tape, puis le dossier. Huit lignes, 2,5 s.

Les six lignes de contrôle portent sur **la page qu'on regarde**, et deux
d'entre elles sont **remesurées à l'exécution** (appels à des tiers réellement
chargés, cookies réellement déposés). Le compte d'en-têtes est comparé à
`vercel.json` par la vérification : toucher aux en-têtes sans corriger la page
fait échouer un contrôle.

**Tout est en CSS.** La séquence se joue et se retire même sans JavaScript.

## Trois pièges rencontrés, et ce qu'ils ont coûté

**1. La frappe par recouvrement.** Premier mécanisme : un cache opaque glisse
sur le texte. Ça marche à l'œil. Mais l'audit d'accessibilité échantillonne
pendant le passage et voit du texte **à moitié recouvert** — c'est-à-dire, par
construction, du texte à contraste insuffisant. La frappe se fait maintenant
par **découpe** (`clip-path`) : un glyphe est soit rendu en entier, soit pas
rendu du tout. Plus d'état intermédiaire à mesurer.

**2. Le fondu de sortie.** Le vrai coupable. Un panneau qui s'efface est
semi-transparent pendant 400 ms, et pendant ces 400 ms **tout ce qu'il
contient** est du texte mélangé au fond pour un audit de contraste.
L'accessibilité de l'accueil tombait à 96 pendant que les cinq autres pages
étaient à 100, sans qu'aucun texte réel du site soit en cause. Le rideau
remonte maintenant **d'un bloc, opaque du début à la fin**. `transform` seul,
donc toujours composé — et plus franc à l'œil qu'un fondu.

**3. `--text-4` sur des numéros d'article.** Le dépôt écrit depuis la v1 que
`--text-4` est décoratif et ne doit jamais porter de sens. Un numéro d'article
en porte. Corrigé, et surtout : **les six nouveaux éléments sont entrés dans la
boucle de contrôle du contraste**, parce que la suite passait à 424 pendant que
Lighthouse tombait à 96. Un contrôle qui ne regarde pas les nouveaux éléments
ne protège que le passé.

## Le message vocal

Uniquement l'**emplacement**. Aucune synthèse vocale, ni embarquée ni distante :
le site passe son temps à dire qu'il n'est pas fabriqué par une machine, une
voix de synthèse à l'accueil dirait le contraire en trois secondes.

**Garde par attribut, pas sondage réseau.** Tant que `<body>` ne porte pas
`data-piece`, le bloc reste caché et **rien n'est demandé** : pas de requête
pour un fichier absent, pas de 404, pas de bouton mort. Vérifié.
Mode d'emploi : `assets/audio/LISEZ-MOI.txt`.

## Mesuré

| | v4 | v5 |
| --- | --- | --- |
| Performance (6 pages, mobile et ordinateur) | 99–100 | **100 partout** |
| Accessibilité / bonnes pratiques / SEO | 100 | 100 |
| LCP mobile | 1 508 ms | **1 511 ms** |
| CLS | 0 | 0 |
| Poids par page | ~90 Ko | ~92 Ko |
| Contrôles automatisés | 423 | **430** |

L'accueil passe de 99 à **100** : le chantier a supprimé plus de travail de fil
principal (le fondu non composé) qu'il n'en a ajouté.

Le brief autorisait une chute à 90 si l'ambition la justifiait. Elle n'a pas eu
lieu — **il n'y a pas de compromis de performance à déclarer**.

## Les vrais compromis

1. **La frappe n'est pas caractère par caractère au sens strict.** Elle est
   découpée par pas de caractère, ce qui donne le même effet à l'œil, mais le
   mécanisme a été choisi pour l'audit d'accessibilité, pas pour l'effet.
2. **Le chrome est recopié dans neuf fichiers.** Sans étape de construction,
   c'est le prix du « zéro dépendance ». Il divergera si personne ne regarde.
3. **Ce qui n'a pas été construit**, faute de budget, et par ordre d'intérêt :
   le **contre-contrôle** (un bouton qui relit les en-têtes de sécurité en
   direct devant le visiteur — c'est le geste le plus mémorable du cahier), les
   **annotations de marge** qui devaient porter la voix de la maison dans la
   troisième colonne, et la **garde de fraîcheur** sur la date de révision. Le
   cahier complet est dans le journal du workflow.

## Ce qui reste ouvert

- Les **7 champs des mentions légales** et la **garantie de transfert hors UE** —
  inchangés depuis la v3, ils n'appartiennent pas au code.
- Le **vrai logo** et le **message vocal** : deux fichiers à déposer.
- **Le test des cinq secondes.** Aucune mesure automatique ne dira si le dossier
  réchauffe ou refroidit un artisan. Montrer l'accueil à cinq personnes non
  techniques, cinq secondes, et demander « c'est quoi cette boîte ? ». Si trois
  sur cinq répondent mal, il faut désencombrer l'article 01 avant d'aller plus
  loin — et cette décision se prend maintenant, pas dans la panique.
