import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface RegisterUserData {
  Nombres: string;
  Apellidos: string;
  Email: string;
  Telefono: string;
  Password: string;
  Identificacion: string | null;
}

export interface RegisterResponse {
  access_token: string;
  token_type: string;
  usuario: {
    UsuarioId: number;
    PersonaId: number;
    Nombres: string;
    Apellidos: string;
    Email: string;
    Telefono: string | null;
    Rol: string;
    ClienteId: number | null;
    Identificacion: string | null;
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8000/auth';

  register(userData: RegisterUserData): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register`, userData);
  }
}
