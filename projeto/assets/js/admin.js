const $  = seletor => document.querySelector(seletor);
const $$ = seletor => document.querySelectorAll(seletor);

function msg(texto, erro = false) {
  const el = $('#mensagem');
  el.textContent = texto;
  el.className = erro ? 'erro' : 'sucesso';
  setTimeout(() => { el.className = ''; }, 4500);
}

async function chamarApi(caminho, opcoes = {}) {
  const resposta = await apiFetch(`${API_URL}${caminho}`, opcoes);
  const tipo = resposta.headers.get('content-type') || '';
  const dados = tipo.includes('application/json') ? await resposta.json() : {};
  if (!resposta.ok) throw new Error(dados.erro || `Erro na operação (${resposta.status}).`);
  return dados;
}

function dadosDoFormulario(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function renderizarLinhas(lista, campos, opcoes = {}) {
  if (!lista.length) return '<p class="vazio">Nenhum registro cadastrado.</p>';
  return lista.map(item => {
    const colunas = campos.map(c => `<span>${item[c] ?? '—'}</span>`).join('');
    const excluir = opcoes.excluir
      ? `<button type="button" class="btn-excluir" data-excluir="${opcoes.excluir}" data-id="${item[opcoes.chave]}">Excluir</button>`
      : '';
    return `<div class="linha">${colunas}${excluir}</div>`;
  }).join('');
}

const NOME_RECURSO = {
  turmas: 'turma',
  alunos: 'aluno',
  professores: 'professor',
  coordenadores: 'coordenador(a)',
  porteiros: 'porteiro(a)',
};

async function excluirRegistro(botao) {
  const tipo = botao.dataset.excluir;
  const id = botao.dataset.id;
  const nome = NOME_RECURSO[tipo] || 'registro';
  if (!confirm(`Tem certeza que deseja excluir este(a) ${nome}? Essa ação não pode ser desfeita.`)) return;

  botao.disabled = true;
  const textoOriginal = botao.textContent;
  botao.textContent = 'Excluindo...';
  try {
    const resultado = await chamarApi(`/admin/${tipo}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    msg(resultado.mensagem);
    await carregar();
  } catch (erro) {
    msg(erro.message, true);
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

document.addEventListener('click', e => {
  const botao = e.target.closest('[data-excluir]');
  if (botao) excluirRegistro(botao);
});

async function carregar() {
  const usuario = getUsuarioLogado();
  if (!usuario || usuario.perfil !== 'administrador') {
    window.location.href = '../../index.html';
    return;
  }
  $('#saudacao').textContent = `Bem-vindo, ${(usuario.pessoa && usuario.pessoa.nome) || 'Administrador'}`;

  const resumo = await chamarApi('/admin/resumo');
  ['alunos', 'professores', 'coordenadores', 'porteiros', 'turmas'].forEach(chave => {
    $(`#n-${chave}`).textContent = resumo[chave];
  });

  const [turmas, alunos, professores, coordenadores, porteiros, materias] = await Promise.all([
    chamarApi('/admin/turmas'),
    chamarApi('/admin/alunos'),
    chamarApi('/admin/professores'),
    chamarApi('/admin/coordenadores'),
    chamarApi('/admin/porteiros'),
    chamarApi('/admin/materias'),
  ]);

  $('#lista-turmas').innerHTML        = renderizarLinhas(turmas, ['codigo', 'total_aulas'], { excluir: 'turmas', chave: 'codigo' });
  $('#lista-alunos').innerHTML        = renderizarLinhas(alunos, ['matricula', 'nome', 'turma', 'responsavel'], { excluir: 'alunos', chave: 'matricula' });
  $('#lista-professores').innerHTML   = renderizarLinhas(professores, ['matricula', 'nome', 'materias', 'email', 'telefone'], { excluir: 'professores', chave: 'matricula' });
  $('#lista-coordenadores').innerHTML = renderizarLinhas(coordenadores, ['id', 'nome', 'email', 'telefone'], { excluir: 'coordenadores', chave: 'id' });
  $('#lista-porteiros').innerHTML      = renderizarLinhas(porteiros, ['id', 'nome', 'email', 'telefone'], { excluir: 'porteiros', chave: 'id' });

  const selectTurma = document.querySelector('#form-aluno select[name="turma"]');
  selectTurma.innerHTML = '<option value="">Selecione a turma</option>' +
    turmas.map(t => `<option value="${t.codigo}">${t.codigo}</option>`).join('');

  const selectMateria = document.querySelector('#form-professor select[name="id_materia"]');
  selectMateria.innerHTML = '<option value="">Selecione a matéria</option>' +
    materias.map(m => `<option value="${m.id_materia}">${m.nome}</option>`).join('');
}

$$('.tabs button').forEach(botao => {
  botao.addEventListener('click', () => {
    $$('.tabs button, .painel').forEach(el => el.classList.remove('ativo'));
    botao.classList.add('ativo');
    document.getElementById(botao.dataset.tab).classList.add('ativo');
  });
});

async function enviarJson(form, caminho) {
  try {
    const resultado = await chamarApi(caminho, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dadosDoFormulario(form))
    });
    msg(resultado.mensagem);
    form.reset();
    await carregar();
  } catch (erro) {
    msg(erro.message, true);
  }
}

async function enviarTurma(form) {
  const botao = form.querySelector('button');
  try {
    botao.disabled = true;
    botao.textContent = 'Importando...';
    const resultado = await chamarApi('/admin/turmas', {
      method: 'POST',
      body: new FormData(form)
    });
    let complemento = `${resultado.aulas_importadas} aulas e ${resultado.materias_identificadas} matérias identificadas.`;
    if (resultado.aulas_sem_professor) {
      complemento += ` ${resultado.aulas_sem_professor} aulas aguardam professor da matéria.`;
    }
    msg(`${resultado.mensagem} ${complemento}`);
    form.reset();
    await carregar();
  } catch (erro) {
    msg(erro.message, true);
  } finally {
    botao.disabled = false;
    botao.textContent = 'Cadastrar turma e importar grade';
  }
}

$('#form-turma').addEventListener('submit', e => { e.preventDefault(); enviarTurma(e.target); });
$('#form-aluno').addEventListener('submit', e => { e.preventDefault(); enviarJson(e.target, '/admin/alunos'); });
$('#form-professor').addEventListener('submit', e => { e.preventDefault(); enviarJson(e.target, '/admin/professores'); });
$('#form-coordenador').addEventListener('submit', e => { e.preventDefault(); enviarJson(e.target, '/admin/coordenadores'); });
$('#form-porteiro').addEventListener('submit', e => { e.preventDefault(); enviarJson(e.target, '/admin/porteiros'); });

$('#logout').addEventListener('click', sair);

carregar().catch(erro => msg(erro.message, true));
