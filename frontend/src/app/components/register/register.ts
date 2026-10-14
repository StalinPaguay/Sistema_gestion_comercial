import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService, RegisterUserData } from '../../services/auth.service';

@Component({
  imports: [FormsModule, RouterLink],
  selector: 'app-register',
  styleUrl: './register.css',
  templateUrl: './register.html',
})
export class Register {
  private readonly authService = inject(AuthService);

  protected readonly passwordVisible = signal(false);
  protected readonly confirmPasswordVisible = signal(false);
  protected readonly feedback = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly registrationSuccess = signal(false);

  protected togglePasswordVisibility(field: 'password' | 'confirmation'): void {
    if (field === 'password') {
      this.passwordVisible.update((visible) => !visible);
      return;
    }

    this.confirmPasswordVisible.update((visible) => !visible);
  }

  protected onSubmit(form: NgForm): void {
    if (form.invalid || this.isSubmitting() || this.registrationSuccess()) {
      return;
    }

    const { password, confirmPassword } = form.value;
    if (password !== confirmPassword) {
      this.feedback.set('Las contraseñas no coinciden.');
      return;
    }

    const userData: RegisterUserData = {
      Nombres: form.value.firstName.trim(),
      Apellidos: form.value.lastName.trim(),
      Email: form.value.email.trim(),
      Telefono: form.value.phone?.trim() || null,
      Password: password,
      Identificacion: form.value.identification?.trim() || null,
    };

    this.feedback.set('');
    this.isSubmitting.set(true);
    this.authService.register(userData).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.registrationSuccess.set(true);
      },
      error: (error: HttpErrorResponse) => {
        this.feedback.set(this.getErrorMessage(error));
        this.isSubmitting.set(false);
      },
    });
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    const detail: unknown = error.error?.detail;
    if (typeof detail === 'string') {
      return detail;
    }

    if (Array.isArray(detail)) {
      const messages = detail
        .map((item: unknown) => {
          if (typeof item === 'object' && item !== null && 'msg' in item) {
            return String(item.msg);
          }
          return '';
        })
        .filter((message) => message.length > 0);

      if (messages.length > 0) {
        return messages.join(' ');
      }
    }

    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica que la API esté disponible.';
    }

    return 'No se pudo completar el registro. Inténtalo nuevamente.';
  }
}
