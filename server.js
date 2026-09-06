import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(cors()); // em produção, troque por: cors({ origin: "https://SEU-USUARIO.github.io" })
app.use(express.json({ limit: "2mb" }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// ---------- helper: pede JSON puro ao Claude e faz o parse com segurança ----------
async function askForJSON({ system, user, useWebSearch = false }) {
  const params = {
    model: MODEL,
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: user }],
  };
  if (useWebSearch) {
    params.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }

  const response = await anthropic.messages.create(params);

  // Junta todos os blocos de texto (pode haver texto + uso de ferramenta + texto final)
  const textBlocks = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const cleaned = textBlocks
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Falha ao fazer parse do JSON retornado pelo Claude:\n", cleaned);
    throw new Error("A IA não retornou um JSON válido. Tente novamente.");
  }
}

// ---------- 1) TENDÊNCIAS / CENTRAL DE NOVIDADES ----------
app.post("/api/trends", async (req, res) => {
  try {
    const { niche, description } = req.body;
    if (!niche) return res.status(400).json({ error: "Informe o nicho." });

    const system = `Você é um estrategista de conteúdo para redes sociais especializado no nicho informado.
Sua tarefa é usar a busca na web para encontrar de 6 a 10 assuntos ATUAIS (notícias, tendências, curiosidades, dados/estatísticas, polêmicas ou perguntas frequentes) relevantes para esse profissional postar hoje.
Responda APENAS com um JSON válido, sem nenhum texto antes ou depois, seguindo exatamente este formato:
{
  "topics": [
    {
      "title": "string curta, o gancho/assunto em si",
      "category": "noticia" | "curiosidade" | "tendencia" | "dado" | "polemica" | "pergunta_frequente" | "data_comemorativa",
      "score": number de 0 a 100,
      "engagement": { "comentarios": "baixo"|"medio"|"alto"|"muito_alto", "compartilhamento": "baixo"|"medio"|"alto"|"muito_alto", "salvamentos": "baixo"|"medio"|"alto"|"muito_alto" },
      "why": "uma frase curta explicando por que esse assunto está em alta agora",
      "source": "nome da fonte, se houver, ou vazio"
    }
  ]
}
Ordene por "score" decrescente.`;

    const user = `Nicho: ${niche}
Descrição do profissional: ${description || "não informada"}`;

    const data = await askForJSON({ system, user, useWebSearch: true });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Erro ao buscar tendências." });
  }
});

// ---------- 2) GANCHOS ----------
app.post("/api/hooks", async (req, res) => {
  try {
    const { niche, topic } = req.body;
    if (!niche || !topic) return res.status(400).json({ error: "Informe nicho e assunto." });

    const system = `Você escreve ganchos (primeira linha / abertura) de alta retenção para posts de Instagram.
Responda APENAS com um JSON válido neste formato:
{ "hooks": ["gancho 1", "gancho 2", "... até 10 ganchos"] }
Os ganchos devem ser curtos, específicos ao nicho e ao assunto, variados em estilo (pergunta, afirmação polêmica, dado, alerta, história), sem hashtags e sem emojis em excesso.`;

    const user = `Nicho: ${niche}\nAssunto: ${topic}`;

    const data = await askForJSON({ system, user });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Erro ao gerar ganchos." });
  }
});

// ---------- 3) COPY / CONTEÚDO FINAL ----------
app.post("/api/copy", async (req, res) => {
  try {
    const {
      niche, description, topic, format, subformat,
      designPattern, tone, objective, hook, slideCount,
    } = req.body;

    if (!niche || !topic || !format) {
      return res.status(400).json({ error: "Faltam dados obrigatórios (nicho, assunto, formato)." });
    }

    const system = `Você é um copywriter especialista em redes sociais para o nicho informado.
Gere o conteúdo completo para uma publicação, respeitando exatamente o tom e o objetivo pedidos.
Responda APENAS com um JSON válido neste formato:
{
  "title": "título curto de apoio visual (para usar no design)",
  "slides": ["texto do slide 1", "texto do slide 2", "..."],
  "caption": "legenda completa para a publicação, pronta para colar no Instagram",
  "hashtags": ["#tag1", "#tag2"],
  "cta": "chamada para ação curta e específica"
}
Se o formato for "story" e não for carrossel, "slides" deve ter só 1 item.
Se for carrossel, gere entre 4 e ${slideCount || 7} slides, com progressão lógica (abertura com o gancho, desenvolvimento, fechamento com CTA).`;

    const user = `Nicho: ${niche}
Descrição do profissional: ${description || "não informada"}
Assunto escolhido: ${topic}
Formato: ${format} / ${subformat || ""}
Padrão de design: ${designPattern || "não especificado"}
Tom desejado: ${tone}
Objetivo: ${objective}
Gancho escolhido: ${hook || "crie um gancho adequado"}`;

    const data = await askForJSON({ system, user });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Erro ao gerar o conteúdo." });
  }
});

app.get("/", (_req, res) => res.send("Content Studio backend está no ar."));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));
