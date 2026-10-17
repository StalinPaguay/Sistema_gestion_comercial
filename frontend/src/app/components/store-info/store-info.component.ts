import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

interface InfoSection {
  title: string;
  paragraphs: string[];
}

interface InfoPage {
  eyebrow: string;
  title: string;
  intro: string;
  sections: InfoSection[];
}

const INFO_PAGES: Record<string, InfoPage> = {
  terms: {
    eyebrow: 'INFORMACIÓN DE LA TIENDA',
    title: 'Términos de servicio',
    intro:
      'Este documento es un borrador académico para la demostración de una tienda virtual. Debe revisarse y aprobarse antes de utilizarse como condición comercial real.',
    sections: [
      {
        title: '1. Uso de la plataforma',
        paragraphs: [
          'La plataforma permite consultar productos, gestionar una cuenta, registrar direcciones, emitir reseñas y simular el proceso de compra. Al utilizarla, la persona usuaria se compromete a proporcionar información veraz y a mantener la confidencialidad de sus credenciales.',
          'No se permite utilizar el sitio para actividades ilícitas, interferir con su funcionamiento ni publicar contenido ofensivo o engañoso.',
        ],
      },
      {
        title: '2. Productos, precios y disponibilidad',
        paragraphs: [
          'La información de productos, precios, imágenes y existencias se presenta con fines demostrativos y puede cambiar sin previo aviso. La disponibilidad definitiva se confirma al procesar cada pedido.',
        ],
      },
      {
        title: '3. Pedidos y pagos',
        paragraphs: [
          'El envío de un pedido registra una solicitud de compra y permite consultar su estado en la sección “Tus pedidos”. Los métodos de pago y cualquier comprobación mostrados en esta versión forman parte de un flujo académico; no se debe asumir que se ha efectuado un cobro real.',
        ],
      },
      {
        title: '4. Reseñas y contenido',
        paragraphs: [
          'Las reseñas deben referirse al producto y mantener un lenguaje respetuoso. La persona usuaria puede actualizar sus calificaciones y comentarios disponibles desde la sección “Tus reseñas”.',
        ],
      },
      {
        title: '5. Alcance del borrador',
        paragraphs: [
          'Este texto es orientativo, no constituye asesoría jurídica ni sustituye condiciones comerciales revisadas para una operación real. Los procedimientos de entrega, garantía, devoluciones y atención deberán completarse y aprobarse antes de publicar el servicio.',
        ],
      },
    ],
  },
  privacy: {
    eyebrow: 'INFORMACIÓN DE LA TIENDA',
    title: 'Política de privacidad',
    intro:
      'Esta política es un borrador académico de privacidad para la demostración de TECNOMEGA. Debe validarse frente a la normativa aplicable y a las prácticas reales antes de su publicación comercial.',
    sections: [
      {
        title: '1. Información que puede tratarse',
        paragraphs: [
          'La aplicación puede procesar datos de cuenta como nombres, apellidos, correo electrónico, teléfono e identificación, así como direcciones de entrega, pedidos, favoritos y reseñas. Los datos concretos dependen de las funciones utilizadas.',
        ],
      },
      {
        title: '2. Finalidades',
        paragraphs: [
          'En esta demostración, la información se utiliza para identificar la cuenta, presentar y actualizar el perfil, gestionar direcciones, registrar pedidos y mostrar las interacciones asociadas a productos.',
        ],
      },
      {
        title: '3. Acceso y protección',
        paragraphs: [
          'El acceso a las funciones personales requiere autenticación. En un servicio real, el responsable debe aplicar controles técnicos y organizativos adecuados, limitar el acceso a los datos y definir plazos de conservación y eliminación.',
        ],
      },
      {
        title: '4. Derechos y solicitudes',
        paragraphs: [
          'Las personas usuarias deberían disponer de un canal de contacto para consultar, corregir o solicitar la eliminación de sus datos, sujeto a las obligaciones legales aplicables. Para esta simulación, se puede usar el correo de contacto publicado en el pie de página.',
        ],
      },
      {
        title: '5. Recomendación para la demostración',
        paragraphs: [
          'Al tratarse de un proyecto académico, evita ingresar información sensible o datos reales que no sean necesarios para las pruebas. Este borrador no describe una certificación ni garantiza prácticas de tratamiento que no hayan sido verificadas.',
        ],
      },
    ],
  },
  faq: {
    eyebrow: 'CENTRO DE AYUDA',
    title: 'Preguntas frecuentes',
    intro: 'Respuestas rápidas para navegar por la demostración de TECNOMEGA.',
    sections: [
      {
        title: '¿Dónde consulto mis pedidos?',
        paragraphs: [
          'Inicia sesión, abre el menú de usuario y selecciona “Tus pedidos”. Allí puedes revisar estados, importes y el detalle de cada compra.',
        ],
      },
      {
        title: '¿Cómo cambio mis datos personales?',
        paragraphs: [
          'Desde el menú de usuario, entra en “Tu perfil”, actualiza los campos disponibles y selecciona “Guardar cambios”. La identificación se puede modificar cuando la cuenta tiene un perfil de cliente asociado.',
        ],
      },
      {
        title: '¿Puedo editar una reseña?',
        paragraphs: [
          'Sí. Abre “Tus reseñas” desde el menú de usuario, selecciona “Editar”, cambia la calificación o el comentario y guarda los cambios.',
        ],
      },
      {
        title: '¿Qué hago si no aparece mi pedido o reseña?',
        paragraphs: [
          'Comprueba que hayas iniciado sesión con la cuenta correcta e intenta actualizar la página. Si el problema continúa, utiliza el correo de contacto del pie de página e incluye una descripción del inconveniente, sin compartir tu contraseña.',
        ],
      },
      {
        title: '¿Estas páginas contienen políticas comerciales definitivas?',
        paragraphs: [
          'No. Los textos de Términos de servicio y Privacidad están identificados como borradores académicos y requieren revisión antes de representar condiciones reales.',
        ],
      },
    ],
  },
};

@Component({
  selector: 'app-store-info',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './store-info.component.html',
  styleUrl: './store-info.component.css',
})
export class StoreInfoComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly page = signal<InfoPage>(INFO_PAGES['terms']);

  ngOnInit(): void {
    this.route.data.subscribe((data: Record<string, unknown>) => {
      const section = typeof data['section'] === 'string' ? data['section'] : 'terms';
      this.page.set(INFO_PAGES[section] ?? INFO_PAGES['terms']);
    });
  }
}
