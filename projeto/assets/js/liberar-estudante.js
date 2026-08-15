/* Integra Escolar — Solicitação de liberação */

let alunosPorMatricula = {};

document.addEventListener('DOMContentLoaded', () => {
  carregarAlunos();
  configurarCalendarioLiberacao();
  configurarDescricaoObrigatoriaLiberacao();
});

function configurarDescricaoObrigatoriaLiberacao() {
  const motivo = document.getElementById('motivo');
  const quem = document.getElementById('quemBusca');
  const obs = document.getElementById('observacoes');
  const titulo = document.getElementById('tituloObservacoesLiberacao');
  const opcional = document.getElementById('marcaOpcionalLiberacao');
  const obrigatoria = document.getElementById('marcaObrigatoriaLiberacao');
  const aviso = document.getElementById('avisoQuemBusca');
  if (!motivo || !quem || !obs) return;

  function atualizar() {
    const precisa = motivo.value === 'Outro' || quem.value === 'Outro';
    obs.required = precisa;
    if (titulo) titulo.firstChild.textContent = precisa ? 'Descrição ' : 'Observações Adicionais ';
    if (opcional) opcional.style.display = precisa ? 'none' : '';
    if (obrigatoria) obrigatoria.style.display = precisa ? '' : 'none';
    if (aviso) aviso.style.display = quem.value === 'Outro' ? '' : 'none';
  }
  motivo.addEventListener('change', atualizar);
  quem.addEventListener('change', atualizar);
  atualizar();
}

function configurarCalendarioLiberacao() {
  const input = document.getElementById('dataLiberacao');
  if (!input) return;
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const hojeIso = `${ano}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
  input.min = hojeIso;
  input.max = `${ano}-12-31`;
  input.addEventListener('change', () => {
    if (!input.value) return;
    const dia = new Date(input.value + 'T00:00:00').getDay();
    if (dia === 0 || dia === 6) {
      alert('A liberação deve ser solicitada para um dia letivo, de segunda a sexta-feira.');
      input.value = '';
    }
  });
}

async function carregarAlunos() {
  const select = document.getElementById('estudante');
  const submit = document.querySelector('#formLiberacao .submit-btn');
  if (!select) return;
  if (submit) submit.disabled = true;
  try {
    const resposta = await apiFetch(`${API_URL}/alunos`);
    if (!resposta.ok) throw new Error();
    const alunos = await resposta.json();
    alunosPorMatricula = Object.fromEntries(alunos.map(a => [String(a.matricula), a]));
    select.innerHTML = '<option value="" disabled selected>Selecione o estudante...</option>';
    alunos.forEach(a => select.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(a.matricula)}">${escapeHtml(a.nome)} - ${escapeHtml(a.turma)}</option>`));
    const pre = new URLSearchParams(window.location.search).get('matricula');
    if (pre) select.value = pre;
    if (submit) submit.disabled = alunos.length === 0;
  } catch {
    select.innerHTML = '<option value="" disabled selected>Não foi possível carregar os estudantes</option>';
    select.disabled = true;
  }
}


document.getElementById('formLiberacao')?.addEventListener('submit', async function (e) {
  e.preventDefault();
  const estudante = document.getElementById('estudante').value;
  const data = document.getElementById('dataLiberacao').value;
  const hora = document.getElementById('horaLiberacao').value;
  const motivo = document.getElementById('motivo').value;
  const quemBusca = document.getElementById('quemBusca').value;
  const observacoes = document.getElementById('observacoes').value;
  if (!estudante || !data || !hora || !motivo || !quemBusca) { alert('Preencha todos os campos obrigatórios.'); return; }
  if ((motivo === 'Outro' || quemBusca === 'Outro') && !observacoes.trim()) { alert('Preencha a descrição para a opção selecionada.'); return; }

  const agora = new Date();
  const ano = agora.getFullYear();
  const hojeIso = `${ano}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}`;
  if (data < hojeIso || !data.startsWith(String(ano))) {
    alert('A liberação deve ser solicitada para hoje ou uma data futura dentro do ano vigente.');
    return;
  }
  const dia = new Date(data + 'T00:00:00').getDay();
  if (dia === 0 || dia === 6) {
    alert('A liberação deve ser solicitada de segunda a sexta-feira.');
    return;
  }
  if (hora < '07:30' || hora > '17:00') {
    alert('O horário de saída deve estar entre 07:30 e 17:00.');
    return;
  }

  const botao = this.querySelector('.submit-btn');
  const original = botao?.innerHTML;
  if (botao) { botao.disabled = true; botao.textContent = 'Enviando...'; }
  try {
    const resposta = await apiFetch(`${API_URL}/ocorrencias/liberacoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matricula: estudante, data_saida: data, hora_saida: hora, motivo, observacoes, quem_busca: quemBusca })
    });
    const resultado = await resposta.json();
    if (!resposta.ok) { alert(resultado.erro || 'Erro ao enviar solicitação.'); return; }
    alert(resultado.mensagem);
    window.location.href = 'home.html';
  } finally {
    if (botao) { botao.disabled = false; botao.innerHTML = original || 'Solicitar Liberação'; }
  }
});

function cancelarSolicitacao() {
  if (confirm('Deseja cancelar a solicitação?')) window.location.href = 'home.html';
}
