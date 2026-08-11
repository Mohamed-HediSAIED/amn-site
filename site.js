/* ==================================================================
   AMN DevSec — site vitrine
   ==================================================================
   Tout ce qui est ici est une AMÉLIORATION. Sans JavaScript, le site
   reste entièrement navigable et le formulaire s'envoie normalement
   (POST classique vers /api/contact, qui répond alors une page HTML).
   Aucun code en ligne dans les pages : la politique de sécurité de
   contenu (voir vercel.json) n'autorise que les fichiers du site.
   ================================================================== */
(function () {
  'use strict';

  /* ================================================================
     LA SÉQUENCE D'OUVERTURE
     ================================================================
     Le CSS fait tout le travail : la séquence se joue et s'efface
     seule, sans une ligne d'ici. Ce bloc ajoute deux choses.

     1. Les valeurs MESURÉES. « 0 appel à un tiers » et « 0 cookie »
        sont écrits en dur dans le HTML parce qu'ils sont vrais, mais
        tant qu'à faire une démonstration, autant la faire pour de
        bon : on compte ce qui a réellement été chargé et ce qui est
        réellement posé, et on réécrit la valeur. Si un jour quelqu'un
        ajoute une balise tierce, le chiffre montera tout seul — et le
        site se dénoncera lui-même plutôt que d'afficher un zéro faux.

     2. Ne pas la rejouer à chaque page de la même visite. Le drapeau
        vit dans sessionStorage : il meurt à la fermeture de l'onglet,
        il ne contient qu'un « 1 », il n'identifie personne. C'est
        écrit dans confidentialite.html — une page qui décrit autre
        chose que la réalité est pire que pas de page du tout.
     ================================================================ */
  var seq = document.querySelector('.seq');
  if (seq) {
    var dejaVue = false;
    try {
      dejaVue = sessionStorage.getItem('amn-seq') === '1';
    } catch (e) {
      /* Navigation privée, stockage refusé : on joue la séquence.
         Un refus de stockage ne doit rien casser. */
    }

    if (dejaVue) {
      seq.classList.add('seq--vue');
    } else {
      try {
        sessionStorage.setItem('amn-seq', '1');
      } catch (e) { /* voir ci-dessus */ }

      /* Ce qui a VRAIMENT été chargé depuis un autre domaine. */
      var tiers = 0;
      try {
        var ressources = performance.getEntriesByType('resource');
        for (var r = 0; r < ressources.length; r++) {
          var u = new URL(ressources[r].name, location.href);
          if (u.origin !== location.origin && u.protocol !== 'data:') tiers++;
        }
      } catch (e) {
        tiers = null;
      }
      var cookies = document.cookie ? document.cookie.split(';').filter(function (c) {
        return c.trim();
      }).length : 0;

      var poser = function (cle, valeur) {
        if (valeur === null) return;
        var el = seq.querySelector('[data-mesure="' + cle + '"]');
        if (el) el.textContent = String(valeur);
      };
      poser('tiers', tiers);
      poser('cookies', cookies);

      /* Passer : n'importe quelle touche, n'importe quel clic. La
         tabulation aussi — sinon un visiteur au clavier se retrouve à
         déplacer le focus derrière un panneau qu'il ne voit pas. */
      var passer = function () {
        seq.classList.add('seq--vue');
        document.removeEventListener('keydown', passer);
      };
      document.addEventListener('keydown', passer);
      seq.addEventListener('click', passer, { once: true });
      /* Filet : si une animation ne se déclenche pas (onglet en
         arrière-plan au chargement, par exemple), le panneau ne doit
         pas rester en travers de la page. */
      setTimeout(passer, 3200);
    }
  }

  /* ================================================================
     LA CONSOLE
     ================================================================
     Le <details> s'ouvre et se ferme tout seul, et ses cinq liens
     fonctionnent sans une ligne de ce qui suit. Ce bloc n'ajoute que
     du confort : Échap, le clic sur le fond, le focus qui entre puis
     revient, le reste de la page mis hors d'atteinte, et l'inclinaison
     au pointeur. Tout est facultatif, rien n'est nécessaire.
     ================================================================ */
  var cons = document.querySelector('.console');
  if (cons) {
    var temoin = cons.querySelector('summary');
    var panneau = cons.querySelector('.console-panel');
    var scene = cons.querySelector('.console-scene');

    /* Le reste de la page devient inerte pendant l'ouverture : la
       tabulation ne peut plus descendre dans un contenu recouvert.
       `inert` sur un navigateur qui l'ignore est une propriété posée
       dans le vide — sans effet, sans erreur. */
    var dessous = [document.getElementById('main'), document.querySelector('.ftr')];

    cons.addEventListener('toggle', function () {
      for (var i = 0; i < dessous.length; i++) {
        if (dessous[i]) dessous[i].inert = cons.open;
      }
      if (cons.open) {
        var premier = panneau && panneau.querySelector('a[href]');
        if (premier) premier.focus();
      } else if (scene) {
        scene.style.setProperty('--rx', '0deg');
        scene.style.setProperty('--ry', '0deg');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && cons.open) {
        cons.open = false;
        temoin.focus();
      }
    });

    /* Le fond referme, les plaques non. */
    if (panneau) {
      panneau.addEventListener('click', function (e) {
        if (e.target === panneau || e.target === scene) cons.open = false;
      });
    }
    document.addEventListener('click', function (e) {
      if (cons.open && !cons.contains(e.target)) cons.open = false;
    });

    /* ---- Inclinaison au pointeur ----
       Installée seulement s'il y a réellement un pointeur qui survole
       (donc jamais sur un écran tactile) et si le système ne demande
       pas moins de mouvement. Une seule écriture par image : le
       pointeur peut envoyer cent événements, il n'y aura jamais plus
       d'une mise à jour par rafraîchissement. */
    var survol = window.matchMedia('(hover: hover) and (pointer: fine)');
    var sobre = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (scene && panneau && survol.matches && !sobre.matches) {
      var img = 0;
      var cx = 0;
      var cy = 0;
      panneau.addEventListener(
        'pointermove',
        function (e) {
          cx = e.clientX;
          cy = e.clientY;
          if (img) return;
          img = requestAnimationFrame(function () {
            img = 0;
            var x = cx / window.innerWidth - 0.5;
            var y = cy / window.innerHeight - 0.5;
            scene.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
            scene.style.setProperty('--rx', (-y * 6).toFixed(2) + 'deg');
          });
        },
        { passive: true }
      );
    }
  }

  /* ================================================================
     L'ASSISTANT À RÉPONSES PRÉPARÉES
     ================================================================
     Aucun modèle de langage, aucun appel réseau, aucun coût, et aucun
     risque d'inventer un prix ou une garantie. Chaque réponse est
     écrite ici, à la main. Le choix se fait par mots-clés, avec
     plusieurs formulations par sujet — « combien », « tarif », « prix »,
     « ça coûte » tombent sur la même réponse.

     RÈGLE ABSOLUE : tout ce qui n'a pas de réponse préparée renvoie au
     formulaire. Un assistant qui improvise sur une durée d'engagement
     ou une remise, c'est un engagement pris au nom d'Aaron par un bout
     de JavaScript. Les sujets non tranchés (essai gratuit, durée
     d'engagement, résiliation, remboursement) ont donc une entrée
     EXPRÈS qui dit qu'on ne sait pas.
     ================================================================ */
  var ajm = document.querySelector('.ajm');
  if (ajm) {
    /* Préfixés `ajm` À DESSEIN. `var` a une portée de FONCTION, et le
       bloc du formulaire de contact, plus bas dans la même enveloppe,
       déclare lui aussi `var form`. Un simple `form` ici se faisait
       donc écraser par celui d'en bas — nul sur toutes les pages qui
       n'ont pas de formulaire. Invisible tant que l'écouteur était posé
       au chargement, mortel dès qu'il l'a été à la première ouverture. */
    var ajmFil = ajm.querySelector('.ajm-fil');
    var ajmForm = ajm.querySelector('.ajm-form');
    var ajmChamp = ajm.querySelector('#ajm-q');

    /* Accents retirés, ponctuation retirée : « c'est combien ? » et
       « CEST COMBIEN » doivent tomber au même endroit. */
    var normaliser = function (t) {
      return (t || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    var VERS_CONTACT =
      ' <a href="/contact">Demander un accès</a>, quatre champs, réponse écrite sous 48 h ouvrées.';

    var BANQUE = [
      { cles: ['prix', 'tarif', 'tarifs', 'combien', 'cout', 'coute', 'couter', 'cher', 'budget', 'euros'],
        rep: 'Les prix sont publics : <b>35 € par mois</b> en solo, <b>109 €</b> pour une équipe jusqu\'à cinq, <b>249 €</b> pour une agence, et sur devis au-delà. Hors taxes. L\'option commerce ajoute 25 €. Le détail est sur la <a href="/prix">page prix</a>.' },
      { cles: ['association', 'associatif', 'asso', 'loi 1901', 'remise', 'reduction', 'interet general'],
        rep: 'Associations et structures d\'intérêt général : <b>de 30 à 50 % de remise</b>, selon la taille et les moyens, sur simple justificatif (récépissé ou numéro RNA). Dites-le dans votre message, la remise est appliquée avant qu\'on vous annonce un chiffre.' },
      { cles: ['delai', 'delais', 'reponse', 'repondez', 'repondre', 'combien de temps', 'attendre', 'rapidite', '48'],
        rep: 'Réponse <b>écrite sous 48 h ouvrées</b>, par quelqu\'un qui a lu votre message en entier. Y compris quand la réponse est non.' },
      { cles: ['surveille', 'surveillez', 'supervision', 'supervise', 'monitoring', 'regardez', 'controle', 'certificat', 'disponibilite', 'anomalie'],
        rep: 'Quatre choses, plus l\'hygiène de ce qui est exposé publiquement : <b>disponibilité</b> (ce qui ne répond plus), <b>certificats</b> (les échéances), <b>accès</b> (chaque ouverture de votre espace est journalisée côté serveur) et <b>anomalies</b> (ce qui sort de l\'ordinaire, lu par quelqu\'un). Le détail est sur <a href="/service">Ce qu\'on fait</a>.' },
      { cles: ['module', 'modules', 'fonctionnalite', 'fonctionnalites', 'agenda', 'facture', 'facturation', 'devis', 'client', 'coffre', 'contient'],
        rep: 'Dix modules, les mêmes pour tout le monde quel que soit le forfait : accueil, agenda, clients, facturation, tâches, notes, médias, rapports, coffre-fort, paramètres. Rien n\'est bridé pour vendre le forfait au-dessus. La liste complète est sur <a href="/service">Ce qu\'on fait</a>.' },
      { cles: ['acces', 'inscrire', 'inscription', 'demander', 'commencer', 'demarrer', 'compte', 'ouvrir', 'essayer'],
        rep: 'Par le formulaire : quatre champs, deux minutes. On lit, on répond sous 48 h ouvrées, et si ça correspond on prépare votre espace. Aucun accès ne s\'ouvre automatiquement.' + VERS_CONTACT },
      { cles: ['donnees', 'rgpd', 'confidentialite', 'privee', 'cookie', 'cookies', 'traceur', 'tracking', 'personnelles'],
        rep: 'Aucun cookie, aucun traceur, aucune mesure d\'audience, et les polices sont servies depuis ce site. La seule chose écrite sur votre appareil est une note qui dit que l\'animation d\'accueil a déjà été vue, effacée à la fermeture de l\'onglet. Tout est détaillé dans la <a href="/confidentialite">politique de confidentialité</a>.' },
      { cles: ['paiement', 'payer', 'carte', 'bancaire', 'cb', 'prelevement', 'facturer', 'checkout', 'panier'],
        rep: 'Il n\'y a <b>rien à payer sur ce site</b>, et aucun bouton pour le faire. C\'est une décision, pas une étape qui manque : on regarde d\'abord si votre situation est de celles qu\'on sait traiter.' },
      { cles: ['ia', 'intelligence artificielle', 'robot', 'bot', 'chatgpt', 'vraie', 'humain', 'automatique', 'genere'],
        rep: 'Non. Je réponds avec des <b>réponses préparées à l\'avance</b>, choisies par mots-clés — pas un modèle qui invente. Si votre question sort de ce que je connais, je vous le dis et je vous envoie écrire à quelqu\'un.' },
      { cles: ['windows', 'mac', 'telephone', 'mobile', 'application', 'installer', 'navigateur', 'appareil', 'android', 'iphone'],
        rep: 'Ça s\'ouvre dans le navigateur, sur ordinateur comme sur téléphone, avec les mêmes données des deux côtés. On peut l\'ajouter à l\'écran d\'accueil comme une application. Une application Windows existe aussi, avec le même compte.' },
      { cles: ['securise', 'securite', 'garantie', 'garantit', 'risque', 'piratage', 'hack', '100'],
        rep: 'On ne dit jamais « 100 % sécurisé » : personne ne peut le dire sérieusement. Ce qu\'on annonce, c\'est ce qu\'on surveille, à quelle fréquence, et ce qu\'on fait quand ça sonne.' },
      { cles: ['outil', 'outils', 'revendre', 'licence', 'acheter vos outils', 'scanner'],
        rep: 'Nos outils de supervision ne sont pas vendus, ni en licence ni en accès direct. Ils restent chez nous et ne sont pas installés dans votre espace. Ce qu\'on vend, c\'est le fait de les opérer pour vous.' },
      /* Sujets NON TRANCHÉS : on dit qu'on ne sait pas. C'est le
         contraire d'un aveu de faiblesse — c'est ce qui empêche ce
         composant de promettre quelque chose que personne n'a validé. */
      { cles: ['engagement', 'resilier', 'resiliation', 'preavis', 'duree', 'gratuit', 'essai', 'remboursement', 'rembourse', 'annuler'],
        rep: 'Là-dessus je n\'ai pas de réponse préparée, et je préfère ne rien inventer : ce sont des conditions qui vous engagent. Posez la question dans le message, elle sera traitée par écrit.' + VERS_CONTACT },
      { cles: ['bonjour', 'salut', 'bonsoir', 'hello', 'coucou', 'hey'],
        rep: 'Bonjour. Posez votre question — prix, délais, ce qu\'on surveille, données personnelles, ou comment demander un accès.' },
      { cles: ['merci', 'super', 'parfait', 'ok', 'daccord'],
        rep: 'Avec plaisir. S\'il reste quelque chose, le formulaire est là :' + VERS_CONTACT }
    ];

    var DEFAUT =
      "Je n'ai pas de réponse préparée pour ça, et je ne vais pas en inventer une — surtout s'il s'agit d'un prix, d'un délai ou d'un engagement. Écrivez-le par le formulaire, quelqu'un vous répondra par écrit." +
      VERS_CONTACT;

    var repondre = function (question) {
      var q = normaliser(question);
      if (!q) return null;
      var mots = q.split(' ');
      var meilleur = null;
      var meilleurScore = 0;
      for (var i = 0; i < BANQUE.length; i++) {
        var score = 0;
        for (var k = 0; k < BANQUE[i].cles.length; k++) {
          var cle = BANQUE[i].cles[k];
          if (cle.indexOf(' ') > -1) {
            if (q.indexOf(cle) > -1) score += 2;
          } else if (mots.indexOf(cle) > -1) {
            score += 2;
          } else if (cle.length > 4 && q.indexOf(cle) > -1) {
            score += 1;
          }
        }
        if (score > meilleurScore) { meilleurScore = score; meilleur = BANQUE[i]; }
      }
      return meilleurScore >= 2 ? meilleur.rep : DEFAUT;
    };

    var bulle = function (texte, de) {
      var p = document.createElement('p');
      p.className = 'ajm-bulle ajm-bulle--' + de;
      /* Les réponses sont écrites ici et contiennent du balisage voulu.
         La question, elle, vient du visiteur : elle passe par
         textContent, jamais par innerHTML. */
      if (de === 'lui') p.innerHTML = texte; else p.textContent = texte;
      ajmFil.appendChild(p);
      ajmFil.scrollTop = ajmFil.scrollHeight;
      return p;
    };

    var poserQuestion = function (texte) {
      bulle(texte, 'moi');
      var r = repondre(texte);
      if (r) window.setTimeout(function () { bulle(r, 'lui'); }, 260);
    };

    if (ajmForm && ajmChamp && ajmFil) {
      ajm.classList.add('ajm--vif');

      /* Rien n'est construit tant que personne n'a ouvert le panneau.
         Poser les écouteurs et fabriquer les entrées au chargement,
         c'était du travail sur le ajmFil principal pour un composant que
         la plupart des visiteurs n'ouvriront jamais. */
      var monte = false;
      var monter = function () {
      if (monte) return;
      monte = true;

      /* Quelques entrées, pour ne pas laisser le visiteur devant un
         ajmChamp vide en se demandant ce qu'il a le droit de demander. */
      var sugg = document.createElement('div');
      sugg.className = 'ajm-sugg';
      ['Combien ça coûte ?', 'Vous surveillez quoi ?', 'Es-tu une vraie IA ?'].forEach(function (q) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = q;
        b.addEventListener('click', function () {
          sugg.remove();
          poserQuestion(q);
        });
        sugg.appendChild(b);
      });
      ajmFil.appendChild(sugg);

      ajmForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = ajmChamp.value.trim();
        if (!v) return;
        ajmChamp.value = '';
        if (sugg.parentNode) sugg.remove();
        poserQuestion(v);
      });
      };

      ajm.addEventListener('toggle', function () {
        if (!ajm.open) return;
        monter();
        ajmChamp.focus();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && ajm.open) {
          ajm.open = false;
          ajm.querySelector('summary').focus();
        }
      });
    }
  }

  /* ================================================================
     LA RÈGLE DE SECTION
     ================================================================
     Les ancres marchent sans rien de tout ceci ; il ne manquerait que
     le repère de position. Aucun écouteur de défilement : un
     IntersectionObserver ne réveille le fil principal que lorsqu'une
     section traverse la bande, pas à chaque pixel parcouru.
     ================================================================ */
  var rail = document.querySelector('.rail');
  if (rail && 'IntersectionObserver' in window) {
    var reperes = {};
    var liens = rail.querySelectorAll('a[href^="#"]');
    for (var j = 0; j < liens.length; j++) {
      reperes[liens[j].getAttribute('href').slice(1)] = liens[j];
    }

    var marquer = function (id) {
      for (var k = 0; k < liens.length; k++) liens[k].removeAttribute('aria-current');
      if (reperes[id]) reperes[id].setAttribute('aria-current', 'true');
    };

    /* Une bande étroite au milieu de l'écran : la section courante est
       celle qui la traverse. On ne DÉMARQUE jamais sur une sortie —
       sinon la règle clignote entre deux sections, et se vide en haut
       comme en bas de page. */
    var oeil = new IntersectionObserver(
      function (entrees) {
        for (var n = 0; n < entrees.length; n++) {
          if (entrees[n].isIntersecting) marquer(entrees[n].target.id);
        }
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );

    for (var id in reperes) {
      var cible = document.getElementById(id);
      if (cible) oeil.observe(cible);
    }
  }

  /* ---- Formulaire de demande d'accès ---- */
  var form = document.getElementById('contact-form');
  if (!form) return;

  var dt = document.getElementById('dt');
  var ok = document.getElementById('form-ok');
  var err = document.getElementById('form-err');
  var errText = document.getElementById('form-err-text');
  var submit = document.getElementById('submit');

  // Temps passé sur la page. Mesuré des deux bouts par la même horloge
  // (celle du navigateur), donc insensible à une horloge mal réglée —
  // une comparaison avec l'heure du serveur rejetterait de vrais
  // visiteurs. Le serveur écarte un envoi arrivé en moins de deux
  // secondes et demie : personne ne remplit quatre champs aussi vite.
  var ouvertA = Date.now();

  // La validation native reste en place dans le HTML : c'est elle qui
  // sert quand JavaScript ne s'exécute pas. On ne la coupe qu'ici,
  // c'est-à-dire seulement quand on est capable de la remplacer.
  form.noValidate = true;

  function showError(message) {
    if (errText) errText.textContent = message;
    if (err) {
      err.hidden = false;
      err.scrollIntoView({ block: 'nearest' });
    }
  }

  function firstProblem() {
    var fields = form.querySelectorAll('input[required], textarea[required]');
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (!f.value.trim()) return { el: f, msg: 'Il manque un champ obligatoire.' };
      if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.value.trim())) {
        return { el: f, msg: "L'adresse email ne semble pas valide." };
      }
      if (f.hasAttribute('minlength') && f.value.trim().length < +f.getAttribute('minlength')) {
        return { el: f, msg: 'Décrivez votre besoin en quelques mots de plus.' };
      }
    }
    return null;
  }

  form.addEventListener('submit', function (e) {
    if (err) err.hidden = true;
    if (dt) dt.value = String(Date.now() - ouvertA);

    var problem = firstProblem();
    if (problem) {
      e.preventDefault();
      showError(problem.msg);
      problem.el.focus();
      return;
    }

    e.preventDefault();

    var data = {};
    new FormData(form).forEach(function (value, key) {
      data[key] = typeof value === 'string' ? value : '';
    });

    submit.disabled = true;
    var label = submit.textContent;
    submit.textContent = 'Envoi…';

    fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { status: res.status, body: body };
        });
      })
      .then(function (r) {
        if (r.status === 200 && r.body && r.body.ok) {
          form.hidden = true;
          if (ok) {
            ok.hidden = false;
            ok.setAttribute('tabindex', '-1');
            ok.focus();
            ok.scrollIntoView({ block: 'center' });
          }
          return;
        }
        submit.disabled = false;
        submit.textContent = label;
        showError((r.body && r.body.error) || "L'envoi n'a pas abouti. Réessayez dans un instant.");
      })
      .catch(function () {
        submit.disabled = false;
        submit.textContent = label;
        showError(
          "La connexion n'a pas abouti. Vérifiez votre réseau et réessayez — votre message n'a pas été envoyé."
        );
      });
  });
})();
