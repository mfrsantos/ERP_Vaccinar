import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-mBgupzksWj93Jpu1itwBKky27Rzi-wU",
  authDomain: "erp-green-tech.firebaseapp.com",
  databaseURL: "https://erp-green-tech-default-rtdb.firebaseio.com",
  projectId: "erp-green-tech",
  storageBucket: "erp-green-tech.firebasestorage.app",
  appId: "1:147246687989:web:717ac874b7e485a76f47bc"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const contasRef = ref(db, 'contas');

onAuthStateChanged(auth, (user) => {
    if (!user) { document.getElementById('loginOverlay').style.display = 'flex'; }
    else { iniciar(); }
});

function iniciar() {
    document.getElementById('mesFiltro').value = String(new Date().getMonth() + 1).padStart(2, '0');
    
    document.getElementById('btnLancar').onclick = () => {
        const vRaw = document.getElementById('valor').value;
        const vNum = parseFloat(vRaw.replace(/\./g, '').replace(',', '.')) || 0;
        
        const data = {
            tipo: document.getElementById('tipoInput').value,
            local: document.getElementById('localInput').value,
            mes: document.getElementById('mesFiltro').value,
            pedido: document.getElementById('pedido').value,
            fornecedor: document.getElementById('fornecedor').value.toUpperCase(),
            valor: vNum,
            vencimento: document.getElementById('vencimento').value,
            status: "Pendente",
            timestamp: Date.now()
        };
        push(contasRef, data).then(() => {
            ["pedido", "fornecedor", "valor", "vencimento"].forEach(id => document.getElementById(id).value = "");
        });
    };

    onValue(contasRef, (snap) => render(snap.val()));
}

function render(data) {
    const tProd = document.getElementById('tabelaProduto');
    const tServ = document.getElementById('tabelaServico');
    const mesSel = document.getElementById('mesFiltro').value;
    
    tProd.innerHTML = ""; tServ.innerHTML = "";
    let pnd = 0, pg = 0, totalN = 0, envN = 0;

    if (!data) return;

    Object.keys(data).forEach(id => {
        const c = data[id];
        if (c.mes !== mesSel) return;

        totalN++;
        const enviado = c.status === "Enviado ao CSC";
        enviado ? (pg += c.valor, envN++) : pnd += c.valor;

        const tr = `<tr>
            <td style="color:var(--green); font-weight:bold">${c.local}</td>
            <td>${c.pedido}</td>
            <td style="font-weight:bold">${c.fornecedor}</td>
            <td>R$ ${c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td>${c.vencimento}</td>
            <td style="color:${enviado ? 'var(--green)' : 'var(--red)'}">${c.status}</td>
            <td>
                <button onclick="window.tratar('${id}')" style="background:var(--green); color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer">ENVIAR</button>
                <button onclick="window.remover('${id}')" style="background:none; border:none; color:var(--red); cursor:pointer; margin-left:10px"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
        
        c.tipo === "PRODUTO" ? tProd.innerHTML += tr : tServ.innerHTML += tr;
    });

    document.getElementById('progressoNotas').innerText = `${envN} / ${totalN}`;
    document.getElementById('totalPendente').innerText = "R$ " + pnd.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalPago').innerText = "R$ " + pg.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalGeral').innerText = "R$ " + (pnd+pg).toLocaleString('pt-BR',{minimumFractionDigits:2});
}

window.tratar = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const texto = `Bom dia!\n\nSegue Para Lançamento:\n\n${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.fornecedor} - Valor: R$ ${c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})} - Venc.: ${c.vencimento}`;
        document.getElementById('modalPreview').innerText = texto;
        document.getElementById('modalTratar').style.display = 'flex';
        
        document.getElementById('btnAcaoPrincipal').onclick = () => {
            navigator.clipboard.writeText(texto);
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            fecharModal();
        };
    });
};

window.remover = (id) => { if(confirm("Excluir lançamento?")) remove(ref(db, `contas/${id}`)); };
