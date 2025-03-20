import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ScrollService } from '../../services/scroll.service';
import { Router } from '@angular/router';
import { ApiResponse, Game, GenreCategory } from '../../models/game.model';
import { lastValueFrom } from 'rxjs';
import { GenreNavigationService } from '../../services/genre-navigation.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
  /* ==============================================
     1. PROPRIEDADES DE ESTADO PRINCIPAL
  ============================================== */
  // Estado dos jogos
  jogos: Game[] = [];
  categorias: GenreCategory[] = [];
  jogosMomentoCarregando: boolean = true;
  categoriasCarregando: boolean = true;
  
  // Estado de categorias
  jogosPorCategoria: Map<string, Game[]> = new Map();
  carregandoMaisPorCategoria: Map<string, boolean> = new Map();
  apiPagePorCategoria: Map<string, number> = new Map();
  temMaisJogosPorCategoria: Map<string, boolean> = new Map();
  categoriasProntas: Map<string, boolean> = new Map();
  minJogosPorCategoria: number = 10;

  /* ==============================================
     2. PROPRIEDADES DE UI E NAVEGAÇÃO
  ============================================== */
  private observer!: IntersectionObserver;
  private observerInitialized = false;

  /* ==============================================
     3. CONSTRUTOR E MÉTODOS DE CICLO DE VIDA
  ============================================== */
  constructor(
    private apiService: ApiService, 
    private scrollService: ScrollService, 
    private router: Router,
    private genreNavigationService: GenreNavigationService
  ) {}

  ngOnInit(): void {
    this.buscarJogos();
    this.buscarCategorias();
  }

  ngAfterViewInit() {
    this.iniciarObservador();
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  /* ==============================================
     4. CARREGAMENTO DE DADOS PRINCIPAIS
  ============================================== */
  buscarJogos(): void {
    this.jogosMomentoCarregando = true;
    this.apiService.buscarJogos().subscribe({
      next: (data: ApiResponse) => {
        this.jogos = data.games;
      },
      error: (error: any) => {
        console.log('Erro ao buscar jogos:', error);
      },
      complete: () => {
        this.jogosMomentoCarregando = false;
        this.iniciarObservador();
      }
    });
  }

  buscarCategorias(): void {
    this.categoriasCarregando = true;
    this.apiService.buscarCategorias().subscribe({
      next: (data: GenreCategory[]) => {
        this.categorias = data.map(category => ({
          ...category,
          startIndex: 0
        }));
        
        // Inicializa os mapas para cada categoria
        this.categorias.forEach(categoria => {
          const genero = categoria.value.genre;
          const jogos = categoria.value.games || [];
          
          this.jogosPorCategoria.set(genero, jogos);
          this.carregandoMaisPorCategoria.set(genero, false);
          this.apiPagePorCategoria.set(genero, 1);
          this.temMaisJogosPorCategoria.set(genero, true);
          
          // Verifica se a categoria já tem jogos suficientes
          const temJogosSuficientes = jogos.length >= this.minJogosPorCategoria;
          this.categoriasProntas.set(genero, temJogosSuficientes);
          
          // Inicia o carregamento de mais jogos se necessário
          if (!temJogosSuficientes) {
            this.buscarMaisJogosPorCategoria(genero);
          }
        });
      },
      error: (error: any) => {
        console.log('Erro ao buscar categorias:', error);
      },
      complete: () => {
        this.categoriasCarregando = false;
        this.iniciarObservador();
      }
    });
  }

  /* ==============================================
     5. CARREGAMENTO DE JOGOS POR CATEGORIA
  ============================================== */
  async buscarMaisJogosPorCategoria(genero: string): Promise<void> {
    // Se já estiver carregando ou não houver mais jogos, retorna
    if (this.carregandoMaisPorCategoria.get(genero) || !this.temMaisJogosPorCategoria.get(genero)) {
      return;
    }
    
    this.carregandoMaisPorCategoria.set(genero, true);
    
    try {
      const jogosAtuais = this.jogosPorCategoria.get(genero) || [];
      const paginaAtual = this.apiPagePorCategoria.get(genero) || 1;
      
      // Se já tem jogos suficientes, marca a categoria como pronta e não busca mais
      if (jogosAtuais.length >= this.minJogosPorCategoria) {
        this.categoriasProntas.set(genero, true);
        this.carregandoMaisPorCategoria.set(genero, false);
        return;
      }
      
      // Busca mais jogos com retry
      const resultado = await this.carregarJogosPorCategoriaComRetry(genero, paginaAtual);
      
      if (!resultado.sucesso) {
        console.error(`Falha ao carregar mais jogos para ${genero} após múltiplas tentativas`);
        this.temMaisJogosPorCategoria.set(genero, false);
        
        // Mesmo com falha, se não tem mais jogos para carregar, marcamos como pronta
        // para que a UI possa mostrar o que temos
        this.categoriasProntas.set(genero, true);
        return;
      }
      
      const response = resultado.dados;
      
      if (!response || !response.games || !Array.isArray(response.games)) {
        console.error(`Resposta da API inválida para ${genero}:`, response);
        this.temMaisJogosPorCategoria.set(genero, false);
        this.categoriasProntas.set(genero, true);
        return;
      }
      
      // Filtrar jogos por gênero
      const jogosDoGenero = response.games.filter(game => 
        game.genres && Array.isArray(game.genres) && game.genres.includes(genero)
      );
      
      // Verificar por duplicatas
      const idsExistentes = new Set(jogosAtuais.map(game => game.id));
      const novosJogos = jogosDoGenero.filter(game => !idsExistentes.has(game.id));
      
      if (novosJogos.length > 0) {
        // Atualizar os jogos da categoria
        const jogosAtualizados = [...jogosAtuais, ...novosJogos];
        this.jogosPorCategoria.set(genero, jogosAtualizados);
        
        // Atualizar a categoria nos dados principais
        this.categorias = this.categorias.map(categoria => {
          if (categoria.value.genre === genero) {
            return {
              ...categoria,
              value: {
                ...categoria.value,
                games: jogosAtualizados
              }
            };
          }
          return categoria;
        });
        
        // Incrementar a página para próxima busca
        this.apiPagePorCategoria.set(genero, paginaAtual + 1);
        this.temMaisJogosPorCategoria.set(genero, response.pagination.hasMore);
        
        // Verificar se já atingimos o número mínimo de jogos
        if (jogosAtualizados.length >= this.minJogosPorCategoria) {
          this.categoriasProntas.set(genero, true);
        } else if (response.pagination.hasMore) {
          // Se ainda não tem jogos suficientes e há mais disponíveis, continua buscando
          setTimeout(() => {
            this.carregandoMaisPorCategoria.set(genero, false);
            this.buscarMaisJogosPorCategoria(genero);
          }, 1000);
        } else {
          // Se não há mais jogos disponíveis, marca a categoria como pronta mesmo sem o mínimo
          this.categoriasProntas.set(genero, true);
        }
      } else {
        // Se não encontrou novos jogos, mas ainda há mais páginas
        if (response.pagination.hasMore) {
          this.apiPagePorCategoria.set(genero, paginaAtual + 1);
          setTimeout(() => {
            this.carregandoMaisPorCategoria.set(genero, false);
            this.buscarMaisJogosPorCategoria(genero);
          }, 1000);
        } else {
          // Se não há mais jogos e não encontramos nenhum novo, marca como pronta
          this.temMaisJogosPorCategoria.set(genero, false);
          this.categoriasProntas.set(genero, true);
        }
      }
    } catch (error) {
      console.error(`Erro ao carregar mais jogos para ${genero}:`, error);
      this.temMaisJogosPorCategoria.set(genero, false);
      this.categoriasProntas.set(genero, true); // Marca como pronta para exibição do que temos
    } finally {
      this.carregandoMaisPorCategoria.set(genero, false);
    }
  }

  // Função auxiliar para retry em caso de falha na API
  private async carregarJogosPorCategoriaComRetry(genero: string, pagina: number, maxTentativas = 3, delayInicial = 1000) {
    let tentativa = 0;
    let delayMs = delayInicial;
    
    while (tentativa < maxTentativas) {
      try {
        const response = await lastValueFrom(this.apiService.buscarJogos(pagina));
        
        return { 
          sucesso: true, 
          dados: response,
          mensagem: 'Sucesso'
        };
      } catch (error) {
        console.warn(`Tentativa ${tentativa + 1} falhou ao buscar jogos para ${genero}. Tentando novamente em ${delayMs}ms`);
        tentativa++;
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs = Math.min(delayMs * 1.5, 10000);
      }
    }
    
    return { 
      sucesso: false, 
      dados: null,
      mensagem: `Falha após ${maxTentativas} tentativas`
    };
  }

  verificarJogosSuficientes(): void {
    if (!this.categorias || this.categorias.length === 0) return;
    
    this.categorias.forEach(categoria => {
      const genero = categoria.value.genre;
      const jogos = categoria.value.games || [];
      
      if (jogos.length < this.minJogosPorCategoria && this.temMaisJogosPorCategoria.get(genero)) {
        this.buscarMaisJogosPorCategoria(genero);
      }
    });
  }

  /* ==============================================
     6. VERIFICAÇÃO DE ESTADO DE CATEGORIAS
  ============================================== */
  categoriaPronta(genero: string): boolean {
    // Uma categoria está pronta quando:
    // 1. Tem jogos suficientes, OU
    // 2. Não tem mais jogos para carregar e a busca foi finalizada
    const jogos = this.jogosPorCategoria.get(genero) || [];
    const temJogosSuficientes = jogos.length >= this.minJogosPorCategoria;
    const estaCarregando = this.carregandoMaisPorCategoria.get(genero) || false;
    const temMaisJogos = this.temMaisJogosPorCategoria.get(genero) || false;
    
    // Se já tem jogos suficientes, está pronta
    if (temJogosSuficientes) {
      this.categoriasProntas.set(genero, true);
      return true;
    }
    
    // Se não está mais carregando e não tem mais jogos para buscar,
    // mesmo sem ter jogos suficientes, consideramos pronta (não há mais o que fazer)
    if (!estaCarregando && !temMaisJogos) {
      this.categoriasProntas.set(genero, true);
      return true;
    }
    
    return this.categoriasProntas.get(genero) || false;
  }

  private dadosCarregados(): boolean {
    return !this.jogosMomentoCarregando && !this.categoriasCarregando;
  }

  /* ==============================================
     7. NAVEGAÇÃO E CONTROLE DE CARROSSEL
  ============================================== */
  
  detalhesJogo(gameId: number) {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.scrollService.setActiveSection('');
    this.router.navigate(['/detalhes', gameId]);
  }
  
  navegarParaExploradorComGenero(genre: string | { name: string }) {
    // Handle both string and object genres
    const genreName = typeof genre === 'string' ? genre : genre.name;
    
    // Set the genre to navigate to
    this.genreNavigationService.navigateToGenre(genreName);
    
    // Navigate to the explorer page
    this.router.navigate(['/explorador']);
  }
  
  /* ==============================================
     8. GERENCIAMENTO DE OBSERVADORES DE SCROLL
  ============================================== */
  iniciarObservador() {
    if (!this.dadosCarregados() || this.observerInitialized) {
      return;
    }
    
    // Desconectar qualquer observer existente
    if (this.observer) {
      this.observer.disconnect();
    }
    
    // Função para calcular qual seção está mais visível na viewport
    const calcularSecaoMaisVisivel = () => {
      const viewportHeight = window.innerHeight;
      const scrollTop = window.scrollY;
      const viewportMiddle = scrollTop + (viewportHeight / 2);
      
      // Obter todas as seções
      const sections = document.querySelectorAll('section[id]');
      let maxVisibility = 0;
      let activeSection = '';
      
      sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        const sectionTop = scrollTop + rect.top;
        const sectionBottom = sectionTop + rect.height;
        
        // Calcular quão próximo o meio da viewport está do meio da seção
        const sectionMiddle = sectionTop + (rect.height / 2);
        const distance = Math.abs(viewportMiddle - sectionMiddle);
        
        // Normalizar a distância em relação à altura total da página
        const normalizedDistance = 1 - (distance / document.body.scrollHeight);
        
        // Verificar se a seção está pelo menos parcialmente visível
        const isVisible = (
          (sectionTop < scrollTop + viewportHeight) && 
          (sectionBottom > scrollTop)
        );
        
        if (isVisible && normalizedDistance > maxVisibility) {
          maxVisibility = normalizedDistance;
          activeSection = section.id;
        }
      });
      
      if (activeSection) {
        this.scrollService.setActiveSection(activeSection);
      }
    };
    
    // Adicionar listener de scroll
    window.addEventListener('scroll', () => {
      // Usar requestAnimationFrame para otimizar performance
      requestAnimationFrame(calcularSecaoMaisVisivel);
    }, { passive: true });
    
    // Calcular imediatamente qual seção está visível
    calcularSecaoMaisVisivel();
    
    this.observerInitialized = true;
  }
}