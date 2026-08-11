import os
from pathlib import Path

from flask import Flask, send_from_directory, abort, g
from flask_cors import CORS
from dotenv import load_dotenv

from routes.auth import auth_bp
from routes.alunos import alunos_bp
from routes.ocorrencias import ocorrencias_bp
from routes.horarios import horarios_bp
from routes.admin import admin_bp
from auth_utils import login_obrigatorio
from db import fetch_one

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent
PAGES_DIR = BASE_DIR / 'pages'
ASSETS_DIR = BASE_DIR / 'assets'

# Não use a raiz inteira do projeto como pasta estática: isso poderia expor
# .env, arquivos Python e outros arquivos internos pelo navegador.
app = Flask(__name__, static_folder=str(ASSETS_DIR), static_url_path='/assets')
app.config['UPLOAD_FOLDER'] = str(BASE_DIR / 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024
CORS(app)

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(alunos_bp, url_prefix='/api/alunos')
app.register_blueprint(ocorrencias_bp, url_prefix='/api/ocorrencias')
app.register_blueprint(horarios_bp, url_prefix='/api/horarios')
app.register_blueprint(admin_bp, url_prefix='/api/admin')


@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/index.html')
def index_html():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/cadastro.html')
def cadastro():
    return send_from_directory(BASE_DIR, 'cadastro.html')


@app.route('/pages/<path:filename>')
def pages(filename):
    return send_from_directory(PAGES_DIR, filename)


@app.route('/uploads/<path:filename>')
@login_obrigatorio
def uploaded_file(filename):
    # Atestados/declarações são documentos sensíveis.
    perfil = g.usuario.get('perfil')
    if perfil not in ('gestao', 'administrador'):
        ocorrencia = fetch_one('SELECT id_responsavel FROM Ocorrencia WHERE arquivo = %s', (filename,))
        id_resp = (g.usuario.get('pessoa') or {}).get('id') if perfil == 'responsavel' else None
        if not ocorrencia or ocorrencia['id_responsavel'] != id_resp:
            abort(403)
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


if __name__ == '__main__':
    debug = os.getenv('FLASK_DEBUG', '0') == '1'
    app.run(debug=debug)
