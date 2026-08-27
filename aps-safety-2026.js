"use strict";

(() => {
  const NOTA_EFICACIA = "* pp = puntos porcentuales. Descensos orientativos de HbA1c observados en estudios poblacionales; varían con HbA1c basal, dosis, adherencia, función renal y tratamiento previo. No sumar cifras de forma mecánica ni usarlas para calcular la dosis de NPH.";
  const NOTA_DOSIS = "Dosis: Table 9.3 ADA 2026 se usa como guía de presentación y dosis diaria máxima aprobada en EE. UU.; no es una tabla de titulación. Vildagliptina no está incluida en Table 9.3 y sus opciones se basan en la ficha técnica oficial EMA de Galvus. Las dosis locales se identifican explícitamente.";

  const MEDICAMENTOS_APS = [
    {
      value: "metformina850",
      label: "Metformina 850 mg (IR)",
      aliases: ["Metformina 850 mg"],
      efficacy: "HbA1c: metformina suele ↓≈1 pp* con dosis terapéuticas; el efecto depende de la dosis total diaria.",
      doses: [
        "850 mg/día",
        "1.700 mg/día",
        "2.550 mg/día (máx. ADA Table 9.3)"
      ],
      safety: "Contraindicada con eGFR <30 mL/min/1,73 m². ADA aconseja no iniciarla si eGFR <45; si ya está en uso, reducir dosis cuando eGFR cae <45 y suspender <30. Vigilar RAM gastrointestinales y déficit de vitamina B12."
    },
    {
      value: "metforminaXR1000",
      label: "Metformina XR 1.000 mg",
      aliases: ["Metformina XR 1.000 mg (si intolerancia/RAM a metformina convencional)"],
      efficacy: "HbA1c: ↓≈0,7 pp* con 1.000 mg/día; la formulación XR mantiene eficacia glucémica comparable.",
      doses: [
        "1.000 mg/día",
        "2.000 mg/día (máx. ADA Table 9.3)"
      ],
      safety: "Preferible si hay intolerancia gastrointestinal a formulación convencional. Contraindicada con eGFR <30; no iniciar si eGFR <45. Vigilar RAM gastrointestinales y vitamina B12."
    },
    {
      value: "dapagliflozina10",
      label: "Dapagliflozina",
      aliases: ["Dapagliflozina 10 mg/día"],
      className: "sglt2",
      efficacy: "HbA1c: ↓≈0,7 pp*; referencia comparativa ≈0,73 pp.",
      doses: ["10 mg/día (máx. ADA Table 9.3)"],
      safety: "Evitar en enfermedad grave, cetonemia/cetonuria, ayuno prolongado y período perioperatorio; suspender 3–4 días antes de cirugía programada. Riesgo de DKA/euglucémica, infecciones genitourinarias y depleción de volumen. El efecto glucémico disminuye con eGFR <45; el beneficio cardiorrenal puede justificar uso con eGFR >20 según contexto."
    },
    {
      value: "empagliflozina",
      label: "Empagliflozina",
      aliases: [
        "Empagliflozina 25 mg/día",
        "Empagliflozina 12,5 mg/día (½ comprimido de 25 mg; uso local por costo)"
      ],
      className: "sglt2",
      efficacy: "HbA1c: ↓≈0,7–0,8 pp*; referencia comparativa con 25 mg ≈0,77 pp. La dosis 12,5 mg es una adaptación local y no tiene una estimación estándar propia.",
      doses: [
        "12,5 mg/día (½ de 25 mg; uso local)",
        "25 mg/día (máx. ADA Table 9.3)"
      ],
      safety: "Evitar en enfermedad grave, cetonemia/cetonuria, ayuno prolongado y período perioperatorio; suspender 3–4 días antes de cirugía programada. Riesgo de DKA/euglucémica, infecciones genitourinarias y depleción de volumen. El efecto glucémico disminuye con eGFR <45; el beneficio cardiorrenal puede justificar uso con eGFR >20 según contexto."
    },
    {
      value: "empaMet12_5_1000",
      label: "Empagliflozina/metformina",
      aliases: ["Empagliflozina/metformina 12,5/1.000 mg/día"],
      className: "sglt2",
      efficacy: "HbA1c: efecto combinado variable y generalmente mayor que cada componente aislado; no es correcto sumar sus cifras de forma automática.",
      doses: ["12,5/1.000 mg/día (esquema local)"],
      safety: "Aplican precauciones de ambos componentes: metformina contraindicada con eGFR <30 y no iniciar si eGFR <45; por iSGLT2 considerar DKA/euglucémica, infecciones genitourinarias, depleción de volumen y suspensión 3–4 días antes de cirugía o durante ayuno/enfermedad grave."
    },
    {
      value: "vildagliptina50",
      label: "Vildagliptina 50 mg",
      aliases: ["Vildagliptina 50 mg"],
      efficacy: "HbA1c: ↓≈0,5–0,8 pp* para la clase DPP-4; depende del esquema total y la frecuencia utilizada.",
      doses: [
        "50 mg cada 24 h (50 mg/día)",
        "50 mg cada 12 h (100 mg/día; EMA, p. ej. con metformina o insulina)"
      ],
      safety: "No incluida en ADA Table 9.3. EMA: contraindicación formal por hipersensibilidad; no usar con hepatopatía o ALT/AST >3× LSN y controlar función hepática. En insuficiencia renal moderada-grave se recomienda 50 mg/día. No usar en DM1 ni para tratar DKA. Para DPP-4 se ha reportado pancreatitis; suspender si se sospecha."
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
    if (input.dataset.medKey) {
      return MEDICAMENTOS_APS.find((med) => med.value === input.dataset.medKey) || null;
    }
    const etiqueta = input.dataset.label || "";
    return MEDICAMENTOS_APS.find((med) => med.label === etiqueta || med.aliases?.includes(etiqueta)) || null;
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
    return med.doses.map((dose, index) => `<option value="${dose}"${index === 0 ? " selected" : ""}>${dose}</option>`).join("");
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

  function sincronizarSelectorDosis(input) {
    const med = buscarMedicamento(input);
    const label = input?.closest("label");
    const select = label?.querySelector(".aps-med-dose");
    if (!med || !select) return;

    select.disabled = !input.checked;
    input.dataset.medKey = med.value;
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
      const label = input.closest("label");
      const select = label?.querySelector(".aps-med-dose");
      if (!med || !select) return;

      input.dataset.medKey = med.value;
      input.dataset.doseSelectorActivo = "true";
      select.addEventListener("change", () => sincronizarSelectorDosis(input));
      input.addEventListener("change", () => sincronizarSelectorDosis(input));
      sincronizarSelectorDosis(input);
    });
  }

  function completarContenidoMedicamento(label, input, med) {
    if (!label || !input || !med) return;

    input.dataset.medKey = med.value;
    const spanActual = Array.from(label.children).find((child) => child.tagName === "SPAN" && !child.classList.contains("aps-med-copy"));
    let copy = label.querySelector(".aps-med-copy");

    if (!copy) {
      copy = document.createElement("span");
      copy.className = "aps-med-copy";
      if (spanActual) spanActual.replaceWith(copy);
      else label.appendChild(copy);
    }

    copy.innerHTML = `
      <span class="aps-med-name">${med.label}</span>
      <small class="aps-med-efficacy">${med.efficacy}</small>
      <span class="aps-med-dose-row">
        <span class="aps-med-dose-label">Dosis</span>
        <select class="aps-med-dose" data-med-dose="${med.value}" disabled>${opcionesDosisHTML(med)}</select>
      </span>
      <small class="aps-med-safety"><strong>Precauciones / evitar:</strong> ${med.safety}</small>`;
  }

  function crearTarjetaMedicamentos(scope, { mostrarTitulo = true } = {}) {
    const card = document.createElement("div");
    card.className = "card card-blue text-left aps-context-card";
    card.id = `tratamiento-concomitante-${scope}`;

    const opciones = MEDICAMENTOS_APS.map((med) => `
      <label class="aps-med-option">
        <input type="checkbox" data-aps-med="${scope}" data-med-key="${med.value}" data-label="${med.label}"${med.className ? ` data-class="${med.className}"` : ""}>
        ${contenidoMedicamento(med, scope)}
      </label>`).join("");

    card.innerHTML = `
      ${mostrarTitulo ? '<p class="card-title text-center">Tratamiento concomitante disponible en APS</p>' : ""}
      <p class="aps-context-helper">Marque los fármacos que el paciente utiliza actualmente y seleccione la dosis. Este registro <strong>no modifica automáticamente</strong> el cálculo de NPH.</p>
      <div class="aps-med-grid">${opciones}</div>
      <p class="aps-efficacy-note">${NOTA_EFICACIA}<br>${NOTA_DOSIS}</p>`;

    return card;
  }

  function enriquecerTratamientoSeguimiento() {
    const card = document.getElementById("tratamiento-concomitante-seguimiento");
    if (!card) return;

    card.querySelectorAll('input[data-aps-med="seguimiento"]').forEach((input) => {
      if (input.dataset.label === "Empagliflozina 12,5 mg/día (½ comprimido de 25 mg; uso local por costo)") {
        input.closest("label")?.remove();
      }
    });

    card.querySelectorAll('input[data-aps-med="seguimiento"]').forEach((input) => {
      const med = buscarMedicamento(input);
      const label = input.closest("label");
      if (!med || !label) return;
      completarContenidoMedicamento(label, input, med);
    });

    let note = card.querySelector(".aps-efficacy-note");
    if (!note) {
      note = document.createElement("p");
      note.className = "aps-efficacy-note";
      card.appendChild(note);
    }
    note.innerHTML = `${NOTA_EFICACIA}<br>${NOTA_DOSIS}`;
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
      <h2>Tratamiento concomitante disponible en APS</h2>
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

  function activarExclusividadFarmacologica() {
    document.querySelectorAll('input[data-class="sglt2"]').forEach((input) => {
      if (input.dataset.exclusividadActiva === "true") return;
      input.dataset.exclusividadActiva = "true";

      input.addEventListener("change", () => {
        if (!input.checked) return;
        const scope = input.dataset.apsMed;
        document.querySelectorAll(`input[data-aps-med="${scope}"][data-class="sglt2"]`).forEach((otro) => {
          if (otro !== input) {
            otro.checked = false;
            sincronizarSelectorDosis(otro);
          }
        });
      });
    });
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
