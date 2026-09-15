<script setup lang="ts">
/**
 * Página de contacto del sitio institucional.
 *
 * Combina los datos de contacto oficiales con un formulario que persiste el
 * mensaje en la bandeja de la directiva (endpoint `POST /mensajes`), de modo que
 * la página sea realmente funcional y no un simple enlace de correo.
 */
import { reactive, ref } from 'vue';
import { MENSAJE_MOTIVO_LABELS, type MensajeMotivo } from '@cgpa/shared';
import apiClient from '../plugins/axios';
import { usePageMeta } from '../composables/usePageMeta';
import {
  ORGANIZATION,
  PENDING_LABEL,
  buildLegalIdentityStatement,
  formatAddress,
} from '../content/institutional';
import {
  buildContactPayload,
  createEmptyContactForm,
  isSpamSubmission,
  validateContactForm,
  type ContactFormErrors,
} from '../utils/contact-form';

usePageMeta('Contact');

const MOTIVO_OPTIONS = Object.entries(MENSAJE_MOTIVO_LABELS) as [
  MensajeMotivo,
  string,
][];

const form = reactive(createEmptyContactForm());
const errors = ref<ContactFormErrors>({});
const submitting = ref(false);
const successMessage = ref('');
const errorMessage = ref('');

const contactEmail = ORGANIZATION.contact.email;
const contactPhone = ORGANIZATION.contact.phone;
const address = formatAddress();
const legalIdentity = buildLegalIdentityStatement();

const resetFeedback = (): void => {
  errors.value = {};
  successMessage.value = '';
  errorMessage.value = '';
};

const handleSubmit = async (): Promise<void> => {
  resetFeedback();

  // Los envíos automatizados se descartan sin dar señales de que fueron detectados.
  if (isSpamSubmission(form)) return;

  const validationErrors = validateContactForm(form);
  if (Object.keys(validationErrors).length > 0) {
    errors.value = validationErrors;
    return;
  }

  submitting.value = true;

  try {
    await apiClient.post('/mensajes', buildContactPayload(form));

    successMessage.value =
      'Recibimos tu mensaje. La directiva lo revisará y responderá al correo que indicaste.';

    Object.assign(form, createEmptyContactForm());
  } catch {
    errorMessage.value =
      'No pudimos enviar tu mensaje en este momento. Intenta nuevamente en unos minutos.';
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div>
    <section class="bg-gradient-to-r from-liceo-primary to-liceo-secondary text-white">
      <div class="container mx-auto px-4 md:px-8 py-12 md:py-16">
        <h1 class="text-3xl md:text-4xl font-bold">Contacto</h1>
        <p class="mt-3 max-w-3xl opacity-95">
          Escríbenos para consultas sobre cuotas, proyectos, actividades o cualquier
          tema relacionado con el Centro General de Padres y Apoderados del Liceo
          Alexander Graham Bell.
        </p>
      </div>
    </section>

    <div class="container mx-auto px-4 md:px-8 py-12 grid gap-10 lg:grid-cols-3">
      <!-- Datos de contacto -->
      <section class="lg:col-span-1 space-y-6">
        <div class="card bg-base-100 shadow-lg border border-base-200">
          <div class="card-body">
            <h2 class="card-title text-lg">Datos de la organización</h2>

            <dl class="mt-2 space-y-4 text-sm">
              <div>
                <dt class="text-base-content/60">Organización</dt>
                <dd class="font-medium">{{ ORGANIZATION.legalName }}</dd>
              </div>
              <div>
                <dt class="text-base-content/60">Domicilio</dt>
                <dd class="font-medium">{{ address }}</dd>
              </div>
              <div>
                <dt class="text-base-content/60">Correo</dt>
                <dd class="font-medium">
                  <a
                    v-if="contactEmail"
                    :href="`mailto:${contactEmail}`"
                    class="link link-primary"
                  >
                    {{ contactEmail }}
                  </a>
                  <span v-else class="text-base-content/60">{{ PENDING_LABEL }}</span>
                </dd>
              </div>
              <div>
                <dt class="text-base-content/60">Teléfono</dt>
                <dd class="font-medium">
                  <span v-if="contactPhone">{{ contactPhone }}</span>
                  <span v-else class="text-base-content/60">{{ PENDING_LABEL }}</span>
                </dd>
              </div>
              <div>
                <dt class="text-base-content/60">Atención</dt>
                <dd class="font-medium">{{ ORGANIZATION.contact.officeHours }}</dd>
              </div>
            </dl>

            <p class="text-xs text-base-content/60 mt-4">{{ legalIdentity }}</p>
          </div>
        </div>

        <div class="alert">
          <span class="text-sm">
            Los mensajes enviados por este formulario quedan registrados con fecha y
            hora en la bandeja de la directiva, junto con el motivo de la consulta.
          </span>
        </div>
      </section>

      <!-- Formulario -->
      <section class="lg:col-span-2">
        <div class="card bg-base-100 shadow-lg border border-base-200">
          <div class="card-body">
            <h2 class="card-title text-xl">Enviar un mensaje a la directiva</h2>
            <p class="text-sm text-base-content/70">
              Completa el formulario y la directiva responderá al correo que
              indiques. Los campos marcados con asterisco son obligatorios.
            </p>

            <form class="mt-6 space-y-5" novalidate @submit.prevent="handleSubmit">
              <div class="grid gap-5 md:grid-cols-2">
                <div class="form-control">
                  <label class="label" for="contact-name">
                    <span class="label-text">Nombre completo *</span>
                  </label>
                  <input
                    id="contact-name"
                    v-model="form.nombre"
                    type="text"
                    class="input input-bordered w-full"
                    :class="{ 'input-error': errors.nombre }"
                    autocomplete="name"
                    maxlength="120"
                  />
                  <p v-if="errors.nombre" class="text-error text-xs mt-1">
                    {{ errors.nombre }}
                  </p>
                </div>

                <div class="form-control">
                  <label class="label" for="contact-email">
                    <span class="label-text">Correo electrónico *</span>
                  </label>
                  <input
                    id="contact-email"
                    v-model="form.email"
                    type="email"
                    class="input input-bordered w-full"
                    :class="{ 'input-error': errors.email }"
                    autocomplete="email"
                    maxlength="160"
                  />
                  <p v-if="errors.email" class="text-error text-xs mt-1">
                    {{ errors.email }}
                  </p>
                </div>

                <div class="form-control">
                  <label class="label" for="contact-phone">
                    <span class="label-text">Teléfono (opcional)</span>
                  </label>
                  <input
                    id="contact-phone"
                    v-model="form.telefono"
                    type="tel"
                    class="input input-bordered w-full"
                    autocomplete="tel"
                    maxlength="40"
                  />
                </div>

                <div class="form-control">
                  <label class="label" for="contact-reason">
                    <span class="label-text">Motivo de la consulta *</span>
                  </label>
                  <select
                    id="contact-reason"
                    v-model="form.motivo"
                    class="select select-bordered w-full"
                  >
                    <option
                      v-for="[value, label] in MOTIVO_OPTIONS"
                      :key="value"
                      :value="value"
                    >
                      {{ label }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="form-control">
                <label class="label" for="contact-message">
                  <span class="label-text">Mensaje *</span>
                </label>
                <textarea
                  id="contact-message"
                  v-model="form.mensaje"
                  class="textarea textarea-bordered h-36 w-full"
                  :class="{ 'textarea-error': errors.mensaje }"
                  maxlength="2000"
                ></textarea>
                <p v-if="errors.mensaje" class="text-error text-xs mt-1">
                  {{ errors.mensaje }}
                </p>
              </div>

              <!-- Campo trampa para envíos automatizados: permanece oculto al usuario -->
              <div class="hidden" aria-hidden="true">
                <label for="contact-website">No completar este campo</label>
                <input
                  id="contact-website"
                  v-model="form.sitioWeb"
                  type="text"
                  tabindex="-1"
                  autocomplete="off"
                />
              </div>

              <div class="form-control">
                <label class="label cursor-pointer justify-start gap-3">
                  <input
                    v-model="form.aceptaPrivacidad"
                    type="checkbox"
                    class="checkbox checkbox-primary"
                  />
                  <span class="label-text">
                    Autorizo el uso de mis datos únicamente para responder esta
                    consulta. *
                  </span>
                </label>
                <p v-if="errors.aceptaPrivacidad" class="text-error text-xs mt-1">
                  {{ errors.aceptaPrivacidad }}
                </p>
              </div>

              <output v-if="successMessage" class="alert alert-success">
                <span>{{ successMessage }}</span>
              </output>

              <div v-if="errorMessage" class="alert alert-error" role="alert">
                <span>{{ errorMessage }}</span>
              </div>

              <div class="card-actions justify-end">
                <button
                  type="submit"
                  class="btn btn-primary"
                  :disabled="submitting"
                >
                  <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
                  Enviar mensaje
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
