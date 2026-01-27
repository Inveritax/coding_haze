import { createRouter, createWebHistory } from "vue-router"
import { useAuthStore } from "./stores/auth.js"

const routes = [
  {
    path: "/login",
    name: "Login",
    component: () => import("./views/LoginView.vue")
  },
  {
    path: "/register",
    name: "Register",
    component: () => import("./views/RegisterView.vue")
  },
  {
    path: "/",
    name: "Dashboard",
    component: () => import("./views/DashboardView.vue"),
    meta: { requiresAuth: true }
  },
  {
    path: "/survey/:uniqueId",
    name: "Survey",
    component: () => import("./views/SurveyView.vue")
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  const isAuthenticated = authStore.isAuthenticated

  if (to.meta.requiresAuth && !isAuthenticated) {
    next("/login")
  } else if ((to.path === "/login" || to.path === "/register") && isAuthenticated) {
    next("/")
  } else {
    next()
  }
})

export default router
