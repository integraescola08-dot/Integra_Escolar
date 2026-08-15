const $  = seletor => document.querySelector(seletor);
const $$ = seletor => document.querySelectorAll(seletor);
let cacheAdmin = { turmas: [], alunos: [], professores: [], coordenadores: [], porteiros: [], responsaveis: [], materias: [] };
let ocorrenciasAdmin = [];

function msg(texto, erro = false) {
  const el = $('#mensagem');
  el.textContent = texto;
  el.className = erro ? 'erro' : 'sucesso';
  setTimeout(() => { el.className = ''; }, 5000);
}

async function chamarApi(caminho, opcoes = {}) {
  const resposta = await apiFetch(`${API_URL}${caminho}`, opcoes);
  const tipo = resposta.headers.get('content-type') || '';
  const dados = tipo.includes('application/json') ? await resposta.json() : {};
  if (!resposta.ok) throw new Error(dados.erro || `Erro na operação (${resposta.status}).`);
  return dados;
}

function dadosDoFormulario(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function escaparHtml(valor) {
  return String(valor ?? '—')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function ativoComoBooleano(valor) {
  return valor === true || valor === 1 || valor === '1';
}

function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function renderizarAlunos() {
  const termo = normalizarTexto($('#busca-alunos').value.trim());
  const turma = $('#filtro-turma-alunos').value;

  const alunosFiltrados = cacheAdmin.alunos.filter(aluno => {
    const combinaTurma = !turma || aluno.turma === turma;
    const combinaBusca = !termo
      || normalizarTexto(aluno.nome).includes(termo)
      || normalizarTexto(aluno.matricula).includes(termo);
    return combinaTurma && combinaBusca;
  });

  $('#lista-alunos').innerHTML = renderizarLinhas(
    alunosFiltrados,
    ['matricula', 'nome', 'turma', 'responsavel'],
    { recurso: 'alunos', chave: 'matricula', temStatus: true }
  );
}

$('#busca-alunos').addEventListener('input', renderizarAlunos);
$('#filtro-turma-alunos').addEventListener('change', renderizarAlunos);

function renderizarLinhas(lista, campos, opcoes = {}) {
  if (!lista.length) return '<p class="vazio">Nenhum registro cadastrado.</p>';

  return lista.map(item => {
    const ativo = opcoes.temStatus ? ativoComoBooleano(item.ativo) : true;
    const colunas = campos.map(c => `<span>${escaparHtml(item[c])}</span>`).join('');
    const status = opcoes.temStatus
      ? `<span class="status-registro ${ativo ? 'status-ativo' : 'status-inativo'}">${ativo ? 'Ativo' : 'Inativo'}</span>`
      : '';

    let acoes = '';
    if (opcoes.recurso) {
      const id = escaparHtml(item[opcoes.chave]);
      const editar = `<button type="button" class="btn-editar" data-editar="${opcoes.recurso}" data-id="${id}">Editar</button>`;
      if (ativo) {
        acoes = `${editar}<button type="button" class="btn-desativar" data-desativar="${opcoes.recurso}" data-id="${id}">Desativar</button>`;
      } else {
        acoes = `
          ${editar}
          <button type="button" class="btn-reativar" data-reativar="${opcoes.recurso}" data-id="${id}">Reativar</button>
          <button type="button" class="btn-excluir-definitivo" data-excluir-definitivo="${opcoes.recurso}" data-id="${id}">Excluir definitivamente</button>
        `;
      }
    }

    return `<div class="linha ${ativo ? '' : 'linha-inativa'}">${colunas}${status}<div class="acoes-registro">${acoes}</div></div>`;
  }).join('');
}

const NOME_RECURSO = {
  alunos: 'aluno',
  professores: 'professor',
  coordenadores: 'coordenador(a)',
  porteiros: 'porteiro(a)',
};

async function desativarRegistro(botao) {
  const tipo = botao.dataset.desativar;
  const id = botao.dataset.id;
  const nome = NOME_RECURSO[tipo] || 'registro';
  if (!confirm(`Desativar este(a) ${nome}? O cadastro ficará sem acesso, mas o histórico será preservado e poderá ser reativado depois.`)) return;

  botao.disabled = true;
  const textoOriginal = botao.textContent;
  botao.textContent = 'Desativando...';
  try {
    const resultado = await chamarApi(`/admin/${tipo}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    msg(resultado.mensagem);
    await carregar();
  } catch (erro) {
    msg(erro.message, true);
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

async function reativarRegistro(botao) {
  const tipo = botao.dataset.reativar;
  const id = botao.dataset.id;
  const nome = NOME_RECURSO[tipo] || 'registro';
  if (!confirm(`Reativar este(a) ${nome}?`)) return;

  botao.disabled = true;
  const textoOriginal = botao.textContent;
  botao.textContent = 'Reativando...';
  try {
    const resultado = await chamarApi(`/admin/${tipo}/${encodeURIComponent(id)}/reativar`, { method: 'POST' });
    msg(resultado.mensagem);
    await carregar();
  } catch (erro) {
    msg(erro.message, true);
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

async function excluirDefinitivamente(botao) {
  const tipo = botao.dataset.excluirDefinitivo;
  const id = botao.dataset.id;
  const nome = NOME_RECURSO[tipo] || 'registro';
  const aviso = `EXCLUSÃO PERMANENTE: deseja apagar definitivamente este(a) ${nome}?\n\nO sistema só permitirá a exclusão se não houver histórico importante vinculado. Esta ação não pode ser desfeita.`;
  if (!confirm(aviso)) return;

  botao.disabled = true;
  const textoOriginal = botao.textContent;
  botao.textContent = 'Verificando...';
  try {
    const resultado = await chamarApi(`/admin/${tipo}/${encodeURIComponent(id)}?permanente=1`, { method: 'DELETE' });
    msg(resultado.mensagem);
    await carregar();
  } catch (erro) {
    msg(erro.message, true);
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

document.addEventListener('click', e => {
  const editarTurma = e.target.closest('[data-editar-turma]');
  if (editarTurma) return abrirEdicaoTurma(editarTurma.dataset.editarTurma);
  const verGrade = e.target.closest('[data-ver-grade]');
  if (verGrade) return visualizarGrade(verGrade.dataset.verGrade);
  const atualizarGrade = e.target.closest('[data-atualizar-grade]');
  if (atualizarGrade) return abrirAtualizacaoGrade(atualizarGrade.dataset.atualizarGrade);
  const salvarProfessor = e.target.closest('[data-salvar-professor-horario]');
  if (salvarProfessor) return salvarProfessorHorario(salvarProfessor);
  const salvarMateria = e.target.closest('[data-salvar-materia-horario]');
  if (salvarMateria) return salvarMateriaHorario(salvarMateria);
  const editar = e.target.closest('[data-editar]');
  if (editar) return abrirEdicao(editar.dataset.editar, editar.dataset.id);

  const desativar = e.target.closest('[data-desativar]');
  if (desativar) return desativarRegistro(desativar);

  const reativar = e.target.closest('[data-reativar]');
  if (reativar) return reativarRegistro(reativar);

  const excluir = e.target.closest('[data-excluir-definitivo]');
  if (excluir) return excluirDefinitivamente(excluir);
  const decisaoAdmin = e.target.closest('[data-decisao-admin]');
  if (decisaoAdmin) return decidirOcorrenciaAdmin(decisaoAdmin.dataset.idOcorrencia, decisaoAdmin.dataset.decisaoAdmin);
  const anexoAdmin = e.target.closest('[data-anexo-admin]');
  if (anexoAdmin) return abrirAnexoAdmin(anexoAdmin.dataset.anexoAdmin);
});

async function carregar() {
  const usuario = getUsuarioLogado();
  if (!usuario || usuario.perfil !== 'administrador') {
    window.location.href = '../../index.html';
    return;
  }
  $('#saudacao').textContent = `Bem-vindo, ${(usuario.pessoa && usuario.pessoa.nome) || 'Administrador'}`;

  const resumo = await chamarApi('/admin/resumo');
  ['alunos', 'professores', 'coordenadores', 'porteiros', 'turmas'].forEach(chave => {
    $(`#n-${chave}`).textContent = resumo[chave];
  });

  const [turmas, alunos, professores, coordenadores, porteiros, materias, responsaveis] = await Promise.all([
    chamarApi('/admin/turmas'),
    chamarApi('/admin/alunos?incluir_inativos=1'),
    chamarApi('/admin/professores?incluir_inativos=1'),
    chamarApi('/admin/coordenadores?incluir_inativos=1'),
    chamarApi('/admin/porteiros?incluir_inativos=1'),
    chamarApi('/admin/materias'),
    chamarApi('/admin/responsaveis?incluir_inativos=1'),
  ]);

  cacheAdmin = { turmas, alunos, professores, coordenadores, porteiros, responsaveis, materias };

  $('#lista-turmas').innerHTML = turmas.length ? turmas.map(t => `
    <div class="linha linha-turma">
      <span><strong>${escaparHtml(t.codigo)}</strong></span>
      <span>${escaparHtml(t.total_aulas)} aulas cadastradas</span>
      <div class="acoes-registro">
        <button type="button" class="btn-editar" data-editar-turma="${escaparHtml(t.codigo)}">Editar turma</button>
        <button type="button" class="btn-grade" data-ver-grade="${escaparHtml(t.codigo)}">Visualizar grade</button>
        <button type="button" class="btn-atualizar-grade" data-atualizar-grade="${escaparHtml(t.codigo)}">Nova grade</button>
      </div>
    </div>`).join('') : '<p class="vazio">Nenhuma turma cadastrada.</p>';
  const selectFiltroTurma = $('#filtro-turma-alunos');
  const turmaSelecionada = selectFiltroTurma.value;
  selectFiltroTurma.innerHTML = '<option value="">Todas as turmas</option>' +
    turmas.map(t => `<option value="${escaparHtml(t.codigo)}">${escaparHtml(t.codigo)}</option>`).join('');
  selectFiltroTurma.value = turmaSelecionada;

  renderizarAlunos();
  $('#lista-professores').innerHTML = renderizarLinhas(
    professores,
    ['matricula', 'nome', 'materias', 'email', 'telefone'],
    { recurso: 'professores', chave: 'matricula', temStatus: true }
  );
  $('#lista-coordenadores').innerHTML = renderizarLinhas(
    coordenadores,
    ['id', 'nome', 'email', 'telefone'],
    { recurso: 'coordenadores', chave: 'id', temStatus: true }
  );
  $('#lista-porteiros').innerHTML = renderizarLinhas(
    porteiros,
    ['id', 'nome', 'email', 'telefone'],
    { recurso: 'porteiros', chave: 'id', temStatus: true }
  );
  $('#lista-responsaveis').innerHTML = responsaveis.length ? responsaveis.map(r => `
    <div class="linha ${ativoComoBooleano(r.ativo) ? '' : 'linha-inativa'}"><span><strong>${escaparHtml(r.nome)}</strong></span><span>${escaparHtml(r.email)}</span><span>CPF: ${escaparHtml(r.cpf)}</span><span>Aluno(s): ${escaparHtml(r.alunos || 'Nenhum vínculo')}</span><span class="status-registro ${ativoComoBooleano(r.ativo) ? 'status-ativo' : 'status-inativo'}">${ativoComoBooleano(r.ativo) ? 'Ativo' : 'Inativo'}</span></div>`).join('') : '<p class="vazio">Nenhum responsável cadastrado.</p>';

  await carregarControleAdmin();

  const selectTurma = document.querySelector('#form-aluno select[name="turma"]');
  selectTurma.innerHTML = '<option value="">Selecione a turma</option>' +
    turmas.map(t => `<option value="${escaparHtml(t.codigo)}">${escaparHtml(t.codigo)}</option>`).join('');

  const selectMateria = document.querySelector('#form-professor select[name="id_materia"]');
  selectMateria.innerHTML = '<option value="">Selecione a matéria</option>' +
    materias.map(m => `<option value="${m.id_materia}">${escaparHtml(m.nome)}</option>`).join('');
}

$$('.tabs button').forEach(botao => {
  botao.addEventListener('click', () => {
    $$('.tabs button, .painel').forEach(el => el.classList.remove('ativo'));
    botao.classList.add('ativo');
    document.getElementById(botao.dataset.tab).classList.add('ativo');
  });
});

async function abrirAnexoAdmin(nomeArquivo) {
  try {
    const resposta = await apiFetch(`${window.location.origin}/uploads/${encodeURIComponent(nomeArquivo)}`);
    if (!resposta.ok) throw new Error('Não foi possível abrir o documento.');
    const blob = await resposta.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (erro) { msg(erro.message, true); }
}

function rotuloStatusOcorrencia(status) { return status === 'aprovado' ? 'Aprovado' : status === 'rejeitado' ? 'Rejeitado' : 'Pendente'; }
function perfilAprovador(item) { return item.aprovador_nome ? `${escaparHtml(item.aprovador_nome)} — ${escaparHtml(item.aprovador_perfil || 'Usuário')} (ID ${escaparHtml(item.id_usuario_aprovador)})` : '—'; }
function renderOcorrenciasAdmin() {
  const termo=normalizarTexto($('#busca-ocorrencias-admin').value.trim()), categoria=$('#filtro-categoria-admin').value, status=$('#filtro-status-admin').value;
  const lista=ocorrenciasAdmin.filter(o=>{ const texto=normalizarTexto(`${o.aluno_nome||''} ${o.aluno_matricula||''} ${o.aluno_turma||''}`); return (!termo||texto.includes(termo))&&(!categoria||o.categoria===categoria)&&(!status||o.status===status); });
  $('#lista-ocorrencias-admin').innerHTML=lista.length?lista.map(o=>{ const pendente=o.status==='pendente'; const periodo=o.data_inicio_oc?`${formatarDataAdmin(o.data_inicio_oc)}${o.data_fim_oc&&String(o.data_fim_oc).slice(0,10)!==String(o.data_inicio_oc).slice(0,10)?` até ${formatarDataAdmin(o.data_fim_oc)}`:''}`:formatarDataAdmin(o.data_da_criacao); return `<div class="linha linha-ocorrencia-admin"><span><strong>${escaparHtml(o.aluno_nome||'Aluno não localizado')}</strong><small>${escaparHtml(o.aluno_matricula||'')} · ${escaparHtml(o.aluno_turma||'')}</small></span><span>${escaparHtml(o.categoria)}<small>${escaparHtml(o.tipo_ocorrencia||'')}</small></span><span>${escaparHtml(periodo)}</span><span class="status-registro ${o.status==='aprovado'?'status-ativo':o.status==='rejeitado'?'status-inativo':'status-pendente'}">${rotuloStatusOcorrencia(o.status)}</span><span><small>Decisão: ${perfilAprovador(o)}</small></span><div class="acoes-registro">${o.arquivo ? `<button type="button" class="btn-ver-anexo-admin" data-anexo-admin="${escaparHtml(o.arquivo)}">Ver documento</button>` : ''}${pendente?`<button type="button" class="btn-aprovar-admin" data-decisao-admin="aprovar" data-id-ocorrencia="${o.id_ocorrencia}">Aprovar</button><button type="button" class="btn-rejeitar-admin" data-decisao-admin="rejeitar" data-id-ocorrencia="${o.id_ocorrencia}">Rejeitar</button>`:''}</div></div>`;}).join(''):'<p class="vazio">Nenhuma solicitação encontrada.</p>';
}
async function carregarControleAdmin() { try { ocorrenciasAdmin=await chamarApi('/admin/ocorrencias'); $('#adm-pend-atestados').textContent=ocorrenciasAdmin.filter(o=>o.categoria==='Atestado'&&o.status==='pendente').length; $('#adm-pend-liberacoes').textContent=ocorrenciasAdmin.filter(o=>o.categoria==='Liberacao'&&o.status==='pendente').length; $('#adm-total-aprovados').textContent=ocorrenciasAdmin.filter(o=>o.status==='aprovado').length; $('#adm-total-rejeitados').textContent=ocorrenciasAdmin.filter(o=>o.status==='rejeitado').length; renderOcorrenciasAdmin(); } catch(erro){ msg(erro.message,true); } }
async function decidirOcorrenciaAdmin(id,decisao) { const resposta=decisao==='rejeitar'?(prompt('Informe o motivo da rejeição:')||'').trim():(prompt('Observação da decisão (opcional):')||'').trim(); if(decisao==='rejeitar'&&!resposta)return; if(!confirm(`${decisao==='aprovar'?'Aprovar':'Rejeitar'} esta solicitação?`))return; try{ await chamarApi(`/ocorrencias/${encodeURIComponent(id)}/decidir`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({decisao,resposta})}); msg(`Solicitação ${decisao==='aprovar'?'aprovada':'rejeitada'} com sucesso.`); await carregarControleAdmin(); }catch(erro){msg(erro.message,true);} }

function configurarTelefone() {
  $$('input[name="telefone"]').forEach(input => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 11);
    });
  });
}

async function enviarJson(form, caminho) {
  const botao = form.querySelector('button[type="submit"], button:not([type])');
  const textoOriginal = botao ? botao.textContent : '';
  try {
    if (botao) {
      botao.disabled = true;
      botao.textContent = 'Cadastrando...';
    }
    const resultado = await chamarApi(caminho, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dadosDoFormulario(form))
    });
    msg(resultado.mensagem);
    form.reset();
    await carregar();
  } catch (erro) {
    msg(erro.message, true);
  } finally {
    if (botao) {
      botao.disabled = false;
      botao.textContent = textoOriginal;
    }
  }
}

async function enviarTurma(form) {
  const botao = form.querySelector('button');
  const textoOriginal = botao.textContent;
  try {
    botao.disabled = true;
    botao.textContent = 'Importando...';
    const resultado = await chamarApi('/admin/turmas', {
      method: 'POST',
      body: new FormData(form)
    });
    let complemento = `${resultado.aulas_importadas} aulas e ${resultado.materias_identificadas} matérias identificadas.`;
    if (resultado.aulas_sem_professor) {
      complemento += ` ${resultado.aulas_sem_professor} aulas aguardam professor da matéria.`;
    }
    msg(`${resultado.mensagem} ${complemento}`);
    form.reset();
    await carregar();
  } catch (erro) {
    msg(erro.message, true);
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

$('#form-turma').addEventListener('submit', e => { e.preventDefault(); enviarTurma(e.target); });
$('#form-aluno').addEventListener('submit', e => { e.preventDefault(); enviarJson(e.target, '/admin/alunos'); });
$('#form-professor').addEventListener('submit', e => { e.preventDefault(); enviarJson(e.target, '/admin/professores'); });
$('#form-coordenador').addEventListener('submit', e => { e.preventDefault(); enviarJson(e.target, '/admin/coordenadores'); });
$('#form-porteiro').addEventListener('submit', e => { e.preventDefault(); enviarJson(e.target, '/admin/porteiros'); });
$('#form-responsavel').addEventListener('submit', e => { e.preventDefault(); enviarJson(e.target, '/admin/responsaveis'); });

function fecharEdicao() {
  $('#modal-edicao').hidden = true;
  $('#form-edicao').innerHTML = '';
}

function inputEdicao(nome, valor, tipo = 'text', extra = '', obrigatorio = true) {
  return `<input name="${nome}" type="${tipo}" value="${escaparHtml(valor ?? '')}" ${extra} ${obrigatorio ? 'required' : ''}>`;
}

function abrirEdicao(tipo, id) {
  const chave = (tipo === 'alunos' || tipo === 'professores') ? 'matricula' : 'id';
  const lista = cacheAdmin[tipo] || [];
  const item = lista.find(x => String(x[chave]) === String(id));
  if (!item) return msg('Não foi possível localizar o cadastro para edição.', true);

  const form = $('#form-edicao');
  form.dataset.tipo = tipo;
  form.dataset.idOriginal = id;
  let campos = '';

  if (tipo === 'alunos') {
    $('#titulo-edicao').textContent = 'Editar aluno';
    const opcoesTurma = cacheAdmin.turmas.map(t => `<option value="${escaparHtml(t.codigo)}" ${t.codigo === item.turma ? 'selected' : ''}>${escaparHtml(t.codigo)}</option>`).join('');
    campos = `${inputEdicao('matricula', item.matricula, 'text', 'inputmode="numeric" minlength="6" maxlength="12" pattern="[0-9]{6,12}"')}${inputEdicao('nome', item.nome)}<select name="turma" required>${opcoesTurma}</select>`;
  } else if (tipo === 'professores') {
    $('#titulo-edicao').textContent = 'Editar professor';
    const opcoesMateria = cacheAdmin.materias.map(m => `<option value="${m.id_materia}" ${String(m.id_materia) === String(item.id_materia) ? 'selected' : ''}>${escaparHtml(m.nome)}</option>`).join('');
    campos = `${inputEdicao('nome', item.nome)}${inputEdicao('email', item.email, 'email')}${inputEdicao('telefone', item.telefone || '', 'tel', 'inputmode="numeric" minlength="10" maxlength="11" pattern="[0-9]{10,11}"', false)}<select name="id_materia" required>${opcoesMateria}</select>`;
  } else {
    $('#titulo-edicao').textContent = tipo === 'coordenadores' ? 'Editar coordenador(a)' : 'Editar porteiro(a)';
    campos = `${inputEdicao('nome', item.nome)}${inputEdicao('email', item.email, 'email')}${inputEdicao('telefone', item.telefone || '', 'tel', 'inputmode="numeric" minlength="10" maxlength="11" pattern="[0-9]{10,11}"', false)}`;
  }

  form.innerHTML = `${campos}<div class="acoes-modal"><button type="button" class="btn-cancelar">Cancelar</button><button type="submit">Salvar alterações</button></div>`;
  $('#modal-edicao').hidden = false;
  configurarTelefone();
}

$('#fechar-edicao').addEventListener('click', fecharEdicao);
$('#modal-edicao').addEventListener('click', e => { if (e.target.id === 'modal-edicao') fecharEdicao(); });
$('#form-edicao').addEventListener('click', e => { if (e.target.closest('.btn-cancelar')) fecharEdicao(); });
$('#form-edicao').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const tipo = form.dataset.tipo;
  const id = form.dataset.idOriginal;
  const botao = form.querySelector('button[type="submit"]');
  const original = botao.textContent;
  try {
    botao.disabled = true; botao.textContent = 'Salvando...';
    const caminho = tipo === 'turma' ? `/admin/turmas/${encodeURIComponent(id)}` : `/admin/${tipo}/${encodeURIComponent(id)}`;
    const resultado = await chamarApi(caminho, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dadosDoFormulario(form))
    });
    fecharEdicao(); msg(resultado.mensagem); await carregar();
  } catch (erro) { msg(erro.message, true); botao.disabled = false; botao.textContent = original; }
});


function abrirEdicaoTurma(codigo) {
  const form = $('#form-edicao');
  $('#titulo-edicao').textContent = 'Editar turma';
  form.dataset.tipo = 'turma';
  form.dataset.idOriginal = codigo;
  form.innerHTML = `${inputEdicao('codigo', codigo, 'text', 'maxlength="10"')}<p class="aviso-modal campo-largo">Ao alterar o código, os alunos e horários vinculados acompanham a mudança automaticamente.</p><div class="acoes-modal"><button type="button" class="btn-cancelar">Cancelar</button><button type="submit">Salvar alterações</button></div>`;
  $('#modal-edicao').hidden = false;
}

function idsMateriasProfessor(professor) {
  return String(professor.materias_ids || professor.id_materia || '')
    .split(',')
    .map(x => String(x).trim())
    .filter(Boolean);
}

function professoresCompativeis(idMateria) {
  return (cacheAdmin.professores || []).filter(p =>
    ativoComoBooleano(p.ativo) && idsMateriasProfessor(p).includes(String(idMateria))
  );
}

function gradeEhHistorica(fimVigencia) {
  if (!fimVigencia) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fim = new Date(`${String(fimVigencia).slice(0, 10)}T00:00:00`);
  return fim < hoje;
}

async function salvarProfessorHorario(botao) {
  const idHorario = botao.dataset.salvarProfessorHorario;
  const select = document.querySelector(`[data-professor-horario="${CSS.escape(String(idHorario))}"]`);
  if (!select) return;
  const original = botao.textContent;
  try {
    botao.disabled = true;
    botao.textContent = 'Salvando...';
    const resultado = await chamarApi(`/admin/horarios/${encodeURIComponent(idHorario)}/professor`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matricula_professor: select.value || null })
    });
    msg(resultado.mensagem);
    const codigo = $('#titulo-grade').textContent.replace(/^Grade — /, '');
    await visualizarGrade(codigo);
  } catch (erro) {
    msg(erro.message, true);
    botao.disabled = false;
    botao.textContent = original;
  }
}

async function salvarMateriaHorario(botao) {
  const idHorario = botao.dataset.salvarMateriaHorario;
  const input = document.querySelector(`[data-materia-horario="${CSS.escape(String(idHorario))}"]`);
  if (!input) return;
  const original = botao.textContent;
  try {
    botao.disabled = true; botao.textContent = 'Salvando...';
    const resultado = await chamarApi(`/admin/horarios/${encodeURIComponent(idHorario)}/materia`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: input.value.trim() })
    });
    msg(resultado.mensagem);
    const codigo = $('#titulo-grade').textContent.replace(/^Grade — /, '').trim();
    await visualizarGrade(codigo);
  } catch (erro) {
    msg(erro.message, true); botao.disabled = false; botao.textContent = original;
  }
}

async function visualizarGrade(codigo) {
  try {
    const grade = await chamarApi(`/admin/turmas/${encodeURIComponent(codigo)}/grade`);
    $('#titulo-grade').textContent = `Grade — ${codigo}`;
    if (!grade.length) {
      $('#conteudo-grade').innerHTML = '<p class="vazio">Esta turma ainda não possui horários.</p>';
    } else {
      const vigencias = new Map();
      grade.forEach(a => {
        const chave = `${a.data_inicio_vigencia}|${a.data_fim_vigencia || ''}`;
        if (!vigencias.has(chave)) vigencias.set(chave, []);
        vigencias.get(chave).push(a);
      });
      $('#conteudo-grade').innerHTML = [...vigencias.entries()].map(([chave, aulas]) => {
        const [inicio, fim] = chave.split('|');
        const historica = gradeEhHistorica(fim);
        const linhas = aulas.map(a => {
          if (historica) {
            return `<tr><td>${escaparHtml(a.dia_da_semana)}</td><td>${escaparHtml(String(a.hr_inicio).slice(0,5))}–${escaparHtml(String(a.hr_final).slice(0,5))}</td><td><div class="materia-aula-editor"><input value="${escaparHtml(a.materia)}" data-materia-horario="${a.id_horario}" maxlength="100"><button type="button" data-salvar-materia-horario="${a.id_horario}">Salvar</button></div><span class="tag-historico">Histórico</span></td><td>${escaparHtml(a.professor || 'Sem professor')}</td></tr>`;
          }
          const compativeis = professoresCompativeis(a.id_materia);
          const opcoes = `<option value="">Sem professor</option>` + compativeis.map(p => `<option value="${p.matricula}" ${String(p.matricula) === String(a.matricula_professor || '') ? 'selected' : ''}>${escaparHtml(p.nome)}</option>`).join('');
          return `<tr><td>${escaparHtml(a.dia_da_semana)}</td><td>${escaparHtml(String(a.hr_inicio).slice(0,5))}–${escaparHtml(String(a.hr_final).slice(0,5))}</td><td><div class="materia-aula-editor"><input value="${escaparHtml(a.materia)}" data-materia-horario="${a.id_horario}" maxlength="100"><button type="button" data-salvar-materia-horario="${a.id_horario}">Salvar</button></div></td><td><div class="professor-aula-editor"><select data-professor-horario="${a.id_horario}">${opcoes}</select><button type="button" data-salvar-professor-horario="${a.id_horario}">Salvar</button></div>${compativeis.length ? '' : '<small class="aviso-sem-professor">Cadastre um professor desta matéria para vinculá-lo.</small>'}</td></tr>`;
        }).join('');
        return `<section class="bloco-vigencia"><h3>Vigência: ${formatarDataAdmin(inicio)} até ${fim ? formatarDataAdmin(fim) : 'atual'}</h3><div class="tabela-grade-wrap"><table class="tabela-grade"><thead><tr><th>Dia</th><th>Horário</th><th>Matéria</th><th>Professor da aula</th></tr></thead><tbody>${linhas}</tbody></table></div></section>`;
      }).join('');
    }
    $('#modal-grade').hidden = false;
  } catch (erro) { msg(erro.message, true); }
}

function formatarDataAdmin(valor) {
  if (!valor) return '—';
  const s = String(valor).slice(0,10).split('-');
  return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : escaparHtml(valor);
}

function abrirAtualizacaoGrade(codigo) {
  $('#titulo-nova-grade').textContent = `Nova grade — ${codigo}`;
  const form = $('#form-nova-grade');
  form.dataset.codigo = codigo;
  form.reset();
  form.querySelector('[name="data_inicio_vigencia"]').value = new Date().toISOString().slice(0,10);
  $('#modal-nova-grade').hidden = false;
}

$('#fechar-grade').addEventListener('click', () => { $('#modal-grade').hidden = true; });
$('#modal-grade').addEventListener('click', e => { if (e.target.id === 'modal-grade') $('#modal-grade').hidden = true; });
$('#fechar-nova-grade').addEventListener('click', () => { $('#modal-nova-grade').hidden = true; });
$('#modal-nova-grade').addEventListener('click', e => { if (e.target.id === 'modal-nova-grade') $('#modal-nova-grade').hidden = true; });
$('#cancelar-nova-grade').addEventListener('click', () => { $('#modal-nova-grade').hidden = true; });
$('#form-nova-grade').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget, codigo = form.dataset.codigo, botao = form.querySelector('button[type="submit"]'), original = botao.textContent;
  if (!confirm(`Importar uma nova grade para ${codigo}? A grade anterior será encerrada na véspera da nova vigência e continuará preservada no histórico.`)) return;
  try {
    botao.disabled = true; botao.textContent = 'Importando...';
    const resultado = await chamarApi(`/admin/turmas/${encodeURIComponent(codigo)}/grade`, { method:'POST', body:new FormData(form) });
    $('#modal-nova-grade').hidden = true; msg(`${resultado.mensagem} ${resultado.aulas_importadas} aulas importadas.`); await carregar();
  } catch (erro) { msg(erro.message, true); }
  finally { botao.disabled = false; botao.textContent = original; }
});

$('#busca-ocorrencias-admin').addEventListener('input', renderOcorrenciasAdmin);
$('#filtro-categoria-admin').addEventListener('change', renderOcorrenciasAdmin);
$('#filtro-status-admin').addEventListener('change', renderOcorrenciasAdmin);
$('#atualizar-controle').addEventListener('click', carregarControleAdmin);

$('#logout').addEventListener('click', sair);

configurarTelefone();
carregar().catch(erro => msg(erro.message, true));
