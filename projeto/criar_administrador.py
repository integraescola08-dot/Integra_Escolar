"""
Integra Escolar — Criar o primeiro administrador do sistema.

Rode este script uma vez, direto no terminal (com o venv ativado):

    python criar_administrador.py

Ele pede o nome, e-mail e senha do diretor(a)/administrador(a) e cria
a conta já com a senha protegida por hash (nunca em texto puro).
"""

import getpass
from werkzeug.security import generate_password_hash
from mysql.connector import IntegrityError
from db import get_connection

nome = input('Nome completo do diretor(a): ').strip()
email = input('Email: ').strip().lower()
senha = getpass.getpass('Senha (mínimo 8 caracteres): ')
confirmar = getpass.getpass('Confirme a senha: ')

if not nome or not email or len(senha) < 8 or senha != confirmar:
    raise SystemExit('Dados inválidos.')

conn = get_connection()
cur = conn.cursor()
try:
    cur.execute(
        'INSERT INTO Usuario (email, senha, nivel_acesso) VALUES (%s, %s, 5)',
        (email, generate_password_hash(senha))
    )
    id_usuario = cur.lastrowid
    cur.execute('INSERT INTO Administrador (id_usuario, nome) VALUES (%s, %s)', (id_usuario, nome))
    conn.commit()
    print('Administrador criado com sucesso.')
except IntegrityError:
    conn.rollback()
    raise SystemExit('Este email já está cadastrado.')
finally:
    cur.close()
    conn.close()
