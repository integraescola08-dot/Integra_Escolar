from datetime import date, datetime, time, timedelta
import re
import unicodedata

from flask import Blueprint, jsonify, request, g
from mysql.connector import IntegrityError
from openpyxl import load_workbook
from werkzeug.security import generate_password_hash

from db import fetch_all, fetch_one, get_connection
from auth_utils import papel_obrigatorio

admin_bp = Blueprint('admin', __name__)


def texto(v):
    return str(v or '').strip()


def email(v):
    return texto(v).lower()


def digitos(v):
    return ''.join(filter(str.isdigit, str(v or '')))


def normalizar(v):
    valor = unicodedata.normalize('NFKD', texto(v)).encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'\s+', ' ', valor).strip().lower()


def erro_integridade(e):
    m = str(e).lower()
    if 'email' in m:
        return 'Este email já está cadastrado.'
    if 'matricula' in m or 'primary' in m:
        return 'Esta matrícula já está cadastrada.'
    return 'Registro duplicado ou vínculo inválido.'


DIAS_PLANILHA = {
    'segunda': 'Segunda',
    'terca': 'Terca',
    'quarta': 'Quarta',
    'quinta': 'Quinta',
    'sexta': 'Sexta',
    'sabado': 'Sabado',
    'domingo': 'Domingo',
}

INTERVALOS = {
    'lanche', 'lanche da manha', 'lanche da tarde', 'intervalo',
    'almoco', 'horario de saida', 'saida', 'recreio'
}


def valor_para_time(valor):
    if valor is None:
        return None
    if isinstance(valor, time):
        return valor.replace(microsecond=0)
    if isinstance(valor, datetime):
        return valor.time().replace(microsecond=0)
    if isinstance(valor, (int, float)):
        segundos = int(round(float(valor) * 24 * 60 * 60)) % (24 * 60 * 60)
        return time(segundos // 3600, (segundos % 3600) // 60, segundos % 60)
    s = texto(valor)
    for formato in ('%H:%M:%S', '%H:%M'):
        try:
            return datetime.strptime(s, formato).time()
        except ValueError:
            pass
    return None


def extrair_grade_planilha(arquivo):
    """Lê o modelo de grade enviado pela escola.

    Linha 1: nomes dos dias.
    Coluna A: horário de início de cada faixa.
    Demais células: matéria ou intervalo.
    O fim de uma aula é o próximo horário existente na coluna A.
    """
    try:
        wb = load_workbook(arquivo, data_only=True, read_only=False)
    except Exception as exc:
        raise ValueError('Não foi possível ler a planilha. Envie um arquivo .xlsx válido.') from exc

    ws = wb.active
    dias_por_coluna = {}
    for col in range(2, ws.max_column + 1):
        dia = DIAS_PLANILHA.get(normalizar(ws.cell(1, col).value))
        if dia:
            dias_por_coluna[col] = dia

    if not dias_por_coluna:
        raise ValueError('A primeira linha da planilha precisa conter os dias da semana.')

    horarios_linhas = {}
    for row in range(2, ws.max_row + 1):
        hora = valor_para_time(ws.cell(row, 1).value)
        if hora:
            horarios_linhas[row] = hora

    if len(horarios_linhas) < 2:
        raise ValueError('A coluna A precisa conter os horários da grade.')

    linhas_com_hora = sorted(horarios_linhas)
    aulas = []
    for indice, row in enumerate(linhas_com_hora[:-1]):
        inicio = horarios_linhas[row]
        fim = horarios_linhas[linhas_com_hora[indice + 1]]
        if fim <= inicio:
            continue

        for col, dia in dias_por_coluna.items():
            materia_original = texto(ws.cell(row, col).value)
            if not materia_original:
                continue
            if normalizar(materia_original) in INTERVALOS:
                continue
            aulas.append({
                'dia': dia,
                'inicio': inicio,
                'fim': fim,
                'materia': re.sub(r'\s+', ' ', materia_original).strip(),
            })

    if not aulas:
        raise ValueError('Nenhuma aula foi encontrada na planilha.')
    return aulas


def materia_id_por_nome(cur, nome):
    cur.execute('SELECT id_materia FROM Materia WHERE nome = %s', (nome,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute('INSERT INTO Materia (nome) VALUES (%s)', (nome,))
    return cur.lastrowid


def professor_unico_da_materia(cur, id_materia):
    cur.execute(
        'SELECT matricula_professor FROM Professor_Materia WHERE id_materia = %s ORDER BY matricula_professor',
        (id_materia,)
    )
    rows = cur.fetchall()
    return rows[0][0] if len(rows) == 1 else None


@admin_bp.route('/resumo', methods=['GET'])
@papel_obrigatorio('administrador')
def resumo():
    return jsonify({
        'professores': fetch_one('SELECT COUNT(*) total FROM Professor')['total'],
        'coordenadores': fetch_one('SELECT COUNT(*) total FROM Coordenador')['total'],
        'porteiros': fetch_one('SELECT COUNT(*) total FROM Porteiro')['total'],
        'alunos': fetch_one('SELECT COUNT(*) total FROM Aluno WHERE ativo = TRUE')['total'],
        'turmas': fetch_one('SELECT COUNT(*) total FROM Turma')['total'],
    })


@admin_bp.route('/materias', methods=['GET'])
@papel_obrigatorio('administrador')
def materias():
    return jsonify(fetch_all('SELECT id_materia, nome FROM Materia WHERE ativo = TRUE ORDER BY nome'))


@admin_bp.route('/turmas', methods=['GET'])
@papel_obrigatorio('administrador')
def turmas():
    return jsonify(fetch_all('''
        SELECT t.codigo, COUNT(h.id_horario) AS total_aulas
        FROM Turma t
        LEFT JOIN Horario h ON h.turma = t.codigo
        GROUP BY t.codigo
        ORDER BY t.codigo
    '''))


@admin_bp.route('/turmas', methods=['POST'])
@papel_obrigatorio('administrador')
def criar_turma():
    codigo = texto(request.form.get('codigo')).upper()
    arquivo = request.files.get('planilha')

    if not codigo or len(codigo) > 10:
        return jsonify({'erro': 'Informe um código de turma com até 10 caracteres.'}), 400
    if not arquivo or not arquivo.filename:
        return jsonify({'erro': 'Selecione a planilha de horários da turma (.xlsx).'}), 400
    if not arquivo.filename.lower().endswith('.xlsx'):
        return jsonify({'erro': 'A grade deve ser enviada em formato .xlsx.'}), 400

    try:
        aulas = extrair_grade_planilha(arquivo.stream)
    except ValueError as exc:
        return jsonify({'erro': str(exc)}), 400

    ano = date.today().year
    inicio_vigencia = date(ano, 1, 1)
    fim_vigencia = date(ano, 12, 31)

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute('INSERT INTO Turma (codigo) VALUES (%s)', (codigo,))
        materias_criadas = set()
        aulas_sem_professor = 0

        for aula in aulas:
            id_materia = materia_id_por_nome(cur, aula['materia'])
            materias_criadas.add(id_materia)
            professor = professor_unico_da_materia(cur, id_materia)
            if professor is None:
                aulas_sem_professor += 1
            cur.execute('''
                INSERT INTO Horario
                (turma, id_materia, matricula_professor, dia_da_semana, hr_inicio, hr_final,
                 data_inicio_vigencia, data_fim_vigencia, id_usuario_cadastro)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                codigo, id_materia, professor, aula['dia'], aula['inicio'], aula['fim'],
                inicio_vigencia, fim_vigencia, g.usuario['id_usuario']
            ))

        conn.commit()
        return jsonify({
            'mensagem': 'Turma e grade de horários importadas com sucesso.',
            'aulas_importadas': len(aulas),
            'materias_identificadas': len(materias_criadas),
            'aulas_sem_professor': aulas_sem_professor,
        }), 201
    except IntegrityError as exc:
        conn.rollback()
        if 'turma.primary' in str(exc).lower() or 'duplicate' in str(exc).lower():
            return jsonify({'erro': 'Já existe uma turma com esse código.'}), 409
        return jsonify({'erro': erro_integridade(exc)}), 409
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/alunos', methods=['GET'])
@papel_obrigatorio('administrador')
def alunos():
    return jsonify(fetch_all('''
        SELECT a.matricula, a.nome, a.turma, r.nome AS responsavel
        FROM Aluno a
        LEFT JOIN Responsavel r ON r.id_responsavel = a.id_responsavel
        WHERE a.ativo = TRUE
        ORDER BY a.nome
    '''))


@admin_bp.route('/alunos', methods=['POST'])
@papel_obrigatorio('administrador')
def criar_aluno():
    dados = request.get_json() or {}
    nome = texto(dados.get('nome'))
    turma = texto(dados.get('turma')).upper()
    matricula = texto(dados.get('matricula'))
    if not nome or not turma or not matricula:
        return jsonify({'erro': 'Nome, turma e matrícula são obrigatórios.'}), 400
    if not matricula.isdigit() or len(matricula) != 12:
        return jsonify({'erro': 'A matrícula deve conter exatamente 12 dígitos.'}), 400

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute('INSERT INTO Aluno (matricula, nome, turma) VALUES (%s, %s, %s)', (matricula, nome, turma))
        conn.commit()
        return jsonify({'mensagem': 'Aluno cadastrado.', 'matricula': matricula}), 201
    except IntegrityError as erro:
        conn.rollback()
        return jsonify({'erro': erro_integridade(erro)}), 409
    finally:
        cur.close()
        conn.close()


def criar_pessoa(dados, nivel_acesso, tabela):
    nome = texto(dados.get('nome'))
    email_normalizado = email(dados.get('email'))
    senha = str(dados.get('senha') or '')
    telefone = digitos(dados.get('telefone')) or None

    if not nome or not email_normalizado or not senha:
        return None, (jsonify({'erro': 'Nome, email e senha são obrigatórios.'}), 400)
    if len(senha) < 8:
        return None, (jsonify({'erro': 'A senha inicial deve ter pelo menos 8 caracteres.'}), 400)
    if telefone and len(telefone) not in (10, 11):
        return None, (jsonify({'erro': 'Telefone inválido.'}), 400)

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            'INSERT INTO Usuario (email, senha, telefone, nivel_acesso) VALUES (%s, %s, %s, %s)',
            (email_normalizado, generate_password_hash(senha), telefone, nivel_acesso)
        )
        id_usuario = cur.lastrowid
        cur.execute(f'INSERT INTO {tabela} (id_usuario, nome) VALUES (%s, %s)', (id_usuario, nome))
        id_pessoa = cur.lastrowid
        conn.commit()
        return {'mensagem': 'Usuário cadastrado.', 'id_pessoa': id_pessoa}, None
    except IntegrityError as erro:
        conn.rollback()
        return None, (jsonify({'erro': erro_integridade(erro)}), 409)
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/professores', methods=['GET'])
@papel_obrigatorio('administrador')
def professores():
    return jsonify(fetch_all('''
        SELECT p.matricula, p.nome, u.email, u.telefone,
               GROUP_CONCAT(m.nome ORDER BY m.nome SEPARATOR ', ') AS materias
        FROM Professor p
        JOIN Usuario u ON u.id_usuario = p.id_usuario
        LEFT JOIN Professor_Materia pm ON pm.matricula_professor = p.matricula
        LEFT JOIN Materia m ON m.id_materia = pm.id_materia
        WHERE u.ativo = TRUE
        GROUP BY p.matricula, p.nome, u.email, u.telefone
        ORDER BY p.nome
    '''))


@admin_bp.route('/professores', methods=['POST'])
@papel_obrigatorio('administrador')
def criar_professor():
    dados = request.get_json() or {}
    nome = texto(dados.get('nome'))
    email_normalizado = email(dados.get('email'))
    senha = str(dados.get('senha') or '')
    telefone = digitos(dados.get('telefone')) or None
    try:
        id_materia = int(dados.get('id_materia'))
    except (TypeError, ValueError):
        return jsonify({'erro': 'Selecione a matéria do professor.'}), 400

    if not nome or not email_normalizado or not senha:
        return jsonify({'erro': 'Nome, email e senha são obrigatórios.'}), 400
    if len(senha) < 8:
        return jsonify({'erro': 'A senha inicial deve ter pelo menos 8 caracteres.'}), 400
    if telefone and len(telefone) not in (10, 11):
        return jsonify({'erro': 'Telefone inválido.'}), 400

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute('SELECT id_materia FROM Materia WHERE id_materia = %s AND ativo = TRUE', (id_materia,))
        if not cur.fetchone():
            conn.rollback()
            return jsonify({'erro': 'Matéria não encontrada.'}), 404

        cur.execute('''
            INSERT INTO Usuario (email, senha, telefone, nivel_acesso)
            VALUES (%s, %s, %s, 2)
        ''', (email_normalizado, generate_password_hash(senha), telefone))
        id_usuario = cur.lastrowid
        cur.execute('INSERT INTO Professor (id_usuario, nome) VALUES (%s, %s)', (id_usuario, nome))
        matricula_professor = cur.lastrowid
        cur.execute('''
            INSERT INTO Professor_Materia (matricula_professor, id_materia)
            VALUES (%s, %s)
        ''', (matricula_professor, id_materia))

        cur.execute('SELECT COUNT(*) FROM Professor_Materia WHERE id_materia = %s', (id_materia,))
        total_professores_materia = cur.fetchone()[0]
        aulas_vinculadas = 0
        if total_professores_materia == 1:
            cur.execute('''
                UPDATE Horario SET matricula_professor = %s
                WHERE id_materia = %s AND matricula_professor IS NULL
            ''', (matricula_professor, id_materia))
            aulas_vinculadas = cur.rowcount

        conn.commit()
        return jsonify({
            'mensagem': 'Professor cadastrado e vinculado à matéria.',
            'aulas_vinculadas': aulas_vinculadas,
        }), 201
    except IntegrityError as erro:
        conn.rollback()
        return jsonify({'erro': erro_integridade(erro)}), 409
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/coordenadores', methods=['GET'])
@papel_obrigatorio('administrador')
def coordenadores():
    return jsonify(fetch_all('''
        SELECT c.id_coordenador AS id, c.nome, u.email, u.telefone
        FROM Coordenador c JOIN Usuario u ON u.id_usuario = c.id_usuario
        WHERE u.ativo = TRUE ORDER BY c.nome
    '''))


@admin_bp.route('/coordenadores', methods=['POST'])
@papel_obrigatorio('administrador')
def criar_coordenador():
    resultado, erro = criar_pessoa(request.get_json() or {}, 3, 'Coordenador')
    return erro if erro else (jsonify({'mensagem': resultado['mensagem']}), 201)


@admin_bp.route('/porteiros', methods=['GET'])
@papel_obrigatorio('administrador')
def porteiros():
    return jsonify(fetch_all('''
        SELECT p.id_porteiro AS id, p.nome, u.email, u.telefone
        FROM Porteiro p JOIN Usuario u ON u.id_usuario = p.id_usuario
        WHERE u.ativo = TRUE ORDER BY p.nome
    '''))


@admin_bp.route('/porteiros', methods=['POST'])
@papel_obrigatorio('administrador')
def criar_porteiro():
    resultado, erro = criar_pessoa(request.get_json() or {}, 4, 'Porteiro')
    return erro if erro else (jsonify({'mensagem': resultado['mensagem']}), 201)
