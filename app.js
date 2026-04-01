import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-mBgupzksWj93Jpu1itwBKky27Rzi-wU",
  authDomain: "erp-green-tech.firebaseapp.com",
  databaseURL: "https://erp-green-tech-default-rtdb.firebaseio.com",
  projectId: "erp-green-tech",
  storageBucket: "erp-green-tech.firebasestorage.app",
  messagingSenderId: "147246687989",
  appId: "1:147246687989:web:717ac874b7e485a76f47bc"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const contasRef = ref(db, 'contas');

// --- Autenticação ---
onAuthStateChanged(auth, (user) => {
    document.getElementById('loginOverlay').style.display = user ? 'none' : 'flex';
    if(user) document.getElementById('statusUser').innerText = `| ${user.email}`;
});

document.getElementById('btnLogin').onclick = () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    signInWithEmailAndPassword(auth, email, pass).catch(err => alert("Erro: " + err.message));
};

document.getElementById('btnLogout').onclick = () => signOut(auth);

// --- Lançamento Manual ---
document.getElementById('btnLancar').onclick = () => {
    const novo = {
        local: document.getElementById('local').value,
        pedido: document.getElementById('pedido').value,
        fornecedor: document.getElementById('fornecedor').value.toUpperCase(),
        valor_item: document.getElementById('valor').value.replace(',', '.'),
        vencimento: document.getElementById('vencimento').value,
        tipo: document.getElementById('tipoLancamento').value,
        status: "Pendente",
        timestamp: Date.now()
    };
    push(contasRef, novo);
    ["pedido", "fornecedor", "valor", "vencimento"].forEach(id => document.getElementById(id).value = "");
};

// --- Importação CSV ---
document.getElementById('importarCSV').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const linhas = event.target.result.split('\n');
        const deParaFilial = { "010001": "MATRIZ", "010020": "PINHAIS", "010025": "TOLEDO", "010035": "GOIANIRA", "010057": "ARAGUAINA", "010085": "BOM DESPACHO", "010091": "NOVA PONTE" };
        
        for (let i = 1; i < linhas.length; i++) {
            const colunas = linhas[i].split(';');
            if (colunas.length < 6) continue;
            push(contasRef, {
                local: deParaFilial[colunas[0].trim()] || colunas[0].trim(),
                pedido: colunas[1].trim(),
                codFornecedor: colunas[2].trim(),
                fornecedor: colunas[3].trim().toUpperCase(),
                cc: colunas[4].trim(),
                valor_item: colunas[5].trim().replace(',', '.'),
                vencimento: "28/04/2026",
                tipo: "SERVICO", // Padrão para sua carga de Abril
                status: "Pendente",
                timestamp: Date.now() + i
            });
        }
        alert("Importação Concluída!");
    };
    reader.readAsText(file);
});

// --- Renderização das Tabelas ---
onValue(contasRef, (snapshot) => {
    const data = snapshot.val();
    const tProd = document.getElementById('tabelaProduto');
    const tServ = document.getElementById('tabelaServico');
    tProd.innerHTML = ""; tServ.innerHTML = "";

    if (data) {
        Object.keys(data).forEach(id => {
            const c = data[id];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${c.local}</td>
                <td class="editavel" onblur="updateField('${id}', 'pedido', this.innerText)">${c.pedido}</td>
                <td>${c.fornecedor}</td>
                <td class="editavel" onblur="updateField('${id}', 'valor_item', this.innerText)">${c.valor_item}</td>
                <td>${c.cc || '---'}</td>
                <td class="editavel" onblur="updateField('${id}', 'vencimento', this.innerText)">${c.vencimento}</td>
                <td><span class="status-tag">${c.status}</span></td>
                <td>
                    <button onclick="abrirTratar('${id}')" class="btn-tratar">TRATAR</button>
                    <button onclick="removerItem('${id}')" class="btn-delete"><i class="fas fa-trash"></i></button>
                </td>
            `;
            if(c.tipo === "PRODUTO") tProd.appendChild(tr);
            else tServ.appendChild(tr);
        });
    }
});

// --- Funções de Ação ---
window.removerItem = (id) => { if(confirm("Excluir lançamento?")) remove(ref(db, `contas/${id}`)); };
window.updateField = (id, field, value) => update(ref(db, `contas/${id}`), { [field]: value });

window.abrirTratar = (id) => {
    onValue(ref(db, `contas/${id}`), (snap) => {
        const c = snap.val(); if(!c) return;
        const vF = parseFloat(c.valor_item).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const texto = `Olá CSC,\nSegue lançamento para o setor de TI:\n\nUnidade: ${c.local}\nPedido: ${c.pedido}\nFornecedor: ${c.fornecedor}\nValor: R$ ${vF}\nVencimento: ${c.vencimento}\n\nPagamento via: Boleto.`;
        
        document.getElementById('modalPreview').innerText = texto;
        document.getElementById('modalTratar').style.display = 'flex';
        
        const btn = document.getElementById('btnAcaoPrincipal');
        btn.innerText = c.tipo === "PRODUTO" ? "COPIAR TEXTO" : "ENVIAR AO CSC";
        
        btn.onclick = () => {
            if (c.tipo === "SERVICO") {
                const assunto = `Enc. ${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.fornecedor} - Valor: R$ ${vF}`;
                window.location.href = `mailto:servicos@vaccinar.com.br?cc=nfe.ti@vaccinar.com.br,contasapagar@vaccinar.com.br&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
            } else {
                navigator.clipboard.writeText(texto);
                alert("Texto copiado!");
            }
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            fecharModal();
        };

        document.getElementById('btnApenasMarcar').onclick = () => {
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            fecharModal();
        };
    }, { onlyOnce: true });
};
