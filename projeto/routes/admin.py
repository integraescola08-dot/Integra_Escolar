from flask import Blueprint, jsonify, request
from mysql.connector import IntegrityError
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


def erro_integridade(e):
    m = str(e).lower()
    if 'email' in m:
        return 'Este email já está cadastrado.'
    if 'matricula' in m or 'primary' in m:
        return 'Esta matrícula já está cadastrada.'
    return 'Registro duplicado ou vínculo inválido.'


@admin_bp.route('/resumo', methods=['GET'])
@papel_obrigatorio('administrador')
def resumo():
    return jsonify({
        'professores': fetch_one('SELECT COUNT(*) total FROM Professor')['total'],
        'coordenadores': fetch_one('SELECT COUNT(*) total FROM Coordenador')['total'],
        'alunos': fetch_one('SELECT COUNT(*) total FROM Aluno WHERE ativo = TRUE')['total'],
        'turmas': fetch_one('SELECT COUNT(*) total FROM Turma')['total'],
    })


@admin_bp.route('/turmas', methods=['GET'])
@papel_obrigatorio('administrador')
def turmas():
    return jsonify(fetch_all('SELECT codigo, descricao FROM Turma ORDER BY codigo'))


@admin_bp.route('/turmas', methods=['POST'])
@papel_obrigatorio('administrador')
def criar_turma():
    dados = request.get_json() or {}
    codigo = texto(dados.get('codigo')).upper()
    descricao = texto(dados.get('descricao'))
    if not codigo or len(codigo) > 10 or not descricao:
        return jsonify({'erro': 'Informe código e descrição da turma.'}), 400

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute('INSERT INTO Turma (codigo, descricao) VALUES (%s, %s)', (codigo, descricao))
        conn.commit()
        return jsonify({'mensagem': 'Turma cadastrada.'}), 201
    except IntegrityError:
        conn.rollback()
        return jsonify({'erro': 'Já existe uma turma com esse código.'}), 409
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/alunos', methods=['GET'])
@papel_obrigatorio('administrador')
def alunos():
    return jsonify(fetch_all("""
        SELECT a.matricula, a.nome, a.turma, r.nome AS responsavel
        FROM Aluno a
        LEFT JOIN Responsavel r ON r.id_responsavel = a.id_responsavel
        WHERE a.ativo = TRUE
        ORDER BY a.nome
    """))


@admin_bp.route('/alunos', methods=['POST'])
@papel_obrigatorio('administrador')
def criar_aluno():
    dados = request.get_json() or {}
    nome = texto(dados.get('nome'))
    turma = texto(dados.get('turma')).upper()
    matricula = texto(dados.get('matricula'))
    if not nome or not turma:
        return jsonify({'erro': 'Nome e turma são obrigatórios.'}), 400
    if matricula and not matricula.isdigit():
        return jsonify({'erro': 'A matrícula deve conter apenas números.'}), 400

    conn = get_connection()
    cur = conn.cursor()
    try:
        if matricula:
            cur.execute('INSERT INTO Aluno (matricula, nome, turma) VALUES (%s, %s, %s)', (int(matricula), nome, turma))
        else:
            cur.execute('INSERT INTO Aluno (nome, turma) VALUES (%s, %s)', (nome, turma))
        nova_matricula = cur.lastrowid or int(matricula)
        conn.commit()
        return jsonify({'mensagem': 'Aluno cadastrado.', 'matricula': nova_matricula}), 201
    except IntegrityError as erro:
        conn.rollback()
        return jsonify({'erro': erro_integridade(erro)}), 409
    finally:
        cur.close()
        conn.close()


def criar_pessoa(dados, nivel_acesso, tabela):
    """Cria um Usuario + a linha correspondente na tabela de identidade
    (Professor ou Coordenador). Reaproveitado pelos dois cadastros abaixo."""
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
        conn.commit()
        return {'mensagem': 'Usuário cadastrado.'}, None
    except IntegrityError as erro:
        conn.rollback()
        return None, (jsonify({'erro': erro_integridade(erro)}), 409)
    finally:
        cur.close()
        conn.close()


@admin_bp.route('/professores', methods=['GET'])
@papel_obrigatorio('administrador')
def professores():
    return jsonify(fetch_all("""
        SELECT p.matricula, p.nome, u.email, u.telefone
        FROM Professor p JOIN Usuario u ON u.id_usuario = p.id_usuario
        WHERE u.ativo = TRUE ORDER BY p.nome
    """))


@admin_bp.route('/professores', methods=['POST'])
@papel_obrigatorio('administrador')
def criar_professor():
    resultado, erro = criar_pessoa(request.get_json() or {}, 2, 'Professor')
    return erro if erro else (jsonify(resultado), 201)


@admin_bp.route('/coordenadores', methods=['GET'])
@papel_obrigatorio('administrador')
def coordenadores():
    return jsonify(fetch_all("""
        SELECT c.id_coordenador AS id, c.nome, u.email, u.telefone
        FROM Coordenador c JOIN Usuario u ON u.id_usuario = c.id_usuario
        WHERE u.ativo = TRUE ORDER BY c.nome
    """))


@admin_bp.route('/coordenadores', methods=['POST'])
@papel_obrigatorio('administrador')
def criar_coordenador():
    resultado, erro = criar_pessoa(request.get_json() or {}, 3, 'Coordenador')
    return erro if erro else (jsonify(resultado), 201)
