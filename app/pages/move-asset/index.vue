<script setup lang="ts">
// Move Asset entry (live: move-asset/index.vue). The live page scans a QR code with the camera or takes a
// tag typed by hand, then checks the tag exists before opening the move form. The camera scanner needs
// the device and is not rebuilt here: the typed tag is the same path, and the sample tags below make it
// quick to try.
import { findAsset, allAssets, isExited, assetsSimRole } from '~/data/assets'

definePageMeta({ layout: 'assets' })
useSeoMeta({ title: 'Move Asset - GoTeam Assets' })

const router = useRouter()
const toast = useToast()
const tag = ref('')
const loading = ref(false)
const notFound = ref(false)
const exited = ref(false)

const samples = computed(() => allAssets().filter(a => !isExited(a)).slice(0, 4).map(a => a.tag))
const canMove = computed(() => assetsSimRole.value === 'officer')

async function onSubmit() {
  notFound.value = false
  exited.value = false
  const t = tag.value.trim()
  if (!t) { notFound.value = true; return }
  loading.value = true
  await new Promise(r => setTimeout(r, 250))
  loading.value = false
  const a = findAsset(t)
  if (!a) {
    notFound.value = true
    toast.add({ color: 'error', title: 'Error', description: 'Asset not found' })
    return
  }
  if (isExited(a)) { exited.value = true; return }
  router.push(`/move-asset/${a.tag}/move`)
}
</script>

<template>
  <div class="h-full overflow-y-auto overscroll-contain bg-gray-50 dark:bg-transparent px-6 py-8 stage-enter">
    <div class="mx-auto w-full max-w-2xl">
      <section class="rounded-lg border border-default bg-card overflow-hidden">
        <div class="px-5 py-4 border-b border-default">
          <h1 class="text-2xl font-semibold text-highlighted">Move Asset</h1>
          <p class="text-sm text-muted pt-1">Scan the asset tag or manually enter the tag.</p>
        </div>

        <div v-if="!canMove" class="p-5">
          <SharedBanner tone="warning" compact title="You can't move assets">
            Only an asset officer can move an asset. Switch the role in the prototype controls to try this page.
          </SharedBanner>
        </div>

        <form v-else class="p-5 flex flex-col gap-4" @submit.prevent="onSubmit">
          <div class="flex flex-col items-center justify-center gap-2 min-h-[220px] rounded-lg border border-dashed border-default bg-elevated/40 text-muted text-center px-6">
            <UIcon name="i-lucide-scan-qr-code" class="size-8" aria-hidden="true" />
            <p class="text-sm font-medium text-default">Camera scanner</p>
            <p class="text-xs">The live app scans the QR code on the asset here. Type the tag below in this prototype.</p>
          </div>

          <div>
            <label for="tag" class="text-xs font-normal text-muted block mb-1.5">Manual Asset Tag Input</label>
            <UInput id="tag" v-model="tag" placeholder="e.g. GT-CE-LTP-1233-0926-0013" autofocus class="w-full" :color="notFound ? 'error' : undefined" @update:model-value="notFound = false; exited = false" />
            <p v-if="notFound" class="text-xs text-red-600 mt-1.5">Asset tag not found. Please check the tag and try again.</p>
            <p v-if="exited" class="text-xs text-red-600 mt-1.5">This unit has already been returned or pulled out, so it can't be moved again.</p>
          </div>

          <div v-if="samples.length" class="flex flex-wrap items-center gap-2">
            <span class="text-xs text-muted">Try:</span>
            <button v-for="s in samples" :key="s" type="button" class="text-xs rounded-full border border-default px-2.5 py-1 text-default hover:bg-elevated transition-colors" @click="tag = s; notFound = false; exited = false">{{ s }}</button>
          </div>

          <div class="flex justify-end">
            <UButton type="submit" color="primary" :loading="loading" label="Find Asset" />
          </div>
        </form>
      </section>
    </div>
  </div>
</template>
