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

  /* ---- Menu mobile : fermeture au clic sur un lien, à Échap, au clic
          en dehors. Le <details> gère l'ouverture tout seul. ---- */
  var menu = document.querySelector('.menu');
  if (menu) {
    menu.addEventListener('click', function (e) {
      if (e.target.closest('.menu-panel a')) menu.open = false;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) {
        menu.open = false;
        var s = menu.querySelector('summary');
        if (s) s.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });
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
