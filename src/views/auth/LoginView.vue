<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { ApiError, normalizeApiError } from '../../api/client'

const router = useRouter()
const auth = useAuthStore()
const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const errorTraceId = ref('')

async function submit(): Promise<void> {
  errorMessage.value = ''
  errorTraceId.value = ''
  if (!username.value.trim() || !password.value) {
    errorMessage.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  try {
    await auth.login(username.value.trim(), password.value)
    await router.push({ name: 'home' })
  } catch (error) {
    const failure = error instanceof ApiError ? error : normalizeApiError(error)
    errorMessage.value =
      failure.code === 'AUTH.INVALID_CREDENTIALS'
        ? '用户名或密码不正确'
        : failure.code === 'AUTH.TOO_MANY_ATTEMPTS'
          ? '尝试次数过多，请稍后重试'
          : failure.message
    errorTraceId.value = failure.traceId ?? ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-visual" aria-label="TeamFlow 项目协作介绍">
      <div class="login-brand"><span class="login-logo">T</span><strong>TeamFlow</strong></div>
      <div class="login-hero">
        <span>把每一步，放在同一张图上</span>
        <h1>让团队协作<br />更清晰地向前。</h1>
        <p>从项目分工到任务交付，让每一次推进都有方向、有记录、可追溯。</p>
      </div>
      <div class="login-preview" aria-hidden="true">
        <div class="preview-heading">
          <span class="preview-project-mark">A</span>
          <div><strong>Atlas 应用升级</strong><small>本周进度 · 72%</small></div>
          <span>↗</span>
        </div>
        <div class="preview-board">
          <div><strong>待处理</strong><i /><i /></div>
          <div><strong>进行中</strong><i /><i /></div>
          <div><strong>待评审</strong><i /><i /></div>
        </div>
      </div>
      <div class="login-visual-foot">
        <span>项目有序推进</span><span>权限清晰可见</span><span>记录随时可追溯</span>
      </div>
    </section>

    <section class="login-form-side">
      <p class="login-new-member">新成员请联系管理员开通账号</p>
      <div class="login-box">
        <span class="login-welcome">欢迎回来</span>
        <h2>登录 TeamFlow</h2>
        <p class="login-subtitle">继续推进你和团队的项目。</p>
        <el-form label-position="top" @submit.prevent="submit">
          <el-form-item label="用户名">
            <el-input
              v-model="username"
              autocomplete="username"
              maxlength="64"
              placeholder="请输入用户名"
            />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="password"
              type="password"
              autocomplete="current-password"
              show-password
              placeholder="请输入密码"
            />
          </el-form-item>
          <el-alert
            v-if="errorMessage"
            class="login-error"
            :title="errorMessage"
            type="error"
            show-icon
            :closable="false"
          >
            <template v-if="errorTraceId" #default
              ><span class="login-trace">TraceId：{{ errorTraceId }}</span></template
            >
          </el-alert>
          <el-button class="login-submit" type="primary" native-type="submit" :loading="loading"
            >登录工作空间 <span aria-hidden="true">→</span></el-button
          >
        </el-form>
        <div class="login-divider"><span>安全协作，从清晰的权限开始</span></div>
        <div class="login-security">✓ 项目成员权限保护 · 操作记录可追溯</div>
      </div>
      <small class="login-copyright">© 2026 TeamFlow · 让每个项目有序前进</small>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
  background: #fff;
}
.login-visual {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 900px;
  padding: 52px 64px 72px;
  background: #14213b;
  color: #fff;
}
.login-visual::before {
  position: absolute;
  right: -190px;
  top: 140px;
  width: 490px;
  height: 490px;
  border-radius: 50%;
  background: #1c2b4c;
  content: '';
}
.login-brand,
.preview-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
.login-brand {
  position: relative;
  z-index: 1;
  font-size: 20px;
}
.login-logo {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: #fff;
  color: #2f61e8;
  font-size: 23px;
  font-weight: 800;
}
.login-hero {
  position: relative;
  z-index: 1;
  margin-top: 130px;
}
.login-hero span {
  color: #d6e2fc;
  font-size: 13px;
  font-weight: 700;
}
.login-hero h1 {
  margin: 30px 0 22px;
  font-size: clamp(36px, 3.5vw, 48px);
  line-height: 1.18;
  letter-spacing: -0.04em;
}
.login-hero p {
  max-width: 490px;
  margin: 0;
  color: #d0dbef;
  font-size: 14px;
  line-height: 1.7;
}
.login-preview {
  position: relative;
  z-index: 1;
  width: min(100%, 600px);
  margin-top: 76px;
  padding: 22px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 22px 60px #0a132c55;
  color: #17243b;
}
.preview-project-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: #e7edff;
  color: #4169df;
  font-weight: 800;
}
.preview-heading div {
  display: grid;
  gap: 5px;
}
.preview-heading strong {
  font-size: 13px;
}
.preview-heading small {
  color: #9aabc2;
  font-size: 10px;
}
.preview-heading > span:last-child {
  margin-left: auto;
  color: #7795d8;
}
.preview-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 20px;
}
.preview-board > div {
  min-height: 138px;
  padding: 14px;
  border-radius: 10px;
  background: #f5f7fb;
}
.preview-board strong {
  display: block;
  margin-bottom: 18px;
  color: #7d8faa;
  font-size: 10px;
}
.preview-board i {
  display: block;
  height: 28px;
  margin-top: 8px;
  border: 1px solid #e9edf4;
  border-radius: 7px;
  background: #fff;
}
.login-visual-foot {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 30px;
  margin-top: auto;
  color: #a9badc;
  font-size: 11px;
}
.login-form-side {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 60px 8%;
}
.login-new-member {
  align-self: flex-end;
  margin: 0;
  color: #9ca9ba;
  font-size: 11px;
}
.login-box {
  width: min(100%, 486px);
  margin: auto;
  padding: 30px 0;
}
.login-welcome {
  color: #2f61e8;
  font-size: 13px;
  font-weight: 700;
}
.login-box h2 {
  margin: 16px 0 12px;
  font-size: 33px;
  letter-spacing: -0.03em;
}
.login-subtitle {
  margin: 0 0 48px;
  color: #8391a8;
  font-size: 13px;
}
.login-box :deep(.el-form-item) {
  margin-bottom: 26px;
}
.login-box :deep(.el-form-item__label) {
  margin-bottom: 8px;
}
.login-box :deep(.el-input__wrapper) {
  min-height: 49px;
}
.login-error {
  margin: 4px 0 18px;
}
.login-trace {
  display: block;
  margin-top: 6px;
  font-size: 10px;
  overflow-wrap: anywhere;
}
.login-submit {
  display: flex;
  justify-content: space-between;
  width: 100%;
  min-height: 44px;
  margin-top: 12px;
}
.login-divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 36px 0 24px;
  color: #a1afc2;
  font-size: 10px;
}
.login-divider::before,
.login-divider::after {
  flex: 1;
  height: 1px;
  background: #e8edf4;
  content: '';
}
.login-security {
  text-align: center;
  color: #8796ab;
  font-size: 10px;
}
.login-copyright {
  align-self: center;
  color: #9ca9ba;
  font-size: 10px;
}
@media (max-width: 800px) {
  .login-page {
    grid-template-columns: 1fr;
  }
  .login-visual {
    display: none;
  }
  .login-form-side {
    min-height: 100vh;
    padding: 28px 24px;
  }
  .login-box {
    padding: 30px 0;
  }
}
</style>
