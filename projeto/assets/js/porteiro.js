/* Integra Escolar — Porteiro conectado ao Flask */
let cardSelecionado = null;

document.addEventListener('DOMContentLoaded', carregarLiberados);

async function carregarLiberados() {
  const r = await apiFetch(`${API_URL}/ocorrencias?liberadas=1`);
  if (!r.ok) { alert('Erro ao carregar liberações. Verifique o terminal do Flask.'); return; }
  const liberacoes = await r.json();
  const lista = document.getElementById('listaAlunos');
  lista.innerHTML = '';

  liberacoes.forEach(o => {
    const saiu = !!o.saida_confirmada;
    const card = document.createElement('div');
    card.className = 'card-aluno';
    card.dataset.status = saiu ? 'saiu' : 'aguardando';
    card.dataset.idOcorrencia = o.id_ocorrencia;
    card.innerHTML = `
      <div class="card-topo">
        <div class="status-tag ${saiu ? 'tag-saiu' : 'tag-aguardando'}">${saiu ? '<i class="fa-solid fa-circle-check"></i> Saída confirmada' : '<i class="fa-regular fa-clock"></i> Aguardando saída'}</div>
        <div class="hora-aprovacao">${saiu ? 'Saída confirmada' : 'Aprovado pela gestão'}</div>
      </div>
      <div class="card-corpo">
        <div class="aluno-info">
          <div class="avatar ${saiu ? 'avatar-saiu' : ''}"><i class="fa-regular fa-user"></i></div>
          <div><h2>${escapeHtml(o.aluno_nome || 'Aluno')}</h2><div class="detalhes">
            <span><i class="fa-solid fa-users"></i> ${escapeHtml(o.aluno_turma || '')}</span>
            <span><i class="fa-regular fa-clock"></i> Saída: ${formatarHora(o.hora_saida)}</span>
            <span><i class="fa-solid fa-circle-info"></i> ${escapeHtml(o.descricao || '')}</span>
          </div></div>
        </div>
        <div class="quem-busca"><i class="fa-regular fa-user"></i><div>Quem irá buscar<br><strong>${escapeHtml(o.quem_busca || 'Responsável')}</strong></div></div>
      </div>
      ${saiu ? '' : '<div class="card-acoes"><button class="btn-confirmar-saida" onclick="confirmarSaida(this)"><i class="fa-solid fa-check"></i> Confirmar Saída</button></div>'}`;
    lista.appendChild(card);
  });
  atualizarContador();
}

function atualizarContador() {
  const aguardando = document.querySelectorAll('.card-aluno[data-status="aguardando"]').length;
  document.getElementById('totalLiberados').textContent = aguardando;
  document.getElementById('semRegistros').style.display = document.querySelectorAll('.card-aluno').length === 0 ? 'block' : 'none';
}
function confirmarSaida(botao) {
  const card = botao.closest('.card-aluno');
  const nome = card.querySelector('h2').textContent.trim();
  const quem = card.querySelector('.quem-busca strong').textContent.trim();
  cardSelecionado = card;
  document.getElementById('textoConfirmar').innerHTML = `Confirmar saída de <strong>${escapeHtml(nome)}</strong>?<br><br><span style="color:var(--texto-secundario);font-size:14px;">Sendo buscado por: <strong style="color:var(--texto-principal)">${escapeHtml(quem)}</strong></span>`;
  document.getElementById('modalConfirmar').classList.add('show');
}
async function executarConfirmacao() {
  if (!cardSelecionado) return;
  const r = await apiFetch(`${API_URL}/ocorrencias/${cardSelecionado.dataset.idOcorrencia}/confirmar-saida`, { method: 'PUT' });
  const json = await r.json();
  if (!r.ok) { alert(json.erro || 'Erro ao confirmar saída.'); return; }
  fecharModal();
  await carregarLiberados();
}
function fecharModal() { document.getElementById('modalConfirmar').classList.remove('show'); cardSelecionado = null; }
document.querySelectorAll('.modal-overlay').forEach(overlay => overlay.addEventListener('click', e => { if (e.target === overlay) fecharModal(); }));
