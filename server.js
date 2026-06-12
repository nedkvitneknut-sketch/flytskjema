import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Enkel .env-lasting slik at brukeren slipper ekstra avhengigheter
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    systemName: {
      type: "string",
      description: "Kort navn på anlegget, f.eks. 'Varmeanlegg med varmepumpe og el-kjel'",
    },
    summary: {
      type: "string",
      description: "2-4 setninger som beskriver hvordan anlegget fungerer",
    },
    components: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Unik id, f.eks. 'vp1'" },
          type: {
            type: "string",
            enum: [
              "kjel", "varmepumpe", "fjernvarme", "solfanger", "pumpe",
              "varmeveksler", "ventil", "shuntventil", "radiator", "gulvvarme",
              "ventilasjonsbatteri", "tank", "ekspansjonskar", "maaler", "annet",
            ],
          },
          label: { type: "string", description: "Visningsnavn fra skjemaet" },
          x: { type: "number", description: "Horisontal posisjon 0-100, speiler layouten i originalskjemaet" },
          y: { type: "number", description: "Vertikal posisjon 0-100" },
          info: { type: "string", description: "Effekt, temperatur eller annen nøkkelinfo fra skjemaet. Tom streng hvis ukjent." },
        },
        required: ["id", "type", "label", "x", "y", "info"],
        additionalProperties: false,
      },
    },
    connections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: { type: "string", description: "id til komponenten strømmen kommer fra" },
          to: { type: "string", description: "id til komponenten strømmen går til" },
          type: {
            type: "string",
            enum: ["tur", "retur", "annet"],
            description: "tur = varmt vann ut til forbruker, retur = avkjølt vann tilbake",
          },
          label: { type: "string", description: "F.eks. temperatur '60°C'. Tom streng hvis ukjent." },
        },
        required: ["from", "to", "type", "label"],
        additionalProperties: false,
      },
    },
    optimizations: {
      type: "array",
      description: "Konkrete tiltak for energisparing i dette anlegget, sortert etter potensial",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string", description: "Hva tiltaket går ut på og hvorfor det sparer energi i akkurat dette anlegget" },
          savingPotential: { type: "string", enum: ["lav", "middels", "hoy"] },
          category: {
            type: "string",
            enum: ["styring", "temperatur", "pumpedrift", "isolasjon", "varmegjenvinning", "energikilde", "vedlikehold", "annet"],
          },
        },
        required: ["title", "description", "savingPotential", "category"],
        additionalProperties: false,
      },
    },
  },
  required: ["systemName", "summary", "components", "connections", "optimizations"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Du er en ekspert på VVS og energirådgivning for varmeanlegg i bygg.
Du får et flytskjema (P&ID / systemskjema) for et varmeanlegg som PDF eller bilde.
Målet er en FORENKLET prinsippskisse, ikke en kopi av skjemaet.

Regler for komponenter (maks ca. 15 stk):
- Ta KUN med komponenter som vannet strømmer gjennom: varmekilder (kjel, varmepumpe,
  fjernvarme, veksler), hovedpumper, sentrale shunt-/reguleringsventiler, tanker,
  ekspansjonskar og forbrukerkretser.
- IKKE lag egne komponenter for temperaturfølere, givere eller målere (RT-, OE-,
  energimålere o.l.). Legg måleverdiene inn i 'info' på nærmeste komponent, eller i
  'label' på røret der de hører hjemme (f.eks. "78,5 °C").
- Slå sammen hver forbrukerkurs til ÉN boks (f.eks. "Kurs 1", "Mellombygg",
  "Ventilasjon/varmtvann", "Helsesenter"). Bruk type radiator/gulvvarme/
  ventilasjonsbatteri/annet etter hva kursen forsyner.
- Dupliserte pumper (A/B-pumper) slås sammen til én boks, f.eks. "P01 A/B".

Regler for forbindelser:
- Tegn hovedstrømmen: tur (varmt vann fra kilde til forbrukere) og retur (tilbake).
- Hver forbruker kobles til fordelingen med én tur- og én retur-forbindelse.
- Legg kjente temperaturer som 'label' på forbindelsene.

Koordinater (0-100): Tegn strømmen fra venstre mot høyre - varmekilder ved x=0-15,
veksler/pumper/fordeling i midten, forbrukerkretser ved x=70-100. Bruk y til å skille
parallelle kretser. Eksakt plassering er mindre viktig; appen rydder layouten selv.

Energisparetiltak: Foreslå 3-6 konkrete tiltak tilpasset akkurat dette anlegget, med
realistisk vurdering av sparepotensial. Referer til komponentene og temperaturene du fant.

Vær nøyaktig: ta bare med det du faktisk ser i skjemaet. Svar på norsk.`;

app.post("/api/analyze", async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: "ANTHROPIC_API_KEY mangler. Legg den i en .env-fil (se .env.example).",
      });
    }

    const { mediaType, data } = req.body;
    if (!data || !mediaType) {
      return res.status(400).json({ error: "Mangler fil-data." });
    }

    const fileBlock =
      mediaType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
        : { type: "image", source: { type: "base64", media_type: mediaType, data } };

    const client = new Anthropic();

    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      output_config: {
        format: { type: "json_schema", schema: ANALYSIS_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            fileBlock,
            {
              type: "text",
              text: "Analyser dette flytskjemaet for varmeanlegget og returner strukturen som JSON i henhold til skjemaet.",
            },
          ],
        },
      ],
    });

    const message = await stream.finalMessage();
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock) {
      return res.status(502).json({ error: "Fikk ikke noe svar fra modellen." });
    }

    res.json(JSON.parse(textBlock.text));
  } catch (err) {
    console.error(err);
    const msg =
      err instanceof Anthropic.AuthenticationError
        ? "Ugyldig API-nøkkel. Sjekk ANTHROPIC_API_KEY i .env."
        : err.message || "Ukjent feil under analysen.";
    res.status(500).json({ error: msg });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Flytskjema-appen kjører på http://localhost:${PORT}`);
});
