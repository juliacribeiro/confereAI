import os
from dotenv import load_dotenv
from openai import OpenAI
import json

MODEL = "gpt-4o-mini"

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def verificar_fake_news(texto: str) -> dict:
    """
    Retorna um dicionário com:
    - 'valor': 0 se provavelmente falso, 1 se provavelmente verdadeiro, 2 se incerto
    - 'justificativa': explicação detalhada
    """
    prompt = f"""
Você é um verificador de fatos. Vou te enviar um texto de notícia ou postagem de rede social. Sua tarefa é:

1. Determinar se o texto é **provavelmente verdadeiro**, **provavelmente falso** ou **incerto**.
2. Retornar apenas **um valor numérico** seguido de **uma justificativa em parágrafo**:
   - 0 = provavelmente falso ou enviesado
   - 1 = provavelmente verdadeiro
   - 2 = incerto
3. No parágrafo de justificativa, explique claramente os motivos da avaliação, apontando informações inconsistentes, exageros ou manipulações, e, se possível, inclua links de fact-checking confiáveis. Se o valor for provavelmente falso ou enviesado mas se referir a partes específicas do artigo, retorne um parágrafo de justificativa para cada trecho.
4. Lembre-se de verificar trecho por trecho, qualquer informação falsa, mesmo que não seja o assunto principal do texto, deve tornar o valor provavelmente falso e ser justificada.

Aqui está o texto a ser analisado:\n\n{texto}\n\n

**Formato de resposta esperado (JSON):**
VALOR: <0|1|2>
JUSTIFICATIVA: ["<justificativa 1>", "<justificativa 2>", ...]
"""

    resposta = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": "Você é um jornalista que investiga fake news."},
            {"role": "user", "content": prompt}
        ],
        temperature=0,
    )

    conteudo = resposta.choices[0].message.content.strip()

    valor, justificativa = None, []
    try:
        data = json.loads(conteudo)
        valor = data.get("VALOR", None)
        justificativa = data.get("JUSTIFICATIVA", [])
        if not isinstance(justificativa, list):
            justificativa = [justificativa]
        return {"valor": valor, "justificativa": justificativa}
    except json.JSONDecodeError:
        return {"valor": None, "justificativa": [conteudo]}
    