# amn-site — site vitrine AMN DevSec

Site public d'AMN DevSec : ce qu'on vend (un poste de travail supervisé),
comment on le remet, et un formulaire de demande d'accès. **Pas de paiement,
pas de panier, pas de tarifs publics, pas de portail client** — décisions
produit, pas des manques à combler plus tard.

HTML statique + une fonction serverless. **Aucune dépendance npm, aucun
`package.json`, aucune étape de construction.** Ce qui est dans le dépôt est
exactement ce qui est servi.

```
amn-site/
├── index.html  service.html  methode.html  a-propos.html  contact.html
├── mentions-legales.html  confidentialite.html  404.html
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
node scripts/verifier-navigateur.mjs            # ~2 min, Chromium réel
```

Le second lance 257 contrôles : 8 pages × 5 largeurs (console, requêtes en
échec, débordement horizontal, appels à des tiers), accessibilité (lien
d'évitement, focus, menu sans JavaScript, contrastes calculés sur les couleurs
réellement rendues), **le formulaire réellement envoyé** (cas nominal, sans
JavaScript, piège à robots, piège temporel, champ manquant, limite de
fréquence, origine étrangère, corps démesuré, injection HTML), et les en-têtes
de sécurité tels qu'ils sortent du serveur.

Il a besoin de Playwright. S'il n'est pas déjà là :

```sh
npm i -D playwright && npx playwright install chromium
```

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

## 7. Règles à ne pas casser

- **Aucune animation déclenchée au défilement.** C'est un choix : un site qui se
  révèle bloc par bloc est devenu la signature des pages produites à la chaîne.
  Seuls survol, appui et focus bougent, en 160 ms.
- **Le rouge est réservé aux alertes** (`--alert`), jamais décoratif. Une seule
  couleur d'accent : l'ambre.
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
