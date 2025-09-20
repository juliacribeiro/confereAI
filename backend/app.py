from flask import Flask, request, jsonify
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import os
import time
from fake import verificar_fake_news
import json

load_dotenv()
API_KEY_VIRUSTOTAL = os.getenv("API_KEY_VIRUSTOTAL")

app = Flask(__name__)

load_dotenv()

API_KEY_VIRUSTOTAL = os.getenv("KEY_VIRUSTOTAL")

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
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36"
        }
        resp = requests.get(url, timeout=10, headers=headers)
        soup = BeautifulSoup(resp.text, "html.parser")

        title = soup.find("title").get_text() if soup.find("title") else ""

        candidate_paragraphs = soup.find("article").find_all("p") if (article := soup.find("article")) else soup.find_all("p")

        paragraphs = []
        for p in candidate_paragraphs:
            if p.string and p.string.strip():  
                paragraphs.append(p.string.strip())
            else:
                text = p.get_text(strip=True)
                if len(text.split()) > 5:
                    paragraphs.append(text)

        full_text = " ".join(paragraphs).strip()

    except Exception as e:
        return jsonify({"error": f"Falha ao acessar URL: {e}"}), 500

    answer = verificar_fake_news(full_text)

    # 4) VirusTotal - enviar URL para análise
    stats = {}
    try:
        post_response = requests.post(
            "https://www.virustotal.com/api/v3/urls",
            headers={"x-apikey": API_KEY_VIRUSTOTAL},
            data={"url": url}
        )

        if post_response.status_code != 200:
            vt_result = {"error": "Falha ao enviar URL para análise."}
        else:
            analysis_id = post_response.json()["data"]["id"]

            # Consultar resultado da análise
            # Pode ser necessário aguardar alguns segundos
            time.sleep(5)

            get_response = requests.get(
                f"https://www.virustotal.com/api/v3/analyses/{analysis_id}",
                headers={"x-apikey": API_KEY_VIRUSTOTAL}
            )
            vt_result = get_response.json()
            data = vt_result.get("data", {})
            attributes = data.get("attributes", {})
            stats = attributes.get("stats", {})

    except Exception as e:
        return jsonify({"error": f"Falha ao consultar VirusTotal: {e}"})


    # 5) Retorno JSON

    return jsonify({
    "titulo": title,
    "classificacao": answer["valor"],
    "explicacao": answer["justificativa"],
    "virustotal": {
        "malicioso": stats.get("malicious", -1),
        "suspeito": stats.get("suspicious", -1),
        "nao_detectado": stats.get("undetected", -1),
        "inofensivo": stats.get("harmless", -1),
    }
})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
