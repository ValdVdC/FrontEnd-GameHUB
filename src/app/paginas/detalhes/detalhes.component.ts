import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { NgbCarousel } from '@ng-bootstrap/ng-bootstrap';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { GenreNavigationService } from '../../services/genre-navigation.service';
import { PlatformNavigationService } from '../../services/platform-navigation.service';

@Component({
  selector: 'app-detalhes',
  templateUrl: './detalhes.component.html',
  styleUrl: './detalhes.component.css'
})
export class DetalhesComponent implements OnInit, OnDestroy {
  @ViewChild('carousel') carousel!: NgbCarousel;
  
  jogo: any[] = [];
  jogoCarregando: boolean = true;
  videoThumbnails: string[] = [];
  activeSlideId: string = '';
  
  private destroy$ = new Subject<void>();
  
  constructor(
    private apiService: ApiService, 
    private route: ActivatedRoute,
    private router: Router,
    private genreNavigationService: GenreNavigationService,
    private platformNavigationService: PlatformNavigationService
  ) {}
  
  ngOnInit(): void {
    this.carregarJogoSelecionado();
  }
  
  carregarJogoSelecionado() {
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.jogo = [];
        this.jogoCarregando = true;
        const id = Number(params['id']);
        
        this.apiService.getJogoDetalhes(id)
          .pipe(takeUntil(this.destroy$))
          .subscribe(detalhes => {
            if(detalhes) {
              this.jogo = [detalhes];
              if (detalhes.video_url && detalhes.video_url.length > 0) {
                this.criarThumbnails(detalhes.video_url);
                this.activeSlideId = 'ngb-slide-0';
              }
              this.jogoCarregando = false;
            }
        });
    });
  }
  
  // Extrai ID do vídeo da URL do YouTube
  getYoutubeVideoId(url: string): string {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : '';
  }
  
  // Cria URLs das miniaturas
  criarThumbnails(videoUrls: string[]) {
    this.videoThumbnails = videoUrls.map(url => {
      const videoId = this.getYoutubeVideoId(url);
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    });
  }
  
  // Seleciona o slide específico do carrossel
  selecionarVideo(slideId: string) {
    this.carousel.select(slideId);
    this.activeSlideId = slideId;
  }
  
  // Atualiza o ID do slide ativo quando o carrossel muda
  onSlideChange(event: any) {
    this.activeSlideId = event.current;
  }
  
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
  navegarParaExploradorComGenero(genre: string | { name: string }) {
    // Handle both string and object genres
    const genreName = typeof genre === 'string' ? genre : genre.name;
    
    // Set the genre to navigate to
    this.genreNavigationService.navigateToGenre(genreName);
    
    // Navigate to the explorer page
    this.router.navigate(['/explorador']);
  }
  navegarParaExploradorComPlataforma(platform: string | { name: string }) {
    // Handle both string and object platform
    const platformName = typeof platform === 'string' ? platform : platform.name;
    
    // Set the platform to navigate to
    this.platformNavigationService.navigateToPlatform(platformName);
    
    // Navigate to the explorer page
    this.router.navigate(['/explorador']);
  }
}