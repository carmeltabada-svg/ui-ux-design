<script setup lang="ts">
// Move Asset done (live: move-asset/[assetTag]/done.vue). Confirms the move, counts down 5 seconds, then
// opens the asset, where the move is already in the Activity Feed and Movements tabs.
import { findAsset } from '~/data/assets'

definePageMeta({ layout: 'assets' })
useSeoMeta({ title: 'Asset moved - GoTeam Assets' })

const route = useRoute()
const router = useRouter()
const tag = computed(() => String(route.params.tag ?? ''))
// An unknown tag has nowhere to go but the entry page.
const known = computed(() => !!findAsset(tag.value))
const assetPath = computed(() => known.value ? `/assets/${encodeURIComponent(tag.value)}/movements` : '/move-asset')

const countdown = ref(5)
let timer: ReturnType<typeof setInterval> | null = null

function go(path: string) {
  if (timer) clearInterval(timer)
  router.push(path)
}

onMounted(() => {
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) go(assetPath.value)
  }, 1000)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div class="h-full overflow-y-auto overscroll-contain bg-gray-50 dark:bg-transparent px-6 py-8 stage-enter">
    <div class="mx-auto w-full max-w-2xl">
      <section class="rounded-lg border border-default bg-card">
        <div class="flex flex-col items-center text-center py-10 px-6">
          <UIcon
            name="i-lucide-circle-check"
            class="size-12 text-green-500 mb-4"
            aria-hidden="true"
          />
          <h1 class="text-2xl font-semibold text-highlighted mb-2">
            Asset Moved Successfully
          </h1>
          <p
            class="text-sm text-muted mb-6"
            role="status"
          >
            {{ tag }} has been moved. You will be redirected in {{ countdown }} seconds.
          </p>
          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Move Another Asset"
              @click="go('/move-asset')"
            />
            <UButton
              color="primary"
              label="View Asset"
              @click="go(assetPath)"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
