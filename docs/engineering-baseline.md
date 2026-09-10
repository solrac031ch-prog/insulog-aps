# Insulog APS — baseline de ingeniería

Este documento fija el estado técnico que debe protegerse antes de cualquier refactor importante. Su objetivo es separar responsabilidades, declarar invariantes y evitar que cambios visuales, de PWA o de PDF alteren inadvertidamente la lógica clínica.

## Principio de trabajo

1. Primero debe quedar verde la red de seguridad E2E.
2. Los refactors de arquitectura no deben cambiar resultados clínicos salvo que el cambio sea explícito, revisado y documentado.
3. UI, impresión, PWA, Farmacia Popular y lógica clínica deben evolucionar como responsabilidades separadas.
4. No se deben persistir datos clínicos identificables del paciente en localStorage, sessionStorage ni IndexedDB.
5. Los umbrales y cálculos clínicos no deben duplicarse en la interfaz: la UI recopila datos, invoca el motor y presenta el resultado.
6. Las capas de interfaz deben comunicarse mediante APIs namespaced y acciones explícitas, no mediante funciones globales que otras capas reemplacen en tiempo de ejecución.

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

## Mapa actual de responsabilidades

| Área | Archivo principal | Responsabilidad actual | Riesgo de acoplamiento |
| --- | --- | --- | --- |
| Motor clínico puro | `clinical-engine.js` | Inicio NPH, análisis HGT, hipoglicemia, ajustes, segunda dosis, seguimiento y seguridad de dosis | Bajo mientras permanezca sin DOM y cubierto por regresión |
| Runtime | `app-runtime.js` | Estado efímero, navegación, utilidades DOM y registro/decoración/invocación de acciones | Bajo |
| Adaptador clínico/UI | `app.js` | Lectura y validación de inputs, llamada al motor, actualización de estado y presentación de resultados | Bajo-medio |
| Capa APS 2026 | `aps-safety-2026.js` | Formulario farmacológico, interacción de seguridad, confirmación de asistencia y normalización de nota mediante decoradores explícitos | Bajo-medio |
| Shell de aplicación | `app-shell.js` | Inicialización, delegación de `data-action`, feedback de controles y registro del service worker | Bajo |
| Documento clínico | `patient-document.js` | Construcción semántica del documento y pipeline de enhancers | Bajo-medio |
| Enhancer de PDF | `pdf-enhancements.js` | Transformación del documento para el paciente, tabla HGT, pautas y densidad | Medio |
| Flujo documento | `document-flow.js` | P6 preparación → P7 vista previa aislada, validación de nombre e impresión | Bajo |
| Estilos de impresión | `document-flow.css`, `pdf-enhancements.css`, `pdf-design-2026.css` | Maquetación del documento de paciente | Medio: varias capas CSS siguen afectando el mismo resultado |
| Farmacia Popular | `farmacia-popular.js`, `farmacia-popular.css` | Presenta precio/stock de datos sincronizados | Bajo mientras permanezca desacoplado del algoritmo |
| Datos de farmacia | `data/farmacia-cerro-navia.json` | Snapshot público de precios, stock y discovery | Bajo |
| Sincronización farmacia | `scripts/update_farmacia_cerro_navia.py` + workflow | Consulta, normaliza, valida y publica datos | Bajo respecto de clínica |
| PWA/cache | `sw.js` | Caché y actualización atómica del app shell | Medio: debe versionarse junto con cambios de assets ejecutables |
| HTML shell | `index.html` | Pantallas P0–P7 y declaración semántica de acciones | Bajo-medio |

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
- la capa APS compone el flujo mediante decoradores del action registry y no mediante monkey patches globales.

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

La suite de pruebas protege tres niveles:

1. **Contrato unitario del motor:** límites y estructuras de retorno.
2. **Matriz de regresión clínica:** casos sintéticos de inicio, ajustes, intensificación, hipoglicemia, discordantes y dosis alta.
3. **E2E con Chromium:** flujo real desde interfaz hasta nota/documento y verificación de la arquitectura de Fase 6.

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
- ausencia de overflow horizontal básico en viewport móvil.

## Invariantes de arquitectura

`scripts/check_invariants.py` debe impedir, entre otras regresiones:

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
- mezcla de revisiones PWA al publicar nuevos assets ejecutables.

## Deuda técnica para fases posteriores

1. Consolidar las múltiples capas CSS del PDF en un sistema de impresión más simple y predecible.
2. Simplificar el versionado del app shell/PWA para evitar repetir manualmente revisiones de assets en HTML, service worker y checks.
3. Reducir el acoplamiento directo al DOM de `app.js` y `aps-safety-2026.js` mediante componentes/controladores pequeños cuando eso facilite cambios visuales futuros.
4. Incorporar pruebas visuales con snapshots una vez que el diseño estable sea aprobado.
5. Versionar explícitamente el protocolo clínico y asociar cada futura modificación clínica a una matriz de casos esperados revisada.
6. Separar progresivamente la generación de texto clínico de la manipulación DOM cuando aporte valor, sin reabrir reglas ya estabilizadas.
7. Evaluar migración futura a módulos ES nativos solo cuando aporte una ventaja concreta; no es necesaria para mantener la separación actual.

## Regla de aceptación para refactors futuros

Un PR de refactor no clínico debe:

- pasar los checks estáticos existentes;
- pasar `Insulog E2E safety net`;
- no modificar resultados de los casos clínicos de referencia;
- no introducir persistencia de datos de paciente;
- mantener `clinical-engine.js` libre de dependencias del navegador;
- conservar el action registry y las APIs namespaced sin introducir globals sueltos;
- mantener `index.html` libre de JavaScript inline;
- explicar qué responsabilidad mueve y qué deuda técnica elimina.

Cualquier cambio intencional de dosis, umbral, criterio o conducta clínica debe tratarse como cambio clínico explícito, no como refactor, y debe actualizar primero sus casos esperados y documentación de protocolo.
