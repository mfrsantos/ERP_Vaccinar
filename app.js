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

document.getElementById('btnSalvarManual').onclick = async () => {
    const pedido = document.getElementById('mPedido').value.trim();
    if (!pedido) return alert("Informe o número do pedido.");
    const snap = await get(contasRef);
    const existe = snap.exists() ? Object.values(snap.val()).some(i => String(i.pedido) === String(pedido)) : false;
    if (existe) return alert("Erro: Já existe um lançamento com este número de pedido.");

    push(contasRef, {
        tipo: document.getElementById('mTipo').value,
        local: document.getElementById('mLocal').value,
        pedido: pedido,
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
    reader.onload = async (ev) => {
        const lines = ev.target.result.split(/\r?\n/).filter(l => l.trim() !== "");
        const mes = document.getElementById('mesFiltro').value;
        const snap = await get(contasRef);
        const pedidosExistentes = snap.exists() ? Object.values(snap.val()).map(i => String(i.pedido)) : [];
        let imp = 0, ign = 0;

        for (const line of lines.slice(1)) {
            const c = line.split(';').map(v => v.replace(/"/g, '').trim());
            if (c.length >= 6) {
                const pedidoS = String(c[1]);
                if (!pedidosExistentes.includes(pedidoS)) {
                    await push(contasRef, {
                        local: c[0], pedido: pedidoS, codFor: c[2],
                        fornecedor: c[3].toUpperCase(), cc: c[4],
                        valor: parseFloat(c[5].replace(',', '.')) || 0,
                        vencimento: "", pagamento: "BOLETO", status: "Pendente", mes: mes, tipo: "SERVICO"
                    });
                    imp++; pedidosExistentes.push(pedidoS);
                } else ign++;
            }
        }
        alert(`Importação: ${imp} novos, ${ign} duplicados ignorados.`);
        e.target.value = "";
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
        const busca = document.getElementById('inputBusca').value.toLowerCase();

        tServ.innerHTML = ""; tProd.innerHTML = "";
        let pVal = 0, eVal = 0, pCount = 0, eCount = 0;
        if (!data) return;

        const itens = Object.keys(data).map(id => ({ id, ...data[id] }))
            .filter(i => {
                const matchBusca = String(i.pedido).toLowerCase().includes(busca) || 
                                 String(i.fornecedor).toLowerCase().includes(busca) ||
                                 String(i.codFor).toLowerCase().includes(busca);
                return i.mes === mes && (localF === "TODOS" || i.local === localF) && matchBusca;
            })
            .sort((a, b) => (a.status === "Enviado ao CSC" ? 1 : 0) - (b.status === "Enviado ao CSC" ? 1 : 0));

        itens.forEach(item => {
            const valF = item.valor.toLocaleString('pt-BR', {minimumFractionDigits:2});
            const isEnv = item.status === "Enviado ao CSC";
            const tr = document.createElement('tr');
            if (isEnv) tr.className = "row-enviada";

            const statusHTML = `<td><span class="status-badge ${isEnv ? 'status-enviado' : 'status-pendente'}">${item.status}</span></td>`;
            const acoesBase = `<button onclick="window.remover('${item.id}')" class="btn-acao-del"><i class="fas fa-trash"></i></button>`;

            if (item.tipo === "SERVICO") {
                !isEnv ? (pVal += item.valor, pCount++) : (eVal += item.valor, eCount++);
                tr.innerHTML = `<td>${item.local}</td><td>${item.pedido}</td><td>${item.fornecedor}</td><td>${item.cc}</td>
                <td style="text-align:right">R$ ${valF}</td>
                <td><input type="text" value="${item.vencimento || ''}" class="input-venc" onblur="window.upd('${item.id}', 'vencimento', this.value)"></td>
                <td>${item.pagamento}</td>${statusHTML}
                <td><button onclick="window.modalServico('${item.id}')" class="btn-acao"><i class="fas fa-paper-plane"></i></button>${acoesBase}</td>`;
                tServ.appendChild(tr);
            } else {
                tr.innerHTML = `<td>${item.local}</td><td>${item.pedido}</td><td>${item.fornecedor}</td>
                <td style="text-align:right">R$ ${valF}</td>
                <td><input type="text" value="${item.vencimento || ''}" class="input-venc" onblur="window.upd('${item.id}', 'vencimento', this.value)"></td>
                <td>${item.pagamento}</td>${statusHTML}
                <td><button onclick="window.modalProduto('${item.id}')" class="btn-acao">Tratar</button>${acoesBase}</td>`;
                tProd.appendChild(tr);
            }
        });
        document.getElementById('totalPendente').innerText = "R$ " + pVal.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('totalEnviado').innerText = "R$ " + eVal.toLocaleString('pt-BR', {minimumFractionDigits:2});
        document.getElementById('countPendente').innerText = pCount + " notas";
        document.getElementById('countEnviado').innerText = eCount + " notas";
    });
}

function gerarTextoPadrao(c) {
    const valF = c.valor.toLocaleString('pt-BR', {minimumFractionDigits:2});
    return `Bom dia!\n\nSegue Para Lançamento: \n\n${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFor} - ${c.fornecedor} - Valor: R$ ${valF} - C/C: ${c.cc} - Venc.: ${c.vencimento}\nPagamento via: ${c.pagamento}.`;
}

window.modalServico = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const valF = c.valor.toLocaleString('pt-BR', {minimumFractionDigits:2});
        const assunto = `Enc. ${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFor} - ${c.fornecedor} - Valor: R$ ${valF} - C/C: ${c.cc} - Venc.: ${c.vencimento}`;
        const corpo = gerarTextoPadrao(c);
        abrirModal("Serviço (Outlook)", corpo, [
            { txt: "ENVIAR AO CSC (OUTLOOK)", cl: "btn-primary-modal", fn: () => {
                window.location.href = `mailto:servicos@vaccinar.com.br?cc=nfe.ti@vaccinar.com.br;contasapagar@vaccinar.com.br&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" }); fecharModal();
            }},
            { txt: "APENAS MARCAR COMO ENVIADO", cl: "btn-secondary-modal", fn: () => {
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" }); fecharModal();
            }}
        ]);
    });
};

window.modalProduto = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const texto = gerarTextoPadrao(c);
        abrirModal("Tratar Produto", texto, [
            { txt: "COPIAR E MARCAR COMO ENVIADO", cl: "btn-primary-modal", fn: () => {
                navigator.clipboard.writeText(texto); update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" }); fecharModal();
            }},
            { txt: "APENAS MARCAR COMO ENVIADO", cl: "btn-secondary-modal", fn: () => {
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
    const bc = document.createElement('button'); bc.innerText = "CANCELAR"; bc.className = "modal-btn btn-close-modal"; bc.onclick = fecharModal; c.appendChild(bc);
    document.getElementById('modalApp').style.display = 'flex';
}

function fecharModal() { document.getElementById('modalApp').style.display = 'none'; }
window.upd = (id, campo, valor) => update(ref(db, `contas/${id}`), { [campo]: valor });
window.remover = (id) => { if(confirm("Deseja excluir este lançamento?")) remove(ref(db, `contas/${id}`)); };
document.getElementById('mesFiltro').onchange = carregarDados;
document.getElementById('filtroLocal').onchange = carregarDados;
document.getElementById('inputBusca').oninput = carregarDados;
document.getElementById('btnLogin').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value);
document.getElementById('btnLogout').onclick = () => signOut(auth);
