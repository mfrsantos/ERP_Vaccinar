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
        document.getElementById('loginError').innerText = "Acesso negado.";
        document.getElementById('loginError').style.display = 'block';
    });
};

document.getElementById('btnLogout').onclick = () => signOut(auth);

function carregarSistema() {
    // --- IMPORTAÇÃO CSV BLINDADA ---
    document.getElementById('csvInput').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const lines = event.target.result.split(/\r?\n/);
            const mesAtual = document.getElementById('mesFiltro').value;
            let contador = 0;

            lines.forEach((line, index) => {
                if (index === 0 || line.trim() === "") return;
                const cols = line.split(';');
                if (cols.length < 5) return;

                // CORREÇÃO CRÍTICA: Limpa tudo que não for número ou ponto
                // Seu CSV: "996.86" -> vTexto: "996.86" -> parseFloat: 996.86
                let vTexto = cols[4]?.trim().replace(/[^0-9.]/g, ''); 
                let valorFinal = parseFloat(vTexto) || 0;

                push(contasRef, {
                    local: cols[0]?.trim() || "MATRIZ",
                    pedido: cols[1]?.trim() || "0",
                    codFornecedor: cols[2]?.trim() || "0",
                    fornecedor: cols[3]?.trim().toUpperCase() || "N/A",
                    valor: valorFinal,
                    centroCusto: cols[5]?.trim() || "S/CC",
                    vencimento: cols[6]?.trim() || "",
                    tipo: "SERVICO",
                    pagamento: "BOLETO",
                    status: "Pendente",
                    mes: mesAtual,
                    timestamp: Date.now() + index
                });
                contador++;
            });
            alert(`✅ ${contador} lançamentos importados corretamente!`);
            e.target.value = "";
        };
        reader.readAsText(file, 'ISO-8859-1');
    };

    onValue(contasRef, (snap) => {
        const data = snap.val();
        const tProd = document.getElementById('tabelaProduto');
        const tServ = document.getElementById('tabelaServico');
        const mesSel = document.getElementById('mesFiltro').value;
        const localSel = document.getElementById('filtroLocal').value;

        tProd.innerHTML = ""; tServ.innerHTML = "";
        let pnd = 0, pg = 0, totalN = 0, envN = 0;

        if (!data) { atualizarResumo(0,0,0,0); return; }

        Object.keys(data).forEach(id => {
            const c = data[id];
            if (c.mes !== mesSel || (localSel !== "TODOS" && c.local !== localSel)) return;

            totalN++;
            const enviado = c.status === "Enviado ao CSC";
            enviado ? (pg += c.valor, envN++) : pnd += c.valor;

            const tr = document.createElement('tr');
            if (enviado) tr.classList.add('row-enviada');

            tr.innerHTML = `
                <td style="color:var(--green); font-weight:bold">${c.local}</td>
                <td><span class="editable" data-id="${id}" data-campo="pedido">${c.pedido}</span></td>
                <td>${c.codFornecedor}</td>
                <td>${c.fornecedor}</td>
                <td><span class="editable" data-id="${id}" data-campo="valor">R$ ${c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span></td>
                <td>${c.centroCusto}</td>
                <td>${c.vencimento}</td>
                <td>${c.pagamento}</td>
                <td style="color:${enviado ? 'var(--green)' : 'var(--red)'}">${c.status}</td>
                <td>
                    <button onclick="window.tratar('${id}')" class="btn-primary"><i class="fas fa-paper-plane"></i></button>
                    <button onclick="window.remover('${id}')" class="btn-sair-top" style="padding: 5px;"><i class="fas fa-trash"></i></button>
                </td>
            `;
            c.tipo === "PRODUTO" ? tProd.appendChild(tr) : tServ.appendChild(tr);
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
            const valOriginal = this.innerText.replace('R$ ', '').trim();
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
        const btnMarcar = document.getElementById('btnApenasMarcar');
        
        document.getElementById('modalTratar').style.display = 'flex';

        btnEmail.style.display = c.tipo === "PRODUTO" ? "none" : "block";

        btnEmail.onclick = () => {
            const subject = `Lançamento - ${c.fornecedor}`;
            const mailto = `mailto:servicos@vaccinar.com.br?cc=nfe.ti@vaccinar.com.br;contasapagar@vaccinar.com.br&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(corpo)}`;
            window.location.href = mailto;
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            document.getElementById('modalTratar').style.display='none';
        };

        btnCopiar.onclick = () => {
            navigator.clipboard.writeText(corpo);
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            alert("Copiado!");
            document.getElementById('modalTratar').style.display='none';
        };

        btnMarcar.onclick = () => {
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            document.getElementById('modalTratar').style.display='none';
        };
    });
};

window.remover = (id) => { if(confirm("Remover?")) remove(ref(db, `contas/${id}`)); };

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
