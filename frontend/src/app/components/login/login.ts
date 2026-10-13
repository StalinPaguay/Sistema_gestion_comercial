import { Component, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  imports: [FormsModule, RouterLink],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {
  protected readonly passwordVisible = signal(false);
  protected readonly feedback = signal('');

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  protected onSubmit(form: NgForm): void {
    if (form.invalid) {
      return;
    }

    this.feedback.set('La autenticación aún no está conectada al servidor.');
  }
}
