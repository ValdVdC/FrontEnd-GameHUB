import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ScrollService } from '../../services/scroll.service';
import { Router } from '@angular/router';
import { ApiResponse, Game, GenreCategory } from '../../models/game.model';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit{

  jogos:Game[] = [];
  categorias:GenreCategory[] = [];
  jogosMomentoCarregando:boolean = true
  categoriasCarregando:boolean = true

  constructor(
    private apiService:ApiService, 
    private scrollService:ScrollService, 
    private router:Router
  ){}

  ngOnInit(): void {
    this.buscarJogos();
    this.buscarCategorias();
  }

  buscarJogos(): void {
    this.jogosMomentoCarregando = true;
    this.apiService.buscarJogos().subscribe({
      next: (data: ApiResponse) => { // Use ApiResponse
        this.jogos = data.games; // Acesse a propriedade games
      },
      error: (error: any) => {
        console.log('Erro ao buscar', error);
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
      next: (data: GenreCategory[]) => { // Use GenreCategory
        this.categorias = data.map(category => ({
          ...category,
          startIndex: 0
        }));
      },
      error: (error: any) => {
        console.log('Erro ao buscar', error);
      },
      complete: () => {
        this.categoriasCarregando = false;
        this.iniciarObservador();
      }
    });
  }

  avancar(category:any){
    if(category.startIndex + 5 < category.value.games.length){
      category.startIndex++;
    }
  }

  voltar(category:any){
    if(category.startIndex>0){
      category.startIndex--;
    }
  }

  private observer!: IntersectionObserver;
  private observerInitialized = false;
  private dadosCarregados(): boolean {
    return !this.jogosMomentoCarregando && !this.categoriasCarregando;
  }
  
  iniciarObservador() {
    if (!this.dadosCarregados() || this.observerInitialized) {
      return;
    }
    
    setTimeout(() => {
      if (this.observer) {
        this.observer.disconnect();
      }
      
      // Mapeamento para armazenar o estado de interseção de cada seção
      const intersectionMap = new Map<string, boolean>();
      
      // Definir ordem de prioridade das seções
      const sectionPriority = ['home', 'games', 'categories', 'community'];
      
      const options = {
        threshold: 0.2,
        rootMargin: '-120px 0px',
      };
      
      this.observer = new IntersectionObserver((entries) => {
        // Atualizar o mapa de interseção com as informações mais recentes
        entries.forEach(entry => {
          intersectionMap.set(entry.target.id, entry.isIntersecting);
        });
        
        // Decidir qual seção deve estar ativa com base na prioridade e visibilidade
        let activeSection = '';
        
        // Verificar as seções visíveis em ordem de prioridade de baixo para cima
        // (inversa da ordem da página)
        for (let i = sectionPriority.length - 1; i >= 0; i--) {
          const sectionId = sectionPriority[i];
          if (intersectionMap.get(sectionId)) {
            activeSection = sectionId;
            break;
          }
        }
        
        // Se apenas a seção de categorias estiver visível, ela tem prioridade
        if (intersectionMap.get('categories') && !intersectionMap.get('games')) {
          activeSection = 'categories';
        }
        
        // E vice-versa
        if (intersectionMap.get('games') && !intersectionMap.get('categories')) {
          activeSection = 'games';
        }
        
        // Caso especial: se ambas estão visíveis, determinar com base na posição de rolagem
        if (intersectionMap.get('categories') && intersectionMap.get('games')) {
          const categoriesSection = document.getElementById('categories');
          const gamesSection = document.getElementById('games');
          
          if (categoriesSection && gamesSection) {
            const scrollY = window.scrollY;
            const categoriesTop = categoriesSection.offsetTop;
            const gamesBottom = gamesSection.offsetTop + gamesSection.offsetHeight;
            
            // Se estamos mais próximos do meio da seção de categorias
            if (scrollY > gamesBottom - 100 && scrollY < categoriesTop + (categoriesSection.offsetHeight / 2)) {
              activeSection = 'categories';
            }
          }
        }
        
        if (activeSection) {
          this.scrollService.setActiveSection(activeSection);
        }
      }, options);
      
      const sections = document.querySelectorAll('section[id]');
      sections.forEach(section => {
        intersectionMap.set(section.id, false);  // Inicializar mapa
        this.observer.observe(section);
      });
      
      // Adicionar um evento de scroll para resolver casos específicos
      window.addEventListener('scroll', () => {
        // Esperar que a animação do frame seja concluída para melhor performance
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const categoriesSection = document.getElementById('categories');
          const gamesSection = document.getElementById('games');
          
          if (categoriesSection && gamesSection) {
            const categoryTop = categoriesSection.offsetTop;
            const categoryBottom = categoryTop + categoriesSection.offsetHeight;
            const gameBottom = gamesSection.offsetTop + gamesSection.offsetHeight;
            
            // Definir claramente quando estamos na seção de categorias
            if (scrollY > gameBottom + 50 && scrollY < categoryBottom - 100) {
              this.scrollService.setActiveSection('categories');
            }
          }
        });
      }, { passive: true });
      
      this.observerInitialized = true;
    }, 500);
  }

  ngAfterViewInit() {
    this.iniciarObservador()
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
  detalhesJogo(gameId:number){
    if(this.observer){
      this.observer.disconnect();
    }
    this.scrollService.setActiveSection('')
    this.router.navigate(['/detalhes',gameId])
  }
}

