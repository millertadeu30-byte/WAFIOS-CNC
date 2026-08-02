import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  // Allow CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { fileData, mimeType } = req.body;
    if (!fileData || !mimeType) {
      return res.status(400).json({ error: "Dados do arquivo ou tipo MIME ausentes no corpo da requisição." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: "A chave API do Gemini (GEMINI_API_KEY) não está configurada nas variáveis de ambiente do Vercel. Por favor, adicione-a no painel de controle do projeto no Vercel." 
      });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    // Technical drawing coordinate extraction prompt (exact match)
    const systemInstruction = `Você é um engenheiro de manufatura especialista em máquinas CNC de dobrar arame (como WAFIOS).
Sua tarefa é analisar o desenho técnico em anexo (PDF ou Imagem) e extrair de forma exata e completa a tabela de coordenadas/dobras e torções (giros) 3D em modo de rotação RELATIVA (Incremental).

REGRAS DE EXTRAÇÃO IMPORTANTES:
1. MODO DE ROTAÇÃO: Use sempre rotationMode = "relative". As coordenadas devem ser incrementais em relação ao trecho anterior.
2. TABELA DE COORDENADAS RELATIVAS:
   - "n": Número do passo (1-based)
   - "l": Comprimento reto (alimentação em mm)
   - "ap": Rotação relativa da máquina AP (giro do arame em torno de seu eixo longitudinal) em graus. Se o plano não muda, envie null (ou 0).
   - "ac": Ângulo de dobra AC (deflexão da máquina) em graus. O ângulo ac define o quão longe a máquina dobra o fio em relação à direção reta (0 graus é reto, > 0 dobra para frente, < 0 dobra para trás, etc). 
   - "r": Raio de dobra em mm.
   - "comment": Nome do trecho em português.

3. MODELO DE REFERÊNCIA (EXEMPLO DE GABARITO DA HASTE BOIA 23321):
   Se o desenho técnico for para a "Haste boia 23321", retorne exatamente a seguinte tabela de 7 passos (sinais exatos, l, ap, ac) usando a rotação RELATIVA (incremental):
   Passo 1: L=7.25, AP=null, AC=90.0, R=1.5, comentário: "Dobra 1"
   Passo 2: L=22.50, AP=-90.0, AC=-60.0, R=1.5, comentário: "Dobra 2 (120° int)"
   Passo 3: L=64.00, AP=null, AC=-67.0, R=1.5, comentário: "Dobra 3 (113° int)"
   Passo 4: L=30.00, AP=90.0, AC=60.0, R=1.5, comentário: "Dobra 4 (120° int)"
   Passo 5: L=74.00, AP=null, AC=-60.0, R=1.5, comentário: "Dobra 5 (120° int)"
   Passo 6: L=51.07, AP=null, AC=90.0, R=1.5, comentário: "Dobra 6 (90° int)"
   Passo 7: L=71.80, AP=null, AC=null, R=1.5, comentário: "Corte E"

4. PADRÃO GERAL:
   Tente identificar os trechos retos que formam pernas de ganchos e as hastes de alinhamento com a mesma técnica (orientação relativa incremental) a partir das medidas cotadas (raios de centro a centro) para calcular os comprimentos úteis retos L, os antigos de dobra AC e as torções AP necessárias entre eles.
   O último passo sempre representa o corte final e deve ter "ac" nulo.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          inlineData: {
            mimeType,
            data: fileData,
          }
        },
        {
          text: "Analise o desenho técnico anexado e gere a tabela de coordenadas completa de passos de dobra para o sistema."
        }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "Nome ou código descritivo do modelo da haste (ex: 'Haste Boia 23321')",
            },
            wireDiameter: {
              type: Type.NUMBER,
              description: "Diâmetro nominal do fio em mm",
            },
            rotationMode: {
              type: Type.STRING,
              description: "Modo padrão de rotação: 'relative' ou 'absolute'",
            },
            steps: {
              type: Type.ARRAY,
              description: "Tabela completa de passos de dobra sequenciais",
              items: {
                type: Type.OBJECT,
                properties: {
                  n: { type: Type.INTEGER, description: "Número sequencial do passo (1-based)" },
                  l: { type: Type.NUMBER, description: "Comprimento da alimentação reto em mm (L)" },
                  ap: { type: Type.NUMBER, description: "Ângulo de rotação AP em graus, ou null se não houver" },
                  ac: { type: Type.NUMBER, description: "Ângulo de dobra AC em graus, ou null se não houver" },
                  r: { type: Type.NUMBER, description: "Raio de dobra em mm" },
                  comment: { type: Type.STRING, description: "Descrição textual curta da seção" },
                },
                required: ["n", "l", "r", "comment"],
              }
            }
          },
          required: ["name", "wireDiameter", "rotationMode", "steps"],
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Resposta de extração vazia recebida do Gemini.");
    }

    const parsedResult = JSON.parse(resultText);
    return res.status(200).json(parsedResult);
  } catch (error: any) {
    console.error("Erro no Vercel Serverless Handler:", error);
    return res.status(500).json({ 
      error: error?.message || "Ocorreu um erro interno ao processar e extrair os dados do desenho técnico via IA." 
    });
  }
}
