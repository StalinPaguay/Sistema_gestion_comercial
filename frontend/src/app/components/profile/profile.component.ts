import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FavoritesService } from '../../services/favorites.service';
import {
  DeliveryAddress,
  DeliveryAddressInput,
  ProfileUpdate,
  PasswordUpdate,
  UserProfile,
  UserService,
} from '../../services/user.service';

interface AddressForm {
  Provincia: string;
  Ciudad: string;
  Direccion: string;
  Referencia: string;
  CodigoPostal: string;
  EsPrincipal: boolean;
}

const EMPTY_ADDRESS_FORM: AddressForm = {
  Provincia: '',
  Ciudad: '',
  Direccion: '',
  Referencia: '',
  CodigoPostal: '',
  EsPrincipal: false,
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly router = inject(Router);

  protected readonly profile = signal<UserProfile | null>(null);
  protected readonly addresses = signal<DeliveryAddress[]>([]);
  protected readonly addressForm = signal<AddressForm>({ ...EMPTY_ADDRESS_FORM });
  protected readonly editingAddressId = signal<number | null>(null);
  protected readonly addressFormOpen = signal(false);
  protected readonly loading = signal(true);
  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly savingAddress = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly passwordFeedback = signal('');
  protected readonly passwordFeedbackIsError = signal(false);

  ngOnInit(): void {
    if (!this.authService.accessToken()) {
      void this.router.navigate(['/login']);
      return;
    }
    this.loadProfile();
  }

  protected saveProfile(form: NgForm): void {
    const current = this.profile();
    if (!current || form.invalid || this.savingProfile()) {
      return;
    }


    const update: ProfileUpdate = {
      Identificacion: String(form.value['Identificacion'] ?? '').trim(),
      Nombres: String(form.value['Nombres']).trim(),
      Apellidos: String(form.value['Apellidos']).trim(),
      Email: String(form.value['Email']).trim(),
      Telefono: String(form.value['Telefono'] ?? '').trim() || null,
    };
    this.errorMessage.set('');
    this.successMessage.set('');
    this.savingProfile.set(true);

    this.userService.updateProfile(update).subscribe({
      next: (response) => {
        if (this.isProfile(response)) {
  this.profile.set({ ...current, ...response });

  if (current.ClienteId === null) {
    this.loadProfile();
  }
} else {
          this.profile.set({ ...current, ...update });
        }
        this.successMessage.set('Tus datos personales se actualizaron correctamente.');
        this.savingProfile.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.requestError(error, 'No se pudo guardar tu perfil.'));
        this.savingProfile.set(false);
      },
    });
  }

  protected logout(): void {
    this.favoritesService.clearForLogout();
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  protected updatePassword(form: NgForm): void {
    if (form.invalid || this.savingPassword()) {
      this.passwordFeedback.set('Completa correctamente los tres campos de contraseña.');
      this.passwordFeedbackIsError.set(true);
      return;
    }

    if (form.value['newPassword'] !== form.value['confirmPassword']) {
      this.passwordFeedback.set('La nueva contraseña y su confirmación no coinciden.');
      this.passwordFeedbackIsError.set(true);
      return;
    }

    const passwords: PasswordUpdate = {
      PasswordActual: String(form.value['currentPassword']),
      PasswordNuevo: String(form.value['newPassword']),
    };
    this.passwordFeedback.set('');
    this.passwordFeedbackIsError.set(false);
    this.savingPassword.set(true);

    this.userService.updatePassword(passwords).subscribe({
      next: (response) => {
        this.passwordFeedback.set(
          response.message ?? response.mensaje ?? 'La contraseña se actualizó correctamente.',
        );
        this.passwordFeedbackIsError.set(false);
        this.savingPassword.set(false);
        form.resetForm();
      },
      error: (error: unknown) => {
        this.passwordFeedback.set(
          this.requestError(error, 'No se pudo actualizar la contraseña. Inténtalo de nuevo.'),
        );
        this.passwordFeedbackIsError.set(true);
        this.savingPassword.set(false);
      },
    });
  }

  protected openNewAddress(): void {
    this.editingAddressId.set(null);
    this.addressForm.set({ ...EMPTY_ADDRESS_FORM });
    this.addressFormOpen.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  protected editAddress(address: DeliveryAddress): void {
    this.editingAddressId.set(address.DireccionId);
    this.addressForm.set({
      Provincia: address.Provincia ?? '',
      Ciudad: address.Ciudad ?? '',
      Direccion: address.Direccion,
      Referencia: address.Referencia ?? '',
      CodigoPostal: address.CodigoPostal ?? '',
      EsPrincipal: address.EsPrincipal,
    });
    this.addressFormOpen.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  protected cancelAddressForm(): void {
    this.addressFormOpen.set(false);
    this.editingAddressId.set(null);
    this.addressForm.set({ ...EMPTY_ADDRESS_FORM });
  }

  protected saveAddress(form: NgForm): void {
    if (form.invalid || this.savingAddress()) {
      return;
    }

    const input = form.value as AddressForm;
    const payload: DeliveryAddressInput = {
      Provincia: input.Provincia.trim() || null,
      Ciudad: input.Ciudad.trim() || null,
      Direccion: input.Direccion.trim(),
      Referencia: input.Referencia.trim() || null,
      CodigoPostal: input.CodigoPostal.trim() || null,
      EsPrincipal: Boolean(input.EsPrincipal),
    };
    const addressId = this.editingAddressId();
    this.errorMessage.set('');
    this.successMessage.set('');
    this.savingAddress.set(true);
    const request =
      addressId === null
        ? this.userService.createAddress(payload)
        : this.userService.updateAddress(addressId, payload);

    request.subscribe({
      next: (address) => {
        this.addresses.update((current) => {
          const withoutUpdated = current.filter(
            (item) => item.DireccionId !== address.DireccionId,
          );
          const normalized = address.EsPrincipal
            ? withoutUpdated.map((item) => ({ ...item, EsPrincipal: false }))
            : withoutUpdated;
          return [...normalized, address];
        });
        this.successMessage.set(
          addressId === null
            ? 'La dirección se agregó correctamente.'
            : 'La dirección se actualizó correctamente.',
        );
        this.savingAddress.set(false);
        this.cancelAddressForm();
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.requestError(error, 'No se pudo guardar la dirección.'));
        this.savingAddress.set(false);
      },
    });
  }

  protected makePrimary(address: DeliveryAddress): void {
    if (address.EsPrincipal) {
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');
    this.userService
      .updateAddress(address.DireccionId, { EsPrincipal: true })
      .subscribe({
        next: (updated) => {
          this.addresses.update((current) =>
            current.map((item) => ({
              ...item,
              EsPrincipal: item.DireccionId === updated.DireccionId,
            })),
          );
          this.successMessage.set('La dirección principal se actualizó.');
        },
        error: (error: unknown) => {
          this.errorMessage.set(
            this.requestError(error, 'No se pudo cambiar la dirección principal.'),
          );
        },
      });
  }

  protected deleteAddress(address: DeliveryAddress): void {
    if (!globalThis.confirm(`¿Eliminar la dirección "${address.Direccion}"?`)) {
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');
    this.userService.deleteAddress(address.DireccionId).subscribe({
      next: () => {
        this.addresses.update((current) =>
          current.filter((item) => item.DireccionId !== address.DireccionId),
        );
        this.successMessage.set('La dirección se eliminó correctamente.');
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.requestError(error, 'No se pudo eliminar la dirección.'));
      },
    });
  }

  private loadProfile(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.userService.getProfile().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        if (profile.ClienteId === null) {
          this.addresses.set([]);
          this.loading.set(false);
          return;
        }

        this.userService.getAddresses().subscribe({
          next: (addresses) => {
            this.addresses.set(addresses);
            this.loading.set(false);
          },
          error: (error: unknown) => {
            this.errorMessage.set(
              this.requestError(error, 'No se pudieron cargar tus direcciones.'),
            );
            this.loading.set(false);
          },
        });
      },
      error: (error: unknown) => {
        this.errorMessage.set(
          this.requestError(error, 'No se pudo cargar tu perfil. Inténtalo de nuevo.'),
        );
        this.loading.set(false);
      },
    });
  }

  private requestError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const detail: unknown = error.error?.detail;
      if (typeof detail === 'string') {
        return detail;
      }
      if (error.status === 0) {
        return 'No se pudo conectar con el servidor. Tus cambios no se guardaron.';
      }
      if (error.status === 401) {
        this.logout();
        return 'Tu sesión expiró. Inicia sesión nuevamente.';
      }
    }
    return fallback;
  }

  private isProfile(value: unknown): value is Partial<UserProfile> {
    return typeof value === 'object' && value !== null && 'Nombres' in value;
  }
}
