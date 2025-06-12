import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, GenreCategory } from '../models/game.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private baseUrl = environment.API_URL.replace('/api/games', '/api');
  private gamesUrl = environment.API_URL;
  
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
  
    return this.http.get<ApiResponse>(this.gamesUrl, { params });
  }

  buscarPlataformas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.gamesUrl}/platforms`);
  }

  getJogoDetalhes(id: number): Observable<any> {
    return this.http.get(`${this.gamesUrl}/${id}`);
  }

  buscarJogoPorNome(nome: string, page: number = 1, pageSize: number = 500): Observable<any> {
    return this.http.get(`${this.gamesUrl}/search/${nome}`, {
      params: {
        page: page.toString(),
        pageSize: pageSize.toString()
      }
    });
  }

  // Métodos de taxonomia usando baseUrl
  buscarTaxonomiaGeneros(): Observable<any> {
    return this.http.get(`${this.baseUrl}/taxonomy/genres`);
  }

  buscarTaxonomiaTiposJogos(): Observable<any> {
    return this.http.get(`${this.baseUrl}/taxonomy/game-types`);
  }
  
  buscarTaxonomiaTemas(): Observable<any> {
    return this.http.get(`${this.baseUrl}/taxonomy/themes`);
  }

  buscarTaxonomiaModosJogo(): Observable<any> {
    return this.http.get(`${this.baseUrl}/taxonomy/game-modes`);
  }
}