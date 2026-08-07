/* Integra Escolar — Liberar Estudante conectado ao Flask */

document.addEventListener('DOMContentLoaded', carregarAlunos);
document.addEventListener('DOMContentLoaded', configurarCalendarioLiberacao);
document.addEventListener('DOMContentLoaded', configurarHorarioLiberacao);

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

// Garante que o horário digitado seja um horário válido (00:00 a 23:59).
function horarioValido(hora) {
  if (!/^\d{2}:\d{2}$/.test(hora)) return false;
  const [h, m] = hora.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function configurarHorarioLiberacao() {
  const horaInput = document.getElementById('horaLiberacao');
  if (!horaInput) return;

  horaInput.addEventListener('input', function () {
    if (!horaInput.value) return;
    if (!horarioValido(horaInput.value)) {
      alert('Digite um horário válido (00:00 a 23:59).');
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
  const observacoes = document.getElementById('observacoes').value;

  if (!usuario?.pessoa?.id) { alert('Faça login novamente.'); return; }
  if (!estudante || !data || !hora || !motivo) { alert('Preencha todos os campos obrigatórios.'); return; }

  if (!horarioValido(hora)) {
    alert('Digite um horário válido (00:00 a 23:59).');
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
      quem_busca: 'Responsável'
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
