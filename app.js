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
};

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
        const tServ = document.getElementById('tabelaServico');
        const tProd = document.getElementById('tabelaProduto');
        const mes = document.getElementById('mesFiltro').value;
        const localF = document.getElementById('filtroLocal').value;
        tServ.innerHTML = ""; tProd.innerHTML = "";
        let pVal = 0, eVal = 0, pCount = 0, eCount = 0;
        if (!data) return;

        Object.keys(data).forEach(id => {
            const item = data[id];
            if (item.mes !== mes || (localF !== "TODOS" && item.local !== localF)) return;
            const valF = item.valor.toLocaleString('pt-BR', {minimumFractionDigits:2});

            if (item.tipo === "SERVICO") {
                const isEnv = item.status === "Enviado ao CSC";
                isEnv ? (eVal += item.valor, eCount++) : (pVal += item.valor, pCount++);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.local}</td><td>${item.pedido}</td><td>${item.fornecedor}</td><td>${item.cc}</td>
                    <td style="text-align:right">R$ ${valF}</td>
                    <td><input type="text" value="${item.vencimento || ''}" class="input-venc" onblur="window.upd('${id}', 'vencimento', this.value)"></td>
                    <td>${item.pagamento}</td>
                    <td><span class="status-badge ${isEnv ? 'status-enviado' : 'status-pendente'}">${item.status}</span></td>
                    <td>
                        <button onclick="window.modalServico('${id}')" class="btn-acao"><i class="fas fa-paper-plane"></i></button>
                        <button onclick="window.remover('${id}')" class="btn-acao-del"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tServ.appendChild(tr);
            } else {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.local}</td><td>${item.pedido}</td><td>${item.fornecedor}</td>
                    <td>R$ ${valF}</td><td>${item.pagamento}</td>
                    <td>
                        <button onclick="window.modalProduto('${id}')" class="btn-acao">Tratar</button>
                        <button onclick="window.remover('${id}')" class="btn-acao-del"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tProd.appendChild(tr);
            }
        });
        document.getElementById('totalPendente').innerText = "R$ " + pVal.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('totalEnviado').innerText = "R$ " + eVal.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('countPendente').innerText = pCount + " notas";
        document.getElementById('countEnviado').innerText = eCount + " notas";
    });
}

// MODAL PARA SERVIÇO (OUTLOOK)
window.modalServico = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const valF = c.valor.toLocaleString('pt-BR', {minimumFractionDigits:2});
        const assunto = `Enc. ${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFor} - ${c.fornecedor} - Valor: R$ ${valF} - C/C: ${c.cc} - Venc.: ${c.vencimento}`;
        const corpo = `Bom dia!\n\nSegue Para Lançamento:\n\n${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFor} - ${c.fornecedor} - Valor: R$ ${valF} - C/C: ${c.cc} - Venc.: ${c.vencimento}\nPagamento via: ${c.pagamento}.`;
        
        abrirModal("Envio de Serviço", corpo, [
            { txt: "ENVIAR AO CSC (OUTLOOK)", class: "btn-primary-modal", fn: () => {
                window.location.href = `mailto:servicos@vaccinar.com.br?cc=nfe.ti@vaccinar.com.br;contasapagar@vaccinar.com.br&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
                fecharModal();
            }},
            { txt: "APENAS MARCAR COMO ENVIADO", class: "btn-secondary-modal", fn: () => {
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
                fecharModal();
            }}
        ]);
    });
};

// MODAL PARA PRODUTO (COPIAR)
window.modalProduto = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const texto = `Produto: ${c.fornecedor}\nPedido: ${c.pedido}\nValor: R$ ${c.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        
        abrirModal("Tratar Produto", texto, [
            { txt: "COPIAR E MARCAR COMO ENVIADO", class: "btn-primary-modal", fn: () => {
                navigator.clipboard.writeText(texto);
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
                fecharModal();
            }},
            { txt: "APENAS MARCAR COMO ENVIADO", class: "btn-secondary-modal", fn: () => {
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
                fecharModal();
            }}
        ]);
    });
};

function abrirModal(titulo, preview, botoes) {
    document.getElementById('modalTitle').innerText = titulo;
    document.getElementById('modalPreview').innerText = preview;
    const container = document.getElementById('modalActions');
    container.innerHTML = "";
    botoes.forEach(b => {
        const btn = document.createElement('button');
        btn.innerText = b.txt;
        btn.className = `modal-btn ${b.class}`;
        btn.onclick = b.fn;
        container.appendChild(btn);
    });
    const btnCancel = document.createElement('button');
    btnCancel.innerText = "CANCELAR";
    btnCancel.className = "modal-btn btn-close-modal";
    btnCancel.onclick = fecharModal;
    container.appendChild(btnCancel);
    document.getElementById('modalApp').style.display = 'flex';
}

function fecharModal() { document.getElementById('modalApp').style.display = 'none'; }
window.upd = (id, campo, valor) => update(ref(db, `contas/${id}`), { [campo]: valor });
window.remover = (id) => { if(confirm("Excluir?")) remove(ref(db, `contas/${id}`)); };
document.getElementById('mesFiltro').onchange = carregarDados;
document.getElementById('filtroLocal').onchange = carregarDados;
document.getElementById('btnLogin').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value);
document.getElementById('btnLogout').onclick = () => signOut(auth);
