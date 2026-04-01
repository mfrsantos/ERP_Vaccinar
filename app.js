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

// --- IMPORTAÇÃO CSV ---
document.getElementById('csvInput').onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        const lines = event.target.result.split('\n');
        let contador = 0;
        lines.forEach((line, index) => {
            if (index === 0 || line.trim() === "") return;
            const cols = line.split(';');
            if(cols.length < 5) return;

            push(contasRef, {
                local: cols[0]?.trim(),
                pedido: cols[1]?.trim(),
                codFornecedor: cols[2]?.trim(),
                fornecedor: cols[3]?.trim().toUpperCase(),
                valor: parseFloat(cols[4]?.replace(',', '.')) || 0,
                centroCusto: cols[5]?.trim() || "",
                vencimento: cols[6]?.trim() || "",
                tipo: "SERVICO",
                pagamento: "BOLETO",
                status: "Pendente",
                mes: document.getElementById('mesFiltro').value,
                timestamp: Date.now() + index
            });
            contador++;
        });
        alert(`${contador} lançamentos importados com sucesso!`);
        e.target.value = "";
    };
    reader.readAsText(e.target.files[0]);
};

// --- RENDERIZAÇÃO E TOTAIS ---
onValue(contasRef, (snap) => {
    const data = snap.val();
    const tProd = document.getElementById('tabelaProduto');
    const tServ = document.getElementById('tabelaServico');
    const mesSel = document.getElementById('mesFiltro').value;
    const localSel = document.getElementById('filtroLocal').value;
    
    tProd.innerHTML = ""; tServ.innerHTML = "";
    let pnd = 0, pg = 0, totalN = 0, envN = 0;
    if (!data) return;

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
            <td><span class="editable" data-id="${id}" data-campo="centroCusto">${c.centroCusto || '-'}</span></td>
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

    document.getElementById('progressoNotas').innerText = `${envN} / ${totalN}`;
    document.getElementById('totalPendente').innerText = "R$ " + pnd.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalPago').innerText = "R$ " + pg.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('totalGeral').innerText = "R$ " + (pnd+pg).toLocaleString('pt-BR',{minimumFractionDigits:2});

    // Ativar Edição em Linha
    document.querySelectorAll('.editable').forEach(el => {
        el.onclick = function() {
            if (this.querySelector('input')) return;
            const id = this.getAttribute('data-id');
            const campo = this.getAttribute('data-campo');
            let valorAtual = this.innerText.replace('R$ ', '').trim();
            if(valorAtual === '-') valorAtual = "";

            const input = document.createElement('input');
            input.value = valorAtual;
            input.className = 'inline-edit';
            
            input.onblur = () => {
                let novoVal = input.value;
                if (campo === 'valor') novoVal = parseFloat(novoVal.replace(/\./g, '').replace(',', '.')) || 0;
                if (novoVal != valorAtual) update(ref(db, `contas/${id}`), { [campo]: novoVal });
                this.innerText = campo === 'valor' ? `R$ ${parseFloat(novoVal).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : novoVal;
            };
            input.onkeydown = (e) => { if(e.key === 'Enter') input.blur(); };

            this.innerText = "";
            this.appendChild(input);
            input.focus();
        };
    });
});

// --- LANÇAMENTO MANUAL ---
document.getElementById('btnLancar').onclick = () => {
    const vRaw = document.getElementById('valor').value;
    const vNum = parseFloat(vRaw.replace(/\./g, '').replace(',', '.')) || 0;
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

// --- LÓGICA DE TRATAMENTO (WHATSAPP/EMAIL) ---
window.tratar = (id) => {
    get(ref(db, `contas/${id}`)).then(s => {
        const c = s.val();
        const vF = c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2});
        const corpo = `Bom dia!\nSegue Para Lançamento:\n\n${c.local} - Pedido: ${c.pedido} - Fornecedor: ${c.codFornecedor} - ${c.fornecedor} - Valor: R$ ${vF} - ${c.centroCusto} - Venc.: ${c.vencimento}\nPagamento via: ${c.pagamento}.`;
        
        const btnP = document.getElementById('btnAcaoPrincipal');
        const btnE = document.getElementById('btnEnviarEmail');
        document.getElementById('modalPreview').innerText = corpo;
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
                const para = "servicos@vaccinar.com.br";
                const cc = "nfe.ti@vaccinar.com.br; contasapagar@vaccinar.com.br";
                const subject = `Lançamento - ${c.fornecedor} - Pedido ${c.pedido}`;
                window.location.href = `mailto:${para}?cc=${cc}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(corpo)}`;
                update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
                fecharModal();
            };
        }
        document.getElementById('btnApenasMarcar').onclick = () => {
            update(ref(db, `contas/${id}`), { status: "Enviado ao CSC" });
            fecharModal();
        };
    });
};

window.remover = (id) => { if(confirm("Excluir?")) remove(ref(db, `contas/${id}`)); };
