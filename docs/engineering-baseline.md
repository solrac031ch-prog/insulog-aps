# Insulog APS — baseline de ingeniería

> **Estado vigente 2026-09-24:** la identidad clínica canónica es `APS-NPH-2026.09.24-r6`. Las secciones históricas de fases anteriores se conservan como registro de evolución; ante cualquier diferencia, mandan `clinical-protocol.json`, `clinical-engine.js` y la matriz de regresión vigente. El endurecimiento pre-piloto (identidad profesional, dataset estructurado y `CasosRaw`) está documentado en `docs/prepilot-hardening-2026-09-24.md`.

Este documento fija el estado técnico que debe protegerse antes de cualquier cambio relevante. Su objetivo es separar responsabilidades y evitar que cambios de interfaz, PWA, PDF, infraestructura, accesibilidad o compatibilidad alteren inadvertidamente la lógica clínica.

## Principios de trabajo

1. La red de seguridad automatizada debe quedar verde antes de integrar cambios.
2. Un refactor no debe cambiar resultados clínicos salvo que el cambio sea explícito, revisado y documentado como cambio clínico.
3. UI, impresión, PWA, Farmacia Popular, accesibilidad, compatibilidad de dispositivos y lógica clínica evolucionan como responsabilidades separadas.
4. No se persisten datos clínicos identificables del paciente en `localStorage`, `sessionStorage` ni `IndexedDB`.
5. Los umbrales y cálculos clínicos no se duplican en la interfaz: la UI recopila datos, invoca el motor y presenta el resultado.
6. Las capas se comunican mediante APIs namespaced y acciones explícitas, no mediante globals sueltos o monkey patches.
7. Un cambio visual protegido exige inspección y, solo si corresponde, actualización explícita del baseline visual.
8. El app shell se publica como una unidad inmutable; no se permiten revisiones manuales independientes por asset ni actualización parcial dentro de una atención abierta.
9. La emulación cross-browser no se confunde con aceptación en hardware real: WebKit/iPhone-like y Chromium/Android-like son guardrails de CI, no certificación de Safari/iOS o de un dispositivo físico.
10. El repositorio debe poder validarse con comandos reproducibles documentados; la CI sigue siendo la autoridad antes del merge.
11. La versión clínica y el release técnico son identidades distintas: un refactor puede cambiar el shell sin cambiar protocolo, y un cambio clínico debe versionarse explícitamente.

## Contrato clínico protegido

`clinical-engine.js` es una dependencia pura, sin DOM ni almacenamiento del navegador, y concentra las decisiones que determinan resultados clínicos.

Funciones protegidas:

- `suggestInitialScheme()` — criterio y esquema de inicio;
- `calculateInitialDose()` — dosis inicial y reparto AM/PM;
- `detectDiscordantHighs()` / `analyzeGlucose()` — análisis de HGT;
- `classifyHypoglycemia()` — niveles 1, 2 y 3;
- `calculateAdjustment()` — ajuste porcentual −20/−10/0/+10/+20% según el menor HGT del perfil;
- `calculateSecondDose()` — segunda dosis con límites vigentes;
- `assessDoseSafety()` — seguridad de dosis alta;
- `calculateFollowup()` — resultado integral del seguimiento.

Reglas que siguen siendo contrato:

- exclusiones: DM1, embarazo, pancreatitis/cirugía pancreática y menores de 18 años;
- inicio NPH dentro de 0,1–0,3 UI/kg; la sugerencia automática usa 0,3 UI/kg solo en doble dosis, mientras el profesional puede seleccionarlo manualmente como override documentado;
- hiperglicemia marcada puede sugerir esquema AM + PM;
- seguimiento titulado con el menor de al menos 3 HGT válidos del perfil correspondiente; los promedios quedan como descripción;
- valores altos discordantes se señalan, pero **se mantienen en el promedio**;
- regresión protegida: `[100,100,100,300]` produce promedio 150 mg/dL y PM 20 → 22 UI, además de advertencia;
- hipoglicemia: 54–69 mg/dL nivel 1, <54 mg/dL nivel 2 y cualquier episodio con asistencia nivel 3;
- 54 mg/dL exactos permanecen en nivel 1 bajo el contrato actual (`<54` para nivel 2);
- nivel 3 activa urgencia; solo existe reducción automática del 20% de una dosis atribuible cuando no hay causa reversible ni pérdida de conciencia/convulsión; en los demás casos exige ajuste médico;
- revisión de dosis basal desde ≥0,4 UI/kg/día;
- el escalamiento automático se bloquea si la dosis proyectada alcanza o supera 0,5 UI/kg/día.

La identidad canónica de estas reglas vive en `clinical-protocol.json`. La versión vigente es:

`APS-NPH-2026.09.24-r6`

Cualquier modificación intencional de dosis, umbral, criterio o conducta en `clinical-engine.js` debe tratarse como cambio clínico, actualizar esa versión y conservar verde la matriz declarada de regresión.

## Arquitectura vigente

### Fase 5 — motor clínico separado

La lógica crítica quedó centralizada en `clinical-engine.js` y cubierta por matriz de regresión.

### Fase 6 — runtime y acciones explícitas

La aplicación ya no depende de `globalData`, `nav`, `calcularSeguimientoPro`, `generarDocumento`, `finalizar` ni otros puntos de entrada legacy.

Composición actual:

- `InsulogRuntime`: estado efímero, navegación, utilidades DOM y action registry;
- `InsulogClinicalEngine`: cálculos y decisiones clínicas puras;
- `InsulogClinicalCopy`: generación pura de texto para las notas clínicas;
- `InsulogApp`: adaptación inputs → motor/copy → resultado UI;
- `InsulogDocuments`: documento base y pipeline de enhancers;
- `aps-safety-2026.js`: seguridad/formulario APS mediante decoradores;
- `pdf-enhancements.js`: enhancer explícito del documento;
- `document-flow.js`: P6/P7, validación, vista previa e impresión;
- `app-shell.js`: inicialización, delegación de `data-action` y registro del service worker.

Exports de aplicación permitidos en `window`: `InsulogRuntime`, `InsulogClinicalEngine`, `InsulogClinicalCopy`, `InsulogApp`, `InsulogDocuments` e `InsulogShell`.

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

### 7C — contrato visual base

`tests/e2e/visual-contract.spec.js` nació protegiendo P0, P2 y P4 en:

- móvil 390×844;
- escritorio 1440×1000.

Se usa dHash perceptual de 64 bits con distancia Hamming máxima de 6 bits y PNG de diagnóstico retenidos 14 días. `VISUAL_RECORD=1` es solo un mecanismo manual de re-baseline y no puede quedar como modo automático de aceptación.

Baselines originales de 7C:

- `mobile-p0`: `ecf28ee880000000`;
- `mobile-p2`: `d8daceb4b0000000`;
- `mobile-p4`: `93938504859387a0`;
- `desktop-p0`: `3233332323033300`;
- `desktop-p2`: `3333336133033300`;
- `desktop-p4`: `714b4b4b4b433333`.

La ampliación dinámica de este contrato se documenta en Fase 10A.

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
- tras completar el precache puede usar `skipWaiting()` para que la nueva versión quede activa sin esperar al cierre de todas las pestañas;
- no usa `clients.claim()`, por lo que una atención ya abierta no cambia de worker ni mezcla assets durante la sesión;
- la nueva versión se aplica en la siguiente navegación/recarga;
- caches antiguos se eliminan durante activación de la nueva versión;
- no existe actualización archivo-por-archivo durante `fetch`;
- app y `pdf-preview.html` pertenecen al mismo release;
- `data/farmacia-cerro-navia.json` es dinámico, queda fuera del shell y no modifica cálculos clínicos.

`scripts/check_atomic_shell.py` protege este contrato.

### 8E — fingerprint reproducible

`scripts/app_shell_release.py` calcula una huella SHA-256 truncada a 16 caracteres a partir de los archivos que definen el shell offline. Normaliza sus propios query strings, `CACHE_NAME` y `DEPLOYMENT_REVISION` para evitar un hash circular.

Procedimiento obligatorio al modificar `SHELL_FILES`:

1. realizar el cambio;
2. ejecutar `npm run release:write`;
3. ejecutar `npm run check:release`;
4. ejecutar la red de seguridad correspondiente;
5. inspeccionar cualquier cambio visual relevante;
6. integrar solo con CI verde.

No se mantienen manualmente contadores `atomicXX`, fechas dentro de `?v=` ni revisiones divergentes por archivo.

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

El release creado por 9A fue `4804df17c9c0ab6b`. El release técnico vigente tras Fase 11B es:

`239bc6b77d3afe3d`

La versión clínica es independiente y permanece `APS-NPH-2026.09.14-r1`.

### 9B — aceptación en hardware real

9B **no se declara completada todavía**. Su protocolo vive en `docs/mobile-device-validation.md`.

Debe validarse al menos en:

- un iPhone físico con Safari y PWA agregada a pantalla de inicio;
- un Android físico con Chrome/PWA.

Debe cubrir safe areas, orientación, teclado móvil, foco/scroll, P4, PDF/impresión o compartir, instalación, offline tras cierre/reapertura y al menos una transición entre releases.

CI WebKit/Chromium es evidencia previa útil, pero no reemplaza esta aceptación física.

## Fase 10 — estados clínicos críticos y reproducibilidad

### 10A — regresión visual de estados dinámicos

El contrato visual se amplió de 6 a **12 estados protegidos**. A P0/P2/P4 en móvil y escritorio se agregaron, también en ambos tamaños:

- alerta de hipoglicemia;
- revisión por dosis alta/sobreinsulinización;
- nota clínica.

Los nuevos estados se grabaron en dos pasos: generación deliberada de PNG/hash, inspección visual y luego ejecución estricta. Durante el proceso se rechazó una primera captura de hipoglicemia porque no mostraba realmente la alerta; el baseline no se aceptó hasta corregir el viewport.

La suite quedó en **36 E2E Chromium** al cierre de 10A, sin modificar motor clínico, PDF ni thresholds.

### 10B — accesibilidad de alertas clínicas críticas

`tests/e2e/critical-alert-accessibility.spec.js` protege específicamente que:

- la alerta de hipoglicemia pase de `aria-hidden=true` a visible al solicitar el ajuste;
- conserve `role="alert"` y `aria-live="polite"`;
- el nivel clínico y las dos decisiones sobre asistencia permanezcan visibles;
- la alerta termine dentro del viewport;
- P41 reciba foco real en su encabezado clínico mediante `tabindex="-1"`;
- después de finalizar el scroll suave, el encabezado enfocado termine visible dentro del viewport.

La primera versión del test de P41 detectó una posición transitoria de ~-60 px porque medía durante la animación `scrollTo(..., behavior="smooth")`. Se corrigió el test para esperar el estado final, en vez de modificar producción por una medición prematura.

Al cierre de 10B:

- **38/38 E2E Chromium** verdes;
- los 6 workflows del PR verdes;
- WebKit/Android, PDF, documento, Farmacia Popular, visual regression y checks estáticos verdes;
- ningún cambio a `clinical-engine.js`, dosis, umbrales, CSS, PDF o app shell.

### 10C — mantenimiento reproducible

El repositorio deja de depender de conocimiento implícito del mantenedor:

- `README.md` pasa de un encabezado mínimo a una guía operativa del proyecto;
- `package.json` expone comandos para guardrails, release, E2E, dispositivos y verificación completa;
- `npm run verify` ejecuta secuencialmente la red local automatizada;
- `npm run release:write` es la vía documentada para regenerar el fingerprint;
- la documentación distingue cambios clínicos de refactors no clínicos y enlaza el protocolo físico 9B.

10C no tocó archivos de producción ni `SHELL_FILES`.

## Fase 11 — gobernanza clínica y desacoplamiento de texto

### 11A — versionado explícito del protocolo clínico

`clinical-protocol.json` introduce una identidad clínica independiente del release técnico. `scripts/check_clinical_protocol.py` valida el manifiesto, la existencia de la matriz declarada y, en pull requests contra `main`, compara la rama base con el cambio propuesto.

Si `clinical-engine.js` cambia:

- `clinical-protocol.json` también debe cambiar;
- si ya existía manifiesto en la base, la versión debe ser distinta;
- la matriz clínica sigue ejecutándose en CI.

Versión clínica inicial y vigente:

`APS-NPH-2026.09.14-r1`

11A no cambió `clinical-engine.js` ni el app shell.

### 11B — texto clínico fuera del DOM

`clinical-copy.js` concentra de forma pura la construcción de las notas de:

- inicio de NPH;
- seguimiento/ajuste;
- revisión de dosis alta.

`app.js` conserva lectura de inputs, llamadas al motor, estado y renderizado, pero ya no contiene esos template strings clínicos.

`tests/clinical-copy.test.js` compara salidas exactas, byte-a-byte. Esta capa complementa los E2E y la regresión visual: una modificación accidental de palabras, cifras, saltos de línea o etiquetas falla aunque el layout continúe parecido.

`clinical-copy.js` es parte del app shell offline; por ello 11B generó el release técnico `239bc6b77d3afe3d`. La versión clínica no cambió porque el motor y la conducta clínica permanecieron intactos.

La integración de 11B quedó con 6/6 workflows verdes y no necesitó rebaseline visual.

## Mapa de responsabilidades

| Área | Archivo principal | Responsabilidad | Riesgo |
| --- | --- | --- | --- |
| Motor clínico | `clinical-engine.js` | Cálculos y decisiones clínicas puras | Bajo mientras permanezca sin DOM |
| Versión clínica | `clinical-protocol.json` | Identidad canónica del protocolo | Bajo; cambio obligatorio si cambia el motor |
| Guardrail clínico | `scripts/check_clinical_protocol.py` | Impedir cambios de motor sin nueva versión | Bajo |
| Texto clínico | `clinical-copy.js` | Generación pura de notas clínicas | Bajo con regresión exacta |
| Runtime | `app-runtime.js` | Estado, navegación y acciones | Bajo |
| Adaptador UI | `app.js` | Inputs → motor/copy → presentación | Bajo-medio |
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
| Visual regression | `visual-contract.spec.js` | 12 estados perceptuales críticos | Bajo |
| Alertas accesibles | `critical-alert-accessibility.spec.js` | Semántica, foco y visibilidad crítica | Bajo |
| Compatibilidad móvil | `device-compat.spec.js` | WebKit/Android touch/mobile | Bajo; complementa hardware real |
| Protocolo real | `docs/mobile-device-validation.md` | Aceptación iPhone/Android físicos | Manual hasta automatización externa |
| Operación local | `README.md` + `package.json` | Comandos reproducibles y procedimiento de mantenimiento | Bajo |

## Flujos que se consideran contrato

### Inicio

`P0 → P1 → P2 → P2.5 → P3 → P5 → P6 → P7`

- exclusiones fuera del algoritmo APS;
- hiperglicemia marcada sin alto riesgo puede llevar a AM + PM;
- alto riesgo conserva inicio conservador;
- tratamiento concomitante no modifica automáticamente NPH;
- cálculo proviene del motor puro;
- nota base de inicio se genera mediante `clinical-copy.js` y está protegida por regresión exacta.

### Seguimiento

`P0 → P1 → P2 → P3.5 → P4 → P5 → P6 → P7`

- 15 filas HGT;
- mínimo tres ayunas para ajuste;
- ajuste PM guiado por ayunas;
- discordantes altos permanecen en el promedio;
- alerta de hipoglicemia aparece al solicitar ajuste;
- nivel 3 requiere confirmación de asistencia y no ajusta automáticamente;
- tabla P4 utilizable sin overflow y con HGT ≥44 px táctiles en perfiles móviles protegidos;
- hipoglicemia visible/anunciable y P41 enfocado permanecen protegidos por E2E;
- notas base de seguimiento/dosis alta se generan mediante `clinical-copy.js` con regresión exacta.

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

La seguridad técnica tiene **nueve capas automatizadas complementarias**:

1. **Contrato unitario del motor** — retornos, límites y reglas puras.
2. **Matriz de regresión clínica** — 56 casos agrupados de inicio, ajustes, hipoglicemia, discordantes y dosis alta.
3. **Gobernanza de versión clínica** — cambios del motor requieren manifiesto/versionado explícito.
4. **Regresión exacta de texto clínico** — notas base comparadas byte-a-byte.
5. **E2E Chromium** — **38 casos** de interfaz, clínica integrada, privacidad, Farmacia, documento, PWA y accesibilidad crítica.
6. **Regresión visual perceptual** — **12 estados** móvil/escritorio con dHash + PNG.
7. **Contrato release/PWA** — fingerprint único, shell atómico y navegación offline.
8. **Compatibilidad móvil cross-browser** — WebKit iPhone-like + Chromium Android-like, touch, P4, PDF y offline Android.
9. **Contrato de accesibilidad crítica** — semántica, foco y visibilidad de hipoglicemia y dosis alta.

La aceptación física de 9B es una capa manual adicional pendiente, no una condición ya satisfecha.

## Comandos reproducibles

```bash
npm run check:clinical-protocol
npm run test:clinical-copy
npm run check:invariants
npm run check:release
npm run test:e2e
npm run test:devices
npm run verify
```

Si cambia un `SHELL_FILE`:

```bash
npm run release:write
npm run check:release
npm run verify
```

La CI de GitHub Actions sigue siendo la autoridad final antes de integrar.

## Invariantes

Los checks deben impedir, entre otras regresiones:

- DOM/almacenamiento dentro del motor clínico;
- cambios de `clinical-engine.js` sin versionado clínico explícito;
- cambios accidentales en las notas base protegidas;
- duplicación de umbrales clínicos en UI;
- globals legacy o handlers inline;
- monkey patches clínicos/documentales;
- persistencia de datos de pacientes;
- reclasificación de hipoglicemia fuera del motor;
- pérdida de semántica/visibilidad de alertas críticas;
- `skipWaiting()`/`clients.claim()` en el shell clínico actual;
- actualización parcial del shell;
- dos versiones de un mismo asset dentro de un release;
- divergencia entre fingerprint, URLs, cache y deployment revision;
- inclusión accidental del JSON dinámico de Farmacia en el shell;
- pérdida de targets táctiles protegidos, mobile-first o reduced motion;
- hacks de zoom/overflow;
- cambios visuales significativos no revisados;
- uso automático de `VISUAL_RECORD=1` como aceptación de regresiones.

## Deuda técnica priorizada

1. **Completar Fase 9B** con evidencia en un iPhone físico y un Android físico.
2. Probar específicamente impresión/compartir PDF desde Safari/iOS y Chrome/Android reales.
3. Proteger `main` mediante branch protection/ruleset para impedir push o merge que salte CI (Issue #73; requiere configuración de plataforma).
4. Continuar reduciendo acoplamiento DOM de `app.js`/`aps-safety-2026.js` solo en extracciones pequeñas con salida protegida.
5. Evaluar módulos ES nativos solo ante una ventaja concreta.

Ya no son deuda:

- versionado manual del app shell — resuelto en Fase 8;
- regresión visual de hipoglicemia/dosis alta/nota clínica — resuelta en Fase 10A;
- visibilidad/foco accesible de alertas críticas — protegida en Fase 10B;
- ausencia de guía operativa/comandos unificados — resuelta en Fase 10C;
- versionado explícito del protocolo clínico — resuelto en Fase 11A;
- generación base de texto clínico mezclada con DOM — resuelta en Fase 11B.

## Regla de aceptación para cambios futuros

Un PR no clínico debe:

- pasar checks estáticos y guardrails aplicables;
- pasar los E2E de las superficies que toca;
- no modificar resultados clínicos de referencia;
- no introducir persistencia identificable;
- conservar motor puro, action registry y namespaces;
- mantener `index.html` sin handlers inline;
- conservar mobile-first y targets táctiles protegidos;
- conservar semántica/foco de alertas críticas;
- actualizar el baseline visual solo ante cambio intencional inspeccionado;
- si toca `SHELL_FILES`, regenerar y versionar el fingerprint canónico;
- conservar atomicidad/offline;
- si toca superficies móviles, pasar el workflow cross-browser;
- explicar qué responsabilidad cambia y por qué.

Un cambio intencional de dosis, umbral, criterio o conducta clínica debe actualizar primero casos esperados, `clinical-protocol.json` con una nueva versión y la documentación clínica correspondiente.

Un cambio intencional de redacción de las notas base debe actualizar deliberadamente la regresión exacta de `clinical-copy`; un refactor de UI no debe hacerlo.

## Estado de cierre

- **Fase 8:** cerrada; PDF y despliegue atómico protegidos.
- **Fase 9A:** cerrada; compatibilidad móvil automatizada incorporada y defecto HGT 40→44 px corregido.
- **Fase 9B:** abierta; protocolo de aceptación física definido, pendiente de ejecución en hardware real.
- **Fase 10A:** cerrada; contrato visual ampliado a 12 estados críticos.
- **Fase 10B:** cerrada; accesibilidad/visibilidad crítica protegida y Chromium en 38 E2E.
- **Fase 10C:** cerrada; README operativo y comandos reproducibles de mantenimiento integrados.
- **Fase 11A:** cerrada; protocolo clínico versionado y cambios del motor gobernados por CI.
- **Fase 11B:** cerrada; notas base generadas fuera del DOM con regresión exacta y release técnico `239bc6b77d3afe3d`.
