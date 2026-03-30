// ... (Importações do Firebase iguais)

function iniciarSistema() {
    const fInput = document.getElementById('inputImportarJSON');
    const vInput = document.getElementById('valorInput');

    vInput.onblur = formatarMoeda;
    vInput.onfocus = (e) => e.target.value = e.target.value.replace(/\D/g, '');

    // IMPORTAÇÃO COM ALERTA
    document.getElementById('btnImportar').onclick = () => fInput.click();
    fInput.onchange = (e) => {
        const arquivo = e.target.files[0];
        if (!arquivo) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const dados = JSON.parse(event.target.result);
                const lista = Object.values(dados).filter(i => i.pedido && i.pedido !== "-");

                if (confirm(`Importar ${lista.length} pedidos vinculados?`)) {
                    lista.forEach(item => {
                        push(contasRef, {
                            local: item.local || "MATRIZ",
                            pedido: item.pedido,
                            codFornecedor: item.codFornecedor || "",
                            fornecedor: item.fornecedor ? item.fornecedor.toUpperCase() : "FORNECEDOR",
                            tipo: "SERVICO", 
                            valor: parseFloat(item.valor) || 0,
                            cc: item.cc || "",
                            vencimento: item.vencimento || "",
                            pagamento: "BOLETO",
                            mes: document.getElementById('mesFiltro').value,
                            status: "Pendente",
                            timestamp: Date.now()
                        });
                    });
                    // Feedback Sonoro Simples (Beep)
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = audioCtx.createOscillator();
                    osc.connect(audioCtx.destination);
                    osc.start(); osc.stop(0.1);

                    alert("Importação Concluída! Verifique os campos destacados em amarelo.");
                    fInput.value = "";
                }
            } catch (err) { alert("Erro no arquivo."); }
        };
        reader.readAsText(arquivo);
    };

    // ... (Lógica de onValue e Renderizar)
}

function renderizar(data) {
    // ... (Filtros de mes e local)
    lista.forEach(c => {
        const tr = document.createElement('tr');
        
        // DESTAQUE DE VALOR ZERADO
        const isZerado = c.valor === 0;
        const classeValor = isZerado ? "editavel alerta-valor" : "editavel";
        const textoValor = isZerado ? "⚠️ DEFINIR VALOR" : `R$ ${c.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}`;

        tr.innerHTML = `
            <td>${c.local}</td>
            <td contenteditable="true" onblur="window.edit('${c.id}', 'pedido', this, this.innerText)" class="editavel">${c.pedido}</td>
            <td>${c.codFornecedor}</td>
            <td>${c.fornecedor}</td>
            <td contenteditable="true" onblur="window.edit('${c.id}', 'valor', this, this.innerText)" class="${classeValor}">${textoValor}</td>
            <td>${c.cc}</td>
            <td>${c.vencimento}</td>
            <td>
                <button onclick="window.abrirTratamento('${c.id}')" class="btn-tratar">TRATAR</button>
            </td>
        `;
        // Adiciona na tabela correta...
    });
}

window.abrirTratamento = (id) => {
    onValue(ref(db, `contas/${id}`), (snap) => {
        const c = snap.val();
        // BLOQUEIO DE SEGURANÇA
        if (c.valor <= 0) {
            return alert("ERRO: Defina o valor do pedido antes de enviar ao CSC.");
        }
        // ... (segue lógica de abrir modal e gerar e-mail/texto)
    }, { onlyOnce: true });
};
