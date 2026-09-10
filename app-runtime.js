"use strict";

(() => {
  /*
   * Runtime compartido de Insulog.
   *
   * Mantiene únicamente infraestructura: estado efímero, utilidades DOM,
   * navegación y un registro explícito de acciones de interfaz. No contiene
   * reglas clínicas, farmacología ni generación de documentos.
   */

  const INITIAL_STATE = Object.freeze({
    am: 0,
    pm: 0,
    criteria: "",
    acciones: ""
  });

  let runtimeState = { ...INITIAL_STATE };
  const actionHandlers = new Map();

  const byId = (id) => document.getElementById(id);
  const all = (selector) => Array.from(document.querySelectorAll(selector));

  function showElement(element, visible = true) {
    if (!element) return;
    element.classList.toggle("is-hidden", !visible);
  }

  function activePageId() {
    return document.querySelector(".page.active")?.id || null;
  }

  function go(pagina) {
    const targetId = `p${pagina}`;

    all(".page").forEach((page) => {
      const active = page.id === targetId;
      page.classList.toggle("active", active);
      page.setAttribute("aria-hidden", String(!active));
    });

    const target = byId(targetId);
    const heading = target?.querySelector("h1, h2");

    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });

    if (heading) {
      heading.setAttribute("tabindex", "-1");
      requestAnimationFrame(() => heading.focus({ preventScroll: true }));
    }
  }

  function snapshotState() {
    return { ...runtimeState };
  }

  function getState(key) {
    return key === undefined ? snapshotState() : runtimeState[key];
  }

  function patchState(values = {}) {
    Object.assign(runtimeState, values);
    return snapshotState();
  }

  function replaceState(values = {}) {
    runtimeState = { ...values };
    return snapshotState();
  }

  function resetState() {
    runtimeState = { ...INITIAL_STATE };
    return snapshotState();
  }

  function registerAction(name, handler, { replace = false } = {}) {
    if (!name || typeof handler !== "function") {
      throw new TypeError("registerAction requiere nombre y función");
    }
    if (!replace && actionHandlers.has(name)) {
      throw new Error(`La acción ${name} ya está registrada`);
    }
    actionHandlers.set(name, handler);
    return handler;
  }

  function decorateAction(name, decorator) {
    const current = actionHandlers.get(name);
    if (typeof current !== "function") {
      throw new Error(`No existe una acción base para decorar: ${name}`);
    }
    if (typeof decorator !== "function") {
      throw new TypeError("decorateAction requiere una función decoradora");
    }

    const decorated = decorator(current);
    if (typeof decorated !== "function") {
      throw new TypeError(`El decorador de ${name} debe devolver una función`);
    }

    actionHandlers.set(name, decorated);
    return decorated;
  }

  function invokeAction(name, context = {}) {
    const handler = actionHandlers.get(name);
    if (typeof handler !== "function") {
      throw new Error(`Acción de interfaz no registrada: ${name}`);
    }
    return handler(context);
  }

  function hasAction(name) {
    return actionHandlers.has(name);
  }

  window.InsulogRuntime = Object.freeze({
    version: "2026.09.10-phase6",
    dom: Object.freeze({ byId, all, show: showElement }),
    navigation: Object.freeze({ go, activePageId }),
    state: Object.freeze({
      snapshot: snapshotState,
      get: getState,
      patch: patchState,
      replace: replaceState,
      reset: resetState
    }),
    actions: Object.freeze({
      register: registerAction,
      decorate: decorateAction,
      invoke: invokeAction,
      has: hasAction
    })
  });
})();
