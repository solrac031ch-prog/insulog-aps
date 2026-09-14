# Phase 6A — Best of Insulog

## Objetivo

Incorporar patrones útiles observados en sistemas digitales de titulación de insulina sin modificar el motor clínico `Clinical r2` ni convertir Insulog en una plataforma de telemedicina.

## Funciones incorporadas

### 1. Recomendación explicable

El resultado clínico puede desplegar **“Por qué Insulog recomienda esto”**. La vista resume los datos que ya utilizó el flujo, la dosis actual, la recomendación calculada por `Clinical r2`, la meta y las puertas de seguridad activadas.

Esta capa es sólo de presentación y trazabilidad. No recalcula dosis.

### 2. Revisión profesional explícita

El profesional puede marcar la recomendación como:

- `ACEPTAR RECOMENDACIÓN`
- `MARCAR PARA REEVALUAR`

La revisión no cambia la dosis, el estado clínico ni la nota generada. Su función es documentar la revisión humana antes de guardar un caso longitudinal.

### 3. Historial longitudinal local

Los casos pueden guardarse manualmente en `localStorage` bajo la clave `insulog.history.v1`, hasta 100 registros. Cada registro conserva el alias/código local, fecha, versión de Insulog, revisión profesional, dosis previa/recomendada, HGT relevantes, explicación y nota clínica.

El historial:

- permanece únicamente en el navegador actual;
- no se sincroniza con un servidor;
- requiere alias/código local;
- advierte no utilizar RUT ni nombre completo;
- permite filtrar por alias, revisar evolución y eliminar registros;
- muestra evolución descriptiva del promedio de glicemias en ayunas y de la dosis total recomendada.

## Frontera de seguridad

Phase 6A no modifica:

- `clinical-engine.js`;
- `clinical-copy.js`;
- reglas de inicio/titulación;
- límites de hipoglicemia;
- límite basal de 0,5 UI/kg/día;
- cálculo Clinical r2.

Una futura modificación manual de dosis deberá diseñarse como otra fase, con sincronización explícita entre estado, nota clínica, documento para el paciente y PDF antes de habilitarse.

## Pruebas

`tests/e2e/best-of-insulog.spec.js` verifica que:

1. la explicación refleja los datos usados por el resultado;
2. aceptar la recomendación no modifica la dosis calculada;
3. el historial conserva la revisión y sobrevive a una recarga;
4. no se guarda un caso sin alias y sin revisión profesional.
