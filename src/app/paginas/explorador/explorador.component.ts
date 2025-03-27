import { ChangeDetectorRef, Component, HostListener } from '@angular/core';
import { debounceTime, distinctUntilChanged, lastValueFrom, Subject, Subscription, takeUntil } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Router } from '@angular/router';
import { Game } from '../../models/game.model';
import { GenreNavigationService } from '../../services/genre-navigation.service';
import { SearchService } from '../../services/search.service';
import { PlatformNavigationService } from '../../services/platform-navigation.service';
interface PaginationState {
  currentPage: number;
  totalPages: number;
  hasMorePages: boolean;
  lastIncomplete: boolean;
  consecutiveIncomplete: number;
  itemsPerPage: number;
  loadedUntilPage: number;
  maxAttempts: number;
  minItemsPerRequest: number;
  saved?: boolean;
}

interface PaginationStates {
  normal: PaginationState;
  inclusive: PaginationState;
  exclusive: PaginationState;
  search: PaginationState;
  searchFiltered: PaginationState;
}
interface SearchTermState {
  hasMore: boolean;
  lastPage: number;
  totalResults: number;
  apiPageReached: number;
}
@Component({
  selector: 'app-explorador',
  templateUrl: './explorador.component.html',
  styleUrl: './explorador.component.css'
})

export class ExploradorComponent {
  /* ==============================================
     1. PROPRIEDADES DE ESTADO PRINCIPAL
  ============================================== */
  // Estado dos jogos
  games: Game[] = [];
  filteredGames: Game[] = [];
  genres: string[] = [];
  platforms: string[] = [];
  genresLoaded = false;
  platformsLoaded = false;
  loading: boolean = false;
  private loadingStartTime: number | null = null;
  private loadingTimeout: any = null;
  private safetyTimeout: any = null;
  isLongLoading: boolean = false;
  showCancelButton: boolean = false;
  
  private setLoading(state: boolean) {
    if (state) {
        this.preLoading = true;
        this.loading = true;
        this.gerenciarTimersLoading(true);
    } else {
        this.gerenciarTimersLoading(false, this.carregandoMais);
        
        setTimeout(() => {
            this.loading = false;
            this.preLoading = false;
            this.changeDetectorRef.detectChanges();
            window.dispatchEvent(new Event('scroll'));
        }, 100);
    }
  }
  private gerenciarTimersLoading(state: boolean, isCarregandoMais: boolean = false) {
    if (state) {
        // Iniciar os temporizadores sem afetar os estados que causam problemas
        if (!this.loadingStartTime) {
            this.loadingStartTime = Date.now();
            
            // Define o timeout para loading longo (global)
            this.loadingTimeout = setTimeout(() => {
                if (this.loading || this.carregandoMais) {
                    console.log('Ativando loading longo...');
                    this.isLongLoading = true;
                    this.showCancelButton = true;
                    this.changeDetectorRef.detectChanges();
                }
            }, 10000); // 10 segundos
        } else {
            // Se já tiver um timestamp, verifica se já passou do tempo para loading longo
            const tempoDecorrido = Date.now() - this.loadingStartTime;
            if (tempoDecorrido >= 10000 && !this.isLongLoading) {
                this.isLongLoading = true;
                this.showCancelButton = true;
                this.changeDetectorRef.detectChanges();
            }
        }

        // Define um novo timeout de segurança para cada chamada
        if (this.safetyTimeout) {
            clearTimeout(this.safetyTimeout);
        }
        this.safetyTimeout = setTimeout(() => {
            if (this.loading || this.carregandoMais) {
                console.warn('Loading foi resetado por timeout de segurança após 30 segundos');
                this.cancelLoading();
            }
        }, 30000); // 30 segundos
    } else {
        // Limpa apenas o timeout de segurança atual
        if (this.safetyTimeout) {
            clearTimeout(this.safetyTimeout);
            this.safetyTimeout = null;
        }
        
        // Se não houver mais nenhum loading ativo e não estiver carregando mais
        if (!isCarregandoMais) {
            if (this.loadingTimeout) {
                clearTimeout(this.loadingTimeout);
                this.loadingTimeout = null;
            }
            this.loadingStartTime = null;
            this.isLongLoading = false;
            this.showCancelButton = false;
        }
    }
  }

  cancelLoading() {
    // Guarda os jogos atuais
    const jogosAtuais = [...this.filteredGames];
    
    // Limpa os timeouts
    if (this.loadingTimeout) {
        clearTimeout(this.loadingTimeout);
        this.loadingTimeout = null;
    }

    // Prepara o novo estado
    this.genreFilterMode = 'inclusive';
    Object.keys(this.selectedGenres).forEach(genre => {
        this.selectedGenres[genre] = true;
    });
    this.includeNoGenre = true;
    this.currentPage = 1;

    // Usa requestAnimationFrame para sincronizar as mudanças visuais
    requestAnimationFrame(() => {
        // Mantém os jogos anteriores temporariamente
        this.filteredGames = jogosAtuais;
        
        // Desativa estados de loading
        this.loading = false;
        this.preLoading = false;
        this.isLongLoading = false;
        this.showCancelButton = false;

        // Inicia o carregamento dos novos jogos
        Promise.resolve().then(() => {
            this.loadInitialGames();
        });
    });
  }

  // Estado da interface
  isMobile: boolean = false;
  activeDropdown: string | null = null;
  showGenres: boolean = false;
  showNoGenresMessage: boolean = false;
  
  /* ==============================================
     2. PROPRIEDADES DE BUSCA E FILTRO
  ============================================== */
  // Busca
  searchTerm: string = '';
  searchResults: Game[] = [];
  searchApiPage: number = 1;
  searchHasMore: boolean = true;
  filteredSearchResults: Game[] = [];
  isSearchMode: boolean = false;
  private lastSearchTerm: string = '';
  private searchTermsState: Map<string, SearchTermState> = new Map();
  private getSearchTermState(term: string): SearchTermState {
    if (!this.searchTermsState.has(term)) {
      this.searchTermsState.set(term, {
        hasMore: true,
        lastPage: 1,
        totalResults: 0,
        apiPageReached: 0
      });
    }
    return this.searchTermsState.get(term)!;
  }
  
  // Método para salvar o estado atual do termo de busca
  private updateSearchTermState(term: string, updates: Partial<SearchTermState>) {
    const currentState = this.getSearchTermState(term);
    this.searchTermsState.set(term, {
      ...currentState,
      ...updates
    });
  }

  // Filtros
  selectedGenres: { [key: string]: boolean } = {};
  selectedPlatforms: { [key: string]: boolean } = {};
  selectedRating: string = '';
  sortBy: string = 'relevance';
  genreFilterMode: 'inclusive' | 'exclusive' = 'inclusive';
  // Opções de filtro
  ratingOptions = [
    { value: '', label: 'Todas as avaliações' },
    { value: '90', label: '4.5+ Excelente' },
    { value: '80', label: '4.0+ Muito Bom' },
    { value: '70', label: '3.5+ Bom' }
  ];

  sortOptions = [
    { value: 'relevance', label: 'Relevância' },
    { value: 'rating', label: 'Melhor Avaliados' },
    { value: 'name', label: 'Nome' }
  ];

  onFilterModeChange() {
    // Salva o estado anterior para comparação
    const modoAnterior = this.genreFilterMode;
    
    if (this.genreFilterMode === 'exclusive') {
        // Limpa seleções no modo exclusivo
        Object.keys(this.selectedGenres).forEach(genre => {
            this.selectedGenres[genre] = false;
        });
        this.includeNoGenre = false;
        
        this.filteredGames = [];
        this.filteredSearchResults = [];
        this.showNoGenresMessage = true;
        this.currentPage = 1;
        
        this.updateVisiblePages();
        this.salvarEstadoNoLocal();
        return;
    } 
    
    // Modo inclusivo
    // Se estamos vindo do modo exclusivo, precisamos resetar o array de jogos
    if (modoAnterior === 'exclusive') {
        // Reset completo ao retornar para o inclusivo
        this.games = []; // Limpa todos os jogos armazenados
        this.apiPage = 1; // Reseta a página da API
        this.paginasConsecutivasIncompletas = 0;
        
        // Carrega novamente todos os jogos
        this.setLoading(true);
        this.loadInitialGames().then(() => {
            // Seleciona todos os gêneros
            Object.keys(this.selectedGenres).forEach(genre => {
                this.selectedGenres[genre] = true;
            });
            this.includeNoGenre = true;
            this.showNoGenresMessage = false;
            this.currentPage = 1;
            
            this.salvarEstadoNoLocal();
        });
    } else {
        // Comportamento normal se não estiver vindo do exclusivo
        const state = this.getCurrentPaginationState();
        Object.keys(this.selectedGenres).forEach(genre => {
            this.selectedGenres[genre] = true;
        });
        this.includeNoGenre = true;
        this.showNoGenresMessage = false;
        this.currentPage = state.currentPage;
        
        if (this.isSearchMode && this.searchResults.length > 0) {
            this.filteredSearchResults = [...this.searchResults];
            this.updateVisiblePages();
        } else if (!this.isSearchMode && this.games.length > 0) {
            this.applyFilters(true);  // Chamar com reset para garantir consistência
        } else {
            this.setLoading(true);
            Promise.resolve().then(async () => {
                try {
                    if (this.isSearchMode) {
                        await this.applySearchFilters(true);
                    } else {
                        await this.applyFilters(true);
                    }
                } finally {
                    this.setLoading(false);
                }
            });
        }
        
        this.salvarEstadoNoLocal();
    }

    requestAnimationFrame(() => {
        const paginationElement = document.querySelector('.pagination-container');
        if (paginationElement) {
            paginationElement.classList.add('visible');
        }
    });
}

  /* ==============================================
     3. PROPRIEDADES DE PAGINAÇÃO
  ============================================== */
  currentPage: number = 1;
  apiPage: number = 1;
  itemsPerPage: number = 16;
  carregandoMais: boolean = false;
  temMaisJogos: boolean = true;
  preLoading: boolean = false;
  pagesToShow: (number | string)[] = [];
  shouldShowPagination: boolean = false;
  transitioning: boolean = false;

  private paginationStates: PaginationStates = {
    normal: {
        currentPage: 1,
        totalPages: 1,
        hasMorePages: true,
        lastIncomplete: false,
        consecutiveIncomplete: 0,
        itemsPerPage: 16,
        loadedUntilPage: 1,
        maxAttempts: 3,
        minItemsPerRequest: 12,
        saved: false
    },
    inclusive: {
        currentPage: 1,
        totalPages: 1,
        hasMorePages: true,
        lastIncomplete: false,
        consecutiveIncomplete: 0,
        itemsPerPage: 16,
        loadedUntilPage: 1,
        maxAttempts: 5,
        minItemsPerRequest: 8
    },
    exclusive: {
        currentPage: 1,
        totalPages: 1,
        hasMorePages: true,
        lastIncomplete: false,
        consecutiveIncomplete: 0,
        itemsPerPage: 16,
        loadedUntilPage: 1,
        maxAttempts: 10,
        minItemsPerRequest: 4
    },
    search: {
        currentPage: 1,
        totalPages: 1,
        hasMorePages: true,
        lastIncomplete: false,
        consecutiveIncomplete: 0,
        itemsPerPage: 16,
        loadedUntilPage: 1,
        maxAttempts: 3,
        minItemsPerRequest: 12,
        saved: false,
    },
    searchFiltered: {
        currentPage: 1,
        totalPages: 1,
        hasMorePages: true,
        lastIncomplete: false,
        consecutiveIncomplete: 0,
        itemsPerPage: 16,
        loadedUntilPage: 1,
        maxAttempts: 5,
        minItemsPerRequest: 8
    }
};

private getCurrentPaginationState(): PaginationState {
  const mode = this.getCurrentMode();
  return this.paginationStates[mode];
}

private getCurrentMode(): keyof PaginationStates {
  if (this.isSearchMode) {
      if (Object.keys(this.selectedGenres).some(g => this.selectedGenres[g])) {
          return 'searchFiltered';
      }
      return 'search';
  } else {
      if (this.genreFilterMode === 'exclusive') {
          return 'exclusive';
      } else if (this.genreFilterMode === 'inclusive') {
          return 'inclusive';
      }
      return 'normal';
  }
}

  /* ==============================================
     4. PROPRIEDADES DE CONTROLE RXJS
  ============================================== */
  private destroy$ = new Subject<void>();
  private intervalSalvarEstado: any;
  private genreSubscription: Subscription = new Subscription();
  private searchSubject = new Subject<string>();

  /* ==============================================
     5. CONSTRUTOR E MÉTODOS DE CICLO DE VIDA
  ============================================== */
  constructor(
    private apiService: ApiService,
    private router: Router,
    private genreNavigationService: GenreNavigationService,
    private changeDetectorRef: ChangeDetectorRef,
    private searchService: SearchService,
    private platformNavigationService: PlatformNavigationService
  ) {
    this.searchSubject.pipe(
      debounceTime(450),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      // Se já estamos no modo busca e o termo é o mesmo que o anterior, ignoramos
      if (this.isSearchMode && term === this.lastSearchTerm) {
        console.log('Ignorando busca repetida:', term);
        return;
      }
      
      // Armazena o último termo buscado
      this.lastSearchTerm = term;
      
      // Realiza a busca normalmente
      this.performSearch(term);
    });
  }
  
  ngOnInit() {
    this.setLoading(true);
    this.preLoading = true;
    this.transitioning = true;
  
    // Carregar tudo em uma única Promise
    this.loadAllInitialData().then(() => {
      this.setLoading(false);
      this.transitioning = false;
    }).catch(error => {
      console.error('Erro ao carregar dados:', error);
      this.setLoading(false);
      this.transitioning = false;
    });
  }
  
  private async loadAllInitialData() {
    // Carregar gêneros e plataformas em paralelo
    await Promise.all([
      this.loadGenres(),
      this.loadPlatforms()
    ]);
  
    // Configuração de observables de busca
    this.setupSearchSubscription();
  
    // Processamento de navegação de gênero e plataforma
    const currentGenre = this.genreNavigationService.getCurrentGenre();
    if (currentGenre) {
      this.processGenreNavigation(currentGenre);
    }
  
    const currentPlatform = this.platformNavigationService.getCurrentPlatform();
    if (currentPlatform) {
      this.processPlatformNavigation(currentPlatform);
    }
  
    // Carregar jogos iniciais
    await this.loadInitialGames();
  
    // Atualizar páginas e aplicar filtros
    this.updateVisiblePages();
    this.applyFilters(false);
  }

  // Método para configurar assinatura de busca
  private setupSearchSubscription() {
    this.searchService.currentSearchTerm.pipe(
      takeUntil(this.destroy$)
    ).subscribe(term => {
      if (term) {
        this.searchTerm = term;
        this.performSearch(term);
      }
    });
    this.scrollToTop();
  }
  
  // Método para processar navegação de gênero
  private processGenreNavigation(currentGenre: string) {
    console.log('Processando gênero navegado:', currentGenre);
    
    // Reset de gêneros
    Object.keys(this.selectedGenres).forEach(key => {
      this.selectedGenres[key] = false;
    });
    
    this.includeNoGenre = false;
    
    const matchedGenre = this.findMatchingGenre(currentGenre);
    
    if (matchedGenre) {
      this.scrollToTop();
      
      console.log('Gênero correspondente encontrado:', matchedGenre);
      
      this.selectedGenres[matchedGenre] = true;
      this.genreFilterMode = 'inclusive';
      
      this.applyGenreFilters();
    } else {
      console.warn('Nenhum gênero correspondente encontrado para:', currentGenre);
      console.warn('Gêneros disponíveis:', this.genres);
      this.genreNavigationService.clearSelectedGenre();
    }
  }
  
  // Método para processar navegação de plataforma
  private processPlatformNavigation(currentPlatform: string) {
    console.log('Processando Plataforma navegada:', currentPlatform);
    
    // Reset de plataformas
    Object.keys(this.selectedPlatforms).forEach(key => {
      this.selectedPlatforms[key] = false;
    });
  
    this.allPlatformsSelected = false;
    this.includeNoPlatform = false;
    
    const matchedPlatform = this.findMatchingPlatform(currentPlatform);
    
    if (matchedPlatform) {
      this.scrollToTop();
      
      console.log('Plataforma correspondente encontrado:', matchedPlatform);
      
      this.selectedPlatforms[matchedPlatform] = true;
      this.toggleAdditionalFilters();
      
      this.applyPlatformFilters();
    } else {
      console.warn('Nenhuma plataforma correspondente encontrado para:', currentPlatform);
      console.warn('Plataformas disponíveis:', this.platforms);
      this.platformNavigationService.clearSelectedPlatform();
    }
  }
  
  // Método para encontrar gênero correspondente
  private findMatchingGenre(currentGenre: string): string | undefined {
    return this.genres.find(
      genre => genre.toLowerCase().trim() === currentGenre.toLowerCase().trim()
    );
  }
  
  // Método para encontrar plataforma correspondente
  private findMatchingPlatform(currentPlatform: string): string | undefined {
    return this.platforms.find(
      platform => platform.toLowerCase().trim() === currentPlatform.toLowerCase().trim()
    );
  }
  
  // Método para aplicar filtros de gênero
  private applyGenreFilters() {
    if (this.games.length === 0) {
      this.loadInitialGames().then(() => {
        this.applyFilters(true);
        this.genreNavigationService.clearSelectedGenre();
      });
    } else {
      this.applyFilters(true);
      this.genreNavigationService.clearSelectedGenre();
    }
  }
  
  // Método para aplicar filtros de plataforma
  private applyPlatformFilters() {
    if (this.games.length === 0) {
      this.loadInitialGames().then(() => {
        this.applyFilters(true);
        this.platformNavigationService.clearSelectedPlatform();
      });
    } else {
      this.applyFilters(true);
      this.platformNavigationService.clearSelectedPlatform();
    }
  }
  
  // Método para rolagem suave para o topo
  private scrollToTop() {
    window.scrollTo({ 
      top: 0, 
      behavior: 'auto' 
    });
  
    return new Promise<void>(resolve => {
      let scrollCheckInterval = setInterval(() => {
        if (window.scrollY === 0) {
          clearInterval(scrollCheckInterval);
          resolve();
        }
      }, 10);
  
      setTimeout(() => {
        clearInterval(scrollCheckInterval);
        resolve();
      }, 800);
    });
  }
  ngOnDestroy() {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
  }
    if (this.genreSubscription) {
      this.genreSubscription.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
    clearInterval(this.intervalSalvarEstado);
    this.salvarEstadoNoLocal();
  }

  /* ==============================================
     6. GESTÃO DE ESTADO (SESSIONSTORAGE)
  ============================================== */
  private salvarEstadoNoLocal() {
    try {
        // Versão otimizada do estado, salvando apenas dados essenciais
        const estadoOtimizado = {
            currentPage: this.currentPage,
            apiPage: this.apiPage,
            selectedGenres: this.selectedGenres,
            genreFilterMode: this.genreFilterMode,
            selectedRating: this.selectedRating,
            selectedPlatforms: this.selectedPlatforms,
            sortBy: this.sortBy,
            isSearchMode: this.isSearchMode,
            searchTerm: this.searchTerm,
            // Salvar apenas IDs e dados mínimos dos jogos
            games: this.games.map(game => ({
                id: game.id,
                name: game.name,
                genres: game.genres,
                total_rating: game.total_rating
            })),
            // Guardar apenas referência aos IDs dos jogos filtrados
            filteredGamesIds: this.filteredGames.map(game => game.id),
            expiraEm: Date.now() + (30 * 60 * 1000)
        };

        localStorage.setItem('exploradorEstado', JSON.stringify(estadoOtimizado));
        
    } catch (e) {
        console.warn('Erro ao salvar estado completo, tentando salvar versão mínima...');
        try {
            // Versão ainda mais reduzida em caso de erro
            const estadoMinimo = {
                currentPage: this.currentPage,
                selectedGenres: this.selectedGenres,
                genreFilterMode: this.genreFilterMode,
                expiraEm: Date.now() + (30 * 60 * 1000)
            };
            localStorage.setItem('exploradorEstado_minimo', JSON.stringify(estadoMinimo));
        } catch (finalError) {
            console.error('Falha total ao salvar estado:', finalError);
        }
    }
}



private recuperarEstadoDoLocal() {
    try {
        const chunkCount = parseInt(localStorage.getItem('exploradorEstado_count') || '0');
        if (chunkCount > 0) {
            let estadoString = '';
            for (let i = 0; i < chunkCount; i++) {
                const chunk = localStorage.getItem(`exploradorEstado_${i}`);
                if (chunk) estadoString += chunk;
            }
            
            if (estadoString) {
                const estado = JSON.parse(estadoString);
                
                if (estado.expiraEm && estado.expiraEm < Date.now()) {
                    this.limparEstadoLocal();
                    return false;
                }
                
                // Restaura o estado
                this.games = estado.games;
                this.apiPage = estado.apiPage;
                this.temMaisJogos = estado.temMaisJogos;
                this.currentPage = estado.currentPage;
                this.selectedGenres = estado.selectedGenres;
                this.genreFilterMode = estado.genreFilterMode;
                this.selectedRating = estado.selectedRating;
                this.selectedPlatforms = estado.selectedPlatforms;
                this.sortBy = estado.sortBy;
                this.searchTerm = estado.searchTerm;
                this.searchResults = estado.searchResults;
                this.isSearchMode = estado.isSearchMode;
                this.searchApiPage = estado.searchApiPage;
                this.searchHasMore = estado.searchHasMore;
                
                return true;
            }
        }
        return false;
    } catch (e) {
        console.warn('Erro ao recuperar estado:', e);
        this.limparEstadoLocal();
        return false;
    }
}

private limparEstadoLocal() {
    const chunkCount = parseInt(localStorage.getItem('exploradorEstado_count') || '0');
    for (let i = 0; i < chunkCount; i++) {
        localStorage.removeItem(`exploradorEstado_${i}`);
    }
    localStorage.removeItem('exploradorEstado_count');
}
//APENAS PARA DEBUG
limparEstadoERecarregar() {
  this.limparEstadoLocal();
  this.games = [];
  this.filteredGames = [];
  this.searchResults = [];
  this.filteredSearchResults = [];
  this.currentPage = 1;
  this.apiPage = 1;
  this.searchApiPage = 1;
  this.temMaisJogos = true;
  this.searchHasMore = true;
  this.ultimaPaginaIncompleta = false;
  this.jogosDaUltimaPagina = 0;
  this.paginasConsecutivasIncompletas = 0;
  
  // Recarrega os dados
  if (this.isSearchMode && this.searchTerm) {
      this.performSearch(this.searchTerm);
  } else {
      this.loadInitialGames();
  }
}
  /* ==============================================
     7. CARREGAMENTO DE DADOS
  ============================================== */

  private async loadInitialGames() {
    try {
      // Reset de paginação
      this.completelyResetPagination('normal');
      this.apiPage = 1;
  
      // Carregar jogos
      const response = await lastValueFrom(this.apiService.buscarJogos(this.apiPage));
      
      // Processar completamente os jogos antes de atribuir
      this.games = response.games.map(game => {
        // Qualquer processamento adicional de jogos
        return {
          ...game,
          // Processamentos adicionais se necessário
        };
      });
  
      this.temMaisJogos = response.pagination.hasMore;
  
      // Aplicar filtros e ordenação
      if (this.sortBy === 'relevance') {
        this.filteredGames = [...this.games];
      } else {
        this.applyFilters(true);
      }
  
      // Atualizar páginas
      this.updateVisiblePages();
  
    } catch (error) {
      console.error('Erro ao carregar jogos:', error);
      this.filteredGames = [];
    }
  }


  private ultimaPaginaIncompleta: boolean = false;
  private jogosDaUltimaPagina: number = 0;
  private ultimaPaginaConfirmada: boolean = false;
  private paginasConsecutivasIncompletas: number = 0;
  lastKnownValidPage: number = 1;

  async carregarMaisJogos() {
    if (this.isSearchMode) {
      return this.carregarMaisResultadosBusca();
    }
    if (!this.temMaisJogos) {
        return false; // Retorna false para indicar que não carregou novos jogos
    }

    this.carregandoMais = true;
    this.gerenciarTimersLoading(true, true); 
    try {
        const resultado = await this.carregarJogosComRetry(3, 1500);
        
        if (!resultado.sucesso || !resultado.dados?.games?.length) {
            console.log('Não há mais jogos para carregar');
            this.temMaisJogos = false;
            return false;
        }
        
        // Verifica se recebemos jogos repetidos
        const jogosAntigos = new Set(this.games.map(g => g.id));
        const novosJogos = resultado.dados.games.filter(g => !jogosAntigos.has(g.id));

        const maxTentativasSemNovosJogos = this.genreFilterMode === 'exclusive' ? 4 : 6;

        if (novosJogos.length === 0) {
            this.paginasConsecutivasIncompletas++;
            if (this.paginasConsecutivasIncompletas >= maxTentativasSemNovosJogos) {
                console.log('Não há mais jogos novos disponíveis');
                this.temMaisJogos = false;
                return false;
            }
        } else {
            this.paginasConsecutivasIncompletas = 0;
            
            // Adiciona novos jogos sem duplicatas
            this.games = [...this.games, ...novosJogos];
            this.apiPage++;

            // Limpa qualquer duplicata que possa ter ocorrido
            if (this.games.length > jogosAntigos.size + novosJogos.length) {
                this.eliminarDuplicatas();
            } else {
                await this.applyFilters(false);
            }
            
            // Retorna true quando carregamos novos jogos com sucesso
            return true;
        }

        // Verifica se precisamos carregar mais
        if (this.temMaisJogos && 
            this.filteredGames.length < (this.currentPage * this.itemsPerPage) && 
            this.paginasConsecutivasIncompletas < maxTentativasSemNovosJogos) {
            setTimeout(() => {
                this.carregandoMais = false;
                this.carregarMaisJogos();
            }, 1500);
        }
        
        return false; // Se não adicionou novos jogos
          
    } catch (error) {
        console.error('Erro ao carregar mais jogos:', error);
        return false;
    } finally {
        this.carregandoMais = false;
        this.gerenciarTimersLoading(false, false);
    }
  }

  private async loadGenres() {
    try {
      const response = await lastValueFrom(this.apiService.buscarCategorias());
      
      // Extrair os gêneros da resposta
      this.genres = response.map(c => c.value.genre);
      
      // Criar uma cópia do estado atual
      const oldSelectedGenres = {...this.selectedGenres};
      
      // Reinicializar selectedGenres
      this.selectedGenres = {};
      
      // Para cada gênero disponível, manter seleção anterior ou definir como true (padrão)
      this.genres.forEach(genre => {
        // Se não houver estado anterior ou não encontramos o gênero no estado antigo, 
        // selecione-o por padrão (true)
        this.selectedGenres[genre] = oldSelectedGenres[genre] !== undefined ? 
          oldSelectedGenres[genre] : true;
      });
      
      // Se todos os gêneros estiverem desmarcados, marque todos como true
      const temAlgumSelecionado = Object.values(this.selectedGenres).some(value => value === true);
      if (!temAlgumSelecionado) {
        this.genres.forEach(genre => {
          this.selectedGenres[genre] = true;
        });
      }
      
      this.genresLoaded = true;
      
      // Aplicar filtros apenas se não estiver no modo de busca
      if (!this.isSearchMode) {
        this.applyFilters(false);
      }
    } catch (error) {
      this.genresLoaded = true;
    }
  }

  private async carregarJogosComRetry(maxTentativas = 3, delayInicial = 1000) {
    let tentativa = 0;
    let delayMs = delayInicial;
    
    while (tentativa < maxTentativas) {
        try {
            // Correção na lógica dos gêneros ativos
            const generosAtivos = this.genreFilterMode === 'exclusive' ? 
                Object.keys(this.selectedGenres).filter(g => this.selectedGenres[g]) : 
                [];
                
            const response = await lastValueFrom(
                this.apiService.buscarJogos(this.apiPage, 500, generosAtivos)
            );
            
            return { 
                sucesso: true, 
                dados: response,
                mensagem: 'Sucesso'
            };
        } catch (error) {
            console.warn(`Tentativa ${tentativa + 1} falhou. Tentando novamente em ${delayMs}ms`);
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

  async forcarCarregamentoMaisJogos() {
    this.carregandoMais = true;
    
    try {
      for (let i = 0; i < 3; i++) {
        this.apiPage++;
        
        const resultado = await this.carregarJogosComRetry(3, 1000);
        
        if (resultado.sucesso) {
          const novosJogos = resultado.dados!.games.filter(
            game => !this.games.some(g => g.id === game.id)
          );
          
          if (novosJogos.length > 0) {
            this.games = [...this.games, ...novosJogos];
            this.applyFilters(false);
            this.temMaisJogos = true;
            break;
          }
        }
        
        if (i === 2) {
          this.temMaisJogos = false;
        }
      }
    } finally {
      this.carregandoMais = false;
    }
  }

  /* ==============================================
     8. BUSCA DE JOGOS
  ============================================== */

  onSearch() {
    const termo = this.searchTerm?.trim();
    
    if (!termo) {
      // Tratamento especial para busca vazia
      if (this.isSearchMode) {
        // Desativar loading imediatamente
        this.loading = false;
        this.preLoading = false;
        
        // Processar imediatamente sem usar o observable
        this.performSearch('');
        
        // Reseta o lastSearchTerm ao sair do modo busca
        this.lastSearchTerm = '';
      }
    } else {
      // Se estamos voltando do explorador, resetamos o lastSearchTerm
      // para garantir que a busca será processada
      if (!this.isSearchMode) {
        this.lastSearchTerm = '';
      }
      
      // Envia o termo para o subject
      this.searchSubject.next(termo);
    }
  }
  
  private completelyResetPagination(mode: 'search' | 'normal') {
    if (mode === 'normal') {
      // Completely reset all pagination values for normal mode
      this.currentPage = 1;
      this.apiPage = 1; // Reset API page number
      this.temMaisJogos = true; // Force this to true
      this.paginasConsecutivasIncompletas = 0;
      
      // Reset normal state object
      Object.assign(this.paginationStates.normal, {
        currentPage: 1,
        totalPages: 1,
        hasMorePages: true,
        lastIncomplete: false,
        consecutiveIncomplete: 0
      });
    } else {
      // Completely reset search pagination
      this.searchApiPage = 1;
      this.searchHasMore = true;
      
      // Reset search state object
      Object.assign(this.paginationStates.search, {
        currentPage: 1,
        totalPages: 1,
        hasMorePages: true,
        lastIncomplete: false,
        consecutiveIncomplete: 0
      });
    }
    
    // Force pagination update
    this.updateVisiblePages();
  }
 
  private async performSearch(term: string) {
    if (!term?.trim()) {
      if (this.isSearchMode) {
        // Desativar loading imediatamente para este caso específico
        this.loading = false;
        this.preLoading = false;
        
        // Salvar estado da busca
        this.paginationStates.search.currentPage = this.currentPage;
        this.paginationStates.search.hasMorePages = this.searchHasMore;
        
        // Restaurar estado da paginação normal
        const normalState = this.paginationStates.normal;
        this.currentPage = normalState.currentPage;
        this.temMaisJogos = normalState.hasMorePages;
        
        // Usar requestAnimationFrame para garantir atualização imediata da UI
        requestAnimationFrame(() => {
          // Limpar resultados da busca
          this.searchResults = [];
          this.filteredSearchResults = [];
          
          // Mudar para modo normal antes da atualização visual
          this.isSearchMode = false;
          
          // Atualizar UI
          this.updateVisiblePages();
          
          // Forçar uma atualização adicional
          this.changeDetectorRef.detectChanges();
        });
      }
      return;
    }
    
    this.setLoading(true);

    this.isSearchMode = true;

    const tempoMinimoLoading = 1000; // 1 segundo
    const inicioLoading = Date.now();
    
    const termNormalizado = term.trim().toLowerCase();
    
    // Verificar se já temos um estado salvo para este termo
    const termState = this.getSearchTermState(termNormalizado);
    
    // MUDANÇA IMPORTANTE: Definir imediatamente o modo de busca para esconder os jogos normais
    this.isSearchMode = true;
    
    // Verificar se temos resultados em cache para este termo exato
    if (termState.totalResults > 0 && termState.apiPageReached > 0) {
        // Recuperar explicitamente os resultados do termo atual
        // Esta é a parte que precisamos modificar para garantir que os resultados sejam atualizados
        
        // Limpar resultados antigos e carregar os novos
        this.searchResults = [];
        this.filteredSearchResults = [];
        
        // Aqui vamos buscar os resultados na API novamente
        try {
            // Fazer a requisição de busca
            const response = await lastValueFrom(this.apiService.buscarJogoPorNome(termNormalizado, 1));
            
            if (response && response.games && response.games.length > 0) {
                // Processar os resultados
                this.searchResults = response.games.map((game: Game) => ({
                    ...game,
                    genres: game.genres || []
                }));
                
                // Atualizar flag de mais resultados com base na resposta da API
                this.searchHasMore = response.pagination.hasMore;
                
                // Atualizar o estado da paginação de busca
                this.paginationStates.search.hasMorePages = this.searchHasMore;
                this.paginationStates.search.currentPage = 1;
                this.paginationStates.search.consecutiveIncomplete = 0;
                this.currentPage = 1;
                
                // Atualizar o estado para este termo de busca
                this.updateSearchTermState(termNormalizado, {
                    hasMore: this.searchHasMore,
                    totalResults: this.searchResults.length,
                    apiPageReached: 1, // Começamos na página 1
                    lastPage: 1
                });
                
                // Aplicar filtros sem resetar a página (já está na página 1)
                await this.applySearchFilters(true);
                
                // Atualizar a UI após todas as operações
                this.updateVisiblePages();
                
                // Salvar o estado
                this.salvarEstadoNoLocal();
                
                // Garantir tempo mínimo de loading para feedback visual
                this.garantirTempoMinimoLoading(inicioLoading, tempoMinimoLoading);
            } else {
                // Tratar caso de nenhum resultado
                this.searchResults = [];
                this.searchHasMore = false;
                this.filteredSearchResults = [];
                this.paginationStates.search.hasMorePages = false;
                
                // Armazenar que este termo não tem resultados
                this.updateSearchTermState(termNormalizado, {
                    hasMore: false,
                    totalResults: 0,
                    apiPageReached: 1,
                    lastPage: 1
                });
                
                this.updateVisiblePages();
                
                // Garantir tempo mínimo de loading para feedback visual
                this.garantirTempoMinimoLoading(inicioLoading, tempoMinimoLoading);
            }
        } catch (error) {
            console.error('Erro na busca:', error);
            this.searchResults = [];
            this.searchHasMore = false;
            this.filteredSearchResults = [];
            this.paginationStates.search.hasMorePages = false;
            this.updateVisiblePages();
            
            // Garantir tempo mínimo de loading para feedback visual
            this.garantirTempoMinimoLoading(inicioLoading, tempoMinimoLoading);
        }
        
        return;
    }
    
    // Limpar resultados anteriores ANTES de buscar novos
    this.searchResults = [];
    this.filteredSearchResults = [];
    
    // Reset completo do estado de paginação da busca
    this.completelyResetPagination('search');
    
    // Atualizar UI imediatamente para mostrar loading sem jogos antigos
    this.updateVisiblePages();
    
    try {
        // Fazer a requisição de busca
        const response = await lastValueFrom(this.apiService.buscarJogoPorNome(termNormalizado, this.searchApiPage));
        
        if (response && response.games && response.games.length > 0) {
            // Processar os resultados
            this.searchResults = response.games.map((game: Game) => ({
                ...game,
                genres: game.genres || []
            }));
            
            // Atualizar flag de mais resultados com base na resposta da API
            this.searchHasMore = response.pagination.hasMore;
            
            // Atualizar o estado da paginação de busca
            this.paginationStates.search.hasMorePages = this.searchHasMore;
            this.paginationStates.search.currentPage = 1;
            this.paginationStates.search.consecutiveIncomplete = 0;
            
            // Armazenar o estado para este termo de busca
            this.updateSearchTermState(termNormalizado, {
                hasMore: this.searchHasMore,
                totalResults: this.searchResults.length,
                apiPageReached: this.searchApiPage,
                lastPage: 1
            });
            
            // Aplicar filtros sem resetar a página (já está na página 1)
            await this.applySearchFilters(true);
            
            // Atualizar a UI após todas as operações
            this.updateVisiblePages();
            
            // Salvar o estado
            this.salvarEstadoNoLocal();
            
            // Garantir tempo mínimo de loading para feedback visual
            this.garantirTempoMinimoLoading(inicioLoading, tempoMinimoLoading);
        } else {
            // Tratar caso de nenhum resultado
            this.searchResults = [];
            this.searchHasMore = false;
            this.filteredSearchResults = [];
            this.paginationStates.search.hasMorePages = false;
            
            // Armazenar que este termo não tem resultados
            this.updateSearchTermState(termNormalizado, {
                hasMore: false,
                totalResults: 0,
                apiPageReached: this.searchApiPage,
                lastPage: 1
            });
            
            this.updateVisiblePages();
            
            // Garantir tempo mínimo de loading para feedback visual
            this.garantirTempoMinimoLoading(inicioLoading, tempoMinimoLoading);
        }
    } catch (error) {
        console.error('Erro na busca:', error);
        this.searchResults = [];
        this.searchHasMore = false;
        this.filteredSearchResults = [];
        this.paginationStates.search.hasMorePages = false;
        this.updateVisiblePages();
        
        // Garantir tempo mínimo de loading para feedback visual
        this.garantirTempoMinimoLoading(inicioLoading, tempoMinimoLoading);
    }
  }

  disableNextArrow: boolean = false;

  private garantirTempoMinimoLoading(inicioLoading: number, tempoMinimo: number): Promise<void> {
    const tempoDecorrido = Date.now() - inicioLoading;
    const tempoRestante = Math.max(0, tempoMinimo - tempoDecorrido);
    
    if (tempoRestante > 0) {
        return new Promise<void>(resolve => {
            setTimeout(() => {
                this.setLoading(false);
                resolve();
            }, tempoRestante);
        });
    } else {
        this.setLoading(false);
        return Promise.resolve();
    }
  }
  
  async carregarMaisResultadosBusca() {
    const state = this.getCurrentPaginationState();
    if (!this.searchHasMore || this.carregandoMais) return false;
    
    this.carregandoMais = true;
    const termNormalizado = this.searchTerm.trim().toLowerCase();
    const termState = this.getSearchTermState(termNormalizado);
    
    try {
        this.searchApiPage++;
        
        const response = await lastValueFrom(
            this.apiService.buscarJogoPorNome(this.searchTerm, this.searchApiPage)
        );
        
        if (response && response.games) {
            // Criar Set com IDs existentes para evitar duplicatas
            const existingIds = new Set(this.searchResults.map(game => game.id));
            
            // Filtrar apenas jogos novos
            const newGames = response.games
                .filter((game: Game) => !existingIds.has(game.id))
                .map((game: Game) => ({
                    ...game,
                    genres: game.genres || []
                }));
            
            // Caso 1: Recebemos novos jogos da API
            if (newGames.length > 0) {
                this.searchResults = [...this.searchResults, ...newGames];
                
                // Atualizar o estado hasMore da API
                this.searchHasMore = response.pagination.hasMore;
                state.hasMorePages = response.pagination.hasMore;
                
                // Atualizar o estado específico deste termo de busca
                this.updateSearchTermState(termNormalizado, {
                    hasMore: this.searchHasMore,
                    totalResults: this.searchResults.length,
                    apiPageReached: this.searchApiPage
                });
                
                // Resetar contador de páginas incompletas consecutivas
                state.consecutiveIncomplete = 0;
                
                // Se recebemos menos jogos que o esperado e a API diz que não há mais,
                // marcamos como último lote incompleto
                if (newGames.length < state.itemsPerPage && !response.pagination.hasMore) {
                    state.lastIncomplete = true;
                } else {
                    state.lastIncomplete = false;
                }
                
                await this.applySearchFilters(false);
                
                // ADICIONADO: Forçar atualização das páginas visíveis
                this.updateVisiblePages();
                return true;
            } 
            // Caso 2: API retornou jogos, mas todos são duplicatas
            else if (response.games.length > 0) {
                // Se a API retornou jogos (mesmo duplicados) e diz que tem mais, tentamos novamente
                if (response.pagination.hasMore && 
                    state.consecutiveIncomplete < state.maxAttempts) {
                    state.consecutiveIncomplete++;
                    setTimeout(() => {
                        this.carregandoMais = false;
                        this.carregarMaisResultadosBusca();
                    }, 300);
                    return false;
                } 
                // Se a API retornou só duplicatas e diz que não tem mais, realmente acabou
                else {
                    this.searchHasMore = false;
                    state.hasMorePages = false;
                    state.lastIncomplete = true;
                    
                    // Atualizar o estado específico deste termo
                    this.updateSearchTermState(termNormalizado, {
                        hasMore: false,
                        apiPageReached: this.searchApiPage
                    });
                    
                    // ADICIONADO: Forçar atualização das páginas visíveis
                    this.updateVisiblePages();
                    return false;
                }
            }
            // Caso 3: API não retornou nenhum jogo
            else {
                this.searchHasMore = false;
                state.hasMorePages = false;
                state.lastIncomplete = true;
                
                // Atualizar o estado específico deste termo
                this.updateSearchTermState(termNormalizado, {
                    hasMore: false,
                    apiPageReached: this.searchApiPage
                });
                
                // ADICIONADO: Forçar atualização das páginas visíveis
                this.updateVisiblePages();
                return false;
            }
        } else {
            // Nenhum resultado retornado da API
            this.searchHasMore = false;
            state.hasMorePages = false;
            state.lastIncomplete = true;
            
            // Atualizar o estado específico deste termo
            this.updateSearchTermState(termNormalizado, {
                hasMore: false,
                apiPageReached: this.searchApiPage
            });
            
            // ADICIONADO: Forçar atualização das páginas visíveis
            this.updateVisiblePages();
            return false;
        }
    } catch (error) {
        console.error('Erro ao carregar mais resultados de busca:', error);
        state.consecutiveIncomplete++;
        if (state.consecutiveIncomplete >= state.maxAttempts) {
            this.searchHasMore = false;
            state.hasMorePages = false;
            state.lastIncomplete = true;
            
            // Atualizar o estado específico deste termo
            this.updateSearchTermState(termNormalizado, {
                hasMore: false,
                apiPageReached: this.searchApiPage
            });
            
            // ADICIONADO: Forçar atualização das páginas visíveis
            this.updateVisiblePages();
        }
        return false;
    } finally {
        this.carregandoMais = false;
    }
  }

  /* ==============================================
     9. FILTROS E ORDENAÇÃO
  ============================================== */
  private async applyFilters(resetPage: boolean = true) {
    const state = this.getCurrentPaginationState();
    try {
        this.ensureLoadingCompletes();
        if (resetPage) {
            this.currentPage = 1;
        }

        // Verifica se há gêneros selecionados
        if (!this.hasSelectedGenres) {
            this.filteredGames = [];
            this.updateVisiblePages();
            this.loading = true
            this.showNoGenresMessage = true;
            return;
        }
        if (!this.hasSelectedPlatforms) {
          this.filteredGames = [];
          this.updateVisiblePages();
          this.setLoading(false); // Use o método setLoading para gerenciar corretamente
          this.showNoPlatformsMessage = true; // Adicione esta propriedade no componente
          return;
      }
        // Ativa o loading
        this.loading = true

        // Filtra os jogos atuais
        let filtered = this.filterByGenres([...this.games]);
        filtered = this.filterByRating(filtered);
        filtered = this.filterByPlatforms(filtered); 

        // Aplica a ordenação
        if (this.sortBy !== 'relevance') {
            filtered = this.sortGames(filtered);
        }

        // Determina se precisamos de mais jogos
        const jogosNecessarios = this.itemsPerPage * this.currentPage;
        const precisaMaisJogos = filtered.length < jogosNecessarios && this.temMaisJogos;

        // Lógica específica para o modo exclusivo
        if (this.genreFilterMode === 'exclusive') {
            let tentativas = 0;
            const MAX_TENTATIVAS = 10; // Número máximo de tentativas para carregar mais jogos

            // Enquanto precisamos de mais jogos e ainda há tentativas disponíveis
            while (precisaMaisJogos && tentativas < MAX_TENTATIVAS) {
                const jogosAntes = filtered.length;

                // Carrega mais jogos
                await this.carregarMaisJogos();

                // Reaplica os filtros após carregar mais jogos
                filtered = this.filterByGenres([...this.games]);
                filtered = this.filterByRating(filtered);
                filtered = this.filterByPlatforms(filtered); 
                filtered = this.sortGames(filtered);

                // Se não conseguimos novos jogos após o carregamento
                if (filtered.length <= jogosAntes) {
                    tentativas++;
                } else {
                    tentativas = 0; // Reseta o contador de tentativas se obtivermos novos jogos
                }

                // Atualiza a flag de necessidade de mais jogos
                if (filtered.length >= jogosNecessarios) {
                    break;
                }
            }

            // Se esgotamos as tentativas sem conseguir novos jogos
            if (tentativas >= MAX_TENTATIVAS) {
                this.temMaisJogos = false;
            }
        } else {
            // Lógica para outros modos (inclusivo, busca, etc.)
            if (precisaMaisJogos) {
                await this.carregarMaisJogos();
                filtered = this.filterByGenres([...this.games]);
                filtered = this.filterByRating(filtered);
                filtered = this.filterByPlatforms(filtered); 
                filtered = this.sortGames(filtered);
            }
        }

        // Atualiza os jogos filtrados
        this.filteredGames = filtered;
        this.updateVisiblePages();

    } catch (error) {
        console.error('Erro ao aplicar filtros:', error);
    } finally {
        // Desativa o loading ao finalizar
        this.loading = false
    }
}

private async applySearchFilters(resetPage: boolean = true) {
  try {
    if (resetPage) {
      this.currentPage = 1;
    }

    // Verificar se temos resultados de busca, senão realizar a busca novamente
    if (this.searchResults.length === 0 && this.searchTerm) {
      return; 
    }
    console.log('Resultados de busca:', this.searchResults);
    console.log('Primeiro jogo (plataformas):', this.searchResults[0]?.platforms);
    let filtered = this.filterByGenres([...this.searchResults]);
    filtered = this.filterByRating(filtered);
    filtered = this.filterByPlatforms(filtered);  // Filtro de plataformas adicionado aqui
    
    // Aplicar ordenação
    filtered = this.sortGames(filtered);
    
    this.filteredSearchResults = filtered;
    this.updateVisiblePages();
    
    // Adicionar lógica para carregar mais resultados se necessário
    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    
    const jogosNecessarios = this.currentPage * this.itemsPerPage;
    while (filtered.length < jogosNecessarios && 
           this.searchHasMore && 
           !this.carregandoMais && 
           attempts < MAX_ATTEMPTS) {
      
      await this.carregarMaisResultadosBusca();
      
      // Reapply filters after loading more results
      filtered = this.filterByGenres([...this.searchResults]);
      filtered = this.filterByRating(filtered);
      filtered = this.filterByPlatforms(filtered);
      filtered = this.sortGames(filtered);
      this.filteredSearchResults = filtered;
      attempts++;
      
      // If we're not getting more results, break out of the loop
      if (filtered.length === 0 || 
          (attempts > 1 && filtered.length === this.filteredSearchResults.length)) {
        break;
      }
    }
  } catch (error) {
    console.error('Erro ao aplicar filtros de busca:', error);
  }
}

  private ensureLoadingCompletes() {
    // Garantir um tempo mínimo de loading para feedback visual
    const loadingStarted = this.loadingStartTime || Date.now();
    const elapsedTime = Date.now() - loadingStarted;
    const minLoadingTime = 500; // 500ms como tempo mínimo de loading
    
    if (elapsedTime < minLoadingTime) {

      return new Promise(resolve => {
        setTimeout(resolve, minLoadingTime - elapsedTime);
      });
    }
    
    return Promise.resolve();
  }
  
  private filterByGenres(games: Game[]): Game[] {
    const selectedGenresList = Object.entries(this.selectedGenres || {})
        .filter(([_, selected]) => selected)
        .map(([genre]) => genre);

    // Se não há gêneros selecionados E não incluímos jogos sem gênero
    if (selectedGenresList.length === 0 && !this.includeNoGenre) {
        this.shouldShowPagination = false;
        return [];
    }

    return games.filter(game => {
        // Se o jogo não tem gêneros
        if (!Array.isArray(game.genres) || game.genres === null || game.genres.length === 0) {
            return this.includeNoGenre;
        }

        // Se temos APENAS jogos sem gênero selecionado (nenhum gênero regular)
        if (selectedGenresList.length === 0 && this.includeNoGenre) {
            return false; // Queremos apenas jogos sem gênero neste caso
        }

        const gameGenres = typeof game.genres[0] === 'object' && game.genres[0] !== null
            ? game.genres.map((g: any) => g.name)
            : game.genres;

        if (this.genreFilterMode === 'inclusive') {
            return selectedGenresList.some(genre => gameGenres.includes(genre));
        } else {
            const temTodosGenerosSelecionados = selectedGenresList.every(genre => 
                gameGenres.includes(genre)
            );

            const naoTemGenerosAdicionais = gameGenres.every(genre => 
                selectedGenresList.includes(genre)
            );

            return temTodosGenerosSelecionados && naoTemGenerosAdicionais;
        }
    });
}
  
private filterByRating(games: any[]): any[] {
  if (!this.selectedRating) return games;
  const minRating = parseInt(this.selectedRating);
  return games.filter(game => game.total_rating >= minRating);
}
  
private sortGames(games: any[]): any[] {
  if (!games || games.length === 0) return [];
  
  return [...games].sort((a, b) => {
    switch (this.sortBy) {
      case 'relevance': 
        // Ordenar por popularity_value se disponível, ou manter a ordem original
        const aValue = a.popularity_value !== undefined ? a.popularity_value : 0;
        const bValue = b.popularity_value !== undefined ? b.popularity_value : 0;
        return bValue - aValue;
      case 'rating': 
        return (b.total_rating || 0) - (a.total_rating || 0);
      case 'name': 
        return a.name.localeCompare(b.name);
      default: 
        return 0;
    }
  });
}


  /* ==============================================
     10. GESTÃO DE GÊNEROS
  ============================================== */
  get hasSelectedGenres(): boolean {
    // Se jogos sem gênero está selecionado, já considera como tendo seleção válida
    if (this.includeNoGenre) {
        return true;
    }
    
    // Se não, verifica se há algum gênero regular selecionado
    return this.genres.some(genre => this.selectedGenres[genre] === true);
}

  get allGenresSelected(): boolean {
    return Object.values(this.selectedGenres).every(value => value);
  }

  get hasAnyGenreSelected(): boolean {
    return Object.values(this.selectedGenres).some(selected => selected);
 }

  // Getter para verificar se os gêneros devem estar desabilitados
  get isNoGenreMode(): boolean {
      return this.genreFilterMode === 'exclusive' && this.includeNoGenre;
  }

  // Getter para verificar se "Jogos sem gênero" deve estar desabilitado
  get isGenreSelectionDisabled(): boolean {
      return this.genreFilterMode === 'exclusive' && this.hasAnyGenreSelected;
  }
  includeNoGenre: boolean = true;

  toggleNoGenre() {
    this.includeNoGenre = !this.includeNoGenre;
    
    // Reset do estado da paginação
    const state = this.getCurrentPaginationState();
    state.currentPage = 1;
    this.currentPage = 1;
    state.consecutiveIncomplete = 0;
    state.lastIncomplete = false;
    state.hasMorePages = true;
    
    // Determinar se devemos mostrar a mensagem de "sem gêneros selecionados"
    const temGenerosAtivos = Object.values(this.selectedGenres).some(selected => selected);
    
    if (!temGenerosAtivos && !this.includeNoGenre) {
        this.showNoGenresMessage = true;
        
        // Limpar os resultados filtrados dependendo do modo
        if (this.isSearchMode) {
            this.filteredSearchResults = [];
        } else {
            this.filteredGames = [];
        }
        
        this.updateVisiblePages();
        return;
    }
    
    // Aplicar os filtros apropriados com base no modo atual
    if (this.isSearchMode) {
        this.applySearchFilters(true);
    } else {
        this.applyFilters(true);
    }
    
    this.updateVisiblePages();
}

toggleGenre(genre: string) {
    if (this.genreFilterMode === 'exclusive') {
      const generosSelecionados = Object.values(this.selectedGenres).filter(selected => selected).length;
      const estadoAnterior = this.selectedGenres[genre];
      
      // Se estiver tentando selecionar mais um gênero
      if (!estadoAnterior && generosSelecionados >= 6) {
          // Aqui você pode adicionar uma notificação para o usuário se quiser
          console.warn('Limite de 6 gêneros atingido no modo exclusivo');
          return;
      }
  }

  // Resto do código existente...
  const estadoAnterior = this.selectedGenres[genre];
    this.selectedGenres[genre] = !estadoAnterior;

    const state = this.getCurrentPaginationState();
    
    // Reset do estado da paginação
    state.currentPage = 1;
    this.currentPage = 1;
    state.consecutiveIncomplete = 0;
    state.lastIncomplete = false;
    state.hasMorePages = true;

    // Verifica se ainda há algum gênero selecionado
    const haveraSelecionados = Object.values(this.selectedGenres).some(selected => selected);

    // Se não haverá nenhum gênero selecionado
    if (!haveraSelecionados) {
        if (this.includeNoGenre) {
            // Se jogos sem gênero está ativo, mostra apenas eles
            this.showNoGenresMessage = false;
            if (this.isSearchMode) {
                this.applySearchFilters(true);
            } else {
                this.applyFilters(true);
            }
        } else {
            // Se não há jogos sem gênero selecionado, mostra mensagem
            if (this.isSearchMode) {
                this.filteredSearchResults = [];
            } else {
                this.filteredGames = [];
            }
            this.showNoGenresMessage = true;
            
            requestAnimationFrame(() => {
                this.updateVisiblePages();
                const paginationElement = document.querySelector('.pagination-container');
                if (paginationElement) {
                    paginationElement.classList.remove('visible');
                }
            });
        }
        
        this.salvarEstadoNoLocal();
        return;
    }

// Se haverá gêneros selecionados
this.showNoGenresMessage = false;

// Verifica se já temos jogos suficientes antes de mostrar loading
const source = this.isSearchMode ? this.searchResults : this.games;
const filtered = this.filterByGenres([...source]);
const jogosNecessarios = state.itemsPerPage;

if (filtered.length >= jogosNecessarios) {
    // Se já temos jogos suficientes, aplica os filtros sem loading
    if (this.isSearchMode) {
        this.filteredSearchResults = this.filterByRating(filtered);
        this.filteredSearchResults = this.sortGames(this.filteredSearchResults);
    } else {
        this.filteredGames = this.filterByRating(filtered);
        this.filteredGames = this.sortGames(this.filteredGames);
    }

    this.updateVisiblePages();
    // Importante: verificar se há jogos filtrados antes de mostrar a paginação
    const temJogos = this.isSearchMode ? 
        this.filteredSearchResults.length > 0 : 
        this.filteredGames.length > 0;

    requestAnimationFrame(() => {
        const paginationContainer = document.querySelector('.pagination-container');
        if (paginationContainer) {
            if (temJogos) {
                paginationContainer.classList.add('visible');
            } else {
                paginationContainer.classList.remove('visible');
            }
        }
    });
    
    this.salvarEstadoNoLocal();
    return;
}

// Se não temos jogos suficientes, mostra loading
this.setLoading(true);

Promise.resolve().then(async () => {
    try {
        if (this.isSearchMode) {
            await this.applySearchFilters(true);
        } else {
            await this.applyFilters(true);
        }
        
        // Importante: verificar se há jogos após aplicar os filtros
        const temJogos = this.isSearchMode ? 
            this.filteredSearchResults.length > 0 : 
            this.filteredGames.length > 0;

        requestAnimationFrame(() => {
            const paginationContainer = document.querySelector('.pagination-container');
            if (paginationContainer) {
                if (temJogos) {
                    paginationContainer.classList.add('visible');
                } else {
                    paginationContainer.classList.remove('visible');
                }
            }
        });
        
        this.salvarEstadoNoLocal();
    } catch (error) {
        console.error('Erro ao aplicar filtros:', error);
    } finally {
        this.setLoading(false);
    }
});
}

getSelectedGenresCount(): number {
  return Object.values(this.selectedGenres).filter(selected => selected).length;
}
toggleAllGenres() {
  const newState = !this.allGenresSelected;
  const state = this.getCurrentPaginationState();
  
  // Reset do estado da paginação
  state.currentPage = 1;
  this.currentPage = 1;
  state.consecutiveIncomplete = 0;
  state.lastIncomplete = false;
  state.hasMorePages = true;

  this.genres.forEach(genre => this.selectedGenres[genre] = newState);

  // Se estiver desativando todos os gêneros, verifica se tem jogos sem gênero
  if (!newState) {
    if (this.includeNoGenre) {
        // Se jogos sem gênero está ativo, mostra apenas eles
        this.showNoGenresMessage = false;
        
        // Ativar o loading aqui explicitamente
        this.setLoading(true);
        
        // Aplicar filtros em um Promise para garantir que o loading seja visível
        Promise.resolve().then(async () => {
            try {
                if (this.isSearchMode) {
                    await this.applySearchFilters(true);
                } else {
                    await this.applyFilters(true);
                }
                
                // Atualizar a visibilidade da paginação
                requestAnimationFrame(() => {
                    const paginationElement = document.querySelector('.pagination-container');
                    if (paginationElement) {
                        if (this.isSearchMode ? this.filteredSearchResults.length > 0 : this.filteredGames.length > 0) {
                            paginationElement.classList.add('visible');
                        } else {
                            paginationElement.classList.remove('visible');
                        }
                    }
                });
            } finally {
                this.setLoading(false);
            }
        });
    } else {
          // Se não há jogos sem gênero selecionado, mostra mensagem
          if (this.isSearchMode) {
              this.filteredSearchResults = [];
          } else {
              this.filteredGames = [];
          }
          this.showNoGenresMessage = true;
          
          requestAnimationFrame(() => {
              this.updateVisiblePages();
              const paginationElement = document.querySelector('.pagination-container');
              if (paginationElement) {
                  paginationElement.classList.remove('visible');
              }
          });
      }
      
      this.salvarEstadoNoLocal();
      return;
  }
  
  // Se estiver ativando todos os gêneros
  this.showNoGenresMessage = false;
  
  // Verifica se já temos jogos suficientes antes de mostrar loading
  const source = this.isSearchMode ? this.searchResults : this.games;
  const filtered = this.filterByGenres([...source]); // Aplica o filtro de gêneros primeiro
  const jogosNecessarios = state.itemsPerPage;

  if (filtered.length >= jogosNecessarios) {
      // Se já temos jogos suficientes, aplica os filtros sem loading
      if (this.isSearchMode) {
          this.filteredSearchResults = this.filterByRating(filtered);
          this.filteredSearchResults = this.sortGames(this.filteredSearchResults);
      } else {
          this.filteredGames = this.filterByRating(filtered);
          this.filteredGames = this.sortGames(this.filteredGames);
      }

      requestAnimationFrame(() => {
          this.updateVisiblePages();
          const paginationElement = document.querySelector('.pagination-container');
          if (paginationElement) {
              paginationElement.classList.add('visible');
          }
      });
      
      this.salvarEstadoNoLocal();
      return;
  }

  // Se não temos jogos suficientes, mostra loading
  this.setLoading(true);
  Promise.resolve().then(async () => {
      try {
          if (this.isSearchMode) {
              await this.applySearchFilters(true);
          } else {
              await this.applyFilters(true);
          }
          
          requestAnimationFrame(() => {
              const paginationElement = document.querySelector('.pagination-container');
              if (paginationElement) {
                  paginationElement.classList.add('visible');
              }
          });
          
          this.salvarEstadoNoLocal();
      } catch (error) {
          console.error('Erro ao aplicar filtros:', error);
      } finally {
          this.setLoading(false);
      }
  });
}
selectSingleGenre(genre: string) {
  // Desativa todos os gêneros primeiro
  Object.keys(this.selectedGenres).forEach(g => {
      this.selectedGenres[g] = false;
  });
  this.includeNoGenre = false;

  // Ativa apenas o gênero selecionado
  if (this.genres.includes(genre)) {
      this.selectedGenres[genre] = true;
  }

  // Reset da paginação
  this.currentPage = 1;
  
  // Aplica os filtros
  if (this.isSearchMode) {
      this.applySearchFilters(true);
  } else {
      this.applyFilters(true);
  }

  // Atualiza a UI
  this.showNoGenresMessage = false;
  this.updateVisiblePages();
}

toggleNoGenreOnly() {
  // Desativa todos os gêneros
  Object.keys(this.selectedGenres).forEach(genre => {
      this.selectedGenres[genre] = false;
  });
  
  // Ativa apenas a opção de jogos sem gênero
  this.includeNoGenre = true;
  
  // Reset da paginação
  this.currentPage = 1;
  
  // Mostrar loading explicitamente
  this.setLoading(true);
  
  // Aplicar filtros dentro de uma Promise para garantir que o loading seja visível
  Promise.resolve().then(async () => {
      try {
          if (this.isSearchMode) {
              await this.applySearchFilters(true);
          } else {
              await this.applyFilters(true);
          }
          
          // Atualiza a UI
          this.showNoGenresMessage = false;
          this.updateVisiblePages();
          
          // Garantir visibilidade da paginação para mostrar resultados
          requestAnimationFrame(() => {
              const paginationElement = document.querySelector('.pagination-container');
              if (paginationElement && (this.isSearchMode ? this.filteredSearchResults.length > 0 : this.filteredGames.length > 0)) {
                  paginationElement.classList.add('visible');
              }
          });
      } finally {
          this.setLoading(false);
      }
  });
}

updateAllSelected() {
  const selectedGenresList = Object.keys(this.selectedGenres).filter(genre => this.selectedGenres[genre]);
  this.showNoGenresMessage = selectedGenresList.length === 0;
  
  // Mantém a paginação visível durante o loading
  const paginationElement = document.querySelector('.pagination-container');
  if (paginationElement) {
      paginationElement.classList.add('visible');
  }

  this.setLoading(true);

  setTimeout(async () => {
      try {
          if (this.isSearchMode) {
              await this.applySearchFilters(true);
          } else {
              await this.applyFilters(true);
          }
      } finally {
          // Garante que a paginação permaneça visível após o filtro
          requestAnimationFrame(() => {
              const paginationElement = document.querySelector('.pagination-container');
              if (paginationElement) {
                  paginationElement.classList.add('visible');
              }
          });
      }
  }, 100);
}

  /* ==============================================
     11. PAGINAÇÃO
  ============================================== */

  get pagedGames() {
    const source = this.isSearchMode ? this.filteredSearchResults : this.filteredGames;

    if (this.isSearchMode && this.loading && this.filteredSearchResults.length === 0) {
        return [];
    }
    
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    
    // Se estamos tentando acessar uma página além do disponível atualmente
    if (startIndex >= source.length && source.length > 0) {
        // Só ativamos o loading se temos mais jogos possíveis
        if (this.temMaisJogos && !this.loading && !this.carregandoMais) {
            this.setLoading(true);
            // Tentamos carregar mais jogos primeiro
            setTimeout(() => {
                this.carregarMaisJogos().then(() => {
                    // Verifica novamente após carregar mais jogos
                    if (startIndex >= this.filteredGames.length) {
                        // Se ainda não temos jogos suficientes, ajustamos para última página válida
                        const lastValidPage = Math.ceil(this.filteredGames.length / this.itemsPerPage);
                        if (this.currentPage > lastValidPage && lastValidPage > 0) {
                            this.currentPage = lastValidPage;
                        }
                        this.setLoading(false);
                    }
                });
            }, 0);
        }
        
        // Enquanto carrega, mostramos a última página válida
        const lastValidPage = Math.max(1, Math.ceil(source.length / this.itemsPerPage));
        const lastPageStartIndex = (lastValidPage - 1) * this.itemsPerPage;
        return source.slice(lastPageStartIndex, lastPageStartIndex + this.itemsPerPage);
    }
    
    // Temos conteúdo para esta página, então podemos desativar o loading
    // MODIFICAÇÃO: Não desativamos o loading aqui se estamos no modo de busca
    if (this.loading && !this.carregandoMais && endIndex <= source.length && !this.isSearchMode) {
        // Verificamos se não estamos na última página ou se não temos mais jogos
        const eUltimaPagina = this.currentPage === Math.ceil(source.length / this.itemsPerPage);
        if (!eUltimaPagina || !this.temMaisJogos) {
            // Desativamos o loading com um pequeno delay para evitar flickering
            setTimeout(() => this.setLoading(false), 50);
        }
    }
    
    return source.slice(startIndex, endIndex);
    }

    private lastConfirmedPage: number | null = null;
        
    get totalPages() {
      const state = this.getCurrentPaginationState();
      const source = this.isSearchMode ? this.filteredSearchResults : this.filteredGames;
      const calculatedPages = Math.ceil(source.length / state.itemsPerPage);
      
      const hasMoreContent = this.isSearchMode ? this.searchHasMore : this.temMaisJogos;
      if (!hasMoreContent) {
          return Math.max(1, calculatedPages);
      }

      if (this.loading || this.carregandoMais) {
          return Math.max(calculatedPages, this.currentPage);
      }

      const itemsOnLastPage = source.length % state.itemsPerPage;
      if (itemsOnLastPage === 0 && source.length > 0) {
          return calculatedPages + 1;
      }

      return Math.max(1, calculatedPages);
    }

    private eliminarDuplicatas() {
      // Uso de Map para preservar a ordem de inserção
      const jogosUnicos = new Map();
      
      // Adiciona jogos ao Map usando ID como chave
      this.games.forEach(game => {
          jogosUnicos.set(game.id, game);
      });
      
      // Converte o Map de volta para array
      this.games = Array.from(jogosUnicos.values());
      
      // Reaplica os filtros para garantir o estado correto
      this.applyFilters(false);
    }

    private updateVisiblePages() {
      const source = this.isSearchMode ? this.filteredSearchResults : this.filteredGames;
      const temJogos = source.length > 0;
      
      // Nova condição para verificar explicitamente se há resultados
      const hasAnyResults = this.isSearchMode ? 
        this.filteredSearchResults.length > 0 : 
        this.filteredGames.length > 0;

      let hasMoreResults = false;
      
      if (this.isSearchMode && this.searchTerm) {
          const termNormalizado = this.searchTerm.trim().toLowerCase();
          const termState = this.getSearchTermState(termNormalizado);
          hasMoreResults = termState.hasMore;
      } else {
          hasMoreResults = this.temMaisJogos;
      }

      // Atualizado para considerar resultados reais
      const shouldShow = (hasAnyResults || this.loading || this.carregandoMais) && 
                      (hasMoreResults || this.currentPage > 1 || hasAnyResults);

      // Atualização imediata para evitar atrasos visuais
      this.shouldShowPagination = shouldShow && hasAnyResults;
      
      // Se não houver jogos mas estamos carregando, ainda mostramos paginação
      if (!temJogos && (this.loading || this.carregandoMais)) {
          this.pagesToShow = [this.currentPage]; // Mostra a página atual
          return;
      }
      
      // Se realmente não há jogos e não estamos carregando, mostra apenas página 1
      if (!temJogos && !this.loading && !this.carregandoMais) {
          this.pagesToShow = [1];
          return;
      }

      const total = Math.max(this.totalPages, this.currentPage);
      const current = this.currentPage;
      const range = 1;
      let pages: (number | string)[] = [];

      pages.push(1);

      let start = Math.max(2, current - range);
      let end = Math.min(total - 1, current + range);

      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < total - 1) pages.push('...');
      if (total > 1) pages.push(total);

      if (!pages.includes(current)) {
        pages = [...pages, current].sort((a, b) => {
          if (typeof a === 'string') return 1;
          if (typeof b === 'string') return -1;
          return a - b;
        });
      }

      this.pagesToShow = [...new Set(pages)];
      
      // MODIFICADO: Usar o estado específico do termo atual para controlar a visibilidade da setinha
      if (this.isSearchMode && this.searchTerm) {
        const termNormalizado = this.searchTerm.trim().toLowerCase();
        const termState = this.getSearchTermState(termNormalizado);
        
        // Desabilitar a setinha apenas quando estamos na última página E não há mais resultados para ESTE termo específico
        this.disableNextArrow = this.currentPage === total && !termState.hasMore;
      } else {
        // Para o modo normal (não-busca), usar a lógica original
        this.disableNextArrow = this.currentPage === total && !this.temMaisJogos;
      }
  }

  private async executarMudancaPagina(page: number) {
    const state = this.getCurrentPaginationState();
    if (page === this.currentPage) return;
    // Se estamos indo para a última página e já sabemos que é a última
    if (!this.temMaisJogos && page === this.totalPages) {
        this.transitioning = true;
        document.querySelector('.games-grid')?.classList.remove('loaded');
        
        // Atualiza a página sem tentar carregar mais
        state.currentPage = page;
        this.currentPage = page;
        this.updateVisiblePages();
        await new Promise(resolve => setTimeout(resolve, 50));
        requestAnimationFrame(() => {
            document.querySelector('.games-grid')?.classList.add('loaded');
            this.transitioning = false;
        });
        
        this.salvarEstadoNoLocal();
        return;
    }
    state.currentPage = page;
    this.currentPage = page;
    this.updateVisiblePages();

    const source = this.isSearchMode ? this.filteredSearchResults : this.filteredGames;
    const startIndex = (page - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;

    this.transitioning = true;
    document.querySelector('.games-grid')?.classList.remove('loaded');

    // Se já temos os jogos necessários
    if (startIndex < source.length && 
        source.slice(startIndex, endIndex).length === state.itemsPerPage) {
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        requestAnimationFrame(() => {
            document.querySelector('.games-grid')?.classList.add('loaded');
            this.transitioning = false;
        });
        
        this.salvarEstadoNoLocal();
        return;
    }

    // Se precisamos carregar mais jogos
    this.setLoading(true);

    try {
        const jogosNecessarios = page * state.itemsPerPage;
        
        if (this.isSearchMode) {
            await this.loadSearchContent(jogosNecessarios);
        } else {
            await this.loadNormalContent(jogosNecessarios);
        }

        this.updatePaginationState(state);
        
        await new Promise(resolve => setTimeout(resolve, 50));
        requestAnimationFrame(() => {
            document.querySelector('.games-grid')?.classList.add('loaded');
        });
        
        this.salvarEstadoNoLocal();
    } catch (error) {
        console.error('Erro ao mudar de página:', error);
        this.updatePaginationState(state);
    } finally {
        this.transitioning = false;
        this.setLoading(false);
    }
  }

  async changePage(page: number | any) {
    if (typeof page !== 'number' || 
      page < 1 || 
      page > this.totalPages ||  
      this.loading || 
      this.transitioning) {
      return;
      }

    // Se já estiver no topo, executa imediatamente
    if (window.scrollY === 0) {
        await this.executarMudancaPagina(page);
        return;
    }

    // Se não estiver no topo, faz o scroll suave
    window.scrollTo({ 
        top: 0, 
        behavior: 'auto' 
    });

    // Espera até que o scroll chegue ao topo
    await new Promise<void>(resolve => {
        let scrollCheckInterval = setInterval(() => {
            if (window.scrollY === 0) {
                clearInterval(scrollCheckInterval);
                resolve();
            }
        }, 10);

        // Timeout de segurança
        setTimeout(() => {
            clearInterval(scrollCheckInterval);
            resolve();
        }, 800);
    });

    // Executa a mudança de página após o scroll
    await this.executarMudancaPagina(page);
  }

  private updatePaginationState(state: PaginationState) {
    const source = this.isSearchMode ? this.filteredSearchResults : this.filteredGames;
    const calculatedPages = Math.ceil(source.length / state.itemsPerPage);
    
    state.totalPages = state.lastIncomplete ? 
        calculatedPages : 
        Math.max(calculatedPages, state.currentPage + (state.hasMorePages ? 1 : 0));
    
    this.updateVisiblePages();
  }

  private async loadSearchContent(jogosNecessarios: number): Promise<void> {
    const state = this.getCurrentPaginationState();
    let tentativas = 0;
    
    while (tentativas < state.maxAttempts && this.searchHasMore) {
        const jogosAntesDeCarregar = this.filteredSearchResults.length;
        
        // Verifica se já temos jogos suficientes
        if (jogosAntesDeCarregar >= jogosNecessarios) {
            break;
        }
        
        await this.carregarMaisResultadosBusca();
        await this.applySearchFilters(false);
        
        // Aguarda processamento dos dados
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verifica se obtivemos novos jogos
        const novosJogosObtidos = this.filteredSearchResults.length > jogosAntesDeCarregar;
        
        // Atualiza o estado da paginação
        if (!novosJogosObtidos) {
            state.consecutiveIncomplete++;
            if (state.consecutiveIncomplete >= state.maxAttempts) {
                state.hasMorePages = false;
                state.lastIncomplete = true;
                break;
            }
        } else {
            state.consecutiveIncomplete = 0;
        }
        
        tentativas++;
        
        // Se ainda não temos jogos suficientes mas temos mais páginas, continua tentando
        if (this.filteredSearchResults.length < jogosNecessarios && 
            tentativas < state.maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    // Atualiza o estado final
    state.loadedUntilPage = Math.ceil(this.filteredSearchResults.length / state.itemsPerPage);
  }

  private async loadNormalContent(jogosNecessarios: number): Promise<void> {
    const state = this.getCurrentPaginationState();
    let tentativas = 0;
    
    while (tentativas < state.maxAttempts) {
        const jogosAntesDeCarregar = this.filteredGames.length;
        
        if (!this.temMaisJogos && tentativas === 0) {
            this.apiPage++;
            this.temMaisJogos = true;
        }
        
        await this.carregarMaisJogos();
        await this.applyFilters(false);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (this.filteredGames.length > jogosAntesDeCarregar || 
            this.filteredGames.length >= jogosNecessarios) {
            break;
        }
        
        tentativas++;
        if (tentativas < state.maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 
                this.getCurrentMode() === 'exclusive' ? 1000 : 500));
        }
    }
  }
  
  /* ==============================================
     12. UI E INTERAÇÕES
  ============================================== */
  detectMobile() {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth <= 768;
    
    if (wasMobile !== this.isMobile) {
      this.activeDropdown = null;
    }
  }

  stopPropagation(event: MouseEvent) {
    event.stopPropagation();
  }

  isAdditionalFiltersOpen = false;

  toggleAdditionalFilters() {
    this.isAdditionalFiltersOpen = !this.isAdditionalFiltersOpen;
  }
  
  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    if (this.isMobile) {
      const dropdownElement = document.querySelector('.genre-dropdown');
      if (dropdownElement && !dropdownElement.contains(event.target as Node)) {
        this.showGenres = false;
      }
    }
  }

  openDropdown(type: string) {
    this.activeDropdown = type;
  }

  closeDropdown(type: string) {
    if (this.activeDropdown === type) {
      this.activeDropdown = null;
    }
  }

  toggleDropdown(type: string) {
    this.activeDropdown = this.activeDropdown === type ? null : type;
  }

  selectRating(value: string) {
    this.selectedRating = value;
    if (this.isSearchMode) {
      this.applySearchFilters(true);
    } else {
      this.applyFilters(true);
    }
    if (this.isMobile) {
      this.closeDropdown('rating');
    }
    this.salvarEstadoNoLocal();
  }
  
  selectSort(value: string) {
    this.sortBy = value;
    if (this.isSearchMode) {
      this.applySearchFilters(true);
    } else {
      this.applyFilters(true);
    }
    if (this.isMobile) {
      this.closeDropdown('sort');
    }
    this.salvarEstadoNoLocal();
  }

  getRatingLabel(value: string): string {
    return this.ratingOptions.find(opt => opt.value === value)?.label || 'Selecione';
  }

  getSortLabel(value: string): string {
    return this.sortOptions.find(opt => opt.value === value)?.label || 'Selecione';
  }

  /* ==============================================
     13. NAVEGAÇÃO
  ============================================== */
  detalhesJogo(gameId: number) {
    this.router.navigate(['/detalhes', gameId]);
  }

  /* ==============================================
     14. SCROLL PAGINAÇÃO
  ============================================== */
  @HostListener('window:scroll', ['$event'])
  onScroll() {
    const footer = document.querySelector('app-footer');
    const paginationContainer = document.querySelector('.pagination-container');
    
    if (footer && paginationContainer) {
      const footerTop = footer.getBoundingClientRect().top;
      const windowHeight = window.innerHeight;
      
      // Se o footer estiver próximo da área visível
      if (footerTop <= windowHeight) { 
        paginationContainer.classList.add('above-footer');
      } else {
        paginationContainer.classList.remove('above-footer');
      }
    }
  }

  /* ==============================================
     15. No-RESULTS
  ============================================== */

  resetFilters() {
    // Redefine todos os filtros para seus valores padrão
    this.selectedRating = '';
    this.sortBy = 'relevance';
    this.genreFilterMode = 'inclusive';
    
    // Seleciona todos os gêneros
    this.toggleAllGenres();
    this.toggleNoGenre();

    // Aplica os filtros
    if (this.isSearchMode) {
      this.applySearchFilters(true);
    } else {
      this.applyFilters(true);
    }
  }
  
  clearSearch() {
    this.searchTerm = '';
    this.isSearchMode = false;
    this.searchResults = [];
    this.filteredSearchResults = [];
    this.updateVisiblePages();
  }

  /* ==============================================
     16. Gestão de plataformas
  ============================================== */

  // Carregar plataformas de forma mais eficiente
  private async loadPlatforms() {
    try {
      const response = await lastValueFrom(this.apiService.buscarPlataformas());
      
      // Obter todas as plataformas únicas
      const allPlatforms = [...new Set(response.map(p => p.value.platform))];
      console.log('Plataformas disponíveis:', allPlatforms);
      
      // Definir categorias principais
      this.platforms = [
        ...Object.keys(this.platformMappings).filter(k => k !== 'Outros'),
        'Outros', 
      ];
      
      // Inicializar seleção (todas marcadas por padrão)
      this.platforms.forEach(platform => {
        this.selectedPlatforms[platform] = true;
      });
      
      this.platformsLoaded = true;
    } catch (error) {
      console.error('Erro ao carregar plataformas:', error);
      this.platformsLoaded = true;
    }
  }

  // Simplificar o mapeamento de plataformas
  private platformMappings: { [key: string]: RegExp[] } = {
    'PlayStation': [/playstation/i, /ps[1-5x]?/i, /ps\s?vita/i, /psp/i],
    'Xbox': [/xbox/i, /xbox\s*(360|one|series)/i],
    'Nintendo': [/nintendo/i, /switch/i, /wii/i, /gamecube/i, /3ds/i, /ds/i, /n64/i, /snes/i, /nes/i],
    'PC': [/pc/i, /windows/i, /mac/i, /linux/i, /steam/i, /epic/i, /gog/i],
    'Mobile': [/android/i, /ios/i, /iphone/i, /ipad/i, /mobile/i, /phone/i, /tablet/i],
    'Outros': [] // Captura plataformas não mapeadas
  };

  includeNoPlatform:boolean = true
  allPlatformsSelected: boolean = true;

  // Novo método para alternar todas as plataformas
  toggleAllPlatforms() {
    // Se todos estiverem selecionados, desmarcar tudo
    if (this.allPlatformsSelected) {
      this.allPlatformsSelected = false;
      this.platforms.forEach(platform => {
        this.selectedPlatforms[platform] = false;
      });
      this.includeNoPlatform = false;
    } else {
      // Se alguns estiverem desmarcados, marcar tudo
      this.allPlatformsSelected = true;
      this.platforms.forEach(platform => {
        this.selectedPlatforms[platform] = true;
      });
      this.includeNoPlatform = true;
    }
    
    this.onPlatformChange();
  }
  togglePlatform(platform: string) {
    this.selectedPlatforms[platform] = !this.selectedPlatforms[platform];
    this.updateAllPlatformsCheckbox();
    this.onPlatformChange();
  }
  toggleNoPlatform() {
    this.includeNoPlatform = !this.includeNoPlatform;
    this.updateAllPlatformsCheckbox();
    this.onPlatformChange();
  }
  updateAllPlatformsCheckbox() {
    // Verifica se todos os checkboxes individuais estão marcados
    this.allPlatformsSelected = this.platforms.every(platform => 
      this.selectedPlatforms[platform]
    ) && this.includeNoPlatform;
  }
  // Método otimizado para filtrar por plataformas
  private filterByPlatforms(games: Game[]): Game[] {
    // Verificar se nenhuma plataforma está selecionada
    if (!this.hasSelectedPlatforms) {
      return [];
    }
  
    // Restante do código permanece igual ao que você já tinha
    const selectedPlatformsList = Object.entries(this.selectedPlatforms)
      .filter(([_, selected]) => selected)
      .map(([platform]) => platform);
    
    return games.filter(game => {
      // Tratar jogos sem plataforma como caso especial
      if (!game.platforms || game.platforms.length === 0) {
        return this.selectedPlatforms['Sem Plataforma'] || this.includeNoPlatform;
      }
      
      // Se nenhuma plataforma está selecionada, apenas tratar jogos com plataforma
      if (selectedPlatformsList.length === 0) {
        return false;
      }
      
      // Normalizar plataformas (caso sejam objetos)
      const gamePlatforms = Array.isArray(game.platforms) 
        ? (typeof game.platforms[0] === 'object' && game.platforms[0] !== null
          ? game.platforms.map((p: any) => p.name)
          : game.platforms)
        : [game.platforms];
      
      // Verificar correspondência com as plataformas selecionadas
      return selectedPlatformsList.some(selectedPlatform => {
        if (selectedPlatform === 'Outros') {
          // Verificar se alguma plataforma do jogo não corresponde a nenhuma categoria conhecida
          return gamePlatforms.some(platformName => {
            const isInKnownCategory = Object.entries(this.platformMappings)
              .filter(([key]) => key !== 'Outros')
              .some(([_, regexList]) => 
                regexList.some(regex => regex.test(String(platformName)))
              );
            
            return !isInKnownCategory;
          });
        } else if (selectedPlatform === 'Sem Plataforma') {
          return false; // Tratado anteriormente
        } else {
          // Verificar se alguma plataforma do jogo corresponde à categoria selecionada
          const regexList = this.platformMappings[selectedPlatform];
          return gamePlatforms.some(platformName => 
            regexList.some(regex => regex.test(String(platformName)))
          );
        }
      });
    });
  }

  // Melhorar manipulação de eventos
  onPlatformChange() {
    // Resetar para primeira página
    this.currentPage = 1;
    
    // Atualizar o estado do checkbox "Todas as Plataformas"
    this.updateAllPlatformsCheckbox();
    
    // Aplicar filtros de acordo com o modo atual
    if (this.isSearchMode) {
      this.applySearchFilters(true);
    } else {
      this.applyFilters(true);
    }
  }

  // Método getter simplificado
  showNoPlatformsMessage: boolean = false;

// Método para verificar plataformas
  get hasSelectedPlatforms(): boolean {
      return Object.values(this.selectedPlatforms).some(v => v) || this.includeNoPlatform;
  }

}