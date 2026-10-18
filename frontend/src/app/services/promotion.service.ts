
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

export interface CouponValidation {
  valido: boolean;
  promocion_id: number;
  nombre: string;
  codigo_cupon: string;
  tipo_descuento: 'PORCENTAJE' | 'MONTO_FIJO' | string;
  valor_descuento: string;
  monto_descuento: string;
  subtotal_original: string;
  subtotal_con_descuento: string;
}

@Injectable({ providedIn: 'root' })
export class PromotionService {
  private readonly http = inject(HttpClient);

  getActivePromotions(): Observable<Promotion[]> {
    return this.http.get<Promotion[]>(
      `${API_BASE_URL}/promociones`,
    );
  }

  validateCoupon(
    code: string,
    subtotal: number,
    productIds: number[],
  ): Observable<CouponValidation> {
    const codigoLimpio = code.trim().toUpperCase();
    const idsUnicos = [...new Set(productIds)];

    if (!codigoLimpio) {
      throw new Error('Ingresa un código de cupón.');
    }

    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      throw new Error('El subtotal debe ser mayor que cero.');
    }

    if (idsUnicos.length === 0) {
      throw new Error('Agrega productos al carrito antes de aplicar el cupón.');
    }

    return this.http.post<CouponValidation>(
      `${API_BASE_URL}/promociones/validar-cupon`,
      {
        CodigoCupon: codigoLimpio,
        Subtotal: subtotal,
        ProductosIds: idsUnicos,
      },
    );
  }
}
