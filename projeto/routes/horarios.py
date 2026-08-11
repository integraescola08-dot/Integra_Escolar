from datetime import date

from flask import Blueprint, request, jsonify, g
from db import fetch_all
from auth_utils import login_obrigatorio

horarios_bp = Blueprint('horarios', __name__)


@horarios_bp.route('', methods=['GET'])
@login_obrigatorio
def listar_horarios():
    turma = request.args.get('turma')
    professor = request.args.get('matricula_professor')

    # Professor consulta apenas as aulas atribuídas a ele.
    if g.usuario.get('perfil') == 'professor':
        professor = g.usuario['pessoa']['id']

    sql = """
        SELECT h.id_horario, h.turma, h.id_materia, m.nome AS materia,
               h.matricula_professor, p.nome AS professor_nome,
               h.dia_da_semana, h.hr_inicio, h.hr_final,
               h.data_inicio_vigencia, h.data_fim_vigencia
        FROM Horario h
        JOIN Materia m ON m.id_materia = h.id_materia
        LEFT JOIN Professor p ON p.matricula = h.matricula_professor
        WHERE 1=1
    """
    params = []

    if turma:
        sql += ' AND h.turma = %s'
        params.append(turma)
    if professor:
        sql += ' AND h.matricula_professor = %s'
        params.append(professor)

    if g.usuario.get('perfil') == 'professor':
        ano = date.today().year
        inicio_ano = f'{ano}-01-01'
        fim_ano = f'{ano}-12-31'
        sql += ' AND h.data_inicio_vigencia <= %s AND (h.data_fim_vigencia IS NULL OR h.data_fim_vigencia >= %s)'
        params.extend([fim_ano, inicio_ano])

    sql += ' ORDER BY FIELD(h.dia_da_semana, "Segunda","Terca","Quarta","Quinta","Sexta","Sabado","Domingo"), h.hr_inicio'
    return jsonify(fetch_all(sql, tuple(params)))
