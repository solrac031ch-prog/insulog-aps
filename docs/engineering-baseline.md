# Insulog APS — baseline de ingeniería

Este documento fija el estado técnico que debe protegerse antes de cualquier refactor importante. Su objetivo es separar responsabilidades, declarar invariantes y evitar que cambios visuales, de PWA, PDF o infraestructura alteren inadvertidamente la lógica clínica.

## Principios de trabajo

1. Primero debe quedar verde la red de seguridad automatizada.
2. Los refactors de arquitectura no deben cambiar resultados clínicos salvo que el cambio sea explícito, revisado y documentado.
3. UI, impresión, PWA, Farmacia Popular y lógica clínica deben evolucionar como responsabilidades separadas.
4. No se deben persistir datos clínicos identificables del paciente en `localStorage`, `sessionStorage` ni `IndexedDB`.
5. Los umbrales y cálculos clínicos no deben duplicarse en la interfaz: la UI recopila datos, invoca el motor y presenta el resultado.
6. Las capas de interfaz deben comunicarse mediante APIs namespaced y acciones explícitas, no mediante funciones globales que otras capas reemplacen en tiempo de ejecución.
7. Los cambios visuales intencionales deben actualizar explícitamente su baseline visual; un cambio de baseline no debe ocultarse dentro de un refactor no visual.
8. El app shell se publica como una unidad inmutable: no se permiten revisiones manuales independientes por archivo ni actualizaciones parciales dentro de una atención abierta.

## Estado de la Fase 5 — motor clínico separado

La separación del motor clínico crítico se considera completada. `clinical-engine.js` es una dependencia pura, sin DOM ni estado del navegador, y concentra las reglas que determinan resultados clínicos.

Funciones protegidas actualmente:

- `suggestInitialScheme()` — criterio y esquema de inicio;
- `calculateInitialDose()` — dosis inicial y reparto AM/PM;
- `detectDiscordantHighs()` / `analyzeGlucose()` — análisis de HGT manteniendo discordantes en el promedio;
- `classifyHypoglycemia()` — clasificación de hipoglicemia niveles 1, 2 y 3 según el flujo vigente;
- `calculateAdjustment()` — ajuste ±2/±4 UI;
- `calculateSecondDose()` — segunda dosis con límites vigentes;
- `assessDoseSafety()` — contrato estructurado de dosis alta;
- `calculateFollowup()` — resultado integral del seguimiento.

Reglas clínicas que siguen siendo contrato:

- exclusiones: DM1, embarazo, pancreatitis/cirugía pancreática y menores de 18 años;
- inicio NPH dentro del rango 0,1–0,3 UI/kg según el flujo vigente;
- hiperglicemia marcada puede sugerir esquema AM + PM;
- seguimiento basado en promedios de ayunas/pre-noche con ajustes ±2/±4 UI;
- valores altos discordantes se señalan, pero se mantienen en el promedio;
- hipoglicemia: 54–69 mg/dL nivel 1, <54 mg/dL nivel 2 y cualquier hipoglicemia con asistencia nivel 3;
- nivel 3 bloquea el ajuste automático de NPH;
- revisión de dosis alta desde ≥0,7 UI/kg/día y bloqueo de escalamiento automático según el contrato del motor.

## Estado de la Fase 6 — interfaz sin globals legacy

La Fase 6 se considera completada. La aplicación ya no depende de `globalData`, `nav`, `calcularSeguimientoPro`, `generarDocumento`, `finalizar` ni otros puntos de entrada globales sueltos.

La composición actual se realiza así:

- `InsulogRuntime` encapsula estado efímero, utilidades DOM, navegación y registro de acciones;
- `InsulogApp` registra acciones clínicas/UI y expone solo utilidades de presentación necesarias para otras capas;
- `InsulogDocuments` genera el documento base y ofrece un pipeline explícito de enhancers;
- `aps-safety-2026.js` agrega comportamiento mediante `runtime.actions.decorate(...)`;
- `pdf-enhancements.js` se registra con `InsulogDocuments.useEnhancer(...)`;
- `document-flow.js` registra acciones de preparación, vista previa e impresión y decora la acción de cierre;
- `index.html` no contiene JavaScript inline: los controles declaran `data-action` y `app-shell.js` los despacha mediante delegación.

Los únicos exports de aplicación permitidos en `window` son `InsulogRuntime`, `InsulogApp`, `InsulogDocuments` e `InsulogShell`; `InsulogClinicalEngine` permanece como namespace independiente del motor clínico.

## Estado de la Fase 7 — interfaz estabilizada y regresión visual

La Fase 7 queda cerrada como etapa de estabilización visual y de experiencia clínica sin cambio del algoritmo.

### 7A — fundación mobile-first

- `styles.css` concentra tokens, layout, controles, formularios, cards, alertas y tabla HGT;
- viewport móvil ≤760 px ocupa la pantalla de forma nativa y respeta `safe-area-inset`;
- botones clínicos tienen superficie táctil mínima de 50 px y campos principales de 48 px;
- selecciones muestran estado explícito sin depender solo del color;
- existe soporte para `prefers-reduced-motion`;
- el PDF permanece aislado de los estilos de la aplicación.

### 7B — jerarquía y navegación clínica

- P0–P7 conservan IDs técnicos, pero muestran lenguaje clínico en vez de códigos internos;
- P0 prioriza el CTA de inicio y deja fuentes en divulgación progresiva;
- P1 presenta exclusiones como checklist;
- P2 diferencia inicio y seguimiento;
- P3 mantiene los factores 0,1–0,3 UI/kg con referencia plegable;
- P4 separa contexto de dosis y registro HGT e informa el mínimo de tres ayunas;
- la tabla HGT cabe en 390 px sin scroll horizontal interno;
- P41/P5/P6/P7 explicitan revisión de seguridad, resultado, preparación y documento.

Las antiguas revisiones manuales de assets usadas durante Fase 7 son históricas y fueron sustituidas por el fingerprint de Fase 8.

### 7C — regresión visual reproducible

`tests/e2e/visual-contract.spec.js` protege seis estados deterministas: P0, P2 y P4 en móvil 390×844 y escritorio 1440×1000.

El contrato visual usa:

- dHash perceptual de 64 bits almacenado en `tests/e2e/visual-baseline.json`;
- distancia Hamming máxima de 6 bits;
- PNG de cada corrida como artefacto `insulog-visual-contract` durante 14 días;
- `VISUAL_RECORD=1` solo para re-baseline manual e intencional.

Baselines iniciales de Fase 7C:

- `mobile-p0`: `ecf28ee880000000`;
- `mobile-p2`: `d8daceb4b0000000`;
- `mobile-p4`: `93938504859387a0`;
- `desktop-p0`: `3233332323033300`;
- `desktop-p2`: `3333336133033300`;
- `desktop-p4`: `714b4b4b4b433333`.

## Estado de la Fase 8 — documento estable y despliegue atómico

La Fase 8 se considera completada. Su resultado principal es que una atención clínica ya no puede quedar expuesta a una mezcla de versiones del frontend mientras existe un despliegue nuevo.

### Documento/PDF protegido

El documento del paciente mantiene responsabilidades separadas:

- `patient-document.js` define la estructura semántica;
- `pdf-enhancements.js` transforma contenido y pautas para el paciente;
- `document-flow.css` controla aislamiento, host de vista previa e impresión;
- `pdf-enhancements.css` conserva estructura específica del documento;
- `pdf-design-2026.css` es la autoridad visual final de la hoja Letter.

Contratos actuales:

- P6 solo prepara el documento;
- P7 contiene el iframe aislado;
- el `#pdf` de staging permanece fuera de `<main>` y oculto en la aplicación;
- el nombre del paciente es obligatorio antes de generar;
- la hoja de seguimiento conserva 15 filas HGT;
- no se permiten workarounds de `zoom`, escalamiento artificial ni clipping para forzar una página;
- E2E valida que el documento protegido imprima en una sola hoja Letter y mantenga legibilidad mínima.

### 8D — app shell inmutable

`sw.js` trata cada release como una unidad atómica.

Contrato del service worker:

- durante `install` descarga de forma fresca el app shell completo;
- si un recurso crítico no puede prepararse, la versión nueva no queda lista;
- no se utiliza `skipWaiting()`;
- no se utiliza `clients.claim()`;
- una pestaña/atención ya abierta continúa bajo su service worker anterior;
- los caches antiguos solo se eliminan durante la activación de la nueva versión;
- recursos del shell se sirven desde el cache correspondiente a esa versión y no se refrescan archivo por archivo durante `fetch`;
- `index.html` y `pdf-preview.html` se resuelven contra el mismo release;
- `data/farmacia-cerro-navia.json` permanece dinámico, `no-store` y fuera del app shell.

`scripts/check_atomic_shell.py` protege este contrato y falla si reaparecen mecanismos de actualización parcial o múltiples versiones cacheadas del mismo path.

### 8E — fingerprint reproducible de release

El versionado manual por archivo quedó eliminado. El release del app shell se identifica con una sola huella SHA-256 truncada a 16 caracteres, calculada a partir de los archivos que definen la aplicación offline.

Archivo canónico: `scripts/app_shell_release.py`.

El script incluye 23 archivos del shell y normaliza antes de calcular la huella:

- query strings `?v=` de `index.html`, `pdf-preview.html` y `sw.js`;
- `CACHE_NAME` del service worker;
- `DEPLOYMENT_REVISION`.

Esto hace que la operación sea idempotente y evita un hash circular.

El release con el que se cerró Fase 8 es:

`6541e98e8168e945`

Ese token aparece de forma coherente en:

- URLs versionadas de assets de la aplicación;
- URLs de la vista PDF;
- manifest e iconos cacheados;
- `CACHE_NAME = "insulog-shell-<fingerprint>"`;
- `DEPLOYMENT_REVISION = "release-<fingerprint>"`.

El fingerprint no es un número de versión clínico ni debe escribirse manualmente.

### Procedimiento obligatorio para futuros releases del shell

Cuando un cambio modifica cualquiera de los archivos incluidos por `SHELL_FILES`:

1. realizar el cambio funcional/visual;
2. ejecutar `python scripts/app_shell_release.py --write`;
3. ejecutar `python scripts/app_shell_release.py` para validar que el release quedó canónico;
4. ejecutar `python scripts/check_atomic_shell.py`;
5. ejecutar la red de seguridad correspondiente;
6. revisar cualquier cambio visual intencional y su baseline;
7. fusionar solo con CI verde.

`python scripts/app_shell_release.py --print` sirve para inspeccionar el fingerprint calculado sin modificar archivos.

No se deben volver a editar a mano revisiones individuales tipo `?v=2026...`, contadores `atomicXX` ni revisiones de despliegue independientes.

## Mapa actual de responsabilidades

| Área | Archivo principal | Responsabilidad actual | Riesgo de acoplamiento |
| --- | --- | --- | --- |
| Motor clínico puro | `clinical-engine.js` | Inicio NPH, análisis HGT, hipoglicemia, ajustes, segunda dosis, seguimiento y seguridad de dosis | Bajo mientras permanezca sin DOM y cubierto por regresión |
| Runtime | `app-runtime.js` | Estado efímero, navegación, utilidades DOM y action registry | Bajo |
| Adaptador clínico/UI | `app.js` | Inputs, llamada al motor, estado y presentación | Bajo-medio |
| Sistema visual | `styles.css` | Layout desktop/mobile, formularios, jerarquía y tabla HGT | Bajo mientras conserve IDs/DOM funcional |
| Regresión visual | `tests/e2e/visual-contract.spec.js`, `visual-baseline.json` | Contrato perceptual P0/P2/P4 | Bajo; re-baseline solo ante cambio revisado |
| Capa APS 2026 | `aps-safety-2026.js` | Formulario farmacológico y seguridad mediante decoradores | Bajo-medio |
| Shell de aplicación | `app-shell.js` | Inicialización, eventos y registro del service worker | Bajo |
| Documento clínico | `patient-document.js` | Construcción semántica y pipeline de enhancers | Bajo-medio |
| Enhancer PDF | `pdf-enhancements.js` | Pautas, medicamentos y tabla HGT | Bajo-medio |
| Flujo documento | `document-flow.js` | P6 → P7, validación e impresión | Bajo |
| Diseño PDF | `document-flow.css`, `pdf-enhancements.css`, `pdf-design-2026.css` | Aislamiento, estructura y diseño Letter | Medio; varias capas con autoridad delimitada |
| Farmacia Popular | `farmacia-popular.js`, `farmacia-popular.css` | Precio/stock informativo desacoplado del algoritmo | Bajo |
| Datos farmacia | `data/farmacia-cerro-navia.json` | Snapshot dinámico público | Bajo |
| Sincronización farmacia | `scripts/update_farmacia_cerro_navia.py` + workflow | Consulta, normaliza, valida y publica datos | Bajo respecto de clínica |
| PWA/cache | `sw.js` | Release inmutable y offline coherente | Bajo-medio mientras conserve el contrato de Fase 8D |
| Release del shell | `scripts/app_shell_release.py` | Fingerprint único, escritura y validación de tokens | Bajo; fuente única de versionado |
| Guardrail PWA | `scripts/check_atomic_shell.py` | Unicidad de assets y prohibición de actualización parcial | Bajo |
| HTML shell | `index.html` | Pantallas P0–P7 y acciones declarativas | Bajo-medio |

## Flujos que se consideran contrato

### Inicio de insulina

`P0 → P1 → P2 → P2.5 → P3 → P5 → P6 → P7`

- exclusiones permanecen fuera del algoritmo APS;
- hiperglicemia marcada sin alto riesgo puede llevar a NPH AM + PM;
- alto riesgo de hipoglicemia mantiene inicio conservador;
- tratamiento concomitante no cambia automáticamente el cálculo NPH;
- el cálculo proviene de `clinical-engine.js`;
- la UI usa acciones explícitas, sin handlers inline ni globals legacy.

### Seguimiento

`P0 → P1 → P2 → P3.5 → P4 → P5 → P6 → P7`

- 15 filas HGT;
- mínimo tres ayunas para ajuste;
- ajuste PM guiado por ayunas;
- discordantes altos se señalan y permanecen en el promedio;
- alerta de hipoglicemia aparece al solicitar ajuste, no mientras se escribe;
- nivel 1/2 se clasifica en el motor y nivel 3 requiere confirmación de asistencia;
- nivel 3 no realiza ajuste automático de NPH;
- exclusividad farmacológica vigente se conserva;
- tabla utilizable sin scroll horizontal interno en 390 px.

### Documento

- P6 prepara y P7 previsualiza;
- el PDF visible vive en iframe aislado;
- el staging no invade el `<main>` de la aplicación;
- el nombre es obligatorio;
- `InsulogDocuments.generate()` construye el documento y luego aplica enhancers;
- la salida protegida imprime en Letter sin compresión ilegible.

### Farmacia Popular

- el frontend consume `data/farmacia-cerro-navia.json` sin modificar la dosis NPH;
- una dosis seleccionada no puede caer silenciosamente a otra presentación;
- presentaciones nuevas no mapeadas requieren revisión clínica;
- el JSON dinámico no se incorpora al release inmutable del PWA.

## Red de seguridad actual

La suite protege cinco niveles complementarios:

1. **Contrato unitario del motor:** límites y estructuras de retorno.
2. **Matriz de regresión clínica:** inicio, ajustes, hipoglicemia, discordantes y dosis alta.
3. **E2E funcional con Chromium:** flujo real, arquitectura, privacidad, Farmacia Popular, móvil y documento.
4. **Contrato visual perceptual:** seis estados P0/P2/P4 móvil/escritorio con dHash y PNG.
5. **Contrato de release/PWA:** fingerprint canónico, app shell único y prueba real de funcionamiento offline.

La suite E2E vigente ejecuta 30 casos y cubre, entre otros:

- arranque sin excepciones JS;
- namespaces explícitos y ausencia de globals legacy;
- exclusiones clínicas;
- inicio NPH estándar y conservador;
- 15 HGT;
- ajuste PM conocido;
- discordante alto mantenido en el promedio;
- hipoglicemia niveles 1, 2 y 3;
- bloqueo de ajuste automático ante nivel 3;
- exclusividad farmacológica;
- Farmacia Popular;
- separación P6/P7;
- PDF Letter legible de una página en el caso protegido;
- no persistencia del nombre del paciente;
- ausencia de overflow horizontal básico en móvil;
- contrato visual P0/P2/P4;
- instalación del service worker, unicidad del cache y navegación app/PDF offline.

## Invariantes de arquitectura, UX y despliegue

`scripts/check_invariants.py`, `scripts/check_atomic_shell.py`, `scripts/app_shell_release.py` y la suite E2E deben impedir, entre otras regresiones:

- DOM, navegación o almacenamiento dentro de `clinical-engine.js`;
- duplicación de umbrales clínicos en UI;
- reaparición de `globalData`, `nav` o wrappers clínicos globales;
- `onclick`, `onchange` u `oninput` inline en `index.html`;
- monkey patches de funciones clínicas/documentales;
- reclasificación bioquímica de hipoglicemia directamente en UI;
- exports globales no autorizados;
- persistencia de datos identificables del paciente;
- transformaciones de JavaScript clínico desde el service worker;
- `skipWaiting()` o `clients.claim()` en el release clínico actual;
- actualización parcial del app shell durante `fetch`;
- dos versiones cacheadas del mismo path dentro de un release;
- divergencia entre fingerprint calculado, URLs del shell, cache y deployment revision;
- incorporación accidental del JSON dinámico de Farmacia Popular al cache inmutable;
- pérdida de tamaños táctiles, mobile-first o movimiento reducido;
- hacks de `zoom`, escalamiento o overflow forzado;
- cambios visuales significativos sin re-baseline explícito y revisado.

## Deuda técnica para fases posteriores

1. Validar la experiencia final en Safari iOS/PWA real y al menos un dispositivo/viewport Android además de Chromium emulado.
2. Consolidar progresivamente las capas CSS del PDF si puede hacerse sin perder la autoridad visual y los guardrails actuales.
3. Reducir el acoplamiento directo al DOM de `app.js` y `aps-safety-2026.js` mediante componentes/controladores pequeños cuando aporte valor concreto.
4. Ampliar el contrato visual a estados dinámicos de alto valor —hipoglicemia, dosis alta y nota clínica— cuando su presentación quede suficientemente estable.
5. Versionar explícitamente el protocolo clínico y asociar cada modificación clínica a una matriz revisada de casos esperados.
6. Separar progresivamente la generación de texto clínico de la manipulación DOM cuando aporte valor, sin reabrir reglas estabilizadas.
7. Evaluar módulos ES nativos solo si entregan una ventaja concreta; no son necesarios para mantener la separación actual.

El versionado manual del app shell deja de considerarse deuda: quedó resuelto en Fase 8.

## Regla de aceptación para refactors futuros

Un PR de refactor no clínico debe:

- pasar checks estáticos y guardrails específicos;
- pasar `Insulog E2E safety net` cuando toque superficies cubiertas;
- no modificar resultados de casos clínicos de referencia;
- no introducir persistencia de datos de paciente;
- mantener `clinical-engine.js` libre de dependencias del navegador;
- conservar action registry y APIs namespaced;
- mantener `index.html` libre de JavaScript inline;
- conservar el contrato mobile-first;
- actualizar `visual-baseline.json` solo ante cambio visual intencional y revisado;
- si modifica un archivo de `SHELL_FILES`, ejecutar `python scripts/app_shell_release.py --write` y versionar el fingerprint resultante;
- conservar el shell inmutable y la prueba offline;
- explicar qué responsabilidad mueve y qué deuda técnica elimina.

Cualquier cambio intencional de dosis, umbral, criterio o conducta clínica debe tratarse como cambio clínico explícito, no como refactor, y debe actualizar primero sus casos esperados y documentación de protocolo.

## Cierre de Fase 8

Fase 8 queda cerrada con dos garantías operativas nuevas:

1. **coherencia durante la atención:** una pestaña abierta permanece sobre una única versión completa del frontend;
2. **coherencia durante el desarrollo:** una modificación del shell produce un único fingerprint reproducible que CI puede verificar.

Con estas garantías, el próximo trabajo de producto puede avanzar sobre UX real en dispositivos, protocolo clínico o modularización del DOM sin volver a mantener contadores de cache o `?v=` manuales.
