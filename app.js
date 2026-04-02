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

// FUNÇÃO PRINCIPAL COM ORDENAÇÃO
function carregarDados() {
    onValue(contasRef, (snap) => {
        const data = snap.val();
        const tServ = document.getElementById('tabelaServico');
        const tProd = document.getElementById('tabelaProduto');
        const mes = document.getElementById('mesFiltro').value;
        const localF = document.getElementById('filtroLocal').value;
        const busca = document.getElementById('inputBusca').value.toLowerCase();

        tServ.innerHTML = ""; tProd.innerHTML = "";
        let pVal = 0, eVal = 0, pCount = 0, eCount = 0;
        if (!data) return;

        // 1. TRANSFORMA EM ARRAY E FILTRA
        const itens = Object.keys(data).map(id => ({ id, ...data[id] }))
            .filter(i => {
                const matchBusca = String(i.pedido).toLowerCase().includes(busca) || 
                                 String(i.fornecedor).toLowerCase().includes(busca);
                return i.mes === mes && (localF === "TODOS" || i.local === localF) && matchBusca;
            });

        // 2. ORDENAÇÃO CRÍTICA: PENDENTE PRIMEIRO (0), ENVIADO ÚLTIMO (1)
        itens.sort((a, b) => {
            const pesoA = a.status === "Enviado ao CSC" ? 1 : 0;
            const pesoB = b.status === "Enviado ao CSC" ? 1 : 0;
            return pesoA - pesoB; 
        });

        // 3. RENDERIZAÇÃO
        itens.forEach(item => {
            const isEnv = item.status === "Enviado ao CSC";
            const tr = document.createElement('tr');
            if (isEnv) tr.className = "row-enviada";

            const valorExibicao = item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            const tdValor = `
                <td style="text-align:right">
                    R$ <input type="text" value="${valorExibicao}" class="input-valor-edit ${isEnv ? 'input-disabled' : ''}" 
                    ${isEnv ? 'readonly' : ''} 
                    onfocus="if(!${isEnv}){ this.type='number'; this.value='${item.valor}'; }" 
                    onblur="this.type='text'; window.upd('${item.id}', 'valor', parseFloat(this.value) || 0);">
                </td>`;

            const statusHTML = `<td><span class="status-badge ${isEnv ? 'status-enviado' : 'status-pendente'}">${item.status}</span></td>`;
            const acoesBase = `<button onclick="window.remover('${item.id}')" class="btn-acao-del"><i class="fas fa-trash"></i></button>`;

            if (item.tipo === "SERVICO") {
                !isEnv ? (pVal += item.valor, pCount++) : (eVal += item.valor, eCount++);
                tr.innerHTML = `<td>${item.local}</td><td>${item.pedido}</td><td>${item.fornecedor}</td><td>${item.cc}</td>
                ${tdValor}<td><input type="text" value="${item.vencimento || ''}" class="input-venc" onblur="window.upd('${item.id}', 'vencimento', this.value)"></td>
                <td>${item.pagamento}</td>${statusHTML}<td><button onclick="window.modalServico('${item.id}')" class="btn-acao"><i class="fas fa-paper-plane"></i></button>${acoesBase}</td>`;
                tServ.appendChild(tr);
            } else {
                tr.innerHTML = `<td>${item.local}</td><td>${item.pedido}</td><td>${item.fornecedor}</td>
                ${tdValor}<td><input type="text" value="${item.vencimento || ''}" class="input-venc" onblur="window.upd('${item.id}', 'vencimento', this.value)"></td>
                <td>${item.pagamento}</td>${statusHTML}<td><button onclick="window.modalProduto('${item.id}')" class="btn-acao">Tratar</button>${acoesBase}</td>`;
                tProd.appendChild(tr);
            }
        });
        
        document.getElementById('totalPendente').innerText = "R$ " + pVal.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('totalEnviado').innerText = "R$ " + eVal.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('countPendente').innerText = pCount + " notas";
        document.getElementById('countEnviado').innerText = eCount + " notas";
    });
}

// RESTANTE DAS FUNÇÕES (LANÇAMENTO, MODAIS, ETC)
document.getElementById('btnSalvarManual').onclick = async () => {
    const pedido = document.getElementById('mPedido').value.trim();
    if (!pedido) return alert("Informe o pedido.");
    push(contasRef, {
        tipo: document.getElementById('mTipo').value, local: document.getElementById('mLocal').value,
        pedido: pedido, codFor: document.getElementById('mCodFor').value,
        fornecedor: document.getElementById('mFornecedor').value.toUpperCase(), cc: document.getElementById('mCC').value,
        valor: parseFloat(document.getElementById('mValor').value) || 0, vencimento: document.getElementById('mVenc').value,
        pagamento: document.getElementById('mPagamento').value, status: "Pendente", mes: document.getElementById('mesFiltro').value
    });
};

window.upd = (id, campo, valor) => update(ref(db, `contas/${id}`), { [campo]: valor });
window.remover = (id) => confirm("Excluir?") && remove(ref(db, `contas/${id}`));

window.modalServico = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const texto = `Pedido: ${c.pedido} - Fornecedor: ${c.fornecedor} - Valor: R$ ${c.valor.toLocaleString('pt-BR')}`;
        abrirModal("Tratar Serviço", texto, [
            { txt: "ENVIAR AO CSC", cl: "btn-primary-modal", fn: () => {
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" }); fecharModal();
            }}
        ]);
    });
};

window.modalProduto = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        abrirModal("Tratar Produto", `Pedido: ${c.pedido}`, [
            { txt: "MARCAR COMO ENVIADO", cl: "btn-primary-modal", fn: () => {
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" }); fecharModal();
            }}
        ]);
    });
};

function abrirModal(t, p, btns) {
    document.getElementById('modalTitle').innerText = t; document.getElementById('modalPreview').innerText = p;
    const c = document.getElementById('modalActions'); c.innerHTML = "";
    btns.forEach(b => {
        const el = document.createElement('button'); el.innerText = b.txt; el.className = `modal-btn ${b.cl}`; el.onclick = b.fn; c.appendChild(el);
    });
    document.getElementById('modalApp').style.display = 'flex';
}

function fecharModal() { document.getElementById('modalApp').style.display = 'none'; }
document.getElementById('mesFiltro').onchange = carregarDados;
document.getElementById('filtroLocal').onchange = carregarDados;
document.getElementById('inputBusca').oninput = carregarDados;
document.getElementById('btnLogin').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value);
document.getElementById('btnLogout').onclick = () => signOut(auth);
