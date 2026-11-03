# Repaso

**App publicada:** https://fazepepinito649.github.io/Quizlet_moded/

App web de estudio con flashcards (React + TypeScript + Vite). Todo se guarda en `localStorage` (clave `repaso.v1`).

```bash
npm install
npm run dev      # servidor de desarrollo
npm test         # pruebas de checkAnswer e importación
npm run build    # genera dist/ (estático, base relativa)
```

## Estructura

- `src/lib/checkAnswer.ts`: comprobación tolerante. Normaliza, aplica Damerau-Levenshtein ponderado (teclas adyacentes QWERTY/QWERTZ, letra repetida, transposición y espacio cuestan 0.5) y umbrales por longitud. Acepta ae/oe/ue/ss, la opción "Ignorar acentos" y alternativas con `/`. En la consola del navegador está disponible como `window.checkAnswer`.
- `src/lib/importFormat.ts`: parser del formato `término | definición` / tabulador con metadatos `@titulo`, `@idioma_termino` y `@idioma_definicion`, más la exportación a `.txt`.
- `src/lib/learn.ts`: modo Aprender. Cada término pasa por Nuevo → Aprendiendo → Familiar (acierta opción múltiple) → Dominado (acierta escrita), en rondas de 7; las falladas se repiten al final de la ronda. El nivel de cada tarjeta y la ronda en curso se guardan con el set, así que al cerrar y volver a abrir la página continúas donde lo dejaste.
- `src/lib/sessions.ts`: las rondas en curso de Tarjetas y de Escribir/Escuchar también se guardan con el set. Al cerrar y volver a abrir la página continúas en la misma tarjeta o pregunta, con un aviso y la opción de empezar de nuevo.
- `src/views/`: Inicio, Vista de set, Crear/editar, Importar, Aprender, Tarjetas, Escribir/Escuchar (`Quiz.tsx`).
- `src/styles.css`: tokens de color (claro y oscuro) y estilos del diseño.

## Diseño de referencia

`project/Repaso.dc.html` es el prototipo exportado de Claude Design y `chats/` contiene la conversación de diseño. La app reproduce ese diseño y su comportamiento.

## Publicación

Cada push a `main` ejecuta `.github/workflows/deploy.yml`: corre las pruebas, compila y publica `dist/` en la rama `gh-pages`, que GitHub Pages sirve.
