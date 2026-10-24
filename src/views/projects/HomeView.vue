<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const auth = useAuthStore()

async function logout(): Promise<void> {
  auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <main class="home-page">
    <el-card class="home-card">
      <h1>TeamFlow</h1>
      <p>你好，{{ auth.user?.displayName }}。</p>
      <p>工程初始化阶段已接通登录。项目与任务功能将在下一阶段接入。</p>
      <el-button @click="logout">退出登录</el-button>
    </el-card>
  </main>
</template>

<style scoped>
.home-page {
  max-width: 960px;
  margin: 48px auto;
  padding: 0 24px;
}
.home-card {
  padding: 8px;
}
</style>
