import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { debounceTime, Subject, Subscription, takeUntil } from 'rxjs';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ScrollService } from '../../services/scroll.service';
import { ApiService } from '../../services/api.service';
import { Game } from '../../models/game.model';

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
  busca: string = '';
  resultadosBusca: Game[] = [];
  isSearchFocused: boolean = false;
  carregandoResultados: boolean = false;
  semResultados: boolean = false;
  clickTimeout: any;
  buscadorHabilitado: boolean = true;
  
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
  
  // ==============================================
  // 5. CONSTRUTOR E INJEÇÃO DE DEPENDÊNCIAS
  // ==============================================
  constructor(
    private scrollService: ScrollService, 
    private apiService: ApiService, 
    private router: Router
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
        if (busca.length >= 3) {
          this.semResultados = false;
          this.carregandoResultados = true;
          
          this.apiService.buscarJogoPorNome(busca).subscribe({
            next: (response) => {
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
            },
            error: () => {
              this.resultadosBusca = [];
              this.carregandoResultados = false;
              this.semResultados = true;
            }
          });
        } else {
          this.resultadosBusca = [];
          this.semResultados = false;
          this.carregandoResultados = false;
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
  }
  
  // ==============================================
  // 9. MÉTODOS DO SISTEMA DE BUSCA
  // ==============================================
  onSearch() {
    this.carregandoResultados = true;
    this.searchSubject.next(this.busca);
  }
  
  onFocusSearch() {
    this.isSearchFocused = true;
  }
  
  onBlurSearch() {
    this.clickTimeout = setTimeout(() => {
      this.isSearchFocused = false;
    }, 100);
  }
  
  onResultsMouseDown() {
    if (this.clickTimeout) {
      clearTimeout(this.clickTimeout);
    }
  }
}