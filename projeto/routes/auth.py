from flask import Blueprint, request, jsonify, g
from werkzeug.security import check_password_hash, generate_password_hash
from mysql.connector import IntegrityError
from db import fetch_one, get_connection, execute
from auth_utils import gerar_token, login_obrigatorio

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
    if not matricula.isdigit() or not 6 <= len(matricula) <= 12:
        return jsonify({'erro': 'A matrícula deve conter entre 6 e 12 dígitos.'}), 400
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

PERFIS_TABELAS = {
    'responsavel': ('Responsavel', 'id_responsavel'),
    'professor': ('Professor', 'matricula'),
    'gestao': ('Coordenador', 'id_coordenador'),
    'porteiro': ('Porteiro', 'id_porteiro'),
    'administrador': ('Administrador', 'id_administrador'),
}


def _buscar_pessoa_logada(id_usuario, perfil):
    info = PERFIS_TABELAS.get(perfil)
    if not info:
        return None
    tabela, coluna_id = info
    return fetch_one(f'SELECT {coluna_id} AS id, nome FROM {tabela} WHERE id_usuario = %s', (id_usuario,))


def _buscar_perfil_completo(id_usuario, perfil):
    pessoa = _buscar_pessoa_logada(id_usuario, perfil)
    usuario = fetch_one('SELECT id_usuario, email, telefone, ativo, foto_perfil FROM Usuario WHERE id_usuario = %s', (id_usuario,))
    if not usuario or not pessoa:
        return None
    return {'id_usuario': usuario['id_usuario'], 'email': usuario['email'],
            'telefone': usuario.get('telefone') or '', 'ativo': bool(usuario.get('ativo', True)),
            'nivel_acesso': g.usuario.get('nivel_acesso'), 'perfil': perfil,
            'pessoa': pessoa, 'foto_perfil': usuario.get('foto_perfil')}


@auth_bp.route('/perfil', methods=['GET'])
@login_obrigatorio
def obter_perfil():
    perfil = g.usuario.get('perfil')
    dados = _buscar_perfil_completo(g.usuario['id_usuario'], perfil)
    if not dados:
        return jsonify({'erro': 'Cadastro do usuario nao encontrado.'}), 404
    return jsonify({'usuario': dados})


@auth_bp.route('/perfil', methods=['PUT'])
@login_obrigatorio
def atualizar_perfil():
    dados = request.get_json() or {}
    nome = str(dados.get('nome') or '').strip()
    email_novo = str(dados.get('email') or '').strip().lower()
    telefone = ''.join(filter(str.isdigit, str(dados.get('telefone') or '')))
    tem_foto = 'foto_perfil' in dados
    foto_perfil = dados.get('foto_perfil')
    if not nome:
        return jsonify({'erro': 'Informe o nome completo.'}), 400
    if not email_novo or '@' not in email_novo:
        return jsonify({'erro': 'Informe um email valido.'}), 400
    if len(telefone) not in (10, 11):
        return jsonify({'erro': 'Informe um telefone valido com DDD.'}), 400
    if tem_foto and foto_perfil is not None:
        if not isinstance(foto_perfil, str) or not foto_perfil.startswith('data:image/'):
            return jsonify({'erro': 'Foto de perfil invalida.'}), 400
        if len(foto_perfil) > 800_000:
            return jsonify({'erro': 'A foto ficou muito grande. Escolha outra imagem.'}), 400

    id_usuario = g.usuario['id_usuario']
    perfil = g.usuario.get('perfil')
    pessoa = _buscar_pessoa_logada(id_usuario, perfil)
    if not pessoa:
        return jsonify({'erro': 'Cadastro do usuario esta incompleto.'}), 409
    existente = fetch_one('SELECT id_usuario FROM Usuario WHERE email = %s AND id_usuario <> %s', (email_novo, id_usuario))
    if existente:
        return jsonify({'erro': 'Este email ja esta cadastrado por outro usuario.'}), 409

    tabela, coluna_id = PERFIS_TABELAS[perfil]
    conn = get_connection(); cur = conn.cursor()
    try:
        if not tem_foto:
            cur.execute('UPDATE Usuario SET email = %s, telefone = %s WHERE id_usuario = %s', (email_novo, telefone, id_usuario))
        else:
            cur.execute('UPDATE Usuario SET email = %s, telefone = %s, foto_perfil = %s WHERE id_usuario = %s', (email_novo, telefone, foto_perfil, id_usuario))
        cur.execute(f'UPDATE {tabela} SET nome = %s WHERE {coluna_id} = %s', (nome, pessoa['id']))
        if perfil == 'responsavel':
            cur.execute('UPDATE Responsavel SET telefone = %s WHERE id_responsavel = %s', (telefone, pessoa['id']))
        conn.commit()
    except IntegrityError:
        conn.rollback(); return jsonify({'erro': 'Nao foi possivel salvar: email ja cadastrado ou dados invalidos.'}), 409
    except Exception as erro:
        conn.rollback(); print('Erro ao atualizar perfil:', erro); return jsonify({'erro': 'Erro interno ao atualizar o perfil.'}), 500
    finally:
        cur.close(); conn.close()

    atualizado = _buscar_perfil_completo(id_usuario, perfil)
    token = gerar_token({
        'id_usuario': atualizado['id_usuario'],
        'email': atualizado['email'],
        'nivel_acesso': atualizado['nivel_acesso'],
        'perfil': atualizado['perfil'],
        'pessoa': atualizado['pessoa']
    })
    return jsonify({'mensagem': 'Perfil atualizado com sucesso.', 'usuario': atualizado, 'token': token})


@auth_bp.route('/senha', methods=['PUT'])
@login_obrigatorio
def atualizar_senha():
    dados = request.get_json() or {}
    atual = str(dados.get('senha_atual') or '')
    nova = str(dados.get('senha_nova') or '')
    confirmacao = str(dados.get('senha_confirmacao') or '')
    if not atual or not nova or not confirmacao:
        return jsonify({'erro': 'Preencha todos os campos de senha.'}), 400
    if len(nova) < 6:
        return jsonify({'erro': 'A nova senha deve ter pelo menos 6 caracteres.'}), 400
    if nova != confirmacao:
        return jsonify({'erro': 'As senhas nao coincidem.'}), 400
    if atual == nova:
        return jsonify({'erro': 'A nova senha deve ser diferente da senha atual.'}), 400
    usuario = fetch_one('SELECT senha FROM Usuario WHERE id_usuario = %s AND ativo = TRUE', (g.usuario['id_usuario'],))
    if not usuario:
        return jsonify({'erro': 'Usuario nao encontrado ou desativado.'}), 404
    try:
        if not check_password_hash(usuario['senha'], atual):
            return jsonify({'erro': 'A senha atual está incorreta.'}), 400
    except (ValueError, TypeError):
        return jsonify({'erro': 'A senha atual esta invalida no cadastro.'}), 409
    execute('UPDATE Usuario SET senha = %s WHERE id_usuario = %s', (generate_password_hash(nova), g.usuario['id_usuario']))
    return jsonify({'mensagem': 'Senha alterada com sucesso.'})


# NOTIFICAÇÕES TEMPORARIAMENTE DESATIVADAS.
# Reativar estes endpoints quando a central de notificações for implementada.
# O código foi preservado abaixo para facilitar a reativação futura.

# @auth_bp.route('/notificacoes', methods=['GET'])
# @login_obrigatorio
# def obter_notificacoes():
#     id_usuario = g.usuario['id_usuario']
#     execute('INSERT INTO PreferenciaNotificacao (id_usuario) VALUES (%s) ON DUPLICATE KEY UPDATE id_usuario = VALUES(id_usuario)', (id_usuario,))
#     prefs = fetch_one('SELECT email_ativo, push_ativo, atestado_analisado, liberacao_processada, nova_ausencia, falta_justificada, novo_atestado, nova_liberacao FROM PreferenciaNotificacao WHERE id_usuario = %s', (id_usuario,))
#     return jsonify({'preferencias': prefs})
# @auth_bp.route('/notificacoes', methods=['PUT'])
# @login_obrigatorio
# def atualizar_notificacoes():
#     dados = request.get_json() or {}
#     campos = {k: bool(dados.get(k, True)) for k in ('email_ativo','push_ativo','atestado_analisado','liberacao_processada','nova_ausencia','falta_justificada','novo_atestado','nova_liberacao')}
#     id_usuario = g.usuario['id_usuario']
#     execute('''
#         INSERT INTO PreferenciaNotificacao
#         (id_usuario, email_ativo, push_ativo, atestado_analisado, liberacao_processada, nova_ausencia, falta_justificada, novo_atestado, nova_liberacao)
#         VALUES (%(id_usuario)s, %(email_ativo)s, %(push_ativo)s, %(atestado_analisado)s, %(liberacao_processada)s, %(nova_ausencia)s, %(falta_justificada)s, %(novo_atestado)s, %(nova_liberacao)s)
#         ON DUPLICATE KEY UPDATE email_ativo=VALUES(email_ativo), push_ativo=VALUES(push_ativo), atestado_analisado=VALUES(atestado_analisado), liberacao_processada=VALUES(liberacao_processada), nova_ausencia=VALUES(nova_ausencia), falta_justificada=VALUES(falta_justificada), novo_atestado=VALUES(novo_atestado), nova_liberacao=VALUES(nova_liberacao)
#     ''', {'id_usuario': id_usuario, **campos})
#     return jsonify({'mensagem': 'Preferencias de notificacao salvas com sucesso.', 'preferencias': campos})
#