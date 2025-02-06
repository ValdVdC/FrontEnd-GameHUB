import { Component, OnDestroy, OnInit} from '@angular/core';
import { ApiService } from '../../services/api.service';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-detalhes',
  templateUrl: './detalhes.component.html',
  styleUrl: './detalhes.component.css'
})
export class DetalhesComponent implements OnInit, OnDestroy{
  constructor(private apiService:ApiService, private route:ActivatedRoute){}
  jogo:any[] = [];
  jogoCarregando:boolean = true
  private destroy$ = new Subject<void>();
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
              this.jogo = detalhes;
              console.log(detalhes)
              this.jogoCarregando = false;
            }
        });
    });
  }
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
