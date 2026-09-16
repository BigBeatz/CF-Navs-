<script lang="ts">
  import { onDestroy } from 'svelte'
  import type { CategoryIconValue } from '../lib/categoryIconDisplay'
  import {
    getCategoryIconFallbackText,
    getCategoryImageIconUrl,
    getCategoryTextIcon,
    normalizeCategoryIcon,
  } from '../lib/categoryIconDisplay'
  import { withIconAccessKey } from '../lib/iconAccessKey'

  export let category: CategoryIconValue
  export let size: number | string = 36
  export let className = ''
  export let label = ''
  export let iconAccessKey = ''
  export let imageLoading: 'lazy' | 'eager' = 'lazy'

  // 加载失败只重试一次，重试仍失败才退回文字兜底。原实现是单向闩锁：一次瞬时失败
  // （代理抖动、请求被中断、刷新期间的路由切换）就把图标永久钉成文字，此后即使请求
  // 已经恢复正常也不会再试——网络面板里能看到成功响应，界面却一直是首字。
  const ICON_RETRY_DELAY_MS = 1200

  let baseUrl = ''
  let retryUrl = ''
  let failedUrl = ''
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  $: iconValue = normalizeCategoryIcon(category)
  $: nextImageUrl = withIconAccessKey(getCategoryImageIconUrl(category), iconAccessKey)
  // 图标或授权 key 变化（换图标、key 续签）时必须重新计数，否则上一条 URL 的失败态
  // 会挡住新图标。
  $: if (nextImageUrl !== baseUrl) {
    baseUrl = nextImageUrl
    retryUrl = ''
    failedUrl = ''
    clearRetryTimer()
  }
  $: imageUrl = retryUrl || baseUrl
  $: textIcon = getCategoryTextIcon(category)

  function clearRetryTimer(): void {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  function handleImageError(): void {
    // 只有同源代理地址值得重试：data URI 加载失败不是网络问题，重试也不会变好，
    // 给它拼 `&retry=1` 只会得到一个更没意义的 URL。
    if (retryUrl || !baseUrl.startsWith('/api/')) {
      failedUrl = retryUrl || baseUrl
      return
    }

    clearRetryTimer()
    retryTimer = setTimeout(() => {
      retryTimer = null
      retryUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}retry=1`
    }, ICON_RETRY_DELAY_MS)
  }

  // 成功加载后不清空 retryUrl：那会把 src 换回失败过的 baseUrl，形成失败—重试的循环。
  // retryUrl 只在下一次 baseUrl 变化时重置。

  onDestroy(clearRetryTimer)
</script>

{#if iconValue}
  <span
    class={`category-icon ${className}`.trim()}
    style={`--category-icon-size: ${typeof size === 'number' ? `${size}px` : size}`}
    data-category-icon
    aria-hidden={label ? undefined : 'true'}
    aria-label={label || undefined}
  >
    {#if imageUrl && imageUrl !== failedUrl}
      <img src={imageUrl} alt="" loading={imageLoading} decoding="async" on:error={handleImageError} />
    {:else if textIcon}
      <span class="category-icon-text">{textIcon}</span>
    {:else}
      <span class="category-icon-text category-icon-fallback">{getCategoryIconFallbackText(category)}</span>
    {/if}
  </span>
{/if}

<style>
  .category-icon {
    width: var(--category-icon-size, 36px);
    height: var(--category-icon-size, 36px);
    min-width: var(--category-icon-size, 36px);
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--home-text-color, #0f172a) 14%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--home-stat-bg, rgba(255, 255, 255, 0.5)) 84%, transparent);
    color: var(--home-text-color, #0f172a);
    line-height: 1;
  }

  .category-icon img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
  :global(.admin-icon-badge.category-icon) {
    border: 0;
    border-radius: 8px;
    background: var(--admin-icon-badge-bg, var(--home-stat-bg, rgba(255, 255, 255, 0.5)));
    color: var(--admin-subtle, var(--home-text-color, #0f172a));
  }

  :global(.admin-icon-badge.category-icon) img {
    width: 18px;
    height: 18px;
    object-fit: contain;
  }

  .category-icon-text {
    max-width: 100%;
    padding: 0.15em;
    overflow: hidden;
    font-size: min(1.35rem, calc(var(--category-icon-size, 36px) * 0.55));
    font-weight: 700;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .category-icon-fallback {
    font-size: min(1rem, calc(var(--category-icon-size, 36px) * 0.42));
    opacity: 0.68;
  }
</style>
