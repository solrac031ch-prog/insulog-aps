"use strict";

(() => {
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
      doses: ["12,5/1.000 mg/día"],
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
    discordantes: [],
    clasificacionHipo: "",
    scope: "seguimiento",
    revisionHipo: null
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

  function grupoMedicamentosHTML(titulo, meds, tipo) {
    return `
      <section class="aps-med-section aps-med-section-${tipo}">
        <div class="aps-med-section-title">${titulo}</div>
        <div class="aps-med-grid">${meds.map((med) => opcionMedicamentoHTML(med, tipo.includes("aps") ? "__SCOPE__" : "__SCOPE__")).join("")}</div>
      </section>`;
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
      globalData.tratamientoConcomitante = tratamientoTexto("inicio");
      nav(3);
    });

    page.querySelector("#volver-criterios-inicio")?.addEventListener("click", () => nav(2));
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

  function detectarDiscordantes(datos, nombre) {
    if (datos.length < 4) return [];

    return datos.flatMap((valor, index) => {
      if (valor < 70) return [];
      const resto = datos.filter((_, i) => i !== index);
      const promedioResto = resto.reduce((a, b) => a + b, 0) / resto.length;
      return valor > promedioResto + 50 ? [`${nombre} ${valor} mg/dL`] : [];
    });
  }

  const analizarGlicemiasBase = window.analizarGlicemias;
  window.analizarGlicemias = function analizarGlicemiasSinExcluir(valores, nombre) {
    const datos = valores.filter((v) => Number.isFinite(v));
    const discordantes = detectarDiscordantes(datos, nombre);
    safetyState.discordantes.push(...discordantes);

    return {
      datos,
      usados: [...datos],
      promedio: datos.length ? datos.reduce((a, b) => a + b, 0) / datos.length : null,
      min: datos.length ? Math.min(...datos) : null,
      hipoSevera: datos.some((v) => v < 54),
      hipo: datos.some((v) => v < 70),
      excluidos: [],
      discordantes
    };
  };

  if (typeof analizarGlicemiasBase !== "function") {
    console.warn("Insulog APS: no se encontró analizarGlicemias base.");
  }

  function inputsGlicemiaSeguimiento() {
    return Array.from(document.querySelectorAll("#p4 .glicemia"));
  }

  function firmaRegistroGlicemias() {
    return inputsGlicemiaSeguimiento()
      .map((input) => input.value.trim())
      .join("|");
  }

  function evaluarHipoglicemiaADA() {
    const valores = inputsGlicemiaSeguimiento()
      .map((input) => parseInt(input.value, 10))
      .filter((value) => Number.isFinite(value));

    const valoresHipo = valores.filter((value) => value < 70);
    if (!valoresHipo.length) return null;

    const minimo = Math.min(...valoresHipo);
    if (minimo < 54) {
      return {
        nivel: 2,
        minimo,
        nota: "Hipoglicemia nivel 2 detectada (<54 mg/dL): requiere acción inmediata y reevaluación del tratamiento."
      };
    }

    return {
      nivel: 1,
      minimo,
      nota: "Hipoglicemia nivel 1 detectada (<70 y ≥54 mg/dL): revisar causas y reforzar prevención."
    };
  }

  function ocultarRevisionHipoglicemia() {
    const alerta = document.getElementById("alerta-hipoglicemia-ada");
    if (!alerta) return;
    alerta.classList.add("is-hidden");
    alerta.setAttribute("aria-hidden", "true");
  }

  function mostrarRevisionHipoglicemia(evento) {
    const alerta = document.getElementById("alerta-hipoglicemia-ada");
    const titulo = document.getElementById("hipo-ada-titulo");
    const descripcion = document.getElementById("hipo-ada-descripcion");
    if (!alerta || !titulo || !descripcion) return;

    titulo.textContent = `⚠️ Hipoglicemia ADA nivel ${evento.nivel}`;
    descripcion.textContent = evento.nivel === 2
      ? `Se registró al menos un HGT <54 mg/dL (mínimo ${evento.minimo} mg/dL). Antes de ajustar la NPH, confirme si alguno de los episodios requirió asistencia de otra persona.`
      : `Se registró al menos un HGT entre 54 y 69 mg/dL (mínimo ${evento.minimo} mg/dL). Antes de ajustar la NPH, confirme si alguno de los episodios requirió asistencia de otra persona.`;

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

  function resolverRevisionHipoglicemia(requirioAyuda) {
    const evento = evaluarHipoglicemiaADA();

    if (!evento) {
      safetyState.revisionHipo = null;
      ocultarRevisionHipoglicemia();
      window.calcularSeguimientoPro();
      return;
    }

    safetyState.revisionHipo = {
      firma: firmaRegistroGlicemias(),
      requirioAyuda
    };

    window.calcularSeguimientoPro();
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

    const tratamiento = globalData.tratamientoConcomitante || "No registrado";
    if (!lineas.some((linea) => linea.startsWith("Tratamiento concomitante:"))) {
      const indiceEsquema = lineas.findIndex((linea) => linea.startsWith("Esquema actual:"));
      lineas.splice(indiceEsquema >= 0 ? indiceEsquema + 1 : 2, 0, `Tratamiento concomitante: ${tratamiento}`);
    }

    if (safetyState.discordantes.length && !lineas.some((linea) => linea.startsWith("Valores discordantes:"))) {
      lineas.push(`Valores discordantes: ${[...new Set(safetyState.discordantes)].join(", ")}. Se mantienen en el promedio; verificar técnica, horario, alimentación y contexto clínico antes de excluirlos manualmente.`);
    }

    if (safetyState.clasificacionHipo && !lineas.some((linea) => linea.startsWith("Clasificación de hipoglicemia:"))) {
      lineas.push(`Clasificación de hipoglicemia: ${safetyState.clasificacionHipo}`);
    }

    renderNotaClinica(lineas.join("\n"));
  }

  function promedio(valores) {
    return valores.length ? Math.round(valores.reduce((a, b) => a + b, 0) / valores.length) : "N/A";
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

    globalData.amActual = am;
    globalData.pmActual = pm;
    globalData.am = am;
    globalData.pm = pm;
    globalData.promAy = promedio(ayunas);
    globalData.promPre = promedio(preonce);
    globalData.promedioGlobal = promedio([...ayunas, ...preonce]);
    globalData.dosisKg = (am + pm) / peso;
    globalData.acciones = "";
    globalData.tratamientoConcomitante = tratamientoTexto("seguimiento");

    const nota = `SEGUIMIENTO APS\nALERTA: HIPOGLICEMIA NIVEL 3 REFERIDA (requirió asistencia de otra persona).\nNo se realiza ajuste automático de NPH.\nPromedios descriptivos sin excluir valores: Ayunas ${globalData.promAy} mg/dL | Preonce ${globalData.promPre} mg/dL\nPromedio capilar global del registro: ${globalData.promedioGlobal} mg/dL\nEsquema actual: AM ${am} UI | PM ${pm} UI\nTratamiento concomitante: ${globalData.tratamientoConcomitante}\nConducta: reevaluación clínica prioritaria del esquema de insulina y de las causas del evento. Revisar técnica de administración, horario, ingesta, ejercicio, función renal, fragilidad y apoyo del paciente.\nReforzar educación para prevención y tratamiento de hipoglicemia.`;

    renderNotaClinica(nota);
    nav(5);
    return true;
  }

  const definirEsquemaInicioBase = window.definirEsquemaInicio;
  if (typeof definirEsquemaInicioBase === "function") {
    window.definirEsquemaInicio = function definirEsquemaInicioConTratamiento() {
      const resultado = definirEsquemaInicioBase();
      const paginaDosisActiva = document.getElementById("p3")?.classList.contains("active");
      if (paginaDosisActiva && document.getElementById("p25")) nav(25);
      return resultado;
    };
  }

  const calcularInicioBase = window.calcularInicioMejorado;
  if (typeof calcularInicioBase === "function") {
    window.calcularInicioMejorado = function calcularInicioConContexto() {
      globalData.tratamientoConcomitante = tratamientoTexto("inicio");
      const resultado = calcularInicioBase();
      const nota = document.getElementById("nota-clinica");
      if (document.getElementById("p5")?.classList.contains("active") && nota?.dataset.rawText) {
        const texto = nota.dataset.rawText;
        if (!texto.includes("Tratamiento concomitante:")) {
          renderNotaClinica(`${texto}\nTratamiento concomitante: ${globalData.tratamientoConcomitante}`);
        }
      }
      return resultado;
    };
  }

  const prepSegBase = window.prepSeg;
  if (typeof prepSegBase === "function") {
    window.prepSeg = function prepSegConSeguridadLimpia() {
      safetyState.revisionHipo = null;
      safetyState.clasificacionHipo = "";
      ocultarRevisionHipoglicemia();
      return prepSegBase();
    };
  }

  const calcularSeguimientoBase = window.calcularSeguimientoPro;
  if (typeof calcularSeguimientoBase === "function") {
    window.calcularSeguimientoPro = function calcularSeguimientoConSeguridad() {
      globalData.tratamientoConcomitante = tratamientoTexto("seguimiento");
      safetyState.discordantes = [];
      safetyState.scope = "seguimiento";

      const eventoHipo = evaluarHipoglicemiaADA();
      safetyState.clasificacionHipo = eventoHipo?.nota || "";

      if (!eventoHipo) {
        safetyState.revisionHipo = null;
        ocultarRevisionHipoglicemia();
        const resultado = calcularSeguimientoBase();
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
        safetyState.clasificacionHipo = "Hipoglicemia nivel 3 referida: el episodio requirió asistencia de otra persona para su tratamiento.";
        const resultado = manejarHipoglicemiaNivel3();
        if (document.getElementById("p5")?.classList.contains("active")) {
          safetyState.revisionHipo = null;
        }
        return resultado;
      }

      const resultado = calcularSeguimientoBase();
      if (document.getElementById("p5")?.classList.contains("active")) {
        normalizarNotaSeguimiento();
        safetyState.revisionHipo = null;
      } else if (!document.getElementById("p4")?.classList.contains("active")) {
        safetyState.revisionHipo = null;
      }
      return resultado;
    };
  }

  const generarNotaDosisAltaBase = window.generarNotaDosisAlta;
  if (typeof generarNotaDosisAltaBase === "function") {
    window.generarNotaDosisAlta = function generarNotaDosisAltaSegura() {
      const resultado = generarNotaDosisAltaBase();
      normalizarNotaSeguimiento();
      return resultado;
    };
  }

  const generarDocumentoBase = window.generarDocumento;
  if (typeof generarDocumentoBase === "function") {
    window.generarDocumento = function generarDocumentoConContexto(tipo) {
      const resultado = generarDocumentoBase(tipo);
      const pdf = document.getElementById("pdf");
      if (!pdf) return resultado;

      pdf.innerHTML = pdf.innerHTML.replace(/ADA 2024/g, "ADA 2026");

      const tratamiento = globalData.tratamientoConcomitante || "No registrado";
      if (tratamiento !== "No registrado" && !pdf.querySelector(".tratamiento-pdf")) {
        const bloque = document.createElement("div");
        bloque.className = "tratamiento-pdf";
        bloque.innerHTML = `<b>Tratamiento concomitante registrado:</b><br>${tratamiento}`;

        const dosis = Array.from(pdf.querySelectorAll("div"))
          .find((element) => element.textContent.includes("Dosis Actual Indicada"));
        if (dosis) dosis.insertAdjacentElement("afterend", bloque);
        else pdf.insertAdjacentElement("afterbegin", bloque);
      }

      return resultado;
    };
  }

  insertarPaginaTratamientoInicio();
  enriquecerTratamientoSeguimiento();
  activarSelectoresDosis();
  activarExclusividadFarmacologica();
  configurarRevisionHipoglicemia();
  actualizarTerminologia();
})();
