"""
Integra Escolar — Autenticação por token (JWT)
================================================
Centraliza a criação e a validação do token de sessão. Qualquer rota que
precise saber "quem está fazendo esta chamada" usa os decorators daqui.

Uso nas rotas:

    from auth_utils import login_obrigatorio, papel_obrigatorio
    from flask import g

    @app.route('/api/alguma-coisa')
    @login_obrigatorio
    def minha_rota():
        usuario_logado = g.usuario   # dados do token (id, perfil, etc.)
        ...

    @app.route('/api/so-gestao')
    @papel_obrigatorio('gestao')
    def outra_rota():
        ...
"""

import os
import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify, g

# A aplicação não inicia com uma chave JWT previsível. Configure JWT_SECRET no .env.
SECRET = os.getenv('JWT_SECRET')
if not SECRET:
    raise RuntimeError('JWT_SECRET não configurada. Copie .env.example para .env e defina uma chave forte.')
ALGORITMO = 'HS256'
HORAS_DE_VALIDADE = 8


def gerar_token(dados_usuario: dict) -> str:
    """Cria um token assinado contendo os dados do usuário logado.
    Expira sozinho depois de HORAS_DE_VALIDADE horas."""
    agora = datetime.now(timezone.utc)
    payload = {
        **dados_usuario,
        'iat': agora,
        'exp': agora + timedelta(hours=HORAS_DE_VALIDADE),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITMO)


def _extrair_token_do_cabecalho():
    """O front-end manda o token no cabeçalho: Authorization: Bearer <token>"""
    cabecalho = request.headers.get('Authorization', '')
    if cabecalho.startswith('Bearer '):
        return cabecalho[7:].strip()
    return None


def login_obrigatorio(f):
    """Bloqueia a rota se não vier um token válido. Disponibiliza os dados
    do usuário logado em g.usuario para o resto da função."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = _extrair_token_do_cabecalho()
        if not token:
            return jsonify({'erro': 'Não autenticado. Faça login novamente.'}), 401
        try:
            payload = jwt.decode(token, SECRET, algorithms=[ALGORITMO])
        except jwt.ExpiredSignatureError:
            return jsonify({'erro': 'Sua sessão expirou. Faça login novamente.'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'erro': 'Token inválido.'}), 401
        g.usuario = payload
        return f(*args, **kwargs)
    return wrapper


def papel_obrigatorio(*papeis_permitidos):
    """Como login_obrigatorio, mas também exige que o perfil do usuário
    (responsavel / professor / gestao / porteiro / administrador) esteja entre os permitidos.
    Uso: @papel_obrigatorio('gestao')  ou  @papel_obrigatorio('gestao', 'porteiro')"""
    def decorator(f):
        @wraps(f)
        def checagem_final(*args, **kwargs):
            token = _extrair_token_do_cabecalho()
            if not token:
                return jsonify({'erro': 'Não autenticado. Faça login novamente.'}), 401
            try:
                payload = jwt.decode(token, SECRET, algorithms=[ALGORITMO])
            except jwt.ExpiredSignatureError:
                return jsonify({'erro': 'Sua sessão expirou. Faça login novamente.'}), 401
            except jwt.InvalidTokenError:
                return jsonify({'erro': 'Token inválido.'}), 401
            if payload.get('perfil') not in papeis_permitidos:
                return jsonify({'erro': 'Você não tem permissão para esta ação.'}), 403
            g.usuario = payload
            return f(*args, **kwargs)
        return checagem_final
    return decorator
