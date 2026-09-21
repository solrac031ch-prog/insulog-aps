"use strict";

(() => {
  const runtime = window.InsulogRuntime;
  const clinicalEngine = window.InsulogClinicalEngine;
  const app = window.InsulogApp;

  if (!runtime) throw new Error("InsulogRuntime debe cargarse antes de aps-safety-2026.js");
  if (!clinicalEngine) throw new Error("InsulogClinicalEngine debe cargarse antes de aps-safety-2026.js");
  if (!app) throw new Error("InsulogApp debe cargarse antes de aps-safety-2026.js");

  const { go } = runtime.navigation;
  const state = runtime.state;
  const actions = runtime.actions;
  const renderNotaClinica = app.notes.render;

  const NOTA_EFICACIA = "* pp = puntos porcentuales. Descensos orientativos de HbA1c observados en estudios poblacionales; varían con HbA1c basal, dosis, adherencia, función renal y tratamiento previo. No sumar cifras de forma mecánica ni usarlas para calcular la dosis de NPH.";

  const MEDICAMENTOS_APS = [
    {
      value: "metformina850",
      label: "Metformina 850 mg",
      availability: "aps",
      groups: ["metformina-simple"],
      efficacy: "HbA1c: metformina suele ↓≈1 pp* con dosis terapéuticas; el efecto depende de la dosis total diaria.",
      doses: ["850 mg/día", "1.700 mg/día", "2.550 mg/día (máx.)"],
      safety: "Contraindicada con eGFR <30 mL/min/1,73 m². No iniciar si eGFR <45; si ya está en uso, reevaluar/reducir dosis cuando eGFR cae <45. Vigilar RAM gastrointestinales y déficit de vitamina B12."
    },
    {
      value: "metforminaXR1000",
      label: "Metformina XR 1.000 mg",
      availability: "aps",
      groups: ["metformina-simple"],
      efficacy: "HbA1c: ↓≈0,7 pp* con 1.000 mg/día; la formulación XR mantiene eficacia glucémica comparable.",
      doses: ["1.000 mg/día", "2.000 mg/día (máx.)"],
      safety: "Útil cuando existe intolerancia gastrointestinal a formulación convencional. Contraindicada con eGFR <30; no iniciar si eGFR <45. Vigilar RAM gastrointestinales y vitamina B12."
    },
    {
      value: "dapagliflozina10",
      label: "Dapagliflozina",
      availability: "aps",
      groups: ["sglt2"],
      efficacy: "HbA1c: ↓≈0,7 pp*; referencia comparativa ≈0,73 pp.",
      doses: ["10 mg/día"],
      safety: "Evitar en enfermedad grave, cetonemia/cetonuria, ayuno prolongado y período perioperatorio; suspender 3–4 días antes de cirugía programada. Riesgo de DKA/euglucémica, infecciones genitourinarias y depleción de volumen. El efecto glucémico disminuye con deterioro de función renal."
    },
    {
      value: "vildagliptina50",
      label: "Vildagliptina 50 mg",
      availability: "aps",
      groups: ["vildagliptina"],
      efficacy: "HbA1c: ↓≈0,5–0,8 pp* para la clase DPP-4; depende del esquema total y la frecuencia utilizada.",
      doses: ["50 mg cada 24 h", "50 mg cada 12 h"],
      safety: "Evitar con hepatopatía o ALT/AST >3× LSN y controlar función hepática. En insuficiencia renal moderada-grave suele requerirse reducción de dosis. No usar en DM1 ni para tratar DKA. Suspender si se sospecha pancreatitis."
    },
    {
      value: "metformina500",
      label: "Metformina 500 mg",
      availability: "particular",
      groups: ["metformina-simple"],
      efficacy: "HbA1c: metformina suele ↓≈1 pp* con dosis terapéuticas; el efecto depende de la dosis total diaria.",
      doses: ["500 mg/día", "1.000 mg/día", "1.500 mg/día", "2.000 mg/día", "2.500 mg/día"],
      safety: "Contraindicada con eGFR <30 mL/min/1,73 m². No iniciar si eGFR <45; si ya está en uso, reevaluar/reducir dosis cuando eGFR cae <45. Vigilar RAM gastrointestinales y déficit de vitamina B12."
    },
    {
      value: "metformina750",
      label: "Metformina 750 mg",
      availability: "particular",
      groups: ["metformina-simple"],
      efficacy: "HbA1c: metformina suele ↓≈1 pp* con dosis terapéuticas; el efecto depende de la dosis total diaria.",
      doses: ["750 mg/día", "1.500 mg/día", "2.250 mg/día"],
      safety: "Contraindicada con eGFR <30 mL/min/1,73 m². No iniciar si eGFR <45; si ya está en uso, reevaluar/reducir dosis cuando eGFR cae <45. Vigilar RAM gastrointestinales y déficit de vitamina B12."
    },
    {
      value: "empagliflozina",
      label: "Empagliflozina",
      availability: "particular",
      groups: ["sglt2"],
      efficacy: "HbA1c: ↓≈0,7–0,8 pp*; referencia comparativa con 25 mg ≈0,77 pp. El efecto depende de la dosis y la función renal.",
      doses: ["10 mg/día", "12,5 mg/día", "25 mg/día"],
      safety: "Evitar en enfermedad grave, cetonemia/cetonuria, ayuno prolongado y período perioperatorio; suspender 3–4 días antes de cirugía programada. Riesgo de DKA/euglucémica, infecciones genitourinarias y depleción de volumen. El efecto glucémico disminuye con deterioro de función renal."
    },
    {
      value: "empaMet12_5_1000",
      label: "Empagliflozina/metformina",
      availability: "particular",
      groups: ["sglt2"],
      efficacy: "HbA1c: efecto combinado variable y generalmente mayor que cada componente aislado; no es correcto sumar sus cifras de forma automática.",
      doses: ["12,5/850 mg/día", "12,5/1.000 mg/día"],
      safety: "Aplican precauciones de ambos componentes: por metformina considerar función renal, tolerancia gastrointestinal y vitamina B12; por iSGLT2 considerar DKA/euglucémica, infecciones genitourinarias, depleción de volumen y suspensión 3–4 días antes de cirugía o durante ayuno/enfermedad grave."
    },
    {
      value: "vildaMet",
      label: "Vildagliptina/metformina",
      availability: "particular",
      groups: ["vildagliptina"],
      efficacy: "HbA1c: efecto combinado variable y habitualmente mayor que cada componente aislado; depende de HbA1c basal y dosis utilizada.",
      doses: ["50/500 mg", "50/850 mg", "50/1.000 mg"],
      safety: "Aplican precauciones de ambos componentes: revisar función renal y tolerancia a metformina; evitar vildagliptina con hepatopatía o ALT/AST >3× LSN, controlar función hepática y suspender si se sospecha pancreatitis."
    }
  ];

  const safetyState = {
    clasificacionHipo: "",
    revisionHipo: null,
    nivel3Assessment: null
  };

  function buscarMedicamento(input) {
    if (!input) return null;
    const key = input.dataset.medKey;
    return MEDICAMENTOS_APS.find((med) => med.value === key) || null;
  }

  function obtenerSeleccionados(scope) {
    return Array.from(document.querySelectorAll(`input[data-aps-med="${scope}"]:checked`))
      .map((input) => input.dataset.label)
      .filter(Boolean);
  }

  function tratamientoTexto(scope) {
    const seleccionados = obtenerSeleccionados(scope);
    return seleccionados.length ? seleccionados.join("; ") : "No registrado";
  }

  function opcionesDosisHTML(med) {
    return med.doses
      .map((dose, index) => `<option value="${dose}"${index === 0 ? " selected" : ""}>${dose}</option>`)
      .join("");
  }

  function contenidoMedicamento(med, scope) {
    return `
      <span class="aps-med-copy">
        <span class="aps-med-name">${med.label}</span>
        <small class="aps-med-efficacy">${med.efficacy}</small>
        <span class="aps-med-dose-row">
          <span class="aps-med-dose-label">Dosis</span>
          <select class="aps-med-dose" data-med-dose="${med.value}" data-aps-scope="${scope}" disabled>${opcionesDosisHTML(med)}</select>
        </span>
        <small class="aps-med-safety"><strong>Precauciones / evitar:</strong> ${med.safety}</small>
      </span>`;
  }

  function opcionMedicamentoHTML(med, scope) {
    return `
      <label class="aps-med-option">
        <input type="checkbox" data-aps-med="${scope}" data-med-key="${med.value}" data-label="${med.label}">
        ${contenidoMedicamento(med, scope)}
      </label>`;
  }

  function sincronizarSelectorDosis(input) {
    const med = buscarMedicamento(input);
    const label = input?.closest("label");
    const select = label?.querySelector(".aps-med-dose");
    if (!med || !select) return;

    select.disabled = !input.checked;
    input.dataset.baseLabel = med.label;
    input.dataset.label = input.checked ? `${med.label}: ${select.value}` : med.label;
  }

  function activarSelectoresDosis(root = document) {
    root.querySelectorAll('input[data-aps-med]').forEach((input) => {
      if (input.dataset.doseSelectorActivo === "true") {
        sincronizarSelectorDosis(input);
        return;
      }

      const med = buscarMedicamento(input);
      const select = input.closest("label")?.querySelector(".aps-med-dose");
      if (!med || !select) return;

      input.dataset.doseSelectorActivo = "true";
      select.addEventListener("change", () => sincronizarSelectorDosis(input));
      input.addEventListener("change", () => sincronizarSelectorDosis(input));
      sincronizarSelectorDosis(input);
    });
  }

  function comparteGrupo(medA, medB) {
    if (!medA || !medB) return false;
    return medA.groups.some((grupo) => medB.groups.includes(grupo));
  }

  function desmarcarConflictos(input) {
    if (!input.checked) return;
    const med = buscarMedicamento(input);
    const scope = input.dataset.apsMed;
    if (!med || !scope) return;

    document.querySelectorAll(`input[data-aps-med="${scope}"]:checked`).forEach((otro) => {
      if (otro === input) return;
      const medOtro = buscarMedicamento(otro);
      if (!comparteGrupo(med, medOtro)) return;
      otro.checked = false;
      sincronizarSelectorDosis(otro);
    });
  }

  function activarExclusividadFarmacologica(root = document) {
    root.querySelectorAll('input[data-aps-med]').forEach((input) => {
      if (input.dataset.exclusividadActiva === "true") return;
      input.dataset.exclusividadActiva = "true";
      input.addEventListener("change", () => desmarcarConflictos(input));
    });
  }

  function llenarTarjetaMedicamentos(card, scope, { mostrarTitulo = true } = {}) {
    const aps = MEDICAMENTOS_APS.filter((med) => med.availability === "aps");
    const particulares = MEDICAMENTOS_APS.filter((med) => med.availability === "particular");

    card.className = "card card-blue text-left aps-context-card";
    card.id = `tratamiento-concomitante-${scope}`;
    card.innerHTML = `
      ${mostrarTitulo ? '<p class="card-title text-center">Tratamiento concomitante</p>' : ""}
      <section class="aps-med-section">
        <div class="aps-med-section-title">Disponible en APS</div>
        <div class="aps-med-grid">${aps.map((med) => opcionMedicamentoHTML(med, scope)).join("")}</div>
      </section>
      <section class="aps-med-section aps-med-section-secondary">
        <div class="aps-med-section-title">Otras opciones / compra particular</div>
        <div class="aps-med-grid">${particulares.map((med) => opcionMedicamentoHTML(med, scope)).join("")}</div>
      </section>
      <p class="aps-efficacy-note">${NOTA_EFICACIA}</p>`;
  }

  function crearTarjetaMedicamentos(scope, { mostrarTitulo = true } = {}) {
    const card = document.createElement("div");
    llenarTarjetaMedicamentos(card, scope, { mostrarTitulo });
    return card;
  }

  function enriquecerTratamientoSeguimiento() {
    const card = document.getElementById("tratamiento-concomitante-seguimiento");
    if (!card) return;
    const page = document.getElementById("p35");
    const heading = page?.querySelector("h2");
    const lead = page?.querySelector(".lead");
    if (heading) heading.textContent = "Tratamiento concomitante";
    if (lead) lead.textContent = "Marque los medicamentos que el paciente utiliza actualmente antes de registrar sus glicemias de seguimiento.";
    llenarTarjetaMedicamentos(card, "seguimiento", { mostrarTitulo: false });
  }

  function insertarPaginaTratamientoInicio() {
    if (document.getElementById("p25")) return;

    const p2 = document.getElementById("p2");
    if (!p2) return;

    const page = document.createElement("section");
    page.id = "p25";
    page.className = "page page-center";
    page.setAttribute("aria-hidden", "true");
    page.innerHTML = `
      <div class="page-label">[P2.5] Tratamiento concomitante antes de dosificación</div>
      <h2>Tratamiento concomitante</h2>
      <p class="lead">Marque los medicamentos que el paciente utiliza actualmente y seleccione la dosis antes de calcular la dosis inicial de insulina NPH.</p>
      <div data-inicio-med-host></div>
      <button id="continuar-dosificacion-inicio" type="button" class="btn btn-main btn-narrow section-action">CONTINUAR A DOSIFICACIÓN NPH</button>
      <button id="volver-criterios-inicio" type="button" class="btn btn-narrow section-action">VOLVER</button>`;

    const host = page.querySelector("[data-inicio-med-host]");
    host?.replaceWith(crearTarjetaMedicamentos("inicio", { mostrarTitulo: false }));
    p2.insertAdjacentElement("afterend", page);

    page.querySelector("#continuar-dosificacion-inicio")?.addEventListener("click", () => {
      state.patch({ tratamientoConcomitante: tratamientoTexto("inicio") });
      go(3);
    });

    page.querySelector("#volver-criterios-inicio")?.addEventListener("click", () => go(2));
  }

  function actualizarTerminologia() {
    const bibliografia = Array.from(document.querySelectorAll(".bibliography-card li"));
    const ada = bibliografia.find((item) => item.textContent.includes("ADA Standards of Care"));
    if (ada) ada.textContent = "ADA Standards of Care 2026 (seguridad, hipoglicemia e individualización)";

    const p41 = document.getElementById("p41");
    const heading = p41?.querySelector("h2");
    if (heading) heading.textContent = "Dosis alta / posible sobreinsulinización";

    const strong = p41?.querySelector(".alert-danger strong");
    if (strong) strong.textContent = "⚠️ Dosis alta de insulina (≥0,7 UI/kg/día): evaluar posible sobreinsulinización";
  }

  function inputsGlicemiaSeguimiento() {
    return Array.from(document.querySelectorAll("#p4 .glicemia"));
  }

  function firmaRegistroGlicemias() {
    return inputsGlicemiaSeguimiento()
      .map((input) => input.value.trim())
      .join("|");
  }

  function valoresGlicemiaSeguimiento() {
    return inputsGlicemiaSeguimiento()
      .map((input) => parseInt(input.value, 10))
      .filter((value) => Number.isFinite(value));
  }

  function evaluarHipoglicemiaADA(requirioAyuda = false) {
    return clinicalEngine.classifyHypoglycemia(valoresGlicemiaSeguimiento(), requirioAyuda);
  }

  function ocultarRevisionHipoglicemia() {
    const alerta = document.getElementById("alerta-hipoglicemia-ada");
    if (!alerta) return;
    alerta.classList.add("is-hidden");
    alerta.setAttribute("aria-hidden", "true");
    document.getElementById("nivel3-evaluacion")?.remove();
  }

  function mostrarRevisionHipoglicemia(evento) {
    const alerta = document.getElementById("alerta-hipoglicemia-ada");
    const titulo = document.getElementById("hipo-ada-titulo");
    const descripcion = document.getElementById("hipo-ada-descripcion");
    if (!alerta || !titulo || !descripcion) return;

    titulo.textContent = "⚠️ Hipoglicemia detectada";
    descripcion.textContent = evento.nivel === 2
      ? `Se registró al menos un HGT <54 mg/dL (mínimo ${evento.minimo} mg/dL). Antes de ajustar la NPH, confirme si alguno de los episodios fue nivel 3.`
      : `Se registró al menos un HGT entre 54 y 69 mg/dL (mínimo ${evento.minimo} mg/dL). Antes de ajustar la NPH, confirme si alguno de los episodios fue nivel 3.`;

    alerta.classList.remove("is-hidden");
    alerta.setAttribute("aria-hidden", "false");
    alerta.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function configurarRevisionHipoglicemia() {
    const sinAyuda = document.getElementById("hipo-sin-ayuda");
    const conAyuda = document.getElementById("hipo-con-ayuda");

    sinAyuda?.addEventListener("click", () => resolverRevisionHipoglicemia(false));
    conAyuda?.addEventListener("click", () => resolverRevisionHipoglicemia(true));
    ocultarRevisionHipoglicemia();
  }

  function mostrarEvaluacionNivel3() {
    const alerta = document.getElementById("alerta-hipoglicemia-ada");
    if (!alerta) return;

    document.getElementById("nivel3-evaluacion")?.remove();
    const panel = document.createElement("div");
    panel.id = "nivel3-evaluacion";
    panel.className = "card compact-card text-left";
    panel.style.marginTop = "14px";
    panel.innerHTML = `
      <strong>Evaluación antes de proponer ajuste</strong>
      <p class="aps-context-helper">Insulog solo propondrá una reducción numérica si el evento puede vincularse a una dosis de NPH y no hay una causa reversible clara ni factores que obliguen a reevaluación individual.</p>
      <div class="field">
        <label for="nivel3-causa">Causa del episodio</label>
        <select id="nivel3-causa">
          <option value="">Seleccione…</option>
          <option value="no_clara">No se identifica una causa reversible clara</option>
          <option value="reversible_clara">Se identifica una causa reversible clara (p. ej., omisión de ingesta, ejercicio no habitual, alcohol o error de administración)</option>
          <option value="incierta">La causa es incierta o no está suficientemente aclarada</option>
        </select>
      </div>
      <label class="aps-med-option" style="margin-top:10px;">
        <input id="nivel3-alto-riesgo" type="checkbox">
        <span class="aps-med-copy">
          <span class="aps-med-name">Existe un factor de mayor complejidad</span>
          <small class="aps-med-safety">Episodio repetido, pérdida de conciencia/convulsión, deterioro renal importante, imposibilidad de seguimiento seguro u otra condición que haga inadecuada una reducción automática.</small>
        </span>
      </label>
      <button id="nivel3-continuar" type="button" class="btn btn-danger btn-narrow section-action">CONTINUAR EVALUACIÓN NIVEL 3</button>
      <p id="nivel3-error" class="aps-context-helper" style="color:var(--danger);font-weight:700;"></p>
    `;

    alerta.appendChild(panel);
    panel.querySelector("#nivel3-continuar")?.addEventListener("click", () => {
      const causa = String(panel.querySelector("#nivel3-causa")?.value || "");
      if (!causa) {
        panel.querySelector("#nivel3-error").textContent = "Seleccione cómo se interpreta la causa del episodio antes de continuar.";
        return;
      }
      const altoRiesgo = Boolean(panel.querySelector("#nivel3-alto-riesgo")?.checked);
      safetyState.nivel3Assessment = { causa, altoRiesgo };
      if (safetyState.revisionHipo) safetyState.revisionHipo.nivel3Assessment = safetyState.nivel3Assessment;
      actions.invoke("calculate-followup");
    });
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resolverRevisionHipoglicemia(requirioAyuda) {
    const evento = evaluarHipoglicemiaADA();

    if (!evento) {
      safetyState.revisionHipo = null;
      safetyState.nivel3Assessment = null;
      ocultarRevisionHipoglicemia();
      actions.invoke("calculate-followup");
      return;
    }

    safetyState.revisionHipo = {
      firma: firmaRegistroGlicemias(),
      requirioAyuda
    };

    if (requirioAyuda) {
      safetyState.nivel3Assessment = null;
      mostrarEvaluacionNivel3();
      return;
    }

    safetyState.nivel3Assessment = null;
    actions.invoke("calculate-followup");
  }

  function normalizarNotaSeguimiento() {
    const nota = document.getElementById("nota-clinica");
    if (!nota) return;

    const raw = nota.dataset.rawText || nota.innerText || "";
    if (!raw.trim()) return;

    let lineas = raw
      .split("\n")
      .filter((linea) => !linea.toLowerCase().startsWith("hba1c estimada"))
      .map((linea) => linea.replace(/^Promedio global estimado:/i, "Promedio capilar global del registro:"));

    lineas = lineas.map((linea) => linea.replace(
      /^ALERTA DOSIS ALTA \(>0\.7 UI\/kg\):/i,
      "ALERTA DOSIS ALTA / POSIBLE SOBREINSULINIZACIÓN (≥0,7 UI/kg/día):"
    ));

    const tratamiento = state.get("tratamientoConcomitante") || "No registrado";
    if (!lineas.some((linea) => linea.startsWith("Tratamiento concomitante:"))) {
      const indiceEsquema = lineas.findIndex((linea) => linea.startsWith("Esquema actual:"));
      lineas.splice(indiceEsquema >= 0 ? indiceEsquema + 1 : 2, 0, `Tratamiento concomitante: ${tratamiento}`);
    }

    if (safetyState.clasificacionHipo && !lineas.some((linea) => linea.startsWith("Clasificación de hipoglicemia:"))) {
      lineas.push(`Clasificación de hipoglicemia: ${safetyState.clasificacionHipo}`);
    }

    renderNotaClinica(lineas.join("\n"));
  }

  function promedio(valores) {
    return valores.length ? Math.round(valores.reduce((a, b) => a + b, 0) / valores.length) : "N/A";
  }

  function reducirVeintePorCiento(dosis) {
    if (!Number.isFinite(dosis) || dosis <= 0) return 0;
    return Math.max(1, Math.round(dosis * 0.8));
  }

  function manejarHipoglicemiaNivel3() {
    const peso = parseFloat(document.getElementById("peso-seguimiento")?.value);
    const tipo = document.getElementById("tipo-esquema")?.value;
    let am = parseInt(document.getElementById("am-actual")?.value, 10) || 0;
    let pm = parseInt(document.getElementById("pm-actual")?.value, 10) || 0;

    if (!Number.isFinite(peso) || peso <= 0 || peso > 300) {
      alert("Ingrese un peso válido entre 1 y 300 kg.");
      return true;
    }

    if (tipo === "am") pm = 0;
    if (tipo === "pm") am = 0;

    if ((tipo === "am" && am <= 0) || (tipo === "pm" && pm <= 0) || (tipo === "2" && am <= 0 && pm <= 0)) {
      alert("Ingrese la dosis actual de insulina antes de continuar.");
      return true;
    }

    const ayunas = Array.from(document.querySelectorAll(".ay"))
      .map((input) => parseInt(input.value, 10))
      .filter((value) => Number.isFinite(value));
    const preonce = Array.from(document.querySelectorAll(".pre"))
      .map((input) => parseInt(input.value, 10))
      .filter((value) => Number.isFinite(value));

    const assessment = safetyState.revisionHipo?.nivel3Assessment || safetyState.nivel3Assessment || {};
    const causa = String(assessment.causa || "incierta");
    const altoRiesgo = Boolean(assessment.altoRiesgo);
    const ayunoBajo = ayunas.some((value) => value < 70);
    const preAlmuerzoBajo = preonce.some((value) => value < 70);
    const dosisImplicadas = [];
    let propuestaAm = am;
    let propuestaPm = pm;

    if (preAlmuerzoBajo && am > 0) {
      propuestaAm = reducirVeintePorCiento(am);
      dosisImplicadas.push("AM");
    }
    if (ayunoBajo && pm > 0) {
      propuestaPm = reducirVeintePorCiento(pm);
      dosisImplicadas.push("PM");
    }

    const puedeProponer = causa === "no_clara"
      && !altoRiesgo
      && dosisImplicadas.length > 0
      && (propuestaAm !== am || propuestaPm !== pm);

    const causaTexto = causa === "reversible_clara"
      ? "Se identificó una causa reversible clara."
      : causa === "no_clara"
        ? "No se identificó una causa reversible clara."
        : "La causa del episodio es incierta o no está suficientemente aclarada.";

    const motivoSinPropuesta = altoRiesgo
      ? "Existen factores de mayor complejidad; Insulog no calcula una reducción porcentual y deja el ajuste a reevaluación médica."
      : causa === "reversible_clara"
        ? "Al existir una causa reversible clara, Insulog no atribuye automáticamente el evento a la dosis de NPH; corresponde corregir la causa y definir la pauta por criterio médico."
        : causa === "incierta"
          ? "La causa no está suficientemente aclarada; Insulog no calcula una reducción porcentual y deja la pauta a reevaluación médica."
          : dosisImplicadas.length === 0
            ? "El registro no permite localizar qué dosis de NPH se relaciona con el evento; el ajuste queda a criterio médico."
            : "No fue posible generar una reducción automática clínicamente útil.";

    const recomendacionTexto = puedeProponer
      ? `PROPUESTA INSULOG: reducir 20% la dosis de NPH probablemente responsable (${dosisImplicadas.join(" + ")}). Nueva propuesta: AM ${propuestaAm} UI | PM ${propuestaPm} UI. Esta reducción es una regla de apoyo clínico de Insulog y requiere aceptación o modificación por el profesional.`
      : `PROPUESTA INSULOG: no emitir ajuste numérico automático. ${motivoSinPropuesta}`;

    state.patch({
      amActual: am,
      pmActual: pm,
      am: puedeProponer ? propuestaAm : am,
      pm: puedeProponer ? propuestaPm : pm,
      promAy: promedio(ayunas),
      promPre: promedio(preonce),
      promedioGlobal: promedio([...ayunas, ...preonce]),
      dosisKg: ((puedeProponer ? propuestaAm : am) + (puedeProponer ? propuestaPm : pm)) / peso,
      acciones: "",
      tratamientoConcomitante: tratamientoTexto("seguimiento"),
      level3AutoDoseAvailable: puedeProponer,
      level3CauseAssessment: causa,
      level3HighRiskFeatures: altoRiesgo,
      level3ImplicatedDose: dosisImplicadas.length ? dosisImplicadas.join(" + ") : "No localizada",
      level3ReductionPercent: puedeProponer ? 20 : null,
      level3ProposedAm: puedeProponer ? propuestaAm : null,
      level3ProposedPm: puedeProponer ? propuestaPm : null
    });

    const data = state.snapshot();
    const nota = `SEGUIMIENTO APS\nALERTA: HIPOGLICEMIA NIVEL 3 REFERIDA (requirió asistencia de otra persona).\n${causaTexto}\n${altoRiesgo ? "Factor de mayor complejidad: presente." : "Factor de mayor complejidad: no referido."}\nPromedios descriptivos sin excluir valores: Ayunas ${data.promAy} mg/dL | Preonce ${data.promPre} mg/dL\nPromedio capilar global del registro: ${data.promedioGlobal} mg/dL\nEsquema actual: AM ${am} UI | PM ${pm} UI\nTratamiento concomitante: ${data.tratamientoConcomitante}\n${recomendacionTexto}\nConducta de seguridad: revisar técnica y horario de administración, ingesta, ejercicio, alcohol, función renal, recurrencia del evento y capacidad de seguimiento seguro. Reforzar educación estructurada para prevención/tratamiento de hipoglicemia y disponibilidad de glucagón cuando corresponda.\nLa alerta de nivel 3 se mantiene aunque el profesional acepte o modifique la pauta.`;

    renderNotaClinica(nota);
    go(5);
    return true;
  }

  actions.decorate("define-initial-scheme", (next) => (context) => {
    const resultado = next(context);
    const paginaDosisActiva = document.getElementById("p3")?.classList.contains("active");
    if (paginaDosisActiva && document.getElementById("p25")) go(25);
    return resultado;
  });

  actions.decorate("calculate-initial", (next) => (context) => {
    state.patch({ tratamientoConcomitante: tratamientoTexto("inicio") });
    const resultado = next(context);
    const nota = document.getElementById("nota-clinica");
    if (document.getElementById("p5")?.classList.contains("active") && nota?.dataset.rawText) {
      const texto = nota.dataset.rawText;
      if (!texto.includes("Tratamiento concomitante:")) {
        renderNotaClinica(`${texto}\nTratamiento concomitante: ${state.get("tratamientoConcomitante")}`);
      }
    }
    return resultado;
  });

  actions.decorate("prepare-followup", (next) => (context) => {
    safetyState.revisionHipo = null;
    safetyState.clasificacionHipo = "";
    safetyState.nivel3Assessment = null;
    state.patch({
      level3AutoDoseAvailable: false,
      level3CauseAssessment: "",
      level3HighRiskFeatures: false,
      level3ImplicatedDose: "",
      level3ReductionPercent: null,
      level3ProposedAm: null,
      level3ProposedPm: null
    });
    ocultarRevisionHipoglicemia();
    return next(context);
  });

  actions.decorate("calculate-followup", (next) => (context) => {
    state.patch({ tratamientoConcomitante: tratamientoTexto("seguimiento") });

    const eventoHipo = evaluarHipoglicemiaADA();
    safetyState.clasificacionHipo = eventoHipo?.nota || "";

    if (!eventoHipo) {
      safetyState.revisionHipo = null;
      ocultarRevisionHipoglicemia();
      const resultado = next(context);
      if (document.getElementById("p5")?.classList.contains("active")) {
        normalizarNotaSeguimiento();
      }
      return resultado;
    }

    const firmaActual = firmaRegistroGlicemias();
    const revisionValida = safetyState.revisionHipo?.firma === firmaActual;

    if (!revisionValida) {
      safetyState.revisionHipo = null;
      mostrarRevisionHipoglicemia(eventoHipo);
      return undefined;
    }

    ocultarRevisionHipoglicemia();

    if (safetyState.revisionHipo.requirioAyuda) {
      safetyState.clasificacionHipo = evaluarHipoglicemiaADA(true)?.nota || "";
      const resultado = manejarHipoglicemiaNivel3();
      if (document.getElementById("p5")?.classList.contains("active")) {
        safetyState.revisionHipo = null;
      }
      return resultado;
    }

    const resultado = next(context);
    if (document.getElementById("p5")?.classList.contains("active")) {
      normalizarNotaSeguimiento();
      safetyState.revisionHipo = null;
    } else if (!document.getElementById("p4")?.classList.contains("active")) {
      safetyState.revisionHipo = null;
    }
    return resultado;
  });

  actions.decorate("generate-high-dose-note", (next) => (context) => {
    const resultado = next(context);
    normalizarNotaSeguimiento();
    return resultado;
  });

  insertarPaginaTratamientoInicio();
  enriquecerTratamientoSeguimiento();
  activarSelectoresDosis();
  activarExclusividadFarmacologica();
  configurarRevisionHipoglicemia();
  actualizarTerminologia();
})();
