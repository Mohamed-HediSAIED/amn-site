# v7 — la carte de veille, l'angle mort des forfaits, le balayage

## 1. Le fond : moins lumineux, et moins cher

Aaron a vu les six nappes de télémétrie de la v6 et n'en veut plus :
**trop lumineuses**. Six courbes qui défilaient en permanence, ça bougeait
partout et ça tirait l'œil loin du titre.

Ce qu'il a demandé à la place : *« une salle de contrôle la nuit où tout va
bien »*. Donc une carte du monde presque noire, **immobile**, et de rares
pulsations lentes. Le silence d'abord, le mouvement ensuite.

Écarté explicitement : **pas de globe 3D**, pas de moteur, pas de
bibliothèque.

### La géométrie, sans fichier de données

`scripts/carte-du-monde.py` produit une matrice de points. Les continents
sont des **polygones simplifiés écrits à la main** en longitude/latitude,
échantillonnés sur une grille 110 × 52 en projection équirectangulaire.
Rien n'est téléchargé, rien n'est embarqué.

Le tracé est écrit en **coordonnées entières et déplacements relatifs**
(`m1 0h.01`) dans une viewBox qui *est* la grille. C'est ce détail qui
fait le poids :

| | brut | brotli |
| --- | --- | --- |
| Première version (coordonnées décimales sur 1000) | 27,9 Ko | 2 424 o |
| Version livrée (entiers relatifs sur 110) | 14,5 Ko | **562 o** |
| Pour mémoire, les nappes de la v6 | 42,6 Ko | 2 470 o |

Le rendu a été **vérifié à l'œil** : une carte du monde fausse se voit
immédiatement, et un studio qui vend de la rigueur ne peut pas se le
permettre.

### Le mouvement

Huit points respirent (opacité seule, 7 s, jamais deux en même temps),
trois émettent une onde qui s'ouvre (`transform` + `opacity`).

Le nombre est mesuré, pas choisi au hasard : une pulsation par point coûte
**une couche composée**, une onde en coûte une deuxième. D'où trois ondes
et pas huit — une carte où tout pulse redevient exactement ce qu'Aaron ne
voulait plus.

### Ce que ça coûte, mesuré

Processeur bridé ×6, trois passes, sur le vrai site :

| | 6 nappes (v6) | carte de veille (v7) |
| --- | --- | --- |
| Mémoire de couches — ordinateur | 53,0 Mo | **44,3 Mo** |
| Mémoire de couches — téléphone | 18,1 Mo | **14,5 Mo** |
| Images sautées | 0 % | 0,19 % |
| Tâches longues | 0 | 0 |
| Poids de la page d'accueil (brotli) | 8 988 o | **7 080 o** |

La carte est **statique** : elle ne coûte rien par image, là où six couches
défilaient en boucle. C'était l'objectif du changement, et il est atteint.

### La panne que l'œil n'a pas vue

Le `<svg>` **ne portait pas `class="carte"`**. La règle qui le dimensionne
*et* l'estompe ne s'appliquait donc pas du tout — ce qui semblait « plus
sombre » n'était que le voile posé par-dessus. Aucune erreur, aucun
symptôme : encore une panne silencieuse, comme le `preserve-3d` de la v2.

C'est le **contrôle** qui l'a trouvée, pas la relecture. D'où les dix
nouveaux contrôles sur ce bloc, dont celui qui vérifie que les images clés
n'animent **que** `opacity` et `transform`.

### Le compromis assumé

Le voile radial qui protège le titre est posé **entre** la carte et les
points, pas au-dessus des deux : sinon il éteignait aussi les pulsations.
Conséquence : les trois points européens (Dublin, Paris, Francfort) tombent
derrière le titre et se lisent moins bien que ceux des bords. Cinq points
sur huit portent l'effet ; c'est accepté.

### Honnêteté

Les points sont **illustratifs**, posés sur des régions d'hébergement
courantes — un site français vit souvent sur un serveur à Francfort, à
Dublin ou en Virginie. Le bloc est `aria-hidden` et purement décoratif :
**nulle part** le site ne prétend compter des sites supervisés ni dire où
ils se trouvent.

C'est le point à trancher par Aaron s'il n'est pas d'accord : une carte du
monde derrière un titre peut se lire comme une promesse de présence
mondiale. Elle est ici du décor, au même titre qu'une photographie
d'atelier.

---

## 2. L'angle mort des forfaits

Un visiteur a demandé à l'assistant : *« j'ai une équipe de 24 personnes,
quel abonnement ? »*. L'assistant a refusé d'inventer — bon réflexe — mais
**le trou n'était pas dans l'assistant**.

### La cause

La grille mélangeait **deux axes** :

| Forfait | Défini par |
| --- | --- |
| Solo | un nombre de personnes |
| Petite équipe | un nombre de personnes |
| **Agence** | **un métier** — « vous en gérez pour d'autres » |
| Sur-mesure | « au-delà », qui se lisait *au-delà de l'agence* |

Une entreprise de 24 personnes qui n'est pas une agence ne tombait donc
nulle part.

### Ce que je n'ai pas fait, et pourquoi

Publier un **coût par personne supplémentaire** était l'option la plus
tentante, et c'est celle que le brief citait en premier. Dérivé des chiffres
publics — 35 € pour 1 personne, 109 € pour 5 — il vaudrait **18,50 € par
personne**. Mais :

| Effectif | Petite équipe + supplément dérivé |
| --- | --- |
| 6 | 127,50 € |
| 12 | 238,50 € |
| **13** | **257,50 € — dépasse le forfait Agence (249 €)** |
| 24 | 460,50 € |

À partir de treize personnes, une entreprise paierait **plus qu'une
agence**, sans qu'aucune ligne n'explique pourquoi. Publier ce chiffre
remplacerait un trou par une incohérence visible.

Et surtout : la **forme** du barème — dégressif ? plafonné ? par tranches ?
— est une décision commerciale qui appartient à Aaron. L'arithmétique ne la
remplace pas.

> **Décision qui reste à Aaron.** S'il veut un prix par personne affiché,
> les chiffres ci-dessus sont le point de départ, et le croisement à treize
> personnes est le problème à trancher d'abord.

### Ce que j'ai fait

Rendre l'axe explicite, **sans ajouter un seul chiffre** :

- un repère d'effectif sur les quatre forfaits — *1 personne* / *2 à 5
  personnes* / *quel que soit votre effectif* / *6 personnes et plus* ;
- « Au-delà, on en discute » devient **« À partir de six personnes »**, qui
  possède enfin le trou ;
- et « sur devis » cesse d'être évasif : trois choses font le montant —
  combien vous êtes, combien il y a à surveiller derrière, ce qu'il y a à
  reprendre d'un existant.

### Trois autres trous, trouvés en cherchant les questions voisines

L'assistant a été passé au crible de 33 questions réelles, posées dans le
navigateur :

| Question | Avant |
| --- | --- |
| « je suis tout seul », « on est trois » | renvoi au formulaire — l'effectif écrit en toutes lettres n'était pas reconnu |
| « je suis une agence » | renvoi au formulaire — **le forfait Agence n'avait aucune réponse à lui** |
| « je vends en ligne » | renvoi au formulaire — **l'option commerce non plus** |

Les deux derniers sont publiés sur la page prix depuis le début : l'assistant
ignorait des faits que le site affichait.

Les sujets **non tranchés** (engagement, résiliation, essai gratuit,
remboursement) doivent au contraire continuer à renvoyer au formulaire. Un
contrôle le vérifie explicitement : sans lui, une future passe
« d'amélioration » y ajouterait une promesse que personne n'a validée.

Enfin, une garde refuse **tout montant absent de la grille publiée** dans
les réponses de l'assistant — et elle a été vérifiée non vide, pour ne pas
passer à vide.

---

## 3. Le balayage

Un contrôle systématique des neuf pages : liens internes, ancres, ordre des
titres, métadonnées, doublons, plan du site, étiquettes de formulaire,
alternatives d'images.

**Trouvé et corrigé :**

1. **Saut de titre `h1 → h3`** sur `/contact` — les deux blocs d'état du
   formulaire (« C'est parti. » / « L'envoi n'a pas abouti. ») étaient en
   `h3` alors qu'ils sont de premier rang. Passés en `h2`.
2. **Quatre descriptions trop longues** (195 à 225 caractères) : tronquées
   par les moteurs. Ramenées entre 150 et 160.
3. **Les prix des trois cartes n'étaient pas alignés** — chaque chiffre
   tombait à une hauteur différente selon la longueur du texte au-dessus.
   Or comparer trois chiffres d'un coup d'œil est *tout* ce qu'on demande à
   une grille tarifaire. Le prix est devenu le dernier élément de la carte,
   poussé en bas, et la mention « par mois, HT » passe toujours à la ligne.

**Signalé puis écarté à raison :** l'absence de `canonical`, d'`og:title` et
d'`og:image` sur `/404`. La page est en `noindex,follow` ; un canonical y
affirmerait que la page d'erreur est la version canonique d'une vraie URL.

**Le manque que personne n'avait signalé :** les six choses qui restent à
faire étaient documentées **chacune dans son coin** — sept champs dans
`mentions-legales.html`, la garantie de transfert dans
`confidentialite.html`, le logo dans un commentaire au sommet de
`assets/logo.svg`, le message vocal dans `assets/audio/LISEZ-MOI.txt`, et
les variables du formulaire **nulle part**. Il fallait ouvrir cinq fichiers
pour savoir où on en était.

`scripts/verifier-avant-mise-en-ligne.mjs` — le script qu'on lance avant de
publier — les liste maintenant **toutes les six**, y compris celles qu'il ne
peut pas vérifier lui-même (les variables Vercel). Il détecte en plus deux
incohérences neuves : un fichier audio déposé sans `data-piece` sur `<body>`
(le message ne serait jamais joué) et l'inverse (un bouton mort).

**Le formulaire de contact** a été envoyé pour de vrai contre un récepteur
HTTP local : la confirmation s'affiche, et la charge utile arrive complète —
les quatre champs, la source, l'horodatage, et aucune adresse IP.

---

## 4. Mesuré

| | v6 | v7 |
| --- | --- | --- |
| Performance / accessibilité / bonnes pratiques / SEO | 100 | **100 partout**, mobile et ordinateur |
| CLS | 0 | **0** |
| LCP mobile — accueil | 1 517 ms | **1 518 ms** |
| Poids de l'accueil (brotli) | 8 988 o | **7 080 o** |
| Mémoire de couches — ordinateur | 53,0 Mo | **44,3 Mo** |
| Contrôles automatisés | 435 | **462** |

---

## 5. Ce qui reste ouvert

- Les **sept champs des mentions légales** et la **garantie de transfert
  hors UE** : ils n'appartiennent pas au code, et rien n'a été inventé pour
  boucher le trou.
- Le **vrai logo** et le **message vocal** : deux fichiers à déposer.
- Les **variables du formulaire** dans Vercel — sans elles, une demande est
  acceptée, journalisée côté serveur… et perdue.
- Le **prix par personne** au-delà de cinq, si Aaron veut l'afficher : voir
  le croisement à treize personnes ci-dessus.
- **La lecture de la carte du monde.** Aucune mesure ne dira si elle promet
  une présence que le studio n'a pas. C'est un jugement, et il revient à
  Aaron.
