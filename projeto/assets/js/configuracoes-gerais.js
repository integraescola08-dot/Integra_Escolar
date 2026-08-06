
  const state = { role: 'responsavel', avatarUrl: null };

  // ── Dados do usuário logado (recebidos via postMessage, ver header.js) ────
  // Esta página roda dentro de um <iframe> em home.html, então não tem
  // acesso direto ao localStorage nem às variáveis da página pai.
  window.addEventListener('message', function(e){
    if(e.data && e.data.tipo === 'integra:usuario'){
      preencherComUsuarioReal(e.data.usuario);
    }
  });

  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ tipo: 'integra:pedir-usuario' }, window.location.origin);
  }

  const ROLE_POR_NIVEL  = { 1: 'responsavel', 2: 'professor', 3: 'gestao' };
  const ROLE_LABELS     = { responsavel: 'Responsável', professor: 'Professor', gestao: 'Gestão Escolar' };

  function preencherComUsuarioReal(usuario) {
    if (!usuario) return;
    const nome = (usuario.pessoa && usuario.pessoa.nome) || 'Usuário';
    const email = usuario.email || '';
    const nomeInput = document.getElementById('input-nome');
    const emailInput = document.getElementById('input-email');
    if (nomeInput) nomeInput.value = nome;
    if (emailInput) emailInput.value = email;

    state.role = ROLE_POR_NIVEL[usuario.nivel_acesso] || 'responsavel';
    document.getElementById('header-role-label').textContent = ROLE_LABELS[state.role];

    syncHeader();
  }

  const NOTIF_EVENTS = {
    responsavel: [{label:'Atestado analisado',desc:'Quando a gestão aprova ou rejeita um atestado'},{label:'Liberação processada',desc:'Quando a gestão decide sobre uma liberação'}],
    professor:   [{label:'Nova ausência registrada',desc:'Quando um aluno da sua turma falta'},{label:'Falta justificada pela gestão',desc:'Quando um atestado é aprovado'}],
    gestao:      [{label:'Novo atestado recebido',desc:'Quando um responsável envia um atestado'},{label:'Nova solicitação de liberação',desc:'Quando um responsável solicita liberação'}],
  };

  // Navegação
  function goTo(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo({top:0,behavior:'smooth'});
    if (id === 'screen-notif')  renderNotifEvents();
  }

  // Toast
  let toastTimer;
  function showToast(msg, type='info') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function getInitials(nome) {
    return nome.trim().split(' ').map(n=>n[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
  }

  // Sincroniza o card do header
  function syncHeader() {
    const nome  = document.getElementById('input-nome').value  || 'Usuário';
    const email = document.getElementById('input-email').value || '';
    document.getElementById('header-name').textContent  = nome;
    document.getElementById('header-email').textContent = email;
    if (!state.avatarUrl) document.getElementById('header-avatar').textContent = getInitials(nome);
  }

  // Avatar
  function handleAvatarChange(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      state.avatarUrl = reader.result;
      document.getElementById('perfil-avatar-initials').style.display = 'none';
      const img = document.getElementById('perfil-avatar-img');
      img.src = reader.result; img.style.display = 'block';
      document.getElementById('btn-remove-photo').style.display = 'inline';
      document.getElementById('header-avatar').innerHTML =
        `<img src="${reader.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    };
    reader.readAsDataURL(file);
  }

  function removeAvatar() {
    state.avatarUrl = null;
    const nome = document.getElementById('input-nome').value || 'Usuário';
    document.getElementById('perfil-avatar-initials').style.display = '';
    document.getElementById('perfil-avatar-img').style.display = 'none';
    document.getElementById('btn-remove-photo').style.display = 'none';
    document.getElementById('header-avatar').textContent = getInitials(nome);
  }

  function savePerfil() {
    syncHeader();
    showToast('Perfil atualizado com sucesso!', 'success');
    setTimeout(() => goTo('screen-main'), 1200);
  }

  // Sair da conta — esta página vive num iframe (ver header.js), então a
  // função sair() de verdade (que limpa a sessão e navega para o login)
  // está na janela pai. Mantém o toast local e "escapa" do iframe para executá-la.
  function sairDaConta() {
    showToast('Saindo da conta...', 'info');
    setTimeout(() => {
      if (window.parent && typeof window.parent.sair === 'function') {
        window.parent.sair();
      } else {
        window.top.location.href = '../../index.html';
      }
    }, 600);
  }

  // Notificações
  function renderNotifEvents() {
    document.getElementById('notif-events').innerHTML =
      NOTIF_EVENTS[state.role].map(ev => `
        <div class="toggle-item" style="margin-bottom:12px">
          <div class="toggle-item-text">
            <div class="tl">${ev.label}</div>
            <div class="td">${ev.desc}</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" checked />
            <span class="toggle-track"></span>
            <span class="toggle-thumb"></span>
          </label>
        </div>`).join('');
  }

  function updateNotifDesc() {
    const on = document.getElementById('toggle-email').checked || document.getElementById('toggle-push').checked;
    document.getElementById('menu-notif-desc').textContent = on ? 'Ativadas' : 'Desativadas';
  }

  function saveNotif() {
    showToast('Preferências de notificação salvas!', 'success');
    setTimeout(() => goTo('screen-main'), 1200);
  }

  // Segurança
  function togglePass(inputId, btn) {
    const input = document.getElementById(inputId);
    const show  = input.type === 'password';
    input.type  = show ? 'text' : 'password';
    btn.querySelector('svg').innerHTML = show
      ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke-linecap="round" stroke-linejoin="round"/><line x1="1" y1="1" x2="23" y2="23" stroke-linecap="round"/>'
      : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  function checkPasswordMatch() {
    const nova = document.getElementById('senha-nova').value;
    const conf = document.getElementById('senha-confirm').value;
    const el   = document.getElementById('match-indicator');
    if (!nova || !conf) { el.style.display='none'; return; }
    const ok = nova === conf;
    el.style.display = 'flex';
    el.className = `match-indicator ${ok ? 'ok' : 'err'}`;
    el.innerHTML = ok
      ? `<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> As senhas coincidem`
      : `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg> As senhas não coincidem`;
  }

  function saveSenha() {
    const atual = document.getElementById('senha-atual').value;
    const nova  = document.getElementById('senha-nova').value;
    const conf  = document.getElementById('senha-confirm').value;
    if (!atual)          { showToast('Informe a senha atual','error'); return; }
    if (nova.length < 6) { showToast('A nova senha deve ter pelo menos 6 caracteres','error'); return; }
    if (nova !== conf)   { showToast('As senhas não coincidem','error'); return; }
    ['senha-atual','senha-nova','senha-confirm'].forEach(id => document.getElementById(id).value='');
    document.getElementById('match-indicator').style.display = 'none';
    showToast('Senha alterada com sucesso!','success');
    setTimeout(() => goTo('screen-main'), 1400);
  }

  // Init
  renderNotifEvents();