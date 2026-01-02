document.addEventListener("DOMContentLoaded", async () => {
  // ==========================================
  // 0. CONFIGURAÇÃO & SERVIÇOS
  // ==========================================
  const SUPABASE_URL = "https://dtfzvbtodlyyfokfgllv.supabase.co";
  const SUPABASE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0Znp2YnRvZGx5eWZva2ZnbGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDE0NDUsImV4cCI6MjA4MjM3NzQ0NX0.L6qGW1Bl8k0eQhvJL_IvGE3q7yVPGPELL2beiDLhQ_Y";

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // --- Serviço de Moradores ---
  const MoradorService = {
    async buscarPerfilUsuario() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return null;

      const { data } = await supabase
        .from("moradores")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      return { session, perfil: data };
    },

    async listarTodos() {
      return await supabase.from("moradores").select("*").order("id", { ascending: false });
    },

    async salvar(dados, id = null) {
      if (id) {
        return await supabase.rpc("atualizar_morador_completo", {
          email_alvo: dados.email,
          novo_nome: dados.nome,
          novo_celular: dados.celular,
          novo_tipo: dados.tipo,
          nova_unidade: dados.unidade,
          novo_status: dados.status,
          nova_img: dados.img,
        });
      }

      return { error: { message: "Criação permitida apenas via tela de Cadastro." } };
    },

    async excluir(email) {
      return await supabase.rpc("excluir_conta_completa", { email_alvo: email });
    },

    async logout() {
      await supabase.auth.signOut();
      window.location.href = "../auth/login.html";
    },
  };

  // --- Serviço de Reservas ---
  const ReservaService = {
    async listar() {
      // View (JOIN) -> nome/unidade sempre atualizados
      return await supabase.from("vw_reservas_detalhes").select("*").order("data", { ascending: true });
    },

    async criar(area, data) {
      const user = (await supabase.auth.getUser()).data.user;
      return await supabase.from("reservas").insert([{ user_id: user.id, area, data }]);
    },

    async deletar(id) {
      return await supabase.from("reservas").delete().eq("id", id);
    },
  };

  // ==========================================
  // 1. ESTADO GLOBAL
  // ==========================================
  const State = {
    usuarioLogado: null,
    moradoresCache: [],
    idEditando: null,
    emailParaDeletar: null,

    // NOVO: usado no modal de excluir reserva
    reservaParaDeletar: null,
  };

  // ==========================================
  // 2. UI HELPERS (Interface)
  // ==========================================
  const UI = {
    // Elementos Gerais
    menuLinks: document.querySelectorAll(".sidebar-menu .menu-item"),
    viewSections: document.querySelectorAll(".view-section"),
    toastContainer: document.getElementById("toast-container"),

    // Elementos Moradores
    tabela: document.getElementById("lista-moradores"),
    modalCadastro: document.getElementById("modal-novo-morador"),
    modalExclusao: document.getElementById("modal-confirm-delete"),
    formMorador: document.getElementById("form-morador"),
    btnConfirmDelete: document.getElementById("btn-confirm-delete"),

    // NOVO: modal de excluir reserva
    modalExclusaoReserva: document.getElementById("modal-confirm-delete-reserva"),
    btnConfirmDeleteReserva: document.getElementById("btn-confirm-delete-reserva"),

    // Sidebar
    userAvatar: document.getElementById("user-avatar"),
    userName: document.getElementById("user-name"),
    userRole: document.getElementById("user-role"),
    btnLogout: document.querySelector(".logout"),

    // Inputs Morador
    inputNome: document.getElementById("nome"),
    inputEmail: document.getElementById("email-novo"),
    inputCelular: document.getElementById("celular"),
    inputTipo: document.getElementById("tipo"),
    inputUnidadeNum: document.getElementById("unidade-num"),
    inputUnidadeBloco: document.getElementById("unidade-bloco"),
    inputStatus: document.getElementById("status"),

    showToast(message, type = "success") {
      const toast = document.createElement("div");
      toast.className = `toast ${type}`;
      toast.innerHTML = `${message}`;

      if (this.toastContainer) {
        this.toastContainer.appendChild(toast);
        setTimeout(() => {
          toast.style.animation = "fadeOut 0.5s forwards";
          setTimeout(() => toast.remove(), 500);
        }, 4000);
      } else {
        alert(message);
      }
    },

    renderizarTabela(moradores, podeEditar) {
      this.tabela.innerHTML = "";

      if (!moradores || moradores.length === 0) {
        this.tabela.innerHTML =
          '<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhum registro encontrado.</td></tr>';
        return;
      }

      moradores.forEach((m) => {
        const tr = document.createElement("tr");

        const badgeClass = m.status === "ok" ? "status-ok" : "status-late";
        const badgeText = m.status === "ok" ? "Em dia" : "Atrasado";

        const actions = podeEditar
          ? `
            <button class="action-btn btn-editar" data-id="${m.id}">
              <i class="fa-regular fa-pen-to-square"></i>
            </button>
            <button class="action-btn btn-excluir" data-email="${m.email}" style="color:#ef4444;">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          `
          : `
            <span style="opacity:0.5" title="Leitura">
              <i class="fa-solid fa-lock"></i>
            </span>
          `;

        tr.innerHTML = `
          <td>
            <div class="user-cell">
              <img src="${m.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.nome || "User")}`}" class="user-avatar" />
              <div>
                <strong>${m.nome || "-"}</strong><br/>
                <small>${m.tipo || "-"}</small>
              </div>
            </div>
          </td>
          <td><strong>${m.unidade || "-"}</strong></td>
          <td>${m.celular || "-"}</td>
          <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
          <td class="actions">${actions}</td>
        `;

        this.tabela.appendChild(tr);
      });

      const kpi = document.querySelector(".stat-card:nth-child(3) .stat-value");
      if (kpi) kpi.innerText = `${moradores.length}/50`;
    },

    atualizarSidebar(perfil) {
      if (!perfil) return;

      const nome = perfil.nome || "Usuário";
      this.userName.innerText = nome;

      const cargoAmigavel =
        perfil.cargo === "Dono" ? "Dono" : perfil.cargo === "admin" ? "Síndico" : "Morador";
      this.userRole.innerText = cargoAmigavel;

      this.userAvatar.innerText = nome.charAt(0).toUpperCase();
    },

    preencherModal(morador) {
      this.inputNome.value = morador.nome || "";
      this.inputEmail.value = morador.email || "";
      this.inputEmail.disabled = true;

      this.inputCelular.value = morador.celular || "";
      this.inputTipo.value = morador.tipo || "Proprietário";
      this.inputStatus.value = morador.status || "ok";

      if (morador.unidade && morador.unidade.includes(" - Bloco ")) {
        const [num, bloco] = morador.unidade.split(" - Bloco ");
        this.inputUnidadeNum.value = num || "";
        this.inputUnidadeBloco.value = bloco || "";
      } else {
        this.inputUnidadeNum.value = morador.unidade || "";
        this.inputUnidadeBloco.value = "";
      }
    },
  };

  // ==========================================
  // 2.1 UX: Controle global de Modais
  // ==========================================
  const ModalUX = {
    overlays: [],

    init() {
      this.overlays = Array.from(document.querySelectorAll(".modal-overlay"));

      // Clique fora fecha
      this.overlays.forEach((overlay) => {
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) this.close(overlay);
        });
      });

      // ESC fecha
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        const aberto = this.overlays.find((m) => m.classList.contains("active"));
        if (aberto) this.close(aberto);
      });
    },

    open(overlay) {
      if (!overlay) return;
      overlay.classList.add("active");
      document.body.classList.add("modal-open");
    },

    close(overlay) {
      if (!overlay) return;
      overlay.classList.remove("active");

      const algumAberto = this.overlays.some((m) => m.classList.contains("active"));
      if (!algumAberto) document.body.classList.remove("modal-open");
    },

    closeAll() {
      this.overlays.forEach((m) => m.classList.remove("active"));
      document.body.classList.remove("modal-open");
    },
  };

  // ==========================================
  // 3. UI RESERVAS
  // ==========================================
  const UIReserva = {
    modal: document.getElementById("modal-reserva"),
    form: document.getElementById("form-reserva"),
    lista: document.getElementById("lista-reservas"),

    init() {
      if (!this.form) return;

      // Data mínima: hoje
      const hoje = new Date().toISOString().split("T")[0];
      const inputData = document.getElementById("reserva-data");
      if (inputData) inputData.min = hoje;

      // Fechar modal reserva
      const btnClose = document.querySelector(".close-modal-reserva");
      if (btnClose) btnClose.addEventListener("click", () => ModalUX.close(this.modal));

      // Submit
      this.form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const area = document.getElementById("reserva-area").value;
        const data = document.getElementById("reserva-data").value;

        const btn = this.form.querySelector("button");
        const txt = btn.innerText;
        btn.innerText = "Agendando...";
        btn.disabled = true;

        const { error } = await ReservaService.criar(area, data);

        if (error) {
          if (error.code === "23505") UI.showToast("Data indisponível! Já existe reserva para este dia.", "error");
          else UI.showToast(error.message, "error");
        } else {
          UI.showToast("Reserva confirmada!", "success");
          ModalUX.close(this.modal);
          await this.carregar();
        }

        btn.innerText = txt;
        btn.disabled = false;
      });
    },

    async carregar() {
      if (!this.lista) return;

      this.lista.innerHTML =
        '<tr><td colspan="4" style="text-align:center;">Carregando...</td></tr>';

      const { data, error } = await ReservaService.listar();
      if (error) {
        console.error(error);
        this.lista.innerHTML = "";
        return;
      }

      this.lista.innerHTML = "";

      if (!data || data.length === 0) {
        this.lista.innerHTML = `
          <tr class="no-reservas">
            <td colspan="4">
              <div style="display:flex; flex-direction:column; align-items:center; gap:10px; padding:20px;">
                <i class="fa-regular fa-face-smile-beam" style="font-size:1.5rem; color:#2563eb;"></i>
                <span>Nenhuma reserva futura. Aproveite!</span>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      const meuId = State.usuarioLogado?.user_id;
      const souDono = State.usuarioLogado?.cargo === "Dono" || State.usuarioLogado?.cargo === "admin";

      data.forEach((r) => {
        // Ajuste simples de timezone
        const dataObj = new Date(r.data);
        dataObj.setMinutes(dataObj.getMinutes() + dataObj.getTimezoneOffset());
        const dataFormatada = dataObj.toLocaleDateString("pt-BR");

        const nomeQuem = r.nome_morador || "Morador";
        const unidadeQuem = r.unidade_morador || "-";

        let btnAcao = "";
        if (r.user_id === meuId || souDono) {
          btnAcao = `
            <button class="action-btn" onclick="deletarReserva(${r.id})"
              style="color:#ef4444; border:none; background:none; cursor:pointer;" title="Cancelar Reserva">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          `;
        } else {
          btnAcao = `
            <span style="opacity:0.4; color:#64748b;" title="Apenas o dono da reserva pode cancelar">
              <i class="fa-solid fa-lock"></i>
            </span>
          `;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td data-label="Data" class="td-destaque"><strong>${dataFormatada}</strong></td>
          <td data-label="Área"><span class="badge-area">${r.area}</span></td>
          <td data-label="Reservado por">
            <span class="reserva-pessoa">
              <span class="reserva-nome">${nomeQuem}</span>
              <span class="reserva-unidade">${unidadeQuem}</span>
            </span>
          </td>
          <td class="td-acao">${btnAcao}</td>
        `;
        this.lista.appendChild(tr);
      });
    },
  };

  // ==========================================
  // 4. FUNÇÕES GLOBAIS (para onclick do HTML)
  // ==========================================
  window.abrirModalReserva = (area) => {
    document.getElementById("reserva-area").value = area;
    document.getElementById("label-area-selecionada").innerText = area;
    ModalUX.open(document.getElementById("modal-reserva"));
  };

  // NOVO: abre modal de confirmação ao invés de confirm()
  window.deletarReserva = (id) => {
    State.reservaParaDeletar = id;
    ModalUX.open(UI.modalExclusaoReserva);
  };

  window.fecharModalExclusao = () => {
    ModalUX.close(UI.modalExclusao);
  };

  window.fecharModalExclusaoReserva = () => {
    State.reservaParaDeletar = null;
    ModalUX.close(UI.modalExclusaoReserva);
  };

  // ==========================================
  // 5. INICIALIZAÇÃO
  // ==========================================
  try {
    const authData = await MoradorService.buscarPerfilUsuario();
    if (!authData) {
      window.location.href = "../auth/login.html";
      return;
    }

    State.usuarioLogado = authData.perfil;

    if (!State.usuarioLogado) UI.showToast("Perfil em criação... aguarde.", "info");
    else UI.atualizarSidebar(State.usuarioLogado);

    const souDono = State.usuarioLogado?.cargo === "Dono" || State.usuarioLogado?.cargo === "admin";

    // Carrega moradores
    const { data: moradores, error: errMoradores } = await MoradorService.listarTodos();
    if (errMoradores) throw new Error(errMoradores.message);

    State.moradoresCache = moradores || [];
    UI.renderizarTabela(State.moradoresCache, souDono);

    // Reservas
    UIReserva.init();
    ModalUX.init();
  } catch (err) {
    console.error("Erro Fatal:", err);
    UI.showToast("Erro ao carregar: " + err.message, "error");
  }

  // ==========================================
  // 6. EVENTOS GERAIS
  // ==========================================

  // Navegação Sidebar
  UI.menuLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      if (link.classList.contains("logout")) return; // deixa o logout seguir o listener próprio
      e.preventDefault();

      const targetId = link.dataset.view || "view-dashboard";
      const title = link.dataset.title || "Visão Geral";

      // Ativa menu
      UI.menuLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");

      // Ativa view
      UI.viewSections.forEach((s) => s.classList.remove("active"));
      const section = document.getElementById(targetId);
      if (section) section.classList.add("active");

      // Atualiza título do topo
      const topTitle = document.querySelector(".top-bar .page-title");
      if (topTitle) topTitle.innerText = title;

      // Side-effects por view
      if (targetId === "view-reservas") UIReserva.carregar();
    });
  });

  // Opcional: título inicial do topo baseado no item active
  {
    const topTitle = document.querySelector(".top-bar .page-title");
    const activeLink = document.querySelector(".sidebar-menu .menu-item.active");
    if (topTitle && activeLink?.dataset?.title) topTitle.innerText = activeLink.dataset.title;
  }

  // Logout
  if (UI.btnLogout) {
    UI.btnLogout.addEventListener("click", (e) => {
      e.preventDefault();
      MoradorService.logout();
    });
  }

  // Fechar modais (X e botões outline)
  document.querySelectorAll(".close-modal, .btn-outline").forEach((btn) => {
    btn.addEventListener("click", () => {
      ModalUX.closeAll();
      State.reservaParaDeletar = null;
    });
  });

  // Tabela Moradores: editar/excluir
  UI.tabela.addEventListener("click", (e) => {
    const btnEditar = e.target.closest(".btn-editar");
    const btnExcluir = e.target.closest(".btn-excluir");

    if (btnEditar) {
      const id = parseInt(btnEditar.dataset.id);
      const morador = State.moradoresCache.find((m) => m.id === id);

      if (morador) {
        State.idEditando = id;
        UI.preencherModal(morador);
        ModalUX.open(UI.modalCadastro);
        document.querySelector(".modal-header h3").innerText = "Editar Morador";
      }
    }

    if (btnExcluir) {
      State.emailParaDeletar = btnExcluir.dataset.email;
      ModalUX.open(UI.modalExclusao);
    }
  });

  // Salvar Morador
  UI.formMorador.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = UI.formMorador.querySelector("button");
    const txtOriginal = btn.innerText;
    btn.innerText = "Processando...";
    btn.disabled = true;

    const dados = {
      nome: UI.inputNome.value,
      email: UI.inputEmail.value.toLowerCase().trim(),
      celular: UI.inputCelular.value,
      tipo: UI.inputTipo.value,
      status: UI.inputStatus.value,
      unidade: `${UI.inputUnidadeNum.value} - Bloco ${UI.inputUnidadeBloco.value.toUpperCase()}`,
      img: `https://ui-avatars.com/api/?name=${encodeURIComponent(UI.inputNome.value)}&background=random`,
    };

    const { error } = await MoradorService.salvar(dados, State.idEditando);

    if (error) {
      UI.showToast(error.message, "error");
    } else {
      UI.showToast("Salvo com sucesso!", "success");
      ModalUX.close(UI.modalCadastro);

      const { data } = await MoradorService.listarTodos();
      State.moradoresCache = data || [];

      const ehDono = State.usuarioLogado?.cargo === "Dono" || State.usuarioLogado?.cargo === "admin";
      UI.renderizarTabela(State.moradoresCache, ehDono);
    }

    btn.innerText = txtOriginal;
    btn.disabled = false;
  });

  // Confirmar Exclusão Morador
  UI.btnConfirmDelete.addEventListener("click", async () => {
    if (!State.emailParaDeletar) return;

    const btn = UI.btnConfirmDelete;
    btn.innerText = "Excluindo...";
    btn.disabled = true;

    const { error } = await MoradorService.excluir(State.emailParaDeletar);

    if (error) {
      UI.showToast("Erro ao excluir: " + error.message, "error");
    } else {
      UI.showToast("Morador removido.", "success");
      ModalUX.close(UI.modalExclusao);

      const { data } = await MoradorService.listarTodos();
      State.moradoresCache = data || [];

      const ehDono = State.usuarioLogado?.cargo === "Dono" || State.usuarioLogado?.cargo === "admin";
      UI.renderizarTabela(State.moradoresCache, ehDono);

      State.emailParaDeletar = null;
    }

    btn.innerText = "Sim, Excluir";
    btn.disabled = false;
  });

  // NOVO: Confirmar Exclusão Reserva (modal)
  if (UI.btnConfirmDeleteReserva) {
    UI.btnConfirmDeleteReserva.addEventListener("click", async () => {
      if (!State.reservaParaDeletar) return;

      const btn = UI.btnConfirmDeleteReserva;
      const txt = btn.innerText;

      btn.innerText = "Cancelando...";
      btn.disabled = true;

      const { error } = await ReservaService.deletar(State.reservaParaDeletar);

      if (error) {
        UI.showToast("Erro ao cancelar: " + error.message, "error");
      } else {
        UI.showToast("Reserva cancelada.", "info");
        ModalUX.close(UI.modalExclusaoReserva);
        State.reservaParaDeletar = null;
        UIReserva.carregar();
      }

      btn.innerText = txt;
      btn.disabled = false;
    });
  }

  // Máscara Celular
  UI.inputCelular.addEventListener("input", (e) => {
    let v = e.target.value.replace(/\D/g, "");
    v = v.substring(0, 11);
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d{5})(\d)/, "$1-$2");
    e.target.value = v;
  });

  // Bloco sempre maiúsculo
  UI.inputUnidadeBloco.addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
});
