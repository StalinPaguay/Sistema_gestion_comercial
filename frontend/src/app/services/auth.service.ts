import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface RegisterUserData {
  Nombres: string;
  Apellidos: string;
  Email: string;
  Telefono: string | null;
  Password: string;
  Identificacion?: string | null;
}

export interface LoginCredentials {
  Email: string;
  Password: string;
}

export interface AuthUser {
  UsuarioId: number;
  PersonaId: number;
  Nombres: string;
  Apellidos: string;
  Email: string;
  Telefono: string | null;
  Rol: string;
  ClienteId: number | null;
  Identificacion: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  usuario: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly token = signal<string | null>(this.readToken());
  private readonly user = signal<AuthUser | null>(this.readUser());
  readonly accessToken: Signal<string | null> = this.token.asReadonly();
  readonly currentUser: Signal<AuthUser | null> = this.user.asReadonly();

  register(userData: RegisterUserData): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${API_BASE_URL}/auth/register`, userData)
      .pipe(tap((response) => this.saveSession(response, false)));
  }

  login(credentials: LoginCredentials, rememberMe = false): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${API_BASE_URL}/auth/login`, credentials)
      .pipe(tap((response) => this.saveSession(response, rememberMe)));
  }

  logout(): void {
    this.token.set(null);
    this.user.set(null);
    if (typeof sessionStorage !== 'undefined') {
      this.clearSessionStorage(sessionStorage);
    }
    if (typeof localStorage !== 'undefined') {
      this.clearSessionStorage(localStorage);
    }
  }

  private readToken(): string | null {
    if (typeof localStorage !== 'undefined') {
      const persistentToken = localStorage.getItem('tecnomega_access_token');
      if (persistentToken) {
        return persistentToken;
      }
    }
    return typeof sessionStorage === 'undefined'
      ? null
      : sessionStorage.getItem('tecnomega_access_token');
  }

  private saveSession(response: AuthResponse, rememberMe: boolean): void {
    const persistentStorage = typeof localStorage === 'undefined' ? null : localStorage;
    const sessionStorageRef =
      typeof sessionStorage === 'undefined' ? null : sessionStorage;
    const targetStorage = rememberMe ? persistentStorage : sessionStorageRef;
    if (!targetStorage) {
      throw new Error('El almacenamiento de sesión no está disponible en este navegador.');
    }

    this.clearAuthData(persistentStorage);
    this.clearAuthData(sessionStorageRef);
    targetStorage.setItem('tecnomega_access_token', response.access_token);
    targetStorage.setItem('tecnomega_user_data', JSON.stringify(response.usuario));
    this.token.set(response.access_token);
    this.user.set(response.usuario);
  }

  private readUser(): AuthUser | null {
    if (typeof localStorage !== 'undefined') {
      const storedUser = this.parseUser(localStorage.getItem('tecnomega_user_data'));
      if (storedUser) {
        return storedUser;
      }
    }
    return typeof sessionStorage === 'undefined'
      ? null
      : this.parseUser(sessionStorage.getItem('tecnomega_user_data'));
  }

  private parseUser(value: string | null): AuthUser | null {
    if (!value) {
      return null;
    }
    try {
      const user: unknown = JSON.parse(value);
      return this.isAuthUser(user) ? user : null;
    } catch {
      return null;
    }
  }

  private isAuthUser(value: unknown): value is AuthUser {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const user = value as Record<string, unknown>;
    return (
      typeof user['UsuarioId'] === 'number' &&
      typeof user['PersonaId'] === 'number' &&
      typeof user['Nombres'] === 'string' &&
      typeof user['Apellidos'] === 'string' &&
      typeof user['Email'] === 'string' &&
      typeof user['Rol'] === 'string'
    );
  }

  private clearAuthData(storage: Storage | null): void {
    if (!storage) {
      return;
    }
    for (const key of [
      'tecnomega_access_token',
      'tecnomega_user_data',
      'access_token',
      'token',
      'user_data',
      'tecnomega_user',
    ]) {
      storage.removeItem(key);
    }
  }

  private clearSessionStorage(storage: Storage): void {
    this.clearAuthData(storage);
  }
}
