"use strict";

(() => {
  const DATA_URL = "./data/farmacia-cerro-navia.json";
  const SOURCE_URL = "https://farmaciapopularonline.cl/consultor?farmacia=cerro%20navia";
  const PARTICULAR_KEYS = new Set([
    "metformina500",
    "metformina750",
    "empagliflozina",
    "empaMet12_5_1000",
    "vildaMet"
  ]);

  let dataPromise = null;

  function cargarDatos() {
    if (!dataPromise) {
      dataPromise = fetch(`${DATA_URL}?t=${Date.now()}`, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        });
    }
    return dataPromise;
  }

  function precioCLP(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero)
      ? new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(numero)
      : "—";
  }

  function fechaLocal(iso) {
    if (!iso) return "sin fecha";
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return "sin fecha";
    return new Intl.DateTimeFormat("es-CL", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(fecha);
  }

  function dosisSeleccionada(input) {
    return input.closest("label")?.querySelector(".aps-med-dose")?.value || "";
  }

  function varianteDeseada(key, dosis) {
    if (key === "empagliflozina") {
      if (dosis.startsWith("10")) return "10";
      if (dosis.startsWith("12,5") || dosis.startsWith("25")) return "25";
    }
    if (key === "vildaMet") {
      if (dosis.includes("50/500")) return "50/500";
      if (dosis.includes("50/850")) return "50/850";
      if (dosis.includes("50/1.000")) return "50/1000";
    }
    if (key === "empaMet12_5_1000") {
      if (dosis.includes("12,5/850")) return "12.5/850";
      if (dosis.includes("12,5/1.000")) return "12.5/1000";
    }
    return "";
  }

  function elegirCoincidencias(registro, key, dosis) {
    const matches = Array.isArray(registro?.matches) ? [...registro.matches] : [];
    const variante = varianteDeseada(key, dosis);
    const candidatos = variante ? matches.filter((item) => item.variant === variante) : matches;
    return candidatos.sort((a, b) => {
      const precioA = Number.isFinite(Number(a.price)) ? Number(a.price) : Number.MAX_SAFE_INTEGER;
      const precioB = Number.isFinite(Number(b.price)) ? Number(b.price) : Number.MAX_SAFE_INTEGER;
      if (precioA !== precioB) return precioA - precioB;
      return (Number(b.stock) || 0) - (Number(a.stock) || 0);
    });
  }

  function asegurarDosisEmpaMet(input) {
    if (input.dataset.medKey !== "empaMet12_5_1000") return;
    const select = input.closest("label")?.querySelector(".aps-med-dose");
    if (!select) return;

    const dosis850 = "12,5/850 mg/día";
    if (Array.from(select.options).some((option) => option.value === dosis850)) return;

    const option = document.createElement("option");
    option.value = dosis850;
    option.textContent = dosis850;
    select.insertBefore(option, select.firstElementChild);
  }

  function asegurarPanel(input) {
    const copy = input.closest("label")?.querySelector(".aps-med-copy");
    if (!copy) return null;
    let panel = copy.querySelector(".farmacia-popular-status");
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "farmacia-popular-status is-hidden";
      copy.appendChild(panel);
    }
    return panel;
  }

  function renderPendiente(panel, texto = "Consultando Farmacia Popular Cerro Navia…") {
    panel.classList.remove("is-hidden", "farmacia-popular-ok", "farmacia-popular-unavailable", "farmacia-popular-stale");
    panel.classList.add("farmacia-popular-loading");
    panel.textContent = texto;
  }

  function renderError(panel) {
    panel.classList.remove("is-hidden", "farmacia-popular-loading", "farmacia-popular-ok");
    panel.classList.add("farmacia-popular-unavailable");
    panel.innerHTML = `No fue posible consultar precios ahora. <a href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer">Abrir consultor oficial</a>`;
  }

  function renderSinCoincidencia(panel, data) {
    panel.classList.remove("is-hidden", "farmacia-popular-loading", "farmacia-popular-ok");
    panel.classList.add("farmacia-popular-unavailable");
    panel.innerHTML = `
      <strong>Farmacia Popular Cerro Navia:</strong> no aparece una presentación que coincida con la dosis seleccionada en la última sincronización.<br>
      <span>Actualizado ${fechaLocal(data?.updated_at)}. El consultor oficial no publica productos con stock cero.</span>
      <a href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer">Verificar disponibilidad</a>`;
  }

  function renderDisponible(panel, data, matches) {
    const primero = matches[0];
    const mismaOferta = matches.filter((item) =>
      item.product === primero.product && Number(item.price) === Number(primero.price)
    );
    const stockPorBotica = mismaOferta
      .filter((item) => item.botica)
      .map((item) => `${item.botica}: ${Number.isFinite(Number(item.stock)) ? Number(item.stock) : "disponible"}`);
    const otrasPresentaciones = Math.max(0, matches.length - mismaOferta.length);
    const antiguedadHoras = data?.updated_at ? (Date.now() - new Date(data.updated_at).getTime()) / 36e5 : Infinity;

    panel.classList.remove("is-hidden", "farmacia-popular-loading", "farmacia-popular-unavailable", "farmacia-popular-stale");
    panel.classList.add("farmacia-popular-ok");
    if (antiguedadHoras > 48) panel.classList.add("farmacia-popular-stale");

    panel.innerHTML = `
      <div class="farmacia-popular-head">
        <strong>Farmacia Popular Cerro Navia</strong>
        <span class="farmacia-popular-badge">Disponible</span>
      </div>
      <div class="farmacia-popular-price">${precioCLP(primero.price)} <span>precio referencial de venta</span></div>
      <div class="farmacia-popular-product">${primero.product || "Presentación disponible"}</div>
      ${stockPorBotica.length ? `<div class="farmacia-popular-meta">Stock publicado · ${stockPorBotica.join(" · ")}</div>` : ""}
      ${otrasPresentaciones ? `<div class="farmacia-popular-meta">Otras ofertas coincidentes: ${otrasPresentaciones}</div>` : ""}
      <div class="farmacia-popular-updated">Actualizado ${fechaLocal(data.updated_at)}${antiguedadHoras > 48 ? " · dato con más de 48 h" : ""}</div>
      <a href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer">Abrir consultor oficial</a>`;
  }

  async function actualizarInput(input) {
    const key = input.dataset.medKey;
    if (!PARTICULAR_KEYS.has(key)) return;

    const panel = asegurarPanel(input);
    if (!panel) return;

    if (!input.checked) {
      panel.classList.add("is-hidden");
      return;
    }

    renderPendiente(panel);

    try {
      const data = await cargarDatos();
      if (data?.status === "pending") {
        renderPendiente(panel, "Precios de Farmacia Popular pendientes de la primera sincronización.");
        return;
      }

      const registro = data?.medications?.[key];
      const matches = elegirCoincidencias(registro, key, dosisSeleccionada(input));
      if (!matches.length) {
        renderSinCoincidencia(panel, data);
        return;
      }
      renderDisponible(panel, data, matches);
    } catch (error) {
      console.warn("Insulog APS: no fue posible cargar precios de Farmacia Popular.", error);
      renderError(panel);
    }
  }

  function enlazarInput(input) {
    const key = input.dataset.medKey;
    if (!PARTICULAR_KEYS.has(key)) return;

    asegurarDosisEmpaMet(input);
    if (input.dataset.farmaciaPopularActivo === "true") return;

    input.dataset.farmaciaPopularActivo = "true";
    input.addEventListener("change", () => actualizarInput(input));
    input.closest("label")?.querySelector(".aps-med-dose")?.addEventListener("change", () => actualizarInput(input));
    asegurarPanel(input);
    if (input.checked) actualizarInput(input);
  }

  function inicializar(root = document) {
    root.querySelectorAll('input[data-aps-med][data-med-key]').forEach(enlazarInput);
  }

  inicializar();

  const observer = new MutationObserver(() => inicializar());
  observer.observe(document.body, { childList: true, subtree: true });
})();
