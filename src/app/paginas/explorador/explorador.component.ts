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
    // Propriedades de estado
    games: Game[] = [];
    filteredGames: Game[] = [];
    genres: string[] = [];
    loading: boolean = false;
    
    // Propriedades de busca e filtro
    searchTerm: string = '';
    selectedGenres: { [key: string]: boolean } = {}; // Objeto para armazenar gêneros selecionados
    selectedRating: string = '';
    sortBy: string = 'relevance';
    
    // Controle de paginação
    currentPage: number = 1;
    apiPage: number = 1;  // Controla a paginação da API
    itemsPerPage: number = 16;
    carregandoMais: boolean = false;
    temMaisJogos: boolean = true;
    preLoading: boolean = false; // Novo estado para pré-carregamento

    // Subject para controle de busca com debounce
    private searchSubject = new Subject<string>();
    private destroy$ = new Subject<void>();
  
    constructor(
      private apiService: ApiService,
      private router: Router
    ) {
      // Configuração do debounce para busca
      this.searchSubject.pipe(
        debounceTime(1000),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      ).subscribe(term => {
        this.performSearch(term);
      });
    }
  
    ngOnInit() {
      this.loading = true;
      // Carrega os jogos iniciais e gêneros
      this.loadInitialGames();
      this.loadGenres();



      this.detectMobile(); // Verifica se é um dispositivo móvel ao carregar o componente
      window.addEventListener('resize', () => this.detectMobile()); // Atualiza ao redimensionar a tela
    }
  
    ngOnDestroy() {
      this.destroy$.next();
      this.destroy$.complete();
    }
  
    // Carregamento inicial de jogos populares
    private async loadInitialGames() {
      try {
        this.apiPage = 1;
        const response = await lastValueFrom(this.apiService.buscarJogos(this.apiPage));
        this.games = response.games;
        this.temMaisJogos = response.pagination.hasMore;
        this.applyFilters(true);
      } catch (error) {
        console.error('Erro ao carregar jogos:', error);
      } finally {
        this.loading = false;
      }
    }

    private needsMoreGames(page: number): boolean {
      const requiredGames = page * this.itemsPerPage;
      return this.filteredGames.length < requiredGames;
    }

    async carregarMaisJogos() {
      if (this.carregandoMais || !this.temMaisJogos) return;
    
      this.carregandoMais = true;
      try {
        const response = await lastValueFrom(
          this.apiService.buscarJogos(this.apiPage + 1)
        );
        
        // Adicione a tipagem explicitamente
        const newGames = response.games.filter((newGame: Game) => 
          !this.games.some((existingGame: Game) => existingGame.id === newGame.id)
        );
        
        this.games = [...this.games, ...newGames];
        this.temMaisJogos = response.pagination.hasMore;
        this.apiPage++;
        
      } catch (error) {
        console.error('Erro ao carregar mais jogos:', error);
      } finally {
        this.carregandoMais = false;
      }
    }

    // Carregamento de gêneros para filtros
    private async loadGenres() {
      try {
          const response = await lastValueFrom(this.apiService.buscarCategorias());
          this.genres = response.map((category: any) => category.value.genre);
          
          // Inicializa todos desmarcados e depois marca todos
          this.selectedGenres = this.genres.reduce((acc, genre) => {
              acc[genre] = true; // Começa com todos selecionados
              return acc;
          }, {} as { [key: string]: boolean });
          
          this.applyFilters(true);
      } catch (error) {
          console.error('Erro ao carregar gêneros:', error);
      }
  } 
  
    // Busca de jogos
    onSearch() {
      if (this.searchTerm !== undefined) {  // Verificação de segurança
        this.searchSubject.next(this.searchTerm);
      }
    }
    private async performSearch(term: string) {
      if (!term?.trim()) {  // Verificação null/undefined com optional chaining
        await this.loadInitialGames();
        return;
      }
    
      this.loading = true;
      try {
        const response = await lastValueFrom(this.apiService.buscarJogoPorNome(term));
        // Verificação de segurança para garantir que response não é undefined
        if (response) {
          this.games = response as Game[];
          // Certifique-se de que todos os jogos têm a propriedade genres
          this.games = this.games.map(game => ({
            ...game,
            genres: game.genres || []  // Fornece um array vazio se genres for undefined
          }));
          this.applyFilters(true);
        }
      } catch (error) {
        console.error('Erro na busca:', error);
        this.games = [];  // Reset seguro em caso de erro
        this.applyFilters(true);
      } finally {
        this.loading = false;
      }
      console.log(this.games)
    }

    private filterByGenres(games: Game[]): Game[] {
      const selectedGenresList = Object.entries(this.selectedGenres || {})
          .filter(([_, selected]) => selected)
          .map(([genre]) => genre);
  
      if (selectedGenresList.length === 0) {
          return []; // Retorna array vazio quando nenhum gênero selecionado
      }
  
      return games.filter(game => 
          Array.isArray(game.genres) && 
          selectedGenresList.some(genre => game.genres.includes(genre))
      );
  }
  get hasSelectedGenres(): boolean {
    return Object.values(this.selectedGenres).some(value => value) && this.genres.length > 0;
  }

  toggleGenre(genre: string) {
    this.selectedGenres[genre] = !this.selectedGenres[genre];
    this.updateAllSelected();
    
    // Delay para garantir atualização do UI
    setTimeout(async () => {
      try {
        this.loading = true;
        await this.applyFilters(true);
        
        // Força nova renderização
        this.filteredGames = [...this.filteredGames];
      } finally {
        this.loading = false;
      }
    }, 100);
  }

    private filterByRating(games: any[]): any[] {
      if (!this.selectedRating) return games;
      const minRating = parseInt(this.selectedRating);
      return games.filter(game => game.total_rating >= minRating);
    }
    
    private sortGames(games: any[]): any[] {
      return games.sort((a, b) => {
        switch (this.sortBy) {
          case 'rating': return (b.total_rating || 0) - (a.total_rating || 0);
          case 'name': return a.name.localeCompare(b.name);
          default: return 0;
        }
      });
    }
    
    // Aplicação de filtros
// Corrija o método applyFilters
private async applyFilters(resetPage: boolean = true) {
  try {
    let currentAttempt = 0;
    const maxAttempts = 5; // Limite máximo de tentativas

    do {
      let filtered = [...this.games];
      filtered = this.filterByGenres(filtered);
      filtered = this.filterByRating(filtered);
      filtered = this.sortGames(filtered);
      
      this.filteredGames = filtered;

      if (this.filteredGames.length < this.itemsPerPage && this.temMaisJogos && currentAttempt < maxAttempts) {
        await this.carregarMaisJogos();
        currentAttempt++;
      } else {
        break;
      }
    } while (true);

    if (resetPage) {
      this.currentPage = 1;
    }
  } catch (error) {
    console.error('Erro ao aplicar filtros:', error);
  }
}

    // Métodos de paginação
    get pagedGames() {
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      return this.filteredGames.slice(startIndex, startIndex + this.itemsPerPage);
    }
  
    get totalPages() {
      const pages = Math.ceil(this.filteredGames.length / this.itemsPerPage);
      return pages > 0 ? pages : 1;
    }

async changePage(page: number) {
  if (page < 1 || this.carregandoMais) return;

  this.loading = true; // Ativa loading geral
  
  try {
    // Verifica se precisa carregar mais jogos para a página solicitada
    while (this.needsMoreGames(page) && this.temMaisJogos) {
      await this.carregarMaisJogos();
      this.applyFilters(false); // Reaplica filtros com os novos jogos
    }

    // Só muda a página se tiver dados suficientes
    if (!this.needsMoreGames(page)) {
      this.currentPage = page;
    }
  } catch (error) {
    console.error('Erro ao mudar página:', error);
  } finally {
    this.loading = false;
  }
}
    // Navegação para detalhes
    detalhesJogo(gameId: number) {
      this.router.navigate(['/detalhes', gameId]);
    }
  
    

    // Adicione estas propriedades
get allGenresSelected(): boolean {
  return Object.values(this.selectedGenres).every(value => value);
}

toggleAllGenres() {
  const newState = !this.allGenresSelected;
  this.genres.forEach(genre => this.selectedGenres[genre] = newState);
  this.applyFilters(true);
}

updateAllSelected() {
  const selectedGenresList = Object.keys(this.selectedGenres).filter(genre => this.selectedGenres[genre]);
  this.showNoGenresMessage = selectedGenresList.length === 0;
  this.applyFilters(true);
}

isMobile: boolean = false; // Flag para detectar dispositivos móveis

// Método para detectar dispositivos móveis
detectMobile() {
  const wasMobile = this.isMobile;
  this.isMobile = window.innerWidth <= 768;
  
  if (wasMobile !== this.isMobile) {
    this.activeDropdown = null;
  }
}

// Método para abrir o dropdown

// Método para fechar o dropdown

// Método para alternar o dropdown (usado no mobile)

// Método para impedir a propagação do clique
stopPropagation(event: MouseEvent) {
  event.stopPropagation(); // Impede que o clique propague para o elemento pai
}

// Fechar o dropdown ao clicar fora (usado no mobile)
@HostListener('document:click', ['$event'])
onClickOutside(event: MouseEvent) {
  if (this.isMobile) { // Só aplica no mobile
    const dropdownElement = document.querySelector('.genre-dropdown');
    if (dropdownElement && !dropdownElement.contains(event.target as Node)) {
      this.showGenres = false; // Fecha o dropdown se o clique foi fora
    }
  }
}
// Adicione a propriedade
showGenres: boolean = false;

// Adicione esta propriedade
showNoGenresMessage: boolean = false;
activeDropdown: string | null = null;
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

  // Métodos para controle de dropdowns
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

  // Métodos para seleção de opções
  selectRating(value: string) {
    this.selectedRating = value;
    this.applyFilters(true);
    if (this.isMobile) {
      this.closeDropdown('rating');
    }
  }

  selectSort(value: string) {
    this.sortBy = value;
    this.applyFilters(true);
    if (this.isMobile) {
      this.closeDropdown('sort');
    }
  }

  // Métodos auxiliares
  getRatingLabel(value: string): string {
    return this.ratingOptions.find(opt => opt.value === value)?.label || 'Selecione';
  }

  getSortLabel(value: string): string {
    return this.sortOptions.find(opt => opt.value === value)?.label || 'Selecione';
  }
}

