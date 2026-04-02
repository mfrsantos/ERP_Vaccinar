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

// FUNÇÃO DE RENDERIZAÇÃO COM ORDENAÇÃO E EDIÇÃO
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

        // ORGANIZAÇÃO: PENDENTES NO TOPO (PESO 0), ENVIADOS NO FIM (PESO 1)
        const itens = Object.keys(data).map(id => ({ id, ...data[id] }))
            .filter(i => {
                const txt = (i.pedido + i.fornecedor).toLowerCase();
                return i.mes === mes && (localF === "TODOS" || i.local === localF) && txt.includes(busca);
            })
            .sort((a, b) => (a.status === "Enviado ao CSC" ? 1 : -1));

        itens.forEach(item => {
            const isEnv = item.status === "Enviado ao CSC";
            const tr = document.createElement('tr');
            if (isEnv) tr.className = "row-enviada";

            // Campos editáveis com lógica de formatação
            const valF = item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            const tdValor = `<td>
                <input type="text" value="${valF}" class="input-valor-edit ${isEnv ? 'input-disabled' : ''}" 
                ${isEnv ? 'readonly' : ''} 
                onfocus="if(!${isEnv}){ this.type='number'; this.value='${item.valor}'; }" 
                onblur="this.type='text'; window.upd('${item.id}', 'valor', parseFloat(this.value) || 0);">
            </td>`;

            const tdVenc = `<td>
                <input type="text" value="${item.vencimento || ''}" class="input-venc ${isEnv ? 'input-disabled' : ''}" 
                ${isEnv ? 'readonly' : ''} 
                onblur="window.upd('${item.id}', 'vencimento', this.value)">
            </td>`;

            const statusHTML = `<td><span class="status-badge ${isEnv ? 'status-enviado' : 'status-pendente'}">${item.status}</span></td>`;

            if (item.tipo === "SERVICO") {
                !isEnv ? (pVal += item.valor, pCount++) : (eVal += item.valor, eCount++);
                tr.innerHTML = `<td>${item.local}</td><td>${item.pedido}</td><td>${item.fornecedor}</td><td>${item.cc}</td>
                ${tdValor}${tdVenc}<td>${item.pagamento}</td>${statusHTML}
                <td>
                    <button onclick="window.tratarServico('${item.id}')" class="btn-acao"><i class="fas fa-paper-plane"></i></button>
                    <button onclick="window.remover('${item.id}')" class="btn-acao-del"><i class="fas fa-trash"></i></button>
                </td>`;
                tServ.appendChild(tr);
            } else {
                tr.innerHTML = `<td>${item.local}</td><td>${item.pedido}</td><td>${item.fornecedor}</td>
                ${tdValor}${tdVenc}<td>${item.pagamento}</td>${statusHTML}
                <td>
                    <button onclick="window.tratarProduto('${item.id}')" class="btn-acao">Tratar</button>
                    <button onclick="window.remover('${item.id}')" class="btn-acao-del"><i class="fas fa-trash"></i></button>
                </td>`;
                tProd.appendChild(tr);
            }
        });

        // Atualiza Cards de Resumo
        document.getElementById('totalPendente').innerText = "R$ " + pVal.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('totalEnviado').innerText = "R$ " + eVal.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('countPendente').innerText = pCount + " notas";
        document.getElementById('countEnviado').innerText = eCount + " notas";
    });
}

// LANÇAMENTO COM VALIDAÇÃO DE DUPLICIDADE
document.getElementById('btnSalvarManual').onclick = async () => {
    const pedido = document.getElementById('mPedido').value.trim();
    if (!pedido) return alert("Informe o Nº do Pedido.");

    const snap = await get(contasRef);
    if (snap.exists()) {
        const duplicado = Object.values(snap.val()).some(i => String(i.pedido) === pedido);
        if (duplicado) return alert("ERRO: Este Nº de Pedido já foi lançado!");
    }

    push(contasRef, {
        tipo: document.getElementById('mTipo').value, local: document.getElementById('mLocal').value,
        pedido: pedido, codFor: document.getElementById('mCodFor').value,
        fornecedor: document.getElementById('mFornecedor').value.toUpperCase(), cc: document.getElementById('mCC').value,
        valor: parseFloat(document.getElementById('mValor').value) || 0, vencimento: document.getElementById('mVenc').value,
        pagamento: document.getElementById('mPagamento').value, status: "Pendente", mes: document.getElementById('mesFiltro').value
    });
    alert("Lançado com sucesso!");
};

// INTEGRAÇÃO COM OUTLOOK (SERVIÇOS)
window.tratarServico = async (id) => {
    const s = await get(ref(db, `contas/${id}`));
    const c = s.val();
    const mailTo = "juliana.lopes@vaccinar.com.br";
    const cc = "contasapagar@vaccinar.com.br; servicos@vaccinar.com.br";
    const sub = `Lançamento de Nota de Serviço - Pedido ${c.pedido}`;
    const body = `Olá,\n\nSegue para lançamento nota de serviço:\nFilial: ${c.local}\nPedido: ${c.pedido}\nFornecedor: ${c.fornecedor}\nValor: R$ ${c.valor.toLocaleString('pt-BR')}\n\nAtt,`;
    
    window.location.href = `mailto:${mailTo}?cc=${cc}&subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`;
    if(confirm("Marcar como enviado ao CSC?")) update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
};

// ÁREA DE TRANSFERÊNCIA (PRODUTOS)
window.tratarProduto = async (id) => {
    const s = await get(ref(db, `contas/${id}`));
    const c = s.val();
    const texto = `FILIAL: ${c.local} | PEDIDO: ${c.pedido} | FORN: ${c.fornecedor} | VALOR: R$ ${c.valor.toLocaleString('pt-BR')}`;
    
    navigator.clipboard.writeText(texto).then(() => {
        alert("Dados copiados! Cole no sistema do CSC.");
        update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
    });
};

// UTILITÁRIOS
window.upd = (id, campo, valor) => update(ref(db, `contas/${id}`), { [campo]: valor });
window.remover = (id) => confirm("Deseja realmente excluir este lançamento?") && remove(ref(db, `contas/${id}`));
document.getElementById('mesFiltro').onchange = carregarDados;
document.getElementById('filtroLocal').onchange = carregarDados;
document.getElementById('inputBusca').oninput = carregarDados;
document.getElementById('btnLogin').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value);
document.getElementById('btnLogout').onclick = () => signOut(auth);
