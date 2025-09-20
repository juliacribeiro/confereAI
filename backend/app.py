from flask import Flask, request, jsonify
import requests
from bs4 import BeautifulSoup

app = Flask(__name__)

# ---------- /analyze ----------
@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    url = data.get("url")

    if not url:
        return jsonify({"error": "URL não fornecida"}), 400

    # 1) Extrair texto da notícia
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36"}
        resp = requests.get(url, timeout=10, headers=headers)
        soup = BeautifulSoup(resp.text, "html.parser")
        title = soup.find("title").get_text() if soup.find("title") else ""
        paragraphs = [p.get_text() for p in soup.find_all("p")]
        full_text = " ".join(paragraphs)
        print(full_text)
    except Exception as e:
        return jsonify({"error": f"Falha ao acessar URL: {e}"}), 500

    # 2) Se texto muito longo → resumir (mock por enquanto)
    if len(full_text) > 3000:
        # MELHORAR ISSO AQUI
        resumo = full_text[:500] + "..."
    else:
        resumo = full_text

    # 3) Validação (mock por enquanto, IA entra aqui depois)
    classificacao = "Possível Fake" if "!" in resumo else "Confiável"
    explicacao = "Mock: Classificação baseada em regra simples."

    # 4) Retorno JSON
    return jsonify({
        "titulo": title,
        "resumo": resumo[:500],
        "classificacao": classificacao,
        "explicacao": explicacao
    })

@app.route("/news", methods=["GET"])
def news():
    return jsonify({
        "news": [
            {"title": "Ex-delegado executado: terceiro suspeito de envolvimento no crime é preso", "url": "https://www.cnnbrasil.com.br/nacional/sudeste/sp/ex-delegado-executado-terceiro-suspeito-de-envolvimento-no-crime-e-preso/"},
        ]
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
