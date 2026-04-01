import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-mBgupzksWj93Jpu1itwBKky27Rzi-wU",
  authDomain: "erp-green-tech.firebaseapp.com",
  databaseURL: "https://erp-green-tech-default-rtdb.firebaseio.com",
  projectId: "erp-green-tech",
  appId: "1:147246687989:web:717ac874b7e485a76f47bc"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const contasRef = ref(db, 'contas');

onAuthStateChanged(auth, (user) => { if (user) iniciar(); });

function iniciar() {
    document.getElementById('mesFiltro').value = "04";
    
    // Cadastro Manual
    document.getElementById('btnLancar').onclick = () => {
        const vRaw = document.getElementById('valor').value;
        const vNum = parseFloat(vRaw.replace(/\./g, '').replace(',', '.')) || 0;
        
        lancarNoBanco({
            tipo: document.getElementById('tipoInput').value,
            local: document.getElementById('localInput').value,
            mes: document.getElementById('mesFiltro').value,
            pedido: document.getElementById('pedido').value,
            codFornecedor: document.getElementById('codFornecedor').value,
            fornecedor: document.getElementById('fornecedor').value.toUpperCase(),
            valor: vNum,
            centroCusto: document.getElementById('centroCusto').value,
            vencimento: document.getElementById('vencimento').value,
            pagamento: document.getElementById('pagamentoInput').value,
            status: "Pendente",
            timestamp: Date.now()
        });
    };

    // Lógica de Importação CSV
    document.getElementById('csvInput').onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const lines = event.target.result.split('\n');
            lines.forEach((line, index) => {
                if (index === 0 || line.trim() === "") return;
                const cols = line.split(';'); // Certifique-se que o CSV usa ponto e vírgula
                lancarNoBanco({
                    local: cols[0]?.trim(),
                    pedido: cols[1]?.trim(),
                    codFornecedor: cols[2]?.trim(),
                    fornecedor: cols[3]?.trim().toUpperCase(),
                    valor: parseFloat(cols[4]?.replace(',', '.')),
                    centroCusto: cols[5]?.trim(),
                    vencimento: cols[6]?.trim(),
                    tipo: "SERVICO", // Padrão importação
                    pagamento: "BOLETO",
                    status: "Pendente",
                    mes: document.getElementById('mesFiltro').value,
                    timestamp: Date.now()
                });
            });
        };
        reader.readAsText(e.target.files[0]);
    };

    onValue(contasRef, (snap) => render(snap.val()));
    document.getElementById('mesFiltro').onchange = () => get(contasRef).then(s => render(s.val()));
    document.getElementById('filtroLocal').onchange = () => get(contasRef).then(s => render(s.val()));
}

function lancarNoBanco(obj) {
    push(contasRef, obj).then(() => {
        ["pedido", "codFornecedor", "fornecedor", "valor", "centroCusto", "vencimento"].forEach(id => {
            if(document.getElementById(id)) document.getElementById(id).value = "";
        });
    });
}

function render(data) {
    const tProd = document.getElementById('tabelaProduto');
    const tServ = document.getElementById('tabelaServico');
    const mesSel = document.getElementById('mesFiltro').value;
    const localSel = document.getElementById('filtroLocal').value;
    
    tProd.innerHTML = ""; tServ.innerHTML = "";
    let pnd = 0, pg = 0, totalN = 0, envN = 0;
    if (!data) return;

    const itens = Object.keys(data).map(id => ({ id, ...data[id] }))
        .filter(c => c.mes === mesSel && (localSel === "TODOS" || c.local === localSel))
        .sort((a, b) => b.timestamp - a.timestamp);

    itens.forEach(c => {
        totalN++;
        const enviado = c.status === "Enviado ao CSC";
        enviado ? (pg += c.valor, envN++) : pnd += c.valor;

        const tr = document.createElement('tr');
        if (enviado) tr.classList.add('row-enviada');

        tr.innerHTML = `
            <td style="color:var(--green); font-weight:bold">${c.local}</td>
            <td class="editable" onclick="window.editarCampo('${c.id}', 'pedido', '${c.pedido}')">${c.pedido}</td>
            <td>${c.codFornecedor}</td>
            <td>${c.fornecedor}</td>
            <td class="editable" onclick="window.editarCampo('${c.id}', 'valor', '${c.valor}')">R$ ${c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td class="editable" onclick="window.editarCampo('${c.id}', 'centroCusto', '${c.centroCusto}')">${c.centroCusto || '-'}</td>
            <td class="editable" onclick="window.editarCampo('${c.id}', 'vencimento', '${c.vencimento}')">${c.vencimento}</td>
            <td style="font-size:11px; color:#9ca3af">${c.pagamento}</td>
            <td style="color:${enviado ? 'var(--green)' : 'var(--red)'}">${c.status}</td>
            <td>
                <button onclick="window.tratar('${c.id}')" class="btn-primary">ENVIAR</button>
                <button onclick="window.remover('${c.id}')" class="btn-sair"><i class="fas fa-trash"></i></button>
            </td>
        `;
        c.tipo === "PRODUTO" ? tProd.appendChild(tr) : tServ.appendChild(tr);
    });

    document.getElementById('progressoNotas').innerText = `${envN} / ${totalN}`;
    document.getElementById('totalPendente').innerText = "R$ " + pnd.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalPago').innerText = "R$ " + pg.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalGeral').innerText = "R$ " + (pnd+pg).toLocaleString('pt-BR',{minimumFractionDigits:2});
}

// EDIÇÃO UNIVERSAL
window.editarCampo = (id, campo, valorAtual) => {
    const novoValor = prompt(`Editar ${campo.toUpperCase()}:`, valorAtual);
    if (novoValor !== null && novoValor.trim() !== "") {
        let val = novoValor;
        if (campo === 'valor') val = parseFloat(novoValor.replace(/\./g, '').replace(',', '.'));
        update(ref(db, `contas/${id}`), { [campo]: val });
    }
};

window.tratar = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const texto = `Bom dia!\n\nSegue Para Lançamento:\n\n${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFornecedor} - ${c.fornecedor} - Valor: R$ ${c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})} - C/C: ${c.centroCusto} - Venc.: ${c.vencimento}\n\nPagamento via: ${c.pagamento}.`;
        
        document.getElementById('modalPreview').innerText = texto;
        document.getElementById('modalTratar').style.display = 'flex';
        
        document.getElementById('btnAcaoPrincipal').onclick = () => {
            navigator.clipboard.writeText(texto);
            window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`);
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            fecharModal();
        };

        document.getElementById('btnEnviarEmail').onclick = () => {
            const subject = encodeURIComponent(`Lançamento Financeiro - ${c.fornecedor}`);
            window.location.href = `mailto:financeiro@exemplo.com?subject=${subject}&body=${encodeURIComponent(texto)}`;
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            fecharModal();
        };

        document.getElementById('btnApenasMarcar').onclick = () => {
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            fecharModal();
        };
    });
};

window.remover = (id) => { if(confirm("Excluir definitivamente?")) remove(ref(db, `contas/${id}`)); };
