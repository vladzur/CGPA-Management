import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import { useFinanzasStore, type FinanzasInitialState } from './stores/finanzas'
import { readInitialState } from './utils/prerender'
import './index.css'
import App from './App.vue'

const app = createApp(App)

app.use(createPinia())

// El HTML prerenderizado trae el estado ya resuelto. Se siembra el store antes de
// montar para que la primera pintura coincida con el contenido estático y no se
// produzca el parpadeo "número → indicador de carga → número".
const initialState = readInitialState<FinanzasInitialState>()
if (initialState) {
  try {
    useFinanzasStore().hydrate(initialState)
  } catch (error) {
    // Un estado inicial inválido no debe impedir que la aplicación arranque.
    console.warn('[main] No se pudo hidratar el estado inicial:', error)
  }
}

app.use(router)

// Se monta recién cuando la ruta inicial está resuelta: así la vista (y los
// metadatos que define) ya existen cuando el prerender captura el HTML.
await router.isReady()
app.mount('#app')
