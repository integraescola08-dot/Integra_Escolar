const ANO_VIGENTE = new Date().getFullYear();
let PENDENCIAS = [];
let HISTORICO = [];
let VISAO = 'pendencias';

function limitarCalendario() {
  const data = document.getElementById('dataFiltro');
  data.min = `${ANO_VIGENTE}-01-01`;
  data.max = `${ANO_VIGENTE}-12-31`;
}

function dataISO(valor) {
  if (!valor) return '';
  const s = String(valor);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function dataBR(valor) {
  const iso = dataISO(valor);
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function hora(valor) {
  return String(valor || '').slice(0, 5);
}

function montarFiltros() {
  const todos = [...PENDENCIAS, ...HISTORICO];
  const materias = [...new Set(todos.map(x => x.materia).filter(Boolean))].sort();
  const turmas = [...new Set(todos.map(x => x.aluno_turma).filter(Boolean))].sort();
  document.getElementById('materia').innerHTML = '<option value="">Todas as matérias</option>' +
    materias.map(x => `<option value="${x}">${x}</option>`).join('');
  document.getElementById('turma').innerHTML = '<option value="">Todas as turmas</option>' +
    turmas.map(x => `<option value="${x}">${x}</option>`).join('');
}

async function carregarDados() {
  const [rp, rh] = await Promise.all([
    apiFetch(`${API_URL}/ocorrencias/professor/pendencias`),
    apiFetch(`${API_URL}/ocorrencias/professor/historico`),
  ]);
  if (!rp.ok || !rh.ok) throw new Error('Não foi possível carregar as justificativas.');
  PENDENCIAS = await rp.json();
  HISTORICO = await rh.json();
  montarFiltros();
  render();
}

function itensFiltrados() {
  const fonte = VISAO === 'pendencias' ? PENDENCIAS : HISTORICO;
  const pesquisa = document.getElementById('pesquisa').value.toLowerCase().trim();
  const turma = document.getElementById('turma').value;
  const materia = document.getElementById('materia').value;
  const data = document.getElementById('dataFiltro').value;
  return fonte.filter(x =>
    (!pesquisa || (x.aluno_nome || '').toLowerCase().includes(pesquisa)) &&
    (!turma || x.aluno_turma === turma) &&
    (!materia || x.materia === materia) &&
    (!data || dataISO(x.data_aula) === data)
  );
}

function render() {
  const itens = itensFiltrados();
  document.getElementById('badgePendentes').textContent = PENDENCIAS.length;
  document.getElementById('textoPendencias').textContent = `${PENDENCIAS.length} pendência(s) aguardando confirmação.`;
  document.getElementById('avisoPendencias').style.display = VISAO === 'pendencias' && PENDENCIAS.length ? 'flex' : 'none';

  const lista = document.getElementById('listaAlunos');
  lista.innerHTML = itens.map(VISAO === 'pendencias' ? cardPendente : cardHistorico).join('');

  const vazio = document.getElementById('semRegistros');
  vazio.style.display = itens.length ? 'none' : 'block';
  document.getElementById('textoSemRegistros').textContent = VISAO === 'pendencias'
    ? 'Nenhuma pendência no momento.'
    : 'Nenhuma resposta registrada no histórico.';
}

function cardPendente(x) {
  return `
    <article class="aluno-card">
      <div class="aluno-nome">${x.aluno_nome}</div>
      <div class="aluno-info grade-info">
        <span><i class="fa-solid fa-graduation-cap"></i> ${x.aluno_turma}</span>
        <span><i class="fa-regular fa-calendar"></i> ${dataBR(x.data_aula)}</span>
        <span><i class="fa-solid fa-book"></i> ${x.materia}</span>
        <span><i class="fa-regular fa-clock"></i> ${hora(x.hr_inicio)} às ${hora(x.hr_final)}</span>
      </div>
      <div class="origem-atestado">
        <strong>Atestado aprovado pela Gestão</strong>
        <span>Período: ${dataBR(x.data_inicio_oc)} até ${dataBR(x.data_fim_oc)}</span>
      </div>
      <p class="pergunta-professor">A falta dessa aula foi lançada no diário?</p>
      <div class="botoes">
        <button class="btn btn-justificado" onclick="responder(${x.id_ocorrencia_aula}, 'lancada')">
          <i class="fa-solid fa-check"></i> Sim, falta lançada
        </button>
        <button class="btn btn-aplicar" onclick="responder(${x.id_ocorrencia_aula}, 'nao_lancada')">
          <i class="fa-solid fa-xmark"></i> Não foi lançada
        </button>
      </div>
    </article>`;
}

function cardHistorico(x) {
  const lancada = x.status_professor === 'Falta Lancada';
  return `
    <article class="aluno-card">
      <div class="aluno-nome">${x.aluno_nome}</div>
      <div class="aluno-info grade-info">
        <span>${x.aluno_turma}</span><span>${dataBR(x.data_aula)}</span>
        <span>${x.materia}</span><span>${hora(x.hr_inicio)} às ${hora(x.hr_final)}</span>
      </div>
      <div class="status-final ${lancada ? 'status-justificada' : 'status-aplicada'}">
        <i class="fa-solid ${lancada ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
        ${lancada ? 'Falta lançada' : 'Falta não lançada'}
        ${x.respondido_em ? ` — respondido em ${dataBR(x.respondido_em)}` : ''}
      </div>
    </article>`;
}

async function responder(id, resposta) {
  const resp = await apiFetch(`${API_URL}/ocorrencias/aulas/${id}/responder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resposta })
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    alert(dados.erro || 'Não foi possível registrar a resposta.');
    return;
  }
  mostrarPopup('Resposta registrada', resposta === 'lancada'
    ? 'A aula foi marcada como falta lançada.'
    : 'A aula foi marcada como falta não lançada.');
  await carregarDados();
}

function mostrarPopup(titulo, texto) {
  document.getElementById('popupTitulo').textContent = titulo;
  document.getElementById('popupTexto').textContent = texto;
  document.getElementById('popup').classList.add('show');
}

document.getElementById('fecharPopup').addEventListener('click', () => document.getElementById('popup').classList.remove('show'));
document.getElementById('popup').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('show'); });

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  VISAO = tab.dataset.visao;
  render();
}));

document.getElementById('pesquisa').addEventListener('input', render);
['turma', 'materia', 'dataFiltro'].forEach(id => document.getElementById(id).addEventListener('change', render));

limitarCalendario();
carregarDados().catch(erro => {
  console.error(erro);
  document.getElementById('listaAlunos').innerHTML = '<p class="vazio">Não foi possível carregar os dados.</p>';
});

// Funções exclusivas do Modal de Sair do Professor
function abrirConfirmarSair() {
  document.getElementById('modalConfirmarSair').classList.add('show');
}

function fecharConfirmarSair() {
  document.getElementById('modalConfirmarSair').classList.remove('show');
}

document.getElementById('modalConfirmarSair').addEventListener('click', e => {
  if (e.target === e.currentTarget) fecharConfirmarSair();
});