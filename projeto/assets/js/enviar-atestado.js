/* Integra Escolar — Enviar Atestado conectado ao Flask */

const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');

fileInput.addEventListener('change', function () {
  fileName.textContent = fileInput.files.length > 0 ? 'Arquivo selecionado: ' + fileInput.files[0].name : '';
});

document.addEventListener('DOMContentLoaded', carregarAlunos);

async function carregarAlunos() {
  const usuario = getUsuarioLogado();
  const idResponsavel = usuario?.pessoa?.id;
  const select = document.getElementById('nomeEstudante');
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

function cancelarEnvio() {
  if (confirm('Deseja cancelar o envio do atestado?')) {
    document.body.classList.add('fade-out');
    setTimeout(() => { window.location.href = 'home.html'; }, 350);
  }
}

async function enviarArquivo() {
  const usuario = getUsuarioLogado();
  const estudante = document.getElementById('nomeEstudante').value;
  const tipo = document.getElementById('tipoDeclaracao')?.value || 'Atestado Médico';
  const observacoes = document.getElementById('observacoesAtestado')?.value || '';

  if (!usuario?.pessoa?.id) { alert('Faça login novamente.'); return; }
  if (!estudante) { alert('Selecione o estudante.'); return; }
  if (fileInput.files.length === 0) { alert('Selecione um arquivo para enviar.'); return; }

  const formData = new FormData();
  formData.append('matricula', estudante);
  formData.append('id_responsavel', usuario.pessoa.id);
  formData.append('tipo_declaracao', tipo);
  formData.append('observacoes', observacoes);
  formData.append('arquivo', fileInput.files[0]);

  const resposta = await apiFetch(`${API_URL}/ocorrencias/atestados`, { method: 'POST', body: formData });
  const resultado = await resposta.json();

  if (!resposta.ok) { alert(resultado.erro || 'Erro ao enviar atestado.'); return; }

  alert(resultado.mensagem);
  document.body.classList.add('fade-out');
  setTimeout(() => { window.location.href = 'home.html'; }, 350);
}
