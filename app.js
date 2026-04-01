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

function formatarDataInteligente(valor) {
    let d = valor.replace(/\D/g, '');
    let dia, mes, ano = "2026";
    const mesFiltro = document.getElementById('mesFiltro').value;
    if (d.length === 0) return "";
    if (d.length <= 2) { dia = d.padStart(2, '0'); mes = mesFiltro; } 
    else if (d.length <= 4) { dia = d.substring(0, 2); mes = d.substring(2, 4); } 
    else { dia = d.substring(0, 2); mes = d.substring(2, 4); ano = d.substring(4, 8); if (ano.length === 2) ano = "20" + ano; }
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
    
    tServ.innerHTML = ""; 
    tProd.innerHTML = "";
    
    if (!data) return;

    let pnd = 0, pg = 0, totalN = 0, envN = 0;

    // --- LÓGICA DE ORDENAÇÃO ROBUSTA ---
    const ids = Object.keys(data);
    ids.sort((a, b) => {
        const itemA = data[a];
        const itemB = data[b];

        // 1. Prioridade por Status (Pendente primeiro)
        const statusPesoA = itemA.status === "Pendente" ? 0 : 1;
        const statusPesoB = itemB.status === "Pendente" ? 0 : 1;

        if (statusPesoA !== statusPesoB) {
            return statusPesoA - statusPesoB;
        }

        // 2. Se o status for o mesmo, ordena por data (mais recente primeiro)
        return (itemB.timestamp || 0) - (itemA.timestamp || 0);
    });

    ids.forEach(id => {
        const c = data[id];
        // Filtros de Mês e Local
        if (c.mes !== mesSel) return;
        if (locSel !== "TODOS" && c.local !== locSel) return;

        totalN++;
        const isEnviado = c.status === "Enviado ao CSC";
        
        if (isEnviado) { 
            pg += c.valor; 
            envN++; 
        } else { 
            pnd += c.valor; 
        }

        const tr = document.createElement('tr');
        tr.className = isEnviado ? "row-enviado" : "row-pendente";
        tr.style.opacity = isEnviado ? "0.4" : "1";
        
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
                    <option value="BOLETO" ${c.pagamento === 'BOLETO' ? 'selected' : ''}>BOLETO</option>
                    <option value="DEPOSITO" ${c.pagamento === 'DEPOSITO' ? 'selected' : ''}>DEPOSITO</option>
                </select>
            </td>
            <td style="font-weight:bold; color:${isEnviado ? '#10b981' : '#ef4444'}">${c.status}</td>
            <td>
                <button onclick="window.abrirTratar('${id}')" class="btn-lancar" style="padding:4px 8px; font-size:10px">ENVIAR</button>
                <button onclick="window.del('${id}')" style="color:#ef4444; border:none; background:none; cursor:pointer; margin-left:8px"><i class="fas fa-trash"></i></button>
            </td>
        `;

        if (c.tipo === "SERVICO") {
            tServ.appendChild(tr);
        } else {
            tProd.appendChild(tr);
        }
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
        if(!c) return;
        const vF = c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const pgto = c.pagamento || "BOLETO";
        const texto = `Bom dia!\n\nSegue Para Lançamento:\n\n${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFornecedor} - ${c.fornecedor} - Valor: R$ ${vF} - C/C: ${c.cc} - Venc.: ${c.vencimento}\n\nPagamento via: ${pgto}.`;
        
        document.getElementById('modalPreview').innerText = texto;
        document.getElementById('modalTratar').style.display = 'flex';
        
        const btn = document.getElementById('btnAcaoPrincipal');
        btn.innerText = c.tipo === "PRODUTO" ? "COPIAR TEXTO" : "ENVIAR AO CSC";
        
        btn.onclick = () => {
            if (c.tipo === "SERVICO") {
                const assunto = `Enc. ${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFornecedor} - ${c.fornecedor} - Valor: R$ ${vF}`;
                window.location.href = `mailto:servicos@vaccinar.com.br?cc=nfe.ti@vaccinar.com.br;contasapagar@vaccinar.com.br&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
            } else {
                navigator.clipboard.writeText(texto);
                alert("Copiado!");
            }
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            document.getElementById('modalTratar').style.display = 'none';
        };
    }, { onlyOnce: true });
};

window.del = (id) => { if(confirm("Excluir nota?")) remove(ref(db, `contas/${id}`)); };
function refresh() { onValue(contasRef, (s) => renderizar(s.val()), { onlyOnce: true }); }
