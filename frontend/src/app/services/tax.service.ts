import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { AuthService } from './auth.service';

export interface TaxParameter {
  Clave: 'IVA_PORCENTAJE';
  Porcentaje: string | number;
  Descripcion?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TaxService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  readonly ivaPercent = signal(15);

  load(): Observable<TaxParameter> {
    return this.http.get<TaxParameter>(`${API_BASE_URL}/parametros/iva`).pipe(
      tap((parameter) => {
        const rate = Number(parameter.Porcentaje);
        if (Number.isFinite(rate) && rate >= 0 && rate <= 100) this.ivaPercent.set(rate);
      }),
    );
  }

  update(percent: number): Observable<TaxParameter> {
    const token = this.authService.accessToken();
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return this.http.patch<TaxParameter>(
      `${API_BASE_URL}/parametros/iva`,
      { porcentaje: percent },
      { headers },
    ).pipe(
      tap((parameter) => this.ivaPercent.set(Number(parameter.Porcentaje))),
    );
  }
}
