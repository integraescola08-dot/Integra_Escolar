let liberacaoSelecionada = null;
let LIBERACOES = [];

function escaparHtml(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function textoMotivo(descricao) {
  const texto = String(descricao || '').trim();
  return texto || 'Motivo não informado';
}

function horaDataSaida(dataHora) {
  if (!dataHora) return '';
  const parte = String(dataHora).split(' ')[1] || '';
  return parte.slice(0, 5);
}

function renderizarLiberacao(o) {
  const saiu = Boolean(o.saida_confirmada);
  const status = saiu ? 'saiu' : 'aguardando';
  const horaConfirmada = horaDataSaida(o.data_saida_confirmada);
  const topoDireita = saiu
    ? `Saiu às ${escaparHtml(horaConfirmada || '—')}`
    : `Solicitada em ${escaparHtml(formatarDataBR(o.data_inicio_oc))}`;

  return `
    <div class="card-aluno" data-status="${status}">
      <div class="card-topo">
        <div class="status-tag ${saiu ? 'tag-saiu' : 'tag-aguardando'}">
          <i class="${saiu ? 'fa-solid fa-circle-check' : 'fa-regular fa-clock'}"></i>
          ${saiu ? 'Saída confirmada' : 'Aguardando saída'}
        </div>
        <div class="hora-aprovacao">${topoDireita}</div>
      </div>

      <div class="card-corpo">
        <div class="aluno-info">
          <div class="avatar ${saiu ? 'avatar-saiu' : ''}"><i class="fa-regular fa-user"></i></div>
          <div>
            <h2>${escaparHtml(o.aluno_nome || 'Aluno')}</h2>
            <div class="detalhes">
              <span><i class="fa-solid fa-users"></i> ${escaparHtml(o.aluno_turma || 'Turma não informada')}</span>
              <span><i class="fa-regular fa-clock"></i> Saída: ${escaparHtml(formatarHora(o.hora_saida) || '—')}</span>
              <span><i class="fa-solid fa-circle-info"></i> ${escaparHtml(textoMotivo(o.descricao))}</span>
            </div>
          </div>
        </div>

        <div class="quem-busca">
          <i class="fa-regular fa-user"></i>
          <div>
            <small>Quem irá buscar</small>
            <strong>${escaparHtml(o.quem_busca || 'Responsável')}</strong>
          </div>
        </div>
      </div>

      ${saiu ? '' : `
      <div class="card-acoes">
        <button class="btn-confirmar-saida" onclick="confirmarSaida(${o.id_ocorrencia})">
          <i class="fa-solid fa-check"></i> Confirmar Saída
        </button>
      </div>`}
    </div>`;
}

async function carregarLiberacoes() {
  const lista = document.getElementById('listaAlunos');
  const vazio = document.getElementById('semRegistros');
  try {
    const resposta = await apiFetch(`${API_URL}/ocorrencias?categoria=Liberacao&liberadas=1`);
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível carregar as liberações.');

    const ordenadas = [...dados].sort((a, b) => Number(a.saida_confirmada) - Number(b.saida_confirmada));
    LIBERACOES = ordenadas;
    const aguardando = ordenadas.filter(o => !o.saida_confirmada).length;
    document.getElementById('totalLiberados').textContent = aguardando;
    lista.innerHTML = ordenadas.map(renderizarLiberacao).join('');
    vazio.style.display = ordenadas.length ? 'none' : 'block';
  } catch (erro) {
    console.error(erro);
    lista.innerHTML = `<p class="carregando-porteiro">${escaparHtml(erro.message)}</p>`;
    vazio.style.display = 'none';
  }
}

function confirmarSaida(idOcorrencia) {
  liberacaoSelecionada = idOcorrencia;
  const registro = LIBERACOES.find(o => o.id_ocorrencia === idOcorrencia);
  const nomeAluno = registro?.aluno_nome || 'este aluno';
  document.getElementById('textoConfirmar').textContent = `Confirmar a saída de ${nomeAluno}?`;
  document.getElementById('modalConfirmar').classList.add('show');
}

function fecharModal() {
  liberacaoSelecionada = null;
  document.getElementById('modalConfirmar').classList.remove('show');
}

async function executarConfirmacao() {
  if (!liberacaoSelecionada) return;
  const id = liberacaoSelecionada;
  try {
    const resposta = await apiFetch(`${API_URL}/ocorrencias/${id}/confirmar-saida`, { method: 'PUT' });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível confirmar a saída.');
    fecharModal();
    await carregarLiberacoes();
  } catch (erro) {
    alert(erro.message);
  }
}

document.getElementById('modalConfirmar').addEventListener('click', e => {
  if (e.target === e.currentTarget) fecharModal();
});

carregarLiberacoes();
