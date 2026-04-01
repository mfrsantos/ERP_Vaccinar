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

// --- SEGURANÇA ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('appContent').style.display = 'block';
        carregarDados();
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('appContent').style.display = 'none';
    }
});

document.getElementById('btnLogin').onclick = () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    signInWithEmailAndPassword(auth, email, pass).catch(() => {
        document.getElementById('loginError').innerText = "Falha no login.";
        document.getElementById('loginError').style.display = 'block';
    });
};

document.getElementById('btnLogout').onclick = () => signOut(auth);

// --- IMPORTAÇÃO CSV (Otimizada para o seu arquivo) ---
document.getElementById('csvInput').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const content = event.target.result;
        // Deteta se o separador é ; ou ,
        const separador = content.includes(';') ? ';' : ',';
        const lines = content.split(/\r?\n/);
        let contador = 0;

        lines.forEach((line, index) => {
            if (index === 0 || line.trim() === "") return;
            
            const cols = line.split(separador);
            if (cols.length < 5) return;

            // Tratamento de valor numérico: remove moeda e converte vírgula em ponto
            let valorTexto = cols[4]?.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.').trim();
            let valorFinal = parseFloat(valorTexto) || 0;

            push(contasRef, {
                local: cols[0]?.trim().toUpperCase() || "MATRIZ",
                pedido: cols[1]?.trim() || "0",
                codFornecedor: cols[2]?.trim() || "0",
                fornecedor: cols[3]?.trim().toUpperCase() || "NOME NÃO INFORMADO",
                valor: valorFinal,
                centroCusto: cols[5]?.trim() || "S/CC",
                vencimento: cols[6]?.trim() || "",
                tipo: "SERVICO",
                pagamento: "BOLETO",
                status: "Pendente",
                mes: document.getElementById('mesFiltro').value,
                timestamp: Date.now() + index
            });
            contador++;
        });
        alert(`✅ ${contador} lançamentos importados!`);
        e.target.value = "";
    };
    reader.readAsText(file, 'ISO-8859-1'); // Garante caracteres brasileiros (ç, ã)
};

function carregarDados() {
    onValue(contasRef, (snap) => {
        const data = snap.val();
        const tProd = document.getElementById('tabelaProduto');
        const tServ = document.getElementById('tabelaServico');
        const mesSel = document.getElementById('mesFiltro').value;
        const localSel = document.getElementById('filtroLocal').value;

        tProd.innerHTML = ""; tServ.innerHTML = "";
        let pnd = 0, pg = 0, totalN = 0, envN = 0;

        if (!data) return atualizarResumo(0,0,0,0);

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
                <td><span class="editable" data-id="${id}" data-campo="centroCusto">${c.centroCusto}</span></td>
                <td><span class="editable" data-id="${id}" data-campo="vencimento">${c.vencimento}</span></td>
                <td>${c.pagamento}</td>
                <td style="color:${enviado ? 'var(--green)' : 'var(--red)'}">${c.status}</td>
                <td>
                    <button onclick="window.tratar('${id}')" class="btn-primary"><i class="fas fa-paper-plane"></i></button>
                    <button onclick="window.remover('${id}')" class="btn-sair-top" style="padding: 5px 8px;"><i class="fas fa-trash"></i></button>
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
            const val = this.innerText.replace('R$ ', '').trim();
            const input = document.createElement('input');
            input.className = 'inline-edit';
            input.value = val;
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

// Lançamento Manual
document.getElementById('btnLancar').onclick = () => {
    const vNum = parseFloat(document.getElementById('valor').value.replace(/\./g, '').replace(',', '.')) || 0;
    push(contasRef, {
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
    }).then(() => {
        ["pedido", "codFornecedor", "fornecedor", "valor", "centroCusto", "vencimento"].forEach(i => document.getElementById(i).value = "");
    });
};

window.tratar = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const vF = c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2});
        const corpo = `Bom dia!\nSegue Para Lançamento:\n\n${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFornecedor} - ${c.fornecedor} - Valor: R$ ${vF} - ${c.centroCusto} - Venc.: ${c.vencimento}\nPagamento via: ${c.pagamento}.`;
        
        document.getElementById('modalPreview').innerText = corpo;
        const btnP = document.getElementById('btnAcaoPrincipal');
        const btnE = document.getElementById('btnEnviarEmail');
        document.getElementById('modalTratar').style.display = 'flex';

        btnP.onclick = () => {
            navigator.clipboard.writeText(corpo);
            if(c.tipo !== "PRODUTO") window.open(`https://wa.me/?text=${encodeURIComponent(corpo)}`);
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            fecharModal();
        };

        btnP.innerHTML = c.tipo === "PRODUTO" ? `<i class="fas fa-copy"></i> COPIAR E MARCAR` : `<i class="fab fa-whatsapp"></i> WHATSAPP`;
        btnE.style.display = c.tipo === "PRODUTO" ? "none" : "block";
        
        btnE.onclick = () => {
            const mailto = `mailto:servicos@vaccinar.com.br?cc=nfe.ti@vaccinar.com.br;contasapagar@vaccinar.com.br&subject=Lançamento ${c.fornecedor}&body=${encodeURIComponent(corpo)}`;
            window.location.href = mailto;
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            fecharModal();
        };

        document.getElementById('btnApenasMarcar').onclick = () => {
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            fecharModal();
        };
    });
};

window.remover = (id) => { if(confirm("Excluir lançamento?")) remove(ref(db, `contas/${id}`)); };
