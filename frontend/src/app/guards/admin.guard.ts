import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();
  const token = authService.accessToken();

  if (token && user && user.Rol === 'Administrador') {
    return true;
  }

  // Si no es administrador, redirigir a login o tienda
  if (token && user) {
    void router.navigate(['/products']);
    return false;
  }

  void router.navigate(['/login'], { queryParams: { returnUrl: '/admin' } });
  return false;
};
