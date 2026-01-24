<script setup>
import { ref } from "vue"
import { useRouter } from "vue-router"
import { useAuthStore } from "../stores/auth.js"
import { Building2, Lock, User, AlertCircle, Loader2 } from "lucide-vue-next"

const router = useRouter()
const authStore = useAuthStore()

const username = ref("")
const password = ref("")
const error = ref("")
const isLoading = ref(false)

async function handleLogin() {
  error.value = ""
  isLoading.value = true

  try {
    const result = await authStore.login(username.value, password.value)

    if (result.success) {
      router.push("/")
    } else {
      error.value = result.error
    }
  } catch (err) {
    error.value = "An unexpected error occurred"
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-40"></div>

    <div class="relative w-full max-w-md">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl shadow-lg shadow-primary-500/30 mb-4">
          <Building2 class="w-8 h-8 text-white" />
        </div>
        <h1 class="text-3xl font-bold text-white mb-2">County Management</h1>
        <p class="text-slate-400">Tax Research & Data System</p>
      </div>

      <div class="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8">
        <form @submit.prevent="handleLogin" class="space-y-6">
          <div v-if="error" class="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300">
            <AlertCircle class="w-5 h-5 flex-shrink-0" />
            <span class="text-sm">{{ error }}</span>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">Username</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User class="w-5 h-5 text-slate-400" />
              </div>
              <input
                v-model="username"
                type="text"
                required
                placeholder="Enter your username"
                class="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">Password</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock class="w-5 h-5 text-slate-400" />
              </div>
              <input
                v-model="password"
                type="password"
                required
                placeholder="Enter your password"
                class="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full py-3 px-4 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Loader2 v-if="isLoading" class="w-5 h-5 animate-spin" />
            <span>{{ isLoading ? "Signing in..." : "Sign In" }}</span>
          </button>

          <p class="text-center text-slate-400 text-sm mt-4">
            Have an invite code?
            <router-link to="/register" class="text-primary-400 hover:text-primary-300">Create account</router-link>
          </p>
        </form>
      </div>

      <p class="text-center text-slate-500 text-sm mt-6">
        Inveritax County Research System
      </p>
    </div>
  </div>
</template>
