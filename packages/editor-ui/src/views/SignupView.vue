<script lang="ts" setup>
import AuthView from '@/views/AuthView.vue';
import { useToast } from '@/composables/useToast';

import { computed, onMounted, ref } from 'vue';
import type { IFormBoxConfig } from '@/Interface';
import { VIEWS } from '@/constants';
import { useUIStore } from '@/stores/ui.store';
import { useUsersStore } from '@/stores/users.store';
import { useI18n } from '@/composables/useI18n';
import { useRoute, useRouter } from 'vue-router';

const uiStore = useUIStore();
const usersStore = useUsersStore();

const toast = useToast();
const i18n = useI18n();
const router = useRouter();
const route = useRoute();

const FORM_CONFIG: IFormBoxConfig = {
  title: i18n.baseText('auth.signup.setupYourAccount'),
  buttonText: i18n.baseText('auth.signup.finishAccountSetup'),
  redirectText: i18n.baseText('auth.alreadyHaveAccount'),
  redirectLink: '/signin',
  inputs: [
    {
      name: 'firstName',
      properties: {
        label: i18n.baseText('auth.firstName'),
        maxlength: 32,
        required: true,
        autocomplete: 'given-name',
        capitalize: true,
        focusInitially: true,
      },
    },
    {
      name: 'lastName',
      properties: {
        label: i18n.baseText('auth.lastName'),
        maxlength: 32,
        required: true,
        autocomplete: 'family-name',
        capitalize: true,
      },
    },
    {
      name: 'email',
      properties: {
        label: i18n.baseText('auth.email'),
        type: 'email',
        required: true,
        autocomplete: 'email',
      },
    },
    {
      name: 'password',
      properties: {
        label: i18n.baseText('auth.password'),
        type: 'password',
        validationRules: [{ name: 'DEFAULT_PASSWORD_RULES' }],
        required: true,
        infoText: i18n.baseText('auth.defaultPasswordRequirements'),
        autocomplete: 'new-password',
        capitalize: true,
      },
    },
    {
      name: 'agree',
      properties: {
        label: i18n.baseText('auth.agreement.label'),
        type: 'checkbox',
      },
    },
  ],
};

const loading = ref(false);

async function onSubmit(values: { [key: string]: string | boolean }) {
  try {
    loading.value = true;
    await usersStore.signup({
      ...values,
    } as {
      firstName: string;
      lastName: string;
      password: string;
      email: string;
    });

    if (values.agree === true) {
      try {
        await uiStore.submitContactEmail(values.email.toString(), values.agree);
      } catch {}
    }

    await router.push({ name: VIEWS.HOMEPAGE });
  } catch (error) {
    toast.showError(error, i18n.baseText('auth.signup.setupYourAccountError'));
  }
  loading.value = false;
}
</script>

<template>
  <AuthView
    :form="FORM_CONFIG"
    :form-loading="loading"
    @submit="onSubmit"
  />
</template>
