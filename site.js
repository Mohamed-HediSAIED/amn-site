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
