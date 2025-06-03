# Gestor de Bordados Web

Sistema simples de gerenciamento de arquivos de bordados via web.

## 🚀 Como rodar localmente

1. Instale as dependências:

```
pip install -r requirements.txt
```

2. Execute o app:

```
python app.py
```

3. Acesse no navegador:

```
http://127.0.0.1:5000
```

## 🌐 Como fazer deploy no Render

1. Crie um repositório no GitHub e envie todos os arquivos.
2. Vá até [https://render.com](https://render.com) e crie um novo Web Service.
3. Configure:
- Environment: Python
- Build command: (deixe vazio)
- Start command:

```
gunicorn app:app
```

4. Clique em "Create Web Service". Seu site estará online!

---
✔️ Estrutura dos arquivos:
- app.py
- requirements.txt
- render.yaml
- templates/index.html
- uploads/ (criada automaticamente)
