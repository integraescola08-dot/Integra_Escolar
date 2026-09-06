/* Integra Escolar — Painel da Gestão conectado ao Flask */
let itemAtualAtestado = null;
let itemAtualLiberacao = null;

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([carregarTurmasGestao(), carregarPainelGestao()]);
  atualizarContadores();
});

// Algum modal de decisão aberto? Evita que a atualização automática/manual
// substitua a lista embaixo do modal enquanto a gestão está analisando um item.
function algumModalGestaoAberto() {
  return document.getElementById('modal').classList.contains('show')
    || document.getElementById('modalLiberacao').classList.contains('show');
}

// Reaproveita os mesmos carregadores usados no carregamento inicial e no
// botão manual — mantém filtros, pesquisa e posição da tela, sem recarregar
// a página (nunca usar location.reload aqui).
async function atualizarPainelGestao() {
  if (algumModalGestaoAberto()) return;
  await carregarPainelGestao();
  atualizarContadores();
  filtrarCards();
}

document.getElementById('btn-atualizar')?.addEventListener('click', atualizarPainelGestao);

// Atualização automática: consulta a API a cada 10s e só troca a área de
// dados (a mesma função de sempre); preserva pesquisa/filtros/scroll.
iniciarAtualizacaoAutomatica(atualizarPainelGestao);

function trocar(id, botao) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  botao.classList.add('active');
  document.getElementById('atestados').classList.add('hidden');
  document.getElementById('liberacoes').classList.add('hidden');
  document.getElementById(id).classList.remove('hidden');
}

async function respostaJsonSegura(resposta) {
  const texto = await resposta.text();
  let dados = null;

  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch (erro) {
    throw new Error(`Resposta inválida do servidor (${resposta.status}). Verifique o terminal do Flask.`);
  }

  if (!resposta.ok) {
    throw new Error(dados?.erro || `Erro ${resposta.status} ao carregar dados.`);
  }

  return dados;
}

async function carregarTurmasGestao() {
  const select = document.getElementById('turma');
  if (!select) return;

  try {
    const resposta = await apiFetch(`${API_URL}/alunos/turmas`);
    const turmas = await respostaJsonSegura(resposta);

    select.innerHTML = '<option value="">Todas as turmas</option>';
    turmas.forEach(item => {
      const codigo = item.codigo;
      if (!codigo) return;
      const option = document.createElement('option');
      option.value = codigo;
      option.textContent = codigo;
      select.appendChild(option);
    });
  } catch (erro) {
    console.error('Não foi possível carregar as turmas:', erro);
    // O painel continua funcionando mesmo se o filtro de turmas falhar.
    select.innerHTML = '<option value="">Todas as turmas</option>';
  }
}

async function carregarPainelGestao() {
  try {
    const [atestadosResp, liberacoesResp] = await Promise.all([
      apiFetch(`${API_URL}/ocorrencias?categoria=Atestado`),
      apiFetch(`${API_URL}/ocorrencias?categoria=Liberacao`)
    ]);

    const atestados = await respostaJsonSegura(atestadosResp);
    const liberacoes = await respostaJsonSegura(liberacoesResp);

    renderLista('lista-atestados', 'lista-historico-atestados', atestados, 'atestado');
    renderLista('lista-liberacoes', 'lista-historico-liberacoes', liberacoes, 'liberacao');
  } catch (erro) {
    console.error(erro);
    alert(erro.message || 'Não foi possível carregar o painel da gestão.');
  }
}

function statusOcorrencia(o) {
  if (o.registrado) return 'aprovado';
  if (o.motivo_rejeicao) return 'rejeitado';
  return 'pendente';
}

function renderLista(idPendentes, idHistorico, itens, tipo) {
  const pendentes = document.getElementById(idPendentes);
  const historico = document.getElementById(idHistorico);
  if (!pendentes || !historico) return;
  pendentes.innerHTML = ''; historico.innerHTML = '';

  itens.forEach(o => {
    const status = statusOcorrencia(o);
    const id = `${tipo}-${o.id_ocorrencia}`;
    const titulo = tipo === 'atestado' ? 'Atestado/Declaração' : 'Liberação de saída';
    const data = formatarDataBR(o.data_inicio_oc);
    const hora = tipo === 'liberacao' ? ` &nbsp;•&nbsp; <i class="fa-regular fa-clock"></i> ${formatarHora(o.hora_saida)}` : '';
    const arquivo = o.arquivo
      ? `<a class="arquivo" href="#" onclick="abrirAnexo(event, '${escapeHtml(o.arquivo)}')"><i class="fa-regular fa-file-pdf"></i> ${escapeHtml(o.arquivo)} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:.75em;margin-left:4px"></i></a>`
      : '';
    const quemBusca = tipo === 'liberacao' ? `<div class="quem-busca-info"><i class="fa-regular fa-user"></i> Quem irá buscar: <strong>${escapeHtml(o.quem_busca || 'Responsável')}</strong></div>` : '';
    const botao = status === 'pendente' ? `<button class="btn-analisar" id="btn-${id}" onclick="${tipo === 'atestado' ? 'abrirModal' : 'abrirModalLiberacao'}('${id}')"><i class="fa-regular fa-message"></i> Analisar e Decidir</button>` : '';
    const statusClasse = status === 'aprovado' ? 'aprovado' : status === 'rejeitado' ? 'rejeitado' : 'pendente';
    const statusTexto = status === 'aprovado' ? '✓ Aprovado' : status === 'rejeitado' ? '✕ Rejeitado' : '<i class="fa-regular fa-clock"></i> Pendente';
    const iconeClasse = status === 'aprovado' ? 'verde' : status === 'rejeitado' ? 'vermelho' : 'amarelo';
    const decisaoPor = o.aprovador_id ? `
      <div class="aprovador-info">
        <i class="fa-solid fa-user-check"></i>
        <span>${status === 'aprovado' ? 'Aprovado' : 'Rejeitado'} por <strong>${escapeHtml(o.aprovador_nome || 'Usuário')}</strong> — ${escapeHtml(o.aprovador_perfil || 'Usuário')} <small>(ID ${escapeHtml(o.aprovador_id)})</small></span>
      </div>` : '';
    // "Desfazer" só aparece no histórico (já decidido). Para liberação já
    // confirmada na portaria, o backend bloqueia o desfazer — mostramos um
    // aviso em vez de um botão que sempre daria erro.
    let desfazer = '';
    if (status !== 'pendente') {
      desfazer = (tipo === 'liberacao' && o.saida_confirmada)
        ? '<div class="aviso-saida-confirmada"><i class="fa-solid fa-circle-info"></i> O aluno já saiu com base nesta liberação — não é possível desfazer.</div>'
        : `<button class="btn-desfazer" onclick="desfazerDecisao('${id}')"><i class="fa-solid fa-rotate-left"></i> Desfazer</button>`;
    }

    const div = document.createElement('div');
    div.className = `item ${status !== 'pendente' ? 'historico' : ''}`;
    div.id = id;
    div.dataset.idOcorrencia = o.id_ocorrencia;
    div.dataset.turma = o.aluno_turma || '';
    div.dataset.status = status;
    div.dataset.nome = o.aluno_nome || '';
    // Data de referência do card, no formato AAAA-MM-DD, para o filtro de data.
    div.dataset.data = String(o.data_inicio_oc || o.data_da_criacao || '').slice(0, 10);
    div.innerHTML = `
      <div class="item-topo">
        <div class="aluno">
          <div class="icone ${iconeClasse}"><i class="fa-regular fa-file-lines"></i></div>
          <div>
            <div class="nome">${escapeHtml(o.aluno_nome || 'Aluno')}</div>
            <div class="sub">${titulo} — ${escapeHtml(o.aluno_turma || '')}</div>
            <div class="data"><i class="fa-regular fa-calendar"></i> ${data}${hora}</div>
          </div>
        </div>
        <div class="status ${statusClasse}" id="status-${id}">${statusTexto}</div>
      </div>
      ${arquivo}
      <div class="obs">"${escapeHtml(o.descricao || '')}"</div>
      ${quemBusca}
      ${decisaoPor}
      ${botao}
      ${desfazer}`;
    (status === 'pendente' ? pendentes : historico).appendChild(div);
  });
}

function abrirModal(id) {
  itemAtualAtestado = id;
  const item = document.getElementById(id);
  document.getElementById('modal-nome-atestado').textContent = item.querySelector('.nome').textContent;
  document.querySelectorAll('#modal .opcao').forEach(o => o.classList.remove('active'));
  document.getElementById('respostaAtestado').value = '';
  atualizarPlaceholderResposta('respostaAtestado', false);
  document.getElementById('modal').classList.add('show');
}
function fecharModal() { document.getElementById('modal').classList.remove('show'); itemAtualAtestado = null; }
function abrirModalLiberacao(id) {
  itemAtualLiberacao = id;
  const item = document.getElementById(id);
  document.getElementById('modal-nome-liberacao').textContent = item.querySelector('.nome').textContent;
  document.querySelectorAll('#modalLiberacao .opcao').forEach(o => o.classList.remove('active'));
  document.getElementById('respostaLiberacao').value = '';
  atualizarPlaceholderResposta('respostaLiberacao', false);
  document.getElementById('modalLiberacao').classList.add('show');
}
function fecharModalLiberacao() { document.getElementById('modalLiberacao').classList.remove('show'); itemAtualLiberacao = null; }

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });
});
function selecionarDecisao(botao) {
  document.querySelectorAll('#modal .opcao').forEach(o => o.classList.remove('active'));
  botao.classList.add('active');
  atualizarPlaceholderResposta('respostaAtestado', botao.classList.contains('rejeitar'));
}
function selecionarDecisaoLib(botao) {
  document.querySelectorAll('#modalLiberacao .opcao').forEach(o => o.classList.remove('active'));
  botao.classList.add('active');
  atualizarPlaceholderResposta('respostaLiberacao', botao.classList.contains('rejeitar'));
}
function atualizarPlaceholderResposta(textareaId, obrigatorio) {
  document.getElementById(textareaId).placeholder = obrigatorio
    ? 'Descreva o motivo da rejeição (obrigatório)...'
    : 'Digite sua resposta (opcional)...';
}

async function enviarDecisao(idItem, modalId, textareaId) {
  const item = document.getElementById(idItem);
  const aprovou = document.querySelector(`#${modalId} .opcao.aprovar.active`);
  const rejeitou = document.querySelector(`#${modalId} .opcao.rejeitar.active`);
  if (!aprovou && !rejeitou) { alert('Selecione Aprovar ou Rejeitar.'); return; }
  const resposta = document.getElementById(textareaId).value.trim();
  if (rejeitou && !resposta) { alert('Descreva o motivo da rejeição.'); return; }
  const usuario = getUsuarioLogado();
  const r = await apiFetch(`${API_URL}/ocorrencias/${item.dataset.idOcorrencia}/decidir`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisao: aprovou ? 'aprovar' : 'rejeitar', resposta, id_usuario_aprovador: usuario?.id_usuario })
  });
  const json = await r.json();
  if (!r.ok) { alert(json.erro || 'Erro ao salvar decisão.'); return; }
  await Promise.all([carregarTurmasGestao(), carregarPainelGestao()]);
  atualizarContadores();
}
async function confirmarDecisaoAtestado() { await enviarDecisao(itemAtualAtestado, 'modal', 'respostaAtestado'); fecharModal(); }
async function confirmarDecisaoLiberacao() { await enviarDecisao(itemAtualLiberacao, 'modalLiberacao', 'respostaLiberacao'); fecharModalLiberacao(); }

async function desfazerDecisao(idItem) {
  const item = document.getElementById(idItem);
  if (!confirm('Desfazer esta decisão? A solicitação volta para a fila de pendentes.')) return;
  try {
    const r = await apiFetch(`${API_URL}/ocorrencias/${item.dataset.idOcorrencia}/desfazer`, { method: 'PUT' });
    const json = await respostaJsonSegura(r);
    await atualizarPainelGestao();
    alert(json.mensagem);
  } catch (erro) {
    alert(erro.message || 'Não foi possível desfazer a decisão.');
  }
}

function atualizarContadores() {
  const pendAtestados = document.querySelectorAll('#lista-atestados .item[data-status="pendente"]').length;
  const pendLiberacoes = document.querySelectorAll('#lista-liberacoes .item[data-status="pendente"]').length;
  document.getElementById('contador-atestados').textContent = pendAtestados;
  document.getElementById('contador-liberacoes').textContent = pendLiberacoes;
  document.getElementById('badge-atestados').textContent = pendAtestados;
  document.getElementById('badge-liberacoes').textContent = pendLiberacoes;
}

document.getElementById('pesquisa').addEventListener('input', filtrarCards);
['turma', 'status', 'dataFiltro'].forEach(id => document.getElementById(id).addEventListener('change', filtrarCards));
function filtrarCards() {
  const pesquisa = document.getElementById('pesquisa').value.toLowerCase().trim();
  const turma = document.getElementById('turma').value;
  const status = document.getElementById('status').value;
  const data = document.getElementById('dataFiltro').value; // 'AAAA-MM-DD' ou ''
  document.querySelectorAll('.item').forEach(item => {
    const okNome = !pesquisa || (item.dataset.nome || '').toLowerCase().includes(pesquisa);
    const okTurma = !turma || item.dataset.turma === turma;
    const okStatus = status === 'todos' || item.dataset.status === status;
    const okData = !data || item.dataset.data === data;
    item.style.display = (okNome && okTurma && okStatus && okData) ? 'block' : 'none';
  });
}
function sair() { window.location.href = '../../index.html'; }

// Abre o anexo (atestado/declaração) enviado pelo responsável. Não usamos um
// <a href> comum porque o arquivo fica atrás de login (token no header) —
// então baixamos com apiFetch e abrimos o resultado como blob numa aba nova.
async function abrirAnexo(evento, nomeArquivo) {
  evento.preventDefault();
  try {
    const resposta = await apiFetch(`${window.location.origin}/uploads/${encodeURIComponent(nomeArquivo)}`);
    if (!resposta.ok) throw new Error('Não foi possível abrir o arquivo.');
    const blob = await resposta.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    // Libera a memória depois de um tempo — a aba já teve tempo de carregar o arquivo.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (erro) {
    alert(erro.message || 'Não foi possível abrir o arquivo.');
  }
}
document.getElementById('modalConfirmar').addEventListener('click', e => {
  if (e.target === e.currentTarget) fecharModal();
});

function abrirConfirmarSair() {
  document.getElementById('modalConfirmarSair').classList.add('show');
}

function fecharConfirmarSair() {
  document.getElementById('modalConfirmarSair').classList.remove('show');
}

document.getElementById('modalConfirmarSair').addEventListener('click', e => {
  if (e.target === e.currentTarget) fecharConfirmarSair();
});
