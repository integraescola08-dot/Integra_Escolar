from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash, generate_password_hash
from mysql.connector import IntegrityError
from db import fetch_one, get_connection
from auth_utils import gerar_token

auth_bp = Blueprint('auth', __name__)

NIVEIS = {1: 'responsavel', 2: 'professor', 3: 'gestao', 4: 'porteiro', 5: 'administrador'}

@auth_bp.route('/login', methods=['POST'])
def login():
    dados = request.get_json() or {}
    email = (dados.get('email') or '').strip()
    senha = (dados.get('senha') or '').strip()

    if not email or not senha:
        return jsonify({'erro': 'Email e senha são obrigatórios.'}), 400

    usuario = fetch_one('SELECT * FROM Usuario WHERE email = %s', (email.lower(),))
    if not usuario:
        return jsonify({'erro': 'Usuário não encontrado.'}), 401
    if not usuario.get('ativo', True):
        return jsonify({'erro': 'Esta conta está desativada. Procure a administração.'}), 403

    senha_banco = usuario['senha']
    try:
        senha_ok = check_password_hash(senha_banco, senha)
    except (ValueError, TypeError):
        senha_ok = False

    if not senha_ok:
        return jsonify({'erro': 'Senha incorreta.'}), 401

    perfil_banco = NIVEIS.get(usuario['nivel_acesso'])
    if not perfil_banco:
        return jsonify({'erro': 'Nível de acesso inválido para este usuário.'}), 403

    pessoa = None
    if perfil_banco == 'responsavel':
        pessoa = fetch_one('SELECT id_responsavel AS id, nome FROM Responsavel WHERE id_usuario = %s', (usuario['id_usuario'],))
    elif perfil_banco == 'professor':
        pessoa = fetch_one('SELECT matricula AS id, nome FROM Professor WHERE id_usuario = %s', (usuario['id_usuario'],))
    elif perfil_banco == 'gestao':
        pessoa = fetch_one('SELECT id_coordenador AS id, nome FROM Coordenador WHERE id_usuario = %s', (usuario['id_usuario'],))
    elif perfil_banco == 'porteiro':
        pessoa = fetch_one('SELECT id_porteiro AS id, nome FROM Porteiro WHERE id_usuario = %s', (usuario['id_usuario'],))
    elif perfil_banco == 'administrador':
        pessoa = fetch_one('SELECT id_administrador AS id, nome FROM Administrador WHERE id_usuario = %s', (usuario['id_usuario'],))

    # Todo usuário precisa possuir o registro complementar do próprio perfil.
    # Isso evita gerar um token incompleto caso exista, por exemplo, um Usuario
    # nível 5 sem a linha correspondente em Administrador.
    if not pessoa:
        return jsonify({
            'erro': 'O cadastro deste usuário está incompleto para o perfil informado. Procure o administrador do sistema.'
        }), 409

    dados_usuario = {
        'id_usuario': usuario['id_usuario'], 'email': usuario['email'],
        'nivel_acesso': usuario['nivel_acesso'], 'perfil': perfil_banco, 'pessoa': pessoa
    }
    token = gerar_token(dados_usuario)

    return jsonify({
        'mensagem': 'Login realizado com sucesso.',
        'usuario': dados_usuario,
        'token': token
    })


@auth_bp.route('/cadastro-responsavel', methods=['POST'])
def cadastro_responsavel():
    dados = request.get_json() or {}

    nome = (dados.get('nome') or '').strip()
    cpf = ''.join(filter(str.isdigit, str(dados.get('cpf') or '')))
    telefone = ''.join(filter(str.isdigit, str(dados.get('telefone') or '')))
    email = (dados.get('email') or '').strip().lower()
    senha = dados.get('senha') or ''
    confirmar_senha = dados.get('confirmar_senha') or ''
    matricula = str(dados.get('matricula') or '').strip()

    if not all((nome, cpf, telefone, email, senha, matricula)):
        return jsonify({'erro': 'Preencha todos os campos obrigatórios.'}), 400
    if not matricula.isdigit() or len(matricula) != 12:
        return jsonify({'erro': 'A matrícula deve conter exatamente 12 dígitos.'}), 400
    if len(cpf) != 11:
        return jsonify({'erro': 'O CPF deve possuir 11 números.'}), 400
    if len(telefone) not in (10, 11):
        return jsonify({'erro': 'Informe um telefone válido com DDD.'}), 400
    if len(senha) < 6:
        return jsonify({'erro': 'A senha deve possuir pelo menos 6 caracteres.'}), 400
    if senha != confirmar_senha:
        return jsonify({'erro': 'As senhas não coincidem.'}), 400

    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        # Trava a linha do aluno até o fim da transação, evitando que dois
        # responsáveis tentem se cadastrar na mesma matrícula ao mesmo tempo.
        cur.execute(
            'SELECT matricula, nome, id_responsavel FROM Aluno WHERE matricula = %s FOR UPDATE',
            (matricula,)
        )
        aluno = cur.fetchone()
        if not aluno:
            conn.rollback()
            return jsonify({'erro': 'Matrícula não encontrada. Procure a gestão da escola.'}), 404
        if aluno['id_responsavel'] is not None:
            conn.rollback()
            return jsonify({'erro': 'Esta matrícula já está vinculada a um responsável.'}), 409

        cur.execute('SELECT id_usuario FROM Usuario WHERE email = %s', (email,))
        if cur.fetchone():
            conn.rollback()
            return jsonify({'erro': 'Este email já está cadastrado.'}), 409

        cur.execute('SELECT id_responsavel FROM Responsavel WHERE cpf = %s', (cpf,))
        if cur.fetchone():
            conn.rollback()
            return jsonify({'erro': 'Este CPF já está cadastrado.'}), 409

        senha_hash = generate_password_hash(senha)
        cur.execute(
            'INSERT INTO Usuario (email, senha, telefone, nivel_acesso) VALUES (%s, %s, %s, 1)',
            (email, senha_hash, telefone)
        )
        id_usuario = cur.lastrowid

        cur.execute(
            'INSERT INTO Responsavel (id_usuario, cpf, nome, telefone, primeiro_login) '
            'VALUES (%s, %s, %s, %s, FALSE)',
            (id_usuario, cpf, nome, telefone)
        )
        id_responsavel = cur.lastrowid

        cur.execute(
            'UPDATE Aluno SET id_responsavel = %s WHERE matricula = %s',
            (id_responsavel, matricula)
        )
        conn.commit()

        return jsonify({
            'mensagem': f'Cadastro concluído e vinculado ao aluno {aluno["nome"]}. Você já pode entrar.'
        }), 201
    except IntegrityError:
        conn.rollback()
        return jsonify({'erro': 'Email, CPF ou matrícula já vinculados no sistema.'}), 409
    except Exception as erro:
        conn.rollback()
        print('Erro ao cadastrar responsável:', erro)
        return jsonify({'erro': 'Erro interno ao realizar o cadastro.'}), 500
    finally:
        cur.close()
        conn.close()
