import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { API_BASE_URL } from './api.config';
import { UserService } from './user.service';

describe('UserService password update', () => {
  let service: UserService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        UserService,
        {
          provide: AuthService,
          useValue: { accessToken: () => 'test-access-token' },
        },
      ],
    });
    service = TestBed.inject(UserService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('sends the password payload to the registered route with a bearer token', () => {
    const passwords = {
      PasswordActual: 'old-password',
      PasswordNuevo: 'new-password',
    };

    service.updatePassword(passwords).subscribe((response) => {
      expect(response.message).toBe('Contraseña actualizada exitosamente.');
    });

    const request = httpTesting.expectOne(`${API_BASE_URL}/auth/cambiar-password`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(passwords);
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-access-token');
    request.flush({
      mensaje: 'Contraseña actualizada exitosamente.',
      message: 'Contraseña actualizada exitosamente.',
    });
  });

  it('patches only fields accepted by the customer update endpoint', () => {
      const profile = {
        Nombres: 'Ana',
        Apellidos: 'Pérez',
        Email: 'ana@example.com',
        Telefono: '0991234567',
      };

      service.updateProfile(42, profile).subscribe();

      const request = httpTesting.expectOne(`${API_BASE_URL}/clientes/42`);
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual(profile);
      expect(request.request.body).not.toHaveProperty('Identificacion');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-access-token');
    request.flush(profile);
  });

  it('tries the next known route only when the previous route returns 404', () => {
    const passwords = {
      PasswordActual: 'old-password',
      PasswordNuevo: 'new-password',
    };
    let result: unknown;

    service.updatePassword(passwords).subscribe((response) => {
      result = response;
    });

    const canonicalPatch = httpTesting.expectOne(`${API_BASE_URL}/auth/cambiar-password`);
    canonicalPatch.flush({ detail: 'Not Found' }, { status: 404, statusText: 'Not Found' });

    const canonicalPost = httpTesting.expectOne(`${API_BASE_URL}/auth/cambiar-password`);
    expect(canonicalPost.request.method).toBe('POST');
    expect(canonicalPost.request.body).toEqual(passwords);
    expect(canonicalPost.request.headers.get('Authorization')).toMatch(/^Bearer .+/);
    canonicalPost.flush({
      mensaje: 'Contraseña actualizada exitosamente.',
      message: 'Contraseña actualizada exitosamente.',
    });

    expect(result).toEqual({
      mensaje: 'Contraseña actualizada exitosamente.',
      message: 'Contraseña actualizada exitosamente.',
    });
    httpTesting.expectNone(`${API_BASE_URL}/auth/password`);
  });

  it('does not try another route after an error other than 404', () => {
    let receivedError: unknown;

    service
      .updatePassword({
        PasswordActual: 'old-password',
        PasswordNuevo: 'new-password',
      })
      .subscribe({
        error: (error: unknown) => {
          receivedError = error;
        },
      });

    const request = httpTesting.expectOne(`${API_BASE_URL}/auth/cambiar-password`);
    request.flush(
      { detail: 'La contraseña actual no es correcta.' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(receivedError).toBeTruthy();
    httpTesting.expectNone(`${API_BASE_URL}/auth/password`);
    httpTesting.expectNone(`${API_BASE_URL}/api/auth/cambiar-password`);
  });
});
