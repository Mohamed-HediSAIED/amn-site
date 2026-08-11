# v3 — l'énergie, la voix, les prix

La v2 avait réglé la navigation. Le verdict d'Aaron dessus : « je kiff mais
peut mieux faire », avec trois reproches précis. Ce document dit ce qui a été
décidé pour chacun, et pourquoi.

---

## 1. « Ça doit transpirer une énergie »

La référence donnée était un site de vêtements dessiné à la main : typo
manuscrite, étoiles au crayon, flèches à main levée, zigzags sous les mots.
Donnée comme **ambiance**, pas comme modèle — et c'est heureux, parce que
transposer ce vocabulaire tel quel serait la pire idée du chantier. Du
crayonné sur un site qui vend de la supervision de sécurité, ça ne veut rien
dire. Ça dit « on a vu ça ailleurs et on a trouvé ça joli ».

Ce qu'il faut retenir de la référence, c'est le **principe** : une identité qui
prend parti, et une texture qui vient d'une main humaine plutôt que d'un
gabarit.

L'équivalent, dans ce métier-ci, c'est **la marque que laisse un opérateur sur
un relevé**. Quatre objets, tous tirés du sujet :

- **La trace** (`assets/trace.svg`) — un relevé de supervision : une ligne de
  base plate, et des événements dessus. Elle est irrégulière exprès : les pics
  n'ont ni la même hauteur ni le même espacement, et il y a un long calme au
  milieu. Une sinusoïde régulière ferait décoration ; un vrai relevé, non.
  C'est le motif signature du site, sous les bandeaux.
- **Les graduations** — un court segment de règle sous chaque intitulé de
  section. Un instrument est gradué, un slide de présentation ne l'est pas.
- **Le tampon** (`.tampon`) — l'équivalent domestique de l'étoile dessinée : la
  marque qu'on apposait sur un dossier traité. Penché de 2,4 degrés, parce
  qu'un tampon posé à la main n'est jamais droit.
- **La note dans la marge** (`.note-marge`) — ce qu'on griffonne à côté d'une
  ligne de relevé. Elle casse volontairement l'alignement de la grille.

Et une décision de couleur : **un seul endroit où l'ambre prend toute la
place**, le bloc d'appel de fin de page (`.cta--ambre`). Tout le reste du site
est noir. Un accent qui n'accentue jamais rien à pleine surface n'est pas un
accent, c'est une teinte.

Les quatre objets sont du CSS et un SVG servi en masque. Rien n'est animé,
aucun poids ajouté qui compte.

---

## 2. « Aucune trace d'IA, texte trop arrangé »

Le reproche est juste, et on peut nommer précisément le coupable.

Le texte de la v1/v2 était bâti presque partout sur **la même figure de style** :
l'antithèse en deux temps. « Absent, pas masqué. » « Un studio, pas une
plateforme. » « Le résultat vous arrive, pas le travail. » « Décrit par ce que
ça produit, pas par les outils qui le produisent. » Prise une fois, c'est une
bonne phrase. Répétée à chaque titre et chaque chute de paragraphe, c'est un
tic — et c'est exactement le tic d'un texte produit par une machine, parce que
c'est une forme qui sonne intelligente sans coûter d'effort.

Autres marqueurs retirés : les incises entre tirets cadratins partout, les
phrases de longueur identique alignées les unes sous les autres, le vocabulaire
de plaquette (« vous fournit », « en continu », « piloter votre activité »), et
le ton uniformément posé du début à la fin.

Ce qui a été fait à la place :

- **Longueurs très inégales.** « Personne. » à côté d'une phrase de trente
  mots. C'est le rythme qui donne l'impression d'une voix.
- **Du parlé.** Des dislocations comme « Vous, vous travaillez. Nous, on
  regarde le reste. », des questions posées au lecteur, des phrases qui
  commencent par « Et ».
- **Du concret à la place de l'abstrait.** « Les devis dans un traitement de
  texte, les factures on ne sait plus trop où » plutôt que « une gestion
  dispersée ».
- **Des chutes qui tranchent.** « On traite, et ensuite on vous raconte. Dans
  cet ordre. »

Le test appliqué à chaque paragraphe réécrit : le lire à voix haute. Si on
pouvait le dire à quelqu'un au téléphone sans avoir l'air de réciter, il
passait.

Ce qui n'a **pas** changé : le fond. Aucune promesse ajoutée, aucun chiffre
inventé, aucune fonctionnalité annoncée qui n'existe pas.

---

## 3. La typographie

Space Grotesk + JetBrains Mono, c'était correct et sans intention. Surtout
JetBrains Mono : c'est *la* police par défaut du développeur, on la voit
partout, elle ne dit rien de particulier.

Trois pistes ont été téléchargées, découpées aux mêmes plages Unicode que la
v2, et **rendues côte à côte dans un vrai navigateur** sur du vrai contenu du
site (titre, chapô, boutons, plaques, tuiles, chiffres) :

| | Rendu | Poids latin |
| --- | --- | --- |
| A — Space Grotesk + JetBrains Mono (v2) | propre, arrondi, oubliable | 53,7 Ko |
| **B — Archivo + Martian Mono** | **titres denses et industriels, mono d'instrument** | **49,0 Ko** |
| C — Bricolage Grotesque + Martian Mono | éditorial, mais son grain ne se voit pas à cette taille | ~48 Ko |

**Retenu : B.**

- **Martian Mono** (Evil Martians) porte l'identité. Il est large, dessiné pour
  être lu de loin sur un écran technique. Comme le site étiquette et numérote
  partout en mono — boutons, repères, console, prix — c'est lui qu'on voit en
  premier. C'est le changement qui rapporte le plus.
- **Archivo** (Omnibus-Type) est variable **en largeur**. Les titres sont tirés
  à 118 %, le texte courant reste à 100 %. Une seule famille, deux présences
  très différentes : c'est cet écart qui fait la voix, pas une police
  fantaisie de plus.

Les deux sont sous licence SIL Open Font License 1.1, téléchargées une fois et
servies depuis le site — aucun appel à Google Fonts, comme depuis la v1.

**Le piège à savoir :** Martian Mono avance environ 17 % plus large que
JetBrains Mono. Toutes les tailles et tous les interlettrages mono ont dû être
redescendus, sinon les boutons et le témoin de navigation débordaient sous
320 px. Si quelqu'un remonte un `letter-spacing` mono un jour, qu'il vérifie à
320 px.

**Et le poids ?** Une première version livrait deux fichiers Archivo, un par
largeur : 66 Ko. La version retenue garde l'axe de largeur dans un seul fichier
et limite les graisses à 400→600 (site.css n'emploie que 400 et 500) : **49 Ko,
soit 4,7 Ko de moins que la v2** — pour une typographie plus caractérisée.

L'ambre ne bouge pas. C'était la consigne.

---

## 4. Les prix

Aaron avait tranché des fourchettes. Il fallait en sortir **un chiffre net** :
afficher « 29 à 39 € » au visiteur, c'est lui dire qu'on n'a pas décidé.

| Forfait | Fourchette | Retenu | Pourquoi |
| --- | --- | --- | --- |
| Solo | 29–39 € | **35 €** | 29 € est un prix d'appel de logiciel en libre-service ; ici il y a quelqu'un derrière, et le prix doit le dire. 35 € est net et ne cherche pas à passer pour bon marché. |
| Petite équipe (≤ 5) | 89–129 € | **109 €** | À 89 €, cinq personnes coûteraient à peine 2,5 fois un solo — la supervision, elle, est bien plus large. 129 € est une barrière psychologique. 109 € met le siège autour de 22 €, cohérent avec le solo. |
| + Commerce | 19–29 € | **+ 25 €** | À 19 € l'option a l'air d'un accessoire ; à 29 € elle pèse presque un forfait solo. 25 € se lit d'un coup et s'assume. |
| Agence | 199–299 € | **249 €** | 199 € sous-vend un travail multi-parcs. 299 € appelle la négociation. 249 € est un prix décidé. |
| Sur-mesure | — | **sur devis** | Tel quel. |

Deux points de forme, non négociables et déjà tranchés avec Aaron :
**aucun bouton de paiement, aucun tunnel d'achat.** La page informe, le contact
passe par « Demander un accès ». Et la remise associative (30 à 50 % sur
justificatif) est annoncée, sobrement, dans sa propre section.

Ce qui a été **évité** : inventer des différences de fonctionnalités entre
forfaits. Le site affirme depuis la v1 que la liste des modules est complète et
sans sélection commerciale. La page prix dit donc la seule chose vraie — tout
le monde ouvre les mêmes dix modules, ce qui change c'est le nombre de
personnes et l'étendue de ce qu'on surveille.

---

## 5. RGPD

La politique de confidentialité était déjà exacte sur le fond (pas de cookie,
pas de mesure d'audience, polices auto-hébergées, base légale 6.1.b, durées de
conservation). Trois manques réels ont été comblés :

- **Le responsable du traitement** n'était nommé nulle part. Il l'est
  maintenant, par renvoi aux mentions légales, avec la manière concrète
  d'exercer ses droits (adresse email, ou formulaire en le précisant).
- **Le transfert hors Union européenne était passé sous silence.** Resend et
  Vercel sont deux sociétés américaines : le contenu du formulaire et les
  journaux de connexion sortent de l'UE. C'est dit franchement. La garantie
  précise (clauses contractuelles types ou cadre UE–États-Unis) est marquée
  **à compléter** plutôt qu'affirmée au jugé — voir §6.
- **L'absence de décision automatisée** est désormais explicite : ni score, ni
  profilage, ni tri algorithmique.

La liste des droits a été complétée (limitation, portabilité).

---

## 6. Ce qui reste ouvert, et qui n'appartient pas au code

`node scripts/verifier-avant-mise-en-ligne.mjs` sort en code 2 tant que ces
points sont là, et les liste à chaque exécution.

1. **Les 7 champs des mentions légales** — raison sociale, forme juridique,
   siège, SIREN/SIRET, TVA, directeur de la publication, email. Cherchés dans
   le dépôt et dans tout l'historique Git : ils n'y sont nulle part. Ils n'ont
   donc pas été inventés, et ne doivent pas l'être.
2. **La garantie de transfert hors UE** pour Resend et Vercel — à relever dans
   leurs contrats de sous-traitance et à recopier dans
   `confidentialite.html`.
3. **Le domaine réel** — tant que `amn-devsec.example` est là, aucun partage
   n'a d'aperçu.

Une page de confidentialité qui décrit autre chose que la réalité est pire que
pas de page du tout. C'est vrai aussi d'une mention légale au conditionnel.
