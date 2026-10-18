import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';
import {
  getProductImage,
  PRODUCT_IMAGE_FALLBACK,
} from './product-images.config';

export { getProductImage, PRODUCT_IMAGE_FALLBACK } from './product-images.config';

export interface Product {
  productoId: number;
  sku: string;
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
  stockMinimo: number;
  categoria: string;
  marca: string;
  urlImagen: string;
  estado: boolean;
}

export interface ProductCategory {
  id_categoria: number;
  nombre: string;
}

interface ApiProduct {
  ProductoId: number;
  CategoriaId?: number;
  MarcaId?: number;
  Categoria?: string | null;
  Marca?: string | null;
  SKU: string;
  Nombre: string;
  Descripcion: string | null;
  Precio: string | number;
  Stock: number;
  StockMinimo: number;
  Estado: boolean;
  UrlImagen?: string | null;
  ImagenUrl?: string | null;
  urlImagen?: string | null;
  imagenUrl?: string | null;
  Imagen?: string | null;
  Imagenes?: ApiProductImage[] | null;
  ImagenesProducto?: ApiProductImage[] | null;
}

interface ApiProductImage {
  UrlImagen: string;
  EsPrincipal?: boolean;
}

interface ApiProductsResponse {
  total: number;
  limite: number;
  desde: number;
  productos: ApiProduct[];
}

interface ApiCategory {
  CategoriaId: number;
  Nombre: string;
  Descripcion: string | null;
  Estado: boolean;
}

interface ApiCategoriesResponse {
  total: number;
  categorias: ApiCategory[];
}

interface ApiBrand {
  MarcaId: number;
  Nombre: string;
  Estado: boolean;
}

interface ApiBrandsResponse {
  total: number;
  marcas: ApiBrand[];
}

export interface CatalogResult<T> {
  data: T;
}

export function useProductImageFallback(event: Event): void {
  const image = event.currentTarget;
  if (image instanceof HTMLImageElement && image.getAttribute('src') !== PRODUCT_IMAGE_FALLBACK) {
    image.src = PRODUCT_IMAGE_FALLBACK;
  }
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  getProducts(): Observable<CatalogResult<Product[]>> {
    return forkJoin({
      products: this.http.get<ApiProductsResponse>(`${API_BASE_URL}/productos`, {
        params: { limite: 500, desde: 0 },
      }),
      categories: this.http.get<ApiCategoriesResponse>(`${API_BASE_URL}/categorias`),
      brands: this.http.get<ApiBrandsResponse>(`${API_BASE_URL}/marcas`),
    }).pipe(
      map(({ products, categories, brands }) => {
        if (
          !Array.isArray(products.productos) ||
          !Array.isArray(categories.categorias) ||
          !Array.isArray(brands.marcas)
        ) {
          throw new Error('La API devolvió una respuesta de catálogo con formato inesperado.');
        }

        return {
          data: products.productos.map((product) =>
            this.normalizeProduct(product, categories.categorias, brands.marcas),
          ),
        };
      }),
    );
  }

  getProductById(id: number): Observable<CatalogResult<Product>> {
    return forkJoin({
      product: this.http.get<ApiProduct>(`${API_BASE_URL}/productos/${id}`),
      categories: this.http.get<ApiCategoriesResponse>(`${API_BASE_URL}/categorias`),
      brands: this.http.get<ApiBrandsResponse>(`${API_BASE_URL}/marcas`),
    }).pipe(
      map(({ product, categories, brands }) => ({
        data: this.normalizeProduct(product, categories.categorias, brands.marcas),
      })),
    );
  }

  getCategories(): Observable<CatalogResult<ProductCategory[]>> {
    return this.http.get<ApiCategoriesResponse>(`${API_BASE_URL}/categorias`).pipe(
      map((response) => {
        if (!Array.isArray(response.categorias)) {
          throw new Error('La respuesta de categorías no tiene el formato esperado.');
        }

        return {
          data: response.categorias
            .filter((category) => category.Estado !== false)
            .map((category) => ({
              id_categoria: category.CategoriaId,
              nombre: category.Nombre,
            })),
        };
      }),
    );
  }

  private normalizeProduct(
    product: ApiProduct,
    categories: ApiCategory[],
    brands: ApiBrand[],
  ): Product {
    const price = Number(product.Precio);
    if (!Number.isFinite(price)) {
      throw new Error(`El precio del producto ${product.ProductoId} no es válido.`);
    }

    const category =
      product.Categoria ??
      categories.find((item) => item.CategoriaId === product.CategoriaId)?.Nombre ??
      'Sin categoría';
    const brand =
      product.Marca ??
      brands.find((item) => item.MarcaId === product.MarcaId)?.Nombre ??
      'Sin marca';
    return {
      productoId: product.ProductoId,
      sku: product.SKU,
      nombre: product.Nombre,
      descripcion: product.Descripcion ?? '',
      precio: price,
      stock: product.Stock,
      stockMinimo: product.StockMinimo,
      categoria: category,
      marca: brand,
      urlImagen: this.resolveProductImage(product),
      estado: product.Estado,
    };
  }

  private resolveProductImage(product: ApiProduct): string {
    const relatedImages = product.ImagenesProducto ?? product.Imagenes ?? [];
    const imageUrl = [
      product.UrlImagen,
      product.ImagenUrl,
      product.urlImagen,
      product.imagenUrl,
      product.Imagen,
      relatedImages.find((image) => image.EsPrincipal)?.UrlImagen,
      relatedImages[0]?.UrlImagen,
    ].find((candidate) => typeof candidate === 'string' && candidate.trim());

    if (typeof imageUrl === 'string') {
      const normalizedImageUrl = imageUrl.trim();
      if (/^(https?:|data:|blob:)/i.test(normalizedImageUrl)) {
        return normalizedImageUrl;
      }
      return new URL(normalizedImageUrl.replace(/^\/+/, ''), `${API_BASE_URL}/`).toString();
    }

    return getProductImage(product.SKU) || PRODUCT_IMAGE_FALLBACK;
  }
}
