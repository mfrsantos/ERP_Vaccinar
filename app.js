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

// --- LOGIN ---
document.getElementById('btnLogin').onclick = () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    signInWithEmailAndPassword(auth, email, pass).catch(() => {
        const err = document.getElementById('loginError');
        err.innerText = "Falha no acesso.";
        err.style.display = 'block';
    });
};

document.getElementById('btnLogout').onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    document.getElementById('loginOverlay').style.display = user ? 'none' : 'flex';
    document.getElementById('appContent').style.display = user ? 'block' : 'none';
    if (user) iniciarSistema();
});

// --- SISTEMA ---
function iniciarSistema() {
    document.getElementById('btnLancar').onclick = () => {
        const nova = {
            tipo: document.getElementById('tipoInput').value,
            local: document.getElementById('localInput').value,
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

    onValue(contasRef, (snapshot) => renderizar(snapshot.val()));
    document.getElementById('mesFiltro').onchange = () => refresh();
    document.getElementById('filtroLocal').onchange = () => refresh();
}

function refresh() { onValue(contasRef, (s) => renderizar(s.val()), { onlyOnce: true }); }

function renderizar(data) {
    const tbody = document.getElementById('tabelaDados');
    const mesSel = document.getElementById('mesFiltro').value;
    const locSel = document.getElementById('filtroLocal').value;
    tbody.innerHTML = "";
    let pnd = 0, pg = 0;

    if (!data) return;

    Object.keys(data).forEach(key => {
        const c = data[key];
        if (c.mes !== mesSel) return;
        if (locSel !== "TODOS" && c.local !== locSel) return;

        c.status === "Enviado ao CSC" ? pg += c.valor : pnd += c.valor;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:#34d399; font-weight:bold;">${c.local}</td>
            <td><div class="editable-cell" contenteditable="true" onblur="window.upd('${key}','pedido',this.innerText)">${c.pedido}</div></td>
            <td>${c.fornecedor}</td>
            <td>R$ ${c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td>${c.vencimento}</td>
            <td style="color:${c.status === 'Pendente' ? '#ef4444' : '#10b981'}; font-weight:bold;">${c.status}</td>
            <td><button style="background:none; border:1px solid #374151; color:#fff; cursor:pointer;" onclick="window.del('${key}')">X</button></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('totalPendente').innerText = "R$ " + pnd.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalPago').innerText = "R$ " + pg.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalGeral').innerText = "R$ " + (pnd+pg).toLocaleString('pt-BR',{minimumFractionDigits:2});
}

window.upd = (id, f, v) => update(ref(db, `contas/${id}`), {[f]: v});
window.del = (id) => { if(confirm("Remover?")) remove(ref(db, `contas/${id}`)); };

document.getElementById('btnBackup').onclick = () => {
    onValue(contasRef, (s) => {
        const b = new Blob([JSON.stringify(s.val(), null, 2)], {type: "application/json"});
        const l = document.createElement("a");
        l.href = URL.createObjectURL(b);
        l.download = `backup_erp.json`;
        l.click();
    }, {onlyOnce: true});
};
