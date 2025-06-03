from flask import Flask, render_template, request, redirect, url_for
import sqlite3
import os

app = Flask(__name__)

# Banco de dados
def criar_banco():
    conn = sqlite3.connect('bordados.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS bordados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            formato TEXT,
            caminho TEXT
        )
    ''')
    conn.commit()
    conn.close()

@app.route('/')
def index():
    conn = sqlite3.connect('bordados.db')
    c = conn.cursor()
    c.execute("SELECT * FROM bordados")
    bordados = c.fetchall()
    conn.close()
    return render_template('index.html', bordados=bordados)

@app.route('/adicionar', methods=['POST'])
def adicionar():
    file = request.files['arquivo']
    if file:
        nome = file.filename
        formato = nome.split('.')[-1]
        caminho = os.path.join('uploads', nome)
        os.makedirs('uploads', exist_ok=True)
        file.save(caminho)

        conn = sqlite3.connect('bordados.db')
        c = conn.cursor()
        c.execute("INSERT INTO bordados (nome, formato, caminho) VALUES (?, ?, ?)",
                  (nome, formato, caminho))
        conn.commit()
        conn.close()
    return redirect(url_for('index'))

@app.route('/remover/<int:id>')
def remover(id):
    conn = sqlite3.connect('bordados.db')
    c = conn.cursor()
    c.execute("DELETE FROM bordados WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return redirect(url_for('index'))

# Criação do banco na inicialização
criar_banco()
