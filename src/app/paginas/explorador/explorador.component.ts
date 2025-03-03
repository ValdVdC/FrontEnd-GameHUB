import { Component, HostListener } from '@angular/core';
import { debounceTime, distinctUntilChanged, lastValueFrom, Subject, takeUntil } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Router } from '@angular/router';
import { Game } from '../../models/game.model';

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
  genresLoaded = false;
  loading: boolean = false;
  private setLoading(state: boolean) {
    this.loading = state;
    if (!state) {
      this.preLoading = false;
    }
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
  filteredSearchResults: Game[] = [];
  isSearchMode: boolean = false;
  
  // Filtros
  selectedGenres: { [key: string]: boolean } = {};
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
    console.log('Modo de filtro alterado para:', this.genreFilterMode);
    this.applyFilters(true);
    this.salvarEstadoNoLocal();
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

  /* ==============================================
     4. PROPRIEDADES DE CONTROLE RXJS
  ============================================== */
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  private intervalSalvarEstado: any;

  /* ==============================================
     5. CONSTRUTOR E MÉTODOS DE CICLO DE VIDA
  ============================================== */
  constructor(
    private apiService: ApiService,
    private router: Router
  ) {
    this.searchSubject.pipe(
      debounceTime(1000),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      this.performSearch(term);
    });
  }
  
  ngOnInit() {
    // Ativar loading e preLoading imediatamente
    this.setLoading(true);
    this.preLoading = true;
    
    // Recuperar dados do localStorage
    const estadoRecuperado = this.recuperarEstadoDoLocal();
    
    // Carregar gêneros primeiro
    this.loadGenres().then(() => {
      // Depois carregar jogos (se necessário)
      if (!estadoRecuperado || this.games.length === 0) {
        this.loadInitialGames();
      } else {
        // Se temos estado recuperado, atualizar a paginação
        this.updateVisiblePages();
        this.setLoading(false);
      }
    }).catch(error => {
      console.error('Erro ao carregar gêneros:', error);
      this.setLoading(false);
    });
    
    this.detectMobile();
    window.addEventListener('resize', () => this.detectMobile());
    
    // Salvar estado periodicamente
    this.intervalSalvarEstado = setInterval(() => this.salvarEstadoNoLocal(), 5000);
  }
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    clearInterval(this.intervalSalvarEstado);
    this.salvarEstadoNoLocal();
  }
  private resetLoadingAfterTimeout(timeoutMs: number = 10000) {
    setTimeout(() => {
      if (this.loading) {
        console.warn('Loading foi resetado por timeout de segurança');
        this.setLoading(false);
      }
    }, timeoutMs);
  }
  
  /* ==============================================
     6. GESTÃO DE ESTADO (SESSIONSTORAGE)
  ============================================== */

  private salvarEstadoNoLocal() {
    const estado = {
      games: this.games,
      apiPage: this.apiPage,
      temMaisJogos: this.temMaisJogos,
      currentPage: this.currentPage,
      selectedGenres: this.selectedGenres,
      genreFilterMode: this.genreFilterMode, // Adicionado
      selectedRating: this.selectedRating,
      sortBy: this.sortBy,
      searchTerm: this.searchTerm,
      searchResults: this.searchResults,
      isSearchMode: this.isSearchMode,
      expiraEm: Date.now() + (30 * 60 * 1000)
    };
    
    try {
      localStorage.setItem('exploradorEstado', JSON.stringify(estado));
    } catch (e) {
      console.warn('Não foi possível salvar o estado no localStorage', e);
    }
  }
  
  private recuperarEstadoDoLocal() {
    try {
      const estadoSalvo = localStorage.getItem('exploradorEstado');
      
      if (estadoSalvo) {
        const estado = JSON.parse(estadoSalvo);
        if (estado.expiraEm && estado.expiraEm < Date.now()) {
          localStorage.removeItem('exploradorEstado');
          return false;
        }
        this.games = estado.games || [];
        this.apiPage = estado.apiPage || 1;
        this.temMaisJogos = estado.temMaisJogos !== undefined ? estado.temMaisJogos : true;
        this.currentPage = estado.currentPage || 1;
        this.selectedGenres = estado.selectedGenres || {};
        this.genreFilterMode = estado.genreFilterMode || 'inclusive'; // Adicionado
        this.selectedRating = estado.selectedRating || '';
        this.sortBy = estado.sortBy || 'relevance';
        
        // Recuperar estado de busca
        this.searchTerm = estado.searchTerm || '';
        this.searchResults = estado.searchResults || [];
        this.isSearchMode = estado.isSearchMode || false;
        
        console.log('Estado restaurado do localStorage com', this.games.length, 'jogos');
        
        // Se estava no modo de busca, aplica os filtros de busca
        if (this.isSearchMode) {
          this.applySearchFilters(false);
        } else {
          this.applyFilters(false);
        }
        
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Erro ao recuperar estado do localStorage', e);
      return false;
    }
  }

  /* ==============================================
     7. CARREGAMENTO DE DADOS
  ============================================== */
  private async loadInitialGames() {
    try {
      this.apiPage = 1;
      const response = await lastValueFrom(this.apiService.buscarJogos(this.apiPage));
      this.games = response.games;
      this.temMaisJogos = response.pagination.hasMore;
      
      // Garantir que a ordenação seja aplicada corretamente
      if (this.sortBy === 'relevance') {
        this.filteredGames = [...this.games];
      } else {
        this.applyFilters(true);
      }
    } catch (error) {
      console.error('Erro ao carregar jogos:', error);
      // Garantir que temos algo para mostrar, mesmo que vazio
      this.filteredGames = [];
    } finally {
      this.setLoading(false);
      // Ativar o timer de segurança para casos futuros
      this.resetLoadingAfterTimeout();
    }
  }

  async carregarMaisJogos() {
    if (this.carregandoMais) return;
  
    this.carregandoMais = true;
    this.setLoading(true);
    
    try {
      const resultado = await this.carregarJogosComRetry(3, 1500);
      
      if (!resultado.sucesso) {
        console.error('Falha ao carregar mais jogos após múltiplas tentativas');
        this.temMaisJogos = true;
        return;
      }
      
      const response = resultado.dados;
      
      if (!response || !response.games || !Array.isArray(response.games)) {
        console.error('Resposta da API inválida:', response);
        this.temMaisJogos = true;
        return;
      }
      
      // Criar Set com IDs existentes para evitar duplicatas
      const existingIds = new Set(this.games.map(game => game.id));
      
      // Filtrar apenas jogos novos
      const newGames = response.games.filter(game => !existingIds.has(game.id));
      
      if (newGames.length > 0) {
        // Adicionar os novos jogos preservando a ordem da API
        if (this.sortBy === 'relevance') {
          this.games = [...this.games, ...newGames];
        } else {
          // Para outros tipos de ordenação, podemos adicionar e ordenar depois
          this.games = [...this.games, ...newGames];
        }
        this.apiPage++;
        this.temMaisJogos = response.pagination.hasMore || newGames.length >= 10;
        await this.applyFilters(false);
      } else {
        if (response.pagination.hasMore) {
          this.apiPage++;
          setTimeout(() => {
            this.carregandoMais = false;
            this.carregarMaisJogos();
          }, 1500);
        } else {
          this.temMaisJogos = false;
          setTimeout(() => this.verificarSeRealmenteAcabou(), 10000);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar mais jogos:', error);
      this.temMaisJogos = true;
    } finally {
      this.carregandoMais = false;
      this.setLoading(false);
    }
  }

  private verificarSeRealmenteAcabou() {
    if (this.currentPage >= this.totalPages && !this.temMaisJogos) {
      console.log('Verificando novamente se realmente acabaram os jogos...');
      
      this.apiPage += 1;
      this.carregandoMais = false;
      
      this.carregarMaisJogos().then(() => {
        if (!this.temMaisJogos) {
          console.log('Confirmado: não há mais jogos disponíveis');
        } else {
          console.log('Encontramos mais jogos após verificação adicional');
        }
      });
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
        const generosAtivos = Object.keys(this.selectedGenres)
          .filter(g => this.selectedGenres[g]);
          
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
    this.games = [];
    if (this.searchTerm !== undefined) {
      this.searchSubject.next(this.searchTerm);
    }
  }

  private async performSearch(term: string) {
    if (!term?.trim()) {
      this.isSearchMode = false;
      await this.loadInitialGames();
      return;
    }
  
    this.loading = true;
    try {
      const response = await lastValueFrom(this.apiService.buscarJogoPorNome(term));
      if (response) {
        this.searchResults = response as Game[];
        this.searchResults = this.searchResults.map(game => ({
          ...game,
          genres: game.genres || []
        }));
        this.isSearchMode = true;
        this.applySearchFilters(true);
        
        // Salvar estado após busca completa
        this.salvarEstadoNoLocal();
      }
    } catch (error) {
      console.error('Erro na busca:', error);
      this.searchResults = [];
      this.isSearchMode = true;
      this.applySearchFilters(true);
    } finally {
      this.loading = false;
    }
  }

  /* ==============================================
     9. FILTROS E ORDENAÇÃO
  ============================================== */
  private async applyFilters(resetPage: boolean = true) {
    try {
      if (resetPage) {
        this.currentPage = 1;
      }
  
      if (!this.hasSelectedGenres) {
        this.filteredGames = [];
        this.updateVisiblePages();
        return;
      }
  
      // Indicador de carregamento ao iniciar filtros
      this.loading = true;
  
      // Filtrar os jogos atuais
      let filtered = this.filterByGenres([...this.games]);
      filtered = this.filterByRating(filtered);
      
      if (this.sortBy !== 'relevance') {
        filtered = this.sortGames(filtered);
      }
  
      // Determinar se precisamos de mais jogos
      const jogosNecessarios = this.itemsPerPage * this.currentPage;
      const precisaMaisJogos = filtered.length < jogosNecessarios && this.temMaisJogos;
      
      // Carregar mais jogos se necessário
      let tentativas = 0;
      const MAX_TENTATIVAS = 10;
      
      while (precisaMaisJogos && tentativas < MAX_TENTATIVAS) {
        const jogosAntes = filtered.length;
        
        // Deixe o loading ativo durante carregamento
        this.loading = true;
        await this.carregarMaisJogos();
        
        filtered = this.filterByGenres([...this.games]);
        filtered = this.filterByRating(filtered);
        filtered = this.sortGames(filtered);
        
        if (filtered.length <= jogosAntes && tentativas > 2) {
          this.temMaisJogos = false;
          break;
        }
        
        if (filtered.length >= jogosNecessarios) {
          break;
        }
        
        tentativas++;
      }
      
      this.filteredGames = filtered;
      this.updateVisiblePages();
    } catch (error) {
      console.error('Erro ao aplicar filtros:', error);
    } finally {
      // Só define loading como false quando todo o processo terminar
      this.loading = false;
    }
  }

  private async applySearchFilters(resetPage: boolean = true) {
    try {
      if (resetPage) {
        this.currentPage = 1;
      }
  
      if (!this.hasSelectedGenres) {
        this.filteredSearchResults = [];
        return;
      }
  
      let filtered = this.filterByGenres([...this.searchResults]);
      filtered = this.filterByRating(filtered);
      filtered = this.sortGames(filtered);
      
      this.filteredSearchResults = filtered;
      this.updateVisiblePages();
    } catch (error) {
      console.error('Erro ao aplicar filtros de busca:', error);
    }
  }
  private filterByGenres(games: Game[]): Game[] {
    const selectedGenresList = Object.entries(this.selectedGenres || {})
      .filter(([_, selected]) => selected)
      .map(([genre]) => genre);
  
    if (selectedGenresList.length === 0) {
      return [];
    }
  
    return games.filter(game => {
      // Verifica se game.genres é um array de strings ou um array de objetos com propriedade name
      if (!Array.isArray(game.genres)) {
        return false;
      }
      
      // Extrai os gêneros do jogo (seja de objetos ou strings)
      const gameGenres = typeof game.genres[0] === 'object' && game.genres[0] !== null
        ? game.genres.map((g: any) => g.name)
        : game.genres;
      
      if (this.genreFilterMode === 'inclusive') {
        // Modo inclusivo: Mostrar jogos que contêm PELO MENOS UM dos gêneros selecionados
        return selectedGenresList.some(genre => gameGenres.includes(genre));
      } else {
        // Modo exclusivo: Mostrar jogos que contêm EXATAMENTE os gêneros selecionados (nem mais, nem menos)
        // 1. Verificar se o jogo tem todos os gêneros selecionados
        const temTodosGenerosSelecionados = selectedGenresList.every(genre => 
          gameGenres.includes(genre)
        );
        
        // 2. Verificar se o jogo não tem nenhum gênero adicional
        const naoTemGenerosAdicionais = gameGenres.every(genre => 
          selectedGenresList.includes(genre)
        );
        
        // Retornar true se ambas as condições forem atendidas
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
    if (this.sortBy === 'relevance') {
      // Se for relevância, preservar a ordem original da API
      return [...games]; // Retorna uma cópia para evitar efeitos colaterais
    }
    
    return games.sort((a, b) => {
      switch (this.sortBy) {
        case 'rating': return (b.total_rating || 0) - (a.total_rating || 0);
        case 'name': return a.name.localeCompare(b.name);
        default: return 0;
      }
    });
  }

  /* ==============================================
     10. GESTÃO DE GÊNEROS
  ============================================== */
  get hasSelectedGenres(): boolean {
    // Verifica apenas gêneros que existem na lista atual
    return this.genres.some(genre => this.selectedGenres[genre] === true);
  }

  get allGenresSelected(): boolean {
    return Object.values(this.selectedGenres).every(value => value);
  }

  toggleGenre(genre: string) {
    this.selectedGenres[genre] = !this.selectedGenres[genre];
    this.updateAllSelected();
    
    const haveraSelecionados = Object.values(this.selectedGenres).some(selected => selected);
  
    // Se não haverá nenhum gênero selecionado
    if (!haveraSelecionados) {
      this.filteredGames = [];
      this.showNoGenresMessage = true;
      this.salvarEstadoNoLocal();
      return; // Sai da função sem iniciar o carregamento
    }

    this.loading = true;

    setTimeout(async () => {
      try {
        await this.applyFilters(true);
        this.filteredGames = [...this.filteredGames];
        this.salvarEstadoNoLocal();
      } finally {
        // loading será desativado no finally do applyFilters
      }
    }, 100);
  }

  toggleAllGenres() {
    const newState = !this.allGenresSelected;
    this.genres.forEach(genre => this.selectedGenres[genre] = newState);

    console.log('Estado dos gêneros após toggleAllGenres:', this.selectedGenres, 'hasSelectedGenres:', this.hasSelectedGenres);
    
    this.applyFilters(true); 
    this.salvarEstadoNoLocal();
  }

  updateAllSelected() {
    const selectedGenresList = Object.keys(this.selectedGenres).filter(genre => this.selectedGenres[genre]);
    this.showNoGenresMessage = selectedGenresList.length === 0;
    this.applyFilters(true);
  }

  /* ==============================================
     11. PAGINAÇÃO
  ============================================== */
  get pagedGames() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const source = this.isSearchMode ? this.filteredSearchResults : this.filteredGames;
    return source.slice(startIndex, startIndex + this.itemsPerPage);
  }
    
  get totalPages() {
    const source = this.isSearchMode ? this.filteredSearchResults : this.filteredGames;
    const calculatedPages = Math.ceil(source.length / this.itemsPerPage);
    
    if ((this.temMaisJogos || this.carregandoMais) && !this.isSearchMode) {
      return Math.max(calculatedPages, this.currentPage + 1);
    }
    
    if (this.currentPage > calculatedPages) {
      return this.currentPage;
    }
    
    return calculatedPages > 0 ? calculatedPages : 1;
  }

  private updateVisiblePages() {
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
  }

  async changePage(page: number | any) {
    if (typeof page !== 'number' || page < 1 || this.loading) return;
    
    this.loading = true;
    
    try {
      const jogosNecessarios = page * this.itemsPerPage;
      
      if (page > this.currentPage && this.filteredGames.length < jogosNecessarios) {
        let tentativas = 0;
        const MAX_TENTATIVAS = 3;
        
        while (tentativas < MAX_TENTATIVAS) {
          const jogosAntesDeCarregar = this.filteredGames.length;
          
          if (!this.temMaisJogos && tentativas === 0) {
            this.apiPage++;
            this.temMaisJogos = true;
          }
          
          await this.carregarMaisJogos();
          await this.applyFilters(false);
          
          if (this.filteredGames.length > jogosAntesDeCarregar || 
              this.filteredGames.length >= jogosNecessarios) {
            break;
          }
          
          tentativas++;
          if (tentativas < MAX_TENTATIVAS) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }
      
      const paginasDisponiveis = Math.ceil(this.filteredGames.length / this.itemsPerPage);
      this.currentPage = Math.min(page, Math.max(1, paginasDisponiveis));
      
      this.updateVisiblePages();
      
      this.salvarEstadoNoLocal();
    } finally {
      this.loading = false;
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
    this.applyFilters(true);
    if (this.isMobile) {
      this.closeDropdown('rating');
    }
    this.salvarEstadoNoLocal();
  }

  selectSort(value: string) {
    this.sortBy = value;
    this.applyFilters(true);
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
}