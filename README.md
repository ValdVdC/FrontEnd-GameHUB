# Game Database - Client

Aplicação web moderna desenvolvida em Angular 18 para exploração e descoberta de jogos. Interface responsiva e intuitiva que consome dados da IGDB (Internet Game Database) através de uma API backend customizada, oferecendo navegação por categorias, busca avançada e visualização detalhada de informações de jogos.

## Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Demonstração](#demonstração)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Funcionalidades](#funcionalidades)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Execução](#execução)
- [Build](#build)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Componentes Principais](#componentes-principais)
- [Serviços](#serviços)
- [Rotas](#rotas)
- [Testes](#testes)

## Sobre o Projeto

Esta aplicação web oferece uma experiência rica para entusiastas de jogos, permitindo:

- **Exploração intuitiva** de milhares de jogos organizados por gêneros e plataformas
- **Busca avançada** com resultados em tempo real
- **Visualização detalhada** com informações completas, vídeos e screenshots
- **Interface responsiva** que se adapta perfeitamente a dispositivos móveis e desktop
- **Navegação fluida** com infinite scroll e carregamento otimizado
- **Sistema de filtros** por gêneros, plataformas e avaliações

## Demonstração

A aplicação conta com três páginas principais:

1. **Home**: Apresenta jogos populares e categorias organizadas
2. **Explorador**: Permite filtrar e buscar jogos por múltiplos critérios
3. **Detalhes**: Mostra informações completas sobre um jogo específico

## Tecnologias Utilizadas

### Core
- **Angular 18.2** - Framework principal
- **TypeScript 5.5** - Linguagem de programação
- **RxJS 7.8** - Programação reativa

### UI/UX
- **Bootstrap 5.3** - Framework CSS
- **ng-bootstrap 17.0** - Componentes Bootstrap para Angular
- **CSS3** - Estilização customizada

### Build & Development
- **Angular CLI** - Ferramentas de desenvolvimento
- **Karma & Jasmine** - Framework de testes
- **TypeScript Compiler** - Compilação e type checking

## Funcionalidades

### Página Home
- ✅ Carrossel de jogos em destaque
- ✅ Categorias organizadas por gêneros
- ✅ Infinite scroll por categoria
- ✅ Loading states e skeleton screens
- ✅ Navegação rápida entre categorias

### Página Explorador
- ✅ Busca por nome de jogo
- ✅ Filtros por gênero e plataforma
- ✅ Ordenação por popularidade e avaliação
- ✅ Grade responsiva de jogos
- ✅ Paginação infinita

### Página de Detalhes
- ✅ Informações completas do jogo
- ✅ Galeria de imagens
- ✅ Vídeos e trailers
- ✅ Avaliações e metascores
- ✅ Plataformas disponíveis
- ✅ Data de lançamento
- ✅ Gêneros e temas

### Features Técnicas
- ✅ Gerenciamento de estado reativo
- ✅ Cache de requisições HTTP
- ✅ Lazy loading de imagens
- ✅ SEO-friendly routing
- ✅ Error handling robusto
- ✅ Pipes customizados para formatação
- ✅ Guards de navegação
- ✅ Serviços reutilizáveis

## Pré-requisitos

- Node.js (versão 18.x ou superior)
- npm (versão 9.x ou superior)
- Angular CLI (versão 18.x)
- Servidor backend configurado e executando (veja `server/README.md`)

### Instalando Angular CLI

```bash
npm install -g @angular/cli
```

## Instalação

1. Clone o repositório:
```bash
git clone <url-do-repositorio>
cd client
```

2. Instale as dependências:
```bash
npm install
```

## Configuração

### Variáveis de Ambiente

1. Configure o arquivo de ambiente de desenvolvimento:

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  API_URL: 'http://localhost:3000/api/games'
};
```

2. Configure o arquivo de ambiente de produção:

```typescript
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  API_URL: 'https://sua-api-producao.com/api/games'
};
```

### Configurações do Angular

O projeto está configurado com:

- **Bootstrap 5**: Incluído globalmente via `angular.json`
- **Routing**: Habilitado com lazy loading
- **HTTP Client**: Configurado no `app.module.ts`
- **Interceptors**: Para tratamento de erros HTTP

## ▶Execução

### Modo de Desenvolvimento

```bash
npm start
# ou
ng serve
```

A aplicação estará disponível em `http://localhost:4200`

### Modo de Desenvolvimento com Proxy

Para evitar problemas de CORS durante o desenvolvimento:

```bash
ng serve --proxy-config proxy.conf.json
```

### Watch Mode

```bash
npm run watch
```

Compila automaticamente quando detecta mudanças nos arquivos.

## Build

### Build de Desenvolvimento

```bash
npm run build
```

### Build de Produção

```bash
ng build --configuration production
```

Os arquivos serão gerados no diretório `dist/`. A build de produção inclui:

- ✅ Minificação de código
- ✅ Tree-shaking
- ✅ Ahead-of-Time (AOT) compilation
- ✅ Otimização de bundles
- ✅ Source maps (opcional)

### Análise de Bundle

Para analisar o tamanho dos bundles:

```bash
ng build --stats-json
npx webpack-bundle-analyzer dist/client/stats.json
```

## Estrutura do Projeto

```
client/
├── src/
│   ├── app/
│   │   ├── componentes/           # Componentes compartilhados
│   │   │   ├── header/            # Cabeçalho com busca
│   │   │   └── footer/            # Rodapé da aplicação
│   │   ├── paginas/               # Componentes de página
│   │   │   ├── home/              # Página inicial
│   │   │   ├── explorador/        # Página de exploração
│   │   │   └── detalhes/          # Página de detalhes do jogo
│   │   ├── models/                # Interfaces e tipos TypeScript
│   │   │   └── game.model.ts      # Modelos de dados
│   │   ├── services/              # Serviços Angular
│   │   │   ├── api.service.ts     # Integração com API
│   │   │   ├── search.service.ts  # Gerenciamento de busca
│   │   │   ├── scroll.service.ts  # Controle de scroll
│   │   │   ├── genre-navigation.service.ts
│   │   │   └── platform-navigation.service.ts
│   │   ├── pipes/                 # Pipes customizados
│   │   │   ├── formatar-nota.pipe.ts     # Formatação de notas
│   │   │   └── safe-video-url.pipe.ts    # Sanitização de URLs
│   │   ├── app.component.ts       # Componente raiz
│   │   ├── app.module.ts          # Módulo principal
│   │   └── app-routing.module.ts  # Configuração de rotas
│   ├── assets/                    # Recursos estáticos
│   ├── environments/              # Configurações de ambiente
│   ├── index.html                 # HTML principal
│   ├── main.ts                    # Entry point
│   └── styles.css                 # Estilos globais
├── angular.json                   # Configuração do Angular
├── package.json                   # Dependências do projeto
├── tsconfig.json                  # Configuração TypeScript
└── README.md                      # Documentação
```

## Componentes Principais

### HeaderComponent

Componente de cabeçalho com funcionalidade de busca integrada.

**Responsabilidades:**
- Barra de navegação responsiva
- Campo de busca com debounce
- Navegação entre páginas
- Logo e branding

**Localização**: `src/app/componentes/header/`

### HomeComponent

Página inicial com jogos organizados por categorias.

**Funcionalidades:**
- Carrossel de jogos populares
- Categorias dinâmicas por gênero
- Infinite scroll por categoria
- Skeleton loading
- Navegação para detalhes

**Localização**: `src/app/paginas/home/`

### ExploradorComponent

Página de exploração com filtros avançados.

**Funcionalidades:**
- Busca por nome
- Filtros múltiplos (gêneros, plataformas)
- Grade responsiva
- Paginação infinita
- Contador de resultados

**Localização**: `src/app/paginas/explorador/`

### DetalhesComponent

Página de detalhes completos de um jogo.

**Funcionalidades:**
- Informações detalhadas
- Galeria de mídia
- Player de vídeo incorporado
- Badges de plataformas
- Informações de lançamento

**Localização**: `src/app/paginas/detalhes/`

### FooterComponent

Rodapé da aplicação com informações adicionais.

**Localização**: `src/app/componentes/footer/`

## Serviços

### ApiService

Serviço principal para comunicação com a API backend.

```typescript
// Exemplo de uso
this.apiService.buscarJogos(page, pageSize, genres)
  .subscribe(response => {
    this.jogos = response.data;
  });
```

**Métodos principais:**
- `buscarJogos()`: Lista jogos com filtros
- `getJogoDetalhes()`: Obtém detalhes de um jogo
- `buscarJogoPorNome()`: Busca por nome
- `buscarPlataformas()`: Lista plataformas
- `buscarGeneros()`: Lista gêneros

### SearchService

Gerencia o estado de busca global da aplicação.

```typescript
// Compartilhamento de termo de busca entre componentes
this.searchService.searchTerm$.subscribe(term => {
  this.realizarBusca(term);
});
```

### ScrollService

Controla a posição de scroll e restauração de estado.

```typescript
// Salvar posição ao sair da página
this.scrollService.saveScrollPosition('home', window.scrollY);

// Restaurar ao retornar
this.scrollService.restoreScrollPosition('home');
```

### GenreNavigationService & PlatformNavigationService

Gerenciam o estado de navegação por gêneros e plataformas.

## 🛣️ Rotas

```typescript
const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'explorador', component: ExploradorComponent },
  { path: 'detalhes/:id', component: DetalhesComponent },
  { path: '**', redirectTo: '' }
];
```

### Navegação Programática

```typescript
// Navegar para detalhes
this.router.navigate(['/detalhes', gameId]);

// Navegar com query params
this.router.navigate(['/explorador'], {
  queryParams: { genre: 'rpg', platform: 'pc' }
});
```

## Testes

### Executar Testes Unitários

```bash
npm test
# ou
ng test
```

Os testes são executados via Karma usando Jasmine.

### Estrutura de Testes

Cada componente possui seu arquivo de teste `.spec.ts`:

```
component.ts      # Implementação
component.spec.ts # Testes unitários
```

### Cobertura de Testes

```bash
ng test --code-coverage
```

Gera relatório de cobertura em `coverage/`

## Estilização

### Bootstrap Customizado

O projeto utiliza Bootstrap com customizações:

```css
/* styles.css */
:root {
  --primary-color: #your-color;
  --secondary-color: #your-color;
}
```

### Classes Utilitárias

- `.game-card`: Estilo de card de jogo
- `.skeleton`: Loading placeholder
- `.rating-badge`: Badge de avaliação
- `.platform-icon`: Ícones de plataforma

## Segurança

- ✅ Sanitização de URLs com `SafeVideoUrlPipe`
- ✅ HTTP interceptors para autenticação
- ✅ Validação de inputs
- ✅ CORS configurado no backend
- ✅ CSP (Content Security Policy) ready

## Performance

### Otimizações Implementadas

- **Lazy Loading**: Componentes carregados sob demanda
- **OnPush Change Detection**: Reduz ciclos de detecção
- **Virtual Scrolling**: Para listas grandes
- **Image Lazy Loading**: Carregamento diferido de imagens
- **HTTP Caching**: Cache de requisições repetidas
- **Debouncing**: Em campos de busca
- **Bundle Optimization**: Tree-shaking e code splitting

### Lighthouse Score (Alvo)

- Performance: 90+
- Accessibility: 95+
- Best Practices: 90+
- SEO: 90+

## Troubleshooting

### Problema: Erros de CORS

**Solução**: Certifique-se de que o servidor backend está configurado corretamente com CORS habilitado.

### Problema: Imagens não carregam

**Solução**: Verifique se as URLs da IGDB estão acessíveis e adicione `https:` antes das URLs relativas.

### Problema: Build falha

**Solução**: 
```bash
rm -rf node_modules package-lock.json
npm install
```
## 👤 Autor

Desenvolvido por Osvaldo Vasconcelos de Carvalho

## 🔗 Links Úteis

- [Angular Documentation](https://angular.io/docs)
- [Bootstrap Documentation](https://getbootstrap.com/docs/5.3/)
- [RxJS Documentation](https://rxjs.dev/)
- [IGDB API Documentation](https://api-docs.igdb.com/)

**Nota**: Esta é a aplicação front-end que requer o servidor backend para funcionar. Veja o README do servidor para instruções de configuração da API.
