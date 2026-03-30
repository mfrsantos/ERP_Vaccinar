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

document.getElementById('btnLogin').onclick = () => {
    signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value)
    .catch(() => { document.getElementById('loginError').style.display = 'block'; document.getElementById('loginError').innerText = "Erro no acesso"; });
};
document.getElementById('btnLogout').onclick = () => signOut(auth);
onAuthStateChanged(auth, (user) => {
    document.getElementById('loginOverlay').style.display = user ? 'none' : 'flex';
    document.getElementById('appContent').style.display = user ? 'block' : 'none';
    if (user) iniciarSistema();
});

function iniciarSistema() {
    document.getElementById('btnLancar').onclick = () => {
        const valorLimpado = parseFloat(document.getElementById('valorInput').value.replace(',', '.')) || 0;
        const nova = {
            tipo: document.getElementById('tipoInput').value,
            local: document.getElementById('localInput').value,
            pedido: document.getElementById('pedidoInput').value,
            codFornecedor: document.getElementById('codFornecedorInput').value,
            fornecedor: document.getElementById('fornecedorInput').value.toUpperCase(),
            valor: valorLimpado,
            cc: document.getElementById('ccInput').value.toUpperCase(),
            vencimento: document.getElementById('vencimentoInput').value,
            pagamento: document.getElementById('pagamentoInput').value,
            mes: document.getElementById('mesFiltro').value,
            status: "Pendente",
            timestamp: Date.now()
        };
        push(contasRef, nova);
        ['pedidoInput', 'fornecedorInput', 'valorInput', 'vencimentoInput', 'codFornecedorInput', 'ccInput'].forEach(id => document.getElementById(id).value = "");
    };

    onValue(contasRef, (snapshot) => renderizar(snapshot.val()));
    document.getElementById('mesFiltro').onchange = () => refresh();
    document.getElementById('filtroLocal').onchange = () => refresh();
}

function refresh() { onValue(contasRef, (s) => renderizar(s.val()), { onlyOnce: true }); }

function renderizar(data) {
    const tServico = document.getElementById('tabelaServico');
    const tProduto = document.getElementById('tabelaProduto');
    const mesSel = document.getElementById('mesFiltro').value;
    const locSel = document.getElementById('filtroLocal').value;
    
    tServico.innerHTML = ""; tProduto.innerHTML = "";
    let pnd = 0, pg = 0;

    if (!data) return;

    // ORDENAÇÃO: Pendente primeiro, depois por tempo (mais novos no topo de cada grupo)
    const listaTratada = Object.keys(data)
        .map(key => ({ id: key, ...data[key] }))
        .filter(c => c.mes === mesSel && (locSel === "TODOS" || c.local === locSel))
        .sort((a, b) => {
            if (a.status === "Pendente" && b.status !== "Pendente") return -1;
            if (a.status !== "Pendente" && b.status === "Pendente") return 1;
            return b.timestamp - a.timestamp;
        });

    listaTratada.forEach(c => {
        c.status === "Enviado ao CSC" ? pg += c.valor : pnd += c.valor;

        const tr = document.createElement('tr');
        tr.style.opacity = c.status === "Enviado ao CSC" ? "0.4" : "1";
        tr.innerHTML = `
            <td style="color:${c.tipo === 'SERVICO' ? '#10b981' : '#3b82f6'}; font-weight:bold;">${c.local}</td>
            <td contenteditable="true" onblur="window.edit('${c.id}', 'pedido', this.innerText)" class="editavel">${c.pedido}</td>
            <td style="color:#9ca3af;">${c.codFornecedor}</td>
            <td>${c.fornecedor}</td>
            <td contenteditable="true" onblur="window.edit('${c.id}', 'valor', this.innerText)" class="editavel">R$ ${c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td>${c.cc || '-'}</td>
            <td>${c.vencimento}</td>
            <td>
                ${c.status === "Pendente" 
                    ? `<button onclick="window.abrirTratamento('${c.id}')" style="background:#10b981; color:#000; border:none; padding:5px 10px; border-radius:4px; font-weight:bold; cursor:pointer;">TRATAR</button>`
                    : `<button onclick="window.desfazer('${c.id}')" style="background:#4b5563; color:#fff; border:none; padding:5px 10px; border-radius:4px; font-weight:bold; cursor:pointer;">VOLTAR</button>`
                }
                <button onclick="window.del('${c.id}')" style="background:none; border:none; color:#ef4444; margin-left:8px; cursor:pointer;">X</button>
            </td>
        `;

        if (c.tipo === "SERVICO") tServico.appendChild(tr);
        else tProduto.appendChild(tr);
    });

    document.getElementById('totalPendente').innerText = "R$ " + pnd.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalPago').innerText = "R$ " + pg.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalGeral').innerText = "R$ " + (pnd+pg).toLocaleString('pt-BR',{minimumFractionDigits:2});
}

// LOGICA DE EDIÇÃO NA TABELA
window.edit = (id, campo, novoValor) => {
    let valorFinal = novoValor.trim();
    if (campo === 'valor') {
        valorFinal = parseFloat(novoValor.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
        if (isNaN(valorFinal)) return alert("Valor inválido!");
    }
    update(ref(db, `contas/${id}`), { [campo]: valorFinal });
};

window.abrirTratamento = (id) => {
    onValue(ref(db, `contas/${id}`), (snap) => {
        const c = snap.val();
        const valorFormat = c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2});
        
        const linhaDados = `${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFornecedor} - ${c.fornecedor} - Valor: R$ ${valorFormat} - C/C: ${c.cc} - Venc.: ${c.vencimento}`;
        
        const textoEmail = `Bom dia!\n\nSegue Para Lançamento:\n\n${linhaDados}\n\nPagamento via: ${c.pagamento}.`;
        const assuntoEmail = `Enc. ${linhaDados}`;

        document.getElementById('previewTexto').innerText = textoEmail;
        const botoes = document.getElementById('botoesAcao');
        botoes.innerHTML = "";

        if (c.tipo === "SERVICO") {
            botoes.innerHTML = `<button class="btn-csc" id="actCsc">Enviar ao CSC (E-mail)</button>`;
            document.getElementById('actCsc').onclick = () => {
                const emails = ""; 
                window.location.href = `mailto:${emails}?subject=${encodeURIComponent(assuntoEmail)}&body=${encodeURIComponent(textoEmail)}`;
                window.marcarEnviado(id);
            };
        } else {
            botoes.innerHTML = `<button class="btn-copiar" id="actCopy">Copiar Texto e Marcar</button>`;
            document.getElementById('actCopy').onclick = () => {
                navigator.clipboard.writeText(textoEmail).then(() => {
                    alert("Copiado com sucesso!");
                    window.marcarEnviado(id);
                });
            };
        }
        document.getElementById('modalEnvio').style.display = 'block';
    }, { onlyOnce: true });
};

window.marcarEnviado = (id) => {
    update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
    document.getElementById('modalEnvio').style.display = 'none';
};

window.desfazer = (id) => {
    if(confirm("Deseja retornar este item para pendente?")) {
        update(ref(db, `contas/${id}`), { status: "Pendente" });
    }
};

window.del = (id) => { if(confirm("Remover lançamento permanentemente?")) remove(ref(db, `contas/${id}`)); };

document.getElementById('btnBackup').onclick = () => {
    onValue(contasRef, (s) => {
        const b = new Blob([JSON.stringify(s.val(), null, 2)], {type: "application/json"});
        const l = document.createElement("a");
        l.href = URL.createObjectURL(b);
        l.download = `backup_erp.json`;
        l.click();
    }, {onlyOnce: true});
};
