import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.API_URL
  
  constructor(private http: HttpClient) {}
  
  buscarJogos(): Observable<any>{
    return this.http.get(this.apiUrl);
  }
  buscarCategorias(): Observable<any>{
    return this.http.get(`${this.apiUrl}/genres`);
  }
  getJogoDetalhes(id:number):Observable<any>{
    return this.http.get(`${this.apiUrl}/${id}`)
  }
  buscarJogoPorNome(nome:string):Observable<any>{
    return this.http.get(`${this.apiUrl}/search/${nome}`)
  }
}
