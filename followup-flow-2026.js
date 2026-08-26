"use strict";

(() => {
  const MEDICAMENTOS_SEGUIMIENTO = [
    { label: "Metformina 850 mg" },
    { label: "Metformina XR 1.000 mg (si intolerancia/RAM a metformina convencional)" },
    { label: "Dapagliflozina 10 mg/día", clase: "sglt2" },
    { label: "Empagliflozina 25 mg/día", clase: "sglt2" },
    { label: "Empagliflozina 12,5 mg/día (½ comprimido de 25 mg; uso local por costo)", clase: "sglt2" },
    { label: "Empagliflozina/metformina 12,5/1.000 mg/día", clase: "sglt2" },
    { label: "Vildagliptina 50 mg" }
  ];

  function quitarNotasDeMarco() {
    document.querySelectorAll(".aps-reference-note").forEach((nota) => nota.remove());
  }

  function crearTarjetaFallback() {
    const card = document.createElement("div");
    card.className = "card card-blue text-left aps-context-card";
    card.id = "tratamiento-concomitante-seguimiento";

    const opciones = MEDICAMENTOS_SEGUIMIENTO.map((med) => `
      <label class="aps-med-option">
        <input type="checkbox" data-aps-med="seguimiento" data-label="${med.label}"${med.clase ? ` data-class="${med.clase}"` : ""}>
        <span>${med.label}</span>
      </label>`).join("");

    card.innerHTML = `
      <p class="card-title text-center">Tratamiento concomitante disponible en APS</p>
      <p class="aps-context-helper">Marque los fármacos que el paciente utiliza actualmente.</p>
      <div class="aps-med-grid">${opciones}</div>`;

    card.querySelectorAll('input[data-class="sglt2"]').forEach((input) => {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        card.querySelectorAll('input[data-class="sglt2"]').forEach((otro) => {
          if (otro !== input) otro.checked = false;
        });
      });
    });

    return card;
  }

  function prepararRegistroSeguimiento() {
    const tbody = document.getElementById("tabla-seguimiento");
    if (!tbody) {
      console.error("Insulog APS: no se encontró la tabla de seguimiento.");
      nav(4);
      return;
    }

    tbody.innerHTML = "";
    for (let i = 1; i <= 15; i += 1) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${i}</strong></td>
        <td><input class="ay glicemia" type="text" inputmode="numeric" maxlength="3" aria-label="Día ${i}, glicemia en ayunas" autocomplete="off"></td>
        <td><input class="pre glicemia" type="text" inputmode="numeric" maxlength="3" aria-label="Día ${i}, glicemia antes de las once" autocomplete="off"></td>`;
      tbody.appendChild(row);
    }

    nav(4);
  }

  function crearPantallaTratamiento() {
    if (document.getElementById("p35")) return true;

    const p4 = document.getElementById("p4");
    if (!p4) return false;

    let tarjeta = document.getElementById("tratamiento-concomitante-seguimiento");
    if (!tarjeta) tarjeta = crearTarjetaFallback();

    const seguridad = tarjeta.querySelector(".aps-safety-box");
    if (seguridad) {
      const tableWrap = p4.querySelector(".table-wrap");
      if (tableWrap) tableWrap.insertAdjacentElement("beforebegin", seguridad);
    }

    const pantalla = document.createElement("section");
    pantalla.id = "p35";
    pantalla.className = "page page-center";
    pantalla.setAttribute("aria-hidden", "true");
    pantalla.innerHTML = `
      <div class="page-label">[P3.5] Tratamiento concomitante</div>
      <h2>Tratamiento actual del paciente</h2>
      <p class="lead">Antes del registro de hemoglucotests, marque los medicamentos que el paciente utiliza actualmente.</p>`;

    pantalla.appendChild(tarjeta);

    const continuar = document.createElement("button");
    continuar.type = "button";
    continuar.className = "btn btn-main btn-narrow section-action";
    continuar.textContent = "CONTINUAR A REGISTRO DE HEMOGLUCOTESTS";
    continuar.addEventListener("click", prepararRegistroSeguimiento);
    pantalla.appendChild(continuar);

    const volver = document.createElement("button");
    volver.type = "button";
    volver.className = "btn btn-narrow section-action";
    volver.textContent = "VOLVER";
    volver.addEventListener("click", () => nav(2));
    pantalla.appendChild(volver);

    p4.insertAdjacentElement("beforebegin", pantalla);
    return true;
  }

  function abrirSeguimientoSeguro() {
    if (document.getElementById("p35") || crearPantallaTratamiento()) {
      nav(35);
      return;
    }

    // Fallback: nunca dejar la aplicación sin una página activa.
    prepararRegistroSeguimiento();
  }

  quitarNotasDeMarco();
  crearPantallaTratamiento();
  window.prepSeg = abrirSeguimientoSeguro;
  window.prepararRegistroSeguimiento = prepararRegistroSeguimiento;
})();
