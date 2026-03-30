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

function iniciarSistema() {
    const btnImp = document.getElementById('btnImportarJSON');
    const inputImp = document.getElementById('inputImportarJSON');
    
    btnImp.onclick = () => inputImp.click();
    inputImp.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dados = JSON.parse(ev.target.result);
            dados.forEach(item => {
                push(contasRef, { ...item, status: "Pendente", timestamp: Date.now() });
            });
            alert("Dados importados!");
        };
        reader.readAsText(file);
    };

    document.getElementById('btnLancar').onclick = () => {
        const vRaw = document.getElementById('valor').value;
        const vNum = parseFloat(vRaw.replace(/\./g, '').replace(',', '.')) || 0;
        const novo = {
            tipo: document.getElementById('tipoInput').value,
            local: document.getElementById('localInput').value,
            mes: document.getElementById('mesFiltro').value,
            pedido: document.getElementById('pedido').value,
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

    // Lógica de Ordenação: Pendentes Primeiro, depois por data
    const idsOrdenados = Object.keys(data).sort((a, b) => {
        const notaA = data[a];
        const notaB = data[b];
        
        // Prioridade de Status: "Pendente" (0) vem antes de "Enviado ao CSC" (1)
        const statusA = notaA.status === "Pendente" ? 0 : 1;
        const statusB = notaB.status === "Pendente" ? 0 : 1;
        
        if (statusA !== statusB) return statusA - statusB;
        
        // Critério secundário: Mais recentes no topo
        return (notaB.timestamp || 0) - (notaA.timestamp || 0);
    });

    idsOrdenados.forEach(id => {
        const c = data[id];
        if (c.mes !== mesSel) return;
        if (locSel !== "TODOS" && c.local !== locSel) return;

        totalN++;
        if (c.status === "Enviado ao CSC") { pg += c.valor; envN++; } else { pnd += c.valor; }

        const tr = document.createElement('tr');
        tr.style.opacity = c.status === "Enviado ao CSC" ? "0.4" : "1";
        tr.innerHTML = `
            <td style="color:#10b981; font-weight:bold">${c.local}</td>
            <td contenteditable="true" onblur="window.edit('${id}', 'pedido', this.innerText)" class="editavel">${c.pedido}</td>
            <td><strong>${c.codFornecedor} - ${c.fornecedor}</strong></td>
            <td contenteditable="true" onblur="window.edit('${id}', 'valor', this.innerText)" class="editavel">R$ ${c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="color:#6b7280">${c.cc}</td>
            <td contenteditable="true" onblur="window.edit('${id}', 'vencimento', this.innerText)" class="editavel">${c.vencimento}</td>
            <td style="font-weight:bold; color:${c.status==='Pendente'?'#ef4444':'#10b981'}">${c.status}</td>
            <td>
                <button onclick="window.abrirTratar('${id}')" class="btn-lancar" style="padding:6px 12px; font-size:11px">ENVIAR</button>
                <button onclick="window.del('${id}')" style="color:#ef4444; background:none; border:none; cursor:pointer; margin-left:12px; font-weight:bold">X</button>
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