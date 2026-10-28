<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from './components/AppShell.vue'

const route = useRoute()
const hasShell = computed(() => Boolean(route.meta.requiresAuth))
</script>

<template>
  <AppShell v-if="hasShell"><RouterView /></AppShell>
  <RouterView v-else />
</template>
