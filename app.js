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

        const itens = Object.keys(data).map(id => ({ id, ...data[id] }))
            .filter(i => {
                const termo = String(i.pedido + i.fornecedor).toLowerCase();
                return i.mes === mes && (localF === "TODOS" || i.local === localF) && termo.includes(busca);
            })
            .sort((a, b) => (a.status === "Enviado ao CSC" ? 1 : -1));

        itens.forEach(item => {
            const isEnv = item.status === "Enviado ao CSC";
            // Força 2 casas decimais na exibição da tabela
            const valF = item.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            const tr = document.createElement('tr');
            if (isEnv) tr.className = "row-enviada";

            const tdValor = `
                <td style="text-align:right">
                    R$ <input type="text" value="${valF}" 
                        class="input-venc" style="width: 85px; text-align: right; border: 1px solid #334155;"
                        ${isEnv ? 'readonly' : ''}
                        onfocus="if(!${isEnv}){ this.type='number'; this.value='${item.valor}'; }" 
                        onblur="this.type='text'; window.upd('${item.id}', 'valor', parseFloat(this.value) || 0);">
                </td>`;

            const statusHTML = `<td><span class="status-badge ${isEnv ? 'status-enviado' : 'status-pendente'}">${item.status}</span></td>`;
            const acoesBase = `<button onclick="window.remover('${item.id}')" class="btn-acao-del"><i class="fas fa-trash"></i></button>`;

            if (item.tipo === "SERVICO") {
                !isEnv ? (pVal += item.valor, pCount++) : (eVal += item.valor, eCount++);
                tr.innerHTML = `<td>${item.local}</td><td>${item.pedido}</td><td>${item.fornecedor}</td><td>${item.cc}</td>
                ${tdValor}
                <td><input type="text" value="${item.vencimento || ''}" class="input-venc" onblur="window.upd('${item.id}', 'vencimento', this.value)"></td>
                <td>${item.pagamento}</td>${statusHTML}
                <td><button onclick="window.modalServico('${item.id}')" class="btn-acao"><i class="fas fa-paper-plane"></i></button>${acoesBase}</td>`;
                tServ.appendChild(tr);
            } else {
                tr.innerHTML = `<td>${item.local}</td><td>${item.pedido}</td><td>${item.fornecedor}</td>
                ${tdValor}
                <td><input type="text" value="${item.vencimento || ''}" class="input-venc" onblur="window.upd('${item.id}', 'vencimento', this.value)"></td>
                <td>${item.pagamento}</td>${statusHTML}
                <td><button onclick="window.modalProduto('${item.id}')" class="btn-acao">Tratar</button>${acoesBase}</td>`;
                tProd.appendChild(tr);
            }
        });

        document.getElementById('totalPendente').innerText = "R$ " + pVal.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        document.getElementById('totalEnviado').innerText = "R$ " + eVal.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        document.getElementById('countPendente').innerText = pCount + " notas";
        document.getElementById('countEnviado').innerText = eCount + " notas";

        // BOTÃO APROVAÇÃO (> 10.000)
        document.getElementById('btnAprovacao').onclick = () => {
            const aprovacao = itens.filter(i => i.valor >= 10000 && i.status === "Pendente");
            if(aprovacao.length === 0) { alert("Não há pedidos pendentes acima de R$ 10.000,00."); return; }

            let listaEmails = aprovacao.map(i => 
                `${i.local} - Pedido: ${i.pedido} - Fornecedor: ${i.codFor || ''} ${i.fornecedor} - Valor: R$ ${i.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} - C/C: ${i.cc || ''} - Venc.: ${i.vencimento || ''}`
            ).join('\n');

            const sub = "Pedidos aguardando aprovação";
            const body = `Juliana,tudo bem?\n\nSegue abaixo pedidos aguardando aprovação:\n\n${listaEmails}`;
            window.location.href = `mailto:juliana.lopes@vaccinar.com.br?cc=marcus.tonini@vaccinar.com.br&subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`;
        };
    });
}

// MENSAGEM CSC (EXATA)
window.modalServico = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const vF = c.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        const sub = `Enc ${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFor || ''} ${c.fornecedor} - Valor: R$${vF} - Venc.: ${c.vencimento || ''}`;
        const body = `Bom dia!\n\n${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFor || ''} ${c.fornecedor} - Valor: R$${vF} - Venc.: ${c.vencimento || ''}\nPagamento: ${c.pagamento}`;
        
        abrirModal("Tratar Serviço", `Pedido: ${c.pedido}`, [
            { txt: "ENVIAR AO CSC", cl: "btn-primary-modal", fn: () => {
                window.location.href = `mailto:servicos@vaccinar.com.br?cc=nfe.ti@vaccinar.com.br; contasapagar@vaccinar.com.br&subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`;
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" }); fecharModal();
            }}
        ]);
    });
};

window.modalProduto = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const vF = c.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        const texto = `Bom dia!\n\n${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFor || ''} ${c.fornecedor} - Valor: R$${vF} - Venc.: ${c.vencimento || ''}\nPagamento: ${c.pagamento}`;

        abrirModal("Tratar Produto", `Pedido: ${c.pedido}`, [
            { txt: "MARCAR COMO ENVIADO", cl: "btn-primary-modal", fn: () => {
                navigator.clipboard.writeText(texto);
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" }); fecharModal();
            }}
        ]);
    });
};

document.getElementById('btnSalvarManual').onclick = () => {
    push(contasRef, {
        tipo: document.getElementById('mTipo').value, local: document.getElementById('mLocal').value,
        pedido: document.getElementById('mPedido').value, codFor: document.getElementById('mCodFor').value,
        fornecedor: document.getElementById('mFornecedor').value.toUpperCase(), cc: document.getElementById('mCC').value,
        valor: parseFloat(document.getElementById('mValor').value) || 0, vencimento: document.getElementById('mVenc').value,
        pagamento: document.getElementById('mPagamento').value, status: "Pendente", mes: document.getElementById('mesFiltro').value
    });
};

function abrirModal(t, p, btns) {
    document.getElementById('modalTitle').innerText = t; document.getElementById('modalPreview').innerText = p;
    const c = document.getElementById('modalActions'); c.innerHTML = "";
    btns.forEach(b => {
        const el = document.createElement('button'); el.innerText = b.txt; el.className = `modal-btn ${b.cl}`; el.onclick = b.fn; c.appendChild(el);
    });
    const bc = document.createElement('button'); bc.innerText = "CANCELAR"; bc.className = "modal-btn btn-close-modal"; bc.onclick = fecharModal; c.appendChild(bc);
    document.getElementById('modalApp').style.display = 'flex';
}

function fecharModal() { document.getElementById('modalApp').style.display = 'none'; }
window.upd = (id, campo, valor) => update(ref(db, `contas/${id}`), { [campo]: (campo === 'valor' ? parseFloat(valor) : valor) });
window.remover = (id) => { if(confirm("Deseja excluir este lançamento?")) remove(ref(db, `contas/${id}`)); };

document.getElementById('mesFiltro').onchange = carregarDados;
document.getElementById('filtroLocal').onchange = carregarDados;
document.getElementById('inputBusca').oninput = carregarDados;
document.getElementById('btnLogin').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value);
document.getElementById('btnLogout').onclick = () => signOut(auth);
