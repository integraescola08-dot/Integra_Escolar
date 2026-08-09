/* Integra Escolar — Enviar Atestado conectado ao Flask */

const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const uploadContent = document.getElementById('uploadContent');
const uploadPreview = document.getElementById('uploadPreview');
const removerArquivoBtn = document.getElementById('removerArquivo');

// Precisa bater com a legenda mostrada na tela ("PDF, PNG, JPG ou JPEG").
// Se um dia o back-end passar a aceitar outro formato (ex.: .docx, .webp),
// atualize aqui e na legenda do HTML juntos, senão o usuário fica sem
// entender por que um arquivo "válido" é recusado.
const EXTENSOES_ACEITAS = ['.pdf', '.png', '.jpg', '.jpeg'];
const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10MB, igual à legenda

function extensaoAceita(nomeArquivo) {
  const nome = (nomeArquivo || '').toLowerCase();
  return EXTENSOES_ACEITAS.some(ext => nome.endsWith(ext));
}

function limparArquivoSelecionado() {
  fileInput.value = '';
  fileName.textContent = '';
  uploadPreview.classList.remove('ativo');
  uploadContent.style.display = '';
}

function mostrarArquivoSelecionado(arquivo) {
  fileName.textContent = arquivo.name;
  uploadContent.style.display = 'none';
  uploadPreview.classList.add('ativo');
}

fileInput.addEventListener('change', function () {
  // Sem o atributo "multiple" no input, o seletor nativo já só deixa
  // escolher 1 arquivo por vez — mas garantimos aqui também, olhando só
  // para o primeiro item, caso isso mude no futuro (ex.: drag-and-drop).
  const arquivo = fileInput.files[0];
  if (!arquivo) { limparArquivoSelecionado(); return; }

  if (!extensaoAceita(arquivo.name)) {
    alert('Não foi possível carregar arquivo por causa do tipo.');
    limparArquivoSelecionado();
    return;
  }

  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    alert('Não foi possível carregar arquivo: o tamanho máximo permitido é 10MB.');
    limparArquivoSelecionado();
    return;
  }

  mostrarArquivoSelecionado(arquivo);
});

// O upload-box inteiro é um <label>, então um clique em qualquer lugar
// dentro dele (inclusive no botão de remover) normalmente abriria o
// seletor de arquivos de novo. Paramos essa propagação aqui para que o
// botão só remova o arquivo, sem reabrir o diálogo.
removerArquivoBtn.addEventListener('click', function (evento) {
  evento.preventDefault();
  evento.stopPropagation();
  limparArquivoSelecionado();
});

document.addEventListener('DOMContentLoaded', carregarAlunos);
document.addEventListener('DOMContentLoaded', configurarDescricaoObrigatoria);

// Quando o tipo de declaração é "Outros", não dá pra saber do que se trata
// só pelo tipo — por isso o campo de observações passa a se chamar
// "Descrição" e se torna obrigatório. Nos demais tipos, ele continua
// opcional (serve só de complemento).
function configurarDescricaoObrigatoria() {
  const tipoSelect = document.getElementById('tipoDeclaracao');
  const textarea = document.getElementById('observacoesAtestado');
  const titulo = document.getElementById('tituloObservacoes');
  const marcaOpcional = document.getElementById('marcaOpcional');
  const marcaObrigatoria = document.getElementById('marcaObrigatoria');
  if (!tipoSelect || !textarea) return;

  function atualizar() {
    const ehOutros = tipoSelect.value === 'outros';
    textarea.required = ehOutros;
    if (titulo) titulo.firstChild.textContent = ehOutros ? 'Descrição ' : 'Observações ';
    if (marcaOpcional) marcaOpcional.style.display = ehOutros ? 'none' : '';
    if (marcaObrigatoria) marcaObrigatoria.style.display = ehOutros ? '' : 'none';
  }

  tipoSelect.addEventListener('change', atualizar);
  atualizar();
}

async function carregarAlunos() {
  const usuario = getUsuarioLogado();
  const idResponsavel = usuario?.pessoa?.id;
  const select = document.getElementById('nomeEstudante');
  const botaoEnviar = document.getElementById('btnEnviar');
  if (!select) return;

  if (!idResponsavel) {
    select.innerHTML = '<option value="" disabled selected>Faça login novamente</option>';
    select.disabled = true;
    if (botaoEnviar) botaoEnviar.disabled = true;
    return;
  }

  if (botaoEnviar) botaoEnviar.disabled = true; // liberado só quando a lista carregar com sucesso

  try {
    const resposta = await apiFetch(`${API_URL}/alunos?id_responsavel=${idResponsavel}`);
    if (!resposta.ok) throw new Error('Falha ao buscar estudantes.');
    const alunos = await resposta.json();

    select.innerHTML = '<option value="" disabled selected>Selecione o estudante...</option>';
    alunos.forEach(aluno => {
      select.innerHTML += `<option value="${escapeHtml(aluno.matricula)}">${escapeHtml(aluno.nome)} - ${escapeHtml(aluno.descricao || aluno.turma)}</option>`;
    });
    select.disabled = false;
    if (botaoEnviar) botaoEnviar.disabled = false;

    // Se a página foi aberta a partir de "Meus Estudantes" (?matricula=123),
    // já vem com o estudante certo pré-selecionado.
    const matriculaPreSelecionada = new URLSearchParams(window.location.search).get('matricula');
    if (matriculaPreSelecionada) select.value = matriculaPreSelecionada;
  } catch (erro) {
    // Se a busca falhar, NUNCA deixamos o campo com opções "de mentira"
    // selecionáveis — isso poderia levar o responsável a enviar o atestado
    // vinculado à matrícula errada. Trava tudo e avisa com clareza.
    select.innerHTML = '<option value="" disabled selected>Não foi possível carregar os estudantes</option>';
    select.disabled = true;
    if (botaoEnviar) botaoEnviar.disabled = true;
    alert('Não foi possível carregar a lista de estudantes. Atualize a página e tente novamente.');
  }
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
  if (tipo === 'outros' && !observacoes.trim()) {
    alert('Para o tipo "Outros", preencha a descrição explicando do que se trata.');
    document.getElementById('observacoesAtestado').focus();
    return;
  }

  const diaSemanaHoje = new Date().getDay();
  if (diaSemanaHoje === 0 || diaSemanaHoje === 6) {
    alert('O envio de atestados só pode ser realizado de segunda a sexta-feira.');
    return;
  }

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
