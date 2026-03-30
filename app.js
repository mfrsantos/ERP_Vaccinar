import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
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

// --- AUTENTICAÇÃO ---
document.getElementById('btnLogin').onclick = () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    signInWithEmailAndPassword(auth, email, pass).catch(() => {
        document.getElementById('loginError').style.display = 'block';
    });
};
document.getElementById('btnLogout').onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('appContent').style.display = 'block';
        monitorarDados();
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('appContent').style.display = 'none';
    }
});

// --- UTILITÁRIOS ---
const fmtBRL = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const parseBRL = (v) => {
    if (typeof v === 'number') return v;
    return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
};

// --- FUNÇÕES DE BANCO ---
function monitorarDados() {
    onValue(contasRef, (snapshot) => {
        const data = snapshot.val();
        renderizar(data);
    });
}

document.getElementById('btnLancar').onclick = () => {
    const nova = {
        tipo: document.getElementById('tipoInput').value,
        local: document.getElementById('localInput').value.toUpperCase(),
        pedido: document.getElementById('pedidoInput').value,
        fornecedor: document.getElementById('fornecedorInput').value.toUpperCase(),
        valor: parseBRL(document.getElementById('valorInput').value),
        vencimento: document.getElementById('vencimentoInput').value,
        mes: document.getElementById('mesFiltro').value,
        status: "Pendente"
    };
    push(contasRef, nova);
    document.querySelectorAll('#areaCadastro input').forEach(i => i.value = "");
};

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
        if(c.status === "Enviado ao CSC") tr.style.opacity = "0.5";
        
        tr.innerHTML = `
            <td style="color:var(--accent-soft); font-weight:bold;">${c.local}</td>
            <td><div class="editable-cell" onblur="window.atualizar('${key}', 'pedido', this.innerText)">${c.pedido}</div></td>
            <td>${c.fornecedor}</td>
            <td><div class="editable-cell" onblur="window.atualizar('${key}', 'valor', this.innerText)">${fmtBRL(c.valor)}</div></td>
            <td>${c.vencimento}</td>
            <td style="color:${c.status === 'Pendente' ? 'red' : 'green'}; font-weight:bold;">${c.status}</td>
            <td>
                <button class="${c.status === 'Pendente' ? 'btn-csc' : 'btn-undo'}" onclick="window.acaoCSC('${key}')">
                    ${c.status === 'Pendente' ? 'CSC' : '↩'}
                </button>
                <button class="btn-del" onclick="window.excluir('${key}')">X</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('totalPendente').innerText = "R$ " + fmtBRL(pend);
    document.getElementById('totalPago').innerText = "R$ " + fmtBRL(pago);
    document.getElementById('totalGeral').innerText = "R$ " + fmtBRL(pend + pago);
}

// --- AÇÕES GLOBAIS ---
window.atualizar = (id, campo, valor) => {
    const v = (campo === 'valor') ? parseBRL(valor) : valor;
    update(ref(db, `contas/${id}`), { [campo]: v });
};

window.excluir = (id) => { if(confirm("Excluir lançamento?")) remove(ref(db, `contas/${id}`)); };

window.acaoCSC = (id) => {
    onValue(ref(db, `contas/${id}`), (snap) => {
        const item = snap.val();
        if(!item) return;
        if(item.status === "Enviado ao CSC") {
            update(ref(db, `contas/${id}`), { status: "Pendente" });
        } else {
            abrirModal(id, item);
        }
    }, { onlyOnce: true });
};

function abrirModal(id, item) {
    const texto = `Bom dia,\n\nSegue para lançamento:\n${item.local} - Pedido: ${item.pedido}\nFornecedor: ${item.fornecedor}\nValor: R$ ${fmtBRL(item.valor)}\nVencimento: ${item.vencimento}`;
    document.getElementById('previewTexto').innerText = texto;
    document.getElementById('modalCSC').style.display = 'block';
    
    document.getElementById('btnConfirmarCSC').onclick = async () => {
        await navigator.clipboard.writeText(texto);
        if(item.tipo === "SERVICO") window.location.href = `mailto:servicos@vaccinar.com.br?subject=Fatura&body=${encodeURIComponent(texto)}`;
        update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
        document.getElementById('modalCSC').style.display = 'none';
    };

    document.getElementById('btnApenasStatus').onclick = () => {
        update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
        document.getElementById('modalCSC').style.display = 'none';
    };
}

document.getElementById('btnBackup').onclick = () => {
    onValue(contasRef, (snap) => {
        const blob = new Blob([JSON.stringify(snap.val(), null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `backup_erp.json`;
        a.click();
    }, { onlyOnce: true });
};