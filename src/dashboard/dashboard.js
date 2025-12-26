document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. NAVEGAÇÃO SPA (Troca de Telas)
    // ==========================================
    const menuLinks = document.querySelectorAll('.sidebar-menu .menu-item');
    const sections = document.querySelectorAll('.view-section');
    const pageTitle = document.querySelector('.page-title');
    
    const routeMap = {
        'Visão Geral': 'view-dashboard',
        'Relatórios': 'view-dashboard',
        'Moradores': 'view-moradores',
        'Reservas': 'view-dashboard'
    };

    function handleNavigation(event) {
        event.preventDefault();
        const clickedLink = event.currentTarget;
        if (clickedLink.classList.contains('logout')) return;

        const linkText = clickedLink.querySelector('span').innerText;
        const targetId = routeMap[linkText];

        if (!targetId) return;

        menuLinks.forEach(link => link.classList.remove('active'));
        clickedLink.classList.add('active');
        pageTitle.innerText = linkText;

        sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === targetId) section.classList.add('active');
        });
    }

    menuLinks.forEach(link => link.addEventListener('click', handleNavigation));

    // Logout
    const logoutBtn = document.querySelector('.logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if(confirm('Sair do sistema?')) window.location.href = '../index.html';
        });
    }


    // ==========================================
    // 2. SISTEMA DE MORADORES (CRUD COMPLETO)
    // ==========================================
    
    // Seleção de Elementos
    const tabelaBody = document.getElementById('lista-moradores');
    const btnNovoMorador = document.getElementById('btn-novo-morador');
    const modal = document.getElementById('modal-novo-morador');
    const btnFecharModal = document.querySelector('.close-modal');
    const formMorador = document.getElementById('form-morador');
    
    // Elementos para controle visual do Edit (Título e Botão do Modal)
    const modalTitulo = document.querySelector('#modal-novo-morador h3');
    const modalBtnSubmit = document.querySelector('#form-morador button[type="submit"]');

    // ESTADO: Variável para controlar se é Edição (null = Criar, ID = Editar)
    let idEmEdicao = null;

    // Dados Iniciais
    const dadosIniciais = [
        { id: 1, nome: 'Lara Silva', tipo: 'Proprietária', unidade: '101', bloco: 'A', status: 'ok', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100' },
        { id: 2, nome: 'Lucas Mendes', tipo: 'Inquilino', unidade: '402', bloco: 'B', status: 'late', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100' },
        { id: 3, nome: 'Ana Beatriz', tipo: 'Proprietária', unidade: '204', bloco: 'A', status: 'ok', img: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=100' }
    ];

    let moradores = JSON.parse(localStorage.getItem('db_moradores')) || dadosIniciais;

    // --- FUNÇÕES AUXILIARES ---

    const salvarDados = () => {
        localStorage.setItem('db_moradores', JSON.stringify(moradores));
        renderizarTabela();
        atualizarContadores();
    };

    const renderizarTabela = () => {
        if (!tabelaBody) return;
        tabelaBody.innerHTML = "";

        moradores.forEach((m) => {
            const tr = document.createElement("tr");
            const badgeClass = m.status === "ok" ? "status-ok" : "status-late";
            const badgeText = m.status === "ok" ? "Em dia" : "Atrasado";

            // UPDATE: Adicionado botão de Editar (azul) antes do Deletar
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
            <td>${m.celular || "(19) 99999-0000"}</td> 
            <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
            <td>
                <button class="action-btn" onclick="editarMorador(${m.id})" style="color: #3b82f6; margin-right: 8px;">
                    <i class="fa-regular fa-pen-to-square"></i>
                </button>
                <button class="action-btn" onclick="deletarMorador(${m.id})" style="color: #ef4444;">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </td>
        `;
            tabelaBody.appendChild(tr);
        });
    };

    const atualizarContadores = () => {
        const unidadesCount = document.querySelector('.stat-card:nth-child(3) .stat-value');
        if(unidadesCount) unidadesCount.innerText = `${moradores.length}/50`;
    }

    // --- EVENTOS (MODAL & BOTÕES) ---

    // 1. Abrir Modal (Modo CRIAÇÃO)
    if (btnNovoMorador) {
        btnNovoMorador.addEventListener('click', (e) => {
            e.preventDefault();
            // Resetar para modo "Novo"
            idEmEdicao = null;
            formMorador.reset();
            modalTitulo.innerText = "Novo Morador";
            modalBtnSubmit.innerText = "Salvar Morador";
            
            modal.classList.add('active');
        });
    }

    // 2. Fechar Modal
    if (btnFecharModal) {
        btnFecharModal.addEventListener('click', () => modal.classList.remove('active'));
    }

    // 3. Salvar (CREATE e UPDATE Unificados)
    if (formMorador) {
        formMorador.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Pega os valores do form
            const nome = document.getElementById('nome').value;
            const celular = document.getElementById('celular').value;
            const unidade = document.getElementById('unidade').value;
            const tipo = document.getElementById('tipo').value;
            const status = document.getElementById('status').value;

            if (idEmEdicao) {
                // --- MODO UPDATE (EDITAR) ---
                moradores = moradores.map(m => {
                    if (m.id === idEmEdicao) {
                        return {
                            ...m, // Mantém ID e outros dados antigos
                            nome,
                            celular,
                            unidade,
                            tipo,
                            status,
                            // Atualiza a imagem baseada no novo nome
                            img: `https://ui-avatars.com/api/?name=${nome}&background=random`
                        };
                    }
                    return m;
                });

                // Limpa o estado de edição após salvar
                idEmEdicao = null;
            } else {
                // --- MODO CREATE (NOVO) ---
                const novoMorador = {
                    id: Date.now(),
                    nome,
                    celular,
                    unidade,
                    bloco: "", 
                    tipo,
                    status,
                    img: `https://ui-avatars.com/api/?name=${nome}&background=random`
                };
                moradores.push(novoMorador);
            }

            salvarDados();
            formMorador.reset();
            modal.classList.remove('active');
        });
    }

    // 4. Função Global de Editar (Chamada pelo botão HTML)
    window.editarMorador = (id) => {
        const morador = moradores.find(m => m.id === id);
        if (!morador) return;

        // Preencher formulário com dados existentes
        document.getElementById('nome').value = morador.nome;
        document.getElementById('celular').value = morador.celular || "";
        document.getElementById('unidade').value = morador.unidade;
        document.getElementById('tipo').value = morador.tipo;
        document.getElementById('status').value = morador.status;

        // Configurar estado visual para "Edição"
        idEmEdicao = id;
        modalTitulo.innerText = "Editar Morador";
        modalBtnSubmit.innerText = "Atualizar";

        // Abrir modal
        modal.classList.add('active');
    };

    // 5. Deletar
    window.deletarMorador = (id) => {
        if (confirm('Remover morador?')) {
            moradores = moradores.filter(m => m.id !== id);
            salvarDados();
        }
    };

    // Inicialização
    renderizarTabela();
    atualizarContadores();
});
