// Supabase Edge Function: geração de flashcards/quizzes com a API do Claude.
// A chave fica no secret ANTHROPIC_API_KEY (supabase secrets set) — nunca no app.
//
// POST { content_type: 'pdf'|'image'|'text'|'docx', content: string (base64 ou
// texto), mode: 'flashcards'|'quiz', count?: number, language?: string }
//
// 200 → { mode, cards: [...] }
// 4xx/5xx → { error: string (código estável), message: string (para a UI) }

import { Buffer } from "node:buffer";
import mammoth from "npm:mammoth@1.11.0";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
// Haiku: mais barato e suficiente para extração/geração de cards.
const MODEL = "claude-haiku-4-5-20251001";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ContentType = "pdf" | "image" | "text" | "docx";
type Mode = "flashcards" | "quiz";

interface GenerateRequest {
  content_type: ContentType;
  content: string;
  mode: Mode;
  count?: number;
  language?: string;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Detecta o media type de uma imagem base64 pelos bytes iniciais. */
function detectImageMediaType(b64: string): string {
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("R0lGOD")) return "image/gif";
  if (b64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

/** Extrai o texto de um .docx (a API do Claude não lê .docx nativamente). */
async function extractDocxText(b64: string): Promise<string> {
  const buffer = Buffer.from(b64, "base64");
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

function buildSystemPrompt(mode: Mode, count: number, language: string): string {
  const schema =
    mode === "flashcards"
      ? `[{ "front": string (pergunta ou conceito), "back": string (resposta ou explicação) }]`
      : `[{ "question": string, "options": string[] (exatamente 4 alternativas), "correct_index": number (0-3, índice da correta), "explanation": string (explicação curta da resposta) }]`;

  return `Você gera material de estudo a partir do conteúdo enviado pelo usuário.

Regras:
- Leia o conteúdo enviado (texto, PDF ou imagem) e gere EXATAMENTE ${count} ${
    mode === "flashcards" ? "flashcards" : "questões de múltipla escolha"
  } relevantes e bem formuladas sobre ele.
- Escreva tudo em ${language}.
- Cada item deve ser conciso e focado em uma única ideia.
${
    mode === "quiz"
      ? "- As alternativas erradas devem ser plausíveis, relacionadas à pergunta e no mesmo estilo/tamanho da correta. Nunca repita a correta entre as erradas.\n"
      : ""
  }- Responda APENAS com JSON válido, sem markdown, sem cercas de código e sem nenhum texto antes ou depois.
- Schema da resposta: ${schema}
- Se o conteúdo enviado for insuficiente ou irrelevante para gerar material de qualidade, responda apenas: { "error": "conteudo_insuficiente" }`;
}

/** Remove cercas ```json e extrai o primeiro JSON (array ou objeto) do texto. */
function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error("sem JSON na resposta");
  const candidate = cleaned.slice(start);
  // Tenta o texto inteiro; se falhar, tenta recortar até o último ] ou }.
  try {
    return JSON.parse(candidate);
  } catch {
    const end = Math.max(candidate.lastIndexOf("]"), candidate.lastIndexOf("}"));
    return JSON.parse(candidate.slice(0, end + 1));
  }
}

function validateCards(mode: Mode, data: unknown): unknown[] | null {
  if (!Array.isArray(data)) return null;
  if (mode === "flashcards") {
    const cards = data.filter(
      (c) =>
        c != null &&
        typeof c.front === "string" &&
        c.front.trim().length > 0 &&
        typeof c.back === "string" &&
        c.back.trim().length > 0,
    );
    return cards.length > 0 ? cards : null;
  }
  const questions = data
    .filter(
      (q) =>
        q != null &&
        typeof q.question === "string" &&
        q.question.trim().length > 0 &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.options.every(
          (o: unknown) => typeof o === "string" && o.trim().length > 0,
        ) &&
        typeof q.correct_index === "number" &&
        q.correct_index >= 0 &&
        q.correct_index <= 3,
    )
    .map((q) => ({
      question: q.question,
      options: q.options,
      correct_index: q.correct_index,
      explanation: typeof q.explanation === "string" ? q.explanation : "",
    }));
  return questions.length > 0 ? questions : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed", message: "Use POST." });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json(500, {
      error: "config",
      message:
        "ANTHROPIC_API_KEY não configurada. Rode: supabase secrets set ANTHROPIC_API_KEY=...",
    });
  }

  // ── Validação do body ──────────────────────────────────────────────────────
  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_request", message: "Body JSON inválido." });
  }

  const { content_type, mode } = body;
  const content = typeof body.content === "string" ? body.content : "";
  const count = Math.min(Math.max(Math.round(body.count ?? 10), 1), 30);
  const language = body.language || "pt-BR";

  if (!["pdf", "image", "text", "docx"].includes(content_type)) {
    return json(400, {
      error: "bad_request",
      message: "content_type deve ser pdf, image, text ou docx.",
    });
  }
  if (!["flashcards", "quiz"].includes(mode)) {
    return json(400, {
      error: "bad_request",
      message: "mode deve ser flashcards ou quiz.",
    });
  }
  if (content.trim().length === 0) {
    return json(400, { error: "bad_request", message: "content vazio." });
  }

  // ── Monta os blocos de conteúdo para o Claude ──────────────────────────────
  const userBlocks: unknown[] = [];
  try {
    if (content_type === "pdf") {
      userBlocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: content,
        },
      });
      userBlocks.push({ type: "text", text: "Gere o material a partir deste PDF." });
    } else if (content_type === "image") {
      userBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: detectImageMediaType(content),
          data: content,
        },
      });
      userBlocks.push({ type: "text", text: "Gere o material a partir desta imagem." });
    } else {
      // text puro, ou docx com texto extraído localmente via mammoth.
      const text =
        content_type === "docx" ? await extractDocxText(content) : content;
      if (text.trim().length === 0) {
        return json(422, {
          error: "conteudo_insuficiente",
          message: "Não foi possível extrair texto do arquivo enviado.",
        });
      }
      userBlocks.push({ type: "text", text: `Conteúdo:\n\n${text.slice(0, 100_000)}` });
    }
  } catch {
    return json(422, {
      error: "conteudo_insuficiente",
      message: "Não foi possível ler o arquivo enviado (está corrompido?).",
    });
  }

  // ── Chamada à API do Claude ────────────────────────────────────────────────
  // ~150 tokens por flashcard; quiz tem 4 alternativas + explicação (~300).
  const perItem = mode === "quiz" ? 300 : 150;
  const maxTokens = Math.min(Math.max(1024, count * perItem + 500), 8192);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: buildSystemPrompt(mode, count, language),
      messages: [{ role: "user", content: userBlocks }],
    }),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      error?: { type?: string; message?: string };
    };
    const upstreamMsg = err.error?.message ?? "";

    // Créditos esgotados: a Anthropic responde 400 com mensagem de billing.
    if (/credit balance|billing|purchase/i.test(upstreamMsg)) {
      return json(402, {
        error: "no_credits",
        message: "Créditos da API esgotados. Tente novamente mais tarde.",
      });
    }
    if (response.status === 401) {
      return json(500, {
        error: "invalid_api_key",
        message: "Erro de configuração do servidor (chave da API inválida).",
      });
    }
    if (response.status === 429) {
      return json(429, {
        error: "rate_limit",
        message: "Muitas gerações em sequência. Tente de novo em instantes.",
      });
    }
    if (response.status === 529) {
      return json(503, {
        error: "overloaded",
        message: "A IA está sobrecarregada agora. Tente de novo em instantes.",
      });
    }
    return json(502, {
      error: "upstream",
      message: upstreamMsg || `Erro na API da IA (${response.status}).`,
    });
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.find((b) => b.type === "text")?.text ?? "";

  // ── Parse e validação do JSON gerado ───────────────────────────────────────
  let parsed: unknown;
  try {
    parsed = extractJson(text);
  } catch {
    return json(500, {
      error: "resposta_invalida",
      message: "A IA não retornou JSON válido. Tente novamente.",
    });
  }

  if (
    parsed != null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    (parsed as { error?: string }).error === "conteudo_insuficiente"
  ) {
    return json(422, {
      error: "conteudo_insuficiente",
      message:
        "O conteúdo enviado é insuficiente para gerar material de qualidade. Envie um texto/arquivo com mais substância.",
    });
  }

  const cards = validateCards(mode, parsed);
  if (cards == null) {
    return json(500, {
      error: "resposta_invalida",
      message: "A resposta da IA não segue o formato esperado. Tente novamente.",
    });
  }

  return json(200, { mode, cards });
});
