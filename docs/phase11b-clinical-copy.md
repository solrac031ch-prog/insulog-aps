# Fase 11B — generación de texto clínico pura

## Objetivo

Reducir el acoplamiento directo entre reglas/resultados clínicos y el DOM sin cambiar ninguna conducta clínica.

## Separación resultante

- `clinical-engine.js` calcula y decide;
- `clinical-copy.js` transforma datos ya calculados en texto de nota clínica;
- `app.js` lee la interfaz, llama al motor/generador y renderiza el resultado.

`clinical-copy.js` no consulta DOM, almacenamiento ni estado global de la aplicación. Expone una API inmutable con:

- `buildInitialNote()`;
- `buildFollowupNote()`;
- `buildHighDoseNote()`.

## Regresión exacta

`tests/clinical-copy.test.js` protege el texto final con comparaciones exactas. Esto complementa —no reemplaza— los E2E y la regresión visual: un cambio de puntuación, línea, etiqueta o cifra en los casos protegidos hace fallar el test aunque la pantalla siga pareciéndose visualmente.

## Versionado

La extracción no cambió `clinical-engine.js`, por lo tanto la versión clínica sigue siendo:

`APS-NPH-2026.09.14-r1`

Sí cambió el app shell porque apareció un nuevo archivo de producción. El release técnico pasó a:

`239bc6b77d3afe3d`

`clinical-copy.js` forma parte de `SHELL_FILES`, `APP_SHELL` y del guardrail atómico/offline.

## Validación

La integración de Fase 11B pasó:

- equivalencia del motor clínico;
- matriz clínica de 56 casos agrupados;
- safety contract estructurado;
- regresión exacta de clinical-copy;
- gobernanza de versión clínica;
- invariantes y release atómico;
- Chromium E2E + regresión visual;
- WebKit/Android móvil y offline;
- PDF/documento/Farmacia Popular.

No fue necesario rebaseline visual.
