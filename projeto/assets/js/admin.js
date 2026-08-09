/* ============================================================
   Integra Escolar — Painel do Administrador
   Adaptado para usar nosso sistema de token (apiFetch/getUsuarioLogado)
   em vez de sessão de servidor.
   ============================================================ */

const $  = seletor => document.querySelector(seletor);
const $$ = seletor => document.querySelectorAll(seletor);

function msg(texto, erro = false) {
  const el = $('#mensagem');
  el.textContent = texto;
  el.className = erro ? 'erro' : 'sucesso';
  setTimeout(() => { el.className = ''; }, 3500);
}

async function chamarApi(caminho, opcoes = {}) {
  const resposta = await apiFetch(`${API_URL}${caminho}`, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', ...(opcoes.headers || {}) }
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || 'Erro na operação.');
  return dados;
}

function dadosDoFormulario(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function renderizarLinhas(lista, campos) {
  if (!lista.length) return '<p class="vazio">Nenhum registro cadastrado.</p>';
  return lista.map(item =>
    `<div class="linha">${campos.map(c => `<span>${escapeHtml(item[c] ?? '—')}</span>`).join('')}</div>`
  ).join('');
}

async function carregar() {
  const usuario = getUsuarioLogado();
  if (!usuario || usuario.perfil !== 'administrador') {
    window.location.href = '../../index.html';
    return;
  }
  $('#saudacao').textContent = `Bem-vindo, ${(usuario.pessoa && usuario.pessoa.nome) || 'Administrador'}`;

  const resumo = await chamarApi('/admin/resumo');
  ['alunos', 'professores', 'coordenadores', 'turmas'].forEach(chave => {
    $(`#n-${chave}`).textContent = resumo[chave];
  });

  const [turmas, alunos, professores, coordenadores] = await Promise.all([
    chamarApi('/admin/turmas'),
    chamarApi('/admin/alunos'),
    chamarApi('/admin/professores'),
    chamarApi('/admin/coordenadores'),
  ]);

  $('#lista-turmas').innerHTML        = renderizarLinhas(turmas, ['codigo', 'descricao']);
  $('#lista-alunos').innerHTML        = renderizarLinhas(alunos, ['matricula', 'nome', 'turma', 'responsavel']);
  $('#lista-professores').innerHTML   = renderizarLinhas(professores, ['matricula', 'nome', 'email', 'telefone']);
  $('#lista-coordenadores').innerHTML = renderizarLinhas(coordenadores, ['id', 'nome', 'email', 'telefone']);

  const selectTurma = document.querySelector('#form-aluno select');
  selectTurma.innerHTML = '<option value="">Selecione a turma</option>' +
    turmas.map(t => `<option value="${escapeHtml(t.codigo)}">${escapeHtml(t.codigo)} — ${escapeHtml(t.descricao)}</option>`).join('');
}

// ── Troca de abas ─────────────────────────────────────────────
$$('.tabs button').forEach(botao => {
  botao.addEventListener('click', () => {
    $$('.tabs button, .painel').forEach(el => el.classList.remove('ativo'));
    botao.classList.add('ativo');
    document.getElementById(botao.dataset.tab).classList.add('ativo');
  });
});

// ── Máscara: só números, no máximo 7 dígitos, na matrícula do aluno ──
const matriculaAlunoInput = document.querySelector('#form-aluno input[name="matricula"]');
if (matriculaAlunoInput) {
  matriculaAlunoInput.addEventListener('input', () => {
    matriculaAlunoInput.value = matriculaAlunoInput.value.replace(/\D/g, '').slice(0, 7);
  });
}

// ── Envio de formulários ─────────────────────────────────────
async function enviarFormulario(form, caminho) {
  try {
    const dados = dadosDoFormulario(form);

    // Matrícula é opcional aqui — mas se foi preenchida, precisa ter 7 dígitos.
    if (form === $('#form-aluno') && dados.matricula && dados.matricula.length !== 7) {
      throw new Error('A matrícula deve ter exatamente 7 dígitos, ou fique em branco para gerar automaticamente.');
    }

    const resultado = await chamarApi(caminho, {
      method: 'POST',
      body: JSON.stringify(dados)
    });
    msg(resultado.mensagem);
    form.reset();
    await carregar();
  } catch (erro) {
    msg(erro.message, true);
  }
}

$('#form-turma').addEventListener('submit', e => { e.preventDefault(); enviarFormulario(e.target, '/admin/turmas'); });
$('#form-aluno').addEventListener('submit', e => { e.preventDefault(); enviarFormulario(e.target, '/admin/alunos'); });
$('#form-professor').addEventListener('submit', e => { e.preventDefault(); enviarFormulario(e.target, '/admin/professores'); });
$('#form-coordenador').addEventListener('submit', e => { e.preventDefault(); enviarFormulario(e.target, '/admin/coordenadores'); });

// sair() já vem do header.js — limpa a sessão (usuário + token) e volta pro login.
$('#logout').addEventListener('click', sair);

// ── Init ──────────────────────────────────────────────────────
carregar().catch(erro => msg(erro.message, true));
