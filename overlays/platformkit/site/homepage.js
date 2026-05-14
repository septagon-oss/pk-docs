(function () {
  "use strict";

  function resolveSection(link) {
    if (!link) return null;
    var href = link.getAttribute("href");
    if (!href || href.charAt(0) !== "#") return null;
    return document.querySelector(href);
  }

  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll(".pk-nav__links a[href^=\"#\"]")
  );

  if (navLinks.length > 0) {
    function setActive(activeLink) {
      navLinks.forEach(function (link) {
        link.classList.toggle("is-active", link === activeLink);
      });
    }

    function activateFromHash() {
      if (!window.location.hash) return;
      var active = navLinks.find(function (link) {
        return link.getAttribute("href") === window.location.hash;
      });
      if (active) setActive(active);
    }

    if ("IntersectionObserver" in window) {
      var linkBySection = new Map();
      var sections = [];

      navLinks.forEach(function (link) {
        var section = resolveSection(link);
        if (!section) return;
        sections.push(section);
        linkBySection.set(section, link);
      });

      if (sections.length > 0) {
        var observer = new IntersectionObserver(
          function (entries) {
            var visible = entries
              .filter(function (entry) {
                return entry.isIntersecting;
              })
              .sort(function (a, b) {
                return b.intersectionRatio - a.intersectionRatio;
              })[0];

            if (!visible) return;
            var link = linkBySection.get(visible.target);
            if (link) setActive(link);
          },
          {
            rootMargin: "-30% 0px -55% 0px",
            threshold: [0.2, 0.45, 0.7]
          }
        );

        sections.forEach(function (section) {
          observer.observe(section);
        });
      }
    }

    window.addEventListener("hashchange", activateFromHash);
    activateFromHash();
  }

  var builder = document.querySelector("[data-pk-builder]");
  if (!builder) return;

  var lang = (document.documentElement.lang || "en").toLowerCase();
  var isPT = lang.indexOf("pt") === 0;
  var form = builder.querySelector("[data-pk-build-form]");
  var emailStep = builder.querySelector("[data-pk-email-step]");
  var emailInput = builder.querySelector("[data-pk-build-email]");
  var input = builder.querySelector("[data-pk-build-input]");
  var submitButton = builder.querySelector("[data-pk-build-submit]") || builder.querySelector("button[type=\"submit\"]");
  var statusText = builder.querySelector("[data-pk-build-status]");
  var buildStream = null;
  var buildRunning = false;
  var buildComplete = false;
  var submitLabel = submitButton ? submitButton.textContent : "";
  var allowMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setBuilderRunning(running) {
    buildRunning = running;
    builder.classList.toggle("is-running", running);
    if (form) form.classList.toggle("is-running", running);
    if (emailInput) emailInput.disabled = running || buildComplete;
    if (input) input.disabled = running || buildComplete;
    if (submitButton) {
      submitButton.disabled = running || buildComplete || !canSubmit();
      submitButton.textContent = running
        ? (isPT ? "A compor" : "Composing")
        : (buildComplete ? (isPT ? "Pedido aceite" : "Request accepted") : submitLabel);
      submitButton.setAttribute("aria-busy", running ? "true" : "false");
    }
  }

  function setBuilderComplete(email) {
    buildComplete = true;
    builder.classList.add("is-complete");
    if (form) form.classList.add("is-complete");
    setBuilderRunning(false);
    setStatus(isPT ? "Pedido aceite" : "Workspace request accepted", (isPT ? "Vamos enviar o link de acesso para " : "We will send the access link to ") + email + ".");
  }

  function canSubmit() {
    if (buildComplete) return false;
    var emailReady = !emailInput || String(emailInput.value || "").trim().length > 0;
    var intentReady = !input || String(input.value || "").trim().length > 0;
    return emailReady && intentReady;
  }

  function hasIntent() {
    return input && String(input.value || "").trim().length > 0;
  }

  function revealEmailStep(focusEmail) {
    var visible = hasIntent();
    builder.classList.toggle("has-intent", visible);
    builder.classList.toggle("is-email-step", visible);
    if (form) {
      form.classList.toggle("has-intent", visible);
      form.classList.toggle("is-email-step", visible);
    }
    if (emailStep) emailStep.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible && focusEmail && emailInput) {
      window.setTimeout(function () {
        emailInput.focus();
      }, 120);
    }
  }

  function renderSubmit() {
    revealEmailStep(false);
    if (submitButton) {
      submitButton.disabled = buildRunning || !canSubmit();
    }
  }

  function setStatus(status, message) {
    if (statusText) {
      statusText.textContent = message ? status + " " + message : status;
    }
  }

  function closeBuildStream() {
    if (buildStream) {
      buildStream.close();
      buildStream = null;
    }
  }

  function redirectToContact(data) {
    var redirectTo = data && (data.redirectTo || data.redirect_to);
    if (!redirectTo) return;
    window.setTimeout(function () {
      window.location.href = redirectTo;
    }, 900);
  }

  function handleBuildStep(payload, email) {
    var phase = payload.phase;
    var data = payload.data || {};

    if (phase === "start") {
      setStatus(isPT ? "Pedido recebido" : "Request received", isPT ? "A desenhar o grafo de produto a partir do teu pedido." : "Shaping the product graph around your request.");
      return;
    }

    if (phase === "flavour") {
      var name = data.name || data.Name || "PlatformKit";
      setStatus((isPT ? "Seed aplicado: " : "Seed matched: ") + name, payload.message || "");
      return;
    }

    if (phase === "modules") {
      setStatus(isPT ? "Modulos selecionados" : "Module graph selected", payload.message || "");
      return;
    }

    if (phase === "validate") {
      setStatus(isPT ? "Contratos validados" : "Contracts validated", payload.message || "");
      return;
    }

    if (phase === "code") {
      setStatus(isPT ? "Blueprint gerado" : "Blueprint generated", payload.message || "");
      return;
    }

    if (phase === "complete") {
      closeBuildStream();
      setBuilderComplete(email);
      return;
    }

    if (phase === "contact") {
      closeBuildStream();
      setBuilderRunning(false);
      setStatus(isPT ? "Fala connosco diretamente" : "Contact us directly", payload.message || "");
      redirectToContact(data);
      return;
    }

    if (phase === "error") {
      closeBuildStream();
      setBuilderRunning(false);
      setStatus(isPT ? "Nao foi possivel iniciar" : "Builder could not start", payload.message || "");
    }
  }

  function requestBuild(email, intent) {
    closeBuildStream();
    buildComplete = false;
    builder.classList.remove("is-complete");
    if (form) form.classList.remove("is-complete");

    if (!("EventSource" in window)) {
      setStatus(isPT ? "Preview afinado" : "Preview tuned", isPT ? "Este browser nao suporta o stream ao vivo. Contacta-nos e criamos o workspace manualmente." : "This browser does not support the live builder stream. Contact us and we will create the workspace manually.");
      return;
    }

    setBuilderRunning(true);
    setStatus(isPT ? "A compor" : "Composing", isPT ? "Estamos a preparar o seed, o grafo de modulos e o blueprint inicial." : "Preparing the seed, module graph, and initial blueprint.");

    try {
      buildStream = new EventSource("/api/public/demo/build?" + new URLSearchParams({
        email: email,
        description: intent
      }).toString());
    } catch (error) {
      setBuilderRunning(false);
      setStatus(isPT ? "Nao foi possivel iniciar" : "Builder could not start", isPT ? "Tenta novamente ou contacta-nos diretamente." : "Try again or contact us directly.");
      return;
    }

    buildStream.addEventListener("step", function (event) {
      try {
        handleBuildStep(JSON.parse(event.data), email);
      } catch (error) {
        setStatus(isPT ? "Evento recebido" : "Builder event received", "");
      }
    });

    buildStream.onerror = function () {
      closeBuildStream();
      setBuilderRunning(false);
      setStatus(isPT ? "Preview local pronto" : "Local preview ready", isPT ? "O stream ao vivo nao respondeu. O seed continua afinado nesta pagina; contacta-nos para gerar o workspace." : "The live stream did not respond. The seed is still tuned on this page; contact us to generate the workspace.");
    };
  }

  if (isPT) {
    var label = builder.querySelector(".pk-build-void__line");
    var submit = builder.querySelector("[data-pk-build-submit]");
    if (label && label.textContent.trim() === "I want to build") label.textContent = "Quero construir";
    if (submit && submit.textContent.trim() === "Start shaping it") submit.textContent = "Comecar a moldar";
    submitLabel = submit ? submit.textContent : submitLabel;
    if (emailInput && emailInput.placeholder === "you@company.com") emailInput.placeholder = "tu@empresa.com";
    if (input && input.placeholder === "the product that keeps returning...") input.placeholder = "o produto que continua a voltar...";
    if (statusText && statusText.textContent.trim() === "Describe the product that keeps returning.") statusText.textContent = "Descreve o produto que continua a voltar.";
  }

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (buildComplete) return;
      var email = emailInput ? String(emailInput.value || "").trim() : "";
      var intent = input ? String(input.value || "").trim() : "";
      if (!intent) {
        if (form.reportValidity) form.reportValidity();
        return;
      }
      if (!email) {
        revealEmailStep(true);
        setStatus(isPT ? "Para onde enviamos o primeiro workspace?" : "Where should we send the first workspace?", isPT ? "Deixa o email e comecamos." : "Leave the email and we start.");
        return;
      }
      if (form.reportValidity && !form.reportValidity()) return;
      requestBuild(email, intent);
    });
  }

  if (input) {
    input.addEventListener("input", function () {
      if (buildComplete) return;
      if (hasIntent() && !buildRunning) {
        setStatus(isPT ? "Agora o email" : "Now the email", isPT ? "Um endereco, um pedido, uma primeira versao." : "One address, one request, one first version.");
      } else if (!buildRunning) {
        setStatus(isPT ? "Descreve a ideia que nao te sai da cabeca" : "Describe the thing you cannot stop thinking about", "");
      }
      renderSubmit();
    });
  }

  if (emailInput) {
    emailInput.addEventListener("input", function () {
      if (!buildComplete) renderSubmit();
    });
  }

  if (allowMotion && form && window.matchMedia("(pointer: fine)").matches) {
    form.addEventListener("pointermove", function (event) {
      var rect = form.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var x = Math.max(18, Math.min(82, ((event.clientX - rect.left) / rect.width) * 100));
      var y = Math.max(18, Math.min(82, ((event.clientY - rect.top) / rect.height) * 100));
      form.style.setProperty("--field-x", x.toFixed(2) + "%");
      form.style.setProperty("--field-y", y.toFixed(2) + "%");
    }, { passive: true });

    form.addEventListener("pointerleave", function () {
      form.style.setProperty("--field-x", "52%");
      form.style.setProperty("--field-y", "43%");
    });
  }

  renderSubmit();
})();
