# Remplir l'identité du site

Trois pages du site attendent des informations que le code ne peut pas
inventer : les **mentions légales** (obligation), la **page À propos** (une
personne nommée), et un paragraphe de la **politique de confidentialité** (le
fondement juridique de deux transferts hors UE).

Tout tient dans un seul fichier.

```sh
# 1. remplir  identite.json  à la racine
# 2. vérifier — n'écrit rien, dit ce qui manque et ce qui cloche
node scripts/definir-identite.mjs
# 3. poser les valeurs dans les pages
node scripts/definir-identite.mjs --ecrire
```

Ne remplissez pas les pages à la main. Le script **vérifie ce qu'il écrit** :
clé de contrôle du SIREN, cohérence du numéro de TVA avec ce SIREN, format du
téléphone et du code postal, champs exigés selon la forme juridique. À la main,
un SIREN dont deux chiffres sont inversés s'installe en production sans que
rien ne le regarde — il ressemble à un SIREN, et il désigne quelqu'un d'autre.

> Je ne suis pas juriste. Ce qui suit couvre le socle de l'article 6 de la
> LCEN pour un site vitrine qui s'adresse à des professionnels. Si vous vendez
> un jour en ligne à des particuliers, d'autres mentions s'ajoutent — dont le
> médiateur de la consommation (art. L.&nbsp;616-1 du code de la consommation).
> À faire relire par votre comptable ou votre juriste avant l'ouverture.

---

## Éditeur du site

Ce que la loi demande de publier pour un professionnel : la dénomination et le
siège, le téléphone, le numéro d'inscription au registre, le capital social,
le numéro de TVA si vous y êtes assujetti, et le directeur de la publication
(LCEN, art. 6 III-1). S'y ajoute l'hébergeur — déjà rempli, c'est Vercel.

| Champ | Ce que c'est | Où le trouver |
| --- | --- | --- |
| `forme` | SASU, SAS, SARL, EURL, SCI, entreprise individuelle, micro-entreprise | vos statuts, ou l'avis de situation INSEE |
| `raisonSociale` | La dénomination exacte, **sans** la forme juridique. Pour une entreprise individuelle : vos prénom et nom | statuts / avis INSEE |
| `capitalEuros` | Le montant statutaire, en nombre (ex. `1000`) | statuts. `null` pour une entreprise individuelle |
| `siren` | 9 chiffres, sans espaces | [annuaire-entreprises.data.gouv.fr](https://annuaire-entreprises.data.gouv.fr) |
| `rcsVille` | La ville du greffe (« RCS de Lille ») | extrait Kbis. Vide pour une entreprise individuelle non commerçante |
| `tva` | Le numéro complet, ex. `FR11123456782`. Ou exactement `franchise` | votre comptable, ou déduit du SIREN |
| `siege` | L'adresse du siège, code postal à 5 chiffres | statuts / Kbis |
| `telephone` | Un numéro **réellement joignable** | — |
| `email` | L'adresse publiée. Elle recevra aussi les demandes RGPD | — |
| `directeurPublication` | La personne physique responsable du contenu, en général le dirigeant | — |

### Les deux cas, et ce qui change

**Société** (SASU, SARL, EURL…) — capital social et ville du greffe sont
obligatoires ; le script les exige.

**Entreprise individuelle ou micro-entreprise** — pas de capital : laissez
`capitalEuros` à `null`, le script écrit « Sans objet ». Et la mention **EI**
doit accompagner votre nom sur tous vos documents (art. R.&nbsp;123-237 du code
de commerce) : le script l'ajoute tout seul, n'écrivez pas « EI » dans
`raisonSociale`.

**Franchise en base de TVA** — mettez `franchise` dans le champ `tva` ; le
script écrit la formule exacte, « TVA non applicable, article 293 B du code
général des impôts ». Ne la tapez pas vous-même.

---

## La page À propos : quatre lignes qui pèsent lourd

Quatre champs : `qui`, `role`, `ou`, `depuis`.

Ça paraît anecdotique. Ça ne l'est pas : **l'absence de nom est le défaut de
crédibilité le plus relevé** sur les sites d'entreprise, et le premier signe
cité dans les inventaires de sites fabriqués par une IA. Un visiteur qui
hésite cherche à savoir à qui il parle. Sans nom, sans ville, sans date, il n'y
a personne — et un site sans personne se lit comme un gabarit.

Le ton du reste du site est direct et sans esbroufe. La signature doit l'être
aussi :

| Champ | Ce qui marche | Ce qui sonne faux |
| --- | --- | --- |
| `qui` | Prénom et nom de la personne qui répond vraiment | « L'équipe AMN », « notre service client » |
| `role` | Trois mots concrets : `supervision et développement` | « CEO & Founder », « expert en cybersécurité » |
| `ou` | La ville : `Lille` | « France », « Europe », rien |
| `depuis` | L'année de début : `2024` | « depuis toujours », une année gonflée |

Une seule règle : **ce doit être la personne qui répond réellement.** Nommer
quelqu'un qui ne lit pas les demandes est pire que ne nommer personne — la
première réponse le trahit.

---

## Transferts hors UE : deux mots à relever, pas à deviner

La politique de confidentialité dit que deux prestataires américains
interviennent (Vercel pour l'hébergement, Resend pour l'acheminement des
emails), et qu'un transfert hors UE doit être encadré par les garanties du
chapitre V du RGPD.

Reste à nommer **laquelle**, pour chacun. Ça se relève dans son contrat de
sous-traitance (DPA), ça ne se suppose pas :

- Vercel — <https://vercel.com/legal/dpa>
- Resend — <https://resend.com/legal/dpa>

Puis dans `identite.json`, une valeur par prestataire :

| Valeur | Ce que le site écrira |
| --- | --- |
| `ccts` | les clauses contractuelles types de la Commission européenne |
| `dpf` | son adhésion au cadre de protection des données UE–États-Unis |
| `dpf+ccts` | les deux |

Le script refuse toute autre valeur. Écrire « conforme RGPD » ne veut rien dire
et n'encadre rien.

---

## Ce qui reste après ça

`node scripts/verifier-avant-mise-en-ligne.mjs` liste les points restants à
chaque exécution. Une fois `identite.json` rempli, il ne devrait plus rester
que ce qui dépend du déploiement : l'adresse réelle du site
(`scripts/definir-domaine.mjs`), le vrai logo, et les variables du formulaire
de contact dans Vercel.

Le contrôle est **plus sévère en public qu'en préversion** : un champ resté
vide est un rappel tant que le site n'est pas indexable, et une erreur qui
fait échouer le contrôle dès qu'il l'est. On ne peut donc pas ouvrir le site
en laissant les mentions légales à l'état de gabarit.
