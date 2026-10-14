import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';

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

const PRODUCT_IMAGE_BY_SKU: Readonly<Record<string, string>> = {
  'TM-AIRPODS-001':
    'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?auto=format&fit=crop&w=800&q=80',
  'TM-GPRO-001':
    'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80',
  'TM-IPHONE-001':
    'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=80',
  'TM-MACBOOK-001':
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
  'TM-MXMASTER-001':
    'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80',
  'TM-ROG-001':
    'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80',
  'TM-RTX4090-001':
    'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=800&q=80',
  'TM-S24-001':
    'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=80',
};

export function getProductImage(sku: string): string {
  return PRODUCT_IMAGE_BY_SKU[sku.trim().toUpperCase()] ?? '';
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
          data: response.categorias.map((category) => ({
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
    const skuImage = getProductImage(product.SKU);
    if (skuImage) {
      return skuImage;
    }

    const relatedImages = product.ImagenesProducto ?? product.Imagenes ?? [];
    const imageUrl =
      product.UrlImagen ??
      product.ImagenUrl ??
      product.urlImagen ??
      product.imagenUrl ??
      product.Imagen ??
      relatedImages.find((image) => image.EsPrincipal)?.UrlImagen ??
      relatedImages[0]?.UrlImagen ??
      '';

    if (!imageUrl) {
      return '';
    }

    if (/^(https?:|data:|blob:)/i.test(imageUrl)) {
      return imageUrl;
    }

    return new URL(imageUrl.replace(/^\/+/, ''), `${API_BASE_URL}/`).toString();
  }
}
