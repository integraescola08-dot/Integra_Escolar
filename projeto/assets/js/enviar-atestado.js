/* Integra Escolar — Enviar Atestado */

const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const uploadContent = document.getElementById('uploadContent');
const uploadPreview = document.getElementById('uploadPreview');
const removerArquivoBtn = document.getElementById('removerArquivo');

const EXTENSOES_ACEITAS = ['.pdf', '.png', '.jpg', '.jpeg'];
const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024;

function extensaoAceita(nomeArquivo) {
  const nome = (nomeArquivo || '').toLowerCase();
  return EXTENSOES_ACEITAS.some(ext => nome.endsWith(ext));
}

function limparArquivoSelecionado() {
  fileInput.value = '';
  fileName.textContent = '';
  uploadPreview?.classList.remove('ativo');
  if (uploadContent) uploadContent.style.display = '';
}

function mostrarArquivoSelecionado(arquivo) {
  fileName.textContent = arquivo.name;
  if (uploadContent) uploadContent.style.display = 'none';
  uploadPreview?.classList.add('ativo');
}

fileInput?.addEventListener('change', function () {
  const arquivo = fileInput.files[0];
  if (!arquivo) { limparArquivoSelecionado(); return; }
  if (!extensaoAceita(arquivo.name)) {
    alert('Formato inválido. Envie PDF, PNG, JPG ou JPEG.');
    limparArquivoSelecionado();
    return;
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    alert('O arquivo deve ter no máximo 10MB.');
    limparArquivoSelecionado();
    return;
  }
  mostrarArquivoSelecionado(arquivo);
});

removerArquivoBtn?.addEventListener('click', function (evento) {
  evento.preventDefault();
  evento.stopPropagation();
  limparArquivoSelecionado();
});

document.addEventListener('DOMContentLoaded', () => {
  carregarAlunos();
  configurarDescricaoObrigatoria();
  configurarPeriodoAtestado();
});

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

function configurarPeriodoAtestado() {
  const inicio = document.getElementById('dataInicioAtestado');
  const fim = document.getElementById('dataFimAtestado');
  if (!inicio || !fim) return;
  const ano = new Date().getFullYear();
  const min = `${ano}-01-01`;
  const max = `${ano}-12-31`;
  inicio.min = fim.min = min;
  inicio.max = fim.max = max;
  inicio.addEventListener('change', () => {
    fim.min = inicio.value || min;
    if (!fim.value || fim.value < inicio.value) fim.value = inicio.value;
  });
}

async function carregarAlunos() {
  const usuario = getUsuarioLogado();
  const select = document.getElementById('nomeEstudante');
  const botaoEnviar = document.getElementById('btnEnviar');
  if (!select) return;
  if (!usuario?.pessoa?.id) {
    select.innerHTML = '<option value="" disabled selected>Faça login novamente</option>';
    select.disabled = true;
    if (botaoEnviar) botaoEnviar.disabled = true;
    return;
  }
  if (botaoEnviar) botaoEnviar.disabled = true;
  try {
    const resposta = await apiFetch(`${API_URL}/alunos`);
    if (!resposta.ok) throw new Error('Falha ao buscar estudantes.');
    const alunos = await resposta.json();
    select.innerHTML = '<option value="" disabled selected>Selecione o estudante...</option>';
    alunos.forEach(aluno => {
      select.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(aluno.matricula)}">${escapeHtml(aluno.nome)} - ${escapeHtml(aluno.turma)}</option>`);
    });
    select.disabled = false;
    if (botaoEnviar) botaoEnviar.disabled = alunos.length === 0;
    const pre = new URLSearchParams(window.location.search).get('matricula');
    if (pre) select.value = pre;
  } catch (erro) {
    select.innerHTML = '<option value="" disabled selected>Não foi possível carregar os estudantes</option>';
    select.disabled = true;
    if (botaoEnviar) botaoEnviar.disabled = true;
  }
}

function cancelarEnvio() {
  if (confirm('Deseja cancelar o envio do atestado?')) {
    document.body.classList.add('fade-out');
    setTimeout(() => { window.location.href = 'home.html'; }, 350);
  }
}

async function enviarArquivo() {
  const estudante = document.getElementById('nomeEstudante')?.value;
  const tipo = document.getElementById('tipoDeclaracao')?.value;
  const observacoes = document.getElementById('observacoesAtestado')?.value || '';
  const dataInicio = document.getElementById('dataInicioAtestado')?.value;
  const dataFim = document.getElementById('dataFimAtestado')?.value;

  if (!estudante) { alert('Selecione o estudante.'); return; }
  if (!tipo) { alert('Selecione o tipo de declaração.'); return; }
  if (!dataInicio || !dataFim) { alert('Informe o período coberto pelo documento.'); return; }
  if (dataFim < dataInicio) { alert('A data final não pode ser anterior à data inicial.'); return; }
  if (fileInput.files.length === 0) { alert('Selecione um arquivo para enviar.'); return; }
  if (tipo === 'outros' && !observacoes.trim()) {
    alert('Para o tipo "Outros", preencha a descrição.');
    return;
  }

  const formData = new FormData();
  formData.append('matricula', estudante);
  formData.append('tipo_declaracao', tipo);
  formData.append('observacoes', observacoes);
  formData.append('data_inicio', dataInicio);
  formData.append('data_fim', dataFim);
  formData.append('arquivo', fileInput.files[0]);

  const btn = document.getElementById('btnEnviar');
  const textoOriginal = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
  try {
    const resposta = await apiFetch(`${API_URL}/ocorrencias/atestados`, { method: 'POST', body: formData });
    const resultado = await resposta.json();
    if (!resposta.ok) { alert(resultado.erro || 'Erro ao enviar atestado.'); return; }
    alert(resultado.mensagem);
    document.body.classList.add('fade-out');
    setTimeout(() => { window.location.href = 'home.html'; }, 350);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = textoOriginal || 'Enviar'; }
  }
}
