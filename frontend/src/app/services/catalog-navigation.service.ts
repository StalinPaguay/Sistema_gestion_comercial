import { Injectable, signal } from '@angular/core';
import { ProductCategory } from './product.service';

@Injectable({ providedIn: 'root' })
export class CatalogNavigationService {
  readonly categories = signal<ProductCategory[]>([]);
  readonly selectedCategory = signal('');
  readonly selectedCategories = signal<string[]>([]);
  readonly selectedMaxPrice = signal(0);
  readonly maximumAvailablePrice = signal(1);
  readonly selectedMinimumRating = signal(0);
  readonly searchTerm = signal('');

  setCategories(categories: ProductCategory[]): void {
    this.categories.set(categories);
  }
}
