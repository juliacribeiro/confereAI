# 📌 Confere.AI

Extensão do Chrome que acessa a URL da sua aba atual em tempo real, analisa o conteúdo (caso seja um site público) e informa se a notícia é:

- ✅ Possivelmente verdadeira  
- ❌ Possivelmente falsa  
- ⚠️ Incerta  

## 🛠 Requisitos

- Python 3.x 
- Google Chrome  

---

## 🚀 Executando

### 1. Configurando o ambiente
```bash
python -m venv venv  
venv/Scripts/activate  # Windows
source venv/bin/activate  # Linux/MacOS

pip install dotenv flask requests beautifulsoup4 openai
python app.py
```

### 2. Configurando o ambiente

- Abra o Google Chrome e acesse: <chrome://extensions/>
- Ative o Modo desenvolvedor (canto superior direito).
- Clique em Carregar sem compactação (canto superior esquerdo).
- Selecione a pasta plugin deste repositório.
- Para uma melhor experiência, fixe a extensão na barra do navegador.

> Pronto! A extensão já está corretamente configurada e te mostrará os resultados da análise sobre a veracidade das notícias que você está lendo. Lembre-se que a Inteligência Artificial não garante 100% de veracidade e a melhor maneira de conferir uma notícia é indo atrás de fontes oficiais, a extensão serve como **suporte**.

