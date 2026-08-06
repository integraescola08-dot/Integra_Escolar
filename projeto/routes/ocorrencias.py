from flask import Blueprint, request, jsonify, current_app, g
from werkzeug.utils import secure_filename
from pathlib import Path
from datetime import datetime
from db import fetch_all, fetch_one, execute
from auth_utils import login_obrigatorio, papel_obrigatorio

ocorrencias_bp = Blueprint('ocorrencias', __name__)

@ocorrencias_bp.route('', methods=['GET'])
@login_obrigatorio
def listar_ocorrencias():
    categoria = request.args.get('categoria')
    status = request.args.get('status')
    professor = request.args.get('matricula_professor')
    responsavel = request.args.get('id_responsavel')
    somente_liberadas = request.args.get('liberadas') == '1'

    # Um responsável só pode listar as próprias ocorrências, mesmo que tente
    # passar outro id_responsavel na URL — o valor do token sempre vence.
    # O mesmo vale para professor (só vê o que é da própria matrícula).
    # Gestão e portaria enxergam tudo, pois é função deles analisar/confirmar.
    if g.usuario.get('perfil') == 'responsavel':
        responsavel = g.usuario['pessoa']['id']
    elif g.usuario.get('perfil') == 'professor':
        professor = g.usuario['pessoa']['id']

    sql = """
        SELECT o.*, a.matricula AS aluno_matricula, a.nome AS aluno_nome, a.turma AS aluno_turma,
               r.nome AS responsavel_nome, p.nome AS professor_nome
        FROM Ocorrencia o
        LEFT JOIN Ocorrencia_Aluno oa ON oa.id_ocorrencia = o.id_ocorrencia
        LEFT JOIN Aluno a ON a.matricula = oa.matricula
        LEFT JOIN Responsavel r ON r.id_responsavel = o.id_responsavel
        LEFT JOIN Professor p ON p.matricula = o.matricula_professor
        WHERE 1=1
    """
    params = []
    if categoria:
        sql += ' AND o.categoria = %s'; params.append(categoria)
    if status == 'pendente':
        sql += ' AND o.registrado = FALSE AND o.motivo_rejeicao IS NULL'
    elif status == 'aprovado':
        sql += ' AND o.registrado = TRUE'
    elif status == 'rejeitado':
        sql += ' AND o.registrado = FALSE AND o.motivo_rejeicao IS NOT NULL'
    if professor:
        sql += ' AND o.matricula_professor = %s'; params.append(professor)
    if responsavel:
        sql += ' AND o.id_responsavel = %s'; params.append(responsavel)
    if somente_liberadas:
        sql += " AND o.categoria = 'Liberacao' AND o.registrado = TRUE"
    sql += ' ORDER BY o.data_da_criacao DESC'
    return jsonify(fetch_all(sql, tuple(params)))

@ocorrencias_bp.route('/atestados', methods=['POST'])
@papel_obrigatorio('responsavel')
def criar_atestado():
    matricula = request.form.get('matricula')
    id_responsavel = g.usuario['pessoa']['id']  # sempre o do token, nunca o do formulário
    matricula_professor = request.form.get('matricula_professor') or 1
    tipo_declaracao = request.form.get('tipo_declaracao') or 'Atestado Médico'
    observacoes = request.form.get('observacoes')
    data_inicio = request.form.get('data_inicio')
    data_fim = request.form.get('data_fim') or data_inicio
    arquivo = request.files.get('arquivo')
    if not matricula or not arquivo:
        return jsonify({'erro': 'matricula e arquivo são obrigatórios.'}), 400
    uploads = Path(current_app.config['UPLOAD_FOLDER']); uploads.mkdir(exist_ok=True)
    nome_arquivo = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{secure_filename(arquivo.filename)}"
    arquivo.save(uploads / nome_arquivo)
    id_oc = execute("""
        INSERT INTO Ocorrencia
        (categoria, tipo_ocorrencia, descricao, arquivo, data_inicio_oc, data_fim_oc, id_responsavel, matricula_professor)
        VALUES ('Atestado', 'Falta', %s, %s, %s, %s, %s, %s)
    """, (f'{tipo_declaracao}. {observacoes or ""}', nome_arquivo, data_inicio, data_fim, id_responsavel, matricula_professor))
    execute('INSERT INTO Ocorrencia_Aluno (id_ocorrencia, matricula) VALUES (%s, %s)', (id_oc, matricula))
    return jsonify({'mensagem': 'Atestado enviado com sucesso.', 'id_ocorrencia': id_oc}), 201

@ocorrencias_bp.route('/liberacoes', methods=['POST'])
@papel_obrigatorio('responsavel')
def criar_liberacao():
    dados = request.get_json() or {}
    id_responsavel = g.usuario['pessoa']['id']  # sempre o do token, nunca o do corpo da requisição
    obrigatorios = ['matricula', 'data_saida', 'hora_saida', 'motivo']
    if any(not dados.get(campo) for campo in obrigatorios):
        return jsonify({'erro': 'Preencha todos os campos obrigatórios.'}), 400
    descricao = dados.get('motivo') + (f". {dados.get('observacoes')}" if dados.get('observacoes') else '')
    id_oc = execute("""
        INSERT INTO Ocorrencia
        (categoria, tipo_ocorrencia, descricao, data_inicio_oc, data_fim_oc, hora_saida, quem_busca, id_responsavel, matricula_professor)
        VALUES ('Liberacao', 'Saida Antecipada', %s, %s, %s, %s, %s, %s, %s)
    """, (descricao, dados.get('data_saida'), dados.get('data_saida'), dados.get('hora_saida'), dados.get('quem_busca') or 'Responsável', id_responsavel, dados.get('matricula_professor') or 1))
    execute('INSERT INTO Ocorrencia_Aluno (id_ocorrencia, matricula) VALUES (%s, %s)', (id_oc, dados.get('matricula')))
    return jsonify({'mensagem': 'Solicitação de liberação enviada com sucesso.', 'id_ocorrencia': id_oc}), 201

@ocorrencias_bp.route('/faltas', methods=['POST'])
@papel_obrigatorio('professor')
def criar_falta():
    dados = request.get_json() or {}
    matricula = dados.get('matricula')
    id_horario = dados.get('id_horario')
    data = dados.get('data')
    if not matricula or not id_horario or not data:
        return jsonify({'erro': 'Estudante, aula e data são obrigatórios.'}), 400

    matricula_professor = g.usuario['pessoa']['id']

    # A aula precisa ser mesmo do professor logado — impede lançar falta
    # numa aula de outro professor só trocando o id_horario na requisição.
    horario = fetch_one(
        'SELECT * FROM Horario WHERE id_horario = %s AND matricula_professor = %s',
        (id_horario, matricula_professor)
    )
    if not horario:
        return jsonify({'erro': 'Aula não encontrada para este professor.'}), 404

    aluno = fetch_one('SELECT id_responsavel, turma FROM Aluno WHERE matricula = %s', (matricula,))
    if not aluno:
        return jsonify({'erro': 'Estudante não encontrado.'}), 404
    if aluno['turma'] != horario['turma']:
        return jsonify({'erro': 'Este estudante não pertence à turma dessa aula.'}), 400

    descricao = f"{horario['materia']} — {str(horario['hr_inicio'])[:5]}"
    id_oc = execute("""
        INSERT INTO Ocorrencia
        (categoria, tipo_ocorrencia, descricao, data_inicio_oc, data_fim_oc, id_responsavel, matricula_professor)
        VALUES ('Falta', 'Falta', %s, %s, %s, %s, %s)
    """, (descricao, data, data, aluno['id_responsavel'], matricula_professor))
    execute('INSERT INTO Ocorrencia_Aluno (id_ocorrencia, matricula) VALUES (%s, %s)', (id_oc, matricula))
    return jsonify({'mensagem': 'Falta registrada com sucesso.', 'id_ocorrencia': id_oc}), 201

@ocorrencias_bp.route('/<int:id_ocorrencia>/decidir', methods=['PUT'])
@papel_obrigatorio('gestao', 'professor')
def decidir_ocorrencia(id_ocorrencia):
    dados = request.get_json() or {}
    decisao = dados.get('decisao')
    resposta = dados.get('resposta')
    id_usuario_aprovador = g.usuario['id_usuario']  # sempre o do token

    ocorrencia = fetch_one('SELECT categoria, matricula_professor FROM Ocorrencia WHERE id_ocorrencia = %s', (id_ocorrencia,))
    if not ocorrencia:
        return jsonify({'erro': 'Ocorrência não encontrada.'}), 404

    # Professor só decide as próprias faltas. Atestados e liberações
    # continuam sendo sempre da gestão — mesmo que o professor tente
    # forçar pela URL, e vice-versa.
    if g.usuario['perfil'] == 'professor':
        eh_dono = ocorrencia['matricula_professor'] == g.usuario['pessoa']['id']
        if ocorrencia['categoria'] != 'Falta' or not eh_dono:
            return jsonify({'erro': 'Você não tem permissão para decidir esta ocorrência.'}), 403
    elif ocorrencia['categoria'] == 'Falta':
        return jsonify({'erro': 'Faltas são decididas pelo próprio professor, não pela gestão.'}), 403

    if decisao not in ['aprovar', 'rejeitar']:
        return jsonify({'erro': 'Decisão inválida.'}), 400
    if decisao == 'aprovar':
        execute("""UPDATE Ocorrencia SET registrado = TRUE, motivo_rejeicao = NULL, resposta_gestao = %s, id_usuario_aprovador = %s WHERE id_ocorrencia = %s""", (resposta, id_usuario_aprovador, id_ocorrencia))
    else:
        msg_padrao = 'Falta mantida pelo professor.' if g.usuario['perfil'] == 'professor' else 'Rejeitado pela gestão.'
        execute("""UPDATE Ocorrencia SET registrado = FALSE, motivo_rejeicao = %s, resposta_gestao = %s, id_usuario_aprovador = %s WHERE id_ocorrencia = %s""", (resposta or msg_padrao, resposta, id_usuario_aprovador, id_ocorrencia))
    return jsonify({'mensagem': 'Decisão registrada com sucesso.'})

@ocorrencias_bp.route('/<int:id_ocorrencia>/confirmar-saida', methods=['PUT'])
@papel_obrigatorio('porteiro')
def confirmar_saida(id_ocorrencia):
    execute('UPDATE Ocorrencia SET saida_confirmada = TRUE, data_saida_confirmada = NOW() WHERE id_ocorrencia = %s', (id_ocorrencia,))
    return jsonify({'mensagem': 'Saída confirmada com sucesso.'})
