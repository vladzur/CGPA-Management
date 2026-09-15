<script setup lang="ts">
/**
 * Página "Nosotros": declara la misión, la visión, los objetivos, los programas
 * y la historia de la organización, además de su ficha legal y la directiva vigente.
 *
 * Es la página que acredita la relación entre el dominio y la organización sin
 * fines de lucro registrada, por lo que incluye el nombre legal completo, el
 * número de personalidad jurídica, su estado y el domicilio.
 */
import { RouterLink } from 'vue-router';
import logoUrl from '../assets/logo-cgpa.png';
import { usePageMeta } from '../composables/usePageMeta';
import {
  BOARD_MEMBERS,
  BOARD_METADATA,
  HISTORY,
  MISSION,
  OBJECTIVES,
  ORGANIZATION,
  PROGRAMS,
  VISION,
  buildLegalIdentityStatement,
  formatAddress,
} from '../content/institutional';

usePageMeta('About');

const legalIdentity = buildLegalIdentityStatement();
const address = formatAddress();

/** Ficha legal mostrada en formato de definiciones. */
const legalFacts = [
  { label: 'Nombre legal', value: ORGANIZATION.legalName },
  { label: 'Sigla', value: ORGANIZATION.acronym },
  { label: 'Naturaleza jurídica', value: ORGANIZATION.nature },
  {
    label: 'Personalidad jurídica',
    value: `N° ${ORGANIZATION.legalPersonality.number}`,
  },
  {
    label: 'Fecha de concesión',
    value: ORGANIZATION.legalPersonality.grantDate,
  },
  {
    label: 'Decreto / resolución',
    value: ORGANIZATION.legalPersonality.decree,
  },
  {
    label: 'Registro',
    value: ORGANIZATION.legalPersonality.registry,
  },
  { label: 'Estado', value: ORGANIZATION.legalPersonality.status },
  { label: 'Domicilio', value: address },
];
</script>

<template>
  <div>
    <section class="bg-gradient-to-r from-liceo-primary to-liceo-secondary text-white">
      <div class="container mx-auto px-4 md:px-8 py-12 md:py-16">
        <div class="flex items-center gap-6">
          <img :src="logoUrl" alt="" class="h-24 w-24 shrink-0" aria-hidden="true" />
          <div>
            <h1 class="text-3xl md:text-4xl font-bold">Nosotros</h1>
            <p class="mt-2 opacity-95">{{ ORGANIZATION.legalName }}</p>
          </div>
        </div>
      </div>
    </section>

    <div class="container mx-auto px-4 md:px-8 py-12 space-y-14">
      <!-- Misión y visión -->
      <section class="grid gap-6 md:grid-cols-2">
        <article class="card bg-base-100 shadow-lg border border-base-200">
          <div class="card-body">
            <h2 class="card-title text-xl text-liceo-primary">Misión</h2>
            <p class="text-base-content/80">{{ MISSION }}</p>
          </div>
        </article>
        <article class="card bg-base-100 shadow-lg border border-base-200">
          <div class="card-body">
            <h2 class="card-title text-xl text-liceo-primary">Visión</h2>
            <p class="text-base-content/80">{{ VISION }}</p>
          </div>
        </article>
      </section>

      <!-- Objetivos -->
      <section>
        <h2 class="text-2xl md:text-3xl font-bold mb-6">Objetivos</h2>
        <ol class="space-y-3">
          <li
            v-for="(objective, index) in OBJECTIVES"
            :key="objective"
            class="flex items-start gap-4 bg-base-100 rounded-xl border border-base-200 p-4"
          >
            <span
              class="badge badge-primary badge-lg shrink-0 font-semibold"
              aria-hidden="true"
            >
              {{ index + 1 }}
            </span>
            <span class="text-sm text-base-content/80 pt-1">{{ objective }}</span>
          </li>
        </ol>
      </section>

      <!-- Programas y servicios -->
      <section>
        <h2 class="text-2xl md:text-3xl font-bold mb-3">Programas y servicios</h2>
        <p class="text-base-content/70 max-w-3xl mb-8">
          Estas son las líneas de trabajo permanentes de la organización, financiadas
          con las cuotas y actividades que aportan las familias.
        </p>

        <div class="grid gap-6 md:grid-cols-3">
          <article
            v-for="program in PROGRAMS"
            :key="program.id"
            class="card bg-base-100 shadow-lg border border-base-200"
          >
            <div class="card-body">
              <h3 class="card-title text-lg">{{ program.title }}</h3>
              <p class="text-sm text-base-content/70">{{ program.description }}</p>
            </div>
          </article>
        </div>
      </section>

      <!-- Historia -->
      <section>
        <h2 class="text-2xl md:text-3xl font-bold mb-4">Nuestra historia</h2>
        <p class="text-base-content/80 max-w-4xl">{{ HISTORY }}</p>
      </section>

      <!-- Ficha legal -->
      <section>
        <h2 class="text-2xl md:text-3xl font-bold mb-3">
          Identificación legal de la organización
        </h2>
        <p class="text-base-content/70 max-w-3xl mb-8">
          {{ legalIdentity }}. Estos datos provienen del certificado de personalidad
          jurídica vigente y permiten verificar la existencia legal de la organización.
        </p>

        <div class="card bg-base-100 shadow-lg border border-base-200 overflow-hidden">
          <dl class="divide-y divide-base-200">
            <div
              v-for="fact in legalFacts"
              :key="fact.label"
              class="grid gap-1 sm:grid-cols-3 px-6 py-4"
            >
              <dt class="text-sm text-base-content/60">{{ fact.label }}</dt>
              <dd class="sm:col-span-2 font-medium">{{ fact.value }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <!-- Directiva -->
      <section id="directiva" class="scroll-mt-24">
        <h2 class="text-2xl md:text-3xl font-bold mb-3">Directiva vigente</h2>
        <p class="text-base-content/70 max-w-3xl mb-8">
          Integrantes electos en la última elección de directiva
          ({{ BOARD_METADATA.lastElection }}), por un período de
          {{ BOARD_METADATA.term }}. Se publican únicamente los nombres y cargos;
          los datos personales de cada integrante no se exponen en este sitio.
        </p>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="member in BOARD_MEMBERS"
            :key="`${member.role}-${member.name}`"
            class="card bg-base-100 shadow-md border border-base-200"
          >
            <div class="card-body py-5">
              <p class="text-xs uppercase tracking-wide text-liceo-primary font-semibold">
                {{ member.role }}
              </p>
              <p class="font-medium">{{ member.name }}</p>
            </div>
          </article>
        </div>
      </section>

      <!-- Enlaces relacionados -->
      <section class="rounded-2xl bg-base-100 border border-base-200 p-8">
        <h2 class="text-xl font-bold mb-4">Continúa explorando</h2>
        <div class="flex flex-wrap gap-3">
          <RouterLink to="/proyectos" class="btn btn-outline btn-primary btn-sm">
            Proyectos financiados
          </RouterLink>
          <RouterLink to="/transparencia" class="btn btn-outline btn-primary btn-sm">
            Transparencia financiera
          </RouterLink>
          <RouterLink to="/comunicados" class="btn btn-outline btn-primary btn-sm">
            Comunicados
          </RouterLink>
          <RouterLink to="/contacto" class="btn btn-outline btn-primary btn-sm">
            Contacto
          </RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>
