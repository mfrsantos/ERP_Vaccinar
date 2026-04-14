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

const listaMeses = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

const fmtMoeda = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const parseMoeda = (s) => parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0;

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
        const mesAtu = document.getElementById('mesFiltro').value;
        const localF = document.getElementById('filtroLocal').value;
        const busca = document.getElementById('inputBusca').value.toLowerCase();

        tServ.innerHTML = ""; tProd.innerHTML = "";
        let pVal = 0, eVal = 0, pCount = 0, eCount = 0;
        if (!data) return;

        const itens = Object.keys(data).map(id => ({ id, ...data[id] }))
            .filter(i => {
                const termo = String((i.pedido || "") + (i.fornecedor || "") + (i.codFor || "")).toLowerCase();
                return i.mes === mesAtu && (localF === "TODOS" || i.local === localF) && termo.includes(busca);
            })
            .sort((a, b) => (a.status === "Enviado ao CSC" ? 1 : -1));

        itens.forEach(item => {
            const isEnv = item.status === "Enviado ao CSC";
            const tr = document.createElement('tr');
            if (isEnv) tr.className = "row-enviada";

            const tdPedido = `<td><input type="text" value="${item.pedido || ''}" class="input-pedido-tabela" ${isEnv ? 'readonly' : ''} onblur="window.upd('${item.id}', 'pedido', this.value)"></td>`;
            const tdValor = `<td class="col-valor">R$ <input type="text" value="${fmtMoeda(item.valor)}" class="input-valor-tabela" ${isEnv ? 'readonly' : ''} onblur="window.upd('${item.id}', 'valor', parseMoeda(this.value))"></td>`;

            const htmlBase = `
                <td>${item.local}</td>
                ${tdPedido}
                <td>${item.codFor || ''}</td>
                <td>${item.fornecedor}</td>
                <td>${item.cc || ''}</td>
                ${tdValor}
                <td><input type="text" value="${item.vencimento || ''}" class="input-venc" onblur="window.upd('${item.id}', 'vencimento', this.value)"></td>
                <td>${item.pagamento}</td>
                <td><span class="status-badge ${isEnv ? 'status-enviado' : 'status-pendente'}">${item.status}</span></td>`;

            !isEnv ? (pVal += item.valor, pCount++) : (eVal += item.valor, eCount++);

            if (item.tipo === "SERVICO") {
                tr.innerHTML = htmlBase + `<td><button onclick="window.modalServico('${item.id}')" class="btn-acao"><i class="fas fa-paper-plane"></i></button><button onclick="window.remover('${item.id}')" class="btn-acao-del"><i class="fas fa-trash"></i></button></td>`;
                tServ.appendChild(tr);
            } else {
                tr.innerHTML = htmlBase + `<td><button onclick="window.modalProduto('${item.id}')" class="btn-acao"><i class="fas fa-copy"></i></button><button onclick="window.remover('${item.id}')" class="btn-acao-del"><i class="fas fa-trash"></i></button></td>`;
                tProd.appendChild(tr);
            }
        });

        document.getElementById('totalPendente').innerText = "R$ " + fmtMoeda(pVal);
        document.getElementById('totalEnviado').innerText = "R$ " + fmtMoeda(eVal);
        document.getElementById('countPendente').innerText = pCount + " notas";
        document.getElementById('countEnviado').innerText = eCount + " notas";

        document.getElementById('btnReplicar').onclick = async () => {
            const idx = listaMeses.indexOf(mesAtu);
            if (idx === 11) return alert("Fim do ano atingido.");
            const proxMes = listaMeses[idx + 1];
            const servicos = itens.filter(i => i.tipo === "SERVICO");
            if (confirm(`Replicar fornecedores para ${proxMes}?`)) {
                for (const s of servicos) {
                    await push(contasRef, {
                        tipo: "SERVICO", local: s.local, fornecedor: s.fornecedor, codFor: s.codFor || "",
                        cc: s.cc || "", pedido: "", valor: 0, vencimento: "", pagamento: s.pagamento, status: "Pendente", mes: proxMes
                    });
                }
                alert("Copiado com sucesso!");
            }
        };

        document.getElementById('btnAprovacao').onclick = () => {
            const aprov = itens.filter(i => i.valor >= 10000 && i.status === "Pendente");
            if(aprov.length === 0) return alert("Nada pendente acima de 10k.");
            let lista = aprov.map(i => `${i.local} - Pedido: ${i.pedido} - Fornecedor: ${i.fornecedor} - Valor: ${fmtMoeda(i.valor)}`).join('\n');
            window.location.href = `mailto:juliana.lopes@vaccinar.com.br?cc=marcus.tonini@vaccinar.com.br&subject=Aprovações Pendentes&body=${encodeURIComponent(lista)}`;
        };
    });
}

document.getElementById('btnSalvarManual').onclick = async () => {
    const pagto = document.getElementById('mPagamento').value;
    await push(contasRef, {
        tipo: document.getElementById('mTipo').value, local: document.getElementById('mLocal').value,
        pedido: document.getElementById('mPedido').value.trim(), 
        codFor: document.getElementById('mCodFor').value.trim(),
        fornecedor: document.getElementById('mFornecedor').value.toUpperCase(), 
        cc: document.getElementById('mCC').value,
        valor: parseMoeda(document.getElementById('mValor').value),
        vencimento: document.getElementById('mVenc').value,
        pagamento: pagto, status: "Pendente", mes: document.getElementById('mesFiltro').value
    });
    alert("Salvo!");
    limparCampos();
};

function limparCampos() {
    ["mPedido", "mCodFor", "mFornecedor", "mCC", "mValor", "mVenc"].forEach(id => document.getElementById(id).value = "");
    document.getElementById('mPedido').focus();
}

window.upd = (id, campo, valor) => update(ref(db, `contas/${id}`), { [campo]: valor });
window.remover = (id) => { if(confirm("Remover este item?")) remove(ref(db, `contas/${id}`)); };

window.modalServico = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const vFmt = fmtMoeda(c.valor);
        const sub = `Enc. ${c.local} - Pedido: ${c.pedido} - ${c.fornecedor} - R$ ${vFmt}`;
        const corpo = `Bom dia!\n\n${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFor || ''} ${c.fornecedor} - Valor: R$ ${vFmt}\nPagamento: ${c.pagamento}`;
        abrirModal("Tratar Serviço", corpo, [
            { txt: "ENVIAR E-MAIL", cl: "btn-primary-modal", fn: () => {
                window.location.href = `mailto:servicos@vaccinar.com.br?cc=contasapagar@vaccinar.com.br&subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(corpo)}`;
                window.upd(id, 'status', 'Enviado ao CSC'); fecharModal();
            }},
            { txt: "APENAS MARCAR", cl: "btn-secondary-modal", fn: () => {
                window.upd(id, 'status', 'Enviado ao CSC'); fecharModal();
            }}
        ]);
    });
};

window.modalProduto = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const vFmt = fmtMoeda(c.valor);
        const texto = `${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFor || ''} ${c.fornecedor} - Valor: R$ ${vFmt}\nPagamento: ${c.pagamento}`;
        abrirModal("Tratar Produto", texto, [
            { txt: "COPIAR E MARCAR", cl: "btn-primary-modal", fn: () => {
                navigator.clipboard.writeText(texto);
                window.upd(id, 'status', 'Enviado ao CSC'); fecharModal();
            }},
            { txt: "APENAS MARCAR", cl: "btn-secondary-modal", fn: () => {
                window.upd(id, 'status', 'Enviado ao CSC'); fecharModal();
            }}
        ]);
    });
};

function abrirModal(t, p, btns) {
    document.getElementById('modalTitle').innerText = t; 
    document.getElementById('modalPreview').innerText = p;
    const c = document.getElementById('modalActions'); c.innerHTML = "";
    btns.forEach(b => {
        const el = document.createElement('button'); el.innerText = b.txt; el.className = `modal-btn ${b.cl}`; el.onclick = b.fn; c.appendChild(el);
    });
    const bc = document.createElement('button'); bc.innerText = "CANCELAR"; bc.className = "modal-btn btn-close-modal"; bc.onclick = fecharModal; c.appendChild(bc);
    document.getElementById('modalApp').style.display = 'flex';
}
function fecharModal() { document.getElementById('modalApp').style.display = 'none'; }

document.getElementById('mesFiltro').onchange = carregarDados;
document.getElementById('filtroLocal').onchange = carregarDados;
document.getElementById('inputBusca').oninput = carregarDados;
document.getElementById('btnLogin').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value);
document.getElementById('btnLogout').onclick = () => signOut(auth);
