import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, GenreCategory } from '../models/game.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.API_URL
  
  constructor(private http: HttpClient) {}
  buscarJogos(
    pagina: number = 1,
    quantidade: number = 500,
    generos?: string[]
  ): Observable<ApiResponse> {
    
    // Configurar parâmetros de forma segura
    let params = new HttpParams()
      .set('page', pagina.toString())
      .set('pageSize', quantidade.toString());
  
    // Adicionar gêneros se existirem
    if (generos && generos.length > 0) {
      params = params.set('genres', generos.join(','));
    }
  
    return this.http.get<ApiResponse>(this.apiUrl, { params });
  }
  buscarCategorias(): Observable<GenreCategory[]> {
    return this.http.get<GenreCategory[]>(`${this.apiUrl}/genres`);
  }
  buscarPlataformas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/platforms`);
  }
  buscarTemas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/themes`);
  }
  buscarModosdeJogo(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/game-modes`);
  }
  getJogoDetalhes(id:number):Observable<any>{
    return this.http.get(`${this.apiUrl}/${id}`)
  }
  buscarJogoPorNome(nome: string, page: number = 1, pageSize: number = 500): Observable<any> {
    return this.http.get(`${this.apiUrl}/search/${nome}`, {
      params: {
        page: page.toString(),
        pageSize: pageSize.toString()
      }
    });
  }
}
