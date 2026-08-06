from flask import Blueprint, request, jsonify, g
from db import fetch_all
from auth_utils import login_obrigatorio

horarios_bp = Blueprint('horarios', __name__)

@horarios_bp.route('', methods=['GET'])
@login_obrigatorio
def listar_horarios():
    turma = request.args.get('turma')
    professor = request.args.get('matricula_professor')

    # Um professor só pode consultar o próprio horário, mesmo que tente
    # passar outra matrícula na URL — o valor do token sempre vence.
    if g.usuario.get('perfil') == 'professor':
        professor = g.usuario['pessoa']['id']

    sql = """
        SELECT h.*, p.nome AS professor_nome
        FROM Horario h
        JOIN Professor p ON p.matricula = h.matricula_professor
        WHERE 1=1
    """
    params = []
    if turma:
        sql += ' AND h.turma = %s'
        params.append(turma)
    if professor:
        sql += ' AND h.matricula_professor = %s'
        params.append(professor)
    sql += ' ORDER BY FIELD(h.dia_da_semana, "Segunda","Terca","Quarta","Quinta","Sexta","Sabado","Domingo"), h.hr_inicio'
    return jsonify(fetch_all(sql, tuple(params)))
