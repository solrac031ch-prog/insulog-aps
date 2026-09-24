# Insulog APS — validación móvil y PWA

Este documento separa dos niveles de evidencia que no deben confundirse:

1. **compatibilidad automatizada cross-browser**, ejecutada en CI con WebKit/iPhone-like y Chromium/Android-like;
2. **aceptación en hardware real**, que requiere un iPhone/iOS y un Android físicos.

La automatización reduce regresiones, pero no reemplaza la validación del navegador móvil real, la instalación desde pantalla de inicio, el teclado del sistema, el diálogo de impresión/compartir ni el ciclo de vida de una PWA instalada.

## Estado automatizado — Fase 9A

Fase 9A queda cubierta por:

- `tests/e2e/device-compat.spec.js`;
- `playwright.devices.config.js`;
- `.github/workflows/device-compat.yml`.

Perfiles protegidos:

- **iPhone-like / WebKit:** 393 × 852 CSS px, DPR 3, touch y user-agent Safari móvil;
- **Android / Chromium:** 412 × 915 CSS px, DPR 2.625, touch y user-agent Android/Chrome móvil.

Contratos automatizados:

- `viewport-fit=cover` presente;
- manifest y `apple-touch-icon` declarados;
- modo Apple mobile web app declarado;
- ausencia de overflow horizontal de documento;
- flujo real desde P0 hasta P4;
- tabla HGT completa sin scroll horizontal interno;
- inputs HGT con objetivo táctil mínimo de **44 px**;
- CTA principal con altura mínima de 48 px;
- escritura de HGT mediante inputs móviles;
- render del documento del paciente dentro del iframe en viewport móvil;
- reapertura offline del app shell con service worker real en Chromium Android;
- capturas P0 y P4 de ambos perfiles como artefactos de CI durante 14 días.

### Hallazgo corregido durante 9A

El primer run cross-browser mostró que los campos HGT tenían una altura computada de 40 px tanto en WebKit como en Chromium Android. El problema se corrigió en `styles.css` elevando el mínimo a 44 px; el test no fue relajado.

La modificación del shell activó correctamente el contrato de Fase 8 y produjo el release:

`4804df17c9c0ab6b`

La suite Chromium histórica continuó verde sin re-baseline perceptual de P0/P2/P4.

## Fase 9B — protocolo de aceptación en hardware real

**Estado 2026-09-24: PENDIENTE DE HARDWARE FÍSICO.** El checklist está preparado y la compatibilidad automatizada continúa en CI, pero 9B no puede cerrarse sin ejecutar estas pruebas en un iPhone y un Android reales.

La siguiente validación debe ejecutarse al menos en:

- un iPhone reciente con una versión soportada de iOS y Safari;
- un teléfono Android reciente con Chrome;
- modo navegador normal y, cuando corresponda, modo instalado desde pantalla de inicio.

Registrar antes de comenzar:

| Campo | Valor |
| --- | --- |
| Fecha | |
| Release/fingerprint | |
| Dispositivo | |
| Sistema operativo | |
| Navegador y versión | |
| Modo | Safari/Chrome / PWA instalada |
| Orientación | Retrato / paisaje |
| Resultado | PASS / FAIL |

### A. Arranque y layout

- Abrir la URL publicada desde una sesión nueva.
- Confirmar que P0 aparece limpia, sin bordes de foco gigantes ni elementos superpuestos.
- Confirmar que no existe scroll horizontal.
- Rotar retrato → paisaje → retrato y verificar que la interfaz vuelve a un layout coherente.
- En iPhone con notch/Dynamic Island, confirmar que ningún contenido importante queda bajo la zona segura superior o inferior.
- Verificar que el CTA `INICIAR ALGORITMO` es cómodo de pulsar con una mano.

**Aceptar si:** no hay clipping, zoom involuntario, scroll horizontal ni controles parcialmente inaccesibles.

### B. Navegación clínica y foco

Recorrer:

`P0 → P1 → P2 → seguimiento → P3.5 → P4`

- Confirmar que cada transición lleva el foco/scroll a una posición útil.
- Usar `VOLVER` en al menos dos pantallas y verificar que la navegación no deja contenido oculto.
- Abrir y cerrar los bloques plegables de P0/P3.
- Confirmar que no aparece el marco negro grande que motivó la corrección de Fase 8A.

**Aceptar si:** la pantalla activa es inequívoca, el usuario no queda en una posición de scroll absurda y ningún foco tapa contenido.

### C. Teclado móvil y campos clínicos

En P4:

- pulsar `Peso`, `Dosis AM`, `Dosis PM` y varios campos HGT;
- confirmar que el teclado mostrado es adecuado al tipo de dato;
- escribir y corregir valores;
- mover el foco entre campos con el teclado abierto;
- verificar que iOS no hace zoom automático al enfocar inputs;
- verificar que el campo enfocado no queda permanentemente oculto tras el teclado;
- comprobar que las tres columnas de la tabla siguen identificables mientras se capturan valores.

**Aceptar si:** la captura puede hacerse sin pellizcar/zoom manual y todos los HGT son pulsables con precisión razonable.

### D. Flujo clínico de humo

Sin usar datos de paciente reales, ejecutar un caso sintético conocido:

- seguimiento PM;
- dosis PM actual 20 UI;
- ayunas 160, 160, 160 mg/dL;
- solicitar ajuste.

Resultado esperado según el contrato vigente:

- PM nueva: **22 UI**.

Después volver a P4 y probar hipoglicemia sintética 60, 105, 110 mg/dL para verificar que aparece la confirmación de asistencia.

**Aceptar si:** el resultado coincide con CI y la interacción móvil permite completar el flujo sin dobles toques o acciones perdidas.

### E. Documento del paciente

Usar un nombre ficticio.

- Generar un documento de seguimiento.
- Confirmar que P7 muestra la vista previa dentro del iframe.
- Revisar legibilidad de dosis, indicaciones y tabla HGT.
- Pulsar `IMPRIMIR`.

En iPhone:

- revisar el flujo nativo de impresión/compartir;
- si se usa `Guardar en Archivos`/PDF desde el sistema, revisar el resultado final.

En Android:

- revisar el diálogo nativo de impresión/guardar como PDF disponible en el dispositivo.

**Aceptar si:** la vista previa no se recorta y el PDF final conserva la hoja Letter y jerarquía visual protegida por CI.

### F. Instalación PWA

#### iPhone

- Safari → Compartir → `Agregar a pantalla de inicio`;
- abrir Insulog APS desde el icono;
- confirmar título/icono y ausencia de UI de Safari propia del modo navegador;
- repetir P0 → P4 en modo instalado.

#### Android

- Chrome → `Instalar app`/`Agregar a pantalla principal` según disponibilidad;
- abrir desde el icono;
- repetir P0 → P4.

**Aceptar si:** el shell instalado mantiene el mismo layout y no abre pantallas críticas en un contexto inesperado.

### G. Offline real

Requisito: haber abierto la versión online al menos una vez y esperar a que el service worker quede instalado.

- cerrar completamente la app/PWA;
- activar modo avión;
- reabrir desde pantalla de inicio;
- confirmar que P0 carga;
- navegar al menos hasta P4;
- abrir la preparación/vista previa del documento sin depender de recursos de red del shell.

Farmacia Popular puede no disponer de datos frescos offline porque su JSON es deliberadamente dinámico y está fuera del app shell.

**Aceptar si:** el flujo base y los assets del documento abren offline sin mezclar pantallas sin estilo o scripts faltantes.

### H. Actualización entre releases

Este escenario protege la decisión de Fase 8 de no tomar una atención abierta a la fuerza.

1. abrir una versión de Insulog APS y dejar una atención sintética abierta;
2. publicar/esperar un release nuevo;
3. continuar usando la pestaña ya abierta y confirmar que no cambia de aspecto/JS a mitad de flujo;
4. cerrar completamente todas las pestañas/instancias;
5. volver a abrir con red;
6. confirmar que el nuevo release entra de forma completa;
7. volver a probar offline después de que la versión nueva haya sido instalada.

**Aceptar si:** nunca se observa una mezcla de HTML/CSS/JS entre releases.

## Evidencia mínima por dispositivo

Guardar para cada dispositivo físico:

- captura P0;
- captura P4 con tres HGT sintéticos;
- captura de P7/documento;
- captura del icono/PWA instalada;
- captura o nota del resultado offline;
- fingerprint probado;
- cualquier defecto con pasos exactos de reproducción.

No usar nombres, RUT, glicemias ni otros datos identificables de pacientes reales en la evidencia de pruebas.

## Criterio de cierre de Fase 9B

9B solo puede declararse completada cuando exista evidencia PASS en un iPhone físico y un Android físico para los bloques A–G. El bloque H debe ejecutarse al menos una vez en uno de los dos sistemas después de un release real.

Los resultados automatizados WebKit/Chromium de 9A no son suficientes para declarar 9B completada.
