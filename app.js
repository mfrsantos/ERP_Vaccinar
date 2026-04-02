import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyD-mBgupzksWj93Jpu1itwBKky27Rzi-wU",
    authDomain: "erp-green-tech.firebaseapp.com",
    databaseURL: "https://erp-green-tech-default-rtdb.firebaseio.com",
    projectId: "erp-green-tech",
    appId: "1:147246687989:web:717ac874b7e485a76f47bc"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const contasRef = ref(db, 'contas');

onAuthStateChanged(auth, (user) => {
    document.getElementById('loginOverlay').style.display = user ? 'none' : 'flex';
    document.getElementById('appContent').style.display = user ? 'block' : 'none';
    if (user) carregarDados();
});

// Importação: Ignora colunas extras e foca no essencial
document.getElementById('csvInput').onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
        const lines = ev.target.result.split(/\r?\n/).filter(l => l.trim() !== "");
        const mes = document.getElementById('mesFiltro').value;
        lines.forEach((line, i) => {
            if (i === 0) return;
            const c = line.split(';');
            if (c.length >= 6) {
                push(contasRef, {
                    local: c[0].trim(),
                    pedido: c[1].trim(),
                    codFor: c[2].trim(),
                    fornecedor: c[3].trim().toUpperCase(),
                    cc: c[4].trim(),
                    valor: parseFloat(c[5]) || 0,
                    vencimento: "", // Começa vazio para você digitar
                    status: "Pendente",
                    mes: mes
                });
            }
        });
        alert("45 itens importados! Insira as datas de vencimento na tabela.");
    };
    reader.readAsText(file, 'UTF-8');
};

function carregarDados() {
    onValue(contasRef, (snap) => {
        const data = snap.val();
        const t = document.getElementById('tabelaServico');
        const mes = document.getElementById('mesFiltro').value;
        const localFiltro = document.getElementById('filtroLocal').value;
        t.innerHTML = "";
        let pnd = 0, env = 0;

        if (!data) return;

        Object.keys(data).forEach(id => {
            const item = data[id];
            if (item.mes !== mes || (localFiltro !== "TODOS" && item.local !== localFiltro)) return;

            const isEnv = item.status === "Enviado ao CSC";
            isEnv ? env += item.valor : pnd += item.valor;

            const tr = document.createElement('tr');
            if (isEnv) tr.className = "row-enviada";

            tr.innerHTML = `
                <td>${item.local}</td>
                <td>${item.pedido}</td>
                <td>${item.fornecedor}</td>
                <td>${item.cc}</td>
                <td style="text-align:right">R$ ${item.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td><input type="text" value="${item.vencimento || ''}" placeholder="DD/MM" class="input-venc" onblur="window.saveVenc('${id}', this.value)"></td>
                <td>
                    <button onclick="window.tratar('${id}')" class="btn-acao"><i class="fas fa-paper-plane"></i></button>
                    <button onclick="window.remover('${id}')" class="btn-acao-del"><i class="fas fa-trash"></i></button>
                </td>
            `;
            t.appendChild(tr);
        });

        document.getElementById('totalPendente').innerText = "R$ " + pnd.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('totalEnviado').innerText = "R$ " + env.toLocaleString('pt-BR', {minimumFractionDigits:2});
    });
}

window.saveVenc = (id, val) => {
    update(ref(db, `contas/${id}`), { vencimento: val });
};

window.tratar = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const txt = `Bom dia!\nPara Lançamento: ${c.local}\nPedido: ${c.pedido}\nFornecedor: ${c.codFor} - ${c.fornecedor}\nValor: R$ ${c.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}\nC.C: ${c.cc}\nVenc: ${c.vencimento || 'A definir'}`;
        
        document.getElementById('modalPreview').innerText = txt;
        document.getElementById('modalTratar').style.display = 'flex';
        
        document.getElementById('btnCopiarMarcar').onclick = () => {
            navigator.clipboard.writeText(txt);
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            document.getElementById('modalTratar').style.display = 'none';
        };
    });
};

window.remover = (id) => { if(confirm("Remover lançamento?")) remove(ref(db, `contas/${id}`)); };
document.getElementById('btnLogin').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value);
document.getElementById('btnLogout').onclick = () => signOut(auth);

// Listener para filtros
document.getElementById('mesFiltro').onchange = carregarDados;
document.getElementById('filtroLocal').onchange = carregarDados;
