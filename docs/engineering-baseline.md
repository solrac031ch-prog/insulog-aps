# Insulog APS — baseline de ingeniería

Este documento fija el estado técnico que debe protegerse antes de cualquier refactor importante. Su objetivo es separar responsabilidades, declarar invariantes y evitar que cambios visuales, de PWA o de PDF alteren inadvertidamente la lógica clínica.

## Principio de trabajo

1. Primero debe quedar verde la red de seguridad E2E.
2. Los refactors de arquitectura no deben cambiar resultados clínicos salvo que el cambio sea explícito, revisado y documentado.
3. UI, impresión, PWA, Farmacia Popular y lógica clínica deben evolucionar como responsabilidades separadas.
4. No se deben persistir datos clínicos identificables del paciente en localStorage, sessionStorage ni IndexedDB.
5. Los umbrales y cálculos clínicos no deben duplicarse en la interfaz: la UI recopila datos, invoca el motor y presenta el resultado.

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

`app.js` funciona como adaptador de interfaz: valida entradas, transforma controles DOM en datos, llama al motor y renderiza el resultado. `aps-safety-2026.js` mantiene interacción, formulario farmacológico, confirmación de asistencia en hipoglicemia y normalización de presentación, pero ya no redefine `analizarGlicemias` ni contiene los umbrales bioquímicos de clasificación de hipoglicemia.

## Mapa actual de responsabilidades

| Área | Archivo principal | Responsabilidad actual | Riesgo de acoplamiento |
| --- | --- | --- | --- |
| Motor clínico puro | `clinical-engine.js` | Inicio NPH, análisis HGT, hipoglicemia, ajustes, segunda dosis, seguimiento y seguridad de dosis | Bajo mientras permanezca sin DOM y cubierto por regresión |
| Adaptador clínico/UI | `app.js` | Lectura/validación de inputs, llamada al motor, estado efímero y presentación de resultados | Medio-bajo |
| Capa APS 2026 | `aps-safety-2026.js` | Formulario farmacológico, interacción de seguridad, confirmación de asistencia y normalización de nota | Medio: aún envuelve algunos puntos de entrada globales, pero no calcula los umbrales extraídos |
| Runtime/navegación | `app-runtime.js` | Estado efímero, navegación y utilidades base | Bajo |
| Shell de aplicación | `app-shell.js` | Inicialización, feedback de controles y registro del service worker | Bajo |
| Documento clínico | `patient-document.js` | Construcción semántica del documento del paciente | Medio |
| Flujo documento | `document-flow.js` | Separación P6 preparación → P7 vista previa aislada; validación de nombre e impresión | Bajo-medio |
| Impresión/documento | `document-flow.css`, `pdf-enhancements.js`, `pdf-enhancements.css`, `pdf-design-2026.css` | Maquetación y transformación del documento de paciente | Medio-alto: varias capas siguen afectando el mismo resultado |
| Farmacia Popular | `farmacia-popular.js`, `farmacia-popular.css` | Presenta precio/stock de datos sincronizados | Bajo mientras permanezca desacoplado del algoritmo |
| Datos de farmacia | `data/farmacia-cerro-navia.json` | Snapshot público de precios, stock y discovery | Bajo |
| Sincronización farmacia | `scripts/update_farmacia_cerro_navia.py` + workflow | Consulta, normaliza, valida y publica datos | Bajo respecto de clínica |
| PWA/cache | `sw.js` | Caché y actualización atómica del app shell | Medio: debe versionarse junto con cambios de assets clínicos |
| HTML shell | `index.html` | Pantallas P0–P7 y hosts para capas dinámicas | Medio-bajo |

## Flujos que se consideran contrato

### Inicio de insulina

`P0 → P1 → P2 → P2.5 (tratamiento) → P3 (dosis) → P5 (nota) → P6 (preparación) → P7 (documento)`

Contratos protegidos:

- exclusiones permanecen fuera del algoritmo APS;
- hiperglicemia marcada sin alto riesgo puede llevar a NPH AM + PM;
- alto riesgo de hipoglicemia mantiene inicio conservador;
- el tratamiento concomitante no cambia automáticamente el cálculo NPH;
- el cálculo clínico de inicio proviene de `clinical-engine.js`.

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
- exclusividad farmacológica actual se conserva.

### Documento

- P6 contiene datos y elección de documento, no la vista previa.
- P7 contiene el iframe de vista previa aislada y no contiene el `#pdf` imprimible del documento padre.
- el `#pdf` de staging vive fuera de `<main>` y permanece oculto en la aplicación.
- el nombre es obligatorio antes de generar documento.
- el documento de paciente debe imprimir en una sola hoja Letter.

### Farmacia Popular

- el frontend consume `data/farmacia-cerro-navia.json` sin usarlo para modificar dosis NPH;
- una presentación seleccionada no puede caer silenciosamente a otra dosis;
- nuevas presentaciones no mapeadas requieren revisión clínica antes de entrar al selector.

## Red de seguridad actual

La suite de pruebas protege tres niveles:

1. **Contrato unitario del motor:** límites y estructuras de retorno.
2. **Matriz de regresión clínica:** casos sintéticos de inicio, ajustes, intensificación, hipoglicemia, discordantes y dosis alta.
3. **E2E con Chromium:** flujo real desde interfaz hasta nota/documento.

Entre los escenarios de navegador protegidos están:

- arranque sin excepciones JS;
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
- duplicación de umbrales de dosis alta en `app.js`;
- reaparición del monkey patch `window.analizarGlicemias` en la capa APS;
- reclasificación bioquímica de hipoglicemia directamente en la UI;
- persistencia de datos identificables del paciente;
- transformaciones de JavaScript clínico desde el service worker;
- mezcla de revisiones PWA al publicar nuevos assets clínicos.

## Deuda técnica para fases posteriores

1. Reducir gradualmente los wrappers globales restantes sobre `window` sin romper compatibilidad.
2. Consolidar las múltiples capas de CSS/JS del PDF en un componente de impresión más simple.
3. Simplificar todavía más el versionado del app shell/PWA para evitar mantener versiones repetidas en varios archivos de checks.
4. Incorporar pruebas visuales con snapshots una vez que el diseño estable sea aprobado.
5. Versionar explícitamente el protocolo clínico y asociar cada futura modificación clínica a una matriz de casos esperados revisada.
6. Separar progresivamente generación de texto clínico de la manipulación DOM cuando aporte valor, sin reabrir reglas ya estabilizadas.

## Regla de aceptación para refactors futuros

Un PR de refactor no clínico debe:

- pasar los checks estáticos existentes;
- pasar `Insulog E2E safety net`;
- no modificar resultados de los casos clínicos de referencia;
- no introducir persistencia de datos de paciente;
- mantener `clinical-engine.js` libre de dependencias del navegador;
- explicar qué responsabilidad mueve y qué deuda técnica elimina.

Cualquier cambio intencional de dosis, umbral, criterio o conducta clínica debe tratarse como cambio clínico explícito, no como refactor, y debe actualizar primero sus casos esperados y documentación de protocolo.
