/* Integra Escolar — Liberar Estudante conectado ao Flask */

document.addEventListener('DOMContentLoaded', carregarAlunos);

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
