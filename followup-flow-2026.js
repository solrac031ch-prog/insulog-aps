"use strict";

(() => {
  const prepSegBase = window.prepSeg;

  if (typeof prepSegBase !== "function") {
    console.warn("Insulog APS: no se encontró prepSeg para reorganizar el seguimiento.");
    return;
  }

  function quitarNotasDeMarco() {
    document.querySelectorAll(".aps-reference-note").forEach((nota) => nota.remove());
  }

  function crearPantallaTratamiento() {
    if (document.getElementById("p35")) return;

    const p4 = document.getElementById("p4");
    const tarjeta = document.getElementById("tratamiento-concomitante-seguimiento");
    if (!p4 || !tarjeta) return;

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
      <p class="lead">Antes de registrar los hemoglucotests, marque los medicamentos que el paciente utiliza actualmente.</p>
    `;

    pantalla.appendChild(tarjeta);

    const continuar = document.createElement("button");
    continuar.type = "button";
    continuar.className = "btn btn-main btn-narrow section-action";
    continuar.textContent = "CONTINUAR A REGISTRO DE HEMOGLUCOTESTS";
    continuar.addEventListener("click", () => {
      prepSegBase();
    });
    pantalla.appendChild(continuar);

    const volver = document.createElement("button");
    volver.type = "button";
    volver.className = "btn btn-narrow section-action";
    volver.textContent = "VOLVER";
    volver.addEventListener("click", () => nav(2));
    pantalla.appendChild(volver);

    p4.insertAdjacentElement("beforebegin", pantalla);
  }

  window.prepSeg = function prepSegConPasoPrevio() {
    nav(35);
  };

  quitarNotasDeMarco();
  crearPantallaTratamiento();
})();
