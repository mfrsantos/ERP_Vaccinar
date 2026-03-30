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

// LOGIN
document.getElementById('btnLogin').onclick = () => {
    signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value)
    .catch(() => { document.getElementById('loginError').style.display = 'block'; document.getElementById('loginError').innerText = "Acesso negado"; });
};
document.getElementById('btnLogout').onclick = () => signOut(auth);
onAuthStateChanged(auth, (user) => {
    document.getElementById('loginOverlay').style.display = user ? 'none' : 'flex';
    document.getElementById('appContent').style.display = user ? 'block' : 'none';
    if (user) iniciarSistema();
});

// FORMATAÇÃO
function formatarMoeda(event) {
    let valor = event.target.value.replace(/\D/g, '');
    if (valor === "") return;
    valor = (valor / 100).toFixed(2).replace('.', ',');
    valor = valor.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    event.target.value = `R$ ${valor}`;
}

function iniciarSistema() {
    const vInput = document.getElementById('valorInput');
    const cInput = document.getElementById('codFornecedorInput');
    const fInput = document.getElementById('inputImportarJSON');

    vInput.onblur = formatarMoeda;
    vInput.onfocus = (e) => e.target.value = e.target.value.replace(/\D/g, '');
    cInput.oninput = (e) => e.target.value = e.target.value.replace(/\D/g, '');

    // IMPORTAÇÃO INTELIGENTE (FILTRADA)
    document.getElementById('btnImportar').onclick = () => fInput.click();
    fInput.onchange = (e) => {
        const arquivo = e.target.files[0];
        if (!arquivo) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const dados = JSON.parse(event.target.result);
                const lista = Object.values(dados);
                
                // Filtramos apenas o que tem número de pedido
                const listaFiltrada = lista.filter(i => i.pedido && i.pedido !== "" && i.pedido !== "-");

                if (confirm(`Encontrei ${listaFiltrada.length} pedidos de serviços. Importar para o sistema?`)) {
                    listaFiltrada.forEach(item => {
                        push(contasRef, {
                            local: item.local || "MATRIZ",
                            pedido: item.pedido,
                            codFornecedor: item.codFornecedor || "",
                            fornecedor: item.fornecedor ? item.fornecedor.toUpperCase() : "FORNECEDOR",
                            tipo: "SERVICO", // Forçamos SERVICO conforme regra
                            valor: parseFloat(item.valor) || 0,
                            cc: item.cc || "",
                            vencimento: item.vencimento || "",
                            pagamento: item.pagamento || "BOLETO",
                            mes: document.getElementById('mesFiltro').value,
                            status: "Pendente",
                            timestamp: Date.now()
                        });
                    });
                    alert("Importação concluída! Verifique os itens destacados em amarelo.");
                    fInput.value = "";
                }
            } catch (err) { alert("Arquivo JSON inválido."); }
        };
        reader.readAsText(arquivo);
    };

    document.getElementById('btnLancar').onclick = () => {
        const val = parseFloat(vInput.value.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
        push(contasRef, {
            tipo: document.getElementById('tipoInput').value,
            local: document.getElementById('localInput').value,
            pedido: document.getElementById('pedidoInput').value,
            codFornecedor: cInput.value,
            fornecedor: document.getElementById('fornecedorInput').value.toUpperCase(),
            valor: val,
            cc: document.getElementById('ccInput').value.toUpperCase(),
            vencimento: document.getElementById('vencimentoInput').value,
            pagamento: document.getElementById('pagamentoInput').value,
            mes: document.getElementById('mesFiltro').value,
            status: "Pendente",
            timestamp: Date.now()
        });
        ['pedidoInput', 'fornecedorInput', 'valorInput', 'vencimentoInput', 'codFornecedorInput', 'ccInput'].forEach(id => document.getElementById(id).value = "");
    };

    onValue(contasRef, (snap) => renderizar(snap.val()));
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

    const lista = Object.keys(data).map(k => ({ id: k, ...data[k] }))
        .filter(c => c.mes === mesSel && (locSel === "TODOS" || c.local === locSel))
        .sort((a, b) => (a.status === "Pendente" ? -1 : 1) || b.timestamp - a.timestamp);

    lista.forEach(c => {
        c.status === "Enviado ao CSC" ? pg += c.valor : pnd += c.valor;
        const tr = document.createElement('tr');
        tr.style.opacity = c.status === "Enviado ao CSC" ? "0.4" : "1";
        
        // Verificação para destacar valor zerado
        const classeValor = c.valor === 0 ? "editavel alerta-valor" : "editavel";
        const textoValor = c.valor === 0 ? "DEFINIR VALOR" : `R$ ${c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}`;

        tr.innerHTML = `
            <td style="color:${c.tipo === 'SERVICO' ? '#10b981' : '#3b82f6'}; font-weight:bold;">${c.local}</td>
            <td contenteditable="true" onblur="window.edit('${c.id}', 'pedido', this, this.innerText)" class="editavel">${c.pedido}</td>
            <td style="color:#9ca3af;">${c.codFornecedor}</td>
            <td>${c.fornecedor}</td>
            <td contenteditable="true" onblur="window.edit('${c.id}', 'valor', this, this.innerText)" class="${classeValor}">${textoValor}</td>
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
        if (c.tipo === "SERVICO") tServico.appendChild(tr); else tProduto.appendChild(tr);
    });

    document.getElementById('totalPendente').innerText = "R$ " + pnd.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalPago').innerText = "R$ " + pg.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalGeral').innerText = "R$ " + (pnd+pg).toLocaleString('pt-BR',{minimumFractionDigits:2});
}

window.edit = (id, campo, elemento, novo) => {
    let final = novo.trim();
    if (campo === 'valor') {
        final = parseFloat(novo.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
    }
    update(ref(db, `contas/${id}`), { [campo]: final }).then(() => {
        elemento.classList.add('success-update');
        setTimeout(() => elemento.classList.remove('success-update'), 800);
    });
};

window.abrirTratamento = (id) => {
    onValue(ref(db, `contas/${id}`), (snap) => {
        const c = snap.val();
        if (c.valor === 0) return alert("Por favor, preencha o VALOR antes de tratar o lançamento.");
        const vF = c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2});
        const linha = `${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFornecedor} - ${c.fornecedor} - Valor: R$ ${vF} - C/C: ${c.cc} - Venc.: ${c.vencimento}`;
        const corpo = `Bom dia!\n\nSegue Para Lançamento:\n\n${linha}\n\nPagamento via: ${c.pagamento}.`;
        const assunto = `Enc. ${linha}`;
        document.getElementById('previewTexto').innerText = corpo;
        const bts = document.getElementById('botoesAcao');
        bts.innerHTML = "";
        if (c.tipo === "SERVICO") {
            bts.innerHTML = `<button class="btn-csc" id="aCsc">Enviar ao CSC (E-mail)</button>`;
            document.getElementById('aCsc').onclick = () => {
                window.location.href = `mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
                window.marcarEnviado(id);
            };
        } else {
            bts.innerHTML = `<button class="btn-copiar" id="aCopy">Copiar Texto e Marcar</button>`;
            document.getElementById('aCopy').onclick = () => {
                navigator.clipboard.writeText(corpo).then(() => { alert("Copiado!"); window.marcarEnviado(id); });
            };
        }
        document.getElementById('modalEnvio').style.display = 'block';
    }, { onlyOnce: true });
};

window.marcarEnviado = (id) => {
    update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
    document.getElementById('modalEnvio').style.display = 'none';
};

window.desfazer = (id) => { if(confirm("Voltar para Pendente?")) update(ref(db, `contas/${id}`), { status: "Pendente" }); };
window.del = (id) => { if(confirm("Remover?")) remove(ref(db, `contas/${id}`)); };

document.getElementById('btnBackup').onclick = () => {
    onValue(contasRef, (s) => {
        const b = new Blob([JSON.stringify(s.val(), null, 2)], {type: "application/json"});
        const l = document.createElement("a");
        l.href = URL.createObjectURL(b);
        l.download = `backup_erp.json`;
        l.click();
    }, {onlyOnce: true});
};
