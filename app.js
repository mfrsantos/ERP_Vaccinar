import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = { 
    // COLE AQUI SUAS CREDENCIAIS DO FIREBASE
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const contasRef = ref(db, 'contas');

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
    document.getElementById('loginOverlay').style.display = user ? 'none' : 'flex';
    document.getElementById('appContent').style.display = user ? 'block' : 'none';
    if (user) iniciarSistema();
});

document.getElementById('btnLogin').onclick = async () => {
    const e = document.getElementById('loginEmail').value;
    const p = document.getElementById('loginPass').value;
    try { await signInWithEmailAndPassword(auth, e, p); } 
    catch { document.getElementById('loginError').innerText = "Erro de acesso."; document.getElementById('loginError').style.display="block"; }
};

document.getElementById('btnLogout').onclick = () => signOut(auth);

// --- CORE ---
function iniciarSistema() {
    const fInput = document.getElementById('inputImportarJSON');
    document.getElementById('btnImportar').onclick = () => fInput.click();
    
    fInput.onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dados = JSON.parse(ev.target.result);
            const mesSel = document.getElementById('mesFiltro').value;
            Object.values(dados).forEach(item => {
                push(contasRef, { ...item, mes: mesSel, timestamp: Date.now() });
            });
            alert("Dados importados!");
        };
        reader.readAsText(e.target.files[0]);
    };

    onValue(contasRef, (snap) => renderizar(snap.val()));
    document.getElementById('mesFiltro').onchange = () => refresh();
}

function renderizar(data) {
    const corpo = document.getElementById('tabelaDados');
    const mesSel = document.getElementById('mesFiltro').value;
    corpo.innerHTML = "";
    let pnd = 0, pg = 0;
    if (!data) return;

    const lista = Object.keys(data).map(k => ({ id: k, ...data[k] }))
        .filter(c => c.mes === mesSel)
        .sort((a, b) => b.timestamp - a.timestamp);

    lista.forEach(c => {
        c.status === "Enviado ao CSC" ? pg += c.valor : pnd += c.valor;
        const tr = document.createElement('tr');
        if (c.status === "Enviado ao CSC") tr.style.opacity = "0.5";

        tr.innerHTML = `
            <td>${c.local}</td>
            <td contenteditable="true" onblur="window.edit('${c.id}', 'pedido', this.innerText)" class="editavel">${c.pedido}</td>
            <td>${c.fornecedor}</td>
            <td contenteditable="true" onblur="window.edit('${c.id}', 'valor', this.innerText)" class="editavel">
                R$ ${c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}
            </td>
            <td contenteditable="true" onblur="window.edit('${c.id}', 'vencimento', this.innerText)" class="editavel">${c.vencimento || 'DD/MM'}</td>
            <td>
                <button onclick="window.tratar('${c.id}')" class="btn-primary">TRATAR</button>
                <button onclick="window.del('${c.id}')" style="color:red; background:none; border:none; cursor:pointer;">X</button>
            </td>
        `;
        corpo.appendChild(tr);
    });

    document.getElementById('totalPendente').innerText = "R$ " + pnd.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalPago').innerText = "R$ " + pg.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalGeral').innerText = "R$ " + (pnd+pg).toLocaleString('pt-BR',{minimumFractionDigits:2});
}

window.edit = (id, campo, novo) => {
    let final = novo.replace('R$', '').trim();
    if (campo === 'valor') final = parseFloat(final.replace(/\./g, '').replace(',', '.')) || 0;
    update(ref(db, `contas/${id}`), { [campo]: final });
};

window.tratar = (id) => {
    onValue(ref(db, `contas/${id}`), (s) => {
        const c = s.val();
        const dest = "servicos@vaccinar.com.br";
        const cc = "nfe.ti@vaccinar.com.br, contasapagar@vaccinar.com.br";
        const sub = `Lançamento NF - Pedido ${c.pedido} - ${c.fornecedor}`;
        const corpo = `Solicito lançamento:\n\nUnidade: ${c.local}\nPedido: ${c.pedido}\nFornecedor: ${c.fornecedor}\nValor: R$ ${c.valor}\nVencimento: ${c.vencimento}\nCC: ${c.cc}`;
        
        window.location.href = `mailto:${dest}?cc=${cc}&subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(corpo)}`;
        update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
    }, { onlyOnce: true });
};

window.del = (id) => { if(confirm("Excluir?")) remove(ref(db, `contas/${id}`)); };
function refresh() { onValue(contasRef, (s) => renderizar(s.val()), { onlyOnce: true }); }
