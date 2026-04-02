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

// SALVAR MANUAL
document.getElementById('btnSalvarManual').onclick = () => {
    push(contasRef, {
        tipo: document.getElementById('mTipo').value,
        local: document.getElementById('mLocal').value,
        pedido: document.getElementById('mPedido').value,
        codFor: document.getElementById('mCodFor').value,
        fornecedor: document.getElementById('mFornecedor').value.toUpperCase(),
        cc: document.getElementById('mCC').value,
        valor: parseFloat(document.getElementById('mValor').value) || 0,
        vencimento: document.getElementById('mVenc').value,
        pagamento: document.getElementById('mPagamento').value,
        status: "Pendente",
        mes: document.getElementById('mesFiltro').value
    });
    alert("Salvo com sucesso!");
};

// IMPORTAÇÃO CSV
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
                    local: c[0].trim(), pedido: c[1].trim(), codFor: c[2].trim(),
                    fornecedor: c[3].trim().toUpperCase(), cc: c[4].trim(),
                    valor: parseFloat(c[5]) || 0, vencimento: "", pagamento: "BOLETO",
                    status: "Pendente", mes: mes, tipo: "SERVICO"
                });
            }
        });
    };
    reader.readAsText(file, 'UTF-8');
};

function carregarDados() {
    onValue(contasRef, (snap) => {
        const data = snap.val();
        const tServico = document.getElementById('tabelaServico');
        const tProduto = document.getElementById('tabelaProduto');
        const mesFiltro = document.getElementById('mesFiltro').value;
        const localFiltro = document.getElementById('filtroLocal').value;
        
        tServico.innerHTML = ""; tProduto.innerHTML = "";
        let pndVal = 0, envVal = 0, pndCount = 0, envCount = 0;

        if (!data) return;

        Object.keys(data).forEach(id => {
            const item = data[id];
            if (item.mes !== mesFiltro || (localFiltro !== "TODOS" && item.local !== localFiltro)) return;

            const isEnv = item.status === "Enviado ao CSC";
            const valFormat = item.valor.toLocaleString('pt-BR', {minimumFractionDigits:2});

            if (item.tipo === "SERVICO") {
                isEnv ? (envVal += item.valor, envCount++) : (pndVal += item.valor, pndCount++);
                const tr = document.createElement('tr');
                if (isEnv) tr.className = "row-enviada";
                tr.innerHTML = `
                    <td>${item.local}</td><td>${item.pedido}</td><td>${item.fornecedor}</td><td>${item.cc}</td>
                    <td style="text-align:right">R$ ${valFormat}</td>
                    <td><input type="text" value="${item.vencimento || ''}" class="input-venc" onblur="window.upd('${id}', 'vencimento', this.value)"></td>
                    <td>${item.pagamento}</td>
                    <td><span class="status-badge ${isEnv ? 'status-enviado' : 'status-pendente'}">${item.status}</span></td>
                    <td>
                        <button onclick="window.tratar('${id}')" class="btn-acao"><i class="fas fa-paper-plane"></i></button>
                        <button onclick="window.remover('${id}')" class="btn-acao-del"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tServico.appendChild(tr);
            } else {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.local}</td><td>${item.pedido}</td><td>${item.fornecedor}</td>
                    <td>R$ ${valFormat}</td><td>${item.pagamento}</td>
                    <td><button onclick="window.remover('${id}')" class="btn-acao">Excluir</button></td>
                `;
                tProduto.appendChild(tr);
            }
        });

        document.getElementById('totalPendente').innerText = "R$ " + pndVal.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('totalEnviado').innerText = "R$ " + envVal.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('countPendente').innerText = pndCount + " notas";
        document.getElementById('countEnviado').innerText = envCount + " notas";
    });
}

window.upd = (id, campo, valor) => update(ref(db, `contas/${id}`), { [campo]: valor });
window.remover = (id) => { if(confirm("Excluir item?")) remove(ref(db, `contas/${id}`)); };

window.tratar = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const txt = `Bom dia!\nPara Lançamento: ${c.local}\nPedido: ${c.pedido}\nFornecedor: ${c.codFor} - ${c.fornecedor}\nValor: R$ ${c.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}\nC.C: ${c.cc}\nVenc: ${c.vencimento}\nPagamento: ${c.pagamento}`;
        document.getElementById('modalPreview').innerText = txt;
        document.getElementById('modalTratar').style.display = 'flex';
        document.getElementById('btnCopiarMarcar').onclick = () => {
            navigator.clipboard.writeText(txt);
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            document.getElementById('modalTratar').style.display = 'none';
        };
    });
};

document.getElementById('mesFiltro').onchange = carregarDados;
document.getElementById('filtroLocal').onchange = carregarDados;
document.getElementById('btnLogin').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value);
document.getElementById('btnLogout').onclick = () => signOut(auth);
