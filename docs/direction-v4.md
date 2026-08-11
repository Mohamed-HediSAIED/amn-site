# v4 — « ça ne doit pas faire IA »

Le critère de ce chantier n'était pas une fonctionnalité. C'était une
phrase : *le poste de travail, Mohamed a dit que ça ne fait pas du tout IA,
ça fait pro — je veux la même chose sur le site.*

Le produit est dans ce dépôt-ci (`amn-desktop`). On a donc commencé par le
lire, pas par imaginer ce que « pro » voudrait dire.

---

## 1. Ce qui rend le produit crédible, et ce qui manquait au site

Trois choses ressortent de `src/index.css` :

- **Une échelle d'élévation, avec sa raison.** *« Sur un fond quasi noir, une
  ombre portée seule est invisible : chaque niveau associe l'ombre à un filet
  clair d'un pixel en haut — ce qu'une plaque physique reçoit de la lumière
  ambiante. Trois niveaux, pas quatre. »*
- **Un retour d'appui sur tout ce qui est actionnable**, dosé à 1,5 % : *« assez
  pour se sentir, trop peu pour se voir comme une animation »*.
- **Chaque décision porte son pourquoi**, y compris les renoncements.

Le site n'avait rien de tout ça. Mesuré avant de toucher quoi que ce soit :

| | v3 | |
| --- | --- | --- |
| Texte en graisse 500 | **58,7 %** | le titre de page et une étiquette de 11 px avaient le même poids |
| Texte en graisse 600 | **0,8 %** | |
| Éléments avec une ombre | **1 sur 1 102** | tout était en filet de 1 px, plat comme un fil de fer |

C'est ça, « fait par une machine » : pas un défaut de goût, une **absence de
hiérarchie**. Rien n'est plus important que le reste, parce que personne n'a
tranché.

## 2. Ce qui a été corrigé

**Une échelle sur trois axes à la fois**, pas seulement la graisse. Archivo est
variable en graisse *et* en largeur, ça ne coûte pas un octet de plus :

```
600 / 118 %   titre de page      ← le seul poids lourd
600 / 112 %   titre de section
500 / 100 %   titre de bloc, étiquettes mono
400 / 100 %   texte courant
```

La largeur qui **redescend** à 100 % sur un `h3` est le point important : un
titre de carte n'a pas à concurrencer le titre de la page. La tension se crée
là, pas dans deux points de graisse.

**Le filet d'élévation du produit**, porté tel quel — mais seul le niveau 1
(le filet clair, sans ombre portée) est appliqué aux surfaces au repos. Le site
est fait de *« surfaces plates, arêtes dures, aucune lueur »* depuis la v1 ; on
n'allait pas coller un halo sous chaque carte au moment précis où on essaie de
faire plus sérieux. Les ombres portées sont réservées à ce qui flotte vraiment :
panneau de la console, panneau de l'assistant, cadre de la séquence.

**Le retour d'appui** étendu aux plaques, au témoin de navigation, à la règle
de section et aux liens de pied de page.

**Alignements optiques.** Un texte en capitales interlettré traîne un blanc
après sa dernière lettre : centré, il paraît décalé à gauche de la moitié de cet
interlettrage. On rend l'espace au début (`text-indent`) sur les boutons et les
libellés centrés. C'est quelques dixièmes de pixel — c'est aussi la différence
entre « aligné » et « aligné correctement ».

---

## 3. La séquence d'ouverture

Un contrôle de supervision qui se coche, puis le logo, puis la page.

**Elle est honnête, et c'est le point.** Elle ne met pas en scène un tableau de
bord imaginaire avec des chiffres inventés : elle contrôle **la page qu'on est
en train de regarder**, et deux de ses cinq lignes sont *mesurées à l'exécution*
(`performance.getEntriesByType('resource')` pour les appels sortants,
`document.cookie` pour les cookies). Si quelqu'un ajoute une balise tierce un
jour, le chiffre montera tout seul : le site se dénoncera au lieu d'afficher un
zéro faux.

Le compte d'en-têtes de sécurité (7 / 7) est **vérifié contre `vercel.json`**
par `scripts/verifier-navigateur.mjs`. Toucher aux en-têtes sans corriger
l'accueil casse la vérification.

**Architecture : le CSS fait tout, le JavaScript n'ajoute que du confort.**
L'animation se termine en sortant le panneau du cadre — la séquence se joue et
disparaît même sans JavaScript. Le script ne sert qu'à mesurer les deux valeurs,
à permettre de passer, et à ne pas rejouer la séquence à chaque page d'une même
visite. Même règle que la console de navigation depuis la v2.

**Deux pièges de performance, mesurés :**

1. **Le titre n'est jamais masqué.** Il est peint sous la séquence dès le
   premier rendu. Une séquence qui l'aurait caché puis révélé à 2,2 s aurait
   fait passer le LCP de 0,4 s à 2,2 s — on aurait gagné un effet en perdant
   la performance.
2. **`visibility` et `pointer-events` ont été retirés du jeu d'images.** Ce sont
   des propriétés que le compositeur ne sait pas traiter : Chrome recalculait
   alors le style de tout l'écran à chaque image. Coût mesuré : **278 ms de
   style et mise en page, et la note de l'accueil tombée de 100 à 92** pendant
   que les autres pages restaient à 100. Le panneau s'efface donc puis **sort du
   cadre** par une `transform` — même résultat, mais une propriété que la carte
   graphique traite seule. L'audit « animations non composées » de Lighthouse
   est revenu vide.

`prefers-reduced-motion` la supprime entièrement. Elle est spectaculaire, elle
n'est pas informative — la même chose est écrite sur `/service`.

---

## 4. Contenu dépliable

`<details>` natif, comme la console. Le contenu complet reste **dans le HTML
servi** — donc indexable ; seul l'affichage se replie. Rien n'est chargé à la
demande. Vérifié par un contrôle qui va chercher `plus-corps` dans la réponse du
serveur, et par un autre qui déplie **sans JavaScript**.

---

## 5. L'assistant

**Aucun modèle, aucun appel réseau, aucun coût.** Une quinzaine de réponses
écrites à la main, choisies par mots-clés, avec plusieurs formulations par sujet.

Trois règles :

1. **Honnête sur sa nature** quand on le lui demande.
2. **Ce qui n'est pas prévu renvoie au formulaire.** Jamais une réponse
   improvisée.
3. **Les sujets non tranchés ont une entrée exprès** — essai gratuit, durée
   d'engagement, résiliation, remboursement. Il répond qu'il ne sait pas.
   Sans cette entrée, « essai gratuit » serait tombé dans une réponse voisine et
   le composant aurait pris un engagement au nom d'Aaron.

**Ce n'est pas une bulle ronde en bas à droite avec une frimousse dedans** :
c'est le signe extérieur du gabarit, et ce chantier a justement pour but de ne
pas en avoir l'air. C'est un onglet mono qui annonce ce qu'il est avant même
qu'on l'ouvre.

Il n'est construit qu'à la première ouverture : poser les écouteurs au
chargement, c'était du travail sur le fil principal pour un composant que la
plupart des visiteurs n'ouvriront jamais.

---

## 6. Deux bugs trouvés par la vérification

Ils méritent d'être notés, parce qu'aucun des deux ne se voyait à l'œil.

**Le serveur local ne compressait pas.** Vercel sert du brotli ; le serveur de
test envoyait du brut. `site.css` pèse 65 Ko en clair et 19 Ko compressé : on ne
mesurait pas le site, on mesurait l'absence de compression du serveur de test.
Toutes les mesures publiées jusqu'à la v3 étaient donc gonflées d'environ 100 Ko
par page. Corrigé avec `zlib`, qui est dans Node — rien n'a été ajouté au dépôt.

**Une collision de `var`.** L'assistant déclarait `var form` ; le bloc du
formulaire de contact, plus bas dans la même enveloppe, déclare aussi
`var form`. `var` a une portée de fonction : le second écrasait le premier, nul
sur toutes les pages sans formulaire. Invisible tant que l'écouteur était posé au
chargement, mortel dès qu'il l'a été à la première ouverture. Les variables de
l'assistant sont préfixées maintenant.

---

## 7. Performance, comparée honnêtement

v3 et v4 mesurées avec **le même serveur, la même compression, le même
Chromium** — sinon la comparaison ne vaut rien :

| Page | v3 | v4 | LCP v3 | LCP v4 | Poids v3 | Poids v4 |
| --- | --- | --- | --- | --- | --- | --- |
| Accueil | 100 | 100 | 1 513 ms | 1 508 ms | 79 Ko | 90 Ko |
| Ce qu'on fait | 100 | 100 | 1 508 ms | 1 517 ms | 79 Ko | 89 Ko |
| Prix | 100 | 100 | 1 510 ms | 1 508 ms | 79 Ko | 89 Ko |

**+10 Ko** pour la séquence, l'assistant et le supplément de CSS. Le LCP ne
bouge pas. Accessibilité, bonnes pratiques et référencement restent à 100
partout.

Sur des exécutions répétées, l'accueil oscille entre **99 et 100** en mobile :
il reste ~56 ms de travail de fil principal à l'analyse de `site.js`, qui a
grossi. C'est la seule note qui n'est pas pleine, et elle est due à du script,
pas à la séquence.

`verifier-navigateur.mjs` : **423 contrôles**, contre 372 en v3.

---

## 8. Ce qui reste ouvert

- **Les 7 champs des mentions légales** et **la garantie de transfert hors UE** —
  inchangés depuis la v3, ils n'appartiennent pas au code.
- **Le vrai logo.** La séquence tire `/assets/logo.svg` : remplacer le fichier
  suffit, elle le reprend sans qu'on y touche.
- **`site.js` grossit.** 22 Ko en clair, 8 Ko compressé. C'est encore
  raisonnable, mais c'est ce qui coûte les 56 ms de l'accueil. Le jour où un
  cinquième composant arrive, il faudra le découper par page plutôt que de tout
  servir partout.
