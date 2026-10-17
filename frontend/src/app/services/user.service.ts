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
  Identificacion: string;
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
  mensaje?: string;
  message?: string;
}

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
    const url = `${API_BASE_URL}/auth/cambiar-password`;
    const headers = this.authHeaders();
    return this.http.patch<PasswordUpdateResponse>(url, passwords, { headers }).pipe(
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === 404
          ? this.http.post<PasswordUpdateResponse>(url, passwords, { headers })
          : throwError(() => error),
      ),
    );
  }

  getAddresses(): Observable<DeliveryAddress[]> {
    return this.http.get<DeliveryAddress[]>(`${API_BASE_URL}/clientes/me/direcciones`, {
      headers: this.authHeaders(),
    });
  }

  createAddress(address: DeliveryAddressInput): Observable<DeliveryAddress> {
    return this.http.post<DeliveryAddress>(
      `${API_BASE_URL}/clientes/me/direcciones`,
      address,
      { headers: this.authHeaders() },
    );
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

  private authHeaders(): HttpHeaders {
    const token = this.authService.accessToken();
    if (!token) {
      throw new Error('Se requiere iniciar sesión para acceder al perfil.');
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
