# Insulog APS — seguimiento en Google Drive

## Objetivo

Registrar automáticamente cada documento clínico emitido por Insulog en la base de Google Sheets `Insulog APS - Base de seguimiento clínico`, usando el nombre del paciente ya ingresado para generar el PDF. El profesional no escribe códigos ni identificadores adicionales.

## Base de destino definitiva

- Propietario: `mdcarlosherrera@gmail.com`
- Spreadsheet ID: `1WTDqnaHgwX_7OdgxW0C7WIC6Up3dcxOcmKhObHw9La4`
- Hojas utilizadas: `Pacientes`, `Controles`, `Eventos`, `Diccionario`
- Carpeta del proyecto: `Insulog APS - Seguimiento y Validación`
- Los identificadores `patient_id`, `control_id` y `event_id` son generados automáticamente.

## Clasificación longitudinal

El primer registro de cada paciente queda diferenciado automáticamente:

- `Inicio`: el paciente no utilizaba insulina y el inicio de NPH se realiza mediante Insulog.
- `Ingreso con insulina previa`: el paciente ya utilizaba insulina antes de aparecer por primera vez en Insulog.

Después del primer registro:

- `Ajuste`: cambia la dosis indicada respecto de la pauta previa.
- `Seguimiento`: se registra un control sin cambio de dosis.

En `Pacientes` también se conserva la situación basal: tipo de ingreso a cohorte, si usaba insulina previamente, NPH AM/PM basal, NPH total basal y dosis final tras el primer registro.

## Despliegue del puente de Google Apps Script

1. Abrir la hoja `Insulog APS - Base de seguimiento clínico` en el Drive de `mdcarlosherrera@gmail.com`.
2. Ir a **Extensiones → Apps Script**.
3. Reemplazar el contenido de `Code.gs` por el archivo `google-apps-script/Code.gs` de este repositorio.
4. Guardar el proyecto con el nombre `Insulog APS Drive Bridge`.
5. Ir a **Implementar → Nueva implementación → Aplicación web**.
6. Ejecutar como: **Yo** (`mdcarlosherrera@gmail.com`).
7. Acceso: usar la opción más restringida que siga funcionando en los equipos clínicos. Si los equipos no comparten un dominio Google Workspace autenticado, la alternativa funcional puede requerir acceso más amplio; el endpoint no expone registros por `doGet`.
8. Implementar y copiar la URL que termina en `/exec`.

## Configuración de Insulog

La URL del puente se configura una sola vez por navegador. Abrir Insulog agregando temporalmente:

`?driveEndpoint=URL_DEL_WEB_APP`

Ejemplo conceptual:

`https://solrac031ch-prog.github.io/insulog-aps/?driveEndpoint=https://script.google.com/macros/s/DEPLOYMENT_ID/exec`

Insulog valida la URL, la guarda localmente y elimina el parámetro de la barra de direcciones. Solo se almacena la URL del puente; los nombres de pacientes no se guardan de forma persistente en el navegador por este módulo.

## Datos enviados por control

- Nombre completo del paciente.
- Fecha/hora.
- Tipo de control: inicio, ingreso con insulina previa, ajuste o seguimiento.
- Peso.
- HbA1c basal o HbA1c actual si está disponible.
- VFG en el inicio si fue registrada.
- Dosis NPH previa AM/PM y total.
- Promedios de glicemia en ayunas y pre-almuerzo.
- Detección de valores <70 y <54 mg/dL.
- Recomendación original de Insulog.
- Decisión final del profesional.
- Motivo de modificación, cuando corresponde.
- Versiones del motor clínico/documento/runtime.

## Comportamiento ante fallas

Si Drive no está configurado, Insulog no guarda nombres en almacenamiento persistente local. Si falla la red durante una pestaña abierta, conserva temporalmente el registro solo en memoria y vuelve a intentar al recuperar conexión. Al cerrar la pestaña, ese buffer se pierde; por eso la implementación de Apps Script debe verificarse con un paciente ficticio antes del uso prospectivo.

## Duplicados

Cada emisión clínica tiene un `recordId` técnico. El backend rechaza reintentos con el mismo `recordId`. Dentro de una misma sesión, volver a abrir el mismo documento sin cambiar la decisión reutiliza el identificador para evitar duplicar el control.

## Limitación conocida

Actualmente el emparejamiento longitudinal usa el nombre normalizado del paciente, porque el flujo clínico solicitado no añade códigos manuales. Dos pacientes distintos con exactamente el mismo nombre podrían quedar asociados al mismo registro. Antes de ampliar el estudio a varios centros conviene añadir un segundo dato clínico de desambiguación que no requiera códigos manuales, por ejemplo fecha de nacimiento.
