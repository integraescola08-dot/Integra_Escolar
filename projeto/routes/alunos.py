from flask import Blueprint, request, jsonify, g
from mysql.connector import IntegrityError
from db import fetch_all, get_connection
from auth_utils import login_obrigatorio, papel_obrigatorio

alunos_bp = Blueprint('alunos', __name__)


@alunos_bp.route('', methods=['GET'])
@login_obrigatorio
def listar_alunos():
    id_responsavel = request.args.get('id_responsavel')
    turma = request.args.get('turma')

    if g.usuario.get('perfil') == 'responsavel':
        id_responsavel = g.usuario['pessoa']['id']

    sql = """
        SELECT a.matricula, a.nome, a.turma, a.id_responsavel
        FROM Aluno a
        WHERE a.ativo = TRUE
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
    return jsonify(fetch_all('SELECT codigo FROM Turma ORDER BY codigo'))


@alunos_bp.route('/vincular', methods=['POST'])
@papel_obrigatorio('responsavel')
def vincular_aluno():
    """Permite que um responsável já logado adicione outro estudante à sua
    conta apenas informando a matrícula, sem precisar refazer o cadastro."""
    dados = request.get_json() or {}
    id_responsavel = g.usuario['pessoa']['id']
    matricula = str(dados.get('matricula') or '').strip()

    if not matricula.isdigit() or not (6 <= len(matricula) <= 12):
        return jsonify({'erro': 'Informe uma matrícula válida (entre 6 e 12 dígitos).'}), 400

    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        # Trava a linha do aluno até o fim da transação, evitando que dois
        # responsáveis tentem se vincular à mesma matrícula ao mesmo tempo.
        cur.execute(
            'SELECT matricula, nome, turma, id_responsavel FROM Aluno WHERE matricula = %s AND ativo = TRUE FOR UPDATE',
            (matricula,)
        )
        aluno = cur.fetchone()
        if not aluno:
            conn.rollback()
            return jsonify({'erro': 'Matrícula não encontrada. Procure a gestão da escola.'}), 404
        if aluno['id_responsavel'] == id_responsavel:
            conn.rollback()
            return jsonify({'erro': 'Este estudante já está vinculado à sua conta.'}), 409
        if aluno['id_responsavel'] is not None:
            conn.rollback()
            return jsonify({'erro': 'Esta matrícula já está vinculada a outro responsável.'}), 409

        cur.execute('UPDATE Aluno SET id_responsavel = %s WHERE matricula = %s', (id_responsavel, matricula))
        conn.commit()

        return jsonify({
            'mensagem': f'{aluno["nome"]} foi vinculado(a) à sua conta com sucesso.',
            'matricula': aluno['matricula'], 'nome': aluno['nome'], 'turma': aluno['turma']
        }), 201
    except IntegrityError:
        conn.rollback()
        return jsonify({'erro': 'Não foi possível vincular esta matrícula.'}), 409
    except Exception as erro:
        conn.rollback()
        print('Erro ao vincular aluno:', erro)
        return jsonify({'erro': 'Erro interno ao vincular o estudante.'}), 500
    finally:
        cur.close()
        conn.close()
