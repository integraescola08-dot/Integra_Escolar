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
# .env, arquivos Python e outros arquivos internos pelo navegador POR FAVOOOOOOR!!!!

app = Flask(__name__, static_folder=str(ASSETS_DIR), static_url_path='/assets')
app.config['UPLOAD_FOLDER'] = str(BASE_DIR / 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024

# Em desenvolvimento, sem CORS_ORIGINS configurada, libera geral (comportamento
# atual, preservado). Em produção, defina CORS_ORIGINS no .env com a(s)
# origem(ns) real(is) do domínio publicado, separadas por vírgula — por
# exemplo: CORS_ORIGINS=https://integraescolar.com.br
_origens_cors = os.getenv('CORS_ORIGINS', '').strip()
if _origens_cors:
    CORS(app, origins=[o.strip() for o in _origens_cors.split(',') if o.strip()])
else:
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


@app.route('/esqueci-senha.html')
def esqueci_senha():
    return send_from_directory(BASE_DIR, 'esqueci-senha.html')


@app.route('/pages/<path:filename>')
def pages(filename):
    return send_from_directory(PAGES_DIR, filename)


@app.route('/modelos/<path:nome_arquivo>')
def modelo_planilha(nome_arquivo):
    # Só serve os modelos de planilha (import de grade/disciplinas/professores/
    # alunos); send_from_directory já impede path traversal, e o filtro de nome
    # evita servir qualquer outro arquivo que caia nessa pasta por engano.
    if not (nome_arquivo.startswith('modelo_') and nome_arquivo.endswith('.xlsx')):
        abort(404)
    return send_from_directory(BASE_DIR / 'modelos', nome_arquivo, as_attachment=True, download_name=nome_arquivo)


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

# ==========================================
# Desenvolvido por: Buarque
# TCC - Sistema Web
# "Buarque esteve aqui"
# ==========================================
