import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

const fmtMoeda = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const fmtDataBR = (d) => {
    if (!d) return "";
    const partes = d.split('/');
    return partes.length >= 2 ? `${partes[0]}/${partes[1]}` : d;
};

onAuthStateChanged(auth, (user) => {
    document.getElementById('loginOverlay').style.display = user ? 'none' : 'flex';
    document.getElementById('appContent').style.display = user ? 'block' : 'none';
    if (user) carregarDados();
});

function carregarDados() {
    onValue(contasRef, (snap) => {
        const data = snap.val();
        const tServ = document.getElementById('tabelaServico');
        const tProd = document.getElementById('tabelaProduto');
        const mes = document.getElementById('mesFiltro').value;
        const localF = document.getElementById('filtroLocal').value;
        const busca = document.getElementById('inputBusca').value.toLowerCase();

        tServ.innerHTML = ""; tProd.innerHTML = "";
        let pVal = 0, eVal = 0, pCount = 0, eCount = 0;
        if (!data) return;

        const itens = Object.keys(data).map(id => ({ id, ...data[id] }))
            .filter(i => {
                const termo = String(i.pedido + i.fornecedor).toLowerCase();
                const matchLocal = (localF === "TODOS" || i.local === localF);
                return i.mes === mes && matchLocal && termo.includes(busca);
            })
            .sort((a, b) => (a.status === "Enviado ao CSC" ? 1 : -1));

        itens.forEach(item => {
            const isEnv = item.status === "Enviado ao CSC";
            const tr = document.createElement('tr');
            if (isEnv) tr.className = "row-enviada";

            const tdValor = `
                <td style="text-align:right">
                    R$ <input type="text" value="${fmtMoeda(item.valor)}" 
                        class="input-venc" style="width: 95px; text-align: right;"
                        ${isEnv ? 'readonly' : ''}
                        onblur="window.upd('${item.id}', 'valor', parseFloat(this.value.replace(/\\./g, '').replace(',', '.')) || 0);">
                </td>`;

            const statusHTML = `<td><span class="status-badge ${isEnv ? 'status-enviado' : 'status-pendente'}">${item.status}</span></td>`;
            const acoesBase = `<button onclick="window.remover('${item.id}')" class="btn-acao-del"><i class="fas fa-trash"></i></button>`;

            // Colunas idênticas para ambas as tabelas
            const htmlBase = `<td>${item.local}</td><td>${item.pedido}</td><td>${item.fornecedor}</td><td>${item.cc || ''}</td>
                ${tdValor}
                <td><input type="text" value="${fmtDataBR(item.vencimento)}" class="input-venc" style="width:50px" onblur="window.upd('${item.id}', 'vencimento', this.value)"></td>
                <td>${item.pagamento}</td>${statusHTML}`;

            !isEnv ? (pVal += item.valor, pCount++) : (eVal += item.valor, eCount++);

            if (item.tipo === "SERVICO") {
                tr.innerHTML = htmlBase + `<td><button onclick="window.modalServico('${item.id}')" class="btn-acao"><i class="fas fa-paper-plane"></i></button>${acoesBase}</td>`;
                tServ.appendChild(tr);
            } else {
                tr.innerHTML = htmlBase + `<td><button onclick="window.modalProduto('${item.id}')" class="btn-acao"><i class="fas fa-copy"></i></button>${acoesBase}</td>`;
                tProd.appendChild(tr);
            }
        });

        document.getElementById('totalPendente').innerText = "R$ " + fmtMoeda(pVal);
        document.getElementById('totalEnviado').innerText = "R$ " + fmtMoeda(eVal);
        document.getElementById('countPendente').innerText = pCount + " notas";
        document.getElementById('countEnviado').innerText = eCount + " notas";

        document.getElementById('btnAprovacao').onclick = () => {
            const aprovacao = itens.filter(i => i.valor >= 10000 && i.status === "Pendente");
            if(aprovacao.length === 0) { alert("Nenhuma nota acima de 10k pendente."); return; }
            let lista = aprovacao.map(i => `${i.local} - Pedido: ${i.pedido} - Fornecedor: ${i.codFor || ''} ${i.fornecedor} - Valor: ${fmtMoeda(i.valor)} - C/C: ${i.cc || ''} - Venc.: ${fmtDataBR(i.vencimento)}`).join('\n');
            let corpoEmail = `Juliana,tudo bem?\n\nSegue abaixo pedidos aguardando aprovação:\n\n${lista}`;
            window.location.href = `mailto:juliana.lopes@vaccinar.com.br?cc=marcus.tonini@vaccinar.com.br&subject=Pedidos aguardando aprovação.&body=${encodeURIComponent(corpoEmail)}`;
        };
    });
}

// TRATAMENTO SERVIÇO (EMAIL)
window.modalServico = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const vFmt = fmtMoeda(c.valor);
        const dFmt = fmtDataBR(c.vencimento);
        const sub = `Enc. ${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFor || ''} - ${c.fornecedor} - Valor: R$ ${vFmt} - C/C: ${c.cc || ''} - Venc.: ${dFmt}`;
        const corpo = `Bom dia!\nSegue Para Lançamento:\n\n${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFor || ''} - ${c.fornecedor} - Valor: R$ ${vFmt} - C/C: ${c.cc || ''} - Venc.: ${dFmt}\nPagamento via: Boleto.`;
        
        abrirModal("Tratar Serviço", corpo, [
            { txt: "ENVIAR E-MAIL", cl: "btn-primary-modal", fn: () => {
                window.location.href = `mailto:servicos@vaccinar.com.br?cc=nfe.ti@vaccinar.com.br; contasapagar@vaccinar.com.br&subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(corpo)}`;
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" }); fecharModal();
            }},
            { txt: "APENAS MARCAR", cl: "btn-secondary-modal", fn: () => {
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" }); fecharModal();
            }}
        ]);
    });
};

// TRATAMENTO PRODUTO (COPIAR TEXTO IGUAL AO SERVIÇO)
window.modalProduto = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const vFmt = fmtMoeda(c.valor);
        const dFmt = fmtDataBR(c.vencimento);
        const textoParaCopiar = `Bom dia!\nSegue Para Lançamento:\n\n${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFor || ''} - ${c.fornecedor} - Valor: R$ ${vFmt} - C/C: ${c.cc || ''} - Venc.: ${dFmt}\nPagamento via: Boleto.`;
        
        abrirModal("Tratar Produto", textoParaCopiar, [
            { txt: "COPIAR E MARCAR", cl: "btn-primary-modal", fn: () => {
                navigator.clipboard.writeText(textoParaCopiar);
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" }); fecharModal();
                alert("Texto copiado para a área de transferência!");
            }},
            { txt: "APENAS MARCAR", cl: "btn-secondary-modal", fn: () => {
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" }); fecharModal();
            }}
        ]);
    });
};

// IMPORTAÇÃO E SALVAR MANUAL (TRAVA DE DUPLICIDADE)
const csvInput = document.getElementById('csvInput');
if (csvInput) {
    csvInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function(event) {
            try {
                const lines = event.target.result.split('\n');
                const mesAtual = document.getElementById('mesFiltro').value;
                const snapshot = await get(contasRef);
                const existentes = snapshot.exists() ? Object.values(snapshot.val()).map(i => String(i.pedido)) : [];

                let ok = 0; let dup = 0;
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    const cols = line.split(';'); 
                    const numPed = cols[1].trim();
                    if (existentes.includes(numPed)) { dup++; continue; }

                    await push(contasRef, {
                        local: cols[0].trim().toUpperCase(), tipo: "SERVICO", pedido: numPed,
                        codFor: cols[2].trim(), fornecedor: cols[3].trim().toUpperCase(), cc: cols[4].trim(),
                        valor: parseFloat(cols[5].replace('.', '').replace(',', '.')) || 0,
                        vencimento: fmtDataBR(cols[6] ? cols[6].trim() : ""), pagamento: "BOLETO", status: "Pendente", mes: mesAtual
                    });
                    existentes.push(numPed); ok++;
                }
                alert(`IMPORTAÇÃO CONCLUÍDA!\n- Novos: ${ok}\n- Duplicados pulados: ${dup}`);
            } catch (err) { alert("Erro ao processar arquivo."); }
            e.target.value = ""; 
        };
        reader.readAsText(file);
    });
}

document.getElementById('btnSalvarManual').onclick = async () => {
    const ped = document.getElementById('mPedido').value.trim();
    if(!ped) return alert("Informe o pedido");
    const snapshot = await get(contasRef);
    if (snapshot.exists() && Object.values(snapshot.val()).some(i => String(i.pedido) === ped)) {
        return alert("Erro: Pedido já cadastrado!");
    }
    const valRaw = document.getElementById('mValor').value;
    push(contasRef, {
        tipo: document.getElementById('mTipo').value, local: document.getElementById('mLocal').value,
        pedido: ped, codFor: document.getElementById('mCodFor').value,
        fornecedor: document.getElementById('mFornecedor').value.toUpperCase(), cc: document.getElementById('mCC').value,
        valor: parseFloat(valRaw.replace(/\./g, '').replace(',', '.')) || 0,
        vencimento: fmtDataBR(document.getElementById('mVenc').value),
        pagamento: "BOLETO", status: "Pendente", mes: document.getElementById('mesFiltro').value
    });
    alert("Salvo com sucesso!");
};

function abrirModal(t, p, btns) {
    document.getElementById('modalTitle').innerText = t; 
    document.getElementById('modalPreview').innerText = p;
    const c = document.getElementById('modalActions'); c.innerHTML = "";
    btns.forEach(b => {
        const el = document.createElement('button'); el.innerText = b.txt; el.className = `modal-btn ${b.cl}`; el.onclick = b.fn; c.appendChild(el);
    });
    const bc = document.createElement('button'); bc.innerText = "CANCELAR"; bc.className = "modal-btn btn-close-modal"; bc.onclick = fecharModal; c.appendChild(bc);
    document.getElementById('modalApp').style.display = 'flex';
}

function fecharModal() { document.getElementById('modalApp').style.display = 'none'; }
window.upd = (id, campo, valor) => update(ref(db, `contas/${id}`), { [campo]: valor });
window.remover = (id) => { if(confirm("Excluir lançamento?")) remove(ref(db, `contas/${id}`)); };

document.getElementById('mesFiltro').onchange = carregarDados;
document.getElementById('filtroLocal').onchange = carregarDados;
document.getElementById('inputBusca').oninput = carregarDados;
document.getElementById('btnLogin').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value);
document.getElementById('btnLogout').onclick = () => signOut(auth);
