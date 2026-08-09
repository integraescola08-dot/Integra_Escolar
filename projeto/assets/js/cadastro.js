const somenteNumeros = (valor) => valor.replace(/\D/g, '');

const cpfInput = document.getElementById('cpf');
const telefoneInput = document.getElementById('telefone');
const matriculaInput = document.getElementById('matricula');
const mensagem = document.getElementById('mensagemCadastro');

cpfInput.addEventListener('input', () => {
  const numeros = somenteNumeros(cpfInput.value).slice(0, 11);
  cpfInput.value = numeros
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
});

telefoneInput.addEventListener('input', () => {
  const numeros = somenteNumeros(telefoneInput.value).slice(0, 11);
  telefoneInput.value = numeros.length <= 10
    ? numeros.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
    : numeros.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
});

matriculaInput.addEventListener('input', () => {
  matriculaInput.value = somenteNumeros(matriculaInput.value).slice(0, 7);
});

document.querySelectorAll('.toggle-password').forEach((botao) => {
  botao.addEventListener('click', () => {
    const input = botao.parentElement.querySelector('input');
    const img = botao.querySelector('img');
    const mostrar = input.type === 'password';
    input.type = mostrar ? 'text' : 'password';
    img.src = mostrar ? 'assets/img/OLHO-ABERTO.png' : 'assets/img/OLHO-FECHADO.png';
  });
});

function exibirMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.className = `mensagem-cadastro ${tipo}`;
}

document.getElementById('cadastroForm').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const dados = {
    nome: document.getElementById('nome').value.trim(),
    cpf: somenteNumeros(cpfInput.value),
    telefone: somenteNumeros(telefoneInput.value),
    matricula: matriculaInput.value.trim(),
    email: document.getElementById('email').value.trim(),
    senha: document.getElementById('senha').value,
    confirmar_senha: document.getElementById('confirmar').value
  };

  if (dados.senha !== dados.confirmar_senha) {
    exibirMensagem('As senhas não coincidem.', 'erro');
    return;
  }

  if (dados.cpf.length !== 11 || dados.telefone.length < 10) {
    exibirMensagem('Confira o CPF e o telefone informados.', 'erro');
    return;
  }

  if (dados.matricula.length !== 7) {
    exibirMensagem('A matrícula deve ter exatamente 7 dígitos.', 'erro');
    return;
  }

  const botao = document.querySelector('.login-button');
  const conteudoOriginal = botao.innerHTML;
  botao.disabled = true;
  botao.textContent = 'Cadastrando...';

  try {
    const resposta = await fetch(`${API_URL}/auth/cadastro-responsavel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    const resultado = await resposta.json();
    if (!resposta.ok) throw new Error(resultado.erro || 'Não foi possível concluir o cadastro.');

    exibirMensagem(resultado.mensagem, 'sucesso');
    document.getElementById('cadastroForm').reset();
    setTimeout(() => { window.location.href = 'index.html'; }, 1600);
  } catch (erro) {
    exibirMensagem(erro.message, 'erro');
  } finally {
    botao.disabled = false;
    botao.innerHTML = conteudoOriginal;
  }
});
