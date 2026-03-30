const dbName = "GreenTechDB";
let db;

// Inicializa IndexedDB
const request = indexedDB.open(dbName, 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("contas")) {
        db.createObjectStore("contas", { keyPath: "id", autoIncrement: true });
    }
};
request.onsuccess = (e) => { 
    db = e.target.result; 
    listar();
    document.getElementById("dataTopo").innerText = new Date().toLocaleDateString('pt-BR');
};

// Formata valor para o padrão Marcus (1.000,00)
function formatarValorBR(valor) {
    return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function converterValorParaNumero(valor) {
    if (typeof valor === 'number') return valor;
    let v = valor.replace(/\./g, "").replace(",", ".");
    return parseFloat(v) || 0;
}

// Adicionar novo registro
async function adicionar() {
    const local = document.getElementById("localInput").value;
    if(!local) return alert("Selecione o Local");

    const novaConta = {
        tipo: document.getElementById("tipoInput").value,
        mes: document.getElementById("mesFiltro").value,
        local: local,
        pedido: document.getElementById("pedido").value,
        codFornecedor: document.getElementById("codFornecedor").value,
        fornecedor: document.getElementById("fornecedor").value.toUpperCase(),
        valor: converterValorParaNumero(document.getElementById("valor").value),
        cc: document.getElementById("cc").value,
        vencimento: document.getElementById("vencimento").value,
        status: "Pendente"
    };

    const tx = db.transaction("contas", "readwrite");
    tx.objectStore("contas").add(novaConta);
    tx.oncomplete = () => {
        listar();
        document.querySelectorAll("#areaCadastro input").forEach(i => i.value = "");
    };
}

// Listar e Renderizar Tabelas
function listar() {
    const tx = db.transaction("contas", "readonly");
    tx.objectStore("contas").getAll().onsuccess = (e) => {
        const contas = e.target.result;
        const tabProd = document.getElementById("tabelaProduto");
        const tabServ = document.getElementById("tabelaServico");
        tabProd.innerHTML = ""; tabServ.innerHTML = "";

        let pendente = 0, noCsc = 0, totalNotas = 0, enviadas = 0;
        const mesRef = document.getElementById("mesFiltro").value;

        contas.filter(c => c.mes === mesRef).forEach(c => {
            totalNotas++;
            if(c.status === "Enviado ao CSC") { noCsc += c.valor; enviadas++; } else { pendente += c.valor; }

            const tr = document.createElement("tr");
            if(c.status === "Enviado ao CSC") tr.style.opacity = "0.5";

            tr.innerHTML = `
                <td>${c.local}</td>
                <td><div class="editable-cell" contenteditable="true" onblur="salvarEdicao(${c.id}, 'pedido', this.innerText)">${c.pedido}</div></td>
                <td>${c.codFornecedor} - ${c.fornecedor}</td>
                <td><div class="editable-cell" contenteditable="true" onblur="salvarEdicao(${c.id}, 'valor', this.innerText)">${formatarValorBR(c.valor)}</div></td>
                <td>${c.cc}</td>
                <td><div class="editable-cell" contenteditable="true" onblur="salvarEdicao(${c.id}, 'vencimento', this.innerText)">${c.vencimento}</div></td>
                <td style="color:${c.status==='Pendente'?'#ef4444':'#10b981'}">${c.status}</td>
                <td>
                    <button class="btn-csc" onclick='abrirModalCSC(${JSON.stringify(c)})'>CSC</button>
                    <button class="btn-del" onclick="remover(${c.id})">X</button>
                </td>
            `;
            if(c.tipo === "PRODUTO") tabProd.appendChild(tr); else tabServ.appendChild(tr);
        });

        // Atualiza Cards
        document.getElementById("progressoNotas").innerText = `${enviadas} / ${totalNotas}`;
        document.getElementById("totalPendente").innerText = "R$ " + formatarValorBR(pendente);
        document.getElementById("totalPago").innerText = "R$ " + formatarValorBR(noCsc);
        document.getElementById("totalGeral").innerText = "R$ " + formatarValorBR(pendente + noCsc);
    };
}

// Funções Auxiliares
window.salvarEdicao = (id, campo, novoValor) => {
    const tx = db.transaction("contas", "readwrite");
    const store = tx.objectStore("contas");
    store.get(id).onsuccess = (e) => {
        const item = e.target.result;
        item[campo] = campo === 'valor' ? converterValorParaNumero(novoValor) : novoValor;
        store.put(item);
    };
    tx.oncomplete = () => listar();
};

window.abrirModalCSC = (item) => {
    const texto = `Pedido: ${item.pedido}\nFornecedor: ${item.fornecedor}\nValor: R$ ${formatarValorBR(item.valor)}`;
    document.getElementById("previewTexto").innerText = texto;
    document.getElementById("modalCSC").style.display = "block";
    
    document.getElementById("btnAcaoPrincipal").onclick = () => {
        const mailto = `mailto:servicos@vaccinar.com.br?subject=Lançamento NF&body=${encodeURIComponent(texto)}`;
        window.location.href = mailto;
        alterarStatus(item.id, "Enviado ao CSC");
    };
};

window.fecharModal = () => { document.getElementById("modalCSC").style.display = "none"; };

function alterarStatus(id, status) {
    const tx = db.transaction("contas", "readwrite");
    const store = tx.objectStore("contas");
    store.get(id).onsuccess = (e) => {
        const item = e.target.result;
        item.status = status;
        store.put(item);
    };
    tx.oncomplete = () => { fecharModal(); listar(); };
}

window.remover = (id) => {
    if(confirm("Excluir?")) {
        const tx = db.transaction("contas", "readwrite");
        tx.objectStore("contas").delete(id);
        tx.oncomplete = () => listar();
    }
};

function fazerBackupJSON() {
    const tx = db.transaction("contas", "readonly");
    tx.objectStore("contas").getAll().onsuccess = (e) => {
        const blob = new Blob([JSON.stringify(e.target.result)], {type: "application/json"});
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "backup_financeiro.json";
        link.click();
    };
}
