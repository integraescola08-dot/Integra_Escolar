/* Integra Escolar — Meus Estudantes
   Roda dentro de um <iframe> em home.html (ver assets/js/header.js).
   Recebe o usuário logado via postMessage e busca os alunos vinculados
   a ele na API real (GET /api/alunos?id_responsavel=...). */

window.addEventListener('message', function (e) {
  if (e.data && e.data.tipo === 'integra:usuario') {
    contextoAtual = { usuario: e.data.usuario, apiUrl: e.data.apiUrl };
    carregarEstudantes(e.data.usuario, e.data.apiUrl);
  }
});

if (window.parent && window.parent !== window) {
  window.parent.postMessage({ tipo: 'integra:pedir-usuario' }, window.location.origin);
}

// Guarda o contexto (apiUrl) recebido do pai para reutilizar no formulário
// de vincular estudante, sem precisar pedir de novo.
let contextoAtual = null;

function getIniciais(nome) {
  return (nome || '')
    .trim()
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

async function carregarEstudantes(usuario, apiUrl) {
  const lista = document.getElementById('lista');
  if (!usuario || !usuario.pessoa || !apiUrl) return;

  try {
    const resposta = await apiFetch(`${apiUrl}/alunos?id_responsavel=${usuario.pessoa.id}`);
    const alunos = await resposta.json();
    renderizar(alunos);
  } catch (erro) {
    lista.innerHTML = `
      <div class="status-msg">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p>Não foi possível carregar seus estudantes agora.</p>
      </div>`;
    console.error('Erro ao carregar estudantes:', erro);
  }
}

function renderizar(alunos) {
  const lista = document.getElementById('lista');

  if (!alunos || alunos.length === 0) {
    lista.innerHTML = `
      <div class="status-msg">
        <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <p>Nenhum estudante vinculado à sua conta ainda.</p>
      </div>`;
    return;
  }

  lista.innerHTML = alunos.map(aluno => {
    const turmaLabel = aluno.descricao ? `Turma ${aluno.turma} — ${aluno.descricao}` : `Turma ${aluno.turma}`;
    return `
      <div class="aluno-card">
        <div class="aluno-top">
          <div class="aluno-avatar">${escapeHtml(getIniciais(aluno.nome))}</div>
          <div class="aluno-info">
            <div class="aluno-nome" title="${escapeHtml(aluno.nome)}">${escapeHtml(aluno.nome)}</div>
            <div class="aluno-turma">${escapeHtml(turmaLabel)}</div>
          </div>
        </div>
        <span class="aluno-chip">Matrícula ${aluno.matricula}</span>
        <div class="aluno-acoes">
          <button class="btn-acao primario" onclick="irParaPainel('liberar-estudante.html', ${aluno.matricula})">
            <svg viewBox="0 0 24 24"><path d="M18 8L22 12L18 16"/><path d="M2 12H22"/></svg>
            Liberar este estudante
          </button>
          <button class="btn-acao secundario" onclick="irParaPainel('enviar-atestado.html', ${aluno.matricula})">
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Enviar atestado
          </button>
        </div>
      </div>`;
  }).join('');
}

// Esta página vive num iframe — para navegar para uma tela cheia (fora da
// esteira), a navegação precisa "escapar" para a janela pai, reaproveitando
// a função ir() dela (mesma animação de transição já usada no resto do app).
function irParaPainel(pagina, matricula) {
  const destino = `${pagina}?matricula=${matricula}`;
  if (window.parent && typeof window.parent.ir === 'function') {
    window.parent.ir(destino, null, 'avancar');
  } else {
    window.location.href = destino;
  }
}

/* ── Modal: adicionar estudante por matrícula ── */
const modal = document.getElementById('modal-vincular');
const formVincular = document.getElementById('form-vincular');
const inputMatricula = document.getElementById('input-matricula');
const modalMsg = document.getElementById('modal-msg');
const btnConfirmar = document.getElementById('btn-confirmar-vincular');

function abrirModal() {
  modalMsg.hidden = true;
  formVincular.reset();
  modal.hidden = false;
  inputMatricula.focus();
}

function fecharModal() {
  modal.hidden = true;
}

document.getElementById('btn-abrir-vincular').addEventListener('click', abrirModal);
document.getElementById('btn-cancelar-vincular').addEventListener('click', fecharModal);
modal.addEventListener('click', e => { if (e.target === modal) fecharModal(); });

inputMatricula.addEventListener('input', () => {
  inputMatricula.value = inputMatricula.value.replace(/\D/g, '').slice(0, 12);
});

formVincular.addEventListener('submit', async e => {
  e.preventDefault();
  const matricula = inputMatricula.value.trim();

  modalMsg.hidden = true;
  if (!/^\d{6,12}$/.test(matricula)) {
    modalMsg.textContent = 'Informe uma matrícula válida (entre 6 e 12 dígitos).';
    modalMsg.className = 'modal-msg erro';
    modalMsg.hidden = false;
    return;
  }
  if (!contextoAtual || !contextoAtual.apiUrl) {
    modalMsg.textContent = 'Não foi possível identificar sua sessão. Recarregue a página.';
    modalMsg.className = 'modal-msg erro';
    modalMsg.hidden = false;
    return;
  }

  btnConfirmar.disabled = true;
  btnConfirmar.textContent = 'Vinculando...';
  try {
    const resposta = await apiFetch(`${contextoAtual.apiUrl}/alunos/vincular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matricula })
    });
    const resultado = await resposta.json();
    if (!resposta.ok) throw new Error(resultado.erro || 'Não foi possível vincular o estudante.');

    fecharModal();
    await carregarEstudantes(contextoAtual.usuario, contextoAtual.apiUrl);
  } catch (erro) {
    modalMsg.textContent = erro.message;
    modalMsg.className = 'modal-msg erro';
    modalMsg.hidden = false;
  } finally {
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = 'Vincular';
  }
});
