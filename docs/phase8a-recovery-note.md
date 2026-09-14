# Fase 8A — recuperación visual previa a versionado

Esta rama prioriza estabilizar la interfaz publicada antes de automatizar el versionado del app shell/PWA.

Motivo: las capturas de regresión visual de Fase 7C muestran un defecto visible en portada: un borde/rectángulo negro superpuesto sobre el título `Insulog APS`. La regresión visual estaba comparando contra un baseline que ya contenía ese defecto.

Orden de trabajo:
1. diagnosticar el estilo computado y el origen del borde;
2. corregir portada y revisar estados P0/P2/P4 móvil y escritorio;
3. regenerar conscientemente los baselines visuales;
4. recién entonces continuar con la automatización de versiones/cache de Fase 8B.

No se modifican reglas clínicas durante 8A.
