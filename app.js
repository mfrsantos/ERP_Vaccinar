import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyD-mBgupzksWj93Jpu1itwBKky27Rzi-wU",
    authDomain: "erp-green-tech.firebaseapp.com",
    databaseURL: "https://erp-green-tech-default-rtdb.firebaseio.com",
    projectId: "erp-green-tech",
    storageBucket: "erp-green-tech.firebasestorage.app",
    messagingSenderId: "147246687989",
    appId: "1:147246687989:web:717ac874b7e485a76f47bc"
};

// Inicialização
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const contasRef = ref(db, 'contas');

console.log("Sistemas Firebase Iniciados...");

// --- LÓGICA DE LOGIN ---
const btnLogin = document.getElementById('btnLogin');
if (btnLogin) {
    btnLogin.addEventListener('click', () => {
        const email = document.getElementById('loginEmail').value;
        const pass = document.getElementById('loginPass').value;
        const erroMsg = document.getElementById('loginError');

        console.log("Tentativa de login para:", email);

        signInWithEmailAndPassword(auth, email, pass)
            .then((userCredential) => {
                console.log("Sucesso: Usuário logado!");
                erroMsg.style.display = 'none';
            })
            .catch((error) => {
                console.error("Erro de Autenticação:", error.code, error.message);
                erroMsg.innerText = "Erro: " + traduzirErro(error.code);
                erroMsg.style.display = 'block';
            });
    });
}

function traduzirErro(code) {
    switch (code) {
        case 'auth/invalid-credential': return "E-mail ou senha incorretos.";
        case 'auth/invalid-email': return "E-mail inválido.";
        case 'auth/user-not-found': return "Usuário não cadastrado.";
        case 'auth/wrong-password': return "Senha incorreta.";
        case 'auth/network-request-failed': return "Sem conexão com a internet.";
        default: return "Erro desconhecido: " + code;
    }
}

// --- MONITOR DE ESTADO (LOGIN/LOGOUT) ---
onAuthStateChanged(auth, (user) => {
    const loginOverlay = document.getElementById('loginOverlay');
    const appContent = document.getElementById('appContent');

    if (user) {
        console.log("Acesso permitido para:", user.email);
        if(loginOverlay) loginOverlay.style.display = 'none';
        if(appContent) appContent.style.display = 'block';
        iniciarSistema();
    } else {
        console.log("Nenhum usuário logado.");
        if(loginOverlay) loginOverlay.style.display = 'flex';
        if(appContent) appContent.style.display = 'none';
    }
});

document.getElementById('btnLogout').onclick = () => signOut(auth);

// --- LÓGICA DAS CONTAS (SÓ RODA SE LOGADO) ---
function iniciarSistema() {
    // Cadastro
    document.getElementById('btnLancar').onclick = () => {
        const nova = {
            tipo: document.getElementById('tipoInput').value,
            local: document.getElementById('localInput').value.toUpperCase(),
            pedido: document.getElementById('pedidoInput').value,
            fornecedor: document.getElementById('fornecedorInput').value.toUpperCase(),
            valor: parseFloat(document.getElementById('valorInput').value.replace(',', '.')) || 0,
            vencimento: document.getElementById('vencimentoInput').value,
            mes: document.getElementById('mesFiltro').value,
            status: "Pendente"
        };
        push(contasRef, nova);
        alert("Lançado com sucesso!");
    };

    // Escuta em tempo real
    onValue(contasRef, (snapshot) => {
        const data = snapshot.val();
        renderizar(data);
    });
}

function renderizar(data) {
    const tbody = document.getElementById('tabelaDados');
    if(!tbody) return;
    tbody.innerHTML = "";
    
    if (!data) return;

    Object.keys(data).forEach(key => {
        const c = data[key];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${c.local}</td>
            <td>${c.pedido}</td>
            <td>${c.fornecedor}</td>
            <td>R$ ${c.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
            <td>${c.vencimento}</td>
            <td>${c.status}</td>
            <td><button onclick="window.excluirItem('${key}')">Excluir</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// Funções expostas para o HTML
window.excluirItem = (id) => {
    if(confirm("Deseja excluir?")) remove(ref(db, `contas/${id}`));
};
