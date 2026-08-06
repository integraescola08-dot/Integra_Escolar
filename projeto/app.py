from flask import Flask, send_from_directory
from flask_cors import CORS
from pathlib import Path

from routes.auth import auth_bp
from routes.alunos import alunos_bp
from routes.ocorrencias import ocorrencias_bp
from routes.horarios import horarios_bp
from routes.admin import admin_bp

BASE_DIR = Path(__file__).resolve().parent

app = Flask(__name__, static_folder='.', static_url_path='')
app.config['UPLOAD_FOLDER'] = str(BASE_DIR / 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024
CORS(app)

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(alunos_bp, url_prefix='/api/alunos')
app.register_blueprint(ocorrencias_bp, url_prefix='/api/ocorrencias')
app.register_blueprint(horarios_bp, url_prefix='/api/horarios')
app.register_blueprint(admin_bp, url_prefix='/api/admin')

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    app.run(debug=True)
