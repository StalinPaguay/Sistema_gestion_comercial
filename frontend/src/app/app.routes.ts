import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login/login').then((module) => module.Login),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./components/register/register').then((module) => module.Register),
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./components/products/products.component').then(
        (module) => module.ProductsComponent,
      ),
  },
  {
    path: 'cart',
    loadComponent: () => import('./components/cart/cart').then((module) => module.Cart),
  },
  {
    path: 'order-history',
    loadComponent: () =>
      import('./components/order-history/order-history.component').then(
        (module) => module.OrderHistoryComponent,
      ),
  },
  {
    path: 'favorites',
    loadComponent: () =>
      import('./components/favorites/favorites.component').then(
        (module) => module.FavoritesComponent,
      ),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./components/profile/profile.component').then(
        (module) => module.ProfileComponent,
      ),
  },
  { path: 'perfil', pathMatch: 'full', redirectTo: 'profile' },
  { path: 'favoritos', pathMatch: 'full', redirectTo: 'favorites' },
  { path: 'historial-pedidos', pathMatch: 'full', redirectTo: 'order-history' },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
