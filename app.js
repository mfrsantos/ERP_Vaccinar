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

// --- LÓGICA DE DATA INTELIGENTE ---
function formatarDataInteligente(valor) {
    let d = valor.replace(/\D/g, '');
    let dia, mes, ano = "2026";
    const mesFiltro = document.getElementById('mesFiltro').value;

    if (d.length === 0) return "";
    if (d.length <= 2) { 
        dia = d.padStart(2, '0'); 
        mes = mesFiltro; 
    } else if (d.length <= 4) { 
        dia = d.substring(0, 2); 
        mes = d.substring(2, 4); 
    } else { 
        dia = d.substring(0, 2); 
        mes = d.substring(2, 4); 
        ano = d.substring(4, 8); 
        if (ano.length === 2) ano = "20" + ano; 
    }
    return `${dia}/${mes}/${ano}`;
}

async function pedidoExiste(numeroPedido) {
    if (!numeroPedido) return false;
    const consulta = query(contasRef, orderByChild("pedido"), equalTo(numeroPedido));
    const snapshot = await get(consulta);
    return snapshot.exists();
}

function iniciarSistema() {
    const btnImp = document.getElementById('btnImportarJSON');
    const inputImp = document.getElementById('inputImportarJSON');
    const inputVenc = document.getElementById('vencimento');

    inputVenc.onblur = () => { if (inputVenc.value) inputVenc.value = formatarDataInteligente(inputVenc.value); };

    const deParaFilial = {
        "010001": "MATRIZ", "010020": "PINHAIS", "010025": "TOLEDO",
        "010035": "GOIANIRA", "010057": "ARAGUAINA", "010085": "BOM DESPACHO",
        "010091": "NOVA PONTE"
    };

    // --- IMPORTAÇÃO CSV ---
    btnImp.onclick = () => inputImp.click();
    inputImp.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const linhas = ev.target.result.split('\n');
            let importados = 0;
            for (let i = 1; i < linhas.length; i++) {
                const linha = linhas[i];
                if (!linha.trim()) continue;
                const col = linha.split(';');
                if (col.length < 5) continue;
                const numPedido = col[1].trim();
                if (await pedidoExiste(numPedido)) continue;

                const novoItem = {
                    local: deParaFilial[col[0].trim()] || col[0].trim(),
                    pedido: numPedido,
                    codFornecedor: col[2].trim(),
                    fornecedor: col[3].trim().toUpperCase(),
                    valor: parseFloat(col[4].replace(',', '.')) || 0,
                    cc: col[5] ? col[5].trim() : "140503",
                    vencimento: col[6] ? col[6].trim() : "28/03/2026",
                    pagamento: "BOLETO", // Padrão na importação
                    tipo: "SERVICO",
                    status: "Pendente",
                    mes: document.getElementById('mesFiltro').value,
                    timestamp: Date.now() + i
                };
                push(contasRef, novoItem);
                importados++;
            }
            alert(`Importados: ${importados}`);
        };
        reader.readAsText(file, 'ISO-8859-1');
    };

    // --- LANÇAMENTO MANUAL ---
    document.getElementById('btnLancar').onclick = async () => {
        const ped = document.getElementById('pedido').value;
        if (await pedidoExiste(ped)) { alert("Pedido Duplicado!"); return; }

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
            vencimento: formatarDataInteligente(inputVenc.value),
            pagamento: document.getElementById('pagamentoInput').value,
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

    Object.keys(data).sort((a,b) => (data[b].timestamp||0) - (data[a].timestamp||0)).forEach(id => {
        const c = data[id];
        if (c.mes !== mesSel || (locSel !== "TODOS" && c.local !== locSel)) return;

        totalN++;
        if (c.status === "Enviado ao CSC") { pg += c.valor; envN++; } else { pnd += c.valor; }

        const tr = document.createElement('tr');
        tr.style.opacity = c.status === "Enviado ao CSC" ? "0.4" : "1";
        tr.innerHTML = `
            <td style="color:#10b981; font-weight:bold">${c.local}</td>
            <td contenteditable="true" onblur="window.edit('${id}', 'pedido', this.innerText)" class="editavel">${c.pedido}</td>
            <td style="color:#9ca3af; font-family: monospace;">${c.codFornecedor}</td>
            <td style="font-weight:bold">${c.fornecedor}</td>
            <td contenteditable="true" onblur="window.edit('${id}', 'valor', this.innerText)" class="editavel">R$ ${c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="color:#6b7280">${c.cc}</td>
            <td contenteditable="true" onblur="window.edit('${id}', 'vencimento', this.innerText)" class="editavel">${c.vencimento}</td>
            <td>
                <select onchange="window.edit('${id}', 'pagamento', this.value)" style="padding:2px; font-size:11px">
                    <option value="BOLETO" ${c.pagamento==='BOLETO'?'selected':''}>BOLETO</option>
                    <option value="DEPOSITO" ${c.pagamento==='DEPOSITO'?'selected':''}>DEPOSITO</option>
                </select>
            </td>
            <td style="font-weight:bold; color:${c.status==='Pendente'?'#ef4444':'#10b981'}">${c.status}</td>
            <td>
                <button onclick="window.abrirTratar('${id}')" class="btn-lancar" style="padding:4px 8px; font-size:10px">ENVIAR</button>
                <button onclick="window.del('${id}')" style="color:#ef4444; border:none; background:none; cursor:pointer; margin-left:8px"><i class="fas fa-trash"></i></button>
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
    if (campo === 'vencimento') f = formatarDataInteligente(f);
    update(ref(db, `contas/${id}`), { [campo]: f });
};

window.abrirTratar = (id) => {
    onValue(ref(db, `contas/${id}`), (s) => {
        const c = s.val();
        const vF = c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const pgto = c.pagamento || "BOLETO";
        
        // Mensagem dinâmica com a forma de pagamento correta
        const texto = `Bom dia!\n\nSegue Para Lançamento:\n\n${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFornecedor} - ${c.fornecedor} - Valor: R$ ${vF} - C/C: ${c.cc} - Venc.: ${c.vencimento}\n\nPagamento via: ${pgto}.`;
        
        document.getElementById('modalPreview').innerText = texto;
        document.getElementById('modalTratar').style.display = 'flex';
        
        const btn = document.getElementById('btnAcaoPrincipal');
        btn.innerText = c.tipo === "PRODUTO" ? "COPIAR TEXTO" : "ENVIAR AO CSC";
        
        btn.onclick = () => {
            if (c.tipo === "SERVICO") {
                const assunto = `Enc. ${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFornecedor} - ${c.fornecedor} - Valor: R$ ${vF}`;
                // Separador ";" para Outlook
                window.location.href = `mailto:servicos@vaccinar.com.br?cc=nfe.ti@vaccinar.com.br;contasapagar@vaccinar.com.br&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
            } else {
                navigator.clipboard.writeText(texto);
                alert("Texto copiado!");
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

window.del = (id) => { if(confirm("Excluir nota?")) remove(ref(db, `contas/${id}`)); };
function refresh() { onValue(contasRef, (s) => renderizar(s.val()), { onlyOnce: true }); }
