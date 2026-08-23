# v9 — les signes qui trahissent un site fabriqué par une IA

## Ce qui n'avait pas marché

La v8 avait coupé le texte de moitié et retiré les tournures de
machine. Réponse de Mohamed : **« ça fait toujours autant IA »**, avec
une consigne — aller chercher les signes réels et les enlever.

Il avait raison, et l'erreur de diagnostic était la mienne : j'avais
traité un problème d'**écriture** alors que la plainte porte sur le
**site**.

## Ce que disent les inventaires

Les recensements publiés sur le sujet ne commencent pas par le style.
Ils commencent par les preuves, puis la mise en page, puis les polices.

| Rang | Le signe | Le site l'avait |
| --- | --- | --- |
| 1 | Aucune image réelle ; du décor abstrait à la place | oui — une carte du monde en pointillés |
| 1 | Aucun nom, aucune adresse, aucune date, aucun client | oui |
| 2 | Bandeau de chiffres ronds, cartes à coins arrondis, accordéon de questions, appel à l'action répété | oui, sur les neuf pages |
| 3 | Police par défaut : Inter d'abord, **Space Grotesk** juste derrière | oui, en gros titre |
| 4 | Le texte qui dit tout au lieu de sous-entendre ; le site qui commente sa propre sincérité | oui, trois sections |

Sur la police, la citation est explicite : Space Grotesk est *« l'idée
que se fait le modèle d'un défaut un peu stylé »*, au point d'être
bannie par défaut dans les outils de conception assistée. Elle est aussi
la police du **produit** — d'où le partage retenu plus bas.

## Ce qui a été fait

### La preuve, à la place du décor

La carte du monde et le bandeau « 10 / 5 / 48 h » sont partis. À leur
place, **une vraie capture de l'application**.

Sur téléphone, réduite à 358 px, elle devenait une tache grise : une
image de logiciel illisible ne prouve rien, elle redevient du décor.
Elle garde donc une largeur lisible et se balaye du doigt.

**La première capture montrait le mauvais logiciel.** C'était le
registre des sites — un écran de la console **interne** d'AMN, avec ses
notes de supervision, son horodatage et son auteur. Un visiteur qui vient
acheter voyait donc l'outil de celui qui vend, pas celui qu'il recevrait.
Le produit a deux éditions (`src/edition/modules.business.ts` contre
`modules.internal.ts`) et « Sites » n'existe que dans l'interne.

La capture montre maintenant **l'accueil de l'édition Business** : les
rendez-vous du jour, les tâches, les fiches clients, les raccourcis. Les
cinq modules épinglés dans la colonne ne sont pas un choix de mise en
scène — ce sont les `DEFAULT_FAVORITES` de l'édition Business, donc
exactement ce qu'un client voit à sa première ouverture. Les six autres
sont derrière « Tous les modules », comme chez lui.

### Une capture qu'on peut refaire

Une copie d'écran prise à la main est un fichier orphelin : personne ne
sait comment elle a été obtenue, donc personne ne la refait, donc elle
ment dès que l'écran change. `scripts/capture-produit.mjs` la reconstruit
de bout en bout :

1. un faux `amn-api` sur un port dédié, chargé d'une journée de
   démonstration (Atelier Vasseur, trois clients, deux rendez-vous) ;
2. la construction de l'édition Business du produit
   (`AMN_EDITION=business`), puis `check-business-bundle.mjs` pour
   vérifier qu'aucun écran interne n'a fuité dans le paquet ;
3. le service du `dist/` obtenu, puis Chromium à 1400 × 745 avec
   **l'horloge figée** à 8 h 45 — sans quoi « dans 45 min » et l'ordre
   des rendez-vous changeraient à chaque exécution ;
4. les deux JPEG, 1120 px et 560 px.

Aucun fichier du produit n'est modifié. Le jeu de démonstration vit dans
le script du site, pas dans le dépôt du logiciel.

Les noms sont inventés et la légende le dit. Publier la vraie journée
d'un vrai client serait une fuite de données, pas une preuve — c'est
pour ça que `verifier-avant-mise-en-ligne.mjs` refuse désormais que la
mention « démonstration » disparaisse de la légende.

### La séquence d'ouverture

Retirée. C'était un faux terminal qui tapait `amn superviser --cible
cette-page` avant de laisser voir la page.

À signaler : **Aaron l'avait demandée** (v4, v5), et ses chiffres
étaient vrais et remesurés à l'exécution. Elle reste dans l'historique
git si vous voulez la remettre. Ce qui a tranché : c'est la première
chose que voit un visiteur, et un terminal de démonstration sur une page
de présentation est un effet, pas une preuve.

Conséquence heureuse : le site n'écrit désormais **plus rien** sur
l'appareil du visiteur, pas même la note de session qui servait à ne pas
rejouer l'animation. La page de confidentialité le dit maintenant sans
réserve, et trois contrôles le vérifient.

### Les polices

| | avant | après |
| --- | --- | --- |
| Titres (h1, h2) | Space Grotesk | **Spectral** (Production Type, Paris) |
| Texte courant, boutons, mosaïque | Space Grotesk | Space Grotesk |
| Étiquettes, chiffres | JetBrains Mono | JetBrains Mono |

Le partage n'est pas décoratif : les titres sont ce que le site dit en
son nom, le reste est ce par quoi il cite le produit. La v3 avait
remplacé les deux polices du produit « pour plus de caractère » et
c'était une faute ; ce qui change ici est plus étroit.

Coût : **12,4 Ko** en plus (latin, sous-ensemble maison — le
sous-ensemble de Google en pesait 22,9).

### Le gabarit

- L'assistant à réponses préparées était au bas des **neuf** pages,
  avec son étiquette « aucun modèle · aucune donnée envoyée ». Il ne
  reste que sur l'accueil, les prix et le contact, et il s'appelle
  maintenant ce qu'il est : **questions fréquentes**.
- Trois sections de méta-discours — « Ce qu'on ne fait pas », « Ce qui
  n'y est pas », « Ce qu'on ne promet pas » — sur trois pages. Il en
  reste **une**, sur À propos.

### L'identité

Le code ne peut pas inventer un nom. Il peut poser l'emplacement et
refuser de l'oublier : la page À propos porte un bloc **Qui répond**
(nom, rôle, ville, depuis quand) rempli de « à compléter », comptés par
`verifier-avant-mise-en-ligne.mjs`, tolérés en préversion et **refusés**
dès que le site devient indexable.

## Le contrôle qui manquait

`scripts/verifier-signes-ia.mjs` — 16 contrôles. Il vérifie que
l'accueil montre une image réelle correctement décrite et dimensionnée,
que la police de titre n'est aucune des polices par défaut des
générateurs, que le décor abstrait et le bandeau de chiffres ne
reviennent pas, qu'aucun dégradé n'est coloré, que les appels à l'action
ne sont pas le même bloc recopié, qu'aucune formule de remplissage
n'apparaît, et qu'il reste au plus une section de méta-discours.

Même raison que le compteur de tournures de la v8 : un défaut qu'on se
contente de signaler revient au chantier suivant.

## Mesuré

| | v8 | v9 | v9 + capture client |
| --- | --- | --- | --- |
| Contrôles navigateur | 462 | 469 | **491** |
| Contrôles de prose | 13 | 13 | **13** |
| Contrôles « signes IA » | — | 16 | **32** |
| Mots dans le contenu | 5 333 | **4 717** | 4 717 |
| Performance / accessibilité / bonnes pratiques | 100 | 100 | **100** |
| CLS | 0 | 0 | **0** |
| LCP mobile — accueil | 1 517 ms | 1 817 ms | **1 811 ms** |
| Poids de l'accueil (mobile) | 105 Ko | 135 Ko | **131 Ko** |

Les 300 ms sont le prix de la capture du produit. C'est un échange
assumé : le site montrait 0 image et pesait moins ; il montre maintenant
ce qu'il vend.

### Un `srcset` qui ne servait à rien

En remplaçant la capture, l'accueil est passé à 144 Ko sur mobile et la
performance à **99**. La cause n'était pas les 6 Ko de plus du nouveau
fichier : c'est que la version 560 px n'était jamais servie.

La capture s'affiche sur ~358 px CSS au téléphone, mais un écran courant
a 2 ou 3 pixels physiques par pixel CSS. Le navigateur cherche donc une
source de 716 à 1074 px, et entre 560 et 1120 il prenait toujours la
grande. Les 560 px ne servaient qu'aux densités 1 — c'est-à-dire à
presque personne.

Un palier à 800 px a ramené la performance à 100 et l'accueil à 131 Ko,
soit **moins qu'avant l'ajout du palier**. Mesuré, densité par densité :

| Densité | Avant | Après |
| --- | --- | --- |
| 1 | 560 | 560 |
| 1,75 | 1120 | **800** |
| 2 | 1120 | **800** |
| 3 | 1120 | 1120 |

La leçon tient en une ligne : une déclaration `srcset` peut être
syntaxiquement juste et n'avoir aucun effet. Seul le fichier réellement
demandé le dit — deux contrôles du navigateur le vérifient maintenant.

Essai fait dans l'autre sens, pour ne pas payer deux fois : retirer le
préchargement de JetBrains Mono libère 28 Ko pour l'image et gagne 43 ms
de LCP, mais coûte 131 ms de premier affichage et 87 ms de blocage. Le
préchargement reste.

## Ce qui reste, et qui ne dépend plus du code

1. **Le nom d'une personne**, un rôle, une ville. C'est le manque de
   crédibilité le plus cité, et il tient en quatre lignes.
2. **L'adresse réelle du site** — `amn-devsec.example` est encore
   partout.
3. **Les sept champs des mentions légales**, quand la structure sera
   immatriculée.

## Sources

- 925 Studios, *AI Slop Web Design: Complete Guide to Spotting and Fixing Generic Websites (2026)*
- Originality.AI, *AI Generated Websites — How to Tell if a Site Was Made by AI*
- Utsubo, *The « Built with AI » Tell: 12 Signals That Drop Trust (2026)*
- Momentic, *34 types of AI slop you should avoid in your content*
- Mateusz Sikora, *Top 10 Signs a Website Was Built by AI*
- aiskill.market, *Banning Inter: Why Font Defaults Are the Slop Tell*
- Code Conspirators, *The 7 Trust Signals Missing From Most Professional Service Websites*
