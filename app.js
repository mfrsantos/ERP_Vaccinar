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

// --- CONTROLO DE ACESSO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('appContent').style.display = 'block';
        carregarSistema();
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('appContent').style.display = 'none';
    }
});

document.getElementById('btnLogin').onclick = () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    signInWithEmailAndPassword(auth, email, pass).catch(() => {
        document.getElementById('loginError').innerText = "Acesso Negado.";
        document.getElementById('loginError').style.display = 'block';
    });
};

document.getElementById('btnLogout').onclick = () => signOut(auth);

function carregarSistema() {
    // --- IMPORTAÇÃO CSV (Sincronizada com o Script de Extração) ---
    document.getElementById('csvInput').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const lines = event.target.result.split(/\r?\n/);
            const mesAtual = document.getElementById('mesFiltro').value;
            let contador = 0;

            lines.forEach((line, index) => {
                if (index === 0 || !line.trim()) return;
                const cols = line.split(';');
                
                // Validação mínima para garantir que a linha tem dados
                if (cols.length >= 5) {
                    let vTexto = cols[4].trim().replace(/[^0-9.]/g, ''); 
                    let valorFinal = parseFloat(vTexto) || 0;

                    push(contasRef, {
                        local: cols[0].trim() || "MATRIZ",
                        pedido: cols[1].trim() || "0",
                        codFornecedor: cols[2].trim() || "0",
                        fornecedor: cols[3].trim().toUpperCase() || "N/A",
                        valor: valorFinal,
                        centroCusto: cols[5] ? cols[5].trim() : "S/CC",
                        vencimento: "", // Campo vazio para preencher no ERP
                        tipo: "SERVICO",
                        pagamento: "BOLETO",
                        status: "Pendente",
                        mes: mesAtual,
                        timestamp: Date.now() + index
                    });
                    contador++;
                }
            });
            alert(`✅ ${contador} notas importadas com sucesso!`);
            e.target.value = "";
        };
        reader.readAsText(file, 'ISO-8859-1');
    };

    // --- RENDERIZAÇÃO E ORDENAÇÃO ---
    onValue(contasRef, (snap) => {
        const data = snap.val();
        const tProd = document.getElementById('tabelaProduto');
        const tServ = document.getElementById('tabelaServico');
        const mesSel = document.getElementById('mesFiltro').value;
        const localSel = document.getElementById('filtroLocal').value;

        tProd.innerHTML = ""; tServ.innerHTML = "";
        let pnd = 0, pg = 0, totalN = 0, envN = 0;

        if (!data) { atualizarResumo(0,0,0,0); return; }

        // Lógica de Ordenação: Pendentes no topo
        const listaOrdenada = Object.keys(data).map(id => ({id, ...data[id]}))
            .sort((a, b) => {
                if (a.status === "Pendente" && b.status !== "Pendente") return -1;
                if (a.status !== "Pendente" && b.status === "Pendente") return 1;
                return b.timestamp - a.timestamp;
            });

        listaOrdenada.forEach(item => {
            if (item.mes !== mesSel || (localSel !== "TODOS" && item.local !== localSel)) return;

            totalN++;
            const enviado = item.status === "Enviado ao CSC";
            enviado ? (pg += item.valor, envN++) : pnd += item.valor;

            const tr = document.createElement('tr');
            if (enviado) tr.classList.add('row-enviada');

            tr.innerHTML = `
                <td style="color:var(--green); font-weight:bold">${item.local}</td>
                <td><span class="editable" data-id="${item.id}" data-campo="pedido">${item.pedido}</span></td>
                <td>${item.codFornecedor}</td>
                <td>${item.fornecedor}</td>
                <td><span class="editable" data-id="${item.id}" data-campo="valor">R$ ${item.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span></td>
                <td>${item.centroCusto}</td>
                <td><span class="editable" data-id="${item.id}" data-campo="vencimento">${item.vencimento || "---"}</span></td>
                <td>${item.pagamento}</td>
                <td style="color:${enviado ? 'var(--green)' : 'var(--red)'}; font-weight:bold">${item.status}</td>
                <td style="text-align: center; display: flex; gap: 5px; justify-content: center;">
                    <button onclick="window.tratar('${item.id}')" class="btn-tabela btn-primary-alt"><i class="fas fa-paper-plane"></i></button>
                    <button onclick="window.remover('${item.id}')" class="btn-tabela btn-danger-alt"><i class="fas fa-trash"></i></button>
                </td>
            `;
            item.tipo === "PRODUTO" ? tProd.appendChild(tr) : tServ.appendChild(tr);
        });
        atualizarResumo(envN, totalN, pnd, pg);
        ativarEdicao();
    });
}

function atualizarResumo(envN, totalN, pnd, pg) {
    document.getElementById('progressoNotas').innerText = `${envN} / ${totalN}`;
    document.getElementById('totalPendente').innerText = "R$ " + pnd.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalPago').innerText = "R$ " + pg.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalGeral').innerText = "R$ " + (pnd+pg).toLocaleString('pt-BR',{minimumFractionDigits:2});
}

function ativarEdicao() {
    document.querySelectorAll('.editable').forEach(el => {
        el.onclick = function() {
            if (this.querySelector('input')) return;
            const id = this.getAttribute('data-id');
            const campo = this.getAttribute('data-campo');
            let valOriginal = this.innerText.replace('R$ ', '').trim();
            if (valOriginal === "---") valOriginal = "";
            
            const input = document.createElement('input');
            input.className = 'inline-edit';
            input.value = valOriginal;
            input.onblur = () => {
                let nVal = input.value;
                if (campo === 'valor') nVal = parseFloat(nVal.replace(/\./g, '').replace(',', '.')) || 0;
                update(ref(db, `contas/${id}`), { [campo]: nVal });
            };
            input.onkeydown = (e) => { if(e.key==='Enter') input.blur(); };
            this.innerText = ""; this.appendChild(input); input.focus();
        };
    });
}

window.tratar = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const vF = c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2});
        const corpo = `Bom dia!\nSegue Para Lançamento:\n\n${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFornecedor} - ${c.fornecedor} - Valor: R$ ${vF} - ${c.centroCusto} - Venc.: ${c.vencimento}\nPagamento via: ${c.pagamento}.`;
        
        document.getElementById('modalPreview').innerText = corpo;
        const btnEmail = document.getElementById('btnEnviarEmail');
        const btnCopiar = document.getElementById('btnCopiarMarcar');
        
        document.getElementById('modalTratar').style.display = 'flex';

        if (c.tipo === "PRODUTO") {
            btnEmail.style.display = "none";
            btnCopiar.style.display = "block";
        } else {
            btnEmail.style.display = "block";
            btnCopiar.style.display = "none";
        }

        btnEmail.onclick = () => {
            const subject = `Lançamento - ${c.fornecedor} - Pedido ${c.pedido}`;
            const mailto = `mailto:servicos@vaccinar.com.br?cc=nfe.ti@vaccinar.com.br;contasapagar@vaccinar.com.br&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(corpo)}`;
            window.open(mailto, '_blank');
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            document.getElementById('modalTratar').style.display='none';
        };

        btnCopiar.onclick = () => {
            navigator.clipboard.writeText(corpo);
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            alert("Copiado!");
            document.getElementById('modalTratar').style.display='none';
        };

        document.getElementById('btnApenasMarcar').onclick = () => {
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            document.getElementById('modalTratar').style.display='none';
        };
    });
};

window.remover = (id) => { if(confirm("Apagar?")) remove(ref(db, `contas/${id}`)); };

document.getElementById('btnLancar').onclick = () => {
    const vNum = parseFloat(document.getElementById('valor').value.replace(/\./g, '').replace(',', '.')) || 0;
    push(contasRef, {
        local: document.getElementById('localInput').value,
        pedido: document.getElementById('pedido').value,
        codFornecedor: document.getElementById('codFornecedor').value,
        fornecedor: document.getElementById('fornecedor').value.toUpperCase(),
        valor: vNum,
        centroCusto: document.getElementById('centroCusto').value,
        vencimento: document.getElementById('vencimento').value,
        pagamento: document.getElementById('pagamentoInput').value,
        tipo: document.getElementById('tipoInput').value,
        mes: document.getElementById('mesFiltro').value,
        status: "Pendente",
        timestamp: Date.now()
    }).then(() => {
        ["pedido", "codFornecedor", "fornecedor", "valor", "centroCusto", "vencimento"].forEach(i => document.getElementById(i).value = "");
    });
};
