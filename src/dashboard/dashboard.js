document.addEventListener("DOMContentLoaded", async () => {

    // ==========================================
    // 0. CONFIGURAÇÃO SUPABASE
    // ==========================================
    const SUPABASE_URL = "https://dtfzvbtodlyyfokfgllv.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0Znp2YnRvZGx5eWZva2ZnbGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDE0NDUsImV4cCI6MjA4MjM3NzQ0NX0.L6qGW1Bl8k0eQhvJL_IvGE3q7yVPGPELL2beiDLhQ_Y";

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // ==========================================
    // 🔒 0.5 O PORTEIRO & O DONO (AUTH & RBAC)
    // ==========================================
    
    // 1. Verifica se está logado
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '../auth/login.html';
        return;
    }

    // 2. Descobre QUEM é o usuário
    let perfilUsuario = null;
    try {
        const { data } = await supabase
            .from('moradores')
            .select('*')
            .eq('email', session.user.email)
            .single();
        
        if (data) {
            perfilUsuario = data;
        }
    } catch (err) {
        console.log("Visitante sem perfil.");
    }

    // Verifica se é o "Dono"
    const souODono = perfilUsuario && perfilUsuario.cargo === 'Dono';

    // 3. Aplica as Regras
    aplicarPermissoes(souODono);


    // Configura Logout
    const btnLogout = document.querySelector('.logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            await supabase.auth.signOut();
            window.location.href = '../auth/login.html';
        });
    }

    // ==========================================
    // 1. VARIÁVEIS GLOBAIS
    // ==========================================
    let moradoresCache = [];
    let idEditando = null;
    let idParaDeletar = null;

    const tabelaBody = document.getElementById("lista-moradores");
    const modalCadastro = document.getElementById("modal-novo-morador");
    const modalExclusao = document.getElementById("modal-confirm-delete");
    const formMorador = document.getElementById("form-morador");


    // ==========================================
    // FUNÇÃO DE PERMISSÕES
    // ==========================================
    function aplicarPermissoes(isBoss) {
        // Transparência: Todos veem os dados (Money, Ocorrências).
        // Restrição: Apenas nos botões de ação.

        if (!isBoss) {
            console.log("👁️ Modo Transparência: Morador vendo dados, mas sem editar.");

            // 1. Some com o botão de adicionar novo morador
            const btnNovo = document.getElementById("btn-novo-morador");
            if (btnNovo) btnNovo.style.display = "none";
            
        } else {
            console.log("👑 O Dono CHEGOU! Controle total liberado.");
        }
    }


    // ==========================================
    // 2. SISTEMA DE EXCLUSÃO
    // ==========================================
    window.abrirModalExclusao = (id) => {
        idParaDeletar = id;
        modalExclusao.classList.add("active");
    };

    window.fecharModalExclusao = () => {
        idParaDeletar = null;
        modalExclusao.classList.remove("active");
    };

    document.getElementById("btn-confirm-delete").addEventListener("click", async () => {
        if (!idParaDeletar) return;

        const btn = document.getElementById("btn-confirm-delete");
        const textoOriginal = btn.innerText;
        btn.innerText = "Excluindo...";
        btn.disabled = true;

        const { error } = await supabase.from("moradores").delete().eq("id", idParaDeletar);

        if (error) {
            alert("Erro: " + error.message);
        } else {
            fecharModalExclusao();
            carregarMoradores();
        }

        btn.innerText = textoOriginal;
        btn.disabled = false;
    });


    // ==========================================
    // 3. CRUD
    // ==========================================

    async function carregarMoradores() {
        tabelaBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Carregando...</td></tr>';

        const { data, error } = await supabase
            .from("moradores")
            .select("*")
            .order("id", { ascending: false });

        if (error) {
            console.error(error);
            return;
        }

        moradoresCache = data;
        renderizarTabela();
        atualizarContadores();
    }

    async function salvarMorador(dados) {
        // Proteção: Só o Dono mexe
        if (!souODono) {
            alert("Apenas o Dono pode alterar dados.");
            return;
        }

        const btnSalvar = formMorador.querySelector("button");
        const textoOriginal = btnSalvar.innerText;
        btnSalvar.innerText = "Salvando...";
        btnSalvar.disabled = true;

        let error = null;

        if (idEditando) {
            const response = await supabase.from("moradores").update(dados).eq("id", idEditando);
            error = response.error;
        } else {
            dados.cargo = 'morador'; 
            const response = await supabase.from("moradores").insert([dados]);
            error = response.error;
        }

        if (error) {
            alert("Erro: " + error.message);
        } else {
            await carregarMoradores();
            fecharModalCadastro();
        }

        btnSalvar.innerText = textoOriginal;
        btnSalvar.disabled = false;
    }

    // ==========================================
    // 4. RENDERIZAÇÃO
    // ==========================================
    function renderizarTabela() {
        tabelaBody.innerHTML = "";

        if (moradoresCache.length === 0) {
            tabelaBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhum morador encontrado.</td></tr>';
            return;
        }

        moradoresCache.forEach((m) => {
            const tr = document.createElement("tr");
            const badgeClass = m.status === "ok" ? "status-ok" : "status-late";
            const badgeText = m.status === "ok" ? "Em dia" : "Atrasado";

            // Se for o Dono, vê Lápis e Lixeira.
            // Se for Morador, vê Cadeado. 🔒
            const botoesAcao = souODono 
                ? `
                    <button class="action-btn" onclick="editarMorador(${m.id})"><i class="fa-regular fa-pen-to-square"></i></button>
                    <button class="action-btn" onclick="abrirModalExclusao(${m.id})" style="color: #ef4444;"><i class="fa-regular fa-trash-can"></i></button>
                  `
                : `<span style="color:#cbd5e1; font-size:0.8rem;" title="Acesso Restrito"><i class="fa-solid fa-lock"></i></span>`;

            tr.innerHTML = `
                <td>
                    <div class="user-cell">
                        <img src="${m.img || 'https://ui-avatars.com/api/?name=User'}" class="user-avatar" alt="${m.nome}">
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
                    ${botoesAcao}
                </td>
            `;
            tabelaBody.appendChild(tr);
        });
    }

    function atualizarContadores() {
        const unidadesCount = document.querySelector(".stat-card:nth-child(3) .stat-value");
        if (unidadesCount) unidadesCount.innerText = `${moradoresCache.length}/50`;
    }

    // ==========================================
    // 5. EVENTOS
    // ==========================================
    const btnNovoMorador = document.getElementById("btn-novo-morador");
    const btnFecharModal = document.querySelector(".close-modal");

    if (btnNovoMorador) {
        btnNovoMorador.addEventListener("click", (e) => {
            e.preventDefault();
            idEditando = null;
            formMorador.reset();
            document.querySelector(".modal-header h3").innerText = "Novo Morador";
            modalCadastro.classList.add("active");
        });
    }

    function fecharModalCadastro() {
        modalCadastro.classList.remove("active");
    }
    if (btnFecharModal) btnFecharModal.addEventListener("click", fecharModalCadastro);

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
                img: `https://ui-avatars.com/api/?name=${nome}&background=random`,
            };
            salvarMorador(dados);
        });
    }

    // Edição
    window.editarMorador = (id) => {
        if (!souODono) return; 

        const morador = moradoresCache.find((m) => m.id === id);
        if (!morador) return;

        idEditando = id;
        document.getElementById("nome").value = morador.nome;
        document.getElementById("celular").value = morador.celular;
        document.getElementById("tipo").value = morador.tipo;
        document.getElementById("unidade").value = morador.unidade;
        document.getElementById("status").value = morador.status;

        document.querySelector(".modal-header h3").innerText = "Editar Morador";
        modalCadastro.classList.add("active");
    };

    // Navegação Sidebar
    const menuLinks = document.querySelectorAll(".sidebar-menu .menu-item");
    const sections = document.querySelectorAll(".view-section");
    
    menuLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
            if (link.classList.contains("logout")) return;
            e.preventDefault();
            menuLinks.forEach((l) => l.classList.remove("active"));
            link.classList.add("active");

            const spanText = link.querySelector("span").innerText;
            const targetId = {
                "Visão Geral": "view-dashboard",
                "Relatórios": "view-dashboard",
                "Moradores": "view-moradores",
                "Reservas": "view-dashboard",
            }[spanText];

            sections.forEach((s) => {
                s.classList.remove("active");
                if (s.id === targetId) s.classList.add("active");
            });
        });
    });

    carregarMoradores();
});