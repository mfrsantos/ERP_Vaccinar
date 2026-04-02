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

// CARREGAR E ORDENAR DADOS
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

        // FILTRAGEM E ORDENAÇÃO (PENDENTE PRIMEIRO, ENVIADO POR ÚLTIMO)
        const itens = Object.keys(data).map(id => ({ id, ...data[id] }))
            .filter(i => {
                const matchBusca = String(i.pedido).toLowerCase().includes(busca) || 
                                 String(i.fornecedor).toLowerCase().includes(busca);
                return i.mes === mes && (localF === "TODOS" || i.local === localF) && matchBusca;
            })
            .sort((a, b) => {
                // Se A for enviado e B não, A vai pra baixo (1)
                // Se B for enviado e A não, B vai pra baixo (-1)
                const statusA = a.status === "Enviado ao CSC" ? 1 : 0;
                const statusB = b.status === "Enviado ao CSC" ? 1 : 0;
                return statusA - statusB;
            });

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

// Funções de salvamento, aprovação e modais permanecem as mesmas...
document.getElementById('btnSalvarManual').onclick = async () => {
    const pedido = document.getElementById('mPedido').value.trim();
    if (!pedido) return alert("Informe o pedido.");
    const snap = await get(contasRef);
    if (snap.exists() && Object.values(snap.val()).some(i => String(i.pedido) === String(pedido))) return alert("Pedido duplicado!");

    push(contasRef, {
        tipo: document.getElementById('mTipo').value, local: document.getElementById('mLocal').value,
        pedido: pedido, codFor: document.getElementById('mCodFor').value,
        fornecedor: document.getElementById('mFornecedor').value.toUpperCase(), cc: document.getElementById('mCC').value,
        valor: parseFloat(document.getElementById('mValor').value) || 0, vencimento: document.getElementById('mVenc').value,
        pagamento: document.getElementById('mPagamento').value, status: "Pendente", mes: document.getElementById('mesFiltro').value
    });
};

document.getElementById('btnAprovacao').onclick = async () => {
    const snap = await get(contasRef);
    const mes = document.getElementById('mesFiltro').value;
    const criticos = Object.values(snap.val()).filter(i => i.mes === mes && i.valor >= 10000);
    if (criticos.length === 0) return alert("Nada acima de 10k.");
    let lista = "";
    criticos.forEach(p => lista += `${p.local} | Pedido: ${p.pedido} | Fornecedor: ${p.fornecedor} | R$ ${p.valor.toLocaleString('pt-BR')}\n`);
    window.location.href = `mailto:juliana.lopes@vaccinar.com.br?cc=marcus.tonini@vaccinar.com.br&subject=Aprovação TI&body=${encodeURIComponent(lista)}`;
};

window.upd = (id, campo, valor) => update(ref(db, `contas/${id}`), { [campo]: valor });
window.remover = (id) => confirm("Excluir?") && remove(ref(db, `contas/${id}`));
document.getElementById('mesFiltro').onchange = carregarDados;
document.getElementById('filtroLocal').onchange = carregarDados;
document.getElementById('inputBusca').oninput = carregarDados;
document.getElementById('btnLogin').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value);
document.getElementById('btnLogout').onclick = () => signOut(auth);
// (Adicionar aqui as funções modalServico e modalProduto do código anterior)
