"use strict";

/*
 * Runtime compartido de Insulog.
 *
 * Este archivo contiene únicamente estado efímero, utilidades DOM y navegación.
 * No contiene reglas de dosificación, farmacología ni lógica clínica.
 * Los identificadores globales legacy se mantienen para que las capas existentes
 * puedan migrarse de forma gradual sin alterar comportamiento.
 */

let globalData = {
  am: 0,
  pm: 0,
  criteria: "",
  acciones: ""
};

const $ = (id) => document.getElementById(id);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));

function showElement(element, visible = true) {
  if (!element) return;
  element.classList.toggle("is-hidden", !visible);
}

function activePageId() {
  return document.querySelector(".page.active")?.id || null;
}

function nav(pagina) {
  const targetId = `p${pagina}`;

  qsa(".page").forEach((page) => {
    const active = page.id === targetId;
    page.classList.toggle("active", active);
    page.setAttribute("aria-hidden", String(!active));
  });

  const target = $(targetId);
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

function snapshotRuntimeState() {
  return { ...globalData };
}

window.InsulogRuntime = Object.freeze({
  version: "2026.09.10",
  dom: Object.freeze({
    byId: $,
    all: qsa,
    show: showElement
  }),
  navigation: Object.freeze({
    go: nav,
    activePageId
  }),
  state: Object.freeze({
    snapshot: snapshotRuntimeState
  })
});
