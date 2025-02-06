import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ScrollService } from '../../services/scroll.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit{

  jogos:any[] = [];
  categorias:any[] = [];
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
  buscarJogos():void{
    this.jogosMomentoCarregando = true
    this.apiService.buscarJogos().subscribe({
      next:(data:any)=>{
        this.jogos =data
        console.log('Jogos: ',data)
      },
      error:(error:any)=>{
        console.log('Erro ao buscar',error)
      },
      complete:()=>{
        this.jogosMomentoCarregando = false
        this.iniciarObservador()
      }
    }) 
  }

  buscarCategorias():void{
    this.categoriasCarregando = true
    this.apiService.buscarCategorias().subscribe({
      next:(data:any)=>{
        this.categorias = data.map((category:any)=>({
          ...category,
          startIndex: 0
        }))
        console.log('Generos: ',data)
      },
      error:(error:any)=>{
        console.log('Erro ao buscar',error)
      },
      complete:()=>{
        this.categoriasCarregando = false
        this.iniciarObservador()
      }
    })
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
  iniciarObservador(){
    const options = {
      threshold: 0.2,
      rootMargin: '-120px 0px',
    };
    if(this.observer){
      this.observer.disconnect()
    }
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.scrollService.setActiveSection(entry.target.id);
        }
      });
    }, options);
    const sections = document.querySelectorAll('section[id]');
    sections.forEach(section => this.observer.observe(section));

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

