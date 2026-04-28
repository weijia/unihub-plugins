<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { HardDrive, RefreshCw, AlertCircle, CheckCircle2, Loader2, Settings, Save, X } from 'lucide-vue-next'

interface DiskInfo {
  name: string
  mount: string
  type: string
  size: string
  used: string
  available: string
  usePercent: number
  inodeTotal?: number
  inodeUsed?: number
  inodeFree?: number
  inodePercent?: number
  host?: string
  serialNumber?: string
}

interface DiskData {
  disks: DiskInfo[]
  lastUpdate: string
  totalDisks: number
}

interface HostInfo {
  device_uuid: string
  device_name: string
  hostname: string
  platform: string
  platform_version: string
  machine: string
}

interface LogicalDisk {
  DeviceID: string
  VolumeName: string
  FileSystem: string
  SizeGB: number
  FreeSpaceGB: number
  UsedSpaceGB: number
  UsagePercent: number
  DriveType: number
  SerialNumber?: string
}

interface Host {
  host_info: HostInfo
  collection_time: string
  logical_disks: LogicalDisk[]
  last_updated: string
}

interface AllHostsDiskData {
  hosts: Host[]
  last_updated: string
}

interface WebDAVConfig {
  enabled: boolean
  url: string
  username: string
  password: string
}

const diskData = ref<DiskData | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const lastRefresh = ref<Date | null>(null)
const showConfig = ref(false)

// 从 localStorage 加载配置
const loadConfig = (): WebDAVConfig => {
  try {
    const configStr = localStorage.getItem('webdav-config')
    if (configStr) {
      return JSON.parse(configStr)
    }
  } catch (e) {
    console.error('Error loading config:', e)
  }
  return {
    enabled: false,
    url: 'http://localhost:8080/dav/all_hosts_disk_info.json',
    username: '',
    password: ''
  }
}

const saveConfig = (config: WebDAVConfig) => {
  try {
    localStorage.setItem('webdav-config', JSON.stringify(config))
  } catch (e) {
    console.error('Error saving config:', e)
  }
}

const webdavConfig = ref<WebDAVConfig>(loadConfig())

watch(webdavConfig, (newConfig) => {
  saveConfig(newConfig)
}, { deep: true })

const loadDiskInfo = async () => {
  loading.value = true
  error.value = null

  try {
    let response
    if (webdavConfig.value.enabled && webdavConfig.value.url) {
      const headers = new Headers()
      if (webdavConfig.value.username && webdavConfig.value.password) {
        const credentials = btoa(`${webdavConfig.value.username}:${webdavConfig.value.password}`)
        headers.append('Authorization', `Basic ${credentials}`)
      }
      response = await fetch(webdavConfig.value.url, {
        headers
      })
    } else {
      response = await fetch('file:///O:/app_data/disks/all_hosts_disk_info.json')
    }

    if (!response.ok) {
      throw new Error(`Failed to load disk info: ${response.status} ${response.statusText}`)
    }

    const rawData: AllHostsDiskData = await response.json()

    const disks: DiskInfo[] = []
    for (const host of rawData.hosts) {
      for (const logicalDisk of host.logical_disks) {
        disks.push({
          name: logicalDisk.VolumeName || logicalDisk.DeviceID,
          mount: logicalDisk.DeviceID,
          type: logicalDisk.FileSystem,
          size: `${logicalDisk.SizeGB.toFixed(1)} GB`,
          used: `${logicalDisk.UsedSpaceGB.toFixed(1)} GB`,
          available: `${logicalDisk.FreeSpaceGB.toFixed(1)} GB`,
          usePercent: Math.round(logicalDisk.UsagePercent),
          host: host.host_info.hostname,
          serialNumber: logicalDisk.SerialNumber
        })
      }
    }

    diskData.value = {
      disks,
      lastUpdate: rawData.last_updated,
      totalDisks: disks.length
    }
    lastRefresh.value = new Date()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load disk information'
    console.error('Error loading disk info:', err)
  } finally {
    loading.value = false
  }
}

const getUsageColor = (percent: number) => {
  if (percent >= 90) return 'text-red-500 dark:text-red-400'
  if (percent >= 70) return 'text-amber-500 dark:text-amber-400'
  return 'text-emerald-500 dark:text-emerald-400'
}

const getUsageBgColor = (percent: number) => {
  if (percent >= 90) return 'bg-red-500 dark:bg-red-400'
  if (percent >= 70) return 'bg-amber-500 dark:bg-amber-400'
  return 'bg-emerald-500 dark:bg-emerald-400'
}

const formatSize = (sizeStr: string) => {
  if (!sizeStr) return '-'
  const match = sizeStr.match(/^([\d.]+)([KMGT]?B?)$/i)
  if (!match) return sizeStr
  return sizeStr
}

const formatDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr)
    return date.toLocaleString()
  } catch {
    return dateStr
  }
}

const diskStats = computed(() => {
  if (!diskData.value?.disks) return { total: 0, healthy: 0, warning: 0, critical: 0 }
  
  const disks = diskData.value.disks
  return {
    total: disks.length,
    healthy: disks.filter(d => d.usePercent < 70).length,
    warning: disks.filter(d => d.usePercent >= 70 && d.usePercent < 90).length,
    critical: disks.filter(d => d.usePercent >= 90).length
  }
})

onMounted(() => {
  loadDiskInfo()
})
</script>

<template>
  <div class="relative flex h-full w-full overflow-hidden">
    <div
      class="absolute -left-24 -top-32 h-80 w-80 rounded-full bg-blue-300/40 blur-3xl dark:bg-blue-200/20"
    ></div>
    <div
      class="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-purple-300/40 blur-3xl dark:bg-purple-200/20"
    ></div>
    <div
      class="absolute left-1/3 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-200/30 blur-3xl dark:bg-cyan-300/10"
    ></div>

    <div class="relative z-10 flex h-full w-full flex-col gap-5 p-6">
      <header class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2 text-xl font-semibold text-slate-800 dark:text-slate-100">
            <HardDrive class="h-5 w-5 text-primary" />
            磁盘信息查看器
          </div>
          <div class="ml-auto flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span v-if="lastRefresh" class="rounded-full bg-white/70 px-2 py-1 dark:bg-slate-800/70">
              最后更新: {{ lastRefresh.toLocaleTimeString() }}
            </span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button
            class="flex h-10 items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/80 px-4 text-sm font-medium text-slate-600 shadow-sm backdrop-blur transition hover:text-slate-900 dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:text-white"
            :disabled="loading"
            @click="loadDiskInfo"
          >
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
            <RefreshCw v-else class="h-4 w-4" />
            刷新
          </button>
          <button
            class="flex h-10 items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/80 px-4 text-sm font-medium text-slate-600 shadow-sm backdrop-blur transition hover:text-slate-900 dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:text-white"
            @click="showConfig = true"
          >
            <Settings class="h-4 w-4" />
            配置
          </button>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto pr-1">
        <div v-if="loading && !diskData" class="flex h-full items-center justify-center">
          <div class="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
            <Loader2 class="h-8 w-8 animate-spin" />
            <span>正在加载磁盘信息...</span>
          </div>
        </div>

        <div v-else-if="error" class="flex h-full items-center justify-center">
          <div class="flex flex-col items-center gap-3 text-red-500 dark:text-red-400">
            <AlertCircle class="h-8 w-8" />
            <span>{{ error }}</span>
            <button
              class="mt-2 flex h-10 items-center gap-2 rounded-2xl border border-red-200/70 bg-red-50/80 px-4 text-sm font-medium text-red-600 shadow-sm backdrop-blur transition hover:bg-red-100 dark:border-red-400/20 dark:bg-red-900/20 dark:text-red-200 dark:hover:bg-red-900/30"
              @click="loadDiskInfo"
            >
              重试
            </button>
          </div>
        </div>

        <div v-else-if="diskData" class="grid gap-4">
          <div class="grid gap-4 lg:grid-cols-4">
            <section
              class="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/70"
            >
              <div class="text-sm font-medium text-slate-500 dark:text-slate-400">磁盘总数</div>
              <div class="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {{ diskStats.total }}
              </div>
            </section>

            <section
              class="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/70"
            >
              <div class="flex items-center gap-2 text-sm font-medium text-emerald-500 dark:text-emerald-400">
                <CheckCircle2 class="h-4 w-4" />
                正常
              </div>
              <div class="mt-2 text-3xl font-semibold text-emerald-600 dark:text-emerald-400">
                {{ diskStats.healthy }}
              </div>
            </section>

            <section
              class="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/70"
            >
              <div class="flex items-center gap-2 text-sm font-medium text-amber-500 dark:text-amber-400">
                <AlertCircle class="h-4 w-4" />
                警告
              </div>
              <div class="mt-2 text-3xl font-semibold text-amber-600 dark:text-amber-400">
                {{ diskStats.warning }}
              </div>
            </section>

            <section
              class="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/70"
            >
              <div class="flex items-center gap-2 text-sm font-medium text-red-500 dark:text-red-400">
                <AlertCircle class="h-4 w-4" />
                严重
              </div>
              <div class="mt-2 text-3xl font-semibold text-red-600 dark:text-red-400">
                {{ diskStats.critical }}
              </div>
            </section>
          </div>

          <section
            class="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/70"
          >
            <div class="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
              磁盘列表
              <span v-if="diskData.lastUpdate" class="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                ({{ formatDate(diskData.lastUpdate) }})
              </span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-slate-200/60 dark:border-slate-700/60">
                    <th class="py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      主机
                    </th>
                    <th class="py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      名称
                    </th>
                    <th class="py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      SN
                    </th>
                    <th class="py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      挂载点
                    </th>
                    <th class="py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      类型
                    </th>
                    <th class="py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      总容量
                    </th>
                    <th class="py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      已用
                    </th>
                    <th class="py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      可用
                    </th>
                    <th class="py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      使用率
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="disk in diskData.disks"
                    :key="`${disk.host || 'local'}-${disk.mount}`"
                    class="border-b border-slate-100 transition-colors hover:bg-slate-50/50 dark:border-slate-800/50 dark:hover:bg-slate-800/30"
                  >
                    <td class="py-3 text-sm text-slate-600 dark:text-slate-300">
                      {{ disk.host || '-' }}
                    </td>
                    <td class="py-3 text-sm font-medium text-slate-900 dark:text-white">
                      {{ disk.name }}
                    </td>
                    <td class="py-3 font-mono text-sm text-slate-600 dark:text-slate-300">
                      {{ disk.serialNumber || '-' }}
                    </td>
                    <td class="py-3 font-mono text-sm text-slate-600 dark:text-slate-300">
                      {{ disk.mount }}
                    </td>
                    <td class="py-3 text-sm text-slate-600 dark:text-slate-300">
                      {{ disk.type }}
                    </td>
                    <td class="py-3 text-sm text-slate-600 dark:text-slate-300">
                      {{ formatSize(disk.size) }}
                    </td>
                    <td class="py-3 text-sm text-slate-600 dark:text-slate-300">
                      {{ formatSize(disk.used) }}
                    </td>
                    <td class="py-3 text-sm text-slate-600 dark:text-slate-300">
                      {{ formatSize(disk.available) }}
                    </td>
                    <td class="py-3">
                      <div class="flex items-center gap-2">
                        <div class="w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            class="h-2 rounded-full transition-all"
                            :class="getUsageBgColor(disk.usePercent)"
                            :style="{ width: `${Math.min(disk.usePercent, 100)}%` }"
                          ></div>
                        </div>
                        <span
                          class="w-10 text-right text-sm font-medium"
                          :class="getUsageColor(disk.usePercent)"
                        >
                          {{ disk.usePercent }}%
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div v-if="diskData?.disks?.length === 0" class="py-8 text-center text-slate-500 dark:text-slate-400">
                暂无磁盘信息
              </div>
            </div>
          </section>
        </div>
      </main>

      <!-- WebDAV 配置模态框 -->
      <div v-if="showConfig" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="w-full max-w-md rounded-3xl border border-white/60 bg-white/90 p-6 shadow-lg backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/90">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100">WebDAV 配置</h2>
            <button
              class="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              @click="showConfig = false"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="webdav-enabled"
                v-model="webdavConfig.enabled"
                class="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600 dark:bg-slate-700"
              />
              <label for="webdav-enabled" class="text-sm font-medium text-slate-700 dark:text-slate-300">启用 WebDAV</label>
            </div>

            <div class="space-y-2">
              <label for="webdav-url" class="block text-sm font-medium text-slate-700 dark:text-slate-300">WebDAV URL</label>
              <input
                type="text"
                id="webdav-url"
                v-model="webdavConfig.url"
                placeholder="http://localhost:8080/dav/all_hosts_disk_info.json"
                class="w-full rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-2 text-sm text-slate-900 shadow-sm backdrop-blur transition dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-100"
              />
            </div>

            <div class="space-y-2">
              <label for="webdav-username" class="block text-sm font-medium text-slate-700 dark:text-slate-300">用户名</label>
              <input
                type="text"
                id="webdav-username"
                v-model="webdavConfig.username"
                placeholder="可选"
                class="w-full rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-2 text-sm text-slate-900 shadow-sm backdrop-blur transition dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-100"
              />
            </div>

            <div class="space-y-2">
              <label for="webdav-password" class="block text-sm font-medium text-slate-700 dark:text-slate-300">密码</label>
              <input
                type="password"
                id="webdav-password"
                v-model="webdavConfig.password"
                placeholder="可选"
                class="w-full rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-2 text-sm text-slate-900 shadow-sm backdrop-blur transition dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-100"
              />
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              class="flex h-10 items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/80 px-4 text-sm font-medium text-slate-600 shadow-sm backdrop-blur transition hover:text-slate-900 dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:text-white"
              @click="showConfig = false"
            >
              取消
            </button>
            <button
              class="flex h-10 items-center gap-2 rounded-2xl bg-primary/90 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-primary"
              @click="showConfig = false; loadDiskInfo()"
            >
              <Save class="h-4 w-4" />
              保存并刷新
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>