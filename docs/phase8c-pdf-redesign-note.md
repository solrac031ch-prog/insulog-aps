# Fase 8C - recuperación visual del documento para paciente

La Fase 8C rehace la presentación final del documento Letter sin modificar decisiones clínicas, dosis NPH, clasificación de hipoglicemia, arsenal farmacológico ni contenido generado por el motor clínico.

## Problema corregido

El documento tenía tres capas de CSS de impresión que competían entre sí (`pdf-enhancements.css`, `pdf-design-2026.css` y `document-flow.css`). La última capa volvía a comprimir texto y filas, por lo que el resultado podía verse pequeño, apretado e inconsistente aunque los checks estáticos pasaran.

## Contrato nuevo

- `pdf-enhancements.css` conserva solo estructura.
- `document-flow.css` controla únicamente P6/P7, iframe y aislamiento de impresión.
- `pdf-design-2026.css` es la única autoridad visual del documento.
- la vista previa y la impresión comparten la misma jerarquía visual.
- la dosis NPH es el elemento principal y se mantiene claramente legible.
- la tabla HGT conserva 15 días con espacio real para escribir.
- firma y próximo control tienen áreas utilizables.
- un documento habitual cabe en una hoja Letter.
- cuando hay contenido farmacológico extenso se permite una segunda página en lugar de reducir el texto a tamaños clínicamente poco útiles.

## Seguridad

No se modifica `clinical-engine.js` ni ningún umbral o cálculo clínico. El cambio se limita a estructura del documento, presentación, pruebas y publicación del shell.
