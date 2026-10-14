import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, LoginCredentials } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login implements OnInit {
  private readonly rememberedEmailKey = 'tecnomega_remembered_email';
  private readonly rememberMeKey = 'tecnomega_remember_me';
  private readonly authService = inject(AuthService);
  private readonly cartService = inject(CartService);
  private readonly router = inject(Router);

  protected readonly passwordVisible = signal(false);
  protected readonly feedback = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly loginForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(4)],
    }),
    remember: new FormControl(false, { nonNullable: true }),
  });

  ngOnInit(): void {
    const remembered = this.readRememberedCredentials();
    if (remembered) {
      this.loginForm.patchValue({ email: remembered.email, remember: true });
    }
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  protected onSubmit(): void {
    if (this.loginForm.invalid || this.isSubmitting()) {
      return;
    }

    const formValue = this.loginForm.getRawValue();
    const credentials: LoginCredentials = {
      Email: formValue.email.trim(),
      Password: formValue.password,
    };
    this.feedback.set('');
    this.persistRememberedEmail(formValue.email.trim(), formValue.remember);
    this.isSubmitting.set(true);
    this.authService.login(credentials, formValue.remember).subscribe({
      next: () => {
        this.cartService.reconcileGuestCart().subscribe({
          next: () => this.finishLogin(),
          error: () => this.finishLogin('/cart'),
        });
      },
      error: (error: HttpErrorResponse) => {
        const detail: unknown = error.error?.detail;
        this.feedback.set(
          typeof detail === 'string'
            ? detail
            : error.status === 0
              ? 'No se pudo conectar con el servidor. Verifica que la API esté disponible.'
              : 'No se pudo iniciar sesión. Verifica tus credenciales e inténtalo nuevamente.',
        );
        this.isSubmitting.set(false);
      },
    });
  }

  private finishLogin(route: '/products' | '/cart' = '/products'): void {
    this.isSubmitting.set(false);
    void this.router.navigate([route]);
  }

  private readRememberedCredentials(): { email: string } | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      if (localStorage.getItem(this.rememberMeKey) !== 'true') {
        return null;
      }
      const email = localStorage.getItem(this.rememberedEmailKey);
      return email ? { email } : null;
    } catch {
      return null;
    }
  }

  private persistRememberedEmail(email: string, remember: boolean): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      if (remember) {
        localStorage.setItem(this.rememberedEmailKey, email);
        localStorage.setItem(this.rememberMeKey, 'true');
      } else {
        localStorage.removeItem(this.rememberedEmailKey);
        localStorage.removeItem(this.rememberMeKey);
      }
    } catch {
      this.feedback.set('No fue posible guardar la preferencia "Recordarme" en este navegador.');
    }
  }
}
