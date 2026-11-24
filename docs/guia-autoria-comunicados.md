# Guía de autoría de comunicados

Los comunicados se escriben en Markdown. La plataforma no acepta HTML crudo en
el contenido: el servidor rechaza la publicación y el cliente sanea cualquier
contenido antiguo antes de mostrarlo.

## Qué se puede usar

- Títulos con `#`, `##` y `###`.
- Párrafos, listas, citas y bloques de código.
- Negrita (`**texto**`), cursiva (`*texto*`) y tachado (`~~texto~~`).
- Tablas Markdown.
- Enlaces con `[texto](https://…)` o `[texto](mailto:…)`.
- Imágenes con `![descripción](https://…)` o rutas del sitio (`/logo-cgpa.png`).

## Qué se rechaza

- Etiquetas HTML: `<div>`, `<script>`, `<iframe>`, `<svg>`, `<form>`, etc.
- Atributos de evento como `onerror`, `onload` o `onclick`.
- Enlaces con `javascript:`, `data:` o cualquier protocolo distinto de `http`,
  `https` y `mailto`.
- Imágenes con `http:` o `data:`.

## Si un comunicado antiguo usa HTML

Ejecuta la auditoría de solo lectura contra el entorno autorizado:

```bash
cd apps/api
pnpm audit:markdown
```

El comando no modifica datos. Muestra el identificador, el título y el motivo de
cada comunicado que debe corregirse manualmente desde el panel de administración.

## Antes de publicar

1. Revisa que los enlaces sean del sitio, de una fuente oficial o `mailto:`.
2. Sube las imágenes desde el panel cuando corresponda.
3. Previsualiza el comunicado como lo verá el público.
4. Si vas a publicar de inmediato, confirma que la fecha de publicación ya pasó.
