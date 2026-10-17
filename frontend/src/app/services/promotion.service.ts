import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface Promotion {
  PromocionId: number;
  Nombre: string;
  CodigoCupon: string | null;
  TipoDescuento: 'PORCENTAJE' | 'MONTO_FIJO' | string;
  ValorDescuento: string | number;
  MontoMinimoCompra: string | number;
  FechaInicio: string | null;
  FechaFin: string | null;
  Estado: boolean;
  ProductosIds: number[];
  CategoriasIds: number[];
}

@Injectable({ providedIn: 'root' })
export class PromotionService {
  private readonly http = inject(HttpClient);

  getActivePromotions(): Observable<Promotion[]> {
    return this.http.get<Promotion[]>(`${API_BASE_URL}/promociones`);
  }
}
