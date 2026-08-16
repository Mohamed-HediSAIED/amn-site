# amn-site — site vitrine AMN DevSec

Site public d'AMN DevSec : ce qu'on vend (un poste de travail supervisé),
comment on le remet, et un formulaire de demande d'accès. **Pas de paiement,
pas de panier, pas de tarifs publics, pas de portail client** — décisions
produit, pas des manques à combler plus tard.

HTML statique + une fonction serverless. **Aucune dépendance npm, aucun
`package.json`, aucune étape de construction.** Ce qui est dans le dépôt est
exactement ce qui est servi. La v2 n'a rien ajouté à cette liste : la console
de navigation est du CSS et une centaine de lignes dans `site.js`.

> **La navigation ne ressemble pas à celle d'un site ordinaire.** Pourquoi,
> comment elle se dégrade, ce qu'elle coûte et ce qu'on a accepté de perdre :
> **`docs/direction-v2.md`**. À lire avant d'y toucher.
>
> **La typographie, le ton des textes, les prix et le RGPD** ont été repris en
> v3 : **`docs/direction-v3.md`** — dont le tableau qui explique pourquoi
> chaque prix vaut ce qu'il vaut, et la liste de ce qui reste à compléter.
>
> **La hiérarchie visuelle, la séquence d'ouverture, le contenu dépliable et
> l'assistant** sont en v4 : **`docs/direction-v4.md`**. À lire avant de
> toucher à l'échelle typographique ou à la séquence — les deux ont des
> raisons chiffrées.
>
> **Le site porte l'identité du produit, il ne s'en invente pas une.**
> Toutes les valeurs viennent de `amn-desktop` et sont recopiées dans
> **`docs/design-tokens.md`** — la source de vérité unique. Si une valeur du
> site ne s'y retrouve pas, elle est fausse.
>
> Pourquoi les coins « appliqués » se lisaient quand même carrés, pourquoi
> `mask-image` coûtait 30 % des images, et le seul écart volontaire avec le
> produit (le grain) avec son chiffrage : **`docs/direction-v6.md`**.
>
> Le fond du bandeau — une carte du monde presque noire, immobile, avec
> huit points qui respirent — remplace les nappes de télémétrie, jugées
> trop lumineuses. Pourquoi le prix par personne au-delà de cinq n'a PAS
> été publié (il croise le forfait agence à treize personnes), et les
> trois trous de l'assistant trouvés en cherchant les questions voisines :
> **`docs/direction-v7.md`**.
> L'historique des directions précédentes reste dans `docs/direction-v2…v5.md`.

### Le message vocal d'accueil

Il n'y a **aucun fichier audio** dans le dépôt, et c'est normal. Pour en
ajouter un : `assets/audio/LISEZ-MOI.txt` explique les deux gestes (déposer le
fichier, puis poser `data-piece` sur le `<body>` de `index.html`).

Tant que l'attribut n'est pas posé, le bloc reste caché, **aucune requête n'est
faite** et rien ne s'affiche. Jamais de synthèse vocale : le site passe son
temps à dire qu'il n'est pas fabriqué par une machine.

### Ce qui n'est PAS vérifié : les autres moteurs

Les 462 contrôles tournent sur **Chromium uniquement**. Firefox et WebKit —
le moteur de Safari, donc de tous les navigateurs iPhone — ne sont pas
installables dans l'environnement de développement : le proxy sortant bloque
le domaine de téléchargement de Playwright.

**Le site n'a donc jamais été vu dans un vrai Safari.** C'est le trou de
vérification le plus large du dépôt, et il ne se comblera qu'en ouvrant le
site sur un iPhone réel une fois la préversion déployée.

Ce qui a été fait à défaut : recenser les fonctionnalités CSS dont l'absence
casserait quelque chose, plutôt que de supposer.

| Fonctionnalité | Emplois | Conséquence si absente |
| --- | --- | --- |
| `aspect-ratio` | 1 (`.carte-boite`) | **catastrophique** — la carte du bandeau a zéro hauteur et les huit points s'écrasent sur une ligne. **Repli ajouté**, géométrie vérifiée identique au pixel près. |
| `:has()` | 3 | dégradée — le blocage du défilement derrière la console de navigation ne s'applique plus ; une lueur de survol disparaît. Rien ne casse. |
| `text-wrap: balance` | 2 | cosmétique — les titres se coupent moins joliment. |
| `inset` | 7 | Safari 14.1+, antérieur au socle imposé par `aspect-ratio`. |
| `mix-blend-mode`, `backdrop-filter` | **0** | n'apparaissent que dans des commentaires : retirés après mesure en v6. |

Socle réel : **Safari 15 / iOS 15** (2021), imposé par `aspect-ratio` — et
même en dessous, le repli tient.

### Préversion ou public

Tant que la structure n'est pas immatriculée, les mentions légales sont
vides — et un site professionnel indexé sans mentions légales n'est pas un
détail de finition. Un interrupteur bascule tout d'un coup :

```sh
node scripts/preversion.mjs        # dit seulement où on en est
node scripts/preversion.mjs on     # non indexable : on peut déployer et montrer
node scripts/preversion.mjs off    # indexable : le jour de l'ouverture
```

Trois verrous, parce qu'un seul ne suffit pas : `meta robots` sur chaque
page, `robots.txt` en `Disallow: /`, et l'en-tête `X-Robots-Tag`. Seul le
troisième est lu à tous les coups — `robots.txt` empêche d'EXPLORER, pas
d'INDEXER, et la balise `meta` ne se lit que si la page est explorée.

`verifier-avant-mise-en-ligne.mjs` lit le mode et change de sévérité : en
préversion les mentions vides sont un rappel, **en public c'est une erreur
qui fait échouer le contrôle**. On ne peut donc pas ouvrir le site en
laissant les champs vides sans que quelque chose crie.

L'aller-retour `on` puis `off` rend le dépôt identique au caractère près.

Une conséquence attendue : en préversion, **Lighthouse note le SEO à 69** au
lieu de 100. Le seul audit qui échoue est `is-crawlable`, « page bloquée à
l'indexation » — c'est le mode qui fonctionne, pas une régression. Mesuré
dans les deux sens : 69 en préversion, 100 en public.

### Les polices

**Space Grotesk et JetBrains Mono** — celles du produit — auto-hébergées,
régénérables :

```sh
pip install fonttools brotli      # une fois
node scripts/polices.mjs          # télécharge, découpe, réécrit assets/fonts.css
```

Les deux sont **variables en graisse**, et un seul fichier par plage Unicode
couvre donc toutes les graisses employées (400/500/600/700 pour la sans,
400/500/700 pour la mono).

La v3 les avait remplacées par Archivo + Martian Mono « pour plus de
caractère » ; la v6 est revenue en arrière. Le site ne cherche pas son
caractère, il porte celui du produit — et Space Grotesk n'ayant pas d'axe de
largeur, la hiérarchie tient sur la graisse et la taille seules. **Si un
interlettrage mono remonte un jour, vérifier à 320 px**, c'est là que ça
déborde en premier.

```
amn-site/
├── index.html  service.html  methode.html  prix.html  a-propos.html
├── contact.html  mentions-legales.html  confidentialite.html  404.html
├── site.css   site.js
├── api/contact.js          ← la seule partie dynamique
├── assets/                 ← polices auto-hébergées, favicons, image de partage
├── vercel.json             ← cleanUrls + en-têtes de sécurité (CSP comprise)
└── scripts/                ← outillage, non déployé (.vercelignore)
```

---

## 1. Travailler dessus en local

```sh
node scripts/serveur-local.mjs        # → http://localhost:4173
```

Le serveur local reproduit Vercel d'assez près pour que ce qui est vérifié ici
ait une valeur : `cleanUrls`, les en-têtes de `vercel.json` (CSP comprise), et
la vraie fonction `/api/contact`. Ajouter `RECHARGER_API=1` devant la commande
pour recharger la fonction à chaque appel pendant qu'on l'édite.

### Vérifier avant de pousser

```sh
node scripts/verifier-avant-mise-en-ligne.mjs   # 1 s, sans dépendance
node scripts/verifier-navigateur.mjs            # ~3 min, Chromium réel
```

Le second lance **462 contrôles** : 9 pages × 5 largeurs (console du
navigateur, requêtes en échec, débordement horizontal, appels à des tiers),
accessibilité (lien d'évitement, focus, contrastes calculés sur les couleurs
réellement rendues, y compris sur la page prix), **le monochrome** (la teinte
de chaque couleur rendue de chaque page — pas un `grep` sur la source : c'est
comme ça que huit `rgba(255, 178, 36, …)` avaient survécu à un nettoyage qui
cherchait « ffb224 »), **la console de navigation** (chaque destination répond
seule par son URL, ouverture au clic et au clavier, Échap, retour du focus,
reste de la page rendu inerte, défilement bloqué puis rendu, fonctionnement
sans JavaScript jusqu'à la navigation effective, parallaxe absente sur écran
tactile, mouvement réduit respecté, contrastes dans le panneau ouvert), la
règle de section, **le formulaire réellement envoyé** (cas nominal, sans
JavaScript, piège à robots, piège temporel, champ manquant, limite de
fréquence, origine étrangère, corps démesuré, injection HTML), et les en-têtes
de sécurité tels qu'ils sortent du serveur.

Il a besoin de Playwright. S'il n'est pas déjà là :

```sh
npm i -D playwright && npx playwright install chromium
```

### Mesurer la performance pour de vrai

Deux mesures, deux questions différentes. Aucune des deux n'ajoute quoi que ce
soit au dépôt : Lighthouse est appelé depuis une installation à part.

```sh
npm i --no-save --prefix /tmp/lh lighthouse
node scripts/mesurer-lighthouse.mjs     # 6 pages × mobile et ordinateur
node scripts/mesurer-fluidite.mjs       # processeur bridé ×6
```

`mesurer-lighthouse` répond à « combien coûte la page qui se charge ». Elle
mesure donc la console **fermée**, ce qui est le bon chiffre : c'est l'état
dans lequel arrive un visiteur.

`mesurer-fluidite` répond à « est-ce que ça rame quand on s'en sert ». Elle
bride le processeur ×6 (Lighthouse mobile se contente de ×4), puis mesure
l'intervalle entre images pendant le défilement, l'ouverture de la console et
l'inclinaison au pointeur. Une image au-delà de 32 ms est une image sautée.
Chaque geste est joué trois fois et toutes les images sont mises en commun :
sur une seule passe, la pire image varie du simple au double.

Derniers relevés (v4, serveur compressé comme en production) :

| | Perf | A11y | Bonnes pratiques | SEO | CLS |
| --- | --- | --- | --- | --- | --- |
| Mobile, 6 pages | **100** | 100 | 100 | 100 | 0 |
| Ordinateur, 6 pages | **100** | 100 | 100 | 100 | 0 |

LCP mobile : 1,52 s sur l'accueil, 1,59 à 1,68 s sur les pages intérieures.
La v6 ajoute ~10 Ko par page (le tracé des six nappes de télémétrie) et 80 à
170 ms de LCP sur les pages intérieures. Le score reste à 100 et le CLS à 0,
mais **c'est une dégradation réelle, et elle est déclarée** : elle n'apparaît
pas dans la note.

**Règle apprise en v5, à ne pas réapprendre :** ne jamais faire de fondu
d'opacité sur un bloc contenant du texte. Pendant le fondu, tout ce qu'il
contient est du texte mélangé au fond, et l'audit de contraste le mesure
pendant le fondu. Glisser, oui ; s'effacer, non.

### Regénérer les images

```sh
node scripts/generer-images.mjs   # favicons + assets/og.png
```

Elles sont rendues dans un vrai navigateur avec les polices du site, puis
figées en pixels — un SVG contenant du `<text>` retomberait sur une autre
police sur la machine qui l'affiche.

---

## 2. Mettre en ligne (première fois)

Le site n'a **jamais été déployé**. Rien à récupérer, tout est à créer.

⚠️ **Avant de commencer, trancher un point** : il existe déjà un projet Vercel
`amn-devsec` (→ `amn-devsec.vercel.app`) qui sert l'ANCIEN site vitrine AMN,
celui du dossier `AMN-CORP-WEB/`, avec un positionnement d'agence web et une
identité verte. Deux sites « AMN DevSec » en ligne en même temps, c'est un
prospect sur deux qui tombe sur le mauvais. Soit ce nouveau site remplace
l'ancien (même projet Vercel, on change le *Root Directory*), soit il prend une
adresse à lui et l'ancien est retiré. À décider avec Mohamed.

### Option A — remplacer l'ancien site (recommandé)

Tableau de bord Vercel → projet `amn-devsec` → **Settings → Build & Deployment
→ Root Directory** → mettre `amn-site` → **Save** → **Deployments → Redeploy**.
L'adresse `amn-devsec.vercel.app` sert alors ce site, sans rien changer d'autre.

### Option B — nouveau projet

1. Vercel → **Add New… → Project** → importer `Mohamed-HediSAIED/AllStoreee`.
2. **Root Directory : `amn-site`** ← le réglage qui compte. Sans lui, Vercel
   déploie la racine du dépôt (AllStore, ONZE, tout le reste).
3. Framework Preset : **Other**. Aucune commande de construction, aucun dossier
   de sortie : le site est déjà statique.
4. Déployer.

### Puis, dans les deux cas

```sh
node scripts/definir-domaine.mjs https://ADRESSE-REELLE
```

Cette commande remplace l'adresse de gabarit `https://amn-devsec.example` dans
les `canonical`, les `og:url`, les `og:image`, le JSON-LD, `robots.txt` et
`sitemap.xml` — et remet à jour les empreintes de la CSP au passage. **Tant
qu'elle n'a pas été lancée, chaque partage WhatsApp ou Instagram du lien part
sans aperçu.** Commiter, repousser, redéployer.

---

## 3. Brancher le formulaire (obligatoire)

Sans variable d'environnement, `/api/contact` répond **503 avec un message
explicite**. C'est voulu : un formulaire qui affiche « merci » sans rien envoyer
est la pire panne possible, et elle est invisible.

| Variable | Rôle |
| --- | --- |
| `RESEND_API_KEY` | Clé d'API [Resend](https://resend.com) |
| `CONTACT_TO` | L'adresse qui reçoit les demandes |
| `CONTACT_FROM` | *(optionnel)* expéditeur — défaut `AMN DevSec <onboarding@resend.dev>` |
| `CONTACT_WEBHOOK_URL` | *(optionnel)* second canal, reçoit la demande en JSON |

À poser dans Vercel → **Settings → Environment Variables**, en cochant
**Production ET Preview**. Jamais dans le code : rien de tout ça n'est commité.

### Pourquoi Resend et pas un service de formulaires

Un service tiers (Formspree et compagnie) ferait transiter chaque demande de
prospect par une société de plus, sans limite de fréquence à nous, et se verrait
depuis le code source de la page. Pour un studio qui vend de la rigueur, c'est
un mauvais signal. Ici l'endpoint est à nous, la clé reste côté serveur, et rien
n'est visible depuis le navigateur.

### Mise en route sans nom de domaine

Créer un compte Resend, générer une clé, ne rien configurer d'autre : le site
enverra depuis `onboarding@resend.dev`, qui fonctionne sans domaine vérifié.

⚠️ **Seule limite, mais elle est bloquante si on l'ignore** : avec cet
expéditeur partagé, Resend ne délivre qu'à **l'adresse email du compte Resend
lui-même**. `CONTACT_TO` doit donc être cette adresse-là. Une fois un domaine
vérifié dans Resend, mettre `CONTACT_FROM` sur une adresse de ce domaine et
`CONTACT_TO` devient libre.

### Vérifier que ça marche pour de vrai

Après le déploiement, remplir le formulaire en ligne **une fois** et vérifier
la réception. Ne pas s'en tenir au « merci » affiché à l'écran : c'est
précisément ce qui a laissé un autre site de l'écosystème encaisser des
demandes dans le vide pendant des mois.

---

## 4. Protection anti-abus — ce qu'elle fait, et ce qu'elle ne fait pas

Dans `api/contact.js`, sans CAPTCHA (un CAPTCHA transmet des informations sur le
navigateur du visiteur à un tiers et pénalise surtout ceux qui utilisent des
outils d'accessibilité) :

- **piège à robots** — un champ invisible et hors du parcours clavier ; rempli,
  la réponse est « merci » et rien ne part ;
- **piège temporel** — moins de 2,5 s entre l'ouverture de la page et l'envoi,
  même traitement. Mesuré par le navigateur des deux côtés, donc insensible à
  une horloge mal réglée ;
- **limite de fréquence par origine** — 3 envois / 10 min, 10 / 24 h, plus un
  plafond global de 60 / h. L'adresse IP est transformée en empreinte non
  réversible (sel tiré au démarrage) et n'est jamais écrite ni transmise ;
- **bornes** — corps refusé au-delà de 16 Ko, champs plafonnés, message truffé
  de liens écarté ;
- **même origine uniquement** — aucun en-tête CORS n'est renvoyé, et un envoi
  portant une autre origine est refusé en 403 ;
- **échappement** — les champs sont échappés dans l'email, et les retours à la
  ligne retirés de ceux qui servent d'en-têtes (pas d'injection d'en-tête).

**Ce que ça ne fait pas :** les compteurs vivent dans la mémoire de l'instance
serverless. Vercel peut en démarrer plusieurs ou recycler la vôtre : c'est un
ralentisseur très efficace contre un script, ce n'est pas un mur. Pour un
plafond dur, activer **Vercel → Firewall → Rate Limiting** sur `/api/contact`
(quelques clics, aucun code). À faire le jour où le lien est diffusé largement.

---

## 5. Brancher un vrai nom de domaine, plus tard

1. Acheter le domaine (Vercel le fait directement, ou n'importe quel bureau
   d'enregistrement). ⚠️ Désactiver la traduction automatique du navigateur
   avant : elle traduit les noms de domaine dans le sélecteur Vercel, et on
   achète autre chose que ce qu'on croit.
2. Vercel → projet → **Settings → Domains → Add**. Suivre les enregistrements
   DNS indiqués, attendre le certificat.
3. Choisir **qui est le domaine principal**, apex (`amn-devsec.fr`) ou `www`.
   Vercel met parfois `www` par défaut et fait rediriger l'autre — c'est
   modifiable, mais autant le décider tout de suite.
4. `node scripts/definir-domaine.mjs https://le-domaine-choisi` → commiter →
   pousser.
5. Compléter `mentions-legales.html` (voir §6) et relancer
   `node scripts/verifier-avant-mise-en-ligne.mjs`.

---

## 6. Ce qui doit être complété avant d'exposer le site publiquement

`node scripts/verifier-avant-mise-en-ligne.mjs` les liste à chaque exécution,
et sort en code 2 tant qu'il en reste.

- **`mentions-legales.html`** — raison sociale, forme juridique, siège, SIRET,
  directeur de la publication, adresse email. Obligation légale (LCEN), et un
  gabarit `à compléter` visible en production est le premier signal de
  négligence pour un studio qui vend de la rigueur.
- **Le domaine** — tant que `amn-devsec.example` est là, aucun partage n'a
  d'aperçu.

---

## 6 bis. Le logo

Le logo vit dans **un seul fichier : `assets/logo.svg`**. Il est posé en `<img
class="logo-mark">` dans l'en-tête et le pied de page des huit pages, plus la
page de confirmation servie par `api/contact.js`.

**Pour poser le vrai logo : remplacer ce fichier, et rien d'autre.** Sa hauteur
est imposée par `.logo-mark` dans `site.css` (21 px, 24 px au-dessus de 720 px,
26 px dans le pied de page) et la largeur suit toute seule. Aucune page, aucune
règle CSS ne connaît le contenu du fichier.

Ce qui est là aujourd'hui est un **gabarit**, pas la marque : les lettres AMN
en traits fins avec le dégradé graphite → blanc, dessinées en chemins SVG pour
ne dépendre d'aucune police installée.

Deux points à connaître avant de remplacer :

- Les attributs `width="104" height="40"` sur les balises `<img>` ne servent
  qu'à réserver la place avant le chargement — c'est ce qui tient le CLS à 0.
  **Si le nouveau logo n'a pas le même rapport largeur/hauteur, il faut les
  mettre à jour** (une recherche-remplacement sur `class="logo-mark"`), sinon
  la mise en page sautera au chargement.
- Le mot **« DEVSEC » n'est pas dans le logo** : c'est du texte (`.logo-sub`),
  volontairement, pour rester net à toute densité d'écran et lisible par un
  lecteur d'écran. Si le logo officiel contient déjà « DEVSEC », retirer ce
  `<span class="logo-sub">DEVSEC</span>` des pages.

Un PDF n'est pas utilisable tel quel : l'exporter en SVG (chemins vectorisés,
pas de texte laissé en police) avant de remplacer le fichier.

---

## 7. Règles à ne pas casser

- **Aucun bloc ne se révèle au défilement.** C'est un choix : un site qui
  apparaît morceau par morceau en descendant est devenu la signature des pages
  produites à la chaîne. En dehors de la console, seuls survol, appui et focus
  bougent, en 160 ms. La règle de section (`.rail`) suit la descente, mais elle
  ne fait *apparaître* rien : elle change une couleur et allonge un tiret.
- **La console est la navigation, et elle doit rester un `<details>`.** Cinq
  `<a href>` dans le HTML servi, ouverts par un `<summary>`. Tout ce que fait
  `site.js` autour (Échap, clic à côté, focus, `inert`, parallaxe) est du
  confort : si on le retire, la navigation marche encore. Ne pas la
  transformer en panneau piloté par JavaScript.
- **Rien ne tourne en boucle.** L'ouverture de la console est une séquence
  finie. Une animation infinie, même minuscule, tient le compositeur éveillé
  et vide la batterie. Seuls `transform` et `opacity` sont animés — jamais
  `filter`, `box-shadow` ou `backdrop-filter`.
- **Pas de `backdrop-filter` sur l'en-tête.** Il se recalcule à chaque image
  pendant le défilement, et il ferait du bandeau le bloc conteneur de ses
  descendants `position: fixed` — le panneau de la console se retrouverait
  dimensionné sur les 64 px du bandeau au lieu de la fenêtre.
- **Le rouge est réservé aux alertes** (`--alert`), jamais décoratif. Une seule
  couleur d'accent : l'ambre. Elle ne prend toute la place qu'à **un seul
  endroit par page**, le bloc d'appel de fin (`.cta--ambre`) — c'est ce qui
  fait qu'elle accentue encore quelque chose.
- **L'assistant ne répond jamais autre chose que ce qui est écrit dans
  `site.js`.** Pas de modèle, pas d'appel réseau. Tout sujet non tranché
  (essai, engagement, résiliation, remboursement) a une entrée qui dit qu'on
  ne sait pas et renvoie au formulaire — sans elle, ces questions tomberaient
  dans une réponse voisine et le composant prendrait un engagement.
- **Les animations n'utilisent QUE `transform` et `opacity`.** Ajouter
  `visibility` ou `pointer-events` à un jeu d'images empêche le compositeur de
  prendre l'animation en charge : mesuré à 278 ms de style et mise en page sur
  l'accueil, et la note de performance tombée de 100 à 92.
- **Le serveur local compresse comme Vercel** (`scripts/serveur-local.mjs`).
  Sans ça, toute mesure faite en local est fausse d'environ 100 Ko par page.
- **Aucun bouton de paiement, nulle part**, page prix comprise. Le site
  informe ; l'entrée en relation passe par « Demander un accès ». C'est une
  décision produit, pas une étape qui manque.
- **Ne jamais inventer une information légale.** SIRET, adresse, forme
  juridique, garanties de transfert hors UE : si l'information n'est pas
  disponible, elle reste marquée `à compléter` et le script de vérification
  sort en code 2. Un gabarit visible en production est gênant ; une mention
  légale fausse est un problème.
- **Aucun script écrit dans les pages**, en dehors du JSON-LD. La CSP n'autorise
  que les fichiers du site plus les empreintes des blocs JSON-LD. Après toute
  modification d'un de ces blocs :
  `node scripts/csp-empreintes.mjs --ecrire` — sinon le balisage est bloqué en
  silence et Google ne le lit jamais.
- **Aucun attribut `style=`** en ligne, pour la même raison.
- **Les polices sont auto-hébergées.** Ne pas rebasculer sur Google Fonts : ça
  transmettrait l'adresse IP de chaque visiteur à un tiers, ce que
  `confidentialite.html` affirme ne pas faire.
- **Si un outil de mesure d'audience est ajouté un jour**, ou si le canal de
  livraison du formulaire change, `confidentialite.html` doit être mis à jour
  **dans le même commit**. Une page de confidentialité qui décrit autre chose
  que la réalité est pire que pas de page du tout.
- **Le site ne nomme jamais les outils internes** (Scanner, Comply, SSL Monitor,
  Trackers). Ils sont décrits par ce qu'ils produisent. Même règle que côté
  produit, où ils sont absents du build livré aux clientes.

---

## 8. Si le site déménage dans son propre dépôt

Il est aujourd'hui un sous-dossier d'`AllStoreee` parce que c'est le dépôt
auquel la session avait accès. Rien ne l'y attache : tous les chemins sont
relatifs à `amn-site/`, et le *Root Directory* de Vercel isole déjà le
déploiement.

```sh
git subtree split --prefix=amn-site -b amn-site-seul
# puis pousser cette branche sur le nouveau dépôt, et repointer le projet Vercel
```
