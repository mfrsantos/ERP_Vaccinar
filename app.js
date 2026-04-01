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
    if (user) iniciarSistema();
});

// Funções de Inicialização
function iniciarSistema() {
    const selectMes = document.getElementById('mesFiltro');
    
    // Define Mês Atual (Abertura automática)
    const mesVigente = String(new Date().getMonth() + 1).padStart(2, '0');
    selectMes.value = mesVigente;

    // Listener de Lançamento
    document.getElementById('btnLancar').onclick = async () => {
        const vRaw = document.getElementById('valor').value;
        const vNum = parseFloat(vRaw.replace(/\./g, '').replace(',', '.')) || 0;
        
        const novo = {
            tipo: document.getElementById('tipoInput').value,
            local: document.getElementById('localInput').value,
            mes: selectMes.value,
            pedido: document.getElementById('pedido').value,
            fornecedor: document.getElementById('fornecedor').value.toUpperCase(),
            valor: vNum,
            vencimento: document.getElementById('vencimento').value,
            pagamento: "BOLETO",
            status: "Pendente",
            timestamp: Date.now()
        };

        push(contasRef, novo).then(() => {
            ["pedido", "fornecedor", "valor", "vencimento"].forEach(id => document.getElementById(id).value = "");
        });
    };

    onValue(contasRef, (snap) => renderizar(snap.val()));
    selectMes.onchange = () => refresh();
    document.getElementById('filtroLocal').onchange = () => refresh();
}

function renderizar(data) {
    const tServ = document.getElementById('tabelaServico');
    const tProd = document.getElementById('tabelaProduto');
    const mesSel = document.getElementById('mesFiltro').value;
    const locSel = document.getElementById('filtroLocal').value;
    
    tServ.innerHTML = ""; tProd.innerHTML = "";
    if (!data) return;

    let pnd = 0, pg = 0, totalN = 0, envN = 0;

    // Ordenação: Pendentes no topo
    const ids = Object.keys(data).sort((a, b) => {
        const sA = data[a].status === "Pendente" ? 0 : 1;
        const sB = data[b].status === "Pendente" ? 0 : 1;
        if (sA !== sB) return sA - sB;
        return (data[b].timestamp || 0) - (data[a].timestamp || 0);
    });

    ids.forEach(id => {
        const c = data[id];
        if (c.mes !== mesSel || (locSel !== "TODOS" && c.local !== locSel)) return;

        totalN++;
        const isEnviado = c.status === "Enviado ao CSC";
        isEnviado ? (pg += c.valor, envN++) : pnd += c.valor;

        const tr = document.createElement('tr');
        if (isEnviado) tr.style.opacity = "0.5";

        tr.innerHTML = `
            <td style="color:var(--green-main); font-weight:600">${c.local}</td>
            <td>${c.pedido}</td>
            <td style="font-weight:600">${c.fornecedor}</td>
            <td>R$ ${c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td>${c.vencimento}</td>
            <td style="color:${isEnviado ? 'var(--green-main)' : 'var(--red-main)'}">${c.status}</td>
            <td>
                <button onclick="window.abrirTratar('${id}')" class="btn-lancar" style="padding:5px 10px; font-size:10px">ENVIAR</button>
                <button onclick="window.del('${id}')" style="color:var(--red-main); background:none; border:none; cursor:pointer; margin-left:10px"><i class="fas fa-trash"></i></button>
            </td>
        `;
        c.tipo === "SERVICO" ? tServ.appendChild(tr) : tProd.appendChild(tr);
    });

    // Atualiza Resumo
    document.getElementById('progressoNotas').innerText = `${envN} / ${totalN}`;
    document.getElementById('totalPendente').innerText = "R$ " + pnd.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalPago').innerText = "R$ " + pg.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalGeral').innerText = "R$ " + (pnd+pg).toLocaleString('pt-BR',{minimumFractionDigits:2});
}

window.abrirTratar = (id) => {
    get(ref(db, `contas/${id}`)).then((s) => {
        const c = s.val();
        const vF = c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const texto = `Bom dia!\n\nSegue Para Lançamento:\n\n${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.fornecedor} - Valor: R$ ${vF} - Venc.: ${c.vencimento}\n\nPagamento via: Boleto.`;
        
        document.getElementById('modalPreview').innerText = texto;
        document.getElementById('modalTratar').style.display = 'flex';
        
        document.getElementById('btnAcaoPrincipal').onclick = () => {
            if (c.tipo === "SERVICO") {
                const assunto = `Enc. ${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.fornecedor}`;
                window.location.href = `mailto:servicos@vaccinar.com.br?cc=nfe.ti@vaccinar.com.br&subject=${Assunto(assunto)}&body=${encodeURIComponent(texto)}`;
            } else {
                navigator.clipboard.writeText(texto);
                alert("Copiado!");
            }
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            fecharModal();
        };

        document.getElementById('btnApenasMarcar').onclick = () => {
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            fecharModal();
        };
    });
};

window.del = (id) => { if(confirm("Excluir?")) remove(ref(db, `contas/${id}`)); };
function refresh() { get(contasRef).then(s => renderizar(s.val())); }
function fecharModal() { document.getElementById('modalTratar').style.display = 'none'; }
function Assunto(assunto) { return encodeURIComponent(assunto); }
