import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@payloadcms/ui', () => ({
  Button: () => null,
  DrawerToggler: () => null,
  ItemsDrawer: () => null,
  ReactSelect: () => null,
  useStepNav: () => ({ setStepNav: vi.fn() }),
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { DashboardBreadcrumbDropdown } from './DashboardStepNav.js'

describe('DashboardBreadcrumbDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should give the dashboard select an accessible name', () => {
    const element = DashboardBreadcrumbDropdown({
      isEditing: false,
      onCancel: vi.fn(),
      onEditClick: vi.fn(),
      onResetLayout: vi.fn(),
      onSaveChanges: vi.fn(),
      widgetsDrawerSlug: 'widgets-drawer',
    })

    expect(element.props['aria-label']).toBe('general:dashboard')
  })
})
