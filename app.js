import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, get, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
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

onAuthStateChanged(auth, (user) => {
    document.getElementById('loginOverlay').style.display = user ? 'none' : 'flex';
    document.getElementById('appContent').style.display = user ? 'block' : 'none';
    if (user) iniciarSistema();
});

document.getElementById('btnLogin').onclick = async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    try { await signInWithEmailAndPassword(auth, email, pass); } catch (e) { alert("Acesso negado."); }
};
document.getElementById('btnLogout').onclick = () => signOut(auth);

async function pedidoExiste(numeroPedido) {
    if (!numeroPedido) return false;
    const consulta = query(contasRef, orderByChild("pedido"), equalTo(numeroPedido));
    const snapshot = await get(consulta);
    return snapshot.exists();
}

function iniciarSistema() {
    const btnImp = document.getElementById('btnImportarJSON');
    const inputImp = document.getElementById('inputImportarJSON');
    
    const deParaFilial = {
        "010001": "MATRIZ", "010020": "PINHAIS", "010025": "TOLEDO",
        "010035": "GOIANIRA", "010057": "ARAGUAINA", "010085": "BOM DESPACHO",
        "010091": "NOVA PONTE"
    };

    btnImp.onclick = () => inputImp.click();
    inputImp.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const linhas = ev.target.result.split('\n');
            let importados = 0;
            let pulados = 0;

            for (let i = 1; i < linhas.length; i++) {
                const linha = linhas[i];
                if (!linha.trim()) continue;
                const col = linha.split(';');
                if (col.length < 5) continue;

                const numPedido = col[1].trim();
                
                if (await pedidoExiste(numPedido)) {
                    pulados++;
                    continue;
                }

                // Garante que codFornecedor e fornecedor sejam salvos separadamente
                const novoItem = {
                    local: deParaFilial[col[0].trim()] || col[0].trim(),
                    pedido: numPedido,
                    codFornecedor: col[2].trim(),
                    fornecedor: col[3].trim().toUpperCase(),
                    valor: parseFloat(col[4].replace(',', '.')) || 0,
                    cc: col[5] ? col[5].trim() : "140503",
                    vencimento: col[6] ? col[6].trim() : "28/03/2026",
                    tipo: "SERVICO",
                    status: "Pendente",
                    mes: document.getElementById('mesFiltro').value,
                    timestamp: Date.now() + i
                };
                push(contasRef, novoItem);
                importados++;
            }
            alert(`Importação finalizada!\n✅ Itens novos: ${importados}\n⚠️ Já existentes: ${pulados}`);
        };
        reader.readAsText(file, 'ISO-8859-1');
    };

    document.getElementById('btnLancar').onclick = async () => {
        const ped = document.getElementById('pedido').value;
        if (await pedidoExiste(ped)) {
            alert("Erro: Pedido duplicado.");
            return;
        }

        const vRaw = document.getElementById('valor').value;
        const vNum = parseFloat(vRaw.replace(/\./g, '').replace(',', '.')) || 0;
        const novo = {
            tipo: document.getElementById('tipoInput').value,
            local: document.getElementById('localInput').value,
            mes: document.getElementById('mesFiltro').value,
            pedido: ped,
            codFornecedor: document.getElementById('codFornecedor').value,
            fornecedor: document.getElementById('fornecedor').value.toUpperCase(),
            valor: vNum,
            cc: document.getElementById('cc').value,
            vencimento: document.getElementById('vencimento').value,
            status: "Pendente",
            timestamp: Date.now()
        };
        push(contasRef, novo).then(() => {
            ["pedido", "codFornecedor", "fornecedor", "valor", "cc", "vencimento"].forEach(id => document.getElementById(id).value = "");
        });
    };

    onValue(contasRef, (snap) => renderizar(snap.val()));
    document.getElementById('mesFiltro').onchange = () => refresh();
    document.getElementById('filtroLocal').onchange = () => refresh();
}

function renderizar(data) {
    const tServ = document.getElementById('tabelaServico');
    const tProd = document.getElementById('tabelaProduto');
    const mesSel = document.getElementById('mesFiltro').value;
    const locSel = document.getElementById('filtroLocal').value;
    
    tServ.innerHTML = ""; tProd.innerHTML = "";
    let pnd = 0, pg = 0, totalN = 0, envN = 0;

    if (!data) return;

    const idsOrdenados = Object.keys(data).sort((a, b) => {
        const sA = data[a].status === "Pendente" ? 0 : 1;
        const sB = data[b].status === "Pendente" ? 0 : 1;
        if (sA !== sB) return sA - sB;
        return (data[b].timestamp || 0) - (data[a].timestamp || 0);
    });

    idsOrdenados.forEach(id => {
        const c = data[id];
        if (c.mes !== mesSel) return;
        if (locSel !== "TODOS" && c.local !== locSel) return;

        totalN++;
        if (c.status === "Enviado ao CSC") { pg += c.valor; envN++; } else { pnd += c.valor; }

        const tr = document.createElement('tr');
        tr.style.opacity = c.status === "Enviado ao CSC" ? "0.4" : "1";
        
        // Renderização corrigida: Distribui os campos em colunas distintas
        tr.innerHTML = `
            <td style="color:#10b981; font-weight:bold">${c.local}</td>
            <td contenteditable="true" onblur="window.edit('${id}', 'pedido', this.innerText)" class="editavel">${c.pedido}</td>
            <td style="color:#9ca3af; font-family: monospace;">${c.codFornecedor}</td>
            <td style="font-weight:bold">${c.fornecedor}</td>
            <td contenteditable="true" onblur="window.edit('${id}', 'valor', this.innerText)" class="editavel">R$ ${c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="color:#6b7280">${c.cc}</td>
            <td contenteditable="true" onblur="window.edit('${id}', 'vencimento', this.innerText)" class="editavel">${c.vencimento}</td>
            <td style="font-weight:bold; color:${c.status==='Pendente'?'#ef4444':'#10b981'}">${c.status}</td>
            <td>
                <button onclick="window.abrirTratar('${id}')" class="btn-lancar" style="padding:6px 12px; font-size:11px">ENVIAR</button>
                <button onclick="window.del('${id}')" style="color:#ef4444; background:none; border:none; cursor:pointer; margin-left:12px; font-weight:bold"><i class="fas fa-trash"></i></button>
            </td>
        `;
        c.tipo === "SERVICO" ? tServ.appendChild(tr) : tProd.appendChild(tr);
    });

    document.getElementById('progressoNotas').innerText = `${envN} / ${totalN}`;
    document.getElementById('totalPendente').innerText = "R$ " + pnd.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalPago').innerText = "R$ " + pg.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalGeral').innerText = "R$ " + (pnd+pg).toLocaleString('pt-BR',{minimumFractionDigits:2});
}

window.edit = (id, campo, valor) => {
    let f = valor.trim();
    if (campo === 'valor') f = parseFloat(valor.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
    update(ref(db, `contas/${id}`), { [campo]: f });
};

window.abrirTratar = (id) => {
    onValue(ref(db, `contas/${id}`), (s) => {
        const c = s.val();
        const vF = c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const texto = `Bom dia!\n\nSegue Para Lançamento:\n\n${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFornecedor} - ${c.fornecedor} - Valor: R$ ${vF} - C/C: ${c.cc} - Venc.: ${c.vencimento}\n\nPagamento via: Boleto.`;
        document.getElementById('modalPreview').innerText = texto;
        document.getElementById('modalTratar').style.display = 'flex';
        const btn = document.getElementById('btnAcaoPrincipal');
        btn.innerText = c.tipo === "PRODUTO" ? "COPIAR TEXTO" : "ENVIAR AO CSC";
        btn.onclick = () => {
            if (c.tipo === "SERVICO") {
                const assunto = `Enc. ${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFornecedor} - ${c.fornecedor} - Valor: R$ ${vF}`;
                window.location.href = `mailto:servicos@vaccinar.com.br?cc=nfe.ti@vaccinar.com.br,contasapagar@vaccinar.com.br&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
            } else {
                navigator.clipboard.writeText(texto);
                alert("Copiado!");
            }
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            document.getElementById('modalTratar').style.display = 'none';
        };
        document.getElementById('btnApenasMarcar').onclick = () => {
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            document.getElementById('modalTratar').style.display = 'none';
        };
    }, { onlyOnce: true });
};

window.del = (id) => { if(confirm("Excluir?")) remove(ref(db, `contas/${id}`)); };
function refresh() { onValue(contasRef, (s) => renderizar(s.val()), { onlyOnce: true }); }
