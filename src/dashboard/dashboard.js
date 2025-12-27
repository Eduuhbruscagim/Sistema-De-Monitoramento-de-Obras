document.addEventListener("DOMContentLoaded", async () => {

    // ==========================================
    // 0. CONFIGURAÇÃO SUPABASE
    // ==========================================
    const SUPABASE_URL = "https://dtfzvbtodlyyfokfgllv.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0Znp2YnRvZGx5eWZva2ZnbGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDE0NDUsImV4cCI6MjA4MjM3NzQ0NX0.L6qGW1Bl8k0eQhvJL_IvGE3q7yVPGPELL2beiDLhQ_Y";

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // ==========================================
    // 🔒 0.5 SEGURANÇA & LOGOUT (O PORTEIRO)
    // ==========================================

    // A) Verifica se tem usuário logado
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        // Se não tem crachá, tchau!
        window.location.href = '../auth/login.html';
        return; // Para o código aqui. Não carrega nada de baixo.
    }

    // B) Configura o Botão de Sair (Logout)
    const btnLogout = document.querySelector('.logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            const { error } = await supabase.auth.signOut();
            if (!error) {
                window.location.href = '../auth/login.html';
            }
        });
    }

    // ==========================================
    // 1. VARIÁVEIS GLOBAIS
    // ==========================================
    let moradoresCache = []; // Guarda os dados pra não ficar buscando toda hora
    let idEditando = null; // Se tiver ID aqui, é Edição. Se for null, é Criação.

    // Elementos do DOM
    const tabelaBody = document.getElementById("lista-moradores");
    const btnNovoMorador = document.getElementById("btn-novo-morador");
    const modal = document.getElementById("modal-novo-morador");
    const btnFecharModal = document.querySelector(".close-modal");
    const formMorador = document.getElementById("form-morador");

    // ==========================================
    // 2. CRUD (CREATE, READ, UPDATE, DELETE)
    // ==========================================

    // --- READ (Ler do Banco) ---
    async function carregarMoradores() {
        tabelaBody.innerHTML =
            '<tr><td colspan="5" style="text-align:center">Carregando dados da nuvem...</td></tr>';

        // Busca no Supabase
        const { data, error } = await supabase
            .from("moradores")
            .select("*")
            .order("id", { ascending: false }); // Do mais novo pro mais antigo

        if (error) {
            console.error(error);
            alert("Erro ao buscar dados.");
            return;
        }

        moradoresCache = data; // Atualiza a memória local
        renderizarTabela();
        atualizarContadores();
    }

    // --- CREATE & UPDATE (Salvar) ---
    async function salvarMorador(dados) {
        const btnSalvar = formMorador.querySelector("button");
        const textoOriginal = btnSalvar.innerText;
        btnSalvar.innerText = "Salvando...";
        btnSalvar.disabled = true;

        let error = null;

        if (idEditando) {
            // MODO UPDATE: Atualiza o existente
            const response = await supabase
                .from("moradores")
                .update(dados)
                .eq("id", idEditando);
            error = response.error;
        } else {
            // MODO CREATE: Cria um novo
            const response = await supabase.from("moradores").insert([dados]);
            error = response.error;
        }

        if (error) {
            alert("Erro ao salvar: " + error.message);
        } else {
            await carregarMoradores(); // Recarrega a lista
            fecharModal();
        }

        btnSalvar.innerText = textoOriginal;
        btnSalvar.disabled = false;
    }

    // --- DELETE (Apagar) ---
    window.deletarMorador = async (id) => {
        if (confirm("Tem certeza? Isso apaga permanentemente do banco.")) {
            const { error } = await supabase.from("moradores").delete().eq("id", id);

            if (error) {
                alert("Erro ao deletar: " + error.message);
            } else {
                carregarMoradores();
            }
        }
    };

    // --- PREPARAR EDIÇÃO (Jogar dados no form) ---
    window.editarMorador = (id) => {
        const morador = moradoresCache.find((m) => m.id === id);
        if (!morador) return;

        idEditando = id; // Marca que estamos editando

        // Preenche os campos
        document.getElementById("nome").value = morador.nome;
        document.getElementById("celular").value = morador.celular;
        document.getElementById("tipo").value = morador.tipo;
        document.getElementById("unidade").value = morador.unidade;
        document.getElementById("status").value = morador.status;

        // Abre o modal
        document.querySelector(".modal-header h3").innerText = "Editar Morador";
        modal.classList.add("active");
    };

    // ==========================================
    // 3. RENDERIZAÇÃO (Desenhar na Tela)
    // ==========================================
    function renderizarTabela() {
        tabelaBody.innerHTML = "";

        if (moradoresCache.length === 0) {
            tabelaBody.innerHTML =
                '<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhum morador cadastrado.</td></tr>';
            return;
        }

        moradoresCache.forEach((m) => {
            const tr = document.createElement("tr");

            // Definição das cores das badges
            const badgeClass = m.status === "ok" ? "status-ok" : "status-late";
            const badgeText = m.status === "ok" ? "Em dia" : "Atrasado";

            tr.innerHTML = `
                <td>
                    <div class="user-cell">
                        <img src="${m.img}" class="user-avatar" alt="${m.nome}">
                        <div>
                            <strong>${m.nome}</strong><br>
                            <small style="color: #64748b;">${m.tipo}</small>
                        </div>
                    </div>
                </td>
                <td><strong>${m.unidade}</strong></td>
                <td>${m.celular}</td>
                <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
                <td>
                    <button class="action-btn" onclick="editarMorador(${m.id})"><i class="fa-regular fa-pen-to-square"></i></button>
                    <button class="action-btn" onclick="deletarMorador(${m.id})" style="color: #ef4444;"><i class="fa-regular fa-trash-can"></i></button>
                </td>
            `;
            tabelaBody.appendChild(tr);
        });
    }

    function atualizarContadores() {
        // Exemplo: Atualiza o card de "Unidades" na Home
        const unidadesCount = document.querySelector(
            ".stat-card:nth-child(3) .stat-value"
        );
        if (unidadesCount) unidadesCount.innerText = `${moradoresCache.length}/50`;
    }

    // ==========================================
    // 4. EVENTOS (Cliques e Form)
    // ==========================================

    // Abrir Modal (Limpo para cadastro)
    if (btnNovoMorador) {
        btnNovoMorador.addEventListener("click", (e) => {
            e.preventDefault();
            idEditando = null;
            formMorador.reset();
            document.querySelector(".modal-header h3").innerText = "Novo Morador";
            modal.classList.add("active");
        });
    }

    // Fechar Modal
    function fecharModal() {
        modal.classList.remove("active");
    }
    if (btnFecharModal) btnFecharModal.addEventListener("click", fecharModal);

    // Salvar (Submit do Form)
    if (formMorador) {
        formMorador.addEventListener("submit", (e) => {
            e.preventDefault();

            const nome = document.getElementById("nome").value;

            const dados = {
                nome: nome,
                celular: document.getElementById("celular").value,
                tipo: document.getElementById("tipo").value,
                unidade: document.getElementById("unidade").value,
                status: document.getElementById("status").value,
                // Gera avatar aleatório se for novo, ou mantém o que tem
                img: `https://ui-avatars.com/api/?name=${nome}&background=random`,
            };

            salvarMorador(dados);
        });
    }

    // NAVEGAÇÃO SPA (Do código anterior, mantida pra não quebrar)
    const menuLinks = document.querySelectorAll(".sidebar-menu .menu-item");
    const sections = document.querySelectorAll(".view-section");
    menuLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
            if (link.classList.contains("logout")) return;
            e.preventDefault();
            menuLinks.forEach((l) => l.classList.remove("active"));
            link.classList.add("active");

            const targetId = {
                "Visão Geral": "view-dashboard",
                Relatórios: "view-dashboard",
                Moradores: "view-moradores",
                Reservas: "view-dashboard",
            }[link.querySelector("span").innerText];

            sections.forEach((s) => {
                s.classList.remove("active");
                if (s.id === targetId) s.classList.add("active");
            });
        });
    });

    // Inicialização
    carregarMoradores();

    // ==========================================
    // REALTIME (O Espião do Banco) 🕵️‍♂️
    // ==========================================
    // Isso faz o site "escutar" o banco de dados
    supabase
        .channel("tabela-moradores")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "moradores" },
            (payload) => {
                console.log("Alteração detectada!", payload);
                carregarMoradores(); // Recarrega a tabela sozinho
            }
        )
        .subscribe();
});