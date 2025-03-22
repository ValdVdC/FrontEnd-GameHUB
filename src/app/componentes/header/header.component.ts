import { Component, HostListener, OnDestroy, OnInit, ElementRef, ViewChild } from '@angular/core';
import { debounceTime, Subject, Subscription, takeUntil, fromEvent } from 'rxjs';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ScrollService } from '../../services/scroll.service';
import { ApiService } from '../../services/api.service';
import { Game } from '../../models/game.model';
import { SearchService } from '../../services/search.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit, OnDestroy {
  // ==============================================
  // 1. PROPRIEDADES DE ESTADO DA NAVEGAÇÃO
  // ==============================================
  activeLink: string = 'home';
  
  // ==============================================
  // 2. PROPRIEDADES DO SISTEMA DE BUSCA
  // ==============================================
  @ViewChild('searchInput') searchInput!: ElementRef;
  @ViewChild('searchResults') searchResults!: ElementRef;
  
  busca: string = '';
  resultadosBusca: Game[] = [];
  isSearchFocused: boolean = false;
  carregandoResultados: boolean = false;
  semResultados: boolean = false;
  buscadorHabilitado: boolean = true;
  isUserInteractingWithResults: boolean = false;
  ultimaBusca: string = ''; // Armazenar a última busca realizada
  
  // ==============================================
  // 3. GERENCIAMENTO DE SUBSCRIPTIONS E RXJS
  // ==============================================
  private subscription!: Subscription;
  private searchSubject = new Subject<string>();
  private destroy = new Subject<void>();
  
  // ==============================================
  // 4. DETECÇÃO DE SCROLL
  // ==============================================
  @HostListener('window:scroll', ['$event'])
  onWindowScroll() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
      navbar?.classList.add('scrolled');
    } else {
      navbar?.classList.remove('scrolled');
    }
  }
  
  // Event listeners para melhorar a interação com o dropdown
  @HostListener('document:mousedown', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Verificar se o clique foi fora da área de resultados e do input
    if (this.searchResults && this.searchInput) {
      const targetElement = event.target as HTMLElement;
      const clickedInSearchInput = this.searchInput.nativeElement.contains(targetElement);
      const clickedInSearchResults = this.searchResults.nativeElement.contains(targetElement);
      
      if (!clickedInSearchInput && !clickedInSearchResults) {
        this.isSearchFocused = false;
      }
    }
  }
  
  // ==============================================
  // 5. CONSTRUTOR E INJEÇÃO DE DEPENDÊNCIAS
  // ==============================================
  constructor(
    private scrollService: ScrollService, 
    private apiService: ApiService, 
    private router: Router,
    private searchService: SearchService
  ) {}

  // ==============================================
  // 6. MÉTODOS DE CICLO DE VIDA
  // ==============================================
  ngOnInit() {
    // Inicialização do monitoramento da seção ativa
    this.inicializarMonitoramentoDeSecao();
    
    // Inicialização do monitoramento de navegação
    this.inicializarMonitoramentoDeRota();
    
    // Inicialização do sistema de busca
    this.inicializarSistemaDeBusca();
  }

  ngOnDestroy() {
    // Limpeza das subscrições para evitar memory leaks
    this.destroy.next();
    this.destroy.complete();
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  // ==============================================
  // 7. MÉTODOS DE INICIALIZAÇÃO
  // ==============================================
  private inicializarMonitoramentoDeSecao() {
    this.subscription = this.scrollService.activeSectionId
      .subscribe(sectionId => {
        this.activeLink = sectionId;
      });
  }
  
  private inicializarMonitoramentoDeRota() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy)
    ).subscribe((event: any) => {
      // Verificar se estamos na página do explorador
      const estaNaPaginaExplorador = event.url.includes('/explorador');
      
      // Desabilitar o buscador se estiver na página do explorador
      this.buscadorHabilitado = !estaNaPaginaExplorador;
      
      // Se não estivermos na página home, desative todos os links
      if (!event.url.includes('#') && event.url !== '/' && event.url !== '/home') {
        this.activeLink = '';
      } else if (event.url === '/' || event.url === '/home') {
        // Se voltarmos para a página inicial sem um hash, definimos o home como ativo
        this.activeLink = 'home';
      }
    });
  }
  
  private inicializarSistemaDeBusca() {
    this.searchSubject
      .pipe(
        debounceTime(300),
        takeUntil(this.destroy)
      )
      .subscribe(async(busca) => {
        // Verificar se a busca é diferente da última realizada
        if (busca !== this.ultimaBusca) {
          this.ultimaBusca = busca;
          
          if (busca.length >= 3) {
            // Resetar o estado antes de iniciar a busca
            this.semResultados = false;
            this.carregandoResultados = true;
            this.resultadosBusca = []; // Limpar resultados anteriores imediatamente
            
            this.apiService.buscarJogoPorNome(busca).subscribe({
              next: (response) => {
                // Verificar se a busca atual ainda é relevante (usuário não mudou a busca)
                if (busca === this.ultimaBusca) {
                  // Verificar se a resposta tem a estrutura esperada
                  if (response && response.games) {
                    // Extrair os jogos do objeto de resposta
                    this.resultadosBusca = response.games.map((game:Game) => ({
                      ...game,
                      genres: game.genres || [] // Garantir que genres existe
                    }));
                  } else {
                    // Se a resposta for diretamente um array (formato antigo)
                    this.resultadosBusca = Array.isArray(response) ? response : [];
                  }
                  
                  // Ordenar os resultados pelo popularity_value (do maior para o menor)
                  this.resultadosBusca.sort((a, b) => {
                    // Se popularity_value estiver ausente, tratamos como 0
                    const popularityA = a.popularity_value || 0;
                    const popularityB = b.popularity_value || 0;
                    
                    // Ordenação decrescente (do maior para o menor valor)
                    return popularityB - popularityA;
                  });
                  
                  this.carregandoResultados = false;
                  this.semResultados = this.resultadosBusca.length === 0;
                }
              },
              error: () => {
                // Verificar se a busca atual ainda é relevante
                if (busca === this.ultimaBusca) {
                  this.resultadosBusca = [];
                  this.carregandoResultados = false;
                  this.semResultados = true;
                }
              }
            });
          } else {
            // Caso a busca tenha menos de 3 caracteres
            this.resultadosBusca = [];
            this.semResultados = false;
            this.carregandoResultados = false;
          }
        }
      });
  }

  // ==============================================
  // 8. MÉTODOS DO SISTEMA DE NAVEGAÇÃO
  // ==============================================
  setActiveLink(link: string) {
    this.activeLink = link;
  }
  
  buscarJogo(gameId: number) {
    this.activeLink = ''; // Remove o destaque ao navegar para outra página
    this.router.navigate(['/detalhes', gameId]);
    this.isSearchFocused = false; // Fechar os resultados da busca após navegar
  }
  
  // ==============================================
  // 9. MÉTODOS DO SISTEMA DE BUSCA
  // ==============================================
  onSearch() {
    // Se a busca mudou, mostrar o carregando imediatamente
    if (this.busca.length >= 3 && this.busca !== this.ultimaBusca) {
      this.carregandoResultados = true;
      this.resultadosBusca = []; // Limpar resultados antigos quando o usuário digita
    }
    
    this.searchSubject.next(this.busca);
  }
  
  onFocusSearch() {
    this.isSearchFocused = true;
    
    // Se já tem 3+ caracteres mas nenhum resultado está sendo mostrado,
    // reativa a busca para mostrar resultados
    if (this.busca.length >= 3 && !this.carregandoResultados && this.resultadosBusca.length === 0) {
      this.onSearch();
    }
  }
  
  // Não fechar instantaneamente os resultados ao tirar o foco
  onBlurSearch() {
    // Manter os resultados abertos se o usuário estiver interagindo com eles
    if (!this.isUserInteractingWithResults) {
      setTimeout(() => {
        this.isSearchFocused = false;
      }, 300); // Aumento do timeout para dar mais tempo para o clique ser processado
    }
  }
  
  // Limpar a pesquisa e o status quando o input é limpo
  onInputClear() {
    if (this.busca === '') {
      this.resultadosBusca = [];
      this.carregandoResultados = false;
      this.semResultados = false;
      this.ultimaBusca = '';
    }
  }
  
  // Indicar que o usuário está interagindo com os resultados da busca
  onResultsMouseEnter() {
    this.isUserInteractingWithResults = true;
  }
  
  onResultsMouseLeave() {
    this.isUserInteractingWithResults = false;
  }
  
  // Método para garantir que o clique nos resultados seja capturado corretamente
  onResultClick(event: MouseEvent, gameId: number) {
    event.preventDefault();
    event.stopPropagation();
    this.buscarJogo(gameId);
  }
  
  continueSearch() {
    this.searchService.setSearchTerm(this.busca);
    this.router.navigate(['/explorador']);
    this.isSearchFocused = false;
  }
  
  // Verificar se deve mostrar o botão "Continuar busca"
  mostrarContinuarBusca(): boolean {
    return this.busca.length >= 3 && 
           this.resultadosBusca.length > 0 && 
           !this.carregandoResultados;
  }
}