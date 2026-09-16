// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import CategoryIcon from '../../src/components/CategoryIcon.svelte'

// 图标加载失败后的可观察契约。原实现是单向闩锁：`imageFailed = true` 之后只在
// 「id/图标/标题」变化时才复位，于是任何一次瞬时加载失败（代理抖动、请求被中断）都会
// 把图标永久钉成文字兜底；access key 到位、URL 变了也不会再试——网络面板里能看到成功
// 响应，界面却仍是首字。这里挂载真实组件，按「失败 → 重试 → 再失败 → 换 URL」断言。

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const ICONIFY_ICON = 'https://api.iconify.design/mdi/school.svg'
const category = (icon: string) => ({ id: 7, title: '学习', icon })

const image = () => document.querySelector('[data-category-icon] img') as HTMLImageElement | null

async function failTwice() {
  await fireEvent(image()!, new Event('error'))
  await vi.advanceTimersByTimeAsync(1200)
  await fireEvent(image()!, new Event('error'))
}

describe('分类图标加载失败的回退', () => {
  it('首次失败先重试，重试也失败才退回文字兜底', async () => {
    vi.useFakeTimers()
    render(CategoryIcon, { props: { category: category(ICONIFY_ICON) } })

    expect(image()!.getAttribute('src')).toBeTruthy()

    await fireEvent(image()!, new Event('error'))
    // 第一次失败不能立刻退化成首字
    expect(image()).toBeTruthy()
    expect(screen.queryByText('学')).toBeNull()

    await vi.advanceTimersByTimeAsync(1200)
    expect(image()!.getAttribute('src')).toContain('retry=1')

    await fireEvent(image()!, new Event('error'))
    expect(image()).toBeNull()
    expect(screen.getByText('学')).toBeTruthy()
  })

  it('换了图标就重新尝试，不停留在上一个图标的失败态', async () => {
    vi.useFakeTimers()
    const { rerender } = render(CategoryIcon, { props: { category: category(ICONIFY_ICON) } })

    await failTwice()
    expect(image()).toBeNull()
    expect(screen.getByText('学')).toBeTruthy()

    await rerender({ category: category('https://api.iconify.design/mdi/book.svg') })

    expect(screen.queryByText('学')).toBeNull()
    expect(image()!.getAttribute('src')).toContain('/api/category-icon/7')
    expect(image()!.getAttribute('src')).not.toBe(category(ICONIFY_ICON).icon)
  })

  it('授权 key 到位后 URL 变化，失败态必须跟着复位', async () => {
    vi.useFakeTimers()
    const { rerender } = render(CategoryIcon, { props: { category: category(ICONIFY_ICON), iconAccessKey: '' } })

    await failTwice()
    expect(image()).toBeNull()

    // 后台预览私密对象的 key 是异步取到的：拿到它时 URL 变了，必须重新加载
    await rerender({ category: category(ICONIFY_ICON), iconAccessKey: '1799999999999.signed' })

    expect(image()!.getAttribute('src')).toContain('key=1799999999999.signed')
  })

  it('文字图标不发起图片请求', () => {
    render(CategoryIcon, { props: { category: { id: 5, title: '杂项', icon: '🛄' } } })

    expect(image()).toBeNull()
    expect(screen.getByText('🛄')).toBeTruthy()
  })

  it('data URI 图标失败不重试，直接退回文字兜底', async () => {
    render(CategoryIcon, {
      props: { category: { id: 8, title: '设计', icon: 'data:image/svg+xml,broken' } },
    })

    await fireEvent(image()!, new Event('error'))

    // 非代理地址重试也不会变好，不能给它拼出更没意义的 URL
    expect(image()).toBeNull()
    expect(screen.getByText('设')).toBeTruthy()
  })
})
