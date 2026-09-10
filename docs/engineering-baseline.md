# Insulog APS — baseline de ingeniería

Este documento fija el estado técnico que debe protegerse antes de cualquier refactor importante. Su objetivo es separar responsabilidades, declarar invariantes y evitar que cambios visuales, de PWA o de PDF alteren inadvertidamente la lógica clínica.

## Principio de trabajo

1. Primero debe quedar verde la red de seguridad E2E.
2. Los refactors de arquitectura no deben cambiar resultados clínicos salvo que el cambio sea explícito, revisado y documentado.
3. UI, impresión, PWA, Farmacia Popular y lógica clínica deben evolucionar como responsabilidades separadas.
4. No se deben persistir datos clínicos identificables del paciente en localStorage, sessionStorage ni IndexedDB.

## Mapa actual de responsabilidades

| Área | Archivo principal | Responsabilidad actual | Riesgo de acoplamiento |
| --- | --- | --- | --- |
| Algoritmo clínico base | `app.js` | Navegación base, inicio NPH, seguimiento, HGT, notas y generación base de documento | Alto: concentra varias responsabilidades |
| Capa clínica/seguridad 2026 | `aps-safety-2026.js` | Formulario farmacológico enriquecido, reglas de exclusividad, hipoglicemia y salvaguardas clínicas | Medio-alto: envuelve funciones globales del core |
| Estilos clínicos/seguridad | `aps-safety-2026.css` | Presentación de tarjetas, alertas y medicación | Medio |
| Flujo documento | `document-flow.js` | Separación P6 preparación → P7 vista previa; validación de nombre; fallback de Farmacia Popular | Medio |
| Impresión/documento | `document-flow.css`, `pdf-enhancements.js`, `pdf-enhancements.css`, `pdf-design-2026.css` | Maquetación y transformación del documento de paciente | Alto: varias capas CSS/JS afectan el mismo resultado |
| Farmacia Popular | `farmacia-popular.js`, `farmacia-popular.css` | Presenta precio/stock de datos sincronizados | Bajo-medio si permanece desacoplado del algoritmo |
| Datos de farmacia | `data/farmacia-cerro-navia.json` | Snapshot público de precios, stock y discovery | Bajo |
| Sincronización farmacia | `scripts/update_farmacia_cerro_navia.py` + workflow | Consulta, normaliza, valida y publica datos | Bajo respecto de clínica |
| PWA/cache | `sw.js` | Caché y actualización del app shell | Alto: una mezcla de revisiones puede afectar toda la app |
| HTML shell | `index.html` | Pantallas P0–P7 y hosts para capas dinámicas | Medio-alto |

## Flujos que se consideran contrato

### Inicio de insulina

`P0 → P1 → P2 → P2.5 (tratamiento) → P3 (dosis) → P5 (nota) → P6 (preparación) → P7 (documento)`

Contratos protegidos inicialmente:
- exclusiones permanecen fuera del algoritmo APS;
- hiperglicemia marcada sin alto riesgo puede llevar a NPH AM + PM;
- alto riesgo de hipoglicemia mantiene inicio conservador;
- el tratamiento concomitante no cambia automáticamente el cálculo NPH.

### Seguimiento

`P0 → P1 → P2 → P3.5 (tratamiento) → P4 (15 HGT) → P5 (nota) → P6 → P7`

Contratos protegidos inicialmente:
- 15 filas de seguimiento;
- mínimo 3 glicemias de ayuno para ajuste;
- ajuste PM guiado por ayunas;
- hipoglicemia no muestra alerta mientras se escribe: aparece al solicitar ajuste;
- exclusividad farmacológica actual se conserva.

### Documento

- P6 contiene datos y elección de documento, no la vista previa.
- P7 contiene `#pdf`.
- el nombre es obligatorio antes de generar documento.
- el documento de paciente debe imprimir en una sola hoja Letter.

### Farmacia Popular

- el frontend consume `data/farmacia-cerro-navia.json` sin usarlo para modificar dosis NPH;
- una presentación seleccionada no puede caer silenciosamente a otra dosis;
- nuevas presentaciones no mapeadas requieren revisión clínica antes de entrar al selector.

## Red de seguridad E2E inicial

La suite Playwright ejecuta Chromium real contra un servidor estático local y cubre:

- arranque sin excepciones JS;
- exclusiones;
- dos escenarios de inicio NPH;
- creación de 15 HGT;
- exclusividad de metforminas simples e iSGLT2;
- coexistencia permitida de metformina simple con vildagliptina/metformina;
- carga de precio de Farmacia Popular;
- ajuste de seguimiento conocido;
- alerta de hipoglicemia bajo demanda;
- separación P6/P7;
- PDF de una sola página Letter;
- no persistencia del nombre del paciente;
- ausencia de overflow horizontal básico en viewport móvil.

## Deuda técnica identificada para fases posteriores

Estas tareas se documentan, pero **no se resuelven en este baseline**:

1. Reducir gradualmente el uso de funciones globales y wrappers sobre `window`.
2. Extraer el algoritmo clínico puro a funciones sin DOM para poder probar decenas de casos clínicos sintéticos directamente.
3. Consolidar las múltiples capas de CSS/JS del PDF en un componente de impresión único.
4. Simplificar y versionar de forma única el app shell/PWA.
5. Retirar o aislar workflows históricos que modifican código y ya no forman parte del flujo normal.
6. Incorporar pruebas visuales con snapshots una vez que el diseño estable sea aprobado.
7. Versionar explícitamente el protocolo clínico y construir una matriz de casos esperados antes de cambios clínicos futuros.

## Regla de aceptación para refactors futuros

Un PR de refactor no clínico debe:

- pasar los checks estáticos existentes;
- pasar `Insulog E2E safety net`;
- no modificar resultados de los casos clínicos de referencia;
- no introducir persistencia de datos de paciente;
- explicar qué responsabilidad mueve y qué deuda técnica elimina.
