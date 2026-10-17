import { Injectable, signal } from '@angular/core';
import { ProductCategory } from './product.service';

@Injectable({ providedIn: 'root' })
export class CatalogNavigationService {
  readonly categories = signal<ProductCategory[]>([]);
  readonly selectedCategory = signal('');
  readonly searchTerm = signal('');

  setCategories(categories: ProductCategory[]): void {
    this.categories.set(categories);
  }
}
