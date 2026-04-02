import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
    if (user) carregarDados();
});

document.getElementById('csvInput').onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
        const lines = event.target.result.split(/\r?\n/).filter(l => l.trim() !== "");
        const mesAtual = document.getElementById('mesFiltro').value;
        
        lines.forEach((line, index) => {
            if (index === 0) return;
            const c = line.split(';');
            if (c.length >= 6) {
                push(contasRef, {
                    local: c[0].trim(),
                    pedido: c[1].trim(),
                    codFornecedor: c[2].trim(),
                    fornecedor: c[3].trim().toUpperCase(),
                    centroCusto: c[4].trim(),
                    valor: parseFloat(c[5]) || 0,
                    vencimento: c[6] || "28/04/2026",
                    status: "Pendente",
                    mes: mesAtual,
                    timestamp: Date.now() + index
                });
            }
        });
        alert("Importação de 45 itens concluída!");
    };
    reader.readAsText(file, 'UTF-8');
};

function carregarDados() {
    onValue(contasRef, (snap) => {
        const data = snap.val();
        const t = document.getElementById('tabelaServico');
        const mes = document.getElementById('mesFiltro').value;
        const local = document.getElementById('filtroLocal').value;
        
        t.innerHTML = "";
        let pnd = 0, env = 0;

        if (!data) return;

        Object.keys(data).forEach(id => {
            const item = data[id];
            if (item.mes !== mes || (local !== "TODOS" && item.local !== local)) return;

            const isEnv = item.status === "Enviado ao CSC";
            isEnv ? env += item.valor : pnd += item.valor;

            const tr = document.createElement('tr');
            if (isEnv) tr.classList.add('row-enviada');

            tr.innerHTML = `
                <td><strong>${item.local}</strong></td>
                <td>${item.pedido}</td>
                <td>${item.fornecedor}</td>
                <td>${item.centroCusto}</td>
                <td style="text-align:right">R$ ${item.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td>${item.vencimento}</td>
                <td style="color:${isEnv ? 'var(--green)' : 'var(--red)'}; font-weight:bold">${item.status}</td>
                <td>
                    <button onclick="window.tratar('${id}')" class="btn-acao"><i class="fas fa-paper-plane"></i></button>
                    <button onclick="window.remover('${id}')" class="btn-acao-del"><i class="fas fa-trash"></i></button>
                </td>
            `;
            t.appendChild(tr);
        });

        document.getElementById('totalPendente').innerText = "R$ " + pnd.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('totalPago').innerText = "R$ " + env.toLocaleString('pt-BR', {minimumFractionDigits:2});
    });
}

window.tratar = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const msg = `Bom dia!\nPara Lançamento: ${c.local}\nPedido: ${c.pedido}\nFornecedor: ${c.codFornecedor} - ${c.fornecedor}\nValor: R$ ${c.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}\nC.C: ${c.centroCusto}`;
        navigator.clipboard.writeText(msg);
        update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
    });
};

window.remover = (id) => { if(confirm("Excluir lançamento?")) remove(ref(db, `contas/${id}`)); };
