import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { AuthService } from './auth.service';

export interface UserProfile {
  UsuarioId: number;
  PersonaId: number;
  Nombres: string;
  Apellidos: string;
  Email: string;
  Telefono: string | null;
  Rol: string;
  RolId: number;
  ClienteId: number | null;
  Identificacion: string | null;
  FechaRegistro: string | null;
  Estado: boolean;
}

export interface ProfileUpdate {
  Nombres: string;
  Apellidos: string;
  Email: string;
  Telefono: string | null;
}

export interface PasswordUpdate {
  PasswordActual: string;
  PasswordNuevo: string;
}

export interface PasswordUpdateResponse {
  mensaje: string;
  message: string;
}

interface PasswordUpdateEndpoint {
  method: 'PATCH' | 'POST';
  path: string;
}

const PASSWORD_UPDATE_ENDPOINTS: readonly PasswordUpdateEndpoint[] = [
  { method: 'PATCH', path: '/auth/cambiar-password' },
  { method: 'POST', path: '/auth/cambiar-password' },
  { method: 'PATCH', path: '/auth/password' },
  { method: 'PATCH', path: '/api/auth/cambiar-password' },
  { method: 'POST', path: '/api/auth/cambiar-password' },
  { method: 'PATCH', path: '/usuarios/cambiar-password' },
  { method: 'POST', path: '/usuarios/cambiar-password' },
];

export interface DeliveryAddress {
  DireccionId: number;
  ClienteId: number;
  Provincia: string | null;
  Ciudad: string | null;
  Direccion: string;
  Referencia: string | null;
  CodigoPostal: string | null;
  EsPrincipal: boolean;
  Estado: boolean;
}

export interface DeliveryAddressInput {
  Provincia: string | null;
  Ciudad: string | null;
  Direccion: string;
  Referencia: string | null;
  CodigoPostal: string | null;
  EsPrincipal: boolean;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${API_BASE_URL}/auth/me`, {
      headers: this.authHeaders(),
    });
  }

  updateProfile(clienteId: number, profile: ProfileUpdate): Observable<unknown> {
    return this.http.patch<unknown>(`${API_BASE_URL}/clientes/${clienteId}`, profile, {
      headers: this.authHeaders(),
    });
  }

  updatePassword(passwords: PasswordUpdate): Observable<PasswordUpdateResponse> {
    return this.tryPasswordUpdate(passwords, this.authHeaders(), 0);
  }

  getAddresses(): Observable<DeliveryAddress[]> {
    return this.http.get<DeliveryAddress[]>(`${API_BASE_URL}/clientes/me/direcciones`, {
      headers: this.authHeaders(),
    });
  }

  createAddress(address: DeliveryAddressInput): Observable<DeliveryAddress> {
    return this.http.post<DeliveryAddress>(`${API_BASE_URL}/clientes/me/direcciones`, address, {
      headers: this.authHeaders(),
    });
  }

  updateAddress(
    addressId: number,
    address: Partial<DeliveryAddressInput>,
  ): Observable<DeliveryAddress> {
    return this.http.patch<DeliveryAddress>(
      `${API_BASE_URL}/clientes/direcciones/${addressId}`,
      address,
      { headers: this.authHeaders() },
    );
  }

  deleteAddress(addressId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${API_BASE_URL}/clientes/direcciones/${addressId}`,
      { headers: this.authHeaders() },
    );
  }

  private tryPasswordUpdate(
    passwords: PasswordUpdate,
    headers: HttpHeaders,
    endpointIndex: number,
  ): Observable<PasswordUpdateResponse> {
    const endpoint = PASSWORD_UPDATE_ENDPOINTS[endpointIndex];
    const url = `${API_BASE_URL}${endpoint.path}`;

    return this.http
      .request<PasswordUpdateResponse>(endpoint.method, url, {
        body: passwords,
        headers,
      })
      .pipe(
        catchError((error: unknown) => {
          if (!(error instanceof HttpErrorResponse) || error.status !== 404) {
            return throwError(() => error);
          }

          if (endpointIndex + 1 < PASSWORD_UPDATE_ENDPOINTS.length) {
            return this.tryPasswordUpdate(passwords, headers, endpointIndex + 1);
          }

          return throwError(
            () =>
              new HttpErrorResponse({
                error: {
                  detail:
                    'El servidor no publica ninguna de las rutas conocidas para actualizar la contraseña.',
                },
                status: error.status,
                statusText: error.statusText,
                url: error.url ?? url,
              }),
          );
        }),
      );
  }

  private authHeaders(): HttpHeaders {
    const token = this.authService.accessToken();
    if (!token) {
      throw new Error('Se requiere iniciar sesión para acceder al perfil.');
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
