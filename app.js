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

const parseMoeda = (s) => {
    if (typeof s === 'number') return s;
    let limpo = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    return parseFloat(limpo) || 0;
};

onAuthStateChanged(auth, (user) => {
    document.getElementById('loginOverlay').style.display = user ? 'none' : 'flex';
    document.getElementById('appContent').style.display = user ? 'block' : 'none';
    if (user) carregarDados();
});

window.upd = async (id, campo, valor) => {
    const dataRef = ref(db, `contas/${id}`);
    let valorFinal = (campo === 'valor') ? parseMoeda(valor) : valor;
    try {
        await update(dataRef, { [campo]: valorFinal });
    } catch (e) { console.error("Erro ao atualizar:", e); }
};

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
            .sort((a, b) => {
                // ORDENAÇÃO: Pendente primeiro
                if (a.status === "Pendente" && b.status !== "Pendente") return -1;
                if (a.status !== "Pendente" && b.status === "Pendente") return 1;
                return 0;
            });

        itens.forEach(item => {
            const isEnv = item.status === "Enviado ao CSC";
            const tr = document.createElement('tr');
            if (isEnv) tr.className = "row-enviada";

            const tdPedido = `<td><input type="text" value="${item.pedido || ''}" class="input-tabela" onblur="window.upd('${item.id}', 'pedido', this.value)"></td>`;
            const tdValor = `<td class="col-valor">R$ <input type="text" value="${fmtMoeda(item.valor)}" class="input-tabela col-valor" onblur="window.upd('${item.id}', 'valor', this.value)"></td>`;

            const htmlBase = `
                <td>${item.local}</td>
                ${tdPedido}
                <td>${item.codFor || ''}</td>
                <td>${item.fornecedor}</td>
                <td>${item.cc || ''}</td>
                ${tdValor}
                <td><input type="text" value="${item.vencimento || ''}" class="input-tabela" onblur="window.upd('${item.id}', 'vencimento', this.value)"></td>
                <td>${item.pagamento}</td>
                <td><span class="status-badge ${isEnv ? 'status-enviado' : 'status-pendente'}">${item.status}</span></td>`;

            !isEnv ? (pVal += item.valor, pCount++) : (eVal += item.valor, eCount++);

            const acoes = `<td>
                <button onclick="${item.tipo === 'SERVICO' ? 'window.modalServico' : 'window.modalProduto'}('${item.id}')" class="btn-acao">
                    <i class="fas ${item.tipo === 'SERVICO' ? 'fa-paper-plane' : 'fa-copy'}"></i>
                </button>
                <button onclick="window.remover('${item.id}')" class="btn-acao-del"><i class="fas fa-trash"></i></button>
            </td>`;

            tr.innerHTML = htmlBase + acoes;
            item.tipo === "SERVICO" ? tServ.appendChild(tr) : tProd.appendChild(tr);
        });

        document.getElementById('totalPendente').innerText = "R$ " + fmtMoeda(pVal);
        document.getElementById('totalEnviado').innerText = "R$ " + fmtMoeda(eVal);
        document.getElementById('countPendente').innerText = pCount + " notas";
        document.getElementById('countEnviado').innerText = eCount + " notas";

        // Funções de Cabeçalho
        document.getElementById('btnReplicar').onclick = async () => {
            const idx = listaMeses.indexOf(mesAtu);
            if (idx === 11) return;
            const proxMes = listaMeses[idx + 1];
            const servicos = itens.filter(i => i.tipo === "SERVICO");
            if (confirm(`Replicar ${servicos.length} itens para ${proxMes}?`)) {
                for (const s of servicos) {
                    await push(contasRef, {
                        tipo: "SERVICO", local: s.local, fornecedor: s.fornecedor, codFor: s.codFor || "",
                        cc: s.cc || "", pedido: "", valor: 0, vencimento: "", pagamento: s.pagamento, status: "Pendente", mes: proxMes
                    });
                }
                alert("Itens replicados!");
            }
        };

        document.getElementById('btnAprovacao').onclick = () => {
            const alto = itens.filter(i => i.valor >= 10000 && i.status === "Pendente");
            if (alto.length === 0) return alert("Nenhuma nota > 10k pendente.");
            let corpo = "Notas para aprovação:\n\n";
            alto.forEach(i => corpo += `- ${i.fornecedor}: R$ ${fmtMoeda(i.valor)}\n`);
            window.location.href = `mailto:gerencia@vaccinar.com.br?subject=Aprovação TI&body=${encodeURIComponent(corpo)}`;
        };
    });
}

document.getElementById('btnSalvarManual').onclick = async () => {
    await push(contasRef, {
        tipo: document.getElementById('mTipo').value, local: document.getElementById('mLocal').value,
        pedido: document.getElementById('mPedido').value, codFor: document.getElementById('mCodFor').value,
        fornecedor: document.getElementById('mFornecedor').value.toUpperCase(), cc: document.getElementById('mCC').value,
        valor: parseMoeda(document.getElementById('mValor').value),
        vencimento: document.getElementById('mVenc').value, pagamento: document.getElementById('mPagamento').value,
        status: "Pendente", mes: document.getElementById('mesFiltro').value
    });
    ["mPedido", "mCodFor", "mFornecedor", "mCC", "mValor", "mVenc"].forEach(id => document.getElementById(id).value = "");
};

window.modalServico = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const corpo = `Bom dia!\n\n${c.local}\nPedido: ${c.pedido}\nFornecedor: ${c.codFor || ''} - ${c.fornecedor}\nValor: R$ ${fmtMoeda(c.valor)}\nPagamento: ${c.pagamento}`;
        abrirModal("Tratar Serviço", corpo, [
            { txt: "ENVIAR E-MAIL", cl: "btn-primary-modal", fn: () => {
                window.location.href = `mailto:servicos@vaccinar.com.br?cc=contasapagar@vaccinar.com.br&subject=NF ${c.fornecedor}&body=${encodeURIComponent(corpo)}`;
                window.upd(id, 'status', 'Enviado ao CSC'); fecharModal();
            }},
            { txt: "MARCAR COMO ENVIADO", cl: "btn-secondary-modal", fn: () => {
                window.upd(id, 'status', 'Enviado ao CSC'); fecharModal();
            }}
        ]);
    });
};

window.modalProduto = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const corpo = `${c.local}\nPedido: ${c.pedido}\nFornecedor: ${c.codFor || ''} - ${c.fornecedor}\nValor: R$ ${fmtMoeda(c.valor)}\nPagamento: ${c.pagamento}`;
        abrirModal("Copiar Dados", corpo, [
            { txt: "COPIAR E MARCAR", cl: "btn-primary-modal", fn: () => {
                navigator.clipboard.writeText(corpo); alert("Copiado!");
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
    const bc = document.createElement('button'); bc.innerText = "CANCELAR"; bc.className = "modal-btn"; bc.onclick = fecharModal; c.appendChild(bc);
    document.getElementById('modalApp').style.display = 'flex';
}
function fecharModal() { document.getElementById('modalApp').style.display = 'none'; }

window.remover = (id) => { if(confirm("Excluir?")) remove(ref(db, `contas/${id}`)); };
document.getElementById('btnLogin').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value);
document.getElementById('btnLogout').onclick = () => signOut(auth);
document.getElementById('mesFiltro').onchange = carregarDados;
document.getElementById('filtroLocal').onchange = carregarDados;
document.getElementById('inputBusca').oninput = carregarDados;
