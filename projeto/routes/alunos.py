from flask import Blueprint, request, jsonify, g
from db import fetch_all
from auth_utils import login_obrigatorio

alunos_bp = Blueprint('alunos', __name__)

@alunos_bp.route('', methods=['GET'])
@login_obrigatorio
def listar_alunos():
    id_responsavel = request.args.get('id_responsavel')
    turma = request.args.get('turma')

    # Um responsável só pode listar os próprios estudantes — mesmo que tente
    # passar outro id_responsavel na URL, o valor do token sempre vence.
    if g.usuario.get('perfil') == 'responsavel':
        id_responsavel = g.usuario['pessoa']['id']

    sql = """
        SELECT a.matricula, a.nome, a.turma, t.descricao, a.id_responsavel
        FROM Aluno a
        LEFT JOIN Turma t ON t.codigo = a.turma
        WHERE 1=1
    """
    params = []
    if id_responsavel:
        sql += ' AND a.id_responsavel = %s'
        params.append(id_responsavel)
    if turma:
        sql += ' AND a.turma = %s'
        params.append(turma)
    sql += ' ORDER BY a.nome'
    return jsonify(fetch_all(sql, tuple(params)))

@alunos_bp.route('/turmas', methods=['GET'])
@login_obrigatorio
def listar_turmas():
    return jsonify(fetch_all('SELECT codigo, descricao FROM Turma ORDER BY codigo'))
