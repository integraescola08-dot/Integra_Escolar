/* Integra Escolar — Liberar Estudante conectado ao Flask */

document.addEventListener('DOMContentLoaded', carregarAlunos);
document.addEventListener('DOMContentLoaded', configurarCalendarioLiberacao);
document.addEventListener('DOMContentLoaded', configurarHorarioLiberacao);
document.addEventListener('DOMContentLoaded', configurarDescricaoObrigatoriaLiberacao);

// Quando o motivo da liberação é "Outro", ou quando a pessoa que vai
// buscar o estudante é "Outro", não dá pra saber do que se trata só
// pela seleção — por isso o campo de observações passa a se chamar
// "Descrição" e se torna obrigatório, igual já fazemos na tela de
// enviar atestado.
function configurarDescricaoObrigatoriaLiberacao() {
  const motivoSelect = document.getElementById('motivo');
  const quemBuscaSelect = document.getElementById('quemBusca');
  const textarea = document.getElementById('observacoes');
  const titulo = document.getElementById('tituloObservacoesLiberacao');
  const marcaOpcional = document.getElementById('marcaOpcionalLiberacao');
  const marcaObrigatoria = document.getElementById('marcaObrigatoriaLiberacao');
  const avisoQuemBusca = document.getElementById('avisoQuemBusca');
  if (!motivoSelect || !quemBuscaSelect || !textarea) return;

  function atualizar() {
    const motivoEhOutro = motivoSelect.value === 'Outro';
    const quemBuscaEhOutro = quemBuscaSelect.value === 'Outro';
    const precisaDescricao = motivoEhOutro || quemBuscaEhOutro;

    textarea.required = precisaDescricao;
    if (titulo) titulo.firstChild.textContent = precisaDescricao ? 'Descrição ' : 'Observações Adicionais ';
    if (marcaOpcional) marcaOpcional.style.display = precisaDescricao ? 'none' : '';
    if (marcaObrigatoria) marcaObrigatoria.style.display = precisaDescricao ? '' : 'none';
    if (avisoQuemBusca) avisoQuemBusca.style.display = quemBuscaEhOutro ? '' : 'none';
  }

  motivoSelect.addEventListener('change', atualizar);
  quemBuscaSelect.addEventListener('change', atualizar);
  atualizar();
}

// Restringe o calendário de "Data da Liberação" ao ano atual e bloqueia
// fins de semana (só é permitido escolher de segunda a sexta-feira).
function configurarCalendarioLiberacao() {
  const anoAtual = new Date().getFullYear();
  const dataInput = document.getElementById('dataLiberacao');
  if (!dataInput) return;

  dataInput.min = `${anoAtual}-01-01`;
  dataInput.max = `${anoAtual}-12-31`;

  dataInput.addEventListener('input', function () {
    if (!dataInput.value) return;
    const diaSemana = new Date(dataInput.value + 'T00:00:00').getDay();
    if (diaSemana === 0 || diaSemana === 6) {
      alert('Só é possível selecionar datas de segunda a sexta-feira.');
      dataInput.value = '';
    }
  });
}

// Garante que o horário digitado esteja dentro do horário de aula.
// A escola funciona das 07:30 às 17:00 — não faz sentido liberar o
// estudante fora desse intervalo, então o horário de saída precisa
// estar dentro dele.
const HORARIO_MIN_LIBERACAO = '07:30';
const HORARIO_MAX_LIBERACAO = '17:00';

function horarioValido(hora) {
  if (!/^\d{2}:\d{2}$/.test(hora)) return false;
  return hora >= HORARIO_MIN_LIBERACAO && hora <= HORARIO_MAX_LIBERACAO;
}

function configurarHorarioLiberacao() {
  const horaInput = document.getElementById('horaLiberacao');
  if (!horaInput) return;

  horaInput.addEventListener('input', function () {
    if (!horaInput.value) return;
    if (!horarioValido(horaInput.value)) {
      alert('O horário de saída deve estar entre 07:30 e 17:00 (horário de aula).');
      horaInput.value = '';
    }
  });
}

async function carregarAlunos() {
  const usuario = getUsuarioLogado();
  const idResponsavel = usuario?.pessoa?.id;
  const select = document.getElementById('estudante');
  if (!idResponsavel || !select) return;

  const resposta = await apiFetch(`${API_URL}/alunos?id_responsavel=${idResponsavel}`);
  const alunos = await resposta.json();

  select.innerHTML = '<option value="" disabled selected>Selecione o estudante...</option>';
  alunos.forEach(aluno => {
    select.innerHTML += `<option value="${escapeHtml(aluno.matricula)}">${escapeHtml(aluno.nome)} - ${escapeHtml(aluno.descricao || aluno.turma)}</option>`;
  });

  // Se a página foi aberta a partir de "Meus Estudantes" (?matricula=123),
  // já vem com o estudante certo pré-selecionado.
  const matriculaPreSelecionada = new URLSearchParams(window.location.search).get('matricula');
  if (matriculaPreSelecionada) select.value = matriculaPreSelecionada;
}

document.getElementById('formLiberacao').addEventListener('submit', async function (e) {
  e.preventDefault();

  const usuario = getUsuarioLogado();
  const estudante = document.getElementById('estudante').value;
  const data = document.getElementById('dataLiberacao').value;
  const hora = document.getElementById('horaLiberacao').value;
  const motivo = document.getElementById('motivo').value;
  const quemBusca = document.getElementById('quemBusca').value;
  const observacoes = document.getElementById('observacoes').value;

  if (!usuario?.pessoa?.id) { alert('Faça login novamente.'); return; }
  if (!estudante || !data || !hora || !motivo || !quemBusca) { alert('Preencha todos os campos obrigatórios.'); return; }

  if (motivo === 'Outro' && !observacoes.trim()) {
    alert('Para o motivo "Outro", preencha a descrição explicando do que se trata.');
    return;
  }
  if (quemBusca === 'Outro' && !observacoes.trim()) {
    alert('Informe na descrição quem irá buscar o estudante.');
    return;
  }

  if (!horarioValido(hora)) {
    alert('O horário de saída deve estar entre 07:30 e 17:00 (horário de aula).');
    return;
  }

  const diaSemanaHoje = new Date().getDay();
  if (diaSemanaHoje === 0 || diaSemanaHoje === 6) {
    alert('O envio de solicitações de liberação só pode ser realizado de segunda a sexta-feira.');
    return;
  }
  const diaSemanaLiberacao = new Date(data + 'T00:00:00').getDay();
  if (diaSemanaLiberacao === 0 || diaSemanaLiberacao === 6) {
    alert('A data de liberação deve ser de segunda a sexta-feira.');
    return;
  }

  const resposta = await apiFetch(`${API_URL}/ocorrencias/liberacoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      matricula: estudante,
      id_responsavel: usuario.pessoa.id,
      data_saida: data,
      hora_saida: hora,
      motivo,
      observacoes,
      quem_busca: quemBusca
    })
  });

  const resultado = await resposta.json();
  if (!resposta.ok) { alert(resultado.erro || 'Erro ao enviar solicitação.'); return; }

  alert(resultado.mensagem);
  document.body.classList.add('fade-out');
  setTimeout(() => { window.location.href = 'home.html'; }, 350);
});

function cancelarSolicitacao() {
  if (confirm('Deseja cancelar a solicitação?')) {
    document.body.classList.add('fade-out');
    setTimeout(() => { window.location.href = 'home.html'; }, 350);
  }
}
