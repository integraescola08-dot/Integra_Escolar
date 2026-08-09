import os
from flask import Flask, send_from_directory, abort, g
from flask_cors import CORS
from pathlib import Path

from routes.auth import auth_bp
from routes.alunos import alunos_bp
from routes.ocorrencias import ocorrencias_bp
from routes.horarios import horarios_bp
from routes.admin import admin_bp
from auth_utils import login_obrigatorio
from db import fetch_one

BASE_DIR = Path(__file__).resolve().parent

# IMPORTANTE: static_folder=None desativa o comportamento padrão do Flask de
# servir QUALQUER arquivo da pasta raiz via HTTP. Antes disso, arquivos como
# .env, db.py e database/*.sql ficavam acessíveis publicamente (ex.:
# seusite.com/.env). Agora só expomos explicitamente o que é público:
# assets/, pages/, index.html, cadastro.html e uploads/.
app = Flask(__name__, static_folder=None)
app.config['UPLOAD_FOLDER'] = str(BASE_DIR / 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024

# Em produção, defina CORS_ORIGINS no .env com a(s) URL(s) reais do
# front-end, separadas por vírgula (ex.: https://integraescolar.com.br).
# Sem essa variável, cai no padrão "*" (aberto) — adequado só para
# desenvolvimento local.
origens = os.getenv('CORS_ORIGINS', '*')
CORS(app, origins=origens.split(',') if origens != '*' else '*')

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(alunos_bp, url_prefix='/api/alunos')
app.register_blueprint(ocorrencias_bp, url_prefix='/api/ocorrencias')
app.register_blueprint(horarios_bp, url_prefix='/api/horarios')
app.register_blueprint(admin_bp, url_prefix='/api/admin')

@app.route('/')
@app.route('/index.html')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/cadastro.html')
def cadastro():
    return send_from_directory(BASE_DIR, 'cadastro.html')

@app.route('/assets/<path:filename>')
def assets(filename):
    return send_from_directory(BASE_DIR / 'assets', filename)

@app.route('/pages/<path:filename>')
def pages(filename):
    # Bloqueia tentativas de "escapar" da pasta pages/ via ../
    caminho = (BASE_DIR / 'pages' / filename).resolve()
    if not str(caminho).startswith(str((BASE_DIR / 'pages').resolve())):
        abort(404)
    return send_from_directory(BASE_DIR / 'pages', filename)

@app.route('/uploads/<path:filename>')
@login_obrigatorio
def uploaded_file(filename):
    # Atestados/declarações contêm dado sensível (saúde), então não basta
    # estar logado: só quem tem motivo legítimo pode abrir — a gestão, que
    # precisa validar o documento, ou o próprio responsável que o enviou.
    if g.usuario.get('perfil') != 'gestao':
        ocorrencia = fetch_one('SELECT id_responsavel FROM Ocorrencia WHERE arquivo = %s', (filename,))
        id_responsavel_logado = (g.usuario.get('pessoa') or {}).get('id')
        eh_dono = ocorrencia and ocorrencia['id_responsavel'] == id_responsavel_logado
        if not eh_dono:
            abort(403)
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    # debug=True nunca deve ir para produção: ativa o Werkzeug Debugger,
    # que permite executar código Python arbitrário pelo navegador quando
    # uma exceção acontece. Controlado por FLASK_DEBUG no .env — deixe
    # ausente/"0" em produção.
    debug_ligado = os.getenv('FLASK_DEBUG', '0') == '1'
    app.run(debug=debug_ligado)
