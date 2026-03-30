import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = { 
    // INSERIR AS SUAS CREDENCIAIS AQUI
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const contasRef = ref(db, 'contas');

// --- AUTENTICAÇÃO ---
onAuthStateChanged(auth, (user) => {
    const overlay = document.getElementById('loginOverlay');
    const content = document.getElementById('appContent');
    if (user) {
        overlay.style.display = 'none';
        content.style.display = 'block';
        iniciarSistema();
    } else {
        overlay.style.display = 'flex';
        content.style.display = 'none';
    }
});

document.getElementById('btnLogin').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    const errorMsg = document.getElementById('loginError');
    const btn = document.getElementById('btnLogin');

    try {
        btn.innerText = "ENTRANDO...";
        btn.disabled = true;
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        btn.innerText = "ENTRAR";
        btn.disabled = false;
        errorMsg.style.display = "block";
        errorMsg.innerText = "Falha no acesso. Verifique os dados.";
    }
});

document.getElementById('btnLogout').onclick = () => signOut(auth);

// --- LÓGICA DO ERP ---
function iniciarSistema() {
    const fInput = document.getElementById('inputImportarJSON');
    const mesFiltro = document.getElementById('mesFiltro');

    document.getElementById('btnImportar').onclick = () => fInput.click();
    
    fInput.onchange = (e) => {
        const arquivo = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const dados = JSON.parse(event.target.result);
                const lista = Object.values(dados);
                const mesAlvo = mesFiltro.value;

                if (confirm(`Importar ${lista.length} itens para o mês ${mesAlvo}?`)) {
                    lista.forEach(item => {
                        push(contasRef, {
                            ...item,
                            mes: mesAlvo,
                            timestamp: Date.now()
                        });
                    });
                    alert("Importação Concluída!");
                    fInput.value = "";
                }
            } catch (err) { alert("Erro no ficheiro JSON."); }
        };
        reader.readAsText(arquivo);
    };

    onValue(contasRef, (snap) => renderizar(snap.val()));
    mesFiltro.onchange = refresh;
    document.getElementById('filtroLocal').onchange = refresh;
}

function renderizar(data) {
    const tServico = document.getElementById('tabelaServico');
    const tProduto = document.getElementById('tabelaProduto');
    const mesSel = document.getElementById('mesFiltro').value;
    const locSel = document.getElementById('filtroLocal').value;
    
    tServico.innerHTML = ""; tProduto.innerHTML = "";
    let pnd = 0, pg = 0;
    if (!data) return;

    const lista = Object.keys(data).map(k => ({ id: k, ...data[k] }))
        .filter(c => c.mes === mesSel && (locSel === "TODOS" || c.local === locSel))
        .sort((a, b) => b.timestamp - a.timestamp);

    lista.forEach(c => {
        c.status === "Enviado ao CSC" ? pg += c.valor : pnd += c.valor;
        const isZerado = !c.valor || c.valor === 0;
        const tr = document.createElement('tr');
        if (c.status === "Enviado ao CSC") tr.style.opacity = "0.5";

        tr.innerHTML = `
            <td>${c.local}</td>
            <td contenteditable="true" onblur="window.edit('${c.id}', 'pedido', this, this.innerText)" class="editavel">${c.pedido}</td>
            <td style="color:#666">${c.codFornecedor}</td>
            <td>${c.fornecedor}</td>
            <td contenteditable="true" onblur="window.edit('${c.id}', 'valor', this, this.innerText)" class="${isZerado ? 'editavel alerta-valor' : 'editavel'}">
                ${isZerado ? '⚠️ DEFINIR' : 'R$ ' + c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}
            </td>
            <td>${c.cc || '-'}</td>
            <td contenteditable="true" onblur="window.edit('${c.id}', 'vencimento', this, this.innerText)" class="editavel">${c.vencimento || 'DD/MM'}</td>
            <td>
                ${c.status === "Pendente" 
                    ? `<button onclick="window.abrirTratamento('${c.id}')" class="btn-primary">TRATAR</button>`
                    : `<span style="color:#10b981">ENVIADO</span>`
                }
                <button onclick="window.del('${c.id}')" style="color:#ef4444; background:none; border:none; margin-left:8px; cursor:pointer;">X</button>
            </td>
        `;
        c.tipo === "SERVICO" ? tServico.appendChild(tr) : tProduto.appendChild(tr);
    });

    document.getElementById('totalPendente').innerText = "R$ " + pnd.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalPago').innerText = "R$ " + pg.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalGeral').innerText = "R$ " + (pnd+pg).toLocaleString('pt-BR',{minimumFractionDigits:2});
}

window.edit = (id, campo, elemento, novo) => {
    let final = novo.trim();
    if (campo === 'valor') final = parseFloat(novo.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
    update(ref(db, `contas/${id}`), { [campo]: final }).then(() => {
        elemento.classList.add('success-update');
        setTimeout(() => elemento.classList.remove('success-update'), 800);
    });
};

window.abrirTratamento = (id) => {
    onValue(ref(db, `contas/${id}`), (s) => {
        if (s.val().valor <= 0) return alert("Defina o valor antes de tratar.");
        update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
    }, { onlyOnce: true });
};

window.del = (id) => { if(confirm("Remover?")) remove(ref(db, `contas/${id}`)); };
function refresh() { onValue(contasRef, (s) => renderizar(s.val()), { onlyOnce: true }); }
