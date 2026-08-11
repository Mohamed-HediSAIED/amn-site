# v2 — la direction retenue, et les deux qui ne l'ont pas été

Ce document existe parce que le choix de navigation de la v2 n'est pas
évident : il oppose une demande de spectacle à deux contraintes qui ne se
négocient pas. Il dit ce qui a été envisagé, ce qui a été retenu, et à quel
prix.

**Le reproche fait à la v1**, mot pour mot : le site est fade, on s'y déplace
par des onglets classiques avec un nom au-dessus, il y a trop de défilement
dans un même onglet, et « Ce qu'on fait » est plat. Le site vend aussi des
sites : il doit être lui-même une preuve, pas seulement une affirmation.

**Les deux contraintes** qui encadrent la réponse :

1. **Ça reste un site.** Chaque page garde son URL, son référencement, et
   s'ouvre seule. Quelqu'un qui arrive sur `/service` depuis un lien partagé
   voit `/service`, pas une intro à traverser. L'accessibilité (clavier,
   lecteur d'écran, contraste) ne baisse pas d'un cran.
2. **Ça reste rapide sur un téléphone moyen.** Pas sur la machine qui a servi
   à le construire. Si l'ambition dégrade la fluidité, l'ambition baisse.

---

## Les trois pistes

### Piste A — le défilement en profondeur

Des couches en parallaxe, des sections qui se révèlent en descendant.

Techniquement sans risque et déjà largement maîtrisé. Écartée pour deux
raisons. D'abord elle aggrave le reproche principal : on demandait *moins* de
défilement dans un onglet, pas un défilement plus décoré. Ensuite le bloc qui
se révèle en arrivant dans le champ de vision est devenu la signature exacte
des pages produites à la chaîne — c'est le contraire du signal recherché, et
la v1 s'était déjà interdit ce procédé pour cette raison.

### Piste B — un objet 3D comme point d'ancrage

Un solide en fil de fer en WebGL au centre de l'accueil, le contenu réel en
HTML autour.

Écartée sur le rapport coût/message. Avec une bibliothèque (three.js, ~150 Ko
compressés) on fait exploser le budget d'une page qui pèse aujourd'hui moins
que ça en tout, pour un objet décoratif ; en WebGL écrit à la main c'est
quelques kilo-octets mais un contexte GPU permanent, donc une consommation de
batterie continue sur téléphone pour un objet qui ne dit rien de précis. Et un
solide qui tourne ne *veut rien dire* : il prouve qu'on sait faire tourner un
solide.

### Piste C — la console (retenue)

La navigation par onglets disparaît de l'en-tête. À sa place, un seul témoin
qui affiche **où on est**. On l'ouvre : le site s'efface et laisse la place à
un plan en perspective — un sol quadrillé qui fuit vers l'horizon, et les cinq
destinations posées dessus comme des plaques qu'on soulève au survol.

C'est la réponse à la table holographique donnée en référence, transposée dans
le métier : ce qu'on regarde n'est pas une carte de jeu, c'est **un poste de
supervision**. Le studio vend le fait de surveiller ce qui tourne derrière ;
la manière de se déplacer dans son site dit la même chose. Le décor n'est pas
plaqué, il est le sujet.

---

## Pourquoi la console tient les deux contraintes

**Elle ne remplace rien.** Le socle est un `<details>` : un élément HTML
standard, ouvert par son `<summary>`, qui contient cinq liens `<a href>`
ordinaires. Sans JavaScript, on clique, le panneau s'ouvre, on choisit, on y
va. Au clavier, `Tab` puis `Entrée` — c'est le comportement natif, pas une
reconstitution. Pour un lecteur d'écran c'est un groupe repliable contenant
une liste de liens, ce qui est exactement ce que c'est.

Le JavaScript n'ajoute que du confort : `Échap` pour fermer, le clic à côté,
le retour du focus sur le témoin, le maintien du focus dans le panneau tant
qu'il est ouvert, et la parallaxe au pointeur. Rien de tout cela n'est
nécessaire pour se déplacer dans le site.

**Les URL ne bougent pas.** Aucune route n'est réécrite, aucun contenu n'est
chargé à la volée, il n'y a pas d'état de navigation à restaurer. Les huit
pages sont les mêmes fichiers qu'avant, servies telles quelles. `sitemap.xml`,
les `canonical` et les liens du pied de page sont inchangés — un moteur de
recherche ne voit pas la différence, et les cinq liens de la console sont dans
le HTML servi, pas injectés.

**Le coût est nul quand elle est fermée.** C'est le point décisif pour la
performance, et c'est la raison d'être de cette forme. Un panneau `<details>`
fermé n'est pas rendu : ni le sol quadrillé, ni le halo, ni les plaques
n'existent pour le moteur de rendu tant que personne n'a ouvert. La page qui
se charge, celle que mesure Lighthouse et celle que voit un visiteur qui ne
touche à rien, ne porte aucun de ces éléments. Toute la dépense est déplacée
dans un moment court, choisi par le visiteur, où il ne lit rien d'autre.

**Ce qui bouge est composité.** Seuls `transform` et `opacity` sont animés —
jamais `filter`, jamais `box-shadow`, jamais `backdrop-filter`. Le quadrillé
est un dégradé statique : il ne dérive pas, parce qu'un grand dégradé qu'on
anime est précisément ce qui fait chuter un téléphone d'entrée de gamme. Le
relief vient de la perspective et de la réaction au survol, pas d'un mouvement
de fond permanent.

**Le texte reste plat.** Les plaques ne sont presque pas inclinées (3 à 4
degrés) : c'est le sol qui porte la fuite. Un titre couché dans un plan à 30
degrés est illisible et rendu flou par le navigateur, et aucune quantité de
spectacle ne rachète ça.

**Sur téléphone, l'ambition baisse d'elle-même.** Sous 720 px : pas de
parallaxe (rien ne survole), pas de balayage, quadrillé raccourci, plaques en
une colonne. Ce qui reste — le fond qui s'efface, la perspective, l'arrivée
décalée des plaques — suffit largement et ne coûte presque rien.

**`prefers-reduced-motion` coupe tout mouvement**, y compris l'arrivée des
plaques et la parallaxe. Le panneau apparaît, sans transition. Il reste
entièrement utilisable.

---

## Le filet de sécurité, décidé explicitement

La question posée était : quelle version simple coexiste avec l'expérience ?

**Il n'y a pas de « mode texte » à activer, et c'est volontaire.** Un mode
dégradé séparé est un deuxième site à maintenir, et c'est toujours celui qu'on
oublie de tester. Le filet est ailleurs, à trois niveaux :

1. **Chaque page est le filet de l'autre.** Aucune page n'a besoin de la
   console pour être atteinte, lue, ou partagée. La console est un raccourci,
   pas un passage obligé.
2. **Le pied de page porte la liste complète des liens**, en clair, sur les
   huit pages, sans JavaScript et sans interaction. C'est la navigation de
   secours permanente, et elle est visible par tout le monde — pas cachée
   derrière une option.
3. **La console elle-même se dégrade proprement**, dans cet ordre : sans
   parallaxe si le pointeur est tactile, sans mouvement si le système le
   demande, sans confort si JavaScript ne s'exécute pas, et sans perspective
   si le navigateur ignore les transformations 3D — dans ce dernier cas elle
   redevient une liste de liens empilés, ce qu'elle est déjà dans le HTML.

---

## Ce que la console ne règle pas

Elle règle la manière de passer d'une page à l'autre. Elle ne règle pas
« trop de défilement dans un onglet » ni « Ce qu'on fait est fade », qui sont
des problèmes de mise en page. Traités à part, dans le même chantier :

- **Une règle de section** apparaît à gauche sur les grands écrans : les
  sections de la page en cours, numérotées, cliquables, celle où on se trouve
  signalée. On sait combien il reste, et on peut sauter. Ce n'est pas une
  animation d'apparition — c'est un indicateur d'état, et il n'existe pas sous
  1320 px.
- **Les étapes de l'accueil passent en ligne** au lieu d'être empilées.
- **« Ce qu'on fait » devient une mosaïque de modules** plutôt qu'une liste :
  la même chose que ce que la cliente ouvrira réellement dans le produit. La
  densité vient du contenu, pas d'un remplissage.
- **La supervision reçoit un traitement différent de la mosaïque** — des
  cadrans plutôt que des tuiles — pour que les deux moitiés de la page ne
  soient pas deux listes identiques l'une sous l'autre.
- **Les marges de section sont resserrées** (104 → 84 px sur grand écran) :
  elles pesaient à elles seules près d'un quart de la hauteur de l'accueil.

### Ce que ça donne, mesuré

Hauteur réelle des pages, avant et après, dans un vrai navigateur :

| Page | 1440 px | 390 px |
| --- | --- | --- |
| Accueil | 4420 → 3965 px (**−10 %**) | 5902 → 5836 px (−1 %) |
| Ce qu'on fait | 3970 → 3776 px (−5 %) | 5261 → 5329 px (**+1 %**) |
| Comment ça se passe | 3817 → 3677 px (−4 %) | 5026 → 5004 px (0 %) |
| À propos | 3352 → 3212 px (−4 %) | 4628 → 4607 px (0 %) |

**Il faut le dire nettement : sur téléphone, les pages ne sont pas plus
courtes.** Une page à une seule colonne fait la hauteur de son contenu, et le
contenu ne devait pas bouger — c'était la consigne. « Ce qu'on fait » gagne
même 1 % parce que la mosaïque à deux colonnes tient un peu plus de place que
la liste qu'elle remplace.

Ce qui change sur téléphone n'est donc pas la longueur, c'est la densité (on
voit plus de choses par écran) et le nombre de gestes pour aller ailleurs : la
v1 demandait d'ouvrir un petit menu déroulant, la v2 ouvre un sélecteur plein
écran où les cinq destinations sont visibles d'un coup.

Et la règle de section, qui est la vraie réponse au « trop de défilement »,
**n'existe pas sous 1320 px**. C'est une limite assumée : elle a besoin de la
marge extérieure d'un grand écran pour ne pas mordre sur le texte. Un
indicateur de progression en haut de l'écran sur téléphone serait la suite
logique, il n'est pas fait.

---

## Ce que ça coûte, en dépendances

Rien. Aucune bibliothèque, aucun `package.json`, aucune étape de construction.
La console est du CSS et une centaine de lignes de JavaScript ajoutées à
`site.js`, qui était déjà chargé. La promesse de la v1 tient telle quelle.

---

## Ce qu'on accepte de perdre

Il faut le dire, parce que c'est un vrai renoncement et pas un détail.

**Sur grand écran, les sections ne sont plus accessibles en un clic.** La v1
affichait quatre onglets en permanence ; la v2 demande d'ouvrir la console
d'abord. C'est un clic de plus, sur toutes les pages, pour tout le monde.
C'est le prix exact de ce qui a été demandé — une navigation qui ne ressemble
pas à des onglets — et il est payé sciemment. Trois choses l'amortissent : le
témoin affiche en permanence où on se trouve, ce que quatre onglets ne
faisaient pas ; le bouton « Demander un accès » reste dans l'en-tête, sans
détour ; et le pied de page garde la liste complète.

Si à l'usage ce clic supplémentaire gêne plus qu'il n'impressionne, le retour
en arrière est propre : remettre le `<nav>` de la v1 dans l'en-tête à côté du
témoin, sans rien toucher d'autre. La console et une navigation classique
peuvent cohabiter — elles ne partagent aucun état.
