from datetime import datetime, date, timedelta
from pathlib import Path

from flask import Blueprint, request, jsonify, current_app, g
from werkzeug.utils import secure_filename

from db import fetch_all, fetch_one, execute, get_connection
from auth_utils import login_obrigatorio, papel_obrigatorio

ocorrencias_bp = Blueprint('ocorrencias', __name__)

DIAS = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo']


def _datas_entre(inicio, fim):
    atual = inicio
    while atual <= fim:
        yield atual
        atual += timedelta(days=1)


def gerar_aulas_para_atestado(id_ocorrencia):
    """Transforma um atestado aprovado em pendências para os professores.

    A turma do aluno + a data do atestado são cruzadas com a grade de horários.
    Só são criadas pendências para aulas que já possuem professor atribuído.
    """
    ocorrencia = fetch_one('''
        SELECT o.id_ocorrencia, o.data_inicio_oc, o.data_fim_oc,
               a.matricula, a.turma
        FROM Ocorrencia o
        JOIN Ocorrencia_Aluno oa ON oa.id_ocorrencia = o.id_ocorrencia
        JOIN Aluno a ON a.matricula = oa.matricula
        WHERE o.id_ocorrencia = %s AND o.categoria = 'Atestado'
    ''', (id_ocorrencia,))
    if not ocorrencia or not ocorrencia['data_inicio_oc']:
        return {'criadas': 0, 'sem_professor': 0}

    inicio = date.fromisoformat(str(ocorrencia['data_inicio_oc'])[:10])
    fim_raw = ocorrencia.get('data_fim_oc') or ocorrencia['data_inicio_oc']
    fim = date.fromisoformat(str(fim_raw)[:10])
    if fim < inicio or (fim - inicio).days > 366:
        return {'criadas': 0, 'sem_professor': 0}

    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    criadas = 0
    sem_professor = 0
    try:
        for data_aula in _datas_entre(inicio, fim):
            dia = DIAS[data_aula.weekday()]
            cur.execute('''
                SELECT id_horario, matricula_professor
                FROM Horario
                WHERE turma = %s
                  AND dia_da_semana = %s
                  AND data_inicio_vigencia <= %s
                  AND (data_fim_vigencia IS NULL OR data_fim_vigencia >= %s)
                ORDER BY hr_inicio
            ''', (ocorrencia['turma'], dia, data_aula, data_aula))
            for aula in cur.fetchall():
                if not aula['matricula_professor']:
                    sem_professor += 1
                    continue
                cur.execute('''
                    INSERT IGNORE INTO Ocorrencia_Aula
                    (id_ocorrencia, id_horario, matricula_professor, data_aula)
                    VALUES (%s, %s, %s, %s)
                ''', (id_ocorrencia, aula['id_horario'], aula['matricula_professor'], data_aula))
                criadas += cur.rowcount
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()
    return {'criadas': criadas, 'sem_professor': sem_professor}


@ocorrencias_bp.route('', methods=['GET'])
@login_obrigatorio
def listar_ocorrencias():
    categoria = request.args.get('categoria')
    status = request.args.get('status')
    responsavel = request.args.get('id_responsavel')
    somente_liberadas = request.args.get('liberadas') == '1'

    if somente_liberadas and g.usuario.get('perfil') not in ('porteiro', 'gestao', 'administrador'):
        return jsonify({'erro': 'Você não tem permissão para acessar a fila da portaria.'}), 403

    if g.usuario.get('perfil') == 'responsavel':
        responsavel = g.usuario['pessoa']['id']

    sql = """
        SELECT o.*, a.matricula AS aluno_matricula, a.nome AS aluno_nome, a.turma AS aluno_turma,
               r.nome AS responsavel_nome
        FROM Ocorrencia o
        LEFT JOIN Ocorrencia_Aluno oa ON oa.id_ocorrencia = o.id_ocorrencia
        LEFT JOIN Aluno a ON a.matricula = oa.matricula
        LEFT JOIN Responsavel r ON r.id_responsavel = o.id_responsavel
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
    id_responsavel = g.usuario['pessoa']['id']
    tipo_declaracao = request.form.get('tipo_declaracao') or 'Atestado Médico'
    observacoes = request.form.get('observacoes')
    data_inicio = request.form.get('data_inicio')
    data_fim = request.form.get('data_fim') or data_inicio
    arquivo = request.files.get('arquivo')
    if not matricula or not arquivo or not data_inicio:
        return jsonify({'erro': 'Matrícula, data e arquivo são obrigatórios.'}), 400
    matricula = str(matricula).strip()
    if not matricula.isdigit() or len(matricula) != 12:
        return jsonify({'erro': 'A matrícula deve conter exatamente 12 dígitos.'}), 400
    aluno = fetch_one(
        'SELECT matricula FROM Aluno WHERE matricula = %s AND id_responsavel = %s AND ativo = TRUE',
        (matricula, id_responsavel)
    )
    if not aluno:
        return jsonify({'erro': 'Este estudante não está vinculado ao responsável logado.'}), 403
    try:
        inicio = date.fromisoformat(data_inicio)
        fim = date.fromisoformat(data_fim)
        if fim < inicio:
            raise ValueError
    except ValueError:
        return jsonify({'erro': 'Período do atestado inválido.'}), 400

    extensao = Path(arquivo.filename or '').suffix.lower()
    if extensao not in {'.pdf', '.png', '.jpg', '.jpeg', '.webp'}:
        return jsonify({'erro': 'Envie um arquivo PDF, PNG, JPG, JPEG ou WEBP.'}), 400
    uploads = Path(current_app.config['UPLOAD_FOLDER']); uploads.mkdir(exist_ok=True)
    nome_arquivo = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{secure_filename(arquivo.filename)}"
    arquivo.save(uploads / nome_arquivo)
    id_oc = execute('''
        INSERT INTO Ocorrencia
        (categoria, tipo_ocorrencia, descricao, arquivo, data_inicio_oc, data_fim_oc, id_responsavel)
        VALUES ('Atestado', 'Falta', %s, %s, %s, %s, %s)
    ''', (f'{tipo_declaracao}. {observacoes or ""}', nome_arquivo, data_inicio, data_fim, id_responsavel))
    execute('INSERT INTO Ocorrencia_Aluno (id_ocorrencia, matricula) VALUES (%s, %s)', (id_oc, matricula))
    return jsonify({'mensagem': 'Atestado enviado com sucesso.', 'id_ocorrencia': id_oc}), 201


@ocorrencias_bp.route('/liberacoes', methods=['POST'])
@papel_obrigatorio('responsavel')
def criar_liberacao():
    dados = request.get_json() or {}
    id_responsavel = g.usuario['pessoa']['id']
    obrigatorios = ['matricula', 'data_saida', 'hora_saida', 'motivo']
    if any(not dados.get(campo) for campo in obrigatorios):
        return jsonify({'erro': 'Preencha todos os campos obrigatórios.'}), 400
    matricula = str(dados.get('matricula') or '').strip()
    if not matricula.isdigit() or len(matricula) != 12:
        return jsonify({'erro': 'A matrícula deve conter exatamente 12 dígitos.'}), 400
    aluno = fetch_one(
        'SELECT matricula FROM Aluno WHERE matricula = %s AND id_responsavel = %s AND ativo = TRUE',
        (matricula, id_responsavel)
    )
    if not aluno:
        return jsonify({'erro': 'Este estudante não está vinculado ao responsável logado.'}), 403
    descricao = dados.get('motivo') + (f". {dados.get('observacoes')}" if dados.get('observacoes') else '')
    id_oc = execute('''
        INSERT INTO Ocorrencia
        (categoria, tipo_ocorrencia, descricao, data_inicio_oc, data_fim_oc, hora_saida, quem_busca, id_responsavel)
        VALUES ('Liberacao', 'Saida Antecipada', %s, %s, %s, %s, %s, %s)
    ''', (descricao, dados.get('data_saida'), dados.get('data_saida'), dados.get('hora_saida'), dados.get('quem_busca') or 'Responsável', id_responsavel))
    execute('INSERT INTO Ocorrencia_Aluno (id_ocorrencia, matricula) VALUES (%s, %s)', (id_oc, matricula))
    return jsonify({'mensagem': 'Solicitação de liberação enviada com sucesso.', 'id_ocorrencia': id_oc}), 201


@ocorrencias_bp.route('/<int:id_ocorrencia>/decidir', methods=['PUT'])
@papel_obrigatorio('gestao')
def decidir_ocorrencia(id_ocorrencia):
    dados = request.get_json() or {}
    decisao = dados.get('decisao')
    resposta = dados.get('resposta')
    id_usuario_aprovador = g.usuario['id_usuario']

    ocorrencia = fetch_one('SELECT categoria FROM Ocorrencia WHERE id_ocorrencia = %s', (id_ocorrencia,))
    if not ocorrencia:
        return jsonify({'erro': 'Ocorrência não encontrada.'}), 404
    if ocorrencia['categoria'] not in ('Atestado', 'Liberacao'):
        return jsonify({'erro': 'Esta ocorrência não é analisada pela gestão.'}), 403
    if decisao not in ('aprovar', 'rejeitar'):
        return jsonify({'erro': 'Decisão inválida.'}), 400

    if decisao == 'aprovar':
        execute('''
            UPDATE Ocorrencia
            SET registrado = TRUE, motivo_rejeicao = NULL, resposta_gestao = %s, id_usuario_aprovador = %s
            WHERE id_ocorrencia = %s
        ''', (resposta, id_usuario_aprovador, id_ocorrencia))
        distribuicao = {'criadas': 0, 'sem_professor': 0}
        if ocorrencia['categoria'] == 'Atestado':
            distribuicao = gerar_aulas_para_atestado(id_ocorrencia)
        return jsonify({
            'mensagem': 'Solicitação aprovada com sucesso.',
            'pendencias_professores_criadas': distribuicao['criadas'],
            'aulas_sem_professor': distribuicao['sem_professor'],
        })

    execute('''
        UPDATE Ocorrencia
        SET registrado = FALSE, motivo_rejeicao = %s, resposta_gestao = %s, id_usuario_aprovador = %s
        WHERE id_ocorrencia = %s
    ''', (resposta or 'Rejeitado pela gestão.', resposta, id_usuario_aprovador, id_ocorrencia))
    execute('DELETE FROM Ocorrencia_Aula WHERE id_ocorrencia = %s', (id_ocorrencia,))
    return jsonify({'mensagem': 'Solicitação rejeitada.'})


@ocorrencias_bp.route('/professor/pendencias', methods=['GET'])
@papel_obrigatorio('professor')
def pendencias_professor():
    professor = g.usuario['pessoa']['id']
    return jsonify(fetch_all('''
        SELECT oa.id_ocorrencia_aula, oa.data_aula, oa.status_professor,
               o.id_ocorrencia, o.descricao, o.arquivo, o.data_inicio_oc, o.data_fim_oc,
               a.matricula AS aluno_matricula, a.nome AS aluno_nome, a.turma AS aluno_turma,
               m.nome AS materia, h.hr_inicio, h.hr_final
        FROM Ocorrencia_Aula oa
        JOIN Ocorrencia o ON o.id_ocorrencia = oa.id_ocorrencia
        JOIN Ocorrencia_Aluno oal ON oal.id_ocorrencia = o.id_ocorrencia
        JOIN Aluno a ON a.matricula = oal.matricula
        JOIN Horario h ON h.id_horario = oa.id_horario
        JOIN Materia m ON m.id_materia = h.id_materia
        WHERE oa.matricula_professor = %s
          AND oa.status_professor = 'Pendente'
        ORDER BY oa.data_aula DESC, h.hr_inicio
    ''', (professor,)))


@ocorrencias_bp.route('/professor/historico', methods=['GET'])
@papel_obrigatorio('professor')
def historico_professor():
    professor = g.usuario['pessoa']['id']
    return jsonify(fetch_all('''
        SELECT oa.id_ocorrencia_aula, oa.data_aula, oa.status_professor, oa.respondido_em,
               oa.observacao_professor, o.id_ocorrencia,
               a.matricula AS aluno_matricula, a.nome AS aluno_nome, a.turma AS aluno_turma,
               m.nome AS materia, h.hr_inicio, h.hr_final
        FROM Ocorrencia_Aula oa
        JOIN Ocorrencia o ON o.id_ocorrencia = oa.id_ocorrencia
        JOIN Ocorrencia_Aluno oal ON oal.id_ocorrencia = o.id_ocorrencia
        JOIN Aluno a ON a.matricula = oal.matricula
        JOIN Horario h ON h.id_horario = oa.id_horario
        JOIN Materia m ON m.id_materia = h.id_materia
        WHERE oa.matricula_professor = %s
          AND oa.status_professor <> 'Pendente'
        ORDER BY oa.respondido_em DESC, oa.data_aula DESC
    ''', (professor,)))


@ocorrencias_bp.route('/aulas/<int:id_ocorrencia_aula>/responder', methods=['PUT'])
@papel_obrigatorio('professor')
def responder_aula(id_ocorrencia_aula):
    dados = request.get_json() or {}
    resposta = dados.get('resposta')
    observacao = str(dados.get('observacao') or '').strip() or None
    professor = g.usuario['pessoa']['id']

    mapa = {
        'lancada': 'Falta Lancada',
        'nao_lancada': 'Falta Nao Lancada',
    }
    if resposta not in mapa:
        return jsonify({'erro': 'Resposta inválida.'}), 400

    item = fetch_one('''
        SELECT id_ocorrencia_aula, status_professor
        FROM Ocorrencia_Aula
        WHERE id_ocorrencia_aula = %s AND matricula_professor = %s
    ''', (id_ocorrencia_aula, professor))
    if not item:
        return jsonify({'erro': 'Pendência não encontrada para este professor.'}), 404
    if item['status_professor'] != 'Pendente':
        return jsonify({'erro': 'Esta pendência já foi respondida.'}), 409

    execute('''
        UPDATE Ocorrencia_Aula
        SET status_professor = %s, respondido_em = NOW(), observacao_professor = %s
        WHERE id_ocorrencia_aula = %s
    ''', (mapa[resposta], observacao, id_ocorrencia_aula))
    return jsonify({'mensagem': 'Situação da falta registrada com sucesso.'})


@ocorrencias_bp.route('/<int:id_ocorrencia>', methods=['DELETE'])
@papel_obrigatorio('responsavel')
def cancelar_ocorrencia(id_ocorrencia):
    id_responsavel = g.usuario['pessoa']['id']
    ocorrencia = fetch_one("""
        SELECT o.id_responsavel, o.categoria, o.registrado, o.motivo_rejeicao
        FROM Ocorrencia o WHERE o.id_ocorrencia = %s
    """, (id_ocorrencia,))
    if not ocorrencia:
        return jsonify({'erro': 'Ocorrência não encontrada.'}), 404
    if ocorrencia['id_responsavel'] != id_responsavel:
        return jsonify({'erro': 'Você não tem permissão para cancelar esta solicitação.'}), 403
    if ocorrencia['categoria'] not in ('Atestado', 'Liberacao'):
        return jsonify({'erro': 'Este tipo de ocorrência não pode ser cancelado.'}), 400
    if ocorrencia['registrado'] or ocorrencia['motivo_rejeicao']:
        return jsonify({'erro': 'Só é possível cancelar uma solicitação ainda pendente.'}), 409

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute('DELETE FROM Ocorrencia_Aula WHERE id_ocorrencia = %s', (id_ocorrencia,))
        cur.execute('DELETE FROM Ocorrencia_Aluno WHERE id_ocorrencia = %s', (id_ocorrencia,))
        cur.execute('DELETE FROM Ocorrencia WHERE id_ocorrencia = %s', (id_ocorrencia,))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close(); conn.close()
    return jsonify({'mensagem': 'Solicitação cancelada com sucesso.'})


@ocorrencias_bp.route('/<int:id_ocorrencia>/confirmar-saida', methods=['PUT'])
@papel_obrigatorio('porteiro')
def confirmar_saida(id_ocorrencia):
    ocorrencia = fetch_one(
        'SELECT categoria, registrado, saida_confirmada FROM Ocorrencia WHERE id_ocorrencia = %s',
        (id_ocorrencia,)
    )
    if not ocorrencia:
        return jsonify({'erro': 'Liberação não encontrada.'}), 404
    if ocorrencia['categoria'] != 'Liberacao' or not ocorrencia['registrado']:
        return jsonify({'erro': 'Apenas liberações aprovadas podem ter a saída confirmada.'}), 400
    if ocorrencia['saida_confirmada']:
        return jsonify({'erro': 'Esta saída já foi confirmada.'}), 409
    execute(
        'UPDATE Ocorrencia SET saida_confirmada = TRUE, data_saida_confirmada = NOW() WHERE id_ocorrencia = %s',
        (id_ocorrencia,)
    )
    return jsonify({'mensagem': 'Saída confirmada com sucesso.'})
