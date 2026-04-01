import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-mBgupzksWj93Jpu1itwBKky27Rzi-wU",
  authDomain: "erp-green-tech.firebaseapp.com",
  databaseURL: "https://erp-green-tech-default-rtdb.firebaseio.com",
  projectId: "erp-green-tech",
  appId: "1:147246687989:web:717ac874b7e485a76f47bc"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const contasRef = ref(db, 'contas');

// --- FUNÇÃO DE LIMPEZA DE VALOR ---
function limparMoeda(valorStr) {
    if (!valorStr) return 0;
    // Remove "R$", espaços e pontos de milhar, troca vírgula por ponto
    let limpo = valorStr.replace(/R\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(limpo) || 0;
}

// --- 1. IMPORTAÇÃO CSV ULTRA-ROBUSTA ---
document.getElementById('csvInput').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const content = event.target.result;
        // Detecta se o CSV usa ; ou ,
        const separador = content.includes(';') ? ';' : ',';
        const lines = content.split(/\r?\n/);
        let contador = 0;

        lines.forEach((line, index) => {
            if (index === 0 || line.trim() === "") return; // Pula cabeçalho
            
            const cols = line.split(separador);
            if (cols.length < 5) return; // Linha inválida

            // Mapeamento baseado na sua estrutura confirmada:
            // 0:Filial, 1:Pedido, 2:CodForn, 3:Forn, 4:Valor, 5:CC, 6:Venc
            const novoLancamento = {
                local: cols[0]?.trim().toUpperCase() || "N/A",
                pedido: cols[1]?.trim() || "0",
                codFornecedor: cols[2]?.trim() || "0",
                fornecedor: cols[3]?.trim().toUpperCase() || "DESCONHECIDO",
                valor: limparMoeda(cols[4]),
                centroCusto: cols[5]?.trim() || "N/A",
                vencimento: cols[6]?.trim() || "",
                tipo: "SERVICO",
                pagamento: "BOLETO",
                status: "Pendente",
                mes: document.getElementById('mesFiltro').value,
                timestamp: Date.now() + index
            };

            push(contasRef, novoLancamento);
            contador++;
        });

        alert(`✅ Sucesso! ${contador} itens importados para o mês ${document.getElementById('mesFiltro').value}.`);
        e.target.value = ""; 
    };
    reader.readAsText(file, 'ISO-8859-1'); // Trata acentos do Excel Brasil
};

// --- 2. RENDERIZAÇÃO ---
onValue(contasRef, (snap) => {
    const data = snap.val();
    const tProd = document.getElementById('tabelaProduto');
    const tServ = document.getElementById('tabelaServico');
    const mesSel = document.getElementById('mesFiltro').value;
    const localSel = document.getElementById('filtroLocal').value;
    
    tProd.innerHTML = ""; tServ.innerHTML = "";
    let pnd = 0, pg = 0, totalN = 0, envN = 0;
    
    if (!data) {
        atualizarResumo(0, 0, 0, 0);
        return;
    }

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
            <td style="font-size:11px; color:#9ca3af">${c.pagamento}</td>
            <td style="color:${enviado ? 'var(--green)' : 'var(--red)'}">${c.status}</td>
            <td>
                <button onclick="window.tratar('${id}')" class="btn-primary">ENVIAR</button>
                <button onclick="window.remover('${id}')" class="btn-sair"><i class="fas fa-trash"></i></button>
            </td>
        `;
        c.tipo === "PRODUTO" ? tProd.appendChild(tr) : tServ.appendChild(tr);
    });

    atualizarResumo(envN, totalN, pnd, pg);

    // Ativação da edição direta
    document.querySelectorAll('.editable').forEach(el => {
        el.onclick = function() {
            if (this.querySelector('input')) return;
            const id = this.getAttribute('data-id');
            const campo = this.getAttribute('data-campo');
            let valOriginal = this.innerText.replace('R$ ', '').trim();

            const input = document.createElement('input');
            input.value = valOriginal;
            input.className = 'inline-edit';
            
            input.onblur = () => {
                let novoVal = input.value;
                if (campo === 'valor') novoVal = limparMoeda(novoVal);
                if (novoVal != valOriginal) update(ref(db, `contas/${id}`), { [campo]: novoVal });
                this.innerText = campo === 'valor' ? `R$ ${parseFloat(novoVal).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : novoVal;
            };
            input.onkeydown = (ev) => { if(ev.key === 'Enter') input.blur(); };
            this.innerText = ""; this.appendChild(input); input.focus();
        };
    });
});

function atualizarResumo(envN, totalN, pnd, pg) {
    document.getElementById('progressoNotas').innerText = `${envN} / ${totalN}`;
    document.getElementById('totalPendente').innerText = "R$ " + pnd.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalPago').innerText = "R$ " + pg.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalGeral').innerText = "R$ " + (pnd+pg).toLocaleString('pt-BR',{minimumFractionDigits:2});
}

// --- 3. LANÇAMENTO MANUAL ---
document.getElementById('btnLancar').onclick = () => {
    const vNum = limparMoeda(document.getElementById('valor').value);
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

// --- 4. MODAL E ENVIO ---
window.tratar = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const vF = c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2});
        const corpo = `Bom dia!\nSegue Para Lançamento:\n\n${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFornecedor} - ${c.fornecedor} - Valor: R$ ${vF} - ${c.centroCusto} - Venc.: ${c.vencimento}\nPagamento via: ${c.pagamento}.`;
        
        document.getElementById('modalPreview').innerText = corpo;
        const btnP = document.getElementById('btnAcaoPrincipal');
        const btnE = document.getElementById('btnEnviarEmail');
        document.getElementById('modalTratar').style.display = 'flex';

        if (c.tipo === "PRODUTO") {
            btnP.innerHTML = `<i class="fas fa-copy"></i> COPIAR E MARCAR`;
            btnE.style.display = "none";
            btnP.onclick = () => {
                navigator.clipboard.writeText(corpo);
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
                fecharModal();
            };
        } else {
            btnP.innerHTML = `<i class="fab fa-whatsapp"></i> WHATSAPP`;
            btnE.style.display = "block";
            btnP.onclick = () => {
                navigator.clipboard.writeText(corpo);
                window.open(`https://wa.me/?text=${encodeURIComponent(corpo)}`);
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
                fecharModal();
            };
            btnE.onclick = () => {
                const mailto = `mailto:servicos@vaccinar.com.br?cc=nfe.ti@vaccinar.com.br;contasapagar@vaccinar.com.br&subject=Lançamento ${c.fornecedor}&body=${encodeURIComponent(corpo)}`;
                window.location.href = mailto;
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
                fecharModal();
            };
        }
    });
};

window.remover = (id) => { if(confirm("Excluir?")) remove(ref(db, `contas/${id}`)); };
