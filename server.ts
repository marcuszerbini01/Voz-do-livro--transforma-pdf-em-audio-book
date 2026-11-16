import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const VALID_VOICES = new Set(["Kore", "Zephyr", "Puck", "Charon", "Fenrir"]);

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Chave da API Gemini (GEMINI_API_KEY) não configurada no ambiente."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

interface IncomingPage {
  index: number;
  label?: string;
  text: string;
}

function buildScanTranscript(pages: IncomingPage[]): string {
  const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);

  if (totalChars <= 180_000) {
    return pages
      .map((p) => `[PÁGINA ${p.index}]\n${p.text.trim()}`)
      .join("\n\n");
  }

  // For very long books (>180k chars), extract page openings, candidate heading lines, and closings
  return pages
    .map((p) => {
      const lines = p.text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const head = lines.slice(0, 10).join("\n");
      const headingCandidates = lines
        .slice(10, -4)
        .filter(
          (l) =>
            l.length <= 90 &&
            (/^(cap[ií]tulo|chapter|parte|part|livro|book|pr[oó]logo|ep[ií]logo|introdu[çc][aã]o|pref[aá]cio|se[çc][aã]o|\d+[\.\-\s])/i.test(
              l
            ) ||
              l === l.toUpperCase())
        )
        .slice(0, 8)
        .join("\n");
      const tail = lines.slice(-3).join("\n");
      return `[PÁGINA ${p.index}]\n${head}${headingCandidates ? `\n...\n${headingCandidates}` : ""}\n${tail}`;
    })
    .join("\n\n");
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "25mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/analyze-chapters", async (req, res) => {
    try {
      const { titleHint, authorHint, pages } = req.body as {
        titleHint?: string;
        authorHint?: string;
        pages?: IncomingPage[];
      };

      if (!Array.isArray(pages) || pages.length === 0) {
        res.status(400).json({
          error: "Nenhuma página de texto encontrada para analisar.",
        });
        return;
      }

      const ai = getAiClient();
      const transcript = buildScanTranscript(pages);

      const prompt = `Você é um editor literário especialista em estruturação de audiolivros.
Analise o documento abaixo (páginas numeradas com [PÁGINA N]) e extraia:
1. O título real do livro/documento (dica do arquivo: "${titleHint || "Desconhecido"}").
2. O autor (dica: "${authorHint || "Desconhecido"}"). Se não encontrar, use "Autor desconhecido".
3. Um resumo curto de 1 a 2 frases em português sobre a obra.
4. A lista ordenada de capítulos/seções do documento para navegação do audiolivro.

Regras importantes para os capítulos:
- Se o livro já tiver capítulos, partes, prólogo, introdução ou epílogo explícitos, identifique cada um na ordem exata em que aparecem.
- Se for um artigo, manual ou texto contínuo sem capítulos explícitos, divida-o automaticamente em 3 a 8 capítulos lógicos e temáticos com base na mudança de assunto.
- "startPage" DEVE ser um número inteiro entre 1 e ${pages.length} indicando a página onde o capítulo começa.
- O primeiro capítulo deve começar na página 1 (ou na primeira página de conteúdo real).
- "startSnippet" deve ser uma frase curta (4 a 10 palavras exatas do início do texto daquele capítulo) para localizar a transição dentro da página.
- "summary" deve ser uma descrição breve de 1 frase em português sobre o conteúdo daquele capítulo.
- Os capítulos devem estar estritamente em ordem crescente de página.

Conteúdo do documento:
${transcript}`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "Título principal da obra ou documento",
              },
              author: {
                type: Type.STRING,
                description: "Nome do autor ou Autor desconhecido",
              },
              summary: {
                type: Type.STRING,
                description: "Resumo breve da obra em português (1-2 frases)",
              },
              chapters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: {
                      type: Type.STRING,
                      description: "Título claro do capítulo",
                    },
                    startPage: {
                      type: Type.INTEGER,
                      description: "Número da página inicial (1-indexed)",
                    },
                    startSnippet: {
                      type: Type.STRING,
                      description: "Trecho exato inicial do capítulo na página",
                    },
                    summary: {
                      type: Type.STRING,
                      description: "Resumo de 1 frase do capítulo",
                    },
                  },
                  required: ["title", "startPage", "startSnippet", "summary"],
                },
              },
            },
            required: ["title", "author", "summary", "chapters"],
          },
        },
      });

      const rawText = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (error: unknown) {
      console.error("Error in /api/analyze-chapters:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Erro ao analisar capítulos com IA.";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voiceName, style } = req.body as {
        text?: string;
        voiceName?: string;
        style?: string;
      };

      const cleanText = (text ?? "").trim();
      if (!cleanText) {
        res.status(400).json({ error: "Texto vazio para síntese de voz." });
        return;
      }

      const selectedVoice =
        voiceName && VALID_VOICES.has(voiceName) ? voiceName : "Kore";

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Chave da API Gemini (GEMINI_API_KEY) não configurada no ambiente."
        );
      }

      const aiTts = new GoogleGenAI({
        apiKey,
        apiVersion: "v1alpha",
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const response = await aiTts.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: cleanText.slice(0, 1800),
                speechMetadata: {
                  style:
                    style ||
                    "Narrador de audiolivro natural, claro, envolvente e com ritmo confortável",
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({
          error: "O modelo não retornou áudio para este trecho.",
        });
        return;
      }

      const wavBuffer = Buffer.from(base64Audio, "base64");
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Content-Length", wavBuffer.length.toString());
      res.send(wavBuffer);
    } catch (error: unknown) {
      console.error("Error in /api/tts:", error);
      const message =
        error instanceof Error ? error.message : "Erro ao gerar áudio natural.";
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VozLivro server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
