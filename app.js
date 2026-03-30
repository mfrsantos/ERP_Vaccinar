import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyD-mBgupzksWj93Jpu1itwBKky27Rzi-wU",
    authDomain: "erp-green-tech.firebaseapp.com",
    databaseURL: "https://erp-green-tech-default-rtdb.firebaseio.com",
    projectId: "erp-green-tech",
    storageBucket: "erp-green-tech.firebasestorage.app",
    messagingSenderId: "147246687989",
    appId: "1:147246687989:web:717ac874b7e485a76f47bc"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const contasRef = ref(db, 'contas');

// --- LÓGICA DE LOGIN ---
document.getElementById('btnLogin').addEventListener('click', () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    const erroMsg = document.getElementById('loginError');

    signInWithEmailAndPassword(auth, email, pass).catch(error => {
        erroMsg.innerText = "Credenciais inválidas.";
        erroMsg.style.display = 'block';
    });
});

document.getElementById('btnLogout').onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('appContent').style.display = 'block';
        iniciarSistema();
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('appContent').style.display = 'none';
    }
});

// --- FUNÇÕES DO SISTEMA ---
function iniciarSistema() {
    document.getElementById('btnLancar').onclick = () => {
        const nova = {
            tipo: document.getElementById('tipoInput').value,
            local: document.getElementById('localInput').value.toUpperCase() || "MATRIZ",
            pedido: document.getElementById('pedidoInput').value,
            fornecedor: document.getElementById('fornecedorInput').value.toUpperCase(),
            valor: parseFloat(document.getElementById('valorInput').value.replace(',', '.')) || 0,
            vencimento: document.getElementById('vencimentoInput').value,
            mes: document.getElementById('mesFiltro').value,
            status: "Pendente"
        };
        push(contasRef, nova);
        document.getElementById('pedidoInput').value = "";
        document.getElementById('fornecedorInput').value = "";
        document.getElementById('valorInput').value = "";
    };

    onValue(contasRef, (snapshot) => {
        renderizar(snapshot.val());
    });
    
    // Atualizar ao mudar filtros
    document.getElementById('mesFiltro').onchange = () => monitorarSnapshot();
    document.getElementById('filtroLocal').onchange = () => monitorarSnapshot();
}

function monitorarSnapshot() {
    onValue(contasRef, (snapshot) => renderizar(snapshot.val()), { onlyOnce: true });
}

function renderizar(data) {
    const tbody = document.getElementById('tabelaDados');
    const mesAtual = document.getElementById('mesFiltro').value;
    const localFiltro = document.getElementById('filtroLocal').value;
    tbody.innerHTML = "";
    
    let pend = 0, pago = 0;
    if (!data) return;

    Object.keys(data).forEach(key => {
        const c = data[key];
        if (c.mes !== mesAtual) return;
        if (localFiltro !== "TODOS" && c.local !== localFiltro) return;

        if (c.status === "Enviado ao CSC") pago += c.valor; else pend += c.valor;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${c.local}</td>
            <td><div class="editable-cell" contenteditable="true" onblur="window.atualizar('${key}', 'pedido', this.innerText)">${c.pedido}</div></td>
            <td>${c.fornecedor}</td>
            <td>R$ ${c.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
            <td>${c.vencimento}</td>
            <td style="font-weight:bold; color:${c.status === 'Pendente' ? '#ef4444' : '#10b981'}">${c.status}</td>
            <td>
                <button style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:4px;" onclick="window.excluir('${key}')">X</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('totalPendente').innerText = "R$ " + pend.toLocaleString('pt-BR', {minimumFractionDigits: 2});
    document.getElementById('totalPago').innerText = "R$ " + pago.toLocaleString('pt-BR', {minimumFractionDigits: 2});
    document.getElementById('totalGeral').innerText = "R$ " + (pend + pago).toLocaleString('pt-BR', {minimumFractionDigits: 2});
}

// Funções Globais
window.atualizar = (id, campo, valor) => update(ref(db, `contas/${id}`), { [campo]: valor });
window.excluir = (id) => { if(confirm("Excluir conta?")) remove(ref(db, `contas/${id}`)); };

document.getElementById('btnBackup').onclick = () => {
    onValue(contasRef, (snap) => {
        const blob = new Blob([JSON.stringify(snap.val(), null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `backup_green_tech.json`;
        a.click();
    }, { onlyOnce: true });
};
