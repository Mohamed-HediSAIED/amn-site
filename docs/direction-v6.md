# v6 — la fidélité au produit

> « Tu n'inventes plus de direction créative. Tu extrais et tu copies. »

Cinq chantiers ont produit cinq directions différentes, et aucune ne
ressemblait à l'application. La méthode a changé : plus rien n'est choisi
pour le site. Tout vient de `docs/design-tokens.md`, donc de
`amn-desktop/src/index.css` et des classes réellement employées dans
`src/screens/`.

---

## 1. Les coins arrondis : j'avais raison sur la valeur, tort sur le résultat

Aaron a regardé la maquette et a dit : **« coins arrondis non appliqués »**.
Mesure au navigateur, avant de toucher à quoi que ce soit :

```
.carte 16px · .stats 16px · .ico 12px · .etq 6px · .btn 0px
```

Exactement l'extraction. Les rayons **étaient** appliqués. Il aurait été
facile d'en conclure qu'Aaron avait mal vu — et ç'aurait été l'erreur du
chantier.

La vraie cause était ailleurs. Le produit centre une colonne `max-w-3xl`
(768 px) dans une coquille `max-w-6xl` : sa carte de module fait
**248 px**. La maquette posait une colonne de 1 120 px et sortait des
cartes de **348 px**. Rendues côte à côte, la carte de 248 px se lit
arrondie et celle de 348 px se lit carrée — même rayon, coin 40 % moins
présent.

> **Recopier un jeton ne suffit pas si on ne recopie pas la proportion sur
> laquelle il s'applique.** Un rayon est une fraction d'un coin, pas une
> valeur absolue.

La géométrie du produit est donc entrée dans `design-tokens.md` au même
titre que les couleurs, et la carte du site mesure aujourd'hui 248 px.

## 2. Deux erreurs dans ma propre extraction

Le document se présentait comme « la source de vérité ». Il portait deux
affirmations fausses, corrigées :

- **« les boutons et les champs sont carrés — aucune classe de rayon »**.
  Trop absolu : 41 boutons sur 55 et 88 champs sur 102. Le carré est la
  règle, pas une loi ; les exceptions sont les boutons posés dans un
  panneau déjà arrondi.
- **« le coin coupé n'existe nulle part dans le produit »**. Faux dans la
  lettre : `.corner-cut` est bien défini dans `index.css`. Mais
  `grep -r "corner-cut" src/ --include=*.tsx` renvoie **0**. C'est du code
  mort — juste dans les faits, faux dans la formulation.

## 3. Les nappes : le coupable n'était pas celui qu'on croit

Seul endroit où Aaron autorise à dépasser l'extraction. Avant d'ajouter
quoi que ce soit, mesure de l'existant — processeur bridé ×6, trois
passes, images comptées pendant 3 s d'animation continue :

| | 4 nappes + `mask-image` | 6 nappes, 4 natures, 2 aires, voiles en dégradé |
| --- | --- | --- |
| Images sautées — ordinateur | **30,3 %** | **2,31 %** |
| Images sautées — téléphone | 0 % | 0 % |
| p95 — ordinateur | 33,4 ms | **16,8 ms** |
| Tâches longues | 0 | 0 |
| Mémoire de couches | 49,8 Mo | **44,7 Mo** |

**Le coût ne venait pas du nombre de courbes, il venait de
`mask-image`** : sur le conteneur, il sortait les nappes du chemin
composé. Deux voiles en dégradé de la couleur du fond donnent le même
estompage des bords pour 1,14 %.

C'est ce qui a payé la richesse : six plans au lieu de quatre, **quatre
natures de signal** — houle, palier, dérive, pointe — au lieu d'une seule
marche aléatoire répétée, et deux aires dégradées reprises de
`AreaChart.tsx`. Un mur de supervision n'affiche pas six fois le même
signal ; c'est de là que vient la présence, pas du nombre.

Coût en octets : **2,4 Ko** une fois compressé en brotli.

## 4. Le grain : le seul écart volontaire, et il est chiffré

Le voile de grain est un élément d'identité que le site n'avait **pas du
tout**. Il arrive. Mais pas à la recette exacte du produit, et le motif
est mesuré :

| Geste (processeur bridé ×6) | 9 % `soft-light` (produit) | 3,5 % sans mélange |
| --- | --- | --- |
| Ouverture de la console, 1440 px | **95** images sautées | 11–20 |
| Parallaxe au pointeur, 1440 px | **137** images sautées | 10–24 |
| p95 | 33,4 ms | **16,8 ms** |

`mix-blend-mode` sur un voile plein cadre en `position: fixed` oblige le
navigateur à recomposer tout le viewport à chaque image — neuf à treize
fois plus d'images sautées pendant une interaction. Le cahier des charges
demande explicitement de réduire l'ambition dans ce cas.

L'opacité de remplacement a été choisie **à l'œil, sur un comparatif
rendu** : 5 % éclaircit visiblement le noir, 2,5 % s'efface, 3,5 % tient
la densité de grain sans voiler. C'est le seul endroit du chantier où le
site s'écarte volontairement de la recette du produit.

## 5. Le contraste : le produit n'est pas un site public

`--color-text-muted` `#616160`, recopié tel quel, a fait tomber
l'accessibilité à **93** sur onze éléments : 3,19:1 sur le fond, 2,99:1
sur une carte, quand la norme AA en demande 4,5. Une étiquette de chiffre
(« MODULES LIVRÉS ») porte du sens.

Le site avait déjà tranché en v1 : `#858583` est le plancher lisible
(5,04:1 sur `#131313`), `#616160` reste décoratif. Règle reprise telle
quelle → retour à **100**.

## 6. Huit ambres que mon propre nettoyage avait ratées

Après avoir écrit « l'ambre a disparu », un contrôle de la page prix a
montré une carte encore tiède. Huit valeurs `rgba(255, 178, 36, …)`
restaient dans le CSS : lueurs, balayage de la console, anneau de focus,
fond de la carte phare.

La passe de nettoyage avait cherché `ffb224`, `amber`, `orange` et
« ambre ». **Une couleur écrite autrement est une couleur quand même.**

Un contrôle permanent a donc été ajouté, et il ne lit pas la source : il
parcourt les couleurs **réellement rendues** de chaque élément de chaque
page, calcule leur teinte, et n'admet que le gris et le rouge d'alerte
réservé (≈ 8°). Vérifié en le faisant échouer exprès — `--accent` remis à
`#ffb224` déclenche les 9 contrôles, avec l'élément et la teinte en clair.

## 7. Ce qui a été retiré

Le **chrome du dossier** de la v5 — cartouche, numéros d'article — est
parti des neuf pages : 30 numéros, 9 cartouches. C'était une fiction
(« Feuillet 01 / 06 », « Indice v5 ») sans aucune contrepartie dans le
produit. La garder en disant « fidèle au produit » aurait été incohérent.

Le **coin coupé** cède la place à l'arrondi. La classe a été *renommée*
`.notch` → `.arrondi` plutôt que redéfinie en douce : un nom ne doit pas
décrire le contraire de ce qu'il fait.

## 8. L'assistant : il fallait d'abord qu'on le voie

> « Je ne savais même pas qu'il était là, je n'aime pas sa disposition. »

Il était un onglet collé en bas à droite, étiquette mono de 10 px en
capitales — soit exactement la forme du widget de support qu'on referme
sans lire. Il est maintenant un **bloc dans le flux** en fin de page, qui
dit en toutes lettres ce qu'il est et ce qu'il n'est pas :

> **Une question ? Les réponses sont déjà écrites.**
> Pas une intelligence artificielle : des réponses préparées à l'avance.
> `AUCUN MODÈLE · AUCUNE DONNÉE ENVOYÉE`

Toujours un `<details>` : il s'ouvre sans JavaScript, et le champ retombe
sur `/contact` si le script n'a pas pris la main. Aucun modèle, aucun
appel réseau, aucun coût — inchangé.

## 9. Mesuré

| | v5 | v6 |
| --- | --- | --- |
| Performance, accessibilité, bonnes pratiques, SEO | 100 | **100 partout**, mobile et ordinateur |
| CLS | 0 | **0** |
| LCP mobile — accueil | 1 511 ms | **1 517 ms** |
| LCP mobile — pages intérieures | ~1 510 ms | **1 590 – 1 680 ms** |
| Poids par page | ~92 Ko | **100 – 106 Ko** |
| Contrôles automatisés | 430 | **435** |

Le poids monte de ~10 Ko (le tracé des six nappes) et le LCP des pages
intérieures de 80 à 170 ms. Le score reste à 100 et le CLS à 0, mais
**c'est une dégradation réelle et elle est déclarée** : elle n'apparaît
pas dans la note.

## 10. Ce que je ne garantis pas

- **La ressemblance reste un jugement.** Les valeurs sont copiées et
  vérifiables une à une ; la parenté d'ensemble, non. C'est Aaron qui
  tranche, écran contre écran.
- Le site **n'est pas** l'application, et ne cherche pas à l'être : pas de
  fausse barre latérale, pas de faux écran produit. Ce qui est transporté,
  ce sont les valeurs, pas la mise en page d'un logiciel.
- Les **7 champs des mentions légales** et la **garantie de transfert hors
  UE** restent à compléter. Ils n'appartiennent pas au code, et rien n'a
  été inventé pour boucher le trou.
- Le **vrai logo** et le **message vocal** : deux fichiers à déposer.
- Les mesures de composition sont prises en **rendu logiciel** (conteneur
  sans carte graphique), ce qui majore le coût par rapport à un vrai
  appareil. Elles valent en comparaison avant/après, pas en valeur absolue.
