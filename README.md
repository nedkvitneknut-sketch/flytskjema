# Flytskjema

Webapp som analyserer flytskjema for varmeanlegg med kunstig intelligens (Claude).

Slipp inn et flytskjema som PDF eller bilde, så vil appen:

1. **Lese skjemaet** – identifisere varmekilder, pumper, ventiler, vekslere og forbrukerkretser
2. **Visualisere anlegget** – forenklet diagram med animert vannstrøm (tur/retur)
3. **Foreslå energisparetiltak** – konkrete tiltak tilpasset anlegget, rangert etter potensial

## Kom i gang

1. Installer avhengigheter:

   ```
   npm install
   ```

2. Lag en `.env`-fil basert på `.env.example` og lim inn API-nøkkelen din fra
   [console.anthropic.com](https://console.anthropic.com):

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. Start appen:

   ```
   npm start
   ```

4. Åpne [http://localhost:3000](http://localhost:3000) og slipp inn et flytskjema.

## Teknisk

- **Backend:** Node.js + Express ([server.js](server.js)) – sender fila til Claude-API-et
  med strukturert JSON-utdata (komponenter, forbindelser, tiltak)
- **Frontend:** Vanilla JS ([public/](public/)) – SVG-diagram med CSS-animert strømning
- **Modell:** `claude-opus-4-8` med vision-støtte for PDF og bilder
