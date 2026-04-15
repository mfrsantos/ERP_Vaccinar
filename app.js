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

// Formatação Brasileira para exibição
const fmtMoeda = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

// Converte "1.350,00" para 1350.00 (Salva corretamente no banco)
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

// FUNÇÃO GLOBAL DE ATUALIZAÇÃO
window.upd = async (id, campo, valor) => {
    const dataRef = ref(db, `contas/${id}`);
    let valorFinal = valor;
    
    // Se estivermos alterando o valor, fazemos o parse ANTES de salvar
    if (campo === 'valor') {
        valorFinal = parseMoeda(valor);
    }

    try {
        await update(dataRef, { [campo]: valorFinal });
        console.log("Atualizado com sucesso no Firebase.");
    } catch (e) {
        console.error("Erro ao salvar:", e);
    }
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
            });

        itens.forEach(item => {
            const isEnv = item.status === "Enviado ao CSC";
            const tr = document.createElement('tr');
            if (isEnv) tr.className = "row-enviada";

            const htmlBase = `
                <td>${item.local}</td>
                <td><input type="text" value="${item.pedido || ''}" class="input-tabela" onblur="window.upd('${item.id}', 'pedido', this.value)"></td>
                <td>${item.codFor || ''}</td>
                <td>${item.fornecedor}</td>
                <td>${item.cc || ''}</td>
                <td class="col-valor">R$ <input type="text" value="${fmtMoeda(item.valor)}" class="input-tabela col-valor" onblur="window.upd('${item.id}', 'valor', this.value)"></td>
                <td><input type="text" value="${item.vencimento || ''}" class="input-tabela" onblur="window.upd('${item.id}', 'vencimento', this.value)"></td>
                <td>${item.pagamento}</td>
                <td><span class="status-badge ${isEnv ? 'status-enviado' : 'status-pendente'}">${item.status}</span></td>
                <td>
                    <button onclick="window.modalTratar('${item.id}')" class="btn-import"><i class="fas fa-paper-plane"></i></button>
                    <button onclick="window.remover('${item.id}')" style="background:none; border:none; color:#64748b; cursor:pointer;"><i class="fas fa-trash"></i></button>
                </td>`;

            tr.innerHTML = htmlBase;
            !isEnv ? (pVal += item.valor, pCount++) : (eVal += item.valor, eCount++);
            item.tipo === "SERVICO" ? tServ.appendChild(tr) : tProd.appendChild(tr);
        });

        document.getElementById('totalPendente').innerText = "R$ " + fmtMoeda(pVal);
        document.getElementById('totalEnviado').innerText = "R$ " + fmtMoeda(eVal);
        document.getElementById('countPendente').innerText = pCount + " notas";
        document.getElementById('countEnviado').innerText = eCount + " notas";
    });
}

document.getElementById('btnSalvarManual').onclick = async () => {
    await push(contasRef, {
        tipo: document.getElementById('mTipo').value,
        local: document.getElementById('mLocal').value,
        pedido: document.getElementById('mPedido').value.trim(), 
        codFor: document.getElementById('mCodFor').value.trim(),
        fornecedor: document.getElementById('mFornecedor').value.toUpperCase(), 
        cc: document.getElementById('mCC').value,
        valor: parseMoeda(document.getElementById('mValor').value),
        vencimento: document.getElementById('mVenc').value,
        pagamento: document.getElementById('mPagamento').value,
        status: "Pendente",
        mes: document.getElementById('mesFiltro').value
    });
    alert("Salvo!");
    ["mPedido", "mCodFor", "mFornecedor", "mCC", "mValor", "mVenc"].forEach(id => document.getElementById(id).value = "");
};

window.remover = (id) => { if(confirm("Excluir?")) remove(ref(db, `contas/${id}`)); };

window.modalTratar = (id) => {
    get(ref(db, `contas/${id}`)).then(snap => {
        const c = snap.val();
        const texto = `${c.local}\nPedido: ${c.pedido}\nFornecedor: ${c.codFor} - ${c.fornecedor}\nValor: R$ ${fmtMoeda(c.valor)}\nPagamento: ${c.pagamento}`;
        document.getElementById('modalPreview').innerText = texto;
        const acts = document.getElementById('modalActions');
        acts.innerHTML = `<button class="modal-btn btn-primary-modal" id="btnFinalizar">ENVIAR E MARCAR</button>
                          <button class="modal-btn" onclick="document.getElementById('modalApp').style.display='none'">CANCELAR</button>`;
        
        document.getElementById('btnFinalizar').onclick = () => {
            if(c.tipo === "SERVICO") {
                window.location.href = `mailto:servicos@vaccinar.com.br?subject=NF ${c.fornecedor}&body=${encodeURIComponent(texto)}`;
            } else {
                navigator.clipboard.writeText(texto);
                alert("Texto copiado!");
            }
            window.upd(id, 'status', 'Enviado ao CSC');
            document.getElementById('modalApp').style.display='none';
        };
        document.getElementById('modalApp').style.display = 'flex';
    });
};

document.getElementById('btnLogin').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value);
document.getElementById('btnLogout').onclick = () => signOut(auth);
document.getElementById('mesFiltro').onchange = carregarDados;
document.getElementById('filtroLocal').onchange = carregarDados;
document.getElementById('inputBusca').oninput = carregarDados;
