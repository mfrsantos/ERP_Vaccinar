import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Configuração do seu Firebase
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

// --- Lógica de Autenticação ---
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

// --- Lógica de Importação CSV ---
document.getElementById('importarCSV').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const text = event.target.result;
        const linhas = text.split('\n');
        
        const deParaFilial = {
            "010001": "MATRIZ", "010020": "PINHAIS", "010025": "TOLEDO",
            "010035": "GOIANIRA", "010057": "ARAGUAINA", "010085": "BOM DESPACHO",
            "010091": "NOVA PONTE"
        };

        let cont = 0;
        // Começa em 1 para pular o cabeçalho do CSV
        for (let i = 1; i < linhas.length; i++) {
            const linha = linhas[i].trim();
            if (!linha) continue;

            // Divide por ponto e vírgula (formato padrão Excel Brasil)
            const colunas = linha.split(';');
            if (colunas.length < 6) continue;

            const [codFilial, pedido, codForn, nomeForn, cc, valor] = colunas;

            const novoLancamento = {
                local: deParaFilial[codFilial.trim()] || codFilial.trim(),
                pedido: pedido.trim(),
                codFornecedor: codForn.trim(),
                fornecedor: nomeForn.trim().toUpperCase(),
                cc: cc.trim(),
                valor_item: valor.trim().replace(',', '.'), // Converte para formato numérico
                vencimento: "28/04/2026", // Fixado para o seu teste de Abril
                tipo: "SERVICO",
                status: "Pendente",
                timestamp: Date.now() + i
            };

            push(contasRef, novoLancamento);
            cont++;
        }
        alert(`${cont} pedidos importados com sucesso!`);
    };
    reader.readAsText(file);
});

// --- Exibição de Dados (Tabelas) ---
onValue(contasRef, (snapshot) => {
    const data = snapshot.val();
    const tabelaServico = document.getElementById('tabelaServico');
    tabelaServico.innerHTML = "";

    if (data) {
        Object.keys(data).forEach(id => {
            const c = data[id];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${c.local}</td>
                <td class="editavel" onblur="updateField('${id}', 'pedido', this.innerText)">${c.pedido}</td>
                <td>${c.fornecedor}</td>
                <td class="editavel" onblur="updateField('${id}', 'valor_item', this.innerText)">${c.valor_item}</td>
                <td>${c.cc}</td>
                <td>${c.vencimento}</td>
                <td><span class="status-tag">${c.status}</span></td>
                <td>
                    <button onclick="abrirTratar('${id}')" style="background:#10b981; color:#000; border:none; padding:4px 8px; border-radius:4px; cursor:pointer">TRATAR</button>
                    <button onclick="removerItem('${id}')" style="background:none; border:none; color:#ef4444; margin-left:10px; cursor:pointer"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tabelaServico.appendChild(tr);
        });
    }
});

// Funções Auxiliares (Global para o HTML acessar)
window.removerItem = (id) => { if(confirm("Remover?")) remove(ref(db, `contas/${id}`)); };
window.updateField = (id, field, value) => { update(ref(db, `contas/${id}`), { [field]: value }); };
window.abrirTratar = (id) => {
    onValue(ref(db, `contas/${id}`), (snap) => {
        const c = snap.val();
        if(!c) return;
        document.getElementById('modalPreview').innerText = `Pedido: ${c.pedido}\nFornecedor: ${c.fornecedor}\nValor: R$ ${c.valor_item}`;
        document.getElementById('modalTratar').style.display = 'flex';
        document.getElementById('btnAcaoPrincipal').onclick = () => {
            alert("Ação realizada para o pedido " + c.pedido);
            update(ref(db, `contas/${id}`), { status: "Enviado" });
            document.getElementById('modalTratar').style.display = 'none';
        };
    }, { onlyOnce: true });
};
