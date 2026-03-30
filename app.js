import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Credenciais Reais do Marcus - ERP Green Tech
const firebaseConfig = {
  apiKey: "AIzaSyD-mBgupzksWj93Jpu1itwBKky27Rzi-wU",
  authDomain: "erp-green-tech.firebaseapp.com",
  databaseURL: "https://erp-green-tech-default-rtdb.firebaseio.com",
  projectId: "erp-green-tech",
  storageBucket: "erp-green-tech.firebasestorage.app",
  messagingSenderId: "147246687989",
  appId: "1:147246687989:web:717ac874b7e485a76f47bc"
};

// Inicialização
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const contasRef = ref(db, 'contas');

// --- CONTROLE DE ACESSO (LOGIN) ---
onAuthStateChanged(auth, (user) => {
    const overlay = document.getElementById('loginOverlay');
    const appUI = document.getElementById('appContent');
    
    if (user) {
        overlay.style.display = 'none';
        appUI.style.display = 'block';
        iniciarApp();
    } else {
        overlay.style.display = 'flex';
        appUI.style.display = 'none';
    }
});

// Evento do Botão Entrar
document.getElementById('btnLogin').onclick = async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    const errorBox = document.getElementById('loginError');

    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
        console.error("Erro de Autenticação:", e.code);
        errorBox.innerText = "Acesso Negado: Verifique e-mail e senha no Console do Firebase.";
        errorBox.style.display = "block";
    }
};

// Evento Sair
document.getElementById('btnLogout').onclick = () => signOut(auth);

// --- LÓGICA DO SISTEMA FINANCEIRO ---
function iniciarApp() {
    const fInput = document.getElementById('inputImportarJSON');
    const btnImp = document.getElementById('btnImportar');

    if(btnImp) btnImp.onclick = () => fInput.click();

    fInput.onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const dados = JSON.parse(ev.target.result);
                const mesAtual = document.getElementById('mesFiltro').value;
                
                Object.values(dados).forEach(item => {
                    push(contasRef, { 
                        ...item, 
                        mes: mesAtual, 
                        timestamp: Date.now() 
                    });
                });
                alert("Pedidos importados com sucesso para o mês " + mesAtual);
                fInput.value = "";
            } catch (err) {
                alert("Erro ao ler o arquivo JSON.");
            }
        };
        reader.readAsText(e.target.files[0]);
    };

    onValue(contasRef, (snap) => renderizar(snap.val()));
    document.getElementById('mesFiltro').onchange = () => refresh();
}

function renderizar(data) {
    const body = document.getElementById('tabelaDados');
    const mesSel = document.getElementById('mesFiltro').value;
    body.innerHTML = "";
    
    if (!data) return;

    const itens = Object.keys(data).map(k => ({ id: k, ...data[k] }))
        .filter(i => i.mes === mesSel)
        .sort((a,b) => b.timestamp - a.timestamp);

    itens.forEach(i => {
        const tr = document.createElement('tr');
        if (i.status === "Enviado ao CSC") tr.style.opacity = "0.5";

        tr.innerHTML = `
            <td>${i.local}</td>
            <td contenteditable="true" onblur="window.upd('${i.id}','pedido',this.innerText)" class="editavel">${i.pedido}</td>
            <td>${i.fornecedor}</td>
            <td contenteditable="true" onblur="window.upd('${i.id}','valor',this.innerText)" class="editavel">
                R$ ${Number(i.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}
            </td>
            <td contenteditable="true" onblur="window.upd('${i.id}','vencimento',this.innerText)" class="editavel">${i.vencimento || 'DD/MM'}</td>
            <td>${i.cc || '-'}</td>
            <td>
                <button onclick="window.enviarEmail('${i.id}')" style="background:#10b981; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold;">TRATAR</button>
                <button onclick="window.remover('${i.id}')" style="color:#ef4444; background:none; border:none; cursor:pointer; margin-left:10px;">X</button>
            </td>
        `;
        body.appendChild(tr);
    });
}

// Funções de Edição e Ação
window.upd = (id, campo, valor) => {
    let dado = valor.replace('R$', '').trim();
    if (campo === 'valor') dado = parseFloat(dado.replace(/\./g, '').replace(',', '.')) || 0;
    update(ref(db, `contas/${id}`), { [campo]: dado });
};

window.enviarEmail = (id) => {
    onValue(ref(db, `contas/${id}`), (snap) => {
        const c = snap.val();
        const para = "servicos@vaccinar.com.br";
        const cc = "nfe.ti@vaccinar.com.br, contasapagar@vaccinar.com.br";
        const assunto = `Lançamento NF - Pedido ${c.pedido} - ${c.fornecedor}`;
        const corpo = `Olá,\n\nSolicito o lançamento da nota fiscal:\n\nUnidade: ${c.local}\nPedido: ${c.pedido}\nFornecedor: ${c.fornecedor}\nValor: R$ ${c.valor}\nVencimento: ${c.vencimento}\nCentro de Custo: ${c.cc}\n\nAtenciosamente,\nMarcus - TI`;

        window.location.href = `mailto:${para}?cc=${cc}&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
        update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
    }, { onlyOnce: true });
};

window.remover = (id) => { if(confirm("Excluir item?")) remove(ref(db, `contas/${id}`)); };
function refresh() { onValue(contasRef, (s) => renderizar(s.val()), { onlyOnce: true }); }
