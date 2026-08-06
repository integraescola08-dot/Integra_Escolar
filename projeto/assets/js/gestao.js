/* Integra Escolar — Painel da Gestão conectado ao Flask */
let itemAtualAtestado = null;
let itemAtualLiberacao = null;

document.addEventListener('DOMContentLoaded', async () => {
  await carregarPainelGestao();
  atualizarContadores();
});

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
    const arquivo = o.arquivo ? `<div class="arquivo"><i class="fa-regular fa-file-pdf"></i> ${o.arquivo}</div>` : '';
    const quemBusca = tipo === 'liberacao' ? `<div class="quem-busca-info"><i class="fa-regular fa-user"></i> Quem irá buscar: <strong>${o.quem_busca || 'Responsável'}</strong></div>` : '';
    const botao = status === 'pendente' ? `<button class="btn-analisar" id="btn-${id}" onclick="${tipo === 'atestado' ? 'abrirModal' : 'abrirModalLiberacao'}('${id}')"><i class="fa-regular fa-message"></i> Analisar e Decidir</button>` : '';
    const statusClasse = status === 'aprovado' ? 'aprovado' : status === 'rejeitado' ? 'rejeitado' : 'pendente';
    const statusTexto = status === 'aprovado' ? '✓ Aprovado' : status === 'rejeitado' ? '✕ Rejeitado' : '<i class="fa-regular fa-clock"></i> Pendente';
    const iconeClasse = status === 'aprovado' ? 'verde' : status === 'rejeitado' ? 'vermelho' : 'amarelo';

    const div = document.createElement('div');
    div.className = `item ${status !== 'pendente' ? 'historico' : ''}`;
    div.id = id;
    div.dataset.idOcorrencia = o.id_ocorrencia;
    div.dataset.turma = o.aluno_turma || '';
    div.dataset.status = status;
    div.dataset.nome = o.aluno_nome || '';
    div.innerHTML = `
      <div class="item-topo">
        <div class="aluno">
          <div class="icone ${iconeClasse}"><i class="fa-regular fa-file-lines"></i></div>
          <div>
            <div class="nome">${o.aluno_nome || 'Aluno'}</div>
            <div class="sub">${titulo} — ${o.aluno_turma || ''}</div>
            <div class="data"><i class="fa-regular fa-calendar"></i> ${data}${hora}</div>
          </div>
        </div>
        <div class="status ${statusClasse}" id="status-${id}">${statusTexto}</div>
      </div>
      ${arquivo}
      <div class="obs">"${o.descricao || ''}"</div>
      ${quemBusca}
      ${botao}`;
    (status === 'pendente' ? pendentes : historico).appendChild(div);
  });
}

function abrirModal(id) {
  itemAtualAtestado = id;
  const item = document.getElementById(id);
  document.getElementById('modal-nome-atestado').textContent = item.querySelector('.nome').textContent;
  document.querySelectorAll('#modal .opcao').forEach(o => o.classList.remove('active'));
  document.getElementById('respostaAtestado').value = '';
  document.getElementById('modal').classList.add('show');
}
function fecharModal() { document.getElementById('modal').classList.remove('show'); itemAtualAtestado = null; }
function abrirModalLiberacao(id) {
  itemAtualLiberacao = id;
  const item = document.getElementById(id);
  document.getElementById('modal-nome-liberacao').textContent = item.querySelector('.nome').textContent;
  document.querySelectorAll('#modalLiberacao .opcao').forEach(o => o.classList.remove('active'));
  document.getElementById('respostaLiberacao').value = '';
  document.getElementById('modalLiberacao').classList.add('show');
}
function fecharModalLiberacao() { document.getElementById('modalLiberacao').classList.remove('show'); itemAtualLiberacao = null; }

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });
});
function selecionarDecisao(botao) { document.querySelectorAll('#modal .opcao').forEach(o => o.classList.remove('active')); botao.classList.add('active'); }
function selecionarDecisaoLib(botao) { document.querySelectorAll('#modalLiberacao .opcao').forEach(o => o.classList.remove('active')); botao.classList.add('active'); }

async function enviarDecisao(idItem, modalId, textareaId) {
  const item = document.getElementById(idItem);
  const aprovou = document.querySelector(`#${modalId} .opcao.aprovar.active`);
  const rejeitou = document.querySelector(`#${modalId} .opcao.rejeitar.active`);
  if (!aprovou && !rejeitou) { alert('Selecione Aprovar ou Rejeitar.'); return; }
  const usuario = getUsuarioLogado();
  const resposta = document.getElementById(textareaId).value;
  const r = await apiFetch(`${API_URL}/ocorrencias/${item.dataset.idOcorrencia}/decidir`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisao: aprovou ? 'aprovar' : 'rejeitar', resposta, id_usuario_aprovador: usuario?.id_usuario })
  });
  const json = await r.json();
  if (!r.ok) { alert(json.erro || 'Erro ao salvar decisão.'); return; }
  await carregarPainelGestao();
  atualizarContadores();
}
async function confirmarDecisaoAtestado() { await enviarDecisao(itemAtualAtestado, 'modal', 'respostaAtestado'); fecharModal(); }
async function confirmarDecisaoLiberacao() { await enviarDecisao(itemAtualLiberacao, 'modalLiberacao', 'respostaLiberacao'); fecharModalLiberacao(); }

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
  document.querySelectorAll('.item').forEach(item => {
    const okNome = !pesquisa || (item.dataset.nome || '').toLowerCase().includes(pesquisa);
    const okTurma = !turma || item.dataset.turma === turma;
    const okStatus = status === 'todos' || item.dataset.status === status;
    item.style.display = (okNome && okTurma && okStatus) ? 'block' : 'none';
  });
}
function sair() { window.location.href = '../../index.html'; }
