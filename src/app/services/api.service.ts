import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = 'https://backend-gamehub.onrender.com/'
  
  constructor(private http: HttpClient) {}
  
  buscarJogos(): Observable<any>{
    return this.http.get(`${this.apiUrl}/games`);
  }
  buscarCategorias(): Observable<any>{
    return this.http.get(`${this.apiUrl}/games/genres`);
  }
  getJogoDetalhes(id:number):Observable<any>{
    return this.http.get(`${this.apiUrl}/game/${id}`)
  }
  buscarJogoPorNome(nome:string):Observable<any>{
    return this.http.get(`${this.apiUrl}/game/${nome}`)
  }
}
