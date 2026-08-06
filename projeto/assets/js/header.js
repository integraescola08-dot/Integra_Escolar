/* ============================================================
   Integra Escolar — Header JS (compartilhado por todos os perfis)
   ============================================================ */

function abrirMenu() {
  document.getElementById('dropdownMenu').classList.toggle('open');
}

// Fechar ao clicar fora
document.addEventListener('click', function (e) {
  const menu = document.getElementById('dropdownMenu');
  const btn  = document.querySelector('.menu');
  if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
    menu.classList.remove('open');
  }
});

// Ponte de dados pai -> iframe.
// Os painéis (historico.html, configuracoes-gerais.html) rodam isolados em
// iframes (propositalmente, para não vazar CSS entre as telas). Como cada
// iframe é um documento à parte, ele NÃO enxerga o localStorage nem as
// variáveis desta página — por isso os dados do usuário logado precisam ser
// entregues explicitamente via postMessage.
function enviarDadosParaFrame(frame){
    return function(){
        const usuario = (typeof getUsuarioLogado === 'function') ? getUsuarioLogado() : null;
        if(!usuario || !frame.contentWindow) return;
        frame.contentWindow.postMessage({
            tipo: 'integra:usuario',
            usuario: usuario,
            apiUrl: (typeof API_URL !== 'undefined') ? API_URL : null
        }, window.location.origin);
    };
}

// Se algum iframe pedir os dados de novo (ex.: recarregou algo internamente),
// ele manda {tipo:'integra:pedir-usuario'} e a gente reenvia.
window.addEventListener('message', function(e){
    if(e.origin !== window.location.origin) return;
    if(e.data && e.data.tipo === 'integra:pedir-usuario'){
        const frames = document.querySelectorAll('.panel-iframe');
        frames.forEach(f => {
            if(f.contentWindow === e.source){
                enviarDadosParaFrame(f)();
            }
        });
    }
});


// Usada nas páginas que têm a esteira deslizante (ex.: home.html do responsável).
function irPainel(nomePainel, elemento){
    const trilho = document.getElementById('slideTrack');
    if(!trilho) return; // página não tem esteira, ignora

    const dropdown = document.getElementById('dropdownMenu');
    if(dropdown) dropdown.classList.remove('open');

    // Carrega o iframe só na primeira vez que o painel é aberto (lazy load)
    const mapaIframes = {
        historico: { id: 'frameHistorico', src: 'historico.html' },
        configuracoes: { id: 'frameConfiguracoes', src: 'configuracoes-gerais.html' },
        'meus-estudantes': { id: 'frameMeusEstudantes', src: 'meus-estudantes.html' },
        'contato-ajuda': { id: 'frameContatoAjuda', src: 'contato-ajuda.html' },
        sobre: { id: 'frameSobre', src: 'sobre.html' }
    };
    const info = mapaIframes[nomePainel];
    if(info){
        const frame = document.getElementById(info.id);
        if(frame && !frame.getAttribute('src')){
            // Só manda os dados DEPOIS que o documento do iframe terminar de carregar,
            // senão o listener de 'message' dele ainda não existe.
            frame.addEventListener('load', enviarDadosParaFrame(frame), { once:true });
            frame.setAttribute('src', info.src);
        } else if(frame) {
            // Painel já carregado antes: reenvia os dados (podem ter mudado).
            enviarDadosParaFrame(frame)();
        }
    }

    trilho.setAttribute('data-active', nomePainel);

    document
        .querySelectorAll('.quick-item')
        .forEach(item => item.classList.remove('active'));
    if(elemento){
        elemento.classList.add('active');
    } else {
        const link = document.querySelector(`.quick-item[data-panel="${nomePainel}"]`);
        if(link) link.classList.add('active');
    }
}

// Navegação com transição (troca de página inteira — usada para telas que
// ainda não fazem parte da esteira, ex.: enviar-atestado.html, liberar-estudante.html).
// direcao: 'avancar' (padrão, desliza para a esquerda) ou 'voltar' (desliza para a direita).
function ir(pagina, elemento, direcao){
    if(!pagina || pagina === "#"){
        alert("Funcionalidade em desenvolvimento.");
        return;
    }
    document
        .querySelectorAll(".quick-item")
        .forEach(item=>item.classList.remove("active"));
    if(elemento){
        elemento.classList.add("active");
    }
    const classeSaida = direcao === 'voltar' ? 'sai-direita' : 'sai-esquerda';
    document.body.classList.add(classeSaida);
    setTimeout(()=>{
        window.location.href = pagina;
    },320);
}

// Sair: todas as páginas internas ficam em pages/[perfil]/
// portanto ../../index.html sempre chega na raiz corretamente
function sair() {
  limparSessao();
  document.body.classList.add('fade-out');
  setTimeout(() => { window.location.href = '../../index.html'; }, 350);
}
