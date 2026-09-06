import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors()); // em produção, troque por: cors({ origin: "https://SEU-USUARIO.github.io" })
app.use(express.json({ limit: "2mb" }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"; // modelo do nível gratuito

// ---------- helper: pede JSON puro ao Gemini e faz o parse com segurança ----------
async function askForJSON({ system, user }) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY não configurada no servidor.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.9,
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Erro da API do Gemini:", errText);
    throw new Error(`A IA retornou um erro (${resp.status}). Verifique sua GEMINI_API_KEY e o limite gratuito.`);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";

  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Falha ao fazer parse do JSON retornado pelo Gemini:\n", cleaned);
    throw new Error("A IA não retornou um JSON válido. Tente novamente.");
  }
}

// ---------- 1) TENDÊNCIAS / CENTRAL DE NOVIDADES ----------
// Observação: o nível gratuito do Gemini não inclui busca ao vivo na web,
// então os assuntos vêm do conhecimento do modelo (ótimos para temas
// atemporais, sazonais e recorrentes do nicho — não são notícias do dia).
app.post("/api/trends", async (req, res) => {
  try {
    const { niche, description } = req.body;
    if (!niche) return res.status(400).json({ error: "Informe o nicho." });

    const system = `Você é um estrategista de conteúdo para redes sociais especializado no nicho informado.
Sua tarefa é sugerir de 6 a 10 assuntos relevantes para esse profissional postar (curiosidades, dúvidas comuns, dados/estatísticas conhecidas, mitos e verdades, polêmicas do nicho, datas comemorativas relacionadas). Baseie-se no que normalmente gera engajamento nesse nicho.
Responda APENAS com um JSON válido, sem nenhum texto antes ou depois, seguindo exatamente este formato:
{
  "topics": [
    {
      "title": "string curta, o gancho/assunto em si",
      "category": "curiosidade" | "tendencia" | "dado" | "polemica" | "pergunta_frequente" | "data_comemorativa",
      "score": number de 0 a 100,
      "engagement": { "comentarios": "baixo"|"medio"|"alto"|"muito_alto", "compartilhamento": "baixo"|"medio"|"alto"|"muito_alto", "salvamentos": "baixo"|"medio"|"alto"|"muito_alto" },
      "why": "uma frase curta explicando por que esse assunto costuma engajar",
      "source": ""
    }
  ]
}
Ordene por "score" decrescente. Varie as categorias.`;

    const user = `Nicho: ${niche}
Descrição do profissional: ${description || "não informada"}`;

    const data = await askForJSON({ system, user });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Erro ao buscar sugestões de assuntos." });
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

// ---------- 4) HOJE (posts prontos pra hoje) ----------
app.post("/api/hoje", async (req, res) => {
  try {
    const { niche, description } = req.body;
    if (!niche) return res.status(400).json({ error: "Informe o nicho." });

    const system = `Você é um estrategista de conteúdo para redes sociais especializado no nicho informado.
Gere 4 posts prontos para publicar HOJE, variados entre si (não repita o mesmo ângulo).
Responda APENAS com um JSON válido neste formato:
{ "posts": [ { "titulo": "string curta", "legenda": "legenda completa, pronta para colar no Instagram, com gancho na primeira linha", "categoria": "Dicas e cuidados" | "Bastidores" | "Mitos e verdades" | "Chamadas" | "Outros" } ] }`;
    const user = `Nicho: ${niche}\nDescrição do profissional: ${description || "não informada"}`;
    const data = await askForJSON({ system, user });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Erro ao gerar posts de hoje." });
  }
});

// ---------- 5) GUIA (conteúdo evergreen educativo) ----------
app.post("/api/guia", async (req, res) => {
  try {
    const { niche, description } = req.body;
    if (!niche) return res.status(400).json({ error: "Informe o nicho." });

    const system = `Você é um estrategista de conteúdo para redes sociais especializado no nicho informado.
Gere 5 ideias de conteúdo educativo "evergreen" (que nunca envelhece): técnicas, cuidados e boas práticas do nicho.
Responda APENAS com um JSON válido neste formato:
{ "items": [ { "titulo": "string curta", "legenda": "legenda completa, pronta para colar no Instagram" } ] }`;
    const user = `Nicho: ${niche}\nDescrição do profissional: ${description || "não informada"}`;
    const data = await askForJSON({ system, user });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Erro ao gerar conteúdo do guia." });
  }
});

// ---------- 6) FRASES (citações/motivacionais do nicho) ----------
app.post("/api/frases", async (req, res) => {
  try {
    const { niche, description } = req.body;
    if (!niche) return res.status(400).json({ error: "Informe o nicho." });

    const system = `Você escreve frases curtas e inspiradoras ligadas ao nicho informado, para usar em artes de Instagram (modelos "Frase" e "Cofre").
Gere 8 frases variadas: algumas motivacionais, outras reflexivas, outras diretas.
Responda APENAS com um JSON válido neste formato:
{ "frases": [ { "texto": "frase curta, sem aspas", "autor": "" } ] }`;
    const user = `Nicho: ${niche}\nDescrição do profissional: ${description || "não informada"}`;
    const data = await askForJSON({ system, user });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Erro ao gerar frases." });
  }
});

app.get("/", (_req, res) => res.send("Content Studio backend (Gemini) está no ar."));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));
