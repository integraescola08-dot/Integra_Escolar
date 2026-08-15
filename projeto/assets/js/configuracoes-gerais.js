const state = {
  role: 'responsavel',
  avatarUrl: null,
  avatarDirty: false,
  notif: {
    email_ativo: true,
    push_ativo: true,
    atestado_analisado: true,
    liberacao_processada: true,
    nova_ausencia: true,
    falta_justificada: true,
    novo_atestado: true,
    nova_liberacao: true
  }
};

const ROLE_POR_NIVEL = {
  1: 'responsavel',
  2: 'professor',
  3: 'gestao',
  4: 'porteiro',
  5: 'administrador'
};

const ROLE_LABELS = {
  responsavel: 'Responsável',
  professor: 'Professor',
  gestao: 'Gestão Escolar',
  porteiro: 'Porteiro',
  administrador: 'Administrador'
};

const NOTIF_EVENTS = {
  responsavel: [
    { key: 'atestado_analisado', label: 'Atestado analisado', desc: 'Quando a gestão aprova ou rejeita um atestado' },
    { key: 'liberacao_processada', label: 'Liberação processada', desc: 'Quando a gestão decide sobre uma liberação' }
  ],
  professor: [
    { key: 'nova_ausencia', label: 'Nova ausência registrada', desc: 'Quando um aluno da sua turma falta' },
    { key: 'falta_justificada', label: 'Falta justificada pela gestão', desc: 'Quando um atestado é aprovado' }
  ],
  gestao: [
    { key: 'novo_atestado', label: 'Novo atestado recebido', desc: 'Quando um responsável envia um atestado' },
    { key: 'nova_liberacao', label: 'Nova solicitação de liberação', desc: 'Quando um responsável solicita liberação' }
  ],
  porteiro: [],
  administrador: []
};

window.addEventListener('message', function (e) {
  if (e.origin !== window.location.origin) return;
  if (e.data && e.data.tipo === 'integra:usuario') {
    preencherComUsuarioReal(e.data.usuario);
  }
});

if (window.parent && window.parent !== window) {
  window.parent.postMessage({ tipo: 'integra:pedir-usuario' }, window.location.origin);
}

async function preencherComUsuarioReal(usuario) {
  if (!usuario) return;

  state.role = ROLE_POR_NIVEL[usuario.nivel_acesso] || usuario.perfil || 'responsavel';
  preencherCamposBasicos(usuario);
  await carregarPerfilReal();
  await carregarNotificacoes();
}

function preencherCamposBasicos(usuario) {
  const nome = (usuario.pessoa && usuario.pessoa.nome) || 'Usuário';
  const email = usuario.email || '';
  const telefone = usuario.telefone || '';

  document.getElementById('input-nome').value = nome;
  document.getElementById('input-email').value = email;
  document.getElementById('input-tel').value = formatarTelefone(telefone);
  document.getElementById('header-role-label').textContent = ROLE_LABELS[state.role] || 'Usuário';
  aplicarAvatar(usuario.foto_perfil || null);
  syncHeader();
}

async function carregarPerfilReal() {
  try {
    const resposta = await apiFetch(`${API_URL}/auth/perfil`);
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível carregar o perfil.');
    if (dados.usuario) {
      preencherCamposBasicos(dados.usuario);
      state.avatarDirty = false;
    }
  } catch (erro) {
    console.warn('Não foi possível carregar o perfil do servidor:', erro);
  }
}

function formatarTelefone(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

function getInitials(nome) {
  return String(nome || 'Usuário').trim().split(/\s+/).map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function syncHeader() {
  const nome = document.getElementById('input-nome').value || 'Usuário';
  const email = document.getElementById('input-email').value || '';
  document.getElementById('header-name').textContent = nome;
  document.getElementById('header-email').textContent = email;
  if (!state.avatarUrl) document.getElementById('header-avatar').textContent = getInitials(nome);
}

function aplicarAvatar(dataUrl) {
  state.avatarUrl = dataUrl || null;
  const initials = document.getElementById('perfil-avatar-initials');
  const img = document.getElementById('perfil-avatar-img');
  const remove = document.getElementById('btn-remove-photo');

  if (state.avatarUrl) {
    initials.style.display = 'none';
    img.src = state.avatarUrl;
    img.style.display = 'block';
    remove.style.display = 'inline';
    document.getElementById('header-avatar').innerHTML = `<img src="${state.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  } else {
    initials.style.display = '';
    img.src = '';
    img.style.display = 'none';
    remove.style.display = 'none';
  }
}

function handleAvatarChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Escolha uma imagem válida.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 256;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      state.avatarUrl = canvas.toDataURL('image/jpeg', 0.82);
      state.avatarDirty = true;
      aplicarAvatar(state.avatarUrl);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function removeAvatar() {
  state.avatarUrl = null;
  state.avatarDirty = true;
  aplicarAvatar(null);
  syncHeader();
}

async function savePerfil() {
  const nome = document.getElementById('input-nome').value.trim();
  const email = document.getElementById('input-email').value.trim();
  const telefone = document.getElementById('input-tel').value.replace(/\D/g, '');

  if (!nome || !email || !telefone) {
    showToast('Preencha nome, email e telefone.', 'error');
    return;
  }
  if (![10, 11].includes(telefone.length)) {
    showToast('Informe um telefone válido com DDD.', 'error');
    return;
  }

  const botao = document.querySelector('#screen-perfil .btn-save');
  setButtonLoading(botao, 'Salvando...');

  try {
    const corpo = { nome, email, telefone };
    if (state.avatarDirty) corpo.foto_perfil = state.avatarUrl;

    const resposta = await apiFetch(`${API_URL}/auth/perfil`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível salvar o perfil.');

    state.avatarDirty = false;
    if (dados.usuario) {
      preencherCamposBasicos(dados.usuario);
      atualizarUsuarioPai(dados.usuario, dados.token);
    }
    showToast(dados.mensagem || 'Perfil atualizado com sucesso!', 'success');
    setTimeout(() => goTo('screen-main'), 1000);
  } catch (erro) {
    showToast(erro.message, 'error');
  } finally {
    restoreButton(botao, 'Salvar alterações');
  }
}

function atualizarUsuarioPai(usuario, token) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ tipo: 'integra:usuario-atualizado', usuario, token }, window.location.origin);
  }
}

async function carregarNotificacoes() {
  try {
    const resposta = await apiFetch(`${API_URL}/auth/notificacoes`);
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || 'Falha ao carregar notificações.');
    if (dados.preferencias) state.notif = { ...state.notif, ...dados.preferencias };
    aplicarNotificacoesNaTela();
  } catch (erro) {
    console.warn('Não foi possível carregar notificações:', erro);
    aplicarNotificacoesNaTela();
  }
}

function renderNotifEvents() {
  const eventos = NOTIF_EVENTS[state.role] || [];
  document.getElementById('notif-events').innerHTML = eventos.length
    ? eventos.map(ev => `
      <div class="toggle-item" style="margin-bottom:12px">
        <div class="toggle-item-text">
          <div class="tl">${ev.label}</div>
          <div class="td">${ev.desc}</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="notif-${ev.key}" ${state.notif[ev.key] ? 'checked' : ''} />
          <span class="toggle-track"></span><span class="toggle-thumb"></span>
        </label>
      </div>`).join('')
    : '<p class="td">Este perfil não possui eventos configuráveis.</p>';

  const email = document.getElementById('toggle-email');
  const push = document.getElementById('toggle-push');
  if (email) email.checked = !!state.notif.email_ativo;
  if (push) push.checked = !!state.notif.push_ativo;
  updateNotifDesc();
}

function aplicarNotificacoesNaTela() {
  renderNotifEvents();
}

function updateNotifDesc() {
  const email = document.getElementById('toggle-email');
  const push = document.getElementById('toggle-push');
  if (!email || !push) return;
  document.getElementById('menu-notif-desc').textContent = email.checked || push.checked ? 'Ativadas' : 'Desativadas';
}

async function saveNotif() {
  const dados = {
    email_ativo: document.getElementById('toggle-email').checked,
    push_ativo: document.getElementById('toggle-push').checked
  };
  (NOTIF_EVENTS[state.role] || []).forEach(ev => {
    const el = document.getElementById(`notif-${ev.key}`);
    dados[ev.key] = el ? el.checked : !!state.notif[ev.key];
  });

  const botao = document.querySelector('#screen-notif .btn-save');
  setButtonLoading(botao, 'Salvando...');
  try {
    const resposta = await apiFetch(`${API_URL}/auth/notificacoes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    const retorno = await resposta.json();
    if (!resposta.ok) throw new Error(retorno.erro || 'Não foi possível salvar as notificações.');
    state.notif = { ...state.notif, ...retorno.preferencias };
    updateNotifDesc();
    showToast(retorno.mensagem || 'Preferências salvas!', 'success');
    setTimeout(() => goTo('screen-main'), 900);
  } catch (erro) {
    showToast(erro.message, 'error');
  } finally {
    restoreButton(botao, 'Salvar preferências');
  }
}

function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.querySelector('svg').innerHTML = show
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke-linecap="round" stroke-linejoin="round"/><line x1="1" y1="1" x2="23" y2="23" stroke-linecap="round"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round"/>';
}

function checkPasswordMatch() {
  const nova = document.getElementById('senha-nova').value;
  const conf = document.getElementById('senha-confirm').value;
  const el = document.getElementById('match-indicator');
  if (!nova || !conf) { el.style.display = 'none'; return; }
  const ok = nova === conf;
  el.style.display = 'flex';
  el.className = `match-indicator ${ok ? 'ok' : 'err'}`;
  el.innerHTML = ok
    ? '✓ As senhas coincidem'
    : '✕ As senhas não coincidem';
}

async function saveSenha() {
  const atual = document.getElementById('senha-atual').value;
  const nova = document.getElementById('senha-nova').value;
  const conf = document.getElementById('senha-confirm').value;
  if (!atual) { showToast('Informe a senha atual', 'error'); return; }
  if (nova.length < 6) { showToast('A nova senha deve ter pelo menos 6 caracteres', 'error'); return; }
  if (nova !== conf) { showToast('As senhas não coincidem', 'error'); return; }

  const botao = document.querySelector('#screen-seguranca .btn-save');
  setButtonLoading(botao, 'Salvando...');
  try {
    const resposta = await apiFetch(`${API_URL}/auth/senha`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha_atual: atual, senha_nova: nova, senha_confirmacao: conf })
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível alterar a senha.');
    ['senha-atual', 'senha-nova', 'senha-confirm'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('match-indicator').style.display = 'none';
    showToast(dados.mensagem || 'Senha alterada com sucesso!', 'success');
    setTimeout(() => goTo('screen-main'), 1000);
  } catch (erro) {
    showToast(erro.message, 'error');
  } finally {
    restoreButton(botao, 'Alterar senha');
  }
}

function setButtonLoading(button, text) {
  if (!button) return;
  button.dataset.originalText = button.textContent.trim();
  button.disabled = true;
  button.style.opacity = '0.7';
  button.textContent = text;
}

function restoreButton(button, text) {
  if (!button) return;
  button.disabled = false;
  button.style.opacity = '';
  button.textContent = text;
}

function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const destino = document.getElementById(id);
  if (destino) destino.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (id === 'screen-notif') renderNotifEvents();
}

let toastTimer;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function sairDaConta() {
  showToast('Saindo da conta...', 'info');
  setTimeout(() => {
    if (window.parent && typeof window.parent.sair === 'function') window.parent.sair();
    else window.top.location.href = '../../index.html';
  }, 600);
}

renderNotifEvents();
