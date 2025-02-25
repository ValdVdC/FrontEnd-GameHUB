import { HttpClient } from '@angular/common/http';
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

  buscarJogos(pagina: number = 1, quantidade: number = 500): Observable<ApiResponse> {
    return this.http.get<ApiResponse>(this.apiUrl, {
      params: {
        page: pagina.toString(),
        pageSize: quantidade.toString()
      }
    });
  }
  buscarCategorias(): Observable<GenreCategory[]> {
    return this.http.get<GenreCategory[]>(`${this.apiUrl}/genres`);
  }

  getJogoDetalhes(id:number):Observable<any>{
    return this.http.get(`${this.apiUrl}/${id}`)
  }
  buscarJogoPorNome(nome:string):Observable<any>{
    return this.http.get(`${this.apiUrl}/search/${nome}`)
  }
}
