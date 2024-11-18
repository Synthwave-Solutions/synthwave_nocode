<script setup lang="ts">
import { computed } from 'vue';
import { useRootStore } from '@/stores/root.store';
import { useUIStore } from '@/stores/ui.store';

const rootStore = useRootStore();
const uiStore = useUIStore();

const basePath = computed(() => rootStore.baseUrl);

const logoPath = computed(() => basePath.value + uiStore.logo);
</script>

<template>
	<img :src="logoPath" :class="[$style.img, $style.authLogo]" alt="SynthStream.io" />
</template>

<style lang="scss" module>
.img {
	height: 32px;
}

.authLogo {
	height: 48px;  // Bigger logo size for the auth pages
}
</style>
