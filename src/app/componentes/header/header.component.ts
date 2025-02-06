import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { debounceTime, Subject, Subscription, takeUntil } from 'rxjs';
import { ScrollService } from '../../services/scroll.service';
import { ApiService } from '../../services/api.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit, OnDestroy{
  @HostListener('window:scroll', ['$event'])
  onWindowScroll() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
      navbar?.classList.add('scrolled');
    } else {
      navbar?.classList.remove('scrolled');
    }
  }
  activeLink: string = 'home';
  private subscription!: Subscription;
  private searchSubject = new Subject<string>();
  private destroy = new Subject<void>();
  busca:string = ''
  resultadosBusca:any[]=[]
  isSearchFocused:boolean = false
  carregandoResultados:boolean = false;
  semResultados:boolean = false
  clickTimeout:any; 
  
  constructor(private scrollService: ScrollService, private apiService:ApiService, private router:Router) {}

  ngOnInit() {
    this.subscription = this.scrollService.activeSectionId
      .subscribe(sectionId => {
        this.activeLink = sectionId;
      });

      this.searchSubject
        .pipe(
          debounceTime(300),
          takeUntil(this.destroy)
        )
        .subscribe(async(busca)=>{
          if(busca.length>=3){
            this.semResultados = false;
            await this.apiService.buscarJogoPorNome(busca).subscribe({
              next:(results)=>{
                this.resultadosBusca = results
                this.carregandoResultados = false;
                this.semResultados = this.resultadosBusca.length===0
              },
              error:()=>{
                this.resultadosBusca = [];
                this.carregandoResultados = false;
                this.semResultados = true;
              }
            });
          }else{
            this.resultadosBusca = [];
            this.semResultados = false;
          }
        })
  }

  ngOnDestroy() {
    this.destroy.next()
    this.destroy.complete()
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  onSearch(){
    this.carregandoResultados = true;
    this.searchSubject.next(this.busca)
  }
  onFocusSearch(){
    this.isSearchFocused = true
  }
  onBlurSearch(){
    this.clickTimeout = setTimeout(() => {
      this.isSearchFocused = false
    }, 100);
  }
  onResultsMouseDown(){
    if(this.clickTimeout){
      clearTimeout(this.clickTimeout)
    }
  }
  setActiveLink(link: string) {
    this.activeLink = link;
  }
  buscarJogo(gameId:number){
    console.log('Cliquei')
    this.activeLink = '';
    this.router.navigate(['/detalhes',gameId])
  }
}

