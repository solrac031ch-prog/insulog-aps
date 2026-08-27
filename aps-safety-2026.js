"use strict";

(() => {
  const MEDICAMENTOS_APS = [
    { value: "metformina850", label: "Metformina 850 mg" },
    { value: "metforminaXR1000", label: "Metformina XR 1.000 mg (si intolerancia/RAM a metformina convencional)" },
    { value: "dapagliflozina10", label: "Dapagliflozina 10 mg/día", className: "sglt2" },
    { value: "empagliflozina25", label: "Empagliflozina 25 mg/día", className: "sglt2" },
    { value: "empagliflozina12_5", label: "Empagliflozina 12,5 mg/día (½ comprimido de 25 mg; uso local por costo)", className: "sglt2" },
    { value: "empaMet12_5_1000", label: "Empagliflozina/metformina 12,5/1.000 mg/día", className: "sglt2" },
    { value: "vildagliptina50", label: "Vildagliptina 50 mg" }
  ];

  const safetyState = {
    discordantes: [],
    clasificacionHipo: "",
    scope: "seguimiento",
    revisionHipo: null
  };

  function obtenerSeleccionados(scope) {
    return Array.from(document.querySelectorAll(`input[data-aps-med="${scope}"]:checked`))
      .map((input) => input.dataset.label)
      .filter(Boolean);
  }

  function tratamientoTexto(scope) {
    const seleccionados = obtenerSeleccionados(scope);
    return seleccionados.length ? seleccionados.join("; ") : "No registrado";
  }

  function crearTarjetaMedicamentos(scope) {
    const card = document.createElement("div");
    card.className = "card card-blue text-left aps-context-card";
    card.id = `tratamiento-concomitante-${scope}`;

    const opciones = MEDICAMENTOS_APS.map((med) => `
      <label class="aps-med-option">
        <input type="checkbox" data-aps-med="${scope}" data-label="${med.label}"${med.className ? ` data-class="${med.className}"` : ""}>
        <span>${med.label}</span>
      </label>`).join("");

    card.innerHTML = `
      <p class="card-title text-center">Tratamiento concomitante disponible en APS</p>
      <p class="aps-context-helper">Marque los fármacos que el paciente utiliza actualmente. Este registro <strong>no modifica automáticamente</strong> el cálculo de NPH.</p>
      <div class="aps-med-grid">${opciones}</div>`;

    return card;
  }

  function activarExclusividadFarmacologica() {
    document.querySelectorAll('input[data-class="sglt2"]').forEach((input) => {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        const scope = input.dataset.apsMed;
        document.querySelectorAll(`input[data-aps-med="${scope}"][data-class="sglt2"]`).forEach((otro) => {
          if (otro !== input) otro.checked = false;
        });
      });
    });
  }

  function insertarTarjetaInicio() {
    const p3 = document.getElementById("p3");
    const preview = document.getElementById("preview-dosis");
    if (p3 && preview && !document.getElementById("tratamiento-concomitante-inicio")) {
      preview.insertAdjacentElement("beforebegin", crearTarjetaMedicamentos("inicio"));
    }
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

  insertarTarjetaInicio();
  activarExclusividadFarmacologica();
  configurarRevisionHipoglicemia();
  actualizarTerminologia();
})();
