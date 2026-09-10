# Insulog APS — baseline de ingeniería

Este documento fija el estado técnico que debe protegerse antes de cualquier refactor importante. Su objetivo es separar responsabilidades, declarar invariantes y evitar que cambios visuales, de PWA o de PDF alteren inadvertidamente la lógica clínica.

## Principio de trabajo

1. Primero debe quedar verde la red de seguridad E2E.
2. Los refactors de arquitectura no deben cambiar resultados clínicos salvo que el cambio sea explícito, revisado y documentado.
3. UI, impresión, PWA, Farmacia Popular y lógica clínica deben evolucionar como responsabilidades separadas.
4. No se deben persistir datos clínicos identificables del paciente en localStorage, sessionStorage ni IndexedDB.
5. Los umbrales y cálculos clínicos no deben duplicarse en la interfaz: la UI recopila datos, invoca el motor y presenta el resultado.
6. Las capas de interfaz deben comunicarse mediante APIs namespaced y acciones explícitas, no mediante funciones globales que otras capas reemplacen en tiempo de ejecución.
7. Los cambios visuales intencionales deben actualizar explícitamente su baseline visual; un cambio de baseline no debe ocultarse dentro de un refactor no visual.

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

## Estado de la Fase 6 — interfaz sin globals legacy

La Fase 6 se considera completada. La aplicación ya no depende de `globalData`, `nav`, `calcularSeguimientoPro`, `generarDocumento`, `finalizar` ni otros puntos de entrada globales sueltos.

La composición actual se realiza así:

- `InsulogRuntime` encapsula estado efímero, utilidades DOM, navegación y el registro de acciones;
- `InsulogApp` registra las acciones clínicas/UI y expone solo utilidades de presentación necesarias para otras capas;
- `InsulogDocuments` genera el documento base y ofrece un pipeline explícito de enhancers;
- `aps-safety-2026.js` agrega comportamiento mediante `runtime.actions.decorate(...)` en vez de reemplazar funciones de `window`;
- `pdf-enhancements.js` se registra con `InsulogDocuments.useEnhancer(...)` en vez de envolver `window.generarDocumento`;
- `document-flow.js` registra acciones de preparación, vista previa e impresión y decora la acción de cierre;
- `index.html` no contiene JavaScript inline: los controles declaran `data-action` y `app-shell.js` los despacha mediante delegación de eventos.

Los únicos exports de aplicación permitidos en `window` son APIs namespaced: `InsulogRuntime`, `InsulogApp`, `InsulogDocuments` e `InsulogShell`; `InsulogClinicalEngine` permanece como el namespace independiente del motor clínico.

## Estado de la Fase 7A — fundación visual mobile-first

La primera parte de la Fase 7 está completada. Esta etapa modifica presentación y ergonomía, pero no cambia reglas clínicas, IDs funcionales ni flujos protegidos.

Contratos visuales actuales:

- `styles.css` es la hoja base única de la interfaz clínica y concentra tokens, espaciado, tipografía, controles, cards, alertas, formularios y tabla de seguimiento;
- en escritorio, la aplicación mantiene un shell centrado con superficie y jerarquía visual clara;
- en viewport móvil (≤760 px), la aplicación ocupa la pantalla completa, elimina bordes/sombras del contenedor y respeta `safe-area-inset`;
- botones clínicos tienen superficie táctil mínima de 50 px y los campos principales de 48 px;
- selecciones clínicas presentan un estado visual explícito sin depender solo del color;
- existe soporte para `prefers-reduced-motion`;
- el PDF continúa aislado en su iframe y mantiene sus estilos de impresión específicos.

## Estado de la Fase 7B — jerarquía y navegación clínica

La segunda parte de la Fase 7 se considera completada. P0–P7 mantienen los mismos IDs y acciones funcionales, pero la interfaz visible deja de exponer la nomenclatura interna del prototipo y prioriza la tarea clínica de cada pantalla.

Contratos de experiencia actuales:

- los rótulos visibles usan lenguaje clínico (`Seguridad`, `Inicio`, `Seguimiento`, `Resultado`, `Documento`) en vez de códigos `[P0]`–`[P7]`;
- la pantalla dinámica P2.5 conserva su ID técnico, pero muestra `Inicio · tratamiento actual` mediante la capa visual;
- P0 prioriza el CTA de inicio y deja fuentes clínicas en divulgación progresiva mediante `details`;
- P1 presenta las exclusiones como checklist antes de la decisión Sí/No;
- P2 explica claramente la diferencia entre inicio y seguimiento y mantiene visible la advertencia de suspensión de glibenclamida;
- P3 mantiene los factores 0,1–0,3 UI/kg, pero su referencia extensa queda plegable para reducir carga visual;
- P4 separa contexto de dosis y registro HGT, informa el mínimo de 3 ayunas y permite días sin dato;
- en 390 px la tabla HGT usa ancho nativo (`table-layout: fixed`) y no requiere scroll horizontal interno;
- existen acciones `VOLVER` secundarias en puntos donde el destino previo es inequívoco, sin alterar el flujo principal;
- P41, P5, P6 y P7 expresan explícitamente revisión de seguridad, resultado, preparación y vista previa;
- el asset visual está versionado como `styles.css?v=20260910-2` y el shell PWA correspondiente como `atomic24`;
- `tests/e2e/mobile-layout.spec.js` verifica la jerarquía de portada y mide en navegador real que la tabla HGT no exceda su contenedor a 390×844.

Fase 7B no modifica `clinical-engine.js`, las reglas de NPH, hipoglicemia, dosis alta, Farmacia Popular ni la generación semántica del documento del paciente.

## Estado de la Fase 7C — regresión visual reproducible

La tercera parte de la Fase 7 se considera completada. La interfaz estabilizada en 7A–7B cuenta ahora con un contrato visual automatizado que complementa, pero no reemplaza, los E2E funcionales y clínicos.

El contrato visual vigente es:

- `tests/e2e/visual-contract.spec.js` captura estados deterministas con animaciones desactivadas y cursor oculto;
- `tests/e2e/visual-baseline.json` guarda una huella perceptual dHash de 64 bits por estado, en formato textual y revisable en Git;
- se protegen P0, P2 y P4 en móvil 390×844 y escritorio 1440×1000, para un total de seis estados de referencia;
- cada ejecución compara la nueva huella con el baseline mediante distancia Hamming y tolerancia máxima explícita de 6 bits sobre 64;
- el workflow `Insulog E2E safety net` publica además los seis PNG de la corrida como artefacto `insulog-visual-contract` durante 14 días, para inspección humana cuando exista una diferencia;
- `VISUAL_RECORD=1` permanece como mecanismo manual e intencional de re-baseline; no está activo en CI normal;
- cambiar deliberadamente el aspecto de una pantalla protegida exige revisar la captura y actualizar su hash de referencia en el mismo PR;
- una variación visual inesperada debe investigarse antes de ampliar tolerancias o aceptar un nuevo baseline.

Baselines iniciales de Fase 7C:

- `mobile-p0`: `ecf28ee880000000`;
- `mobile-p2`: `d8daceb4b0000000`;
- `mobile-p4`: `93938504859387a0`;
- `desktop-p0`: `3233332323033300`;
- `desktop-p2`: `3333336133033300`;
- `desktop-p4`: `714b4b4b4b433333`.

Fase 7C no modifica código clínico, cálculos NPH, clasificación de hipoglicemia, Farmacia Popular ni el documento del paciente. Con 7A, 7B y 7C completadas, la Fase 7 queda cerrada como etapa de estabilización de interfaz mobile-first, jerarquía clínica y regresión visual.

## Mapa actual de responsabilidades

| Área | Archivo principal | Responsabilidad actual | Riesgo de acoplamiento |
| --- | --- | --- | --- |
| Motor clínico puro | `clinical-engine.js` | Inicio NPH, análisis HGT, hipoglicemia, ajustes, segunda dosis, seguimiento y seguridad de dosis | Bajo mientras permanezca sin DOM y cubierto por regresión |
| Runtime | `app-runtime.js` | Estado efímero, navegación, utilidades DOM y registro/decoración/invocación de acciones | Bajo |
| Adaptador clínico/UI | `app.js` | Lectura y validación de inputs, llamada al motor, actualización de estado y presentación de resultados | Bajo-medio |
| Sistema visual de app | `styles.css` | Tokens, layout desktop/mobile, controles, formularios, jerarquía de pantallas, navegación secundaria, tabla HGT y nota clínica | Bajo mientras conserve IDs/DOM funcional y pase E2E |
| Regresión visual | `tests/e2e/visual-contract.spec.js`, `visual-baseline.json` | Capturas P0/P2/P4, dHash, tolerancia y detección de cambios visuales no intencionales | Bajo; actualizar baseline solo ante cambio visual revisado |
| Capa APS 2026 | `aps-safety-2026.js` | Formulario farmacológico, interacción de seguridad, confirmación de asistencia y normalización de nota mediante decoradores explícitos | Bajo-medio |
| Shell de aplicación | `app-shell.js` | Inicialización, delegación de `data-action`, feedback de controles y registro del service worker | Bajo |
| Documento clínico | `patient-document.js` | Construcción semántica del documento y pipeline de enhancers | Bajo-medio |
| Enhancer de PDF | `pdf-enhancements.js` | Transformación del documento para el paciente, tabla HGT, pautas y densidad | Medio |
| Flujo documento | `document-flow.js` | P6 preparación → P7 vista previa aislada, validación de nombre e impresión | Bajo |
| Estilos de impresión | `document-flow.css`, `pdf-enhancements.css`, `pdf-design-2026.css` | Maquetación del documento de paciente | Medio: varias capas CSS siguen afectando el mismo resultado |
| Farmacia Popular | `farmacia-popular.js`, `farmacia-popular.css` | Presenta precio/stock de datos sincronizados | Bajo mientras permanezca desacoplado del algoritmo |
| Datos de farmacia | `data/farmacia-cerro-navia.json` | Snapshot público de precios, stock y discovery | Bajo |
| Sincronización farmacia | `scripts/update_farmacia_cerro_navia.py` + workflow | Consulta, normaliza, valida y publica datos | Bajo respecto de clínica |
| PWA/cache | `sw.js` | Caché y actualización atómica del app shell | Medio: debe versionarse junto con cambios de assets ejecutables o visuales relevantes |
| HTML shell | `index.html` | Pantallas P0–P7, contenido visible y declaración semántica de acciones | Bajo-medio |

## Flujos que se consideran contrato

### Inicio de insulina

`P0 → P1 → P2 → P2.5 (tratamiento) → P3 (dosis) → P5 (nota) → P6 (preparación) → P7 (documento)`

Contratos protegidos:

- exclusiones permanecen fuera del algoritmo APS;
- hiperglicemia marcada sin alto riesgo puede llevar a NPH AM + PM;
- alto riesgo de hipoglicemia mantiene inicio conservador;
- el tratamiento concomitante no cambia automáticamente el cálculo NPH;
- el cálculo clínico de inicio proviene de `clinical-engine.js`;
- la UI dispara el flujo mediante acciones explícitas, sin `onclick` ni funciones globales legacy.

### Seguimiento

`P0 → P1 → P2 → P3.5 (tratamiento) → P4 (15 HGT) → P5 (nota) → P6 → P7`

Contratos protegidos:

- 15 filas de seguimiento;
- mínimo 3 glicemias de ayuno para ajuste;
- ajuste PM guiado por ayunas;
- valores altos discordantes se señalan, pero se mantienen en el promedio automáticamente;
- hipoglicemia no muestra alerta mientras se escribe: aparece al solicitar ajuste;
- nivel 1/2 se clasifica en el motor y nivel 3 se activa cuando el usuario confirma que el episodio requirió asistencia;
- ante nivel 3 no se realiza ajuste automático de NPH;
- exclusividad farmacológica actual se conserva;
- la capa APS compone el flujo mediante decoradores del action registry y no mediante monkey patches globales;
- la tabla de captura debe permanecer utilizable sin scroll horizontal interno en 390 px.

### Documento

- P6 contiene datos y elección de documento, no la vista previa.
- P7 contiene el iframe de vista previa aislada y no contiene el `#pdf` imprimible del documento padre.
- el `#pdf` de staging vive fuera de `<main>` y permanece oculto en la aplicación.
- el nombre es obligatorio antes de generar documento.
- el documento se construye mediante `InsulogDocuments.generate()` y sus enhancers registrados.
- el documento de paciente debe imprimir en una sola hoja Letter.

### Farmacia Popular

- el frontend consume `data/farmacia-cerro-navia.json` sin usarlo para modificar dosis NPH;
- una presentación seleccionada no puede caer silenciosamente a otra dosis;
- nuevas presentaciones no mapeadas requieren revisión clínica antes de entrar al selector.

## Red de seguridad actual

La suite de pruebas protege cuatro niveles complementarios:

1. **Contrato unitario del motor:** límites y estructuras de retorno.
2. **Matriz de regresión clínica:** casos sintéticos de inicio, ajustes, intensificación, hipoglicemia, discordantes y dosis alta.
3. **E2E funcional con Chromium:** flujo real desde interfaz hasta nota/documento, arquitectura de Fase 6 y comportamiento mobile-first de Fase 7.
4. **Contrato visual perceptual:** seis capturas P0/P2/P4 en móvil y escritorio, comparadas contra dHash versionados y acompañadas de PNG de diagnóstico.

Entre los escenarios de navegador protegidos están:

- arranque sin excepciones JS;
- disponibilidad de `InsulogRuntime`, `InsulogApp`, `InsulogDocuments` e `InsulogShell`;
- ausencia de handlers inline y de globals legacy (`nav`, `globalData`, `calcularSeguimientoPro`, `generarDocumento`, `finalizar`);
- navegación y estado mediante runtime;
- exclusiones;
- inicio NPH estándar y conservador;
- creación de 15 HGT;
- ajuste PM conocido;
- glicemia discordante que permanece en el promedio y conserva su efecto sobre dosis;
- hipoglicemia nivel 1 y nivel 2;
- hipoglicemia con asistencia que pasa a nivel 3 sin ajuste automático;
- exclusividad farmacológica;
- carga de Farmacia Popular;
- separación P6/P7;
- PDF de una sola página Letter;
- no persistencia del nombre del paciente;
- ausencia de overflow horizontal básico en viewport móvil;
- portada sin código interno visible y fuentes clínicas plegadas por defecto;
- tabla HGT sin scroll horizontal interno en viewport 390×844;
- estabilidad perceptual de P0, P2 y P4 en móvil y escritorio.

## Invariantes de arquitectura y UX

`scripts/check_invariants.py` y la suite E2E deben impedir, entre otras regresiones:

- acceso al DOM, navegación o almacenamiento desde `clinical-engine.js`;
- duplicación de umbrales clínicos en la UI;
- reaparición de `globalData`, `nav` o adaptadores clínicos globales;
- reaparición de `onclick`, `onchange` u `oninput` inline en `index.html`;
- sobrescrituras de `window.calcularSeguimientoPro`, `window.generarDocumento`, `window.finalizar` u otros wrappers legacy;
- reaparición del monkey patch `window.analizarGlicemias`;
- reclasificación bioquímica de hipoglicemia directamente en la UI;
- exports globales de aplicación distintos de los namespaces autorizados;
- persistencia de datos identificables del paciente;
- transformaciones de JavaScript clínico desde el service worker;
- mezcla de revisiones PWA al publicar nuevos assets ejecutables;
- pérdida de tamaños táctiles, breakpoint mobile-first o soporte de movimiento reducido;
- uso de workarounds de `zoom` o scroll horizontal forzado;
- pérdida de los rótulos clínicos, divulgación progresiva, navegación secundaria o contrato de tabla HGT nativa definidos en Fase 7B;
- cambios visuales significativos en estados protegidos sin actualización explícita y revisada del baseline de Fase 7C.

## Deuda técnica para fases posteriores

1. Consolidar las múltiples capas CSS del PDF en un sistema de impresión más simple y predecible.
2. Simplificar el versionado del app shell/PWA para evitar repetir manualmente revisiones de assets en HTML, service worker y checks.
3. Reducir el acoplamiento directo al DOM de `app.js` y `aps-safety-2026.js` mediante componentes/controladores pequeños cuando eso facilite cambios futuros.
4. Validar la experiencia final en Safari iOS/PWA y al menos un viewport Android además de Chromium emulado.
5. Ampliar el contrato visual a estados dinámicos de alto valor —hipoglicemia, dosis alta y nota clínica— cuando su presentación quede suficientemente estable.
6. Versionar explícitamente el protocolo clínico y asociar cada futura modificación clínica a una matriz de casos esperados revisada.
7. Separar progresivamente la generación de texto clínico de la manipulación DOM cuando aporte valor, sin reabrir reglas ya estabilizadas.
8. Evaluar migración futura a módulos ES nativos solo cuando aporte una ventaja concreta; no es necesaria para mantener la separación actual.

## Regla de aceptación para refactors futuros

Un PR de refactor no clínico debe:

- pasar los checks estáticos existentes;
- pasar `Insulog E2E safety net`, incluida la regresión visual cuando el PR toca superficies protegidas;
- no modificar resultados de los casos clínicos de referencia;
- no introducir persistencia de datos de paciente;
- mantener `clinical-engine.js` libre de dependencias del navegador;
- conservar el action registry y las APIs namespaced sin introducir globals sueltos;
- mantener `index.html` libre de JavaScript inline;
- conservar el contrato mobile-first y la tabla HGT sin depender de zoom o hacks de overflow;
- actualizar `visual-baseline.json` solo cuando el cambio visual sea intencional, revisado y explicado en el PR;
- explicar qué responsabilidad mueve y qué deuda técnica elimina.

Cualquier cambio intencional de dosis, umbral, criterio o conducta clínica debe tratarse como cambio clínico explícito, no como refactor, y debe actualizar primero sus casos esperados y documentación de protocolo.
