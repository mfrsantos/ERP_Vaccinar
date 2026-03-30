import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    databaseURL: "https://SEU_PROJETO.firebaseio.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "ID",
    appId: "ID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const contasRef = ref(db, 'contas');

// --- VERIFICAÇÃO DE LOGIN ---
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

// --- EVENTO DE LOGIN ---
document.getElementById('btnLogin').onclick = async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    const errorBox = document.getElementById('loginError');

    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
        errorBox.innerText = "Erro: Usuário não autorizado ou erro de conexão.";
        errorBox.style.display = "block";
    }
};

document.getElementById('btnLogout').onclick = () => signOut(auth);

// --- LÓGICA DO SISTEMA ---
function iniciarApp() {
    const fInput = document.getElementById('inputImportarJSON');
    document.getElementById('btnImportar').onclick = () => fInput.click();

    fInput.onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dados = JSON.parse(ev.target.result);
            const mesAtual = document.getElementById('mesFiltro').value;
            Object.values(dados).forEach(item => {
                push(contasRef, { ...item, mes: mesAtual, timestamp: Date.now() });
            });
            alert("Pedidos importados com sucesso!");
        };
        reader.readAsText(e.target.files[0]);
    };

    onValue(contasRef, (snap) => renderizar(snap.val()));
}

function renderizar(data) {
    const body = document.getElementById('tabelaDados');
    const mes = document.getElementById('mesFiltro').value;
    body.innerHTML = "";
    if (!data) return;

    const itens = Object.keys(data).map(k => ({ id: k, ...data[k] }))
        .filter(i => i.mes === mes)
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
                <button onclick="window.enviarEmail('${i.id}')" class="btn-tratar">TRATAR</button>
                <button onclick="window.remover('${i.id}')" style="color:red; background:none; border:none; cursor:pointer; margin-left:10px;">X</button>
            </td>
        `;
        body.appendChild(tr);
    });
}

// Funções globais para botões dinâmicos
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
        const assunto = `Lançamento de Nota Fiscal - Pedido ${c.pedido} - ${c.fornecedor}`;
        const corpo = `Olá,\n\nSolicito o lançamento da nota fiscal conforme os dados abaixo:\n\n` +
                      `Local: ${c.local}\nPedido: ${c.pedido}\nFornecedor: ${c.fornecedor}\n` +
                      `Valor: R$ ${c.valor}\nVencimento: ${c.vencimento}\nCentro de Custo: ${c.cc}\n\n` +
                      `Atenciosamente,\nMarcus - TI`;

        window.location.href = `mailto:${para}?cc=${cc}&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
        update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
    }, { onlyOnce: true });
};

window.remover = (id) => { if(confirm("Excluir item?")) remove(ref(db, `contas/${id}`)); };
