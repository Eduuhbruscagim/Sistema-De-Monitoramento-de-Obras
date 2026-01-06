# 🏢 Condomínio App (SaaS Concept)

![Preview do Projeto](src/imagens/Mac.webp)

> **Status:** 🚀 Fase 3 Concluída (Backend Serverless, Realtime & Security)

## 📜 Sobre o Projeto

O **Condomínio App** é uma plataforma web *Fullstack* desenvolvida para modernizar a gestão de condomínios residenciais. 

Diferente de sistemas administrativos tradicionais, este projeto une uma **Interface Premium (Apple-Like)** com uma **Arquitetura Serverless** robusta, garantindo segurança, performance e atualizações em tempo real.

O sistema opera como um **SaaS (Software as a Service)** funcional, com controle total de acesso via RLS (Row Level Security), gestão financeira e comunicação instantânea entre síndico e moradores.

## ✨ Destaques da Interface (Premium UI)

O front-end foi construído sem frameworks de UI, focando em CSS puro de alta performance:

* **💎 Glassmorphism Real:** Uso intensivo de `backdrop-filter` para criar camadas de vidro fosco e profundidade.
* **📱 Dashboard Mobile-First:** Tabelas que se transformam em *Cards* responsivos e menus adaptáveis.
* **🎨 Design System:** Paleta de cores consistente, tipografia *Plus Jakarta Sans* e micro-interações refinadas.

## ⚙️ Arquitetura & Backend (Supabase)

O projeto deixou de ser apenas visual e agora conta com um backend poderoso:

* **🔥 Database (PostgreSQL):** Dados relacionais estruturados.
* **🛡️ Segurança (RLS):** Políticas de acesso a nível de linha (Ex: Morador só vê o que é permitido; Síndico vê tudo).
* **📡 Realtime:** O Dashboard atualiza instantaneamente (sem refresh) quando novas ocorrências ou reservas são criadas.
* **🔐 Autenticação:** Fluxo completo de Login, Cadastro e Recuperação de Senha (Magic Links).

## 🚀 Funcionalidades Ativas

1.  **Dashboard Inteligente:** KPIs de saldo, unidades e ocorrências atualizados em tempo real.
2.  **Gestão de Ocorrências:**
    * Moradores abrem chamados.
    * Síndicos visualizam detalhes e gerenciam status.
    * *Permissões:* Apenas Admins/Donos podem excluir registros.
3.  **Sistema de Reservas:**
    * Calendário visual com bloqueio automático de datas já ocupadas.
    * Validação anti-conflito direto no banco de dados.
4.  **Controle Financeiro (Caixa):**
    * Extrato público para transparência.
    * Saldo protegido e gestão de entradas/saídas restrita a administradores.
5.  **Diretório de Moradores:**
    * Listagem completa com busca e gestão de status (Em dia / Inadimplente).

## 🛠️ Stack Tecnológica

A "Tríade Web" moderna:

* **Frontend:** HTML5 Semântico, CSS3 (Variables, Grid, Flex), JavaScript (ES6+ Modules).
* **Backend as a Service:** Supabase (Postgres, Auth, Storage, Edge Functions).
* **Assets:** FontAwesome 6, Google Fonts.

## 📂 Estrutura do Projeto

```text
/
├── src/
│   ├── about/          # Página Institucional
│   ├── auth/           # Fluxo de Autenticação Completo
│   ├── dashboard/      # Aplicação Principal (Lógica + UI)
│   ├── services/       # Camada de Integração (Supabase Client)
│   ├── imagens/        # Assets Otimizados
│   ├── global.css      # Design System
│   └── index.html      # Landing Page
└── README.md           # Documentação
```
<div align="center">

Idealizado e Desenvolvido por Eduardo Bruscagim

Product Design • Frontend Engineering • Backend Architecture

</div>