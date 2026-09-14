# Phase 6B — Decisión profesional y suficiencia de datos

## Objetivo

Cerrar el circuito clínico posterior a `Clinical r2` sin modificar ninguna regla de cálculo. Insulog conserva por separado:

- la **recomendación calculada por Clinical r2**;
- la **decisión final del profesional**.

## Funciones

### 1. Suficiencia de HGT

En seguimiento se muestra en tiempo real si existen datos suficientes para titular:

- Ayunas: mínimo 3 registros.
- Pre-almuerzo: mínimo 3 registros cuando el esquema incluye NPH AM.

La tarjeta es informativa. No recalcula ni sustituye las validaciones del motor.

### 2. Decisión profesional

Tras generar la nota clínica el profesional puede:

- `ACEPTAR`: adopta sin cambios la recomendación de Clinical r2.
- `MODIFICAR PLAN`: registra dosis AM/PM final y exige un motivo clínico breve.
- `REEVALUAR`: deja explícito que no existe aún una pauta definitiva.

La modificación manual no cambia `state.am`/`state.pm`, que continúan representando la recomendación del motor. La pauta final queda en campos independientes `professionalAm`/`professionalPm`.

### 3. Nota clínica

La nota conserva el resultado original y agrega una sección `DECISIÓN PROFESIONAL` con:

- recomendación Clinical r2;
- decisión final;
- motivo cuando el plan fue modificado.

### 4. Documento/PDF

Los documentos al paciente sólo pueden generarse cuando la decisión final es `ACEPTAR` o `MODIFICAR PLAN`.

Cuando existe una modificación, el PDF utiliza temporalmente la pauta final profesional; la recomendación de Clinical r2 permanece intacta en el estado para auditoría.

`REEVALUAR` y las rutas de urgencia no permiten emitir una nueva pauta ambulatoria desde esta capa.

### 5. Historial de sesión

El historial temporal conserva además:

- tipo de decisión profesional;
- pauta final;
- motivo de modificación;
- suficiencia de datos HGT.

El historial continúa siendo efímero durante la sesión y no se sincroniza con servidor.

## Seguridad

Phase 6B no modifica:

- `clinical-engine.js`;
- umbrales de hipoglicemia;
- reglas de titulación;
- límite basal de 0,5 UI/kg/día;
- reglas de urgencia.

Una pauta manual >0,5 UI/kg/día se bloquea antes de poder registrarse como decisión final.
