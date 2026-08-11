/* Integra Escolar — Login conectado ao Flask
   Agora o perfil é reconhecido automaticamente pelo email/senha no banco. */

const togglePassword = document.getElementById('togglePassword');
const senhaInput = document.getElementById('senha');
const eyeIcon = document.getElementById('eyeIcon');

togglePassword.addEventListener('click', () => {
  const isPassword = senhaInput.getAttribute('type') === 'password';
  senhaInput.setAttribute('type', isPassword ? 'text' : 'password');
  eyeIcon.src = isPassword ? 'assets/img/OLHO-ABERTO.png' : 'assets/img/OLHO-FECHADO.png';
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value.trim();

  if (!email || !senha) {
    alert('Preencha email e senha.');
    return;
  }

  const btn = document.querySelector('.login-button');
  const textoOriginal = btn.innerHTML;
  btn.innerHTML = 'Entrando...';
  btn.disabled = true;

  try {
    const resposta = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });

    const resultado = await resposta.json();
    if (!resposta.ok) throw new Error(resultado.erro || 'Erro ao fazer login.');

    localStorage.setItem('usuarioIntegra', JSON.stringify(resultado.usuario));
    localStorage.setItem('integraToken', resultado.token);

    const destinos = {
      responsavel: 'pages/responsavel/home.html',
      professor: 'pages/professor/controle-faltas.html',
      porteiro: 'pages/porteiro/porteiro.html',
      gestao: 'pages/gestao/painel.html',
      administrador: 'pages/Administrador/admin-index.html'
    };

    const destino = destinos[resultado.usuario.perfil];
    if (!destino) throw new Error('Perfil de usuário não reconhecido.');

    window.location.href = destino;
  } catch (erro) {
    alert(erro.message);
    btn.innerHTML = textoOriginal;
    btn.disabled = false;
  }
});
