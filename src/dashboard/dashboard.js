document.addEventListener("DOMContentLoaded", async () => {
  // ==========================================
  // 0. CONFIGURAÇÃO CLIENT
  // ==========================================
  const SUPABASEURL = "https://dtfzvbtodlyyfokfgllv.supabase.co";
  const SUPABASEKEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0Znp2YnRvZGx5eWZva2ZnbGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDE0NDUsImV4cCI6MjA4MjM3NzQ0NX0.L6qGW1Bl8k0eQhvJL_IvGE3q7yVPGPELL2beiDLhQ_Y";

  const supabase = window.supabase.createClient(SUPABASEURL, SUPABASEKEY);

  // ==========================================
  // 1. HELPERS
  // ==========================================
  const formatBRL = (value) => {
    const n = Number(value || 0);
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  };

  // Ajuste simples de timezone para date vindo do banco
  const ajustarDataBR = (isoOrDate) => {
    const d = new Date(isoOrDate);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    return d;
  };

  const getMeuUserId = async () => {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  };

  // ==========================================
  // 2. ESTADO
  // ==========================================
  const State = {
    usuarioLogado: null,
    moradoresCache: [],
    idEditando: null,
    emailParaDeletar: null,
    reservaParaDeletar: null,
    ocorrenciaParaDeletar: null,
  };

  const isAdmin = () => State.usuarioLogado?.cargo === "Dono" || State.usuarioLogado?.cargo === "admin";

  // ==========================================
  // 3. SERVIÇOS
  // ==========================================
  const MoradorService = {
    async buscarPerfilUsuario() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data, error } = await supabase
        .from("moradores")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return { session, perfil: data };
    },

    async listarTodos() {
      // Para usuário comum vai retornar só o próprio registro (RLS)
      return await supabase.from("moradores").select("*").order("id", { ascending: false });
    },

    async salvar(dados, id) {
      return await supabase.from("moradores").update(dados).eq("id", id);
    },

    async excluir(email) {
      // OBS: isso remove só o registro de moradores (não remove o usuário do Auth)
      return await supabase.from("moradores").delete().eq("email", email);
    },

    async logout() {
      await supabase.auth.signOut();
      window.location.href = "../auth/login.html";
    },
  };

  const ReservaService = {
    async listar() {
      return await supabase.from("vw_reservas_detalhes").select("*").order("data", { ascending: true });
    },

    async criar(area, data) {
      const userId = await getMeuUserId();
      return await supabase.from("reservas").insert([{ user_id: userId, area, data }]);
    },

    async deletar(id) {
      return await supabase.from("reservas").delete().eq("id", id);
    },
  };

  const OcorrenciaService = {
    async listar() {
      return await supabase.from("vw_ocorrencias_detalhes").select("*").order("created_at", { ascending: false });
    },

    async criar(titulo, descricao) {
      const userId = await getMeuUserId();
      return await supabase.from("ocorrencias").insert([{ user_id: userId, titulo, descricao }]);
    },

    async deletar(id) {
      return await supabase.from("ocorrencias").delete().eq("id", id);
    },
  };

  const CaixaService = {
    async saldo() {
      return await supabase.from("vw_saldo_caixa").select("saldo").single();
    },

    async listarPublico() {
      return await supabase
        .from("vw_caixa_movimentos_publico")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
    },

    async movimentar(tipo, valor, descricao) {
      const userId = await getMeuUserId();
      return await supabase.from("caixa_movimentos").insert([{ user_id: userId, tipo, valor, descricao }]);
    },
  };

  const KpiService = {
    async unidades() {
      // Função SQL: kpi_unidades() returns table(total, ocupadas, vazias)
      return await supabase.rpc("kpi_unidades");
    },
  };

  // ==========================================
  // 4. UI REFS
  // ==========================================
  const UI = {
    // Gerais
    menuLinks: document.querySelectorAll(".sidebar-menu .menu-item"),
    viewSections: document.querySelectorAll(".view-section"),
    toastContainer: document.getElementById("toast-container"),

    // Sidebar
    userAvatar: document.getElementById("user-avatar"),
    userName: document.getElementById("user-name"),
    userRole: document.getElementById("user-role"),
    btnLogout: document.querySelector(".logout"),

    // KPIs / Dashboard
    recentActivities: document.getElementById("recent-activities"),
    kpiSaldo: document.getElementById("kpi-saldo"),
    kpiSaldoSub: document.getElementById("kpi-saldo-sub"),
    btnAjustarCaixa: document.getElementById("btn-ajustar-caixa"),
    btnVerCaixa: document.getElementById("btn-ver-caixa"),

    kpiOcorrencias: document.getElementById("kpi-ocorrencias"),
    kpiOcorrenciasSub: document.getElementById("kpi-ocorrencias-sub"),

    kpiUnidades: document.getElementById("kpi-unidades"),
    kpiUnidadesSub: document.getElementById("kpi-unidades-sub"),

    // Moradores
    tabelaMoradores: document.getElementById("lista-moradores"),
    modalCadastroMorador: document.getElementById("modal-novo-morador"),
    modalExclusaoMorador: document.getElementById("modal-confirm-delete"),
    formMorador: document.getElementById("form-morador"),
    btnConfirmDeleteMorador: document.getElementById("btn-confirm-delete"),

    inputNome: document.getElementById("nome"),
    inputEmail: document.getElementById("email-novo"),
    inputCelular: document.getElementById("celular"),
    inputTipo: document.getElementById("tipo"),
    inputUnidadeNum: document.getElementById("unidade-num"),
    inputUnidadeBloco: document.getElementById("unidade-bloco"),
    inputStatus: document.getElementById("status"),

    // Reservas
    modalExclusaoReserva: document.getElementById("modal-confirm-delete-reserva"),
    btnConfirmDeleteReserva: document.getElementById("btn-confirm-delete-reserva"),

    // Ocorrências
    btnNovaOcorrencia: document.getElementById("btn-nova-ocorrencia"),
    btnNovaOcorrencia2: document.getElementById("btn-nova-ocorrencia-2"),
    modalOcorrencia: document.getElementById("modal-ocorrencia"),
    formOcorrencia: document.getElementById("form-ocorrencia"),
    listaOcorrencias: document.getElementById("lista-ocorrencias"),
    modalExclusaoOcorrencia: document.getElementById("modal-confirm-delete-ocorrencia"),
    btnConfirmDeleteOcorrencia: document.getElementById("btn-confirm-delete-ocorrencia"),

    // Caixa
    modalCaixa: document.getElementById("modal-caixa"),
    formCaixa: document.getElementById("form-caixa"),

    // Extrato Caixa
    modalCaixaHistorico: document.getElementById("modal-caixa-historico"),
    listaCaixaMovimentos: document.getElementById("lista-caixa-movimentos"),

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

    atualizarSidebar(perfil) {
      if (!perfil) return;
      const nome = perfil.nome || "Usuário";
      if (this.userName) this.userName.innerText = nome;

      const cargoAmigavel =
        perfil.cargo === "Dono" ? "Dono" : perfil.cargo === "admin" ? "Síndico" : "Morador";
      if (this.userRole) this.userRole.innerText = cargoAmigavel;

      if (this.userAvatar) this.userAvatar.innerText = nome.charAt(0).toUpperCase();
    },

    preencherModalMorador(m) {
      if (!m) return;

      if (this.inputNome) this.inputNome.value = m.nome || "";
      if (this.inputEmail) {
        this.inputEmail.value = m.email || "";
        this.inputEmail.disabled = true;
      }
      if (this.inputCelular) this.inputCelular.value = m.celular || "";
      if (this.inputTipo) this.inputTipo.value = m.tipo || "Proprietário";
      if (this.inputStatus) this.inputStatus.value = m.status || "ok";

      if (m.unidade && m.unidade.includes(" - Bloco ")) {
        const [num, bloco] = m.unidade.split(" - Bloco ");
        if (this.inputUnidadeNum) this.inputUnidadeNum.value = num || "";
        if (this.inputUnidadeBloco) this.inputUnidadeBloco.value = bloco || "";
      } else {
        if (this.inputUnidadeNum) this.inputUnidadeNum.value = m.unidade || "";
        if (this.inputUnidadeBloco) this.inputUnidadeBloco.value = "";
      }
    },

    renderizarTabelaMoradores(moradores, podeEditar) {
      if (!this.tabelaMoradores) return;

      this.tabelaMoradores.innerHTML = "";
      if (!moradores || moradores.length === 0) {
        this.tabelaMoradores.innerHTML =
          `<tr><td colspan="5" style="text-align:center;padding:20px">Nenhum registro encontrado.</td></tr>`;
        return;
      }

      moradores.forEach((m) => {
        const tr = document.createElement("tr");

        const badgeClass = m.status === "ok" ? "status-ok" : "status-late";
        const badgeText = m.status === "ok" ? "Em dia" : "Atrasado";
        const img =
          m.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.nome || "User")}&background=random`;

        const actions = podeEditar
          ? `
            <button class="action-btn btn-editar" data-id="${m.id}" title="Editar">
              <i class="fa-regular fa-pen-to-square"></i>
            </button>
            <button class="action-btn btn-excluir" data-email="${m.email}" style="color:#ef4444" title="Excluir">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          `
          : `<button class="action-btn action-btn-locked" type="button" title="Leitura apenas" aria-label="Bloqueado">
               <i class="fa-solid fa-lock"></i>
             </button>`;

        tr.innerHTML = `
          <td>
            <div class="user-cell">
              <img src="${img}" class="user-avatar" alt="Avatar" />
              <div>
                <strong>${m.nome || "-"}</strong><br/>
                <small>${m.tipo || "-"}</small>
              </div>
            </div>
          </td>
          <td><strong>${m.unidade || "-"}</strong></td>
          <td>${m.celular || "-"}</td>
          <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
          <td class="td-acao">${actions}</td>
        `;

        this.tabelaMoradores.appendChild(tr);
      });
    },
  };

  // ==========================================
  // 5. MODAL UX
  // ==========================================
  const ModalUX = {
    overlays: [],

    init() {
      this.overlays = Array.from(document.querySelectorAll(".modal-overlay"));

      this.overlays.forEach((overlay) => {
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) this.close(overlay);
        });
      });

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
  // 6. RESERVAS
  // ==========================================
  const UIReserva = {
    modal: document.getElementById("modal-reserva"),
    form: document.getElementById("form-reserva"),
    lista: document.getElementById("lista-reservas"),

    init() {
      if (!this.form) return;

      const hoje = new Date().toISOString().split("T")[0];
      const inputData = document.getElementById("reserva-data");
      if (inputData) inputData.min = hoje;

      const btnClose = document.querySelector(".close-modal-reserva");
      if (btnClose) btnClose.addEventListener("click", () => ModalUX.close(this.modal));

      this.form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const area = document.getElementById("reserva-area")?.value;
        const data = document.getElementById("reserva-data")?.value;

        const btn = this.form.querySelector("button");
        const txt = btn.innerText;
        btn.innerText = "Agendando...";
        btn.disabled = true;

        const { error } = await ReservaService.criar(area, data);
        if (error) {
          if (error.code === "23505") UI.showToast("Data indisponível! Já existe reserva.", "error");
          else UI.showToast(error.message, "error");
        } else {
          UI.showToast("Reserva confirmada!", "success");
          ModalUX.close(this.modal);
          await this.carregar();
          await carregarAtividadesRecentes();
        }

        btn.innerText = txt;
        btn.disabled = false;
      });
    },

    async carregar() {
      if (!this.lista) return;

      this.lista.innerHTML = `<tr><td colspan="4" style="text-align:center">Carregando...</td></tr>`;
      const { data, error } = await ReservaService.listar();
      if (error) {
        this.lista.innerHTML = `<tr><td colspan="4" style="text-align:center">Erro ao carregar.</td></tr>`;
        return;
      }

      const souDono = isAdmin();
      const meuId = State.usuarioLogado?.user_id;

      const thead = document.getElementById("thead-reservas");
      if (thead) {
        thead.innerHTML = souDono
          ? `<th>Data</th><th>Área</th><th>Reservado Por</th><th>Ações</th>`
          : `<th>Data</th><th>Área</th><th>Ações</th>`;
      }

      if (!data || data.length === 0) {
        const colspan = souDono ? 4 : 3;
        this.lista.innerHTML = `
          <tr class="no-reservas">
            <td colspan="${colspan}">
              <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px">
                <i class="fa-regular fa-face-smile-beam" style="font-size:1.5rem;color:#2563eb"></i>
                <span>Nenhuma reserva futura. Aproveite!</span>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      this.lista.innerHTML = "";
      data.forEach((r) => {
        const dataObj = ajustarDataBR(r.data);
        const dataFormatada = dataObj.toLocaleDateString("pt-BR");

        const reservadoPorId = r.user_id;
        const possoCancelar = souDono || reservadoPorId === meuId;

        const btnAcao = possoCancelar
          ? `<button class="action-btn" onclick="deletarReserva(${r.id})" style="color:#ef4444" title="Cancelar Reserva">
               <i class="fa-regular fa-trash-can"></i>
             </button>`
          : `<button class="action-btn action-btn-locked" type="button" title="Apenas o dono da reserva pode cancelar" aria-label="Bloqueado">
               <i class="fa-solid fa-lock"></i>
             </button>`;

        const tr = document.createElement("tr");

        if (souDono) {
          const nomeQuem = r.nome_morador || "Morador";
          const unidadeQuem = r.unidade_morador || "-";
          tr.innerHTML = `
            <td data-label="Data" class="td-destaque"><strong>${dataFormatada}</strong></td>
            <td data-label="Área"><span class="badge-area">${r.area}</span></td>
            <td data-label="Morador">
              <span class="reserva-pessoa">
                <span class="reserva-nome">${nomeQuem}</span>
                <span class="reserva-unidade">${unidadeQuem}</span>
              </span>
            </td>
            <td class="td-acao">${btnAcao}</td>
          `;
        } else {
          tr.innerHTML = `
            <td data-label="Data" class="td-destaque"><strong>${dataFormatada}</strong></td>
            <td data-label="Área"><span class="badge-area">${r.area}</span></td>
            <td class="td-acao">${btnAcao}</td>
          `;
        }

        this.lista.appendChild(tr);
      });
    },
  };

  // ==========================================
  // 7. OCORRÊNCIAS
  // ==========================================
  const UIOcorrencias = {
    async carregar() {
      if (!UI.listaOcorrencias) return;

      // Colspan 5 porque agora temos 5 colunas
      UI.listaOcorrencias.innerHTML =
        `<tr><td colspan="5" style="text-align:center;padding:18px">Carregando...</td></tr>`;

      const { data, error } = await OcorrenciaService.listar();
      if (error) {
        UI.listaOcorrencias.innerHTML =
          `<tr><td colspan="5" style="text-align:center;padding:18px">Erro ao carregar.</td></tr>`;
        return;
      }

      if (!data || data.length === 0) {
        UI.listaOcorrencias.innerHTML =
          `<tr><td colspan="5" style="text-align:center;padding:18px">Nenhuma ocorrência registrada.</td></tr>`;
        return;
      }

      UI.listaOcorrencias.innerHTML = data
        .map((o) => {
          const d = new Date(o.created_at).toLocaleDateString("pt-BR");

          // Lógica: Nome/Unidade ficam no Título. Celular fica separado.
          const nomeReg = o.registrador_nome || "Anônimo";
          const unidadeReg = o.registrador_unidade ? ` — ${o.registrador_unidade}` : "";
          
          // Formatação do subtítulo (Quem + Onde)
          const infoQuem = `<div style="font-size:0.85rem;color:#64748b;margin-top:4px">${nomeReg}${unidadeReg}</div>`;
          
          // Formatação do contato (Somente número)
          const infoTel = o.registrador_celular || "-";

          const podeExcluir = isAdmin() || o.minha === true;

          const btnAcao = podeExcluir
            ? `<button class="action-btn" onclick="deletarOcorrencia(${o.id})" style="color:#ef4444" title="Excluir ocorrência">
                 <i class="fa-regular fa-trash-can"></i>
               </button>`
            : `<button class="action-btn action-btn-locked" type="button" title="Apenas quem registrou pode excluir" aria-label="Bloqueado">
                 <i class="fa-solid fa-lock"></i>
               </button>`;

          return `
            <tr>
              <td data-label="Data" class="td-destaque"><strong>${d}</strong></td>
              
              <td data-label="Ocorrência">
                <strong>${o.titulo}</strong>
                ${infoQuem}
              </td>

              <td data-label="Contato">
                <span style="font-family:monospace;font-size:0.95rem;color:#475569">${infoTel}</span>
              </td>

              <td data-label="Status" style="text-transform:capitalize">${o.status || "aberta"}</td>
              <td class="td-acao">${btnAcao}</td>
            </tr>
          `;
        })
        .join("");
    },
  };

  // ==========================================
  // 8. CAIXA (extrato público)
  // ==========================================
  async function carregarExtratoCaixa() {
    if (!UI.listaCaixaMovimentos) return;

    UI.listaCaixaMovimentos.innerHTML =
      `<tr><td colspan="4" style="text-align:center;padding:18px">Carregando...</td></tr>`;

    const { data, error } = await CaixaService.listarPublico();
    if (error) {
      UI.listaCaixaMovimentos.innerHTML =
        `<tr><td colspan="4" style="text-align:center;padding:18px">Erro ao carregar.</td></tr>`;
      return;
    }

    if (!data || data.length === 0) {
      UI.listaCaixaMovimentos.innerHTML =
        `<tr><td colspan="4" style="text-align:center;padding:18px">Sem movimentações.</td></tr>`;
      return;
    }

    UI.listaCaixaMovimentos.innerHTML = data
      .map((m) => {
        const d = new Date(m.created_at).toLocaleDateString("pt-BR");
        const tipo = (m.tipo || "").toLowerCase() === "entrada" ? "Entrada" : "Saída";
        const sinal = tipo === "Entrada" ? "+" : "-";

        return `
          <tr>
            <td class="td-destaque"><strong>${d}</strong></td>
            <td>${tipo}</td>
            <td><strong>${sinal} ${formatBRL(m.valor)}</strong></td>
            <td>${m.descricao || "-"}</td>
          </tr>
        `;
      })
      .join("");
  }

  // ==========================================
  // 9. KPIs + ATIVIDADES
  // ==========================================
  async function carregarSaldo() {
    if (!UI.kpiSaldo) return;

    UI.kpiSaldo.innerText = "Carregando...";
    if (UI.kpiSaldoSub) UI.kpiSaldoSub.innerText = "Atualizando...";

    const { data, error } = await CaixaService.saldo();
    if (error) {
      UI.kpiSaldo.innerText = "Restrito";
      if (UI.kpiSaldoSub) UI.kpiSaldoSub.innerText = "Sem acesso";
      return;
    }

    UI.kpiSaldo.innerText = formatBRL(data?.saldo || 0);
    if (UI.kpiSaldoSub) UI.kpiSaldoSub.innerText = "Atualizado";
  }

  async function carregarKpiOcorrencias() {
    if (!UI.kpiOcorrencias) return;

    const { data, error } = await OcorrenciaService.listar();
    if (error || !data) {
      UI.kpiOcorrencias.innerText = "0 Abertas";
      if (UI.kpiOcorrenciasSub) UI.kpiOcorrenciasSub.innerText = "Atualize";
      return;
    }

    const abertas = data.filter((o) => (o.status || "").toLowerCase() === "aberta").length;
    const urgentes = data.filter((o) => (o.status || "").toLowerCase() === "urgente").length;

    UI.kpiOcorrencias.innerText = `${abertas} Abertas`;
    if (UI.kpiOcorrenciasSub) UI.kpiOcorrenciasSub.innerText = `${urgentes} Urgente`;
  }

  async function carregarKpiUnidades() {
    if (!UI.kpiUnidades) return;

    UI.kpiUnidades.innerText = "Carregando...";
    if (UI.kpiUnidadesSub) UI.kpiUnidadesSub.innerText = "Atualizando...";

    const { data, error } = await KpiService.unidades();
    if (error || !data || !data[0]) {
      UI.kpiUnidades.innerText = "—";
      if (UI.kpiUnidadesSub) UI.kpiUnidadesSub.innerText = "Erro ao calcular";
      return;
    }

    const { total, ocupadas, vazias } = data[0];
    UI.kpiUnidades.innerText = `${ocupadas}/${total}`;
    if (UI.kpiUnidadesSub) UI.kpiUnidadesSub.innerText = `${vazias} Vazias`;
  }

  async function carregarKPIs() {
    await carregarSaldo();
    await carregarKpiOcorrencias();
    await carregarKpiUnidades();
  }

  async function carregarAtividadesRecentes() {
    if (!UI.recentActivities) return;

    UI.recentActivities.innerHTML = `
      <div class="activity-item">
        <div class="activity-icon bg-blue"><i class="fa-solid fa-clock"></i></div>
        <div class="activity-info"><h4>Carregando...</h4><p>Buscando reservas.</p></div>
        <span class="activity-time">Agora</span>
      </div>
    `;

    const { data, error } = await ReservaService.listar();
    if (error) {
      UI.recentActivities.innerHTML = `
        <div class="activity-item">
          <div class="activity-icon bg-orange"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div class="activity-info"><h4>Erro</h4><p>${error.message}</p></div>
          <span class="activity-time">Agora</span>
        </div>
      `;
      return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const futuras = (data || [])
      .map((r) => ({ ...r, dataObj: ajustarDataBR(r.data) }))
      .filter((r) => r.dataObj >= hoje)
      .sort((a, b) => a.dataObj - b.dataObj)
      .slice(0, 2);

    if (futuras.length === 0) {
      UI.recentActivities.innerHTML = `
        <div class="activity-item">
          <div class="activity-icon bg-blue"><i class="fa-regular fa-face-smile-beam"></i></div>
          <div class="activity-info"><h4>Nenhuma reserva próxima</h4><p>Sem ocupações agendadas.</p></div>
          <span class="activity-time">OK</span>
        </div>
      `;
      return;
    }

    const souDono = isAdmin();

    UI.recentActivities.innerHTML = futuras
      .map((r) => {
        const dataBR = r.dataObj.toLocaleDateString("pt-BR");
        const diffDias = Math.ceil((r.dataObj - hoje) / (1000 * 60 * 60 * 24));
        const quando = diffDias === 0 ? "Hoje" : `Em ${diffDias}d`;

        const linhaInfo = souDono
          ? `${r.nome_morador || "Morador"} — ${r.unidade_morador || "-"}`
          : `Data: ${dataBR}`;

        return `
          <div class="activity-item">
            <div class="activity-icon bg-blue"><i class="fa-solid fa-calendar-day"></i></div>
            <div class="activity-info">
              <h4>Reserva: ${r.area}</h4>
              <p>${linhaInfo}</p>
            </div>
            <span class="activity-time">${quando}</span>
          </div>
        `;
      })
      .join("");
  }

  // ==========================================
  // 10. FUNÇÕES GLOBAIS (onclick)
  // ==========================================
  window.abrirModalReserva = (area) => {
    const areaInput = document.getElementById("reserva-area");
    const labelArea = document.getElementById("label-area-selecionada");
    if (areaInput) areaInput.value = area;
    if (labelArea) labelArea.innerText = area;
    ModalUX.open(document.getElementById("modal-reserva"));
  };

  window.deletarReserva = (id) => {
    State.reservaParaDeletar = id;
    if (UI.modalExclusaoReserva) ModalUX.open(UI.modalExclusaoReserva);
  };

  window.fecharModalExclusaoReserva = () => {
    State.reservaParaDeletar = null;
    ModalUX.close(UI.modalExclusaoReserva);
  };

  window.deletarOcorrencia = (id) => {
    State.ocorrenciaParaDeletar = id;
    if (UI.modalExclusaoOcorrencia) ModalUX.open(UI.modalExclusaoOcorrencia);
  };

  window.fecharModalExclusaoOcorrencia = () => {
    State.ocorrenciaParaDeletar = null;
    ModalUX.close(UI.modalExclusaoOcorrencia);
  };

  window.fecharModalExclusao = () => {
    State.emailParaDeletar = null;
    ModalUX.close(UI.modalExclusaoMorador);
  };

  // ==========================================
  // 11. INIT
  // ==========================================
  try {
    const authData = await MoradorService.buscarPerfilUsuario();
    if (!authData) {
      window.location.href = "../auth/login.html";
      return;
    }

    State.usuarioLogado = authData.perfil;
    UI.atualizarSidebar(State.usuarioLogado);

    // Botões restritos
    if (UI.btnAjustarCaixa) UI.btnAjustarCaixa.style.display = isAdmin() ? "flex" : "none";

    // Moradores (admin vê todos; morador comum verá só a própria linha)
    const { data: moradores, error: errMoradores } = await MoradorService.listarTodos();
    if (errMoradores) throw new Error(errMoradores.message);

    State.moradoresCache = moradores || [];
    UI.renderizarTabelaMoradores(State.moradoresCache, isAdmin());

    ModalUX.init();
    UIReserva.init();

    await carregarKPIs();
    await carregarAtividadesRecentes();
  } catch (err) {
    console.error("Erro Fatal:", err);
    UI.showToast(`Erro ao carregar: ${err.message}`, "error");
  }

  // ==========================================
  // 12. EVENTOS
  // ==========================================
  UI.menuLinks.forEach((link) => {
    link.addEventListener("click", async (e) => {
      if (link.classList.contains("logout")) return;

      e.preventDefault();
      const targetId = link.dataset.view || "view-dashboard";
      const title = link.dataset.title || "Visão Geral";

      UI.menuLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");

      UI.viewSections.forEach((s) => s.classList.remove("active"));
      const section = document.getElementById(targetId);
      if (section) section.classList.add("active");

      const topTitle = document.querySelector(".top-bar .page-title");
      if (topTitle) topTitle.innerText = title;

      if (targetId === "view-reservas") {
        await UIReserva.carregar();
        await carregarAtividadesRecentes();
      }

      if (targetId === "view-ocorrencias") {
        await UIOcorrencias.carregar();
      }
    });
  });

  if (UI.btnLogout) {
    UI.btnLogout.addEventListener("click", (e) => {
      e.preventDefault();
      MoradorService.logout();
    });
  }

  document.querySelectorAll(".close-modal, .btn-outline").forEach((btn) => {
    btn.addEventListener("click", () => {
      ModalUX.closeAll();
      State.reservaParaDeletar = null;
      State.ocorrenciaParaDeletar = null;
      State.emailParaDeletar = null;
    });
  });

  // Olho do Caixa (todos)
  if (UI.btnVerCaixa) {
    UI.btnVerCaixa.addEventListener("click", async () => {
      await carregarExtratoCaixa();
      ModalUX.open(UI.modalCaixaHistorico);
    });
  }

  // Ocorrências abrir modal
  const abrirModalOcorrencia = () => {
    if (!UI.modalOcorrencia) return;
    ModalUX.open(UI.modalOcorrencia);
  };
  if (UI.btnNovaOcorrencia) UI.btnNovaOcorrencia.addEventListener("click", abrirModalOcorrencia);
  if (UI.btnNovaOcorrencia2) UI.btnNovaOcorrencia2.addEventListener("click", abrirModalOcorrencia);

  // Registrar ocorrência
  if (UI.formOcorrencia) {
    UI.formOcorrencia.addEventListener("submit", async (e) => {
      e.preventDefault();

      const titulo = document.getElementById("oc-titulo")?.value?.trim();
      const descricao = document.getElementById("oc-descricao")?.value?.trim();
      if (!titulo || !descricao) return;

      const btn = UI.formOcorrencia.querySelector("button");
      const txt = btn.innerText;
      btn.innerText = "Enviando...";
      btn.disabled = true;

      const { error } = await OcorrenciaService.criar(titulo, descricao);
      if (error) UI.showToast(error.message, "error");
      else {
        UI.showToast("Ocorrência registrada.", "success");
        UI.formOcorrencia.reset();
        ModalUX.close(UI.modalOcorrencia);

        await carregarKpiOcorrencias();

        const viewOc = document.getElementById("view-ocorrencias");
        if (viewOc?.classList.contains("active")) await UIOcorrencias.carregar();
      }

      btn.innerText = txt;
      btn.disabled = false;
    });
  }

  // Caixa: abrir modal de lançamento (admin)
  if (UI.btnAjustarCaixa) {
    UI.btnAjustarCaixa.addEventListener("click", () => {
      if (!isAdmin()) return;
      ModalUX.open(UI.modalCaixa);
    });
  }

  // Caixa: lançar movimento (admin)
  if (UI.formCaixa) {
    UI.formCaixa.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!isAdmin()) {
        UI.showToast("Apenas Dono/admin pode movimentar o caixa.", "error");
        return;
      }

      const tipo = document.getElementById("cx-tipo")?.value;
      const valor = Number(document.getElementById("cx-valor")?.value);
      const descricao = document.getElementById("cx-desc")?.value?.trim() || null;

      const btn = UI.formCaixa.querySelector("button");
      const txt = btn.innerText;
      btn.innerText = "Salvando...";
      btn.disabled = true;

      const { error } = await CaixaService.movimentar(tipo, valor, descricao);
      if (error) UI.showToast(error.message, "error");
      else {
        UI.showToast("Caixa atualizado.", "success");
        UI.formCaixa.reset();
        ModalUX.close(UI.modalCaixa);

        await carregarSaldo();

        // Se o extrato estiver aberto, atualiza também
        if (UI.modalCaixaHistorico?.classList.contains("active")) {
          await carregarExtratoCaixa();
        }
      }

      btn.innerText = txt;
      btn.disabled = false;
    });
  }

  // Confirmar cancelamento de reserva
  if (UI.btnConfirmDeleteReserva) {
    UI.btnConfirmDeleteReserva.addEventListener("click", async () => {
      if (!State.reservaParaDeletar) return;

      const btn = UI.btnConfirmDeleteReserva;
      const txt = btn.innerText;
      btn.innerText = "Cancelando...";
      btn.disabled = true;

      const { error } = await ReservaService.deletar(State.reservaParaDeletar);
      if (error) UI.showToast(`Erro ao cancelar: ${error.message}`, "error");
      else UI.showToast("Reserva cancelada.", "info");

      ModalUX.close(UI.modalExclusaoReserva);
      State.reservaParaDeletar = null;

      await UIReserva.carregar();
      await carregarAtividadesRecentes();

      btn.innerText = txt;
      btn.disabled = false;
    });
  }

  // Confirmar exclusão de ocorrência
  if (UI.btnConfirmDeleteOcorrencia) {
    UI.btnConfirmDeleteOcorrencia.addEventListener("click", async () => {
      if (!State.ocorrenciaParaDeletar) return;

      const btn = UI.btnConfirmDeleteOcorrencia;
      const txt = btn.innerText;
      btn.innerText = "Excluindo...";
      btn.disabled = true;

      const { error } = await OcorrenciaService.deletar(State.ocorrenciaParaDeletar);
      if (error) UI.showToast(`Erro ao excluir: ${error.message}`, "error");
      else UI.showToast("Ocorrência excluída.", "info");

      ModalUX.close(UI.modalExclusaoOcorrencia);
      State.ocorrenciaParaDeletar = null;

      await carregarKpiOcorrencias();
      const viewOc = document.getElementById("view-ocorrencias");
      if (viewOc?.classList.contains("active")) await UIOcorrencias.carregar();

      btn.innerText = txt;
      btn.disabled = false;
    });
  }

  // Moradores: editar/excluir (admin)
  if (UI.tabelaMoradores) {
    UI.tabelaMoradores.addEventListener("click", (e) => {
      const btnEditar = e.target.closest(".btn-editar");
      const btnExcluir = e.target.closest(".btn-excluir");

      if (btnEditar) {
        const id = parseInt(btnEditar.dataset.id, 10);
        const morador = State.moradoresCache.find((m) => m.id === id);
        if (!morador) return;

        State.idEditando = id;
        UI.preencherModalMorador(morador);
        ModalUX.open(UI.modalCadastroMorador);
      }

      if (btnExcluir) {
        State.emailParaDeletar = btnExcluir.dataset.email;
        ModalUX.open(UI.modalExclusaoMorador);
      }
    });
  }

  // Moradores: salvar (admin)
  if (UI.formMorador) {
    UI.formMorador.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!State.idEditando) return;

      if (!isAdmin()) {
        UI.showToast("Apenas Dono/admin pode editar moradores.", "error");
        return;
      }

      const btn = UI.formMorador.querySelector("button");
      const txtOriginal = btn.innerText;
      btn.innerText = "Processando...";
      btn.disabled = true;

      const unidadeNum = UI.inputUnidadeNum?.value || "";
      const unidadeBloco = (UI.inputUnidadeBloco?.value || "").toUpperCase();
      const unidade = `${unidadeNum} - Bloco ${unidadeBloco}`.trim();

      const dados = {
        nome: UI.inputNome?.value || null,
        celular: UI.inputCelular?.value || null,
        tipo: UI.inputTipo?.value || null,
        status: UI.inputStatus?.value || null,
        unidade: unidade || null,
        img: `https://ui-avatars.com/api/?name=${encodeURIComponent(UI.inputNome?.value || "User")}&background=random`,
      };

      const { error } = await MoradorService.salvar(dados, State.idEditando);
      if (error) UI.showToast(error.message, "error");
      else UI.showToast("Salvo com sucesso!", "success");

      ModalUX.close(UI.modalCadastroMorador);

      const { data, error: errReload } = await MoradorService.listarTodos();
      if (!errReload) {
        State.moradoresCache = data || [];
        UI.renderizarTabelaMoradores(State.moradoresCache, isAdmin());
      }

      btn.innerText = txtOriginal;
      btn.disabled = false;
    });
  }

  // Moradores: confirmar exclusão (admin)
  if (UI.btnConfirmDeleteMorador) {
    UI.btnConfirmDeleteMorador.addEventListener("click", async () => {
      if (!State.emailParaDeletar) return;

      if (!isAdmin()) {
        UI.showToast("Apenas Dono/admin pode excluir moradores.", "error");
        return;
      }

      const btn = UI.btnConfirmDeleteMorador;
      const txt = btn.innerText;
      btn.innerText = "Excluindo...";
      btn.disabled = true;

      const { error } = await MoradorService.excluir(State.emailParaDeletar);
      if (error) UI.showToast(`Erro ao excluir: ${error.message}`, "error");
      else UI.showToast("Morador removido.", "success");

      ModalUX.close(UI.modalExclusaoMorador);
      State.emailParaDeletar = null;

      const { data, error: errReload } = await MoradorService.listarTodos();
      if (!errReload) {
        State.moradoresCache = data || [];
        UI.renderizarTabelaMoradores(State.moradoresCache, isAdmin());
      }

      btn.innerText = txt;
      btn.disabled = false;
    });
  }

  // Máscara celular
  if (UI.inputCelular) {
    UI.inputCelular.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "");
      v = v.substring(0, 11);
      v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
      v = v.replace(/(\d{5})(\d)/, "$1-$2");
      e.target.value = v;
    });
  }

  // Bloco uppercase
  if (UI.inputUnidadeBloco) {
    UI.inputUnidadeBloco.addEventListener("input", (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
  }
});