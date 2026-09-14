# Insulog APS — baseline de ingeniería

Este documento fija el estado técnico que debe protegerse antes de cualquier cambio relevante. Su objetivo es separar responsabilidades y evitar que cambios de interfaz, PWA, PDF, infraestructura o compatibilidad alteren inadvertidamente la lógica clínica.

## Principios de trabajo

1. La red de seguridad automatizada debe quedar verde antes de integrar cambios.
2. Un refactor no debe cambiar resultados clínicos salvo que el cambio sea explícito, revisado y documentado como cambio clínico.
3. UI, impresión, PWA, Farmacia Popular, compatibilidad de dispositivos y lógica clínica evolucionan como responsabilidades separadas.
4. No se persisten datos clínicos identificables del paciente en `localStorage`, `sessionStorage` ni `IndexedDB`.
5. Los umbrales y cálculos clínicos no se duplican en la interfaz: la UI recopila datos, invoca el motor y presenta el resultado.
6. Las capas se comunican mediante APIs namespaced y acciones explícitas, no mediante globals sueltos o monkey patches.
7. Un cambio visual protegido exige inspección y, solo si corresponde, actualización explícita del baseline visual.
8. El app shell se publica como una unidad inmutable; no se permiten revisiones manuales independientes por asset ni actualización parcial dentro de una atención abierta.
9. La emulación cross-browser no se confunde con aceptación en hardware real: WebKit/iPhone-like y Chromium/Android-like son guardrails de CI, no certificación de Safari/iOS o de un dispositivo físico.

## Contrato clínico protegido

`clinical-engine.js` es una dependencia pura, sin DOM ni almacenamiento del navegador, y concentra las decisiones que determinan resultados clínicos.

Funciones protegidas:

- `suggestInitialScheme()` — criterio y esquema de inicio;
- `calculateInitialDose()` — dosis inicial y reparto AM/PM;
- `detectDiscordantHighs()` / `analyzeGlucose()` — análisis de HGT;
- `classifyHypoglycemia()` — niveles 1, 2 y 3;
- `calculateAdjustment()` — ajuste ±2/±4 UI;
- `calculateSecondDose()` — segunda dosis con límites vigentes;
- `assessDoseSafety()` — seguridad de dosis alta;
- `calculateFollowup()` — resultado integral del seguimiento.

Reglas que siguen siendo contrato:

- exclusiones: DM1, embarazo, pancreatitis/cirugía pancreática y menores de 18 años;
- inicio NPH dentro de 0,1–0,3 UI/kg según riesgo y contexto;
- hiperglicemia marcada puede sugerir esquema AM + PM;
- seguimiento guiado por promedios de ayunas/pre-noche con ajustes ±2/±4 UI;
- valores altos discordantes se señalan, pero **se mantienen en el promedio**;
- ejemplo de regresión: `[100,100,100,300]` produce promedio 150 mg/dL y PM 20 → 22 UI, además de advertencia;
- hipoglicemia: 54–69 mg/dL nivel 1, <54 mg/dL nivel 2 y cualquier episodio con asistencia nivel 3;
- 54 mg/dL exactos permanecen en nivel 1 bajo el contrato actual (`<54` para nivel 2);
- nivel 3 bloquea el ajuste automático de NPH y exige reevaluación prioritaria;
- revisión de dosis alta desde ≥0,7 UI/kg/día;
- no existe escalamiento automático por el solo hecho de alcanzar ≥1 UI/kg/día.

Cualquier modificación de estas reglas debe tratarse como cambio clínico, no como refactor.

## Arquitectura vigente

### Fase 5 — motor clínico separado

La lógica crítica quedó centralizada en `clinical-engine.js` y cubierta por matriz de regresión.

### Fase 6 — runtime y acciones explícitas

La aplicación ya no depende de `globalData`, `nav`, `calcularSeguimientoPro`, `generarDocumento`, `finalizar` ni otros puntos de entrada legacy.

Composición actual:

- `InsulogRuntime`: estado efímero, navegación, utilidades DOM y action registry;
- `InsulogApp`: adaptación inputs → motor → resultado UI;
- `InsulogDocuments`: documento base y pipeline de enhancers;
- `aps-safety-2026.js`: seguridad/formulario APS mediante decoradores;
- `pdf-enhancements.js`: enhancer explícito del documento;
- `document-flow.js`: P6/P7, validación, vista previa e impresión;
- `app-shell.js`: inicialización, delegación de `data-action` y registro del service worker.

Exports permitidos en `window`: `InsulogRuntime`, `InsulogApp`, `InsulogDocuments`, `InsulogShell` y el namespace independiente `InsulogClinicalEngine`.

`index.html` no contiene handlers inline.

## Fase 7 — interfaz mobile-first y regresión visual

### 7A/7B — UX clínica

- `styles.css` concentra el sistema visual principal;
- viewport móvil ≤760 px usa la pantalla de forma nativa y respeta safe areas;
- botones principales mantienen superficies táctiles grandes;
- los campos principales usan tipografía de 16 px para evitar zoom de foco en navegadores móviles;
- P0–P7 muestran lenguaje clínico en lugar de códigos internos;
- la tabla HGT cabe en 390 px sin scroll horizontal interno;
- la UI conserva `prefers-reduced-motion`;
- el PDF permanece aislado del layout principal.

### 7C — contrato visual

`tests/e2e/visual-contract.spec.js` protege P0, P2 y P4 en:

- móvil 390×844;
- escritorio 1440×1000.

Se usa dHash perceptual de 64 bits con distancia Hamming máxima de 6 bits y PNG de diagnóstico retenidos 14 días. `VISUAL_RECORD=1` es solo un mecanismo manual de re-baseline.

Baselines originales de 7C:

- `mobile-p0`: `ecf28ee880000000`;
- `mobile-p2`: `d8daceb4b0000000`;
- `mobile-p4`: `93938504859387a0`;
- `desktop-p0`: `3233332323033300`;
- `desktop-p2`: `3333336133033300`;
- `desktop-p4`: `714b4b4b4b433333`.

## Fase 8 — PDF estable y despliegue atómico

### Documento/PDF

Responsabilidades:

- `patient-document.js`: estructura semántica;
- `pdf-enhancements.js`: transformación del contenido para el paciente;
- `document-flow.css`: aislamiento/host de vista previa e impresión;
- `pdf-enhancements.css`: estructura específica del documento;
- `pdf-design-2026.css`: autoridad visual final de la hoja Letter.

Contratos:

- P6 prepara; P7 previsualiza;
- el PDF visible vive en un iframe aislado;
- el staging queda fuera de `<main>` y oculto;
- el nombre del paciente es obligatorio;
- seguimiento conserva 15 filas HGT;
- no se usan `zoom`, escalamiento artificial ni clipping para forzar una página;
- el caso protegido imprime en Letter con legibilidad mínima validada por E2E.

### 8D — service worker inmutable

`sw.js` trata cada release como una unidad completa:

- instala solo si puede preparar todo el app shell;
- no usa `skipWaiting()`;
- no usa `clients.claim()`;
- una atención abierta permanece sobre su worker anterior;
- caches antiguos se eliminan durante activación de la nueva versión;
- no existe actualización archivo-por-archivo durante `fetch`;
- app y `pdf-preview.html` pertenecen al mismo release;
- `data/farmacia-cerro-navia.json` es dinámico, queda fuera del shell y no modifica cálculos clínicos.

`scripts/check_atomic_shell.py` protege este contrato.

### 8E — fingerprint reproducible

`scripts/app_shell_release.py` calcula una huella SHA-256 truncada a 16 caracteres a partir de los archivos que definen el shell offline. Normaliza sus propios query strings, `CACHE_NAME` y `DEPLOYMENT_REVISION` para evitar un hash circular.

Procedimiento obligatorio al modificar `SHELL_FILES`:

1. realizar el cambio;
2. ejecutar `python scripts/app_shell_release.py --write`;
3. ejecutar `python scripts/app_shell_release.py`;
4. ejecutar `python scripts/check_atomic_shell.py`;
5. ejecutar la red de seguridad correspondiente;
6. inspeccionar cualquier cambio visual relevante;
7. integrar solo con CI verde.

No se vuelven a mantener manualmente contadores `atomicXX`, fechas dentro de `?v=` ni revisiones divergentes por archivo.

## Fase 9 — compatibilidad móvil

### 9A — cross-browser automatizado

Fase 9A está completada y añade una capa específica de compatibilidad móvil sin cambiar el motor clínico.

Archivos:

- `tests/e2e/device-compat.spec.js`;
- `playwright.devices.config.js`;
- `.github/workflows/device-compat.yml`.

Perfiles CI:

- **WebKit iPhone-like:** 393×852, DPR 3, touch;
- **Chromium Android-like:** 412×915, DPR 2.625, touch.

Contratos añadidos:

- metadatos PWA y `viewport-fit=cover`;
- documento sin overflow horizontal;
- navegación real hasta P4;
- tabla HGT completa sin scroll horizontal interno;
- inputs HGT con altura/objetivo táctil mínimo de **44 px**;
- CTA principal ≥48 px;
- captura de HGT mediante touch/mobile inputs;
- vista previa PDF dentro del iframe móvil;
- app shell navegable offline en Chromium Android con service worker real;
- capturas P0/P4 de ambos perfiles retenidas 14 días.

El primer run de 9A detectó un defecto real: los HGT medían 40 px en ambos motores. Se corrigió `styles.css` a 44 px; la exigencia del test no se redujo.

El cambio activó correctamente el versionado de Fase 8. El **release vigente después de 9A** es:

`4804df17c9c0ab6b`

La corrida final de 9A quedó con:

- 30/30 E2E Chromium históricos verdes;
- 7 tests móviles verdes y 1 skip esperado por matriz de proyecto;
- 6 workflows del PR verdes;
- visual regression histórica verde sin re-baseline;
- P0/P4 inspeccionados manualmente en las cuatro capturas CI.

### 9B — aceptación en hardware real

9B **no se declara completada todavía**. Su protocolo vive en `docs/mobile-device-validation.md`.

Debe validarse al menos en:

- un iPhone físico con Safari y PWA agregada a pantalla de inicio;
- un Android físico con Chrome/PWA.

Debe cubrir safe areas, orientación, teclado móvil, foco/scroll, P4, PDF/impresión o compartir, instalación, offline tras cierre/reapertura y al menos una transición entre releases.

CI WebKit/Chromium es evidencia previa útil, pero no reemplaza esta aceptación física.

## Mapa de responsabilidades

| Área | Archivo principal | Responsabilidad | Riesgo |
| --- | --- | --- | --- |
| Motor clínico | `clinical-engine.js` | Cálculos y decisiones clínicas puras | Bajo mientras permanezca sin DOM |
| Runtime | `app-runtime.js` | Estado, navegación y acciones | Bajo |
| Adaptador UI | `app.js` | Inputs → motor → presentación | Bajo-medio |
| Sistema visual | `styles.css` | Layout, controles y tabla HGT | Bajo con E2E/visual/mobile |
| Seguridad APS | `aps-safety-2026.js` | Medicación y flujos de seguridad | Bajo-medio |
| Documento | `patient-document.js` | Semántica del documento | Bajo-medio |
| PDF | `pdf-enhancements.js` + CSS PDF | Documento imprimible | Bajo-medio con contrato Letter |
| Flujo PDF | `document-flow.js` | Preparación, iframe e impresión | Bajo |
| Farmacia Popular | `farmacia-popular.js` + JSON | Precio/stock informativo | Bajo; desacoplado de dosis |
| App shell | `app-shell.js` | Inicialización y SW | Bajo |
| Service worker | `sw.js` | Shell offline inmutable | Bajo-medio |
| Release | `scripts/app_shell_release.py` | Fingerprint canónico | Bajo |
| Guardrail SW | `scripts/check_atomic_shell.py` | Atomicidad y unicidad | Bajo |
| Visual regression | `visual-contract.spec.js` | P0/P2/P4 perceptual | Bajo |
| Compatibilidad móvil | `device-compat.spec.js` | WebKit/Android touch/mobile | Bajo; complementa hardware real |
| Protocolo real | `docs/mobile-device-validation.md` | Aceptación iPhone/Android físicos | Manual hasta automatización externa |

## Flujos que se consideran contrato

### Inicio

`P0 → P1 → P2 → P2.5 → P3 → P5 → P6 → P7`

- exclusiones fuera del algoritmo APS;
- hiperglicemia marcada sin alto riesgo puede llevar a AM + PM;
- alto riesgo conserva inicio conservador;
- tratamiento concomitante no modifica automáticamente NPH;
- cálculo proviene del motor puro.

### Seguimiento

`P0 → P1 → P2 → P3.5 → P4 → P5 → P6 → P7`

- 15 filas HGT;
- mínimo tres ayunas para ajuste;
- ajuste PM guiado por ayunas;
- discordantes altos permanecen en el promedio;
- alerta de hipoglicemia aparece al solicitar ajuste;
- nivel 3 requiere confirmación de asistencia y no ajusta automáticamente;
- tabla P4 utilizable sin overflow y con HGT ≥44 px táctiles en perfiles móviles protegidos.

### Documento

- P6 prepara y P7 previsualiza;
- iframe aislado;
- nombre obligatorio;
- documento generado por `InsulogDocuments.generate()` y enhancers;
- caso protegido mantiene salida Letter legible.

### Farmacia Popular

- informativa y desacoplada del algoritmo;
- presentación seleccionada no cae silenciosamente a otra dosis;
- presentaciones nuevas no mapeadas requieren revisión clínica;
- JSON dinámico fuera del cache inmutable.

## Red de seguridad actual

La seguridad técnica tiene **seis niveles complementarios**:

1. **Contrato unitario del motor** — retornos, límites y reglas puras.
2. **Matriz de regresión clínica** — inicio, ajustes, hipoglicemia, discordantes y dosis alta.
3. **E2E Chromium** — 30 casos funcionales de interfaz, privacidad, Farmacia, documento y PWA.
4. **Regresión visual perceptual** — P0/P2/P4 móvil y escritorio con dHash + PNG.
5. **Contrato release/PWA** — fingerprint único, shell atómico y navegación offline.
6. **Compatibilidad móvil cross-browser** — WebKit iPhone-like + Chromium Android-like, touch, P4, PDF y offline Android.

La aceptación física de 9B es una séptima capa manual pendiente, no una condición ya satisfecha.

## Invariantes

Los checks deben impedir, entre otras regresiones:

- DOM/almacenamiento dentro del motor clínico;
- duplicación de umbrales clínicos en UI;
- globals legacy o handlers inline;
- monkey patches clínicos/documentales;
- persistencia de datos de pacientes;
- reclasificación de hipoglicemia fuera del motor;
- `skipWaiting()`/`clients.claim()` en el shell clínico actual;
- actualización parcial del shell;
- dos versiones de un mismo asset dentro de un release;
- divergencia entre fingerprint, URLs, cache y deployment revision;
- inclusión accidental del JSON dinámico de Farmacia en el shell;
- pérdida de targets táctiles protegidos, mobile-first o reduced motion;
- hacks de zoom/overflow;
- cambios visuales significativos no revisados.

## Deuda técnica priorizada

1. **Completar Fase 9B** con evidencia en un iPhone físico y un Android físico.
2. Probar específicamente impresión/compartir PDF desde Safari/iOS y Chrome/Android reales.
3. Ampliar regresión visual a estados dinámicos de alto valor: hipoglicemia, dosis alta y nota clínica.
4. Reducir acoplamiento directo al DOM de `app.js` y `aps-safety-2026.js` cuando aporte valor concreto.
5. Versionar explícitamente el protocolo clínico y asociar futuras modificaciones a una matriz revisada de casos esperados.
6. Separar progresivamente generación de texto clínico de manipulación DOM si simplifica mantenimiento.
7. Evaluar módulos ES nativos solo ante una ventaja concreta.

El versionado manual del app shell ya no es deuda: quedó resuelto en Fase 8.

## Regla de aceptación para cambios futuros

Un PR no clínico debe:

- pasar checks estáticos y guardrails aplicables;
- pasar los E2E de las superficies que toca;
- no modificar resultados clínicos de referencia;
- no introducir persistencia identificable;
- conservar motor puro, action registry y namespaces;
- mantener `index.html` sin handlers inline;
- conservar mobile-first y targets táctiles protegidos;
- actualizar el baseline visual solo ante cambio intencional inspeccionado;
- si toca `SHELL_FILES`, regenerar y versionar el fingerprint canónico;
- conservar atomicidad/offline;
- si toca superficies móviles, pasar el workflow cross-browser;
- explicar qué responsabilidad cambia y por qué.

Un cambio intencional de dosis, umbral, criterio o conducta clínica debe actualizar primero casos esperados y documentación clínica correspondiente.

## Estado de cierre

- **Fase 8:** cerrada; PDF y despliegue atómico protegidos.
- **Fase 9A:** cerrada; compatibilidad móvil automatizada incorporada y defecto HGT 40→44 px corregido.
- **Fase 9B:** abierta; protocolo de aceptación física definido, pendiente de ejecución en hardware real.
